import { PrismaClient } from '@prisma/client';

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
  status: 'pending' | 'completed' | 'partially_completed';
  total: number;
  pendingCount: number;
  completedCount: number;
  pending: string[];
  completed: string[];
  priority: 'High' | 'Medium' | 'Low';
  isOverdue: boolean;
  dueDate: string | null;
  category: 'demo' | 'scheduling' | 'pricing' | 'callback' | 'outreach' | 'general';
}

/**
 * Parses action items from customerExperience markdown or nextAction fallback.
 * Checks for table rows with checkboxes or status indicators ("Pending", "Done", "Completed").
 */
export function extractActionItems(
  cxText: string | null | undefined,
  nextActionFallback?: string | null
): ActionItem[] {
  const items: ActionItem[] = [];
  const seen = new Set<string>();

  if (cxText) {
    const lines = cxText.split(/\r?\n/);
    let headerActionIdx = 1;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      const isTableRow = line.includes('\t') || line.includes('|');
      if (!isTableRow) continue;

      const cells = line.includes('\t')
        ? line.split('\t').map((c) => c.trim())
        : line.split('|').map((c) => c.trim()).filter(Boolean);

      if (cells.length < 2) continue;

      // Header row detection
      if (cells.some((c) => /action\s*item|task/i.test(c))) {
        headerActionIdx = cells.findIndex((c) => /action\s*item|task/i.test(c));
        continue;
      }

      const isPending = cells.some((c) => /pending/i.test(c));
      const isDone = cells.some((c) => /done|completed/i.test(c));

      let priority: 'High' | 'Medium' | 'Low' = 'Medium';
      if (cells.some((c) => /^high$/i.test(c))) priority = 'High';
      else if (cells.some((c) => /^low$/i.test(c))) priority = 'Low';

      if (isPending || isDone) {
        let desc = cells[headerActionIdx] || cells[1] || cells[0];
        desc = desc.replace(/^[\*\_\`\-\•\d\.\s]+/, '').replace(/[\*\_\`]+$/, '').trim();

        if (
          desc &&
          !/^(priority|status|action item|gapanchor|done|pending)$/i.test(desc) &&
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
    }
  }

  // Fallback: if no table parsed but nextAction exists
  if (items.length === 0 && nextActionFallback && nextActionFallback.trim().length > 3) {
    items.push({
      text: nextActionFallback.trim(),
      status: 'pending',
      priority: 'High',
    });
  }

  return items;
}

/**
 * Loads and aggregates all pending action items across the entire CRM:
 * 1. LeadCall customerExperience structured tables (Pending vs Done)
 * 2. LeadCall nextAction directives
 * 3. Enquiry processedNotes (demo requests, pricing questions, disconnected retry calls)
 * 4. Enquiry callFollowUpDate (upcoming and overdue deadlines)
 */
export async function getAllLeadActionItemProfiles(
  prisma: PrismaClient
): Promise<ClientActionItemProfile[]> {
  const [calls, enquiries] = await Promise.all([
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
        messageTimestamp: true,
      },
      orderBy: { messageTimestamp: 'desc' },
    }),
  ]);

  const clientsMap = new Map<string, ClientActionItemProfile>();
  const now = new Date();

  // 1. Process LeadCalls (structured CX action tables and nextAction directives)
  for (const c of calls) {
    if (!c.enquiry) continue;
    const clientName = (c.enquiry.participantName || 'Unknown Lead').trim();
    const key = clientName.toLowerCase();
    if (clientsMap.has(key)) continue; // Keep latest call record per lead

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

    let priority: 'High' | 'Medium' | 'Low' = 'Medium';
    if (items.some((i) => i.priority === 'High') || isOverdue || c.enquiry.leadQuality === 'High') {
      priority = 'High';
    }

    const firstName = clientName.split(' ')[0] || clientName;
    const course = c.enquiry.trainingType || c.enquiry.topic || 'Enterprise Training';

    let category: ClientActionItemProfile['category'] = 'general';
    const allPendingText = pending.join(' ').toLowerCase();
    if (allPendingText.includes('demo') || allPendingText.includes('recording')) category = 'demo';
    else if (allPendingText.includes('pricing') || allPendingText.includes('fee')) category = 'pricing';
    else if (allPendingText.includes('batch') || allPendingText.includes('schedule') || allPendingText.includes('cohort')) category = 'scheduling';
    else if (allPendingText.includes('discovery') || allPendingText.includes('follow')) category = 'callback';

    // Summary
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

    clientsMap.set(key, {
      enquiryId: c.enquiry.id,
      clientName,
      firstName,
      course,
      score: c.score,
      clientSummary,
      status,
      total: items.length,
      pendingCount: pending.length,
      completedCount: completed.length,
      pending,
      completed,
      priority,
      isOverdue,
      dueDate: dueDateStr,
      category,
    });
  }

  // 2. Process Enquiries (operator notes, follow-up deadlines, disconnected retry calls)
  for (const e of enquiries) {
    if (!e.participantName) continue;
    const clientName = e.participantName.trim();
    const key = clientName.toLowerCase();
    const notes = (e.processedNotes || '').trim();
    const notesLower = notes.toLowerCase();

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

    // Identify pending tasks from notes
    const extraPending: string[] = [];
    let noteCategory: ClientActionItemProfile['category'] = 'general';

    if (notesLower.includes('demo') && (notesLower.includes('send') || notesLower.includes('conduct') || notesLower.includes('schedule') || notesLower.includes('need'))) {
      extraPending.push('Send demo session link and coordinate schedule');
      noteCategory = 'demo';
    } else if (notesLower.includes('pricing') || notesLower.includes('fee') || notesLower.includes('payment details') || notesLower.includes('asking for 35k') || notesLower.includes('discount')) {
      extraPending.push('Respond to pricing inquiry and clarify fee structure');
      noteCategory = 'pricing';
    } else if (notesLower.includes('disconnect') || notesLower.includes('not responded') || notesLower.includes('tried calling') || notesLower.includes('wrong') || notesLower.includes('call back')) {
      extraPending.push('Attempt another contact since previous call was unanswered or disconnected');
      noteCategory = 'outreach';
    } else if (notesLower.includes('feb') || notesLower.includes('december') || notesLower.includes('next batch') || notesLower.includes('fresher batch') || notesLower.includes('morning batch')) {
      extraPending.push('Confirm upcoming batch schedule and timing details');
      noteCategory = 'scheduling';
    } else if (isOverdue) {
      extraPending.push('Follow up on overdue discussion deadline');
      noteCategory = 'callback';
    }

    if (extraPending.length === 0 && !isOverdue) continue;

    const existing = clientsMap.get(key);
    if (existing) {
      // Append any new non-duplicated tasks
      for (const ep of extraPending) {
        if (!existing.pending.some((p) => p.toLowerCase().includes(ep.slice(0, 15).toLowerCase()))) {
          existing.pending.push(ep);
          existing.pendingCount++;
          existing.total++;
        }
      }
      if (isOverdue) existing.isOverdue = true;
      if (dueDateStr) existing.dueDate = dueDateStr;
    } else {
      const firstName = clientName.split(' ')[0] || clientName;
      const course = e.trainingType || e.topic || 'Enterprise Training';
      const priority: 'High' | 'Medium' | 'Low' = isOverdue || e.leadQuality === 'High' ? 'High' : 'Medium';

      clientsMap.set(key, {
        enquiryId: e.id,
        clientName,
        firstName,
        course,
        score: null,
        clientSummary: notes || `Lead in ${e.contactStatus || 'active'} status for ${course}.`,
        status: 'pending',
        total: extraPending.length,
        pendingCount: extraPending.length,
        completedCount: 0,
        pending: extraPending,
        completed: [],
        priority,
        isOverdue,
        dueDate: dueDateStr,
        category: noteCategory,
      });
    }
  }

  return Array.from(clientsMap.values());
}

/**
 * Builds an articulate, executive voice response about open action items for J.A.R.V.I.S.
 * Adheres strictly to the executive assistant voice conversation personality:
 * - Speaks like a human executive assistant to the CEO (not a database or spreadsheet).
 * - Avoids robotic intros like "Here is the rundown" or "Here are the key priorities".
 * - Avoids repeating full client names and courses unnecessarily.
 * - Groups action items conversationally by client.
 * - Zero hyphens or dash-based formatting.
 * - Supports drill-downs for specific clients (e.g. Hema Sai, Sugnan, Vishnu).
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
    return 'Boss, all action items across the CRM are currently cleared with zero pending tasks.';
  }

  // 1. If asking about a specific client (e.g. "What about Hema?", "pending tasks for Hema Sai")
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
        return `Boss, all action items for ${match.clientName} are already completed. There are no pending tasks left for them right now.`;
      }

      const pendingDescriptions = match.pending.map((t) =>
        t
          .replace(/\bfollow-ups\b/gi, 'follow up activities')
          .replace(/\bfollow-up\b/gi, 'follow up')
          .replace(/\bhigh-priority\b/gi, 'high priority')
          .replace(/\bone-on-one\b/gi, 'one on one')
          .replace(/\bnext-step\b/gi, 'next steps')
          .replace(/\.$/, '')
      );

      const itemsSpoken = pendingDescriptions.length === 1
        ? pendingDescriptions[0]
        : pendingDescriptions.slice(0, -1).join(', ') + ', and ' + pendingDescriptions[pendingDescriptions.length - 1];

      const completedNote = match.completed.length > 0
        ? ` We have already completed ${match.completed.slice(0, 2).map((t) => t.toLowerCase()).join(' and ')}.`
        : '';

      return `Boss, for ${match.clientName}, the main tasks right now are to ${itemsSpoken}.${completedNote}`;
    }

    return `Boss, I checked our CRM records and could not find any pending action items specifically logged for ${options.specificClientQuery}.`;
  }

  // 2. If asking specifically about overdue activities
  if (options?.overdueOnly) {
    const overdueClients = profiles.filter((p) => p.isOverdue && p.pendingCount > 0);
    if (overdueClients.length === 0) {
      return 'Boss, all action items are currently on schedule with zero overdue deadlines.';
    }

    const clientNames = overdueClients.slice(0, 4).map((p) => p.clientName).join(', ');
    return `Boss, looking at overdue activities, we have follow up deadlines that passed for ${clientNames}. We should reach out to them first today.`;
  }

  // 3. If asking specifically about clients waiting for a response
  if (options?.waitingResponseOnly) {
    const waitingClients = profiles.filter(
      (p) => (p.category === 'demo' || p.category === 'pricing' || p.category === 'callback') && p.pendingCount > 0
    );

    if (waitingClients.length === 0) {
      return 'Boss, zero clients are currently waiting on a demo or pricing response from our side.';
    }

    const demoWaiters = waitingClients.filter((p) => p.category === 'demo').map((p) => p.clientName).slice(0, 3);
    const pricingWaiters = waitingClients.filter((p) => p.category === 'pricing').map((p) => p.clientName).slice(0, 2);

    const parts: string[] = [];
    if (demoWaiters.length > 0) parts.push(`${demoWaiters.join(' and ')} are waiting for demo confirmations`);
    if (pricingWaiters.length > 0) parts.push(`${pricingWaiters.join(' and ')} are waiting for pricing details`);

    return `Boss, ${parts.join(', while ')}. Let me know if you would like me to coordinate any of these right away.`;
  }

  // 4. General Action Items Overview (Executive Assistant Style matching Prompt Spec)
  const clientsWithPending = profiles.filter((p) => p.pendingCount > 0);
  const totalPending = clientsWithPending.reduce((acc, p) => acc + p.pendingCount, 0);

  if (totalPending === 0) {
    return 'Boss, all action items across our CRM are cleared. There are no pending tasks right now.';
  }

  // Group by client priorities
  const demoClients = clientsWithPending.filter((p) => p.category === 'demo').map((p) => p.clientName);
  const pricingClients = clientsWithPending.filter((p) => p.category === 'pricing').map((p) => p.clientName);
  const batchClients = clientsWithPending.filter((p) => p.category === 'scheduling' || p.category === 'callback').map((p) => p.clientName);
  const retryClients = clientsWithPending.filter((p) => p.category === 'outreach').map((p) => p.clientName);

  const sentences: string[] = [];

  // Opening
  sentences.push("Boss, I've checked your CRM. There are several pending items that need your attention.");

  // Demos
  if (demoClients.length > 0) {
    const demoNames = demoClients.slice(0, 3).join(' and ');
    sentences.push(`First, ${demoNames} are waiting for their demo schedules. We should coordinate with the trainers and get those sessions confirmed.`);
  }

  // Pricing
  if (pricingClients.length > 0) {
    const pricingNames = pricingClients.slice(0, 2).join(' and ');
    sentences.push(`We also need to respond to ${pricingNames} regarding pricing details.`);
  }

  // Batch details / Next steps
  if (batchClients.length > 0) {
    const batchNames = batchClients.slice(0, 3).join(', ');
    sentences.push(`Apart from that, ${batchNames} need their respective batch details and next steps confirmed.`);
  }

  // Disconnected calls / Retry outreach
  if (retryClients.length > 0) {
    const retryNames = retryClients.slice(0, 2).join(' and ');
    sentences.push(`Finally, ${retryNames} need another contact attempt since their previous calls were unanswered.`);
  }

  sentences.push('Those are the outstanding items I found.');

  return sentences.join(' ');
}
