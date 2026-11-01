import fs from 'fs';
import path from 'path';
import { prisma } from '@/lib/prisma';
import { extractTextFromDocx } from '@/lib/docx-extractor';
import { extractTranscriptMetadata } from '@/lib/bookings-transcript-matcher';

export interface TranscriptRecord {
  id: string;
  enquiryId: string;
  candidateName: string;
  phone?: string | null;
  email?: string | null;
  course: string;
  score: number;
  callDate: string;
  durationMinutes: number;
  candidateTalkPct: number;
  need: string;
  budget: string;
  timeline: string;
  decisionMaker: string;
  objections: string;
  counterPitch: string;
  verbatimQuotes: Record<string, string>;
  summary: string;
  customerExperience?: string | null;
  interestTier: 'High' | 'Medium' | 'Low';
  nextAction: string;
  whatsappDraft?: string | null;
  source: 'database_call' | 'local_file';
}

export interface TranscriptSnapshot {
  records: TranscriptRecord[];
  highInterestCandidates: TranscriptRecord[];
  compactPromptContext: string;
  totalTranscripts: number;
}

/**
 * Calculates interest tier based on call score, need urgency, and budget signals
 */
function evaluateInterestTier(score: number, timeline?: string | null, budget?: string | null): 'High' | 'Medium' | 'Low' {
  const timeLower = (timeline || '').toLowerCase();
  const budLower = (budget || '').toLowerCase();

  const isUrgent = timeLower.includes('immediate') || timeLower.includes('urgent') || timeLower.includes('asap') || timeLower.includes('this week') || timeLower.includes('november');
  const isBudgetReady = budLower.includes('confirmed') || budLower.includes('allocated') || budLower.includes('reimburse') || budLower.includes('split payment') || budLower.includes('partial');

  if (score >= 7 || (score >= 6 && (isUrgent || isBudgetReady))) {
    return 'High';
  }
  if (score >= 4) {
    return 'Medium';
  }
  return 'Low';
}

// In-memory cache to prevent costly synchronous disk & DB scans on every prompt
let cachedSnapshot: TranscriptSnapshot | null = null;
let lastSnapshotFetchTime = 0;
const SNAPSHOT_CACHE_TTL_MS = 60000; // 60 seconds

export function invalidateTranscriptCache(): void {
  cachedSnapshot = null;
  lastSnapshotFetchTime = 0;
}

/**
 * Retrieves full transcript knowledge across database LeadCalls and local folders.
 * Uses high-speed 60s in-memory caching for sub-5ms instant access.
 */
