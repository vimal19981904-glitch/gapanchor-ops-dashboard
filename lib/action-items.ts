import { PrismaClient } from '@prisma/client';
import { getTranscriptKnowledgeSnapshot } from '@/lib/transcript-knowledge-engine';

export interface ActionItem {
  text: string;
  status: 'pending' | 'completed';
  priority?: 'High' | 'Medium' | 'Low';
}

export interface ClientActionItemProfile {
  enquiryId: string;
  clientName: string;
  firstName: string;
  course: string;
  score: number | null;
  clientSummary: string;
  contactStatus: string;
  status: 'pending' | 'completed' | 'partially_completed';
  total: number;
  pendingCount: number;
  completedCount: number;
  pending: string[];
  completed: string[];
  priority: 'High' | 'Medium' | 'Low';
  isImmediateAction: boolean;
  isLost: boolean;
  isOverdue: boolean;
  dueDate: string | null;
  sources: Array<'CX' | 'Teams Transcript' | 'CRM Notes'>;
  category: 'demo' | 'scheduling' | 'pricing' | 'callback' | 'outreach' | 'enrollment' | 'general';
}

function isLostLeadStatus(contactStatus?: string | null, status?: string | null): boolean {
  const c = (contactStatus || '').trim().toLowerCase();
  const s = (status || '').trim().toLowerCase();
  return c === 'lost' || c === 'not interested' || s === 'lost';
}

function sanitizeActionTextForSpeech(raw: string): string {
  return raw
    .replace(/[\r\n]+/g, ' ')
    .replace(/\+?\d[\d\s\-]{7,}\d/g, '')
    .replace(/\bfollow-ups\b/gi, 'follow up activities')
    .replace(/\bfollow-up\b/gi, 'follow up')
    .replace(/\bhigh-priority\b/gi, 'high priority')
    .replace(/\bone-on-one\b/gi, 'one on one')
    .replace(/\bnext-steps?\b/gi, 'next steps')
    .replace(/\b9\s*-\s*10\s*pm\b/gi, '9 to 10 PM')
    .replace(/\bpost-demo\b/gi, 'post demo')
    .replace(/\bre-attempt\b/gi, 'reattempt')
    .replace(/\bre-establish\b/gi, 'reestablish')
    .replace(/\b(\d+)k\b/gi, '$1 thousand')
    .replace(/\b([a-zA-Z]+)-([a-zA-Z]+)\b/g, '$1 $2')
    .replace(/\s{2,}/g, ' ')
    .replace(/\.$/, '')
    .trim();
}

/**
 * Parses action items from customerExperience markdown or nextAction fallback.
 * Strictly reads action item tables/lists (Section 9 Immediate Follow-up Actions,
 * Section 5 Next Actions, or tables with Action Item/Task + Status headers) so
 * qualification or pricing tables never leak in as false action items.
 */