export async function getTranscriptKnowledgeSnapshot(forceRefresh = false): Promise<TranscriptSnapshot> {
  const now = Date.now();
  if (!forceRefresh && cachedSnapshot && now - lastSnapshotFetchTime < SNAPSHOT_CACHE_TTL_MS) {
    return cachedSnapshot;
  }

  const records: TranscriptRecord[] = [];

  try {
    // 1. Fetch all LeadCall timeline records with full Enquiry relationship
    const dbCalls = await prisma.leadCall.findMany({
      orderBy: { callDate: 'desc' },
      include: {
        enquiry: {
          select: {
            id: true,
            participantName: true,
            phone: true,
            email: true,
            country: true,
            topic: true,
            trainingType: true,
            leadQuality: true,
            contactStatus: true,
          },
        },
      },
    });

    for (const call of dbCalls) {
      let quotesObj: Record<string, string> = {};
      if (call.verbatimQuotes) {
        try {
          quotesObj = typeof call.verbatimQuotes === 'string' ? JSON.parse(call.verbatimQuotes) : call.verbatimQuotes;
        } catch {
          quotesObj = { quote: call.verbatimQuotes };
        }
      }

      const candidateName = call.enquiry?.participantName || 'Candidate';
      const course = call.clientNeed || call.enquiry?.trainingType || call.enquiry?.topic || 'Supply Chain Training';
      const interestTier = evaluateInterestTier(call.score, call.timeline, call.budget);

      records.push({
        id: call.id,
        enquiryId: call.enquiryId,
        candidateName,
        phone: call.enquiry?.phone || null,
        email: call.enquiry?.email || null,
        course,
        score: call.score,
        callDate: call.callDate ? call.callDate.toISOString().split('T')[0] : '',
        durationMinutes: call.durationMinutes,
        candidateTalkPct: call.candidateTalkPct,
        need: call.clientNeed || 'General SCM Training',
        budget: call.budget || 'Standard Fee',
        timeline: call.timeline || 'Flexible',
        decisionMaker: call.decisionMaker || 'Self',
        objections: call.objections || 'None recorded',
        counterPitch: call.counterPitch || '',
        verbatimQuotes: quotesObj,
        summary: call.summary,
        customerExperience: call.customerExperience,
        interestTier,
        nextAction: call.nextAction || 'Follow up with curriculum & batch schedule',
        whatsappDraft: call.whatsappDraft,
        source: 'database_call',
      });
    }

    // 2. Scan local folders for any pending transcript documents not yet ingested
    const userProfile = process.env.USERPROFILE || 'C:\\Users\\ARUL XAVIER';
    const localFolders = [
      path.join(userProfile, 'OneDrive - gapanchor', 'www.gapanchor.com', 'Client Trascripts'),
      path.join(userProfile, 'OneDrive - gapanchor', 'www.gapanchor.com', 'Client Transcripts'),
      path.join(userProfile, 'OneDrive - gapanchor', 'Recordings'),
      path.join(userProfile, 'Downloads'),
      path.join(userProfile, 'OneDrive - gapanchor', 'Meetings'),
    ];

    // Expand to include any subdirectories (e.g. subfolders inside Client Trascripts)
    const allFoldersToScan: string[] = [];
    for (const f of localFolders) {
      if (!fs.existsSync(f)) continue;
      allFoldersToScan.push(f);
      try {
        const subEntries = fs.readdirSync(f, { withFileTypes: true });
        for (const sub of subEntries) {
          if (sub.isDirectory()) {
            allFoldersToScan.push(path.join(f, sub.name));
          }
        }
      } catch {}
    }

    const loggedFileIds = new Set(
      dbCalls.map((c) => (c.driveFileId || '').toLowerCase()).filter(Boolean)
    );

    for (const folder of allFoldersToScan) {
      if (!fs.existsSync(folder)) continue;
      const isDedicatedTranscriptFolder = folder.toLowerCase().includes('trascript') || folder.toLowerCase().includes('transcript');
      try {
        const files = fs.readdirSync(folder);
        for (const file of files) {
          const lower = file.toLowerCase();
          if (!lower.endsWith('.docx') && !lower.endsWith('.vtt') && !lower.endsWith('.txt')) continue;
          if (!isDedicatedTranscriptFolder && !lower.includes('transcript') && !lower.includes('training') && !lower.includes('support')) continue;

          if (loggedFileIds.has(lower) || loggedFileIds.has(file)) continue;

          // Check if file is recent (within 90 days for dedicated folder, 14 days for general folders)
          const filePath = path.join(folder, file);
          const stat = fs.statSync(filePath);
          const maxAgeDays = isDedicatedTranscriptFolder ? 90 : 14;
          if (Date.now() - stat.mtimeMs > maxAgeDays * 24 * 3600 * 1000) continue;

          let rawContent = '';
          if (lower.endsWith('.docx')) {
            try {
              const buf = fs.readFileSync(filePath);
              rawContent = extractTextFromDocx(buf);
            } catch {}
          } else {
            try {
              rawContent = fs.readFileSync(filePath, 'utf8');
            } catch {}
          }

          if (rawContent && rawContent.length > 50) {
            const meta = extractTranscriptMetadata(rawContent, file);
            const candName = meta.customerName !== 'Unknown Candidate' ? meta.customerName : file.replace(/\.(docx|vtt|txt)$/i, '');

            // Avoid duplicate name if already present in records
            const alreadyInRecords = records.some(
              (r) => r.candidateName.toLowerCase() === candName.toLowerCase()
            );

            if (!alreadyInRecords) {
              records.push({
                id: `local-${file}`,
                enquiryId: '',
                candidateName: candName,
                course: 'Supply Chain Training',
                score: 7,
                callDate: meta.meetingDateText || new Date(stat.mtimeMs).toISOString().split('T')[0],
                durationMinutes: meta.durationMinutes,
                candidateTalkPct: 50,
                need: 'Extracted from local transcript file',
                budget: 'Pending review',
                timeline: 'Recent call',
                decisionMaker: 'Self',
                objections: 'Pending analysis',
                counterPitch: '',
                verbatimQuotes: {},
                summary: `Recent transcript file located in ${path.basename(folder)}: ${file}. Dialogue length: ${rawContent.length} characters.`,
                interestTier: 'High',
                nextAction: 'Sync this transcript into CRM',
                source: 'local_file',
              });
            }
          }
        }
      } catch (err) {
        console.warn('[TranscriptKnowledgeEngine] Local folder scan error:', folder, err);
      }
    }
  } catch (error) {
    console.error('[TranscriptKnowledgeEngine] Error building snapshot:', error);
  }

  // Filter and sort high interest candidates
  const highInterestCandidates = records
    .filter((r) => r.interestTier === 'High')
    .sort((a, b) => b.score - a.score);

  // Compact representation for AI prompt context
  const compactList = records.map((r) => ({
    leadId: r.enquiryId,
    candidate: r.candidateName,
    course: r.course,
    score: `${r.score}/10`,
    interestTier: r.interestTier,
    duration: `${r.durationMinutes}m`,
    talkRatio: `${r.candidateTalkPct}%`,
    need: r.need,
    budget: r.budget,
    timeline: r.timeline,
    objections: r.objections,
    quotes: r.verbatimQuotes,
    summary: r.summary,
    nextAction: r.nextAction,
  }));

  const compactPromptContext = JSON.stringify(compactList, null, 2);

  const snapshot: TranscriptSnapshot = {
    records,
    highInterestCandidates,
    compactPromptContext,
    totalTranscripts: records.length,
  };

  cachedSnapshot = snapshot;
  lastSnapshotFetchTime = Date.now();

  return snapshot;
}

/**
 * Deterministic Fallback Search for Transcripts
 */
export function searchTranscriptsHeuristically(prompt: string, snapshot: TranscriptSnapshot) {
  const q = prompt.toLowerCase();
  const { records, highInterestCandidates } = snapshot;

  // 1. Query for Interested Candidates / Hot Leads from Transcripts
  if (
    q.includes('interest') ||
    q.includes('hot') ||
    q.includes('ready') ||
    q.includes('best') ||
    q.includes('convert') ||
    q.includes('enroll') ||
    q.includes('who should i call') ||
    q.includes('top candidate')
  ) {
    const topCandidates = highInterestCandidates.slice(0, 4);
    const matchedIds = topCandidates.map((c) => c.enquiryId).filter(Boolean);

    if (topCandidates.length === 0) {
      return {
        answer: 'I reviewed the call transcripts, sir, but no candidates currently meet the threshold for high immediate interest.',
        actionAdvice: 'Consider running another call campaign or scanning recent Teams transcripts.',
        matchedIds: [],
        recommendedFilter: 'all',
      };
    }

    const descriptions = topCandidates
      .map(
        (c) =>
          `${c.candidateName} (${c.course}, rated ${c.score}/10, timeline: ${c.timeline.split('(')[0].trim()})`
      )
      .join(', and ');

    // Check if we have multiple top-tier candidates (e.g. score >= 8)
    const topTier = topCandidates.filter((c) => c.score >= 8);
    let spokenSummary = '';
    let tacticalAdvice = '';

    if (topTier.length >= 2) {
      const names = topTier.map((c) => c.candidateName).join(' and ');
      spokenSummary = `Based on a comprehensive review across all recorded transcripts and notes, our top tier candidates are ${names}, both rated at the highest intent scores, along with ${topCandidates.slice(2).map((c) => c.candidateName).join(', ') || 'other active prospects'}.`;
      tacticalAdvice = `Prioritize ${names} for immediate enrollment confirmation and syllabus delivery.`;
    } else {
      const topOne = topCandidates[0];
      spokenSummary = `Based on a comprehensive review of our call transcripts, our most interested candidates are ${descriptions}. Notably, ${topOne.candidateName} scored ${topOne.score}/10 with an immediate timeline: "${topOne.summary.slice(0, 100)}..."`;
      tacticalAdvice = `Prioritize ${topOne.candidateName} for enrollment confirmation and send WhatsApp follow-up with syllabus and payment split details.`;
    }

    return {
      answer: spokenSummary,
      actionAdvice: tacticalAdvice,
      matchedIds,
      recommendedFilter: 'high_intent',
    };
  }

  // 2. Query for Budget / Pricing Discussions in Transcripts
  if (q.includes('budget') || q.includes('price') || q.includes('fee') || q.includes('discount') || q.includes('pay')) {
    const budgetDiscussed = records.filter(
      (r) => r.budget && !r.budget.toLowerCase().includes('pending')
    );
    const matchedIds = budgetDiscussed.map((c) => c.enquiryId).filter(Boolean);

    const highlights = budgetDiscussed.slice(0, 3).map((c) => `${c.candidateName} (${c.budget.slice(0, 60)})`).join('; ');

    return {
      answer: `I analyzed transcript fee discussions across ${budgetDiscussed.length} recorded calls. Key mentions: ${highlights}.`,
      actionAdvice: 'Review partial payment and installment requests in the call intelligence drawer.',
      matchedIds,
      recommendedFilter: 'high_intent',
    };
  }

  // 3. Query for Specific Candidate Name in Transcripts
  const matchedCandidate = records.find((r) =>
    q.includes(r.candidateName.toLowerCase().trim())
  );

  if (matchedCandidate) {
    const quotes = Object.entries(matchedCandidate.verbatimQuotes)
      .map(([k, v]) => `"${v}"`)
      .slice(0, 2)
      .join(' | ');

    return {
      answer: `Transcript record for ${matchedCandidate.candidateName}: Call score ${matchedCandidate.score}/10 for ${matchedCandidate.course}. Candidate Need: ${matchedCandidate.need}. Timeline: ${matchedCandidate.timeline}. Candidate quote: ${quotes || matchedCandidate.summary}.`,
      actionAdvice: matchedCandidate.nextAction,
      matchedIds: matchedCandidate.enquiryId ? [matchedCandidate.enquiryId] : [],
      recommendedFilter: null,
    };
  }

  // 4. General Transcript Overview
  const matched = records.filter((r) => {
    const combined = `${r.candidateName} ${r.course} ${r.need} ${r.summary} ${r.timeline}`.toLowerCase();
    return q.split(' ').some((word) => word.length > 2 && combined.includes(word));
  });

  const targetList = matched.length > 0 ? matched : highInterestCandidates;
  const matchedIds = targetList.map((c) => c.enquiryId).filter(Boolean);

  return {
    answer: `I have scanned our call transcript repository across ${records.length} recorded sessions. We have identified ${highInterestCandidates.length} high-interest candidates with strong need scores and active timelines.`,
    actionAdvice: 'Filter the CRM by High Intent to review their verbatim quotes and call summaries.',
    matchedIds,
    recommendedFilter: 'high_intent',
  };
}