export function extractActionItems(
  cxText: string | null | undefined,
  nextActionFallback?: string | null
): ActionItem[] {
  const items: ActionItem[] = [];
  const seen = new Set<string>();

  if (cxText) {
    const lines = cxText.split(/\r?\n/);
    let headerActionIdx = -1;
    let headerStatusIdx = -1;
    let inActionSection = false;
    let inActionTable = false;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) {
        inActionTable = false;
        continue;
      }

      if (/^(?:9\.\s*)?Immediate\s+Follow[\s-]?up\s+Actions|^(?:5\.\s*)?Next\s+Actions|^Action\s+Items/i.test(line)) {
        inActionSection = true;
        inActionTable = false;
        continue;
      }
      if (inActionSection && /^(?:CRM\s+Lead\s+Status|Overall\s+Outcome|\d+\.\s+[A-Z])/i.test(line)) {
        inActionSection = false;
        inActionTable = false;
      }

      // Skip markdown separator rows like |---|---|---|
      if (/^\|?[\s\-:|]+\|?$/.test(line) && line.includes('-')) continue;

      const isTableRow = line.includes('\t') || line.includes('|');
      if (isTableRow) {
        const cells = line.includes('\t')
          ? line.split('\t').map((c) => c.trim())
          : line.split('|').map((c) => c.trim()).filter(Boolean);

        if (cells.length < 2) continue;

        // Header row detection — strictly requires Action Item / Task column
        if (cells.some((c) => /action\s*item|follow[\s-]?up\s*action|^task$/i.test(c))) {
          headerActionIdx = cells.findIndex((c) => /action\s*item|follow[\s-]?up\s*action|^task$/i.test(c));
          headerStatusIdx = cells.findIndex((c) => /^status$/i.test(c));
          inActionTable = true;
          continue;
        }

        // Only parse rows inside an Action Item table or Action Section
        if (!inActionTable && !inActionSection) continue;

        const statusCell = headerStatusIdx >= 0 && cells[headerStatusIdx] !== undefined
          ? cells[headerStatusIdx]
          : cells[cells.length - 1];

        const isDone = /^(?:done|completed|confirmed|sent|resolved)$/i.test(statusCell) || /\b(?:done|completed)\b/i.test(statusCell);
        const isPending = /^(?:pending|open|in\s*progress|to\s*do|todo)$/i.test(statusCell) || /\bpending\b/i.test(statusCell);

        let priority: 'High' | 'Medium' | 'Low' = 'Medium';
        if (cells.some((c) => /^high$/i.test(c))) priority = 'High';
        else if (cells.some((c) => /^low$/i.test(c))) priority = 'Low';

        if (isPending || isDone) {
          const idx = headerActionIdx >= 0 ? headerActionIdx : 1;
          let desc = cells[idx] || cells[1] || cells[0];
          desc = desc.replace(/^[\*\_\`\-\•\d\.\s]+/, '').replace(/[\*\_\`]+$/, '').trim();

          if (
            desc &&
            !/^(priority|status|action item|gapanchor|done|pending|responsibility)$/i.test(desc) &&
            !seen.has(desc.toLowerCase())
          ) {
            seen.add(desc.toLowerCase());
            items.push({
              text: desc,
              status: isDone ? 'completed' : 'pending',
              priority,
            });
          }
        }
        continue;
      }

      // Handle bullet list inside Immediate Follow-up Actions section if not formatted as a table
      if (inActionSection && /^[•\-\*]\s+/.test(line)) {
        const cleaned = line.replace(/^[•\-\*]\s+/, '').trim();
        const isDone = /\((?:done|completed)\)|\[x\]/i.test(cleaned);
        const desc = cleaned
          .replace(/\[[x\s]\]/gi, '')
          .replace(/\((?:done|completed|pending|open)\)/gi, '')
          .trim();
        if (desc.length > 4 && !seen.has(desc.toLowerCase())) {
          seen.add(desc.toLowerCase());
          items.push({
            text: desc,
            status: isDone ? 'completed' : 'pending',
            priority: 'High',
          });
        }
      }
    }
  }

  // Fallback: if no table/list parsed from CX, use nextAction from Teams Transcript analysis
  if (items.length === 0 && nextActionFallback && nextActionFallback.trim().length > 3) {
    items.push({
      text: nextActionFallback.trim(),
      status: 'pending',
      priority: 'High',
    });
  }

  return items;
}

function classifyActionCategory(texts: string[]): ClientActionItemProfile['category'] {
  const joined = texts.join(' ').toLowerCase();
  if (joined.includes('payment') || joined.includes('invoice') || joined.includes('enroll')) return 'enrollment';
  if (joined.includes('demo') || joined.includes('recording')) return 'demo';
  if (joined.includes('pricing') || joined.includes('price') || joined.includes('fee') || joined.includes('44k') || joined.includes('discount')) return 'pricing';
  if (joined.includes('batch') || joined.includes('schedule') || joined.includes('cohort') || joined.includes('slot') || joined.includes('timing')) return 'scheduling';
  if (joined.includes('re-attempt') || joined.includes('re-establish') || joined.includes('whatsapp contact') || joined.includes('disconnect') || joined.includes('unanswered')) return 'outreach';
  if (joined.includes('discovery') || joined.includes('follow') || joined.includes('call')) return 'callback';
  return 'general';
}

function extractNoteTasks(notes: string, isOverdue: boolean): string[] {
  const tasks: string[] = [];
  const cleanNote = notes.replace(/[\r\n]+/g, ' ').replace(/\+?\d[\d\s\-]{7,}\d/g, '').replace(/\s{2,}/g, ' ').trim();
  const nLower = cleanNote.toLowerCase();

  // Skip dead / explicitly declined notes unless overdue deadline was explicitly scheduled
  if ((nLower.includes('not interested') || nLower.includes('wrong number')) && !isOverdue) {
    return tasks;
  }

  if (nLower.includes('demo') && (nLower.includes('send') || nLower.includes('conduct') || nLower.includes('schedule') || nLower.includes('need') || nLower.includes('ask'))) {
    tasks.push('Coordinate demo session and share recording');
  }
  if (nLower.includes('pricing') || nLower.includes('price') || nLower.includes('fee') || nLower.includes('payment details') || nLower.includes('35k') || nLower.includes('40k') || nLower.includes('discount')) {
    const kMatch = cleanNote.match(/(\d+\s*k)/i);
    tasks.push(kMatch ? `Follow up on ${kMatch[1]} pricing request and fee structure` : 'Follow up on pricing and timing discussion');
  }
  if (nLower.includes('disconnect') || nLower.includes('not responded') || nLower.includes('tried calling') || nLower.includes('unanswered')) {
    tasks.push('Reattempt outreach as previous call was unanswered or disconnected');
  }
  if (nLower.includes('feb') || nLower.includes('january') || nLower.includes('december') || nLower.includes('next batch') || nLower.includes('fresher batch') || nLower.includes('morning batch')) {
    tasks.push('Confirm upcoming batch schedule and timing preference');
  }
  if (
    tasks.length === 0 &&
    (nLower.includes('call back') ||
      nLower.includes('follow up') ||
      nLower.includes('do follow') ||
      nLower.includes('call thursday') ||
      nLower.includes('call tomorrow') ||
      nLower.includes('2 days') ||
      nLower.includes('discuss with family'))
  ) {
    tasks.push('Follow up as requested after candidate review');
  }
  if (tasks.length === 0 && isOverdue) {
    tasks.push('Follow up on overdue callback deadline');
  }

  return tasks;
}

/**
 * Loads and aggregates ALL action items across the entire CRM:
 * 1. LeadCall customerExperience structured dossiers (Pending vs Done)
 * 2. LeadCall nextAction directives from Teams Transcript analyses
 * 3. Unsynced local Teams Transcript files via TranscriptKnowledgeEngine
 * 4. Enquiry processedNotes (demo requests, pricing questions, callbacks, disconnected retries)
 * 5. Enquiry callFollowUpDate (upcoming and overdue deadlines)
 */
export async function getAllLeadActionItemProfiles(
  prisma: PrismaClient
): Promise<ClientActionItemProfile[]> {
  const [calls, enquiries, transcriptSnapshot] = await Promise.all([
    prisma.leadCall.findMany({
      where: {
        OR: [
          { customerExperience: { not: null } },
          { nextAction: { not: null } },
        ],
      },
      select: {
        id: true,
        enquiryId: true,
        summary: true,
        customerExperience: true,
        nextAction: true,
        score: true,
        callDate: true,
        enquiry: {
          select: {
            id: true,
            participantName: true,
            trainingType: true,
            topic: true,
            leadQuality: true,
            contactStatus: true,
            status: true,
            processedNotes: true,
            callFollowUpDate: true,
          },
        },
      },
      orderBy: { callDate: 'desc' },
    }),
    prisma.enquiry.findMany({
      where: {
        OR: [
          { processedNotes: { not: null } },
          { callFollowUpDate: { not: null } },
        ],
      },
      select: {
        id: true,
        participantName: true,
        trainingType: true,
        topic: true,
        processedNotes: true,
        callFollowUpDate: true,
        contactStatus: true,
        leadQuality: true,
        status: true,
        callScore: true,
        messageTimestamp: true,
      },
      orderBy: { messageTimestamp: 'desc' },
    }),
    getTranscriptKnowledgeSnapshot().catch(() => ({
      records: [],
      highInterestCandidates: [],
      compactPromptContext: '',
      totalTranscripts: 0,
    })),
  ]);

  const clientsByEnquiryId = new Map<string, ClientActionItemProfile>();
  const nameToEnquiryId = new Map<string, string>();
  const now = new Date();

  // 1. Process LeadCalls (Teams Transcript analyses & Customer Experience dossiers)
  for (const c of calls) {
    if (!c.enquiry) continue;
    if (clientsByEnquiryId.has(c.enquiryId)) continue; // Keep latest call record per enquiry

    const clientName = (c.enquiry.participantName || 'Unknown Lead').trim();
    const isLost = isLostLeadStatus(c.enquiry.contactStatus, c.enquiry.status);
    const items = extractActionItems(c.customerExperience, c.nextAction);
    if (items.length === 0) continue;

    const pending = items.filter((i) => i.status === 'pending').map((i) => i.text);
    const completed = items.filter((i) => i.status === 'completed').map((i) => i.text);

    let status: 'pending' | 'completed' | 'partially_completed' = 'completed';
    if (pending.length > 0 && completed.length > 0) {
      status = 'partially_completed';
    } else if (pending.length > 0) {
      status = 'pending';
    }

    let isOverdue = false;
    let dueDateStr: string | null = null;
    if (c.enquiry.callFollowUpDate) {
      dueDateStr = c.enquiry.callFollowUpDate instanceof Date
        ? c.enquiry.callFollowUpDate.toISOString().split('T')[0]
        : String(c.enquiry.callFollowUpDate);
      const d = new Date(c.enquiry.callFollowUpDate);
      if (!isNaN(d.getTime()) && d < now) {
        isOverdue = true;
      }
    }

    const hasHighPriorityItem = items.some((i) => i.status === 'pending' && i.priority === 'High');
    let priority: 'High' | 'Medium' | 'Low' = 'Medium';
    if (hasHighPriorityItem || isOverdue || c.enquiry.leadQuality === 'High' || (c.score !== null && c.score >= 8)) {
      priority = 'High';
    }

    const isImmediateAction =
      !isLost &&
      pending.length > 0 &&
      (hasHighPriorityItem || isOverdue || (c.score !== null && c.score >= 8) || c.enquiry.leadQuality === 'High');

    const firstName = clientName.split(' ')[0] || clientName;
    const course = c.enquiry.trainingType || c.enquiry.topic || 'Enterprise Training';
    const category = classifyActionCategory(pending);

    let clientSummary = '';
    if (c.summary && c.summary.length > 15) {
      const firstSentence = c.summary.split(/(?<=[.!?])\s+/)[0] || c.summary;
      clientSummary = firstSentence.slice(0, 180).trim();
      if (!/[.!?]$/.test(clientSummary)) clientSummary += '.';
    } else if (c.enquiry.processedNotes) {
      clientSummary = c.enquiry.processedNotes.slice(0, 150).trim();
    } else {
      clientSummary = `Candidate in ${c.enquiry.contactStatus || 'active'} status for ${course}.`;
    }

    const sources: ClientActionItemProfile['sources'] = [];
    if (c.customerExperience) sources.push('CX');
    sources.push('Teams Transcript');

    clientsByEnquiryId.set(c.enquiryId, {
      enquiryId: c.enquiry.id,
      clientName,
      firstName,
      course,
      score: c.score,
      clientSummary,
      contactStatus: c.enquiry.contactStatus || 'Active',
      status,
      total: items.length,
      pendingCount: pending.length,
      completedCount: completed.length,
      pending,
      completed,
      priority,
      isImmediateAction,
      isLost,
      isOverdue,
      dueDate: dueDateStr,
      sources,
      category,
    });
    nameToEnquiryId.set(clientName.toLowerCase(), c.enquiryId);
  }

  // 2. Process Enquiries (operator notes, follow-up deadlines, disconnected retry calls)
  for (const e of enquiries) {
    if (!e.participantName) continue;
    const clientName = e.participantName.trim();
    const isLost = isLostLeadStatus(e.contactStatus, e.status);
    if (isLost) continue;

    const notes = (e.processedNotes || '').trim();
    let isOverdue = false;
    let dueDateStr: string | null = null;
    if (e.callFollowUpDate) {
      dueDateStr = e.callFollowUpDate instanceof Date
        ? e.callFollowUpDate.toISOString().split('T')[0]
        : String(e.callFollowUpDate);
      const d = new Date(e.callFollowUpDate);
      if (!isNaN(d.getTime()) && d < now) {
        isOverdue = true;
      }
    }

    const extraPending = notes ? extractNoteTasks(notes, isOverdue) : (isOverdue ? ['Follow up on overdue callback deadline'] : []);
    if (extraPending.length === 0) continue;

    const existingId = clientsByEnquiryId.has(e.id) ? e.id : nameToEnquiryId.get(clientName.toLowerCase());
    const existing = existingId ? clientsByEnquiryId.get(existingId) : undefined;

    if (existing) {
      if (!existing.sources.includes('CRM Notes')) existing.sources.push('CRM Notes');
      for (const ep of extraPending) {
        const prefix = ep.slice(0, 14).toLowerCase();
        if (!existing.pending.some((p) => p.toLowerCase().includes(prefix))) {
          existing.pending.push(ep);
          existing.pendingCount++;
          existing.total++;
          if (existing.status === 'completed') existing.status = 'partially_completed';
        }
      }
      if (isOverdue) {
        existing.isOverdue = true;
        existing.isImmediateAction = !existing.isLost;
        existing.priority = 'High';
      }
      if (dueDateStr && !existing.dueDate) existing.dueDate = dueDateStr;
    } else {
      const firstName = clientName.split(' ')[0] || clientName;
      const course = e.trainingType || e.topic || 'Enterprise Training';
      const isImmediate = isOverdue || e.leadQuality === 'High' || (typeof e.callScore === 'number' && e.callScore >= 8);
      const priority: 'High' | 'Medium' | 'Low' = isImmediate ? 'High' : 'Medium';

      clientsByEnquiryId.set(e.id, {
        enquiryId: e.id,
        clientName,
        firstName,
        course,
        score: e.callScore ?? null,
        clientSummary: notes || `Lead in ${e.contactStatus || 'active'} status for ${course}.`,
        contactStatus: e.contactStatus || 'Active',
        status: 'pending',
        total: extraPending.length,
        pendingCount: extraPending.length,
        completedCount: 0,
        pending: extraPending,
        completed: [],
        priority,
        isImmediateAction: isImmediate,
        isLost: false,
        isOverdue,
        dueDate: dueDateStr,
        sources: ['CRM Notes'],
        category: classifyActionCategory(extraPending),
      });
      nameToEnquiryId.set(clientName.toLowerCase(), e.id);
    }
  }

  // 3. Include any unsynced local Teams transcript files discovered by TranscriptKnowledgeEngine
  // Skip generic trainer/demo recordings or names already matched in DB (e.g. Vishnu Karthik -> Vishnu Karthik Venugopal)
  for (const tr of transcriptSnapshot.records || []) {
    if (tr.source !== 'local_file') continue;
    const trNameLower = (tr.candidateName || '').toLowerCase().trim();
    if (!trNameLower || trNameLower === 'meghana' || trNameLower === 'candidate') continue;
    const alreadyMapped = Array.from(nameToEnquiryId.keys()).some(
      (existingName) => existingName === trNameLower || existingName.includes(trNameLower) || trNameLower.includes(existingName)
    );
    if (alreadyMapped) continue;
    if (!tr.nextAction || tr.nextAction === 'Sync this transcript into CRM') continue;

    const syntheticId = tr.enquiryId || tr.id;
    const isImmediate = tr.score >= 8 || tr.interestTier === 'High';
    clientsByEnquiryId.set(syntheticId, {
      enquiryId: syntheticId,
      clientName: tr.candidateName,
      firstName: tr.candidateName.split(' ')[0] || tr.candidateName,
      course: tr.course || 'Supply Chain Training',
      score: tr.score || null,
      clientSummary: tr.summary,
      contactStatus: 'Transcript Logged',
      status: 'pending',
      total: 1,
      pendingCount: 1,
      completedCount: 0,
      pending: [tr.nextAction],
      completed: [],
      priority: isImmediate ? 'High' : 'Medium',
      isImmediateAction: isImmediate,
      isLost: false,
      isOverdue: false,
      dueDate: null,
      sources: ['Teams Transcript'],
      category: classifyActionCategory([tr.nextAction]),
    });
    nameToEnquiryId.set(trNameLower, syntheticId);
  }

  return Array.from(clientsByEnquiryId.values());
}

/**
 * Builds an executive voice summary of ALL open action items across leads,
 * Teams transcripts, Customer Experience dossiers, and CRM call notes.
 * Names every active lead with pending tasks, specifies item counts per lead,
 * flags immediate action leads, and summarizes completed progress.
 */
export function formatActionItemsReportForJarvis(
  profiles: ClientActionItemProfile[],
  options?: {
    specificClientQuery?: string;
    overdueOnly?: boolean;
    waitingResponseOnly?: boolean;
  }
): string {
  if (!profiles || profiles.length === 0) {
    return 'Boss, all action items across our Teams transcripts, Customer Experience records, and CRM notes are cleared with zero pending tasks.';
  }

  // 1. Specific client query (e.g. "What about Hema?", "pending tasks for Arya")
  if (options?.specificClientQuery) {
    const q = options.specificClientQuery.toLowerCase().trim();
    const match = profiles.find(
      (p) =>
        p.clientName.toLowerCase().includes(q) ||
        p.firstName.toLowerCase() === q ||
        q.includes(p.firstName.toLowerCase())
    );

    if (match) {
      if (match.pending.length === 0) {
        return `Boss, all ${match.completedCount} Customer Experience action items for ${match.clientName} are already completed. ${match.clientSummary}`;
      }

      const pendingDescriptions = match.pending.map((t) => sanitizeActionTextForSpeech(t));
      const itemsSpoken =
        pendingDescriptions.length === 1
          ? pendingDescriptions[0]
          : pendingDescriptions.slice(0, -1).join(', ') + ', and ' + pendingDescriptions[pendingDescriptions.length - 1];

      const completedNote =
        match.completed.length > 0
          ? ` We have already completed ${match.completedCount} item${match.completedCount === 1 ? '' : 's'} including ${sanitizeActionTextForSpeech(match.completed[0]).toLowerCase()}.`
          : '';

      const urgencyNote = match.isImmediateAction ? ' This needs immediate action.' : '';

      return `Boss, for ${match.clientName}, we have ${match.pendingCount} pending action item${match.pendingCount === 1 ? '' : 's'} open: ${itemsSpoken}.${urgencyNote}${completedNote}`;
    }

    return `Boss, I checked our Teams transcripts, Customer Experience records, and CRM notes, and found no pending action items logged for ${options.specificClientQuery}.`;
  }

  const activePendingProfiles = profiles
    .filter((p) => !p.isLost && p.pendingCount > 0)
    .sort((a, b) => {
      if (a.isImmediateAction !== b.isImmediateAction) return a.isImmediateAction ? -1 : 1;
      if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
      return (b.score || 0) - (a.score || 0) || b.pendingCount - a.pendingCount;
    });

  // 2. Overdue activities filter
  if (options?.overdueOnly) {
    const overdueClients = activePendingProfiles.filter((p) => p.isOverdue);
    if (overdueClients.length === 0) {
      return 'Boss, zero action item deadlines are overdue right now.';
    }

    const details = overdueClients
      .map((p) => `${p.clientName} with ${p.pendingCount} open item${p.pendingCount === 1 ? '' : 's'} to ${sanitizeActionTextForSpeech(p.pending[0]).toLowerCase()}`)
      .join(', ');
    return `Boss, for overdue deadlines requiring immediate action, we have ${overdueClients.length} leads past due: ${details}.`;
  }

  // 3. Clients waiting for a response filter
  if (options?.waitingResponseOnly) {
    const waitingClients = activePendingProfiles.filter(
      (p) => p.category === 'demo' || p.category === 'pricing' || p.category === 'callback' || p.category === 'enrollment'
    );

    if (waitingClients.length === 0) {
      return 'Boss, zero clients are currently waiting on a demo, pricing, or enrollment response from us.';
    }

    const list = waitingClients
      .map((p) => `${p.clientName} (${p.pendingCount} open item${p.pendingCount === 1 ? '' : 's'} for ${sanitizeActionTextForSpeech(p.pending[0]).toLowerCase()})`)
      .join(', ');

    return `Boss, we have ${waitingClients.length} leads waiting on our response: ${list}.`;
  }

  // 4. Full Lead-by-Lead Pending Action Items & Progress Summary (CX + Teams Transcripts + CRM Notes)
  const totalPending = activePendingProfiles.reduce((acc, p) => acc + p.pendingCount, 0);
  const totalCompleted = profiles.filter((p) => !p.isLost).reduce((acc, p) => acc + p.completedCount, 0);
  const clearedLeads = profiles.filter((p) => !p.isLost && p.pendingCount === 0 && p.completedCount > 0);

  if (totalPending === 0) {
    return `Boss, all action items across our Teams transcripts, Customer Experience records, and CRM notes are cleared with ${totalCompleted} tasks completed.`;
  }

  const immediateLeads = activePendingProfiles.filter((p) => p.isImmediateAction);
  const standardLeads = activePendingProfiles.filter((p) => !p.isImmediateAction);

  const sentences: string[] = [];
  sentences.push(
    `Boss, I scanned all leads across our Teams transcripts, Customer Experience dossiers, and CRM notes. Right now we have ${totalPending} pending action items open across ${activePendingProfiles.length} leads, with ${totalCompleted} tasks already completed.`
  );

  if (immediateLeads.length > 0) {
    const immediateDescriptions = immediateLeads.map((p) => {
      const topTasks = p.pending
        .slice(0, 2)
        .map((t) => sanitizeActionTextForSpeech(t))
        .join(' and ');
      const taskText = topTasks ? topTasks.charAt(0).toLowerCase() + topTasks.slice(1) : 'follow up';
      return `${p.clientName} has ${p.pendingCount} action ${p.pendingCount === 1 ? 'item' : 'items'} open to ${taskText}`;
    });
    sentences.push(
      `These ${immediateLeads.length} leads need immediate action: ${immediateDescriptions.join('; ')}.`
    );
  }

  if (standardLeads.length > 0) {
    const standardDescriptions = standardLeads.map((p) => {
      const topTask = sanitizeActionTextForSpeech(p.pending[0]);
      return `${p.clientName} with ${p.pendingCount} open item${p.pendingCount === 1 ? '' : 's'} to ${topTask.charAt(0).toLowerCase() + topTask.slice(1)}`;
    });
    sentences.push(
      `Remaining open follow ups cover ${standardLeads.length} leads: ${standardDescriptions.join('; ')}.`
    );
  }

  if (clearedLeads.length > 0) {
    const clearedNames = clearedLeads.slice(0, 4).map((p) => p.clientName).join(', ');
    sentences.push(
      `On completed progress, ${clearedLeads.length} Customer Experience leads including ${clearedNames} have all their action items finished.`
    );
  }

  return sentences.join(' ');
}
