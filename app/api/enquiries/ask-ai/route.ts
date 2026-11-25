import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { callGemini, getGeminiConfig } from '@/lib/gemini-client';
import { numberToIndianWords, sanitizeIndianCurrencyForSpeech } from '@/lib/utils';
import { listCalendarEvents } from '@/lib/googleCalendar';
import {
  getMicrosoftCalendarEvents,
  getUnifiedCalendarEvents,
  formatCalendarEventsForJarvis,
  MicrosoftCalendarEvent,
} from '@/lib/microsoft-calendar';
import {
  getAllLeadActionItemProfiles,
  formatActionItemsReportForJarvis,
  ClientActionItemProfile,
} from '@/lib/action-items';
import {
  getTranscriptKnowledgeSnapshot,
  searchTranscriptsHeuristically,
  TranscriptSnapshot,
} from '@/lib/transcript-knowledge-engine';
import {
  detectPipelineActionType,
  executeJarvisPipelineAction,
  getComprehensiveLeadContext,
  getComprehensiveOperationsSnapshot,
  evaluateAllCandidatesPriorities,
  setActiveSubjectLead,
  getActiveSubjectLead,
  getActiveTopicContext,
  setActiveTopicContext,
  OperationsIntelligenceSnapshot,
  ComprehensiveLeadProfile,
} from '@/lib/jarvis-pipeline-controller';
import { isCallingJarvis, getJarvisCallResponse } from '@/lib/jarvis-speech';

export const dynamic = 'force-dynamic';

// ── In-Memory Cache for Operations & Transcript Snapshots (30s TTL) ──
let cachedOpsContext: { data: OperationsIntelligenceSnapshot; timestamp: number } | null = null;
let cachedTranscriptSnapshot: { data: TranscriptSnapshot; timestamp: number } | null = null;
const CACHE_TTL_MS = 30_000;

async function getCachedOperationsSnapshot(prismaClient: any): Promise<OperationsIntelligenceSnapshot> {
  const now = Date.now();
  if (cachedOpsContext && (now - cachedOpsContext.timestamp) < CACHE_TTL_MS) {
    return cachedOpsContext.data;
  }
  const data = await getComprehensiveOperationsSnapshot(prismaClient);
  cachedOpsContext = { data, timestamp: now };
  return data;
}

async function getCachedTranscriptSnapshot(): Promise<TranscriptSnapshot> {
  const now = Date.now();
  if (cachedTranscriptSnapshot && (now - cachedTranscriptSnapshot.timestamp) < CACHE_TTL_MS) {
    return cachedTranscriptSnapshot.data;
  }
  const data = await getTranscriptKnowledgeSnapshot().catch(() => ({
    records: [],
    highInterestCandidates: [],
    compactPromptContext: '',
    totalTranscripts: 0,
  }));
  cachedTranscriptSnapshot = { data, timestamp: now };
  return data;
}

function invalidateJarvisOperationsCache() {
  cachedOpsContext = null;
  cachedTranscriptSnapshot = null;
}

/**
 * Strips technical CRM primary key codes [GAMA-0224], [GABY-0002], [GAGN-0001],
 * bare codes, and database IDs from spoken/display text so JARVIS speaks only real names.
 */
function stripTechnicalCodes(text: string): string {
  if (!text) return '';
  return text
    .replace(/\[\s*GA[A-Z]{2}-?\d{3,4}\s*\]/gi, '')
    .replace(/\(\s*GA[A-Z]{2}-?\d{3,4}\s*\)/gi, '')
    .replace(/\bGA[A-Z]{2}-?\d{3,4}\b/gi, '')
    .replace(/\[\s*GA[A-Z]{2}\s*\]/gi, '')
    .replace(/#[a-z0-9]{5,8}\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Ensures output is stripped of technical codes, all salutations normalized to "boss",
 * all currency values are formatted into natural Indian spoken words,
 * robotic intro phrases eliminated, and hyphenated/dashed words replaced with natural spoken English.
 */
function cleanOutput(text: string): string {
  if (!text) return '';
  let cleaned = stripTechnicalCodes(text);

  // Normalize salutations to boss
  cleaned = cleaned.replace(/\b(?:hey\s+)?(?:man|partner|sir)\b/gi, (match) => {
    if (/^hey/i.test(match)) return 'Hey boss';
    return 'boss';
  });

  // Ban robotic openers
  cleaned = cleaned
    .replace(/^Alright boss, here is the rundown[\.,:\s]*/i, 'Boss, ')
    .replace(/^Here is the rundown[\.,:\s]*/i, 'Boss, here is the current update: ')
    .replace(/^Here is the breakdown of your calendar[\.,:\s]*/i, 'Looking at your calendar, ')
    .replace(/^Here are the key priorities[\.,:\s]*/i, 'Looking at our top priorities, ')
    .replace(/\bhere is the rundown\b/gi, 'here is the update')
    .replace(/\bhere are the key priorities\b/gi, 'here are the top priorities');

  // Conversational zero-hyphen replacements (Section 4)
  cleaned = cleaned
    .replace(/\bfollow[\s-]?ups\b/gi, 'follow up activities')
    .replace(/\bfollow[\s-]?up\b/gi, 'follow up')
    .replace(/\bhigh[\s-]?priority\b/gi, 'high priority')
    .replace(/\b(one[\s-]on[\s-]one|1[\s-]on[\s-]1|1:1)\b/gi, 'individual training')
    .replace(/\bup[\s-]?to[\s-]?date\b/gi, 'current information')
    .replace(/\baction[\s-]?items?\b/gi, 'action items')
    .replace(/\bclient[\s-]?specific\b/gi, 'specific client')
    .replace(/\bend[\s-]?to[\s-]?end\b/gi, 'complete process')
    .replace(/\bnext[\s-]?steps?\b/gi, 'next steps')
    .replace(/\btwo[\s-]?day\b/gi, 'two day');

  // Strip em/en dashes, bullets, and word hyphens
  cleaned = cleaned
    .replace(/[\u2014\u2013\u2015]/g, ', ')
    .replace(/[•●▪■◆★]/g, ', ')
    .replace(/\s+-\s+/g, ', ')
    .replace(/\b([a-zA-Z]+)-([a-zA-Z]+)\b/g, '$1 $2');

  return sanitizeIndianCurrencyForSpeech(cleaned);
}

/**
 * Retrieves past meeting discussion notes and transcript summary for a specific candidate.
 */
async function getClientMeetingDiscussionSummary(
  clientNameOrQuery: string,
  prismaClient: any
): Promise<{ answer: string; enquiryId?: string } | null> {
  const q = clientNameOrQuery.toLowerCase().trim();
  const enq = await prismaClient.enquiry.findFirst({
    where: {
      participantName: { contains: q, mode: 'insensitive' },
    },
    select: {
      id: true,
      participantName: true,
      trainingType: true,
      topic: true,
      processedNotes: true,
      callFollowUpDate: true,
      contactStatus: true,
    },
  });

  if (!enq) {
    return null;
  }

  const calls = await prismaClient.leadCall.findMany({
    where: { enquiryId: enq.id },
    orderBy: { callDate: 'desc' },
    take: 1,
  });

  const course = enq.trainingType || enq.topic || 'Enterprise Training';
  const call = calls[0];

  if (call && call.summary && call.summary.trim().length > 10) {
    let cleanSummary = call.summary.trim();
    cleanSummary = cleanSummary.replace(/\[.*?\]/g, '').replace(/#\w+/g, '').trim();

    let nextStepPart = '';
    if (call.nextAction && call.nextAction.trim().length > 5) {
      nextStepPart = ` The agreed next steps were to ${call.nextAction.replace(/\.$/, '')}.`;
    }

    return {
      answer: `Boss, in our last call with ${enq.participantName} regarding ${course}, ${cleanSummary}.${nextStepPart}`,
      enquiryId: enq.id,
    };
  }

  if (enq.processedNotes && enq.processedNotes.trim().length > 5) {
    return {
      answer: `Boss, in our recorded CRM notes for ${enq.participantName} regarding ${course}, discussion indicates: "${enq.processedNotes}".${enq.callFollowUpDate ? ` Scheduled follow up date is ${enq.callFollowUpDate}.` : ''}`,
      enquiryId: enq.id,
    };
  }

  return {
    answer: `Boss, we have active inquiry details for ${enq.participantName} in ${course}, but no detailed call discussion transcript has been logged yet.`,
    enquiryId: enq.id,
  };
}

interface DatabaseFilterMatch {
  intentDetected: boolean;
  filterType: 'transcript' | 'notes' | 'due' | 'country' | 'course' | 'status' | 'none';
  categoryLabel: string;
  matchedLeadIds: string[];
  matchedLeads: ComprehensiveLeadProfile[];
  uniqueCandidateNames: string[];
  totalMatches: number;
  recommendedFilter: string;
  suggestedAnswer: string;
  suggestedActionAdvice: string;
}

/**
 * Normalizes common Web Speech API voice-to-text mis-transcriptions for GapAnchor domain terms.
 */
function normalizeVoiceDomainTerms(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\bman\s+attend\b/gi, 'manhattan')
    .replace(/\bman\s+hattan\b/gi, 'manhattan')
    .replace(/\bmanhatten\b/gi, 'manhattan')
    .replace(/\bmana\s+than\b/gi, 'manhattan')
    .replace(/\bblue\s+under\b/gi, 'blue yonder')
    .replace(/\bkinexis\b|\bcan\s+axis\b/gi, 'kinaxis')
    .replace(/\bpro\s+active\b/gi, 'proactive')
    .trim();
}

/**
 * Produces an executive cohort summary instead of dumping 3 random names.
 */
function summarizeMatchedCohort(matchedLeads: ComprehensiveLeadProfile[], label: string): string {
  const uniqueNames = Array.from(new Set(matchedLeads.map((l) => l.name).filter(Boolean)));
  const talkedCount = matchedLeads.filter((l) => (l.contactStatus || '').toLowerCase() === 'talked').length;
  const inTouchCount = matchedLeads.filter((l) => (l.contactStatus || '').toLowerCase() === 'in touch').length;
  const convertedCount = matchedLeads.filter((l) => (l.contactStatus || '').toLowerCase() === 'converted').length;
  const pendingCount = matchedLeads.filter((l) => (l.contactStatus || '').toLowerCase() === 'pending').length;
  const dueCount = matchedLeads.filter((l) => l.isDue || Boolean(l.followUpDate)).length;
  const withNotesOrCalls = matchedLeads.filter((l) => Boolean(l.transcriptSummary) || (l.notes && l.notes.trim().length > 0)).length;

  const topHighIntent = matchedLeads
    .filter((l) => (l.score || 0) >= 7 || l.leadQuality === 'High')
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, 3)
    .map((l) => (l.score ? `${l.name} rated ${l.score} out of 10` : l.name));

  const statusParts: string[] = [];
  if (convertedCount > 0) statusParts.push(`${convertedCount} converted`);
  if (talkedCount > 0) statusParts.push(`${talkedCount} talked`);
  if (inTouchCount > 0) statusParts.push(`${inTouchCount} in touch`);
  if (pendingCount > 0) statusParts.push(`${pendingCount} pending outreach`);

  const statusPhrase = statusParts.length > 0 ? ` Status breakdown: ${statusParts.join(', ')}.` : '';
  const activityPhrase =
    withNotesOrCalls > 0 || dueCount > 0
      ? ` ${withNotesOrCalls} have active call notes or transcripts and ${dueCount} have scheduled follow ups.`
      : '';
  const highlightPhrase =
    topHighIntent.length > 0
      ? ` Top priority candidates include ${topHighIntent.join(', ')}.`
      : ` Most recent entries include ${uniqueNames.slice(0, 3).join(', ')}.`;

  return `Boss, I filtered the CRM to ${matchedLeads.length} ${label}.${statusPhrase}${activityPhrase}${highlightPhrase}`;
}

/**
 * Scans ALL 502+ database enquiries to identify matching candidate subsets
 * for filtering prompts (transcripts, notes, due dates, country, course, status).
 * Prevents premature truncation so J.A.R.V.I.S. always evaluates the entire database.
 */
function detectAndEvaluateFullDatabaseFilter(
  prompt: string,
  opsContext: OperationsIntelligenceSnapshot,
  transcriptSnapshot: TranscriptSnapshot
): DatabaseFilterMatch {
  const p = normalizeVoiceDomainTerms(prompt);
  const allLeads = opsContext.allLeads;

  // 1. Transcript / Call Recording filter (only when explicitly filtering/listing leads, NOT when asking for action items, CX summary, or system status)
  const isAskingActionOrSummary =
    /\b(action\s*items?|pending|to\s*-?\s*do|tasks?|follow\s*ups?|how\s+(?:is|are)\s+it\s+going|what(?:'s|\s+is|\s+are)\s+(?:the\s+things\s+)?going\s+on|summary|summarize|overview|immediate\s+action)\b/i.test(p);

  const isTranscriptQuery =
    !isAskingActionOrSummary &&
    (/\b(filter|filtrate|show\s+me\s+leads|list\s+leads|which\s+leads|who\s+has\s+call|who\s+talked)\b/i.test(p) &&
      /\b(transcript|transcripts|recording|recordings|cx|customer experience|call analysis|call|calls|talked)\b/i.test(p));

  if (isTranscriptQuery) {
    const transcriptEnquiryIds = new Set<string>();

    for (const r of transcriptSnapshot.records) {
      if (r.enquiryId) transcriptEnquiryIds.add(r.enquiryId);
    }

    for (const l of allLeads) {
      if (l.transcriptSummary && l.transcriptSummary.trim().length > 0) {
        transcriptEnquiryIds.add(l.id);
      }
    }

    for (const r of transcriptSnapshot.records) {
      const nameLower = (r.candidateName || '').toLowerCase().trim();
      if (nameLower.length > 2) {
        for (const l of allLeads) {
          if (l.name.toLowerCase().trim() === nameLower) {
            transcriptEnquiryIds.add(l.id);
          }
        }
      }
    }

    const matchedLeads = allLeads.filter((l) => transcriptEnquiryIds.has(l.id));
    const uniqueCandidateNames = Array.from(new Set(matchedLeads.map((l) => l.name)));

    return {
      intentDetected: true,
      filterType: 'transcript',
      categoryLabel: 'candidates with recorded call transcripts',
      matchedLeadIds: matchedLeads.map((l) => l.id),
      matchedLeads,
      uniqueCandidateNames,
      totalMatches: matchedLeads.length,
      recommendedFilter: 'all',
      suggestedAnswer: `Boss, I've scanned all ${allLeads.length} enquiries across our database and filtered the table to all ${uniqueCandidateNames.length} candidates with recorded call transcripts, including ${uniqueCandidateNames.slice(0, 6).join(', ')}. All call recording summaries, verbatim quotes, and interactive customer experience checklists are loaded for your review.`,
      suggestedActionAdvice: 'Click Details on any candidate row to review their full call transcript, objection analysis, and follow-up directives.',
    };
  }

  // 2. Call Notes filter
  const isNotesQuery =
    /\b(with notes|call notes|has notes|have notes|leads with notes|candidates with notes)\b/i.test(p) ||
    (/\b(notes|remarks)\b/i.test(p) && /\b(filter|filtrate|show|list|find|who)\b/i.test(p));

  if (isNotesQuery) {
    const matchedLeads = allLeads.filter((l) => l.notes && l.notes.trim().length > 0);
    const uniqueCandidateNames = Array.from(new Set(matchedLeads.map((l) => l.name)));

    return {
      intentDetected: true,
      filterType: 'notes',
      categoryLabel: 'candidates with CRM call notes',
      matchedLeadIds: matchedLeads.map((l) => l.id),
      matchedLeads,
      uniqueCandidateNames,
      totalMatches: matchedLeads.length,
      recommendedFilter: 'has_notes',
      suggestedAnswer: `Boss, I scanned all ${allLeads.length} database enquiries and filtered the table to all ${uniqueCandidateNames.length} candidates who have active call notes, including ${uniqueCandidateNames.slice(0, 6).join(', ')}.`,
      suggestedActionAdvice: 'Review recent discussion remarks and update callback deadlines.',
    };
  }

  // 3. Due / Overdue follow-up filter
  const isDueQuery =
    /\b(due today|overdue|callback due|pending callback|who is due|follow[\s-]?up due)\b/i.test(p) ||
    (/\bdue\b/i.test(p) && /\b(filter|filtrate|show|list|who)\b/i.test(p));

  if (isDueQuery) {
    const matchedLeads = allLeads.filter((l) => l.isDue || Boolean(l.followUpDate));
    const uniqueCandidateNames = Array.from(new Set(matchedLeads.map((l) => l.name)));

    return {
      intentDetected: true,
      filterType: 'due',
      categoryLabel: 'leads with upcoming or overdue follow-up dates',
      matchedLeadIds: matchedLeads.map((l) => l.id),
      matchedLeads,
      uniqueCandidateNames,
      totalMatches: matchedLeads.length,
      recommendedFilter: 'due_today',
      suggestedAnswer: `Boss, I evaluated all ${allLeads.length} enquiries and filtered the table to all ${uniqueCandidateNames.length} candidates with active follow-up deadlines, including ${uniqueCandidateNames.slice(0, 6).join(', ')}.`,
      suggestedActionAdvice: 'Initiate WhatsApp and call outreach to lock in their demo bookings.',
    };
  }

  // 4. Country filter
  const countryKeywords: Record<string, string> = {
    usa: 'USA',
    'united states': 'USA',
    india: 'India',
    uk: 'UK',
    'united kingdom': 'UK',
    mexico: 'Mexico',
    uae: 'United Arab Emirates',
    dubai: 'United Arab Emirates',
    'united arab emirates': 'United Arab Emirates',
    france: 'France',
    netherlands: 'Netherlands',
    spain: 'Spain',
    'saudi arabia': 'Saudi Arabia',
    canada: 'Canada',
    australia: 'Australia',
  };

  for (const [key, countryName] of Object.entries(countryKeywords)) {
    const re = new RegExp(`\\b${key}\\b`, 'i');
    if (re.test(p) && /\b(from|in|filter|filtrate|show|list|who|leads|candidates)\b/i.test(p)) {
      const matchedLeads = allLeads.filter((l) => (l.country || '').toLowerCase().includes(key) || (l.country || '').toLowerCase().includes(countryName.toLowerCase()));
      const uniqueCandidateNames = Array.from(new Set(matchedLeads.map((l) => l.name)));

      if (matchedLeads.length > 0) {
        return {
          intentDetected: true,
          filterType: 'country',
          categoryLabel: `candidates from ${countryName}`,
          matchedLeadIds: matchedLeads.map((l) => l.id),
          matchedLeads,
          uniqueCandidateNames,
          totalMatches: matchedLeads.length,
          recommendedFilter: 'all',
          suggestedAnswer: `Boss, I scanned all ${allLeads.length} CRM enquiries and filtered the table to all ${uniqueCandidateNames.length} candidates from ${countryName}, including ${uniqueCandidateNames.slice(0, 5).join(', ')}.`,
          suggestedActionAdvice: `Review timezone alignment for scheduled demo sessions in ${countryName}.`,
        };
      }
    }
  }

  // 5. Course filter (supports natural voice phrasing like "filter me out all manhattan wms enquiry")
  const courseKeywords: Record<string, string> = {
    'blue yonder': 'Blue Yonder WMS',
    jda: 'Blue Yonder WMS (JDA)',
    manhattan: 'Manhattan WMS',
    'active wms': 'Manhattan Active WMS',
    proactive: 'Manhattan ProActive WMS',
    sap: 'SAP S/4HANA',
    's/4hana': 'SAP S/4HANA',
    kinaxis: 'Kinaxis RapidResponse',
    oracle: 'Oracle SCM',
  };

  for (const [key, courseName] of Object.entries(courseKeywords)) {
    const re = new RegExp(`\\b${key}\\b`, 'i');
    if (re.test(p) && /\b(filter|filtrate|show|list|who|leads|candidates|track|enquir|all|find|get)\b/i.test(p)) {
      const matchedLeads = allLeads.filter((l) => (l.course || '').toLowerCase().includes(key));
      const uniqueCandidateNames = Array.from(new Set(matchedLeads.map((l) => l.name)));

      if (matchedLeads.length > 0) {
        return {
          intentDetected: true,
          filterType: 'course',
          categoryLabel: `candidates for ${courseName}`,
          matchedLeadIds: matchedLeads.map((l) => l.id),
          matchedLeads,
          uniqueCandidateNames,
          totalMatches: matchedLeads.length,
          recommendedFilter: 'all',
          suggestedAnswer: summarizeMatchedCohort(matchedLeads, `${courseName} enquiries`),
          suggestedActionAdvice: `Check upcoming batch schedule and follow up on high intent ${courseName} prospects.`,
        };
      }
    }
  }

  // 6. Status / Pipeline filter (talked, in touch, pending, converted, high intent, red flag)
  if (/\b(filter|filtrate|show|list|find|get)\b/i.test(p)) {
    let statusMatched: ComprehensiveLeadProfile[] = [];
    let statusLabel = '';
    let recFilter = 'all';

    if (/\b(converted|enrolled)\b/i.test(p)) {
      statusMatched = allLeads.filter((l) => (l.contactStatus || '').toLowerCase() === 'converted');
      statusLabel = 'converted candidates';
    } else if (/\btalked\b/i.test(p)) {
      statusMatched = allLeads.filter((l) => (l.contactStatus || '').toLowerCase() === 'talked');
      statusLabel = 'candidates we have talked to';
    } else if (/\bin\s*touch\b/i.test(p)) {
      statusMatched = allLeads.filter((l) => (l.contactStatus || '').toLowerCase() === 'in touch');
      statusLabel = 'candidates in touch';
    } else if (/\bpending\b/i.test(p) && !/\baction\s*item/i.test(p)) {
      statusMatched = allLeads.filter((l) => (l.contactStatus || '').toLowerCase() === 'pending');
      statusLabel = 'pending outreach enquiries';
    } else if (/\b(high\s+intent|hot\s+leads?)\b/i.test(p)) {
      statusMatched = allLeads.filter((l) => (l.score || 0) >= 8 || l.leadQuality === 'High');
      statusLabel = 'high intent candidates';
      recFilter = 'high_intent';
    } else if (/\bred\s*flags?\b/i.test(p)) {
      statusMatched = allLeads.filter((l) => l.hasRedFlag);
      statusLabel = 'candidates with active red flags';
      recFilter = 'red_flags';
    }

    if (statusMatched.length > 0) {
      return {
        intentDetected: true,
        filterType: 'status',
        categoryLabel: statusLabel,
        matchedLeadIds: statusMatched.map((l) => l.id),
        matchedLeads: statusMatched,
        uniqueCandidateNames: Array.from(new Set(statusMatched.map((l) => l.name))),
        totalMatches: statusMatched.length,
        recommendedFilter: recFilter,
        suggestedAnswer: summarizeMatchedCohort(statusMatched, statusLabel),
        suggestedActionAdvice: `Prioritize top scored leads in ${statusLabel} for immediate follow up.`,
      };
    }
  }

  return {
    intentDetected: false,
    filterType: 'none',
    categoryLabel: 'none',
    matchedLeadIds: [],
    matchedLeads: [],
    uniqueCandidateNames: [],
    totalMatches: 0,
    recommendedFilter: 'all',
    suggestedAnswer: '',
    suggestedActionAdvice: '',
  };
}

export async function GET() {
  const { apiKey, model } = getGeminiConfig();
  return NextResponse.json({
    configured: Boolean(apiKey),
    model,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt, apiKey: requestApiKey, previousMatchedIds, previousPrompt, sessionId } = body;

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'A search or question prompt is required.' },
        { status: 400 }
      );
    }

    // Direct greeting / calling Jarvis ("Hey Jarvis", "Jarvis", "hello", etc.)
    if (isCallingJarvis(prompt)) {
      return NextResponse.json({
        success: true,
        isRealGemini: false,
        model: 'J.A.R.V.I.S. Core Neural Voice',
        answer: getJarvisCallResponse(),
        actionAdvice: 'Standing by for your command.',
        matchedIds: [],
        recommendedFilter: 'all',
      });
    }

    // Conversational affirmations / closing acknowledgments (e.g. "seems like we should be good Jarvis", "sounds good", "okay great")
    const isConversationalAck =
      /\b(seems\s+like\s+we\s+should\s+be\s+good|we\s+should\s+be\s+good|looks?\s+good|sounds?\s+good|we(?:'re|\s+are)\s+good|that(?:'s|\s+is)\s+(?:good|great|fine|perfect|nice|cool|awesome)|all\s+good|makes\s+sense|got\s+it|okay\s+great|pretty\s+good|now\s+(?:it\s+is|it's)\s+good)\b/i.test(
        prompt.trim()
      ) &&
      !/\b(lead|candidate|prospect|calendar|schedule|meeting|finance|action\s*item|pending|filter|book|cancel|system|status|transcript)\b/i.test(
        prompt
      );

    if (isConversationalAck) {
      return NextResponse.json({
        success: true,
        isRealGemini: false,
        model: 'J.A.R.V.I.S. Conversational Core',
        answer: 'Glad to hear that, boss. Everything is aligned and I am standing by whenever you need me.',
        actionAdvice: 'Standing by for your next command.',
        matchedIds: [],
        recommendedFilter: 'all',
      });
    }

    const { apiKey: envApiKey, model } = getGeminiConfig();
    const effectiveApiKey = requestApiKey?.trim() || envApiKey;

    // ─── STAGE 1: Check for Direct Jarvis Pipeline Action ─────────
    const pipelineActionType = detectPipelineActionType(prompt);
    if (pipelineActionType !== 'none') {
      const actionResult = await executeJarvisPipelineAction(pipelineActionType, prompt, prisma, {
        previousMatchedIds: Array.isArray(previousMatchedIds) ? previousMatchedIds : [],
        previousPrompt: typeof previousPrompt === 'string' ? previousPrompt : undefined,
        sessionId: typeof sessionId === 'string' ? sessionId : 'global',
      });
      return NextResponse.json({
        success: true,
        isRealGemini: Boolean(effectiveApiKey),
        model: 'GAP Jarvis Pipeline Controller',
        answer: actionResult.answer,
        actionAdvice: actionResult.actionAdvice,
        matchedIds: actionResult.leadIds,
        recommendedFilter: actionResult.recommendedFilter || 'all',
        pipelineAction: {
          type: actionResult.actionType,
          targetStage: actionResult.targetStage,
          leadIds: actionResult.leadIds,
          leadNames: actionResult.leadNames,
          leadCodes: actionResult.leadCodes,
          removeLeadIds: actionResult.removeLeadIds,
          count: actionResult.count,
          summary: actionResult.summary,
          pushedTimestamps: actionResult.pushedTimestamps,
        },
      });
    }

    const pLower = prompt.toLowerCase();
    const isSystemStatusQuery =
      /\b(how\s+is\s+the\s+system|how\s+are\s+things\s+going|how\s+is\s+gap\s*anchor\s+doing|how\s+are\s+we\s+doing|system\s+status|what(?:'s|\s+is|\s+are)\s+(?:the\s+things\s+)?going\s+on\s+(?:with|in)\s+the\s+system|what(?:'s|\s+is|\s+are)\s+happening\s+(?:with|in)\s+the\s+system|daily\s+briefing|morning\s+briefing|executive\s+briefing|overall\s+status|update\s+on\s+the\s+system|system\s+update)\b/i.test(pLower) ||
      (/\b(what(?:'s|\s+is|\s+are)\s+(?:the\s+things\s+)?going\s+on|things\s+going\s+on)\b/i.test(pLower) &&
        !/\blead|candidate|prospect|enquir|detail|next\s+step|action\s*item/i.test(pLower));

    const needsCalendar = isSystemStatusQuery || /\b(calendar|schedule|meeting|event|session|demo|today|tomorrow|week|batch)\b/i.test(pLower);

    // ─── STAGE 2: Load Full Multi-Entity Operations Snapshot ──────
    // Uses 30s in-memory cache and conditional external calendar fetch with 2.5s safety timeout
    const calendarPromise = needsCalendar
      ? Promise.race([
          getUnifiedCalendarEvents({ maxResults: 25 }).catch(() => []),
          new Promise<any[]>((resolve) => setTimeout(() => resolve([]), 8000)),
        ])
      : Promise.resolve([]);

    const [opsContext, transcriptSnapshot, calendarData] = await Promise.all([
      getCachedOperationsSnapshot(prisma),
      getCachedTranscriptSnapshot(),
      calendarPromise,
    ]);

    // Full 503+ database filter intent evaluation (never truncated)
    const fullDbFilter = detectAndEvaluateFullDatabaseFilter(prompt, opsContext, transcriptSnapshot);

    // ─── Multi-turn Conversational Context & Query Intent Resolution ───
    const sessionIdStr = typeof sessionId === 'string' ? sessionId : 'global';
    const activeTopic = getActiveTopicContext(sessionIdStr);

    // Multi-turn context resolution for Calendar
    const isTomorrowFollowup =
      /^(what\s+about\s+tomorrow|what\s+about\s+tomorrow\?|tomorrow\??|how\s+about\s+tomorrow\??)$/i.test(prompt.trim()) ||
      (/\btomorrow\b/i.test(prompt) && activeTopic?.topic === 'calendar');

    const isCalendarQuery =
      isTomorrowFollowup ||
      (/\b(calendar|schedule|schedules|upcoming\s+event|upcoming\s+session|what('s|\s+is)\s+on\s+my\s+calendar|what\s+do\s+i\s+have|meetings?\s+today|meetings?\s+tomorrow|events?\s+going\s+on|events?\s+for\s+today|events?\s+for\s+tomorrow|upcoming\s+days)\b/i.test(pLower) &&
      !/\blead|candidate|prospect|finances?|revenue/i.test(pLower));

    const targetCalendarDate: 'today' | 'tomorrow' | 'upcoming' | undefined =
      isTomorrowFollowup || /\btomorrow\b/i.test(pLower) ? 'tomorrow' :
      /\btoday\b/i.test(pLower) ? 'today' : undefined;

    // Follow-up client matching for action items or discussion (e.g. "What about Hema?")
    const whatAboutClientMatch = prompt.trim().match(/^(?:what\s+about|how\s+about)\s+([A-Za-z\s]+)\??$/i);
    const clientSpecificActionMatch = prompt.match(/\b(?:pending\s+tasks?|action\s*items?|tasks?\s*left)\s+for\s+([A-Za-z\s]+)\b/i);

    const isMeetingDiscussionQuery =
      /\b(what\s+did\s+we\s+discuss|what\s+was\s+discussed|what\s+happened\s+on\s+the\s+call|last\s+meeting\s+with|last\s+call\s+with)\b/i.test(pLower) ||
      (Boolean(whatAboutClientMatch) && activeTopic?.topic === 'meeting_notes');

    const meetingMatch = prompt.match(/(?:discuss(?:ed)?\s+(?:in\s+the\s+last\s+meeting\s+)?with|call\s+with|meeting\s+with)\s+([A-Za-z\s]+?)(?:\?|$|\.|\,)/i);
    const meetingClientQuery = meetingMatch ? meetingMatch[1].trim() : (whatAboutClientMatch ? whatAboutClientMatch[1].trim() : undefined);

    let specificClientQuery: string | undefined = undefined;
    if (clientSpecificActionMatch) {
      specificClientQuery = clientSpecificActionMatch[1].trim();
    } else if (whatAboutClientMatch && !isMeetingDiscussionQuery && activeTopic?.topic !== 'calendar') {
      specificClientQuery = whatAboutClientMatch[1].trim();
    }

    const isOverdueQuery = /\b(overdue|overdue\s+activities|past\s+due|missed\s+deadline)\b/i.test(pLower);
    const isWaitingResponseQuery = /\b(waiting\s+for\s+(?:a\s+)?response|waiting\s+on\s+us|who\s+is\s+waiting|clients?\s+waiting)\b/i.test(pLower);

    const isTranscriptOrCxSummaryQuery =
      /\b(cx|customer\s+experience|teams?\s+transcripts?)\b/i.test(pLower) &&
      !/\b(filter|filtrate)\b/i.test(pLower);

    const isActionItemsQuery =
      !isSystemStatusQuery &&
      (Boolean(specificClientQuery) ||
        isOverdueQuery ||
        isWaitingResponseQuery ||
        /\b(action\s*items?|to\s*-?\s*do(?:s)?|pending\s*tasks?|open\s*tasks?|tasks?\s*left|checklist|what\s+tasks?\s+are\s+left|pending\s+items?|pending\s+action\s+items?|immediate\s+actions?|what\s+do\s+i\s+need\s+to\s+follow\s+up\s+on|follow\s+ups?\s+pending|pending\s+follow\s*ups?)\b/i.test(pLower) ||
        (/\b(pending|open|summary|summarize|check|status|going\s+on|how\s+is\s+it\s+going)\b/i.test(pLower) &&
          isTranscriptOrCxSummaryQuery));

    const isExecutiveFocusQuery =
      /\b(what\s+should\s+i\s+focus\s+on|what\s+needs\s+my\s+attention|focus\s+today|what's\s+my\s+focus|priorities\s+for\s+today|what\s+should\s+i\s+do\s+today)\b/i.test(pLower);

    // Update active topic context for multi-turn sessions
    if (isCalendarQuery) {
      setActiveTopicContext({ topic: 'calendar', targetDate: targetCalendarDate }, sessionIdStr);
    } else if (isActionItemsQuery) {
      setActiveTopicContext({ topic: 'action_items', clientName: specificClientQuery }, sessionIdStr);
    } else if (isMeetingDiscussionQuery) {
      setActiveTopicContext({ topic: 'meeting_notes', clientName: meetingClientQuery }, sessionIdStr);
    } else if (isExecutiveFocusQuery || isSystemStatusQuery) {
      setActiveTopicContext({ topic: 'general' }, sessionIdStr);
    }

    // Preload action items across Teams transcripts, CX, and CRM notes whenever relevant
    const actionItemProfiles = (isSystemStatusQuery || isActionItemsQuery || isExecutiveFocusQuery || isTranscriptOrCxSummaryQuery)
      ? await getAllLeadActionItemProfiles(prisma)
      : [];

    // Preload meeting discussion if relevant
    const meetingDiscussion = (isMeetingDiscussionQuery && meetingClientQuery)
      ? await getClientMeetingDiscussionSummary(meetingClientQuery, prisma)
      : null;

    const intentContext = {
      isSystemStatusQuery,
      isCalendarQuery,
      targetCalendarDate,
      isActionItemsQuery,
      isTranscriptOrCxSummaryQuery,
      specificClientQuery,
      overdueOnly: isOverdueQuery,
      waitingResponseOnly: isWaitingResponseQuery,
      isExecutiveFocusQuery,
      isMeetingDiscussionQuery,
      meetingClientQuery,
      meetingDiscussion,
      actionItemProfiles,
      calendarData: Array.isArray(calendarData) ? calendarData : ((calendarData as any)?.events || []),
    };

    // ─── INSTANT CALENDAR FAST-PATH (< 500ms Thinking Latency) ───
    // Directly answers pure calendar/schedule queries with live Microsoft Graph data,
    // eliminating heavy LLM serialization delays and 429 quota stalls.
    if (isCalendarQuery) {
      let calendarPart = 'Boss, your calendar is completely clear with zero scheduled sessions.';
      try {
        const msEvents = intentContext.calendarData;
        if (msEvents && msEvents.length > 0) {
          calendarPart = formatCalendarEventsForJarvis(msEvents, { targetDate: targetCalendarDate });
        }
      } catch (err: any) {
        console.error('DEBUG formatCalendarEventsForJarvis threw:', err);
      }

      const cleanAns = cleanOutput(
        calendarPart.startsWith('Boss') ? calendarPart : `Boss, looking at your calendar, ${calendarPart}`
      );

      return NextResponse.json({
        success: true,
        isRealGemini: false,
        model: 'GAP Calendar Fast-Path',
        answer: cleanAns,
        actionAdvice: 'View your live Microsoft Calendar or Microsoft Bookings dashboard at https://bookings.cloud.microsoft/bookings/calendar to manage invite slots.',
        matchedIds: [],
        recommendedFilter: 'all',
        pipelineAction: null,
      });
    }

    // ─── INSTANT ACTION ITEMS FAST-PATH (< 600ms Thinking Latency) ───
    // Directly aggregates CRM action items from structured CX checklists and CRM discussion notes,
    // eliminating 40s thinking stalls and JSON token truncation errors.
    if (isActionItemsQuery) {
      const profiles = actionItemProfiles.length > 0 ? actionItemProfiles : await getAllLeadActionItemProfiles(prisma);
      const answer = formatActionItemsReportForJarvis(profiles, {
        specificClientQuery,
        overdueOnly: isOverdueQuery,
        waitingResponseOnly: isWaitingResponseQuery,
      });

      return NextResponse.json({
        success: true,
        isRealGemini: false,
        model: 'GAP Action Items Fast-Path',
        answer: cleanOutput(answer),
        actionAdvice: 'Click Details on any candidate row to update action items or log next steps.',
        matchedIds: profiles.filter((p) => !p.isLost && p.pendingCount > 0).map((p) => p.enquiryId),
        recommendedFilter: 'all',
        pipelineAction: null,
      });
    }

    // ─── STAGE 3: If Gemini API Key Available: Real Neural Reasoning ───
    if (effectiveApiKey) {
      const queryWords = pLower
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(
          (w) =>
            w.length >= 3 &&
            !['what', 'when', 'where', 'who', 'how', 'show', 'tell', 'the', 'are', 'is', 'for', 'and', 'with', 'about', 'from', 'all', 'our', 'my'].includes(w)
        );

      const isFinanceOnlyQuery =
        /\b(how\s+are\s+the\s+finances|finance\s+status|how's\s+finance\s+doing|financial\s+update|revenue|expenses|net\s+profit)\b/i.test(pLower) &&
        !/\blead|candidate|prospect|system\s+status|going\s+on|focus/i.test(pLower);

      // Full Database 503+ leads distribution & intelligence statistics
      const totalLeadsCount = opsContext.allLeads.length;
      const leadsWithNotesCount = opsContext.allLeads.filter((l) => l.notes && l.notes.trim().length > 0).length;
      const dueFollowUpsCount = opsContext.allLeads.filter((l) => l.isDue || Boolean(l.followUpDate)).length;
      const courseBreakdown: Record<string, number> = {};
      const statusBreakdown: Record<string, number> = {};
      for (const l of opsContext.allLeads) {
        const c = l.course || 'Other';
        courseBreakdown[c] = (courseBreakdown[c] || 0) + 1;
        const s = l.status || 'Unknown';
        statusBreakdown[s] = (statusBreakdown[s] || 0) + 1;
      }

      // Upcoming Calendar Events & Cohorts (Microsoft Graph Calendar contact@gapanchor.com)
      const upcomingCalendarEvents = (Array.isArray(calendarData) ? calendarData : ((calendarData as any)?.events || [])).map((e: any) => ({
        title: e.subject || e.title || e.summary || 'Meeting / Session',
        start: e.startFormattedIst || e.start,
        end: e.endFormattedIst || e.end,
        isToday: Boolean(e.isToday),
        isTomorrow: Boolean(e.isTomorrow),
        joinUrl: e.joinUrl || undefined,
        description: e.bodyPreview || e.description || '',
      }));

      // Dynamically match any specific prospects across all 500+ leads
      // Full deep search across name, code, notes, message, phone, email, country, course, transcripts
      const matchedProspects = opsContext.allLeads
        .map((l) => {
          const name = l.name.toLowerCase();
          const code = l.leadCode.toLowerCase();
          const email = (l.email || '').toLowerCase();
          const phone = (l.phone || '').toLowerCase();
          const country = (l.country || '').toLowerCase();
          const course = l.course.toLowerCase();
          const notes = (l.notes || '').toLowerCase();
          const lastMsg = (l.lastMessage || '').toLowerCase();
          const summary = (l.transcriptSummary || '').toLowerCase();

          let matchScore = 0;
          // Exact substring in notes gets highest relevance boost
          if (notes && notes.includes(pLower)) matchScore += 10;
          if (lastMsg && lastMsg.includes(pLower)) matchScore += 8;
          if (name.includes(pLower)) matchScore += 10;

          // Word-level scoring
          for (const w of queryWords) {
            if (notes.includes(w)) matchScore += 4;
            if (lastMsg.includes(w)) matchScore += 3;
            if (name.includes(w)) matchScore += 5;
            if (code.includes(w)) matchScore += 5;
            if (phone.includes(w)) matchScore += 4;
            if (email.includes(w)) matchScore += 3;
            if (course.includes(w)) matchScore += 2;
            if (country.includes(w)) matchScore += 2;
            if (summary.includes(w)) matchScore += 3;
          }

          return { lead: l, matchScore };
        })
        .filter((item) => item.matchScore > 0)
        .sort((a, b) => b.matchScore - a.matchScore)
        .slice(0, 15)
        .map((item) => item.lead);

      if (matchedProspects.length > 0) {
        setActiveSubjectLead(matchedProspects[0], typeof sessionId === 'string' ? sessionId : 'global');
      } else if (fullDbFilter.intentDetected && fullDbFilter.matchedLeads.length === 1) {
        setActiveSubjectLead(fullDbFilter.matchedLeads[0], typeof sessionId === 'string' ? sessionId : 'global');
      }

      // All leads with active Call Notes & Follow-up Due Dates
      // Prioritize leads where notes exist and match prompt, or most recent notes
      const leadsWithCallNotes = opsContext.allLeads
        .filter((l) => l.notes && l.notes.trim().length > 0)
        .sort((a, b) => {
          const aMatch = queryWords.some((w) => (a.notes || '').toLowerCase().includes(w)) ? 1 : 0;
          const bMatch = queryWords.some((w) => (b.notes || '').toLowerCase().includes(w)) ? 1 : 0;
          if (bMatch !== aMatch) return bMatch - aMatch;
          return (b.dateOfEntry || '').localeCompare(a.dateOfEntry || '');
        })
        .slice(0, 18)
        .map((l) => ({
          leadCode: l.leadCode,
          name: l.name,
          phone: l.phone,
          course: l.course,
          callNotes: l.notes,
          followUpDue: l.followUpDate,
          isDue: l.isDue,
          status: l.status,
          contactStatus: l.contactStatus,
        }));

      // Evaluated candidates with scores, call transcripts, callback reminders
      const evaluatedCandidates = opsContext.allLeads
        .filter((l) => l.score || l.transcriptSummary || l.notes || l.followUpDate || l.hasRedFlag)
        .slice(0, 15)
        .map((l) => ({
          id: l.id,
          primaryKey: l.leadCode,
          name: l.name,
          email: l.email,
          phone: l.phone,
          country: l.country,
          course: l.course,
          serviceType: l.serviceType,
          score: l.score ? `${l.score}/10` : 'Unrated',
          quality: l.leadQuality,
          status: l.status,
          contactStatus: l.contactStatus,
          due: l.followUpDate,
          isDue: l.isDue,
          notes: l.notes || null,
          transcriptSummary: l.transcriptSummary ? l.transcriptSummary.slice(0, 200) : null,
          quotes: l.quotes && l.quotes.length > 0 ? l.quotes.slice(0, 2).join(' | ') : null,
          timeline: l.timeline,
          budget: l.budget,
          flag: l.hasRedFlag ? l.redFlagReason : null,
        }));

      const fin = opsContext.aggregates.finance;
      const finNetWords = numberToIndianWords(fin.netRevenue);
      const finIncomeWords = numberToIndianWords(fin.totalIncome);
      const finExpenseWords = numberToIndianWords(fin.totalExpense);
      const lastPaymentWords = numberToIndianWords(fin.latestIncomeAmount || 0);
      const lastPaymentDate = fin.latestIncomeDate || 'October 24, 2026';

      const systemPrompt = `You are J.A.R.V.I.S., the executive assistant and operations controller for GapAnchor enterprise academy (Manhattan Active WMS, Blue Yonder, SAP, Kinaxis). You are speaking directly to your CEO.

You have live neural database access across all GapAnchor systems:
1. All ${totalLeadsCount} candidate leads (full contact details: email, phone, country, course, service type, initial query message, entry dates, status, CRM call notes, call transcripts & scores).
2. Live Training Batches & Sessions (platform, trainer, scheduled times, trainer total payout, trainer amount paid/due, trainee participants with fees & payment statuses: PAID, PARTIAL, PENDING).
3. Live Microsoft Calendar Events & Training Schedules (upcoming demos, meetings, batches).
4. Financial Ledger Transactions (income, expenses, payment methods, transaction notes, amounts).
5. Trainer Registrations (work-with-us candidate profiles, experience years, primary domains, contact info).

USER INQUIRY: "${prompt}"

==============================
1. LATEST INCOMING ENQUIRIES (Most Recent First):
${JSON.stringify(opsContext.latestEnquiries.slice(0, 10), null, 2)}

2. DYNAMICALLY MATCHED PROSPECTS:
${JSON.stringify(matchedProspects, null, 2)}

3. ACTIVE CRM CALL NOTES & DISCUSSION LOGS:
${JSON.stringify(leadsWithCallNotes, null, 2)}

4. HIGH-INTENT EVALUATED CANDIDATES (Call Notes & Transcripts):
${JSON.stringify(evaluatedCandidates, null, 2)}

5. ACTIVE TRAINING BATCHES & TRAINER PAYOUTS:
${JSON.stringify(opsContext.activeSessions.slice(0, 6), null, 2)}

6. UPCOMING CALENDAR EVENTS & SCHEDULED SESSIONS:
${JSON.stringify(upcomingCalendarEvents, null, 2)}

7. RECENT FINANCIAL TRANSACTIONS:
${JSON.stringify(opsContext.financialTransactions.slice(0, 6), null, 2)}

8. DATABASE TOTALS & 503+ LEADS SCAN:
${JSON.stringify({
  totalLeads: totalLeadsCount,
  leadsWithNotes: leadsWithNotesCount,
  dueFollowUps: dueFollowUpsCount,
  courseBreakdown,
  statusBreakdown,
  aggregates: opsContext.aggregates,
}, null, 2)}
${fullDbFilter.intentDetected ? `
9. COMPREHENSIVE FULL-DATABASE SCAN RESULTS (Evaluated ALL ${opsContext.allLeads.length} CRM Enquiries):
User Request Category: "${fullDbFilter.categoryLabel}"
Total Matching Candidates: ${fullDbFilter.uniqueCandidateNames.length} (${fullDbFilter.totalMatches} total enquiries across database)
Matching Candidates Across Entire Database:
${JSON.stringify(fullDbFilter.matchedLeads.map(l => ({
  id: l.id,
  name: l.name,
  course: l.course,
  country: l.country,
  status: l.status,
  score: l.score,
  transcriptSummary: l.transcriptSummary ? l.transcriptSummary.slice(0, 250) : null,
  notes: l.notes
})), null, 2)}
` : ''}
${isSystemStatusQuery || isActionItemsQuery || isExecutiveFocusQuery || isTranscriptOrCxSummaryQuery ? `
10. TEAMS TRANSCRIPTS, CUSTOMER EXPERIENCE (CX) & ACTION ITEMS ACROSS ALL LEADS:
${JSON.stringify(actionItemProfiles.filter((p) => !p.isLost), null, 2)}

11. TEAMS TRANSCRIPTS REPOSITORY (${transcriptSnapshot.totalTranscripts} Sessions):
${transcriptSnapshot.compactPromptContext}
` : ''}
${meetingDiscussion ? `
12. MEETING DISCUSSION RECORD FOR ${meetingClientQuery}:
${meetingDiscussion.answer}
` : ''}
==============================

OPERATIONAL INSTRUCTIONS & PERSONA (MANDATORY):
1. EXECUTIVE ASSISTANT VOICE PERSONA:
   - Speak naturally like a trusted human executive assistant, NEVER like a database or spreadsheet.
   - Address the user as "boss" naturally and conversationally, but do NOT force "boss" into every sentence.
   - BANNED ROBOTIC INTROS: NEVER say "Alright boss, here is the rundown", "Here is the breakdown of your calendar", "Here are the key priorities".
   - NATURAL OPENINGS: Use conversational hooks: "Boss, you've got three sessions scheduled today.", "Boss, looking at your schedule...", "Boss, there are several pending items that need your attention."

2. ZERO HYPHENS DIRECTIVE (STRICT ENFORCEMENT):
   - Never use hyphens or dash-based wording in your spoken answer or action advice.
   - Replace "follow-ups" with "follow up activities".
   - Replace "follow-up" with "follow up".
   - Replace "high-priority" with "high priority".
   - Replace "one-on-one", "1-on-1", "1:1" with "individual training" or "one on one".
   - Replace "up-to-date" with "current information".
   - Replace "action-item" with "action items".
   - Replace "client-specific" with "specific client".
   - Replace "end-to-end" with "complete process".
   - Replace "next-step" with "next steps".
   - Replace "two-day" with "two day".
   - Never output em dashes, en dashes, or bullet points.

3. STRICT INTENT-BASED REPORTING:
${isMeetingDiscussionQuery && meetingDiscussion ? `
   - THIS IS A PAST MEETING DISCUSSION QUERY:
     Summarize what was discussed with ${meetingClientQuery} naturally: their technical track/goals, schedule requirements, budget/qualification, and agreed next action. Use short, clear sentences.
` : isExecutiveFocusQuery ? `
   - THIS IS AN EXECUTIVE FOCUS QUERY ("What should I focus on today" / "What needs my attention"):
     Deliver a sharp executive briefing:
     1. Start naturally: "Boss, here is where your focus should be today."
     2. Schedule check: mention today's scheduled sessions or state that your calendar is completely clear today.
     3. CRM priorities: highlight top pending items needing immediate attention (demo confirmations for clients waiting, pricing queries, overdue contacts).
     4. Conclude with a helpful offer to coordinate.
` : isActionItemsQuery ? `
   - THIS IS AN ACTION ITEMS / TEAMS TRANSCRIPTS / CX QUERY:
     * Scan ALL active leads in Section 10 and Section 11 (Teams transcripts, CX dossiers, CRM notes) and exclude Lost leads.
     * Name every active lead with open pending action items, stating how many items each has open and highlighting those needing immediate action.
     * If asking for a specific client (e.g. "${specificClientQuery || ''}"), focus exclusively on that client's open tasks and CX context.
     * DO NOT MENTION FINANCES.
` : isCalendarQuery ? `
   - THIS IS A CALENDAR / SCHEDULE QUERY:
     * Target Date Focus: ${targetCalendarDate ? targetCalendarDate.toUpperCase() : 'TODAY FIRST, THEN TOMORROW, THEN UPCOMING'}.
     * State exact times in IST (e.g. "11 AM", "5 PM", "6:48 PM").
     * Simplify attendee names to their first name.
     * Omit Teams meeting links unless specifically requested.
     * Highlight any schedule conflicts or overlapping appointments.
     * If today or tomorrow has zero events, explicitly state that your calendar is clear.
` : isSystemStatusQuery ? `
   - THIS IS A SYSTEM / GAPANCHOR EXECUTIVE STATUS BRIEFING:
     Deliver a crisp, cohesive 5-part executive briefing covering ALL of these points:
     1. Leads Across Last 48 Hours: Exact count of inquiries received in the last 48 hours, top tracks, and key recent candidate names (out of ${totalLeadsCount} total leads).
     2. Calendar & Meeting Schedule: Today's and upcoming scheduled meetings on Microsoft and Google Calendar (or state clear schedule + active batch).
     3. Finance Status: Concise finance update (net revenue is ${finNetWords} on ${finIncomeWords} income vs ${finExpenseWords} expenses, with last payment on ${lastPaymentDate} for ${lastPaymentWords}).
     4. Operational Pace: Clearly state whether we are running on a good pace or need attention based on 48 hour lead inflow, financial margin, and active schedule.
     5. Pending Action Items: Total open action items from Teams transcripts, Customer Experience dossiers, and CRM notes across active leads, naming the top leads requiring immediate action.
` : isFinanceOnlyQuery ? `
   - THIS IS A FINANCE-SPECIFIC QUERY:
     Deliver concise financial standing: Net revenue is ${finNetWords} on ${finIncomeWords} total income vs ${finExpenseWords} expenses, with last payment on ${lastPaymentDate} for ${lastPaymentWords}.
` : `
   - THIS IS A LEADS / CANDIDATES / CRM QUERY:
     * DO NOT MENTION FINANCES.
     * SCAN ALL ${totalLeadsCount} LEADS ACROSS THE FULL DATABASE.
     * Detail exact next steps on who to call and immediate operational actions.
`}

4. CURRENCY IN SPOKEN INDIAN WORDS:
   - When stating money amounts, ALWAYS write them in natural Indian spoken words (e.g. "${finNetWords}", "${lastPaymentWords}", "800 US dollars").
   - NEVER output bare currency symbols like ₹ or Rs. or numbers with commas like ₹6,57,062.

5. STRICT NAME DIRECTIVE:
   - Never speak or include primary key codes like [GAMA-0224], [GABY-0002], [GAGN-0001], or bare codes in "answer" or "actionAdvice". Speak ONLY real person names.

6. "answer": Spoken operational briefing directly answering the prompt with exact data.
7. "actionAdvice": Crisp tactical next directive for the operations team.
8. "matchedIds": Array of matching lead ID strings.
9. "recommendedFilter": "all" | "due_today" | "high_intent" | "demo_followup" | "email_pending" | "red_flags" | "has_notes" or null.
10. Optional "pipelineAction": if prompt requests moving or staging leads.

Respond ONLY with valid JSON with keys: "answer", "actionAdvice", "matchedIds", "recommendedFilter", optional "pipelineAction".`;

      try {
        const geminiRes = await callGemini(systemPrompt, {
          apiKey: effectiveApiKey,
          model,
          jsonMode: true,
          temperature: 0.1,
          maxOutputTokens: 2048,
        });

        let parsed: any = null;
        try {
          parsed = JSON.parse(geminiRes.text);
        } catch (jsonErr) {
          const raw = geminiRes.text || '';
          const jsonMatch = raw.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              parsed = JSON.parse(jsonMatch[0]);
            } catch {
              const ansMatch = raw.match(/"answer"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/);
              const adviceMatch = raw.match(/"actionAdvice"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/);
              if (ansMatch) {
                parsed = {
                  answer: ansMatch[1].replace(/\\"/g, '"').replace(/\\n/g, ' '),
                  actionAdvice: adviceMatch ? adviceMatch[1].replace(/\\"/g, '"') : null,
                  matchedIds: [],
                  recommendedFilter: 'all',
                };
              }
            }
          }
          if (!parsed) throw jsonErr;
        }

        const cleanAnswer = cleanOutput(parsed?.answer || 'Operational analysis complete, boss.');
        const cleanAdvice = parsed?.actionAdvice ? cleanOutput(parsed.actionAdvice) : null;

        let finalMatchedIds: string[] = [];
        if (isSystemStatusQuery) {
          finalMatchedIds = [];
        } else if (fullDbFilter.intentDetected && fullDbFilter.matchedLeadIds.length > 0) {
          const idSet = new Set([
            ...fullDbFilter.matchedLeadIds,
            ...(Array.isArray(parsed.matchedIds) ? parsed.matchedIds : []),
          ]);
          finalMatchedIds = Array.from(idSet);
        } else if (Array.isArray(parsed.matchedIds)) {
          finalMatchedIds = parsed.matchedIds;
        }

        return NextResponse.json({
          success: true,
          isRealGemini: true,
          model: 'GAP Neural v2 (Gemini Flash)',
          answer: cleanAnswer,
          actionAdvice: cleanAdvice,
          matchedIds: finalMatchedIds,
          recommendedFilter: fullDbFilter.intentDetected ? fullDbFilter.recommendedFilter : (parsed.recommendedFilter || null),
          pipelineAction: parsed.pipelineAction || null,
        });
      } catch (geminiErr: any) {
        console.error('AI API execution error:', geminiErr);
        // Fallback to deterministic multi-entity engine
        const fallback = await fallbackComprehensiveOperations(prompt, opsContext, transcriptSnapshot, intentContext);
        return NextResponse.json({
          success: true,
          isRealGemini: false,
          model: (fallback as any).model || 'GAP Comprehensive Intelligence Engine',
          apiError: geminiErr.message,
          answer: cleanOutput(fallback.answer),
          actionAdvice: cleanOutput(fallback.actionAdvice),
          matchedIds: fallback.matchedIds,
          recommendedFilter: fallback.recommendedFilter,
          pipelineAction: (fallback as any).pipelineAction || null,
        });
      }
    }

    // ─── STAGE 4: Deterministic Multi-Entity Heuristics ───────────
    const fallback = await fallbackComprehensiveOperations(prompt, opsContext, transcriptSnapshot, intentContext);
    return NextResponse.json({
      success: true,
      isRealGemini: false,
      missingApiKey: true,
      model: 'GAP Comprehensive Intelligence Engine',
      answer: cleanOutput(fallback.answer),
      actionAdvice: cleanOutput(fallback.actionAdvice),
      matchedIds: fallback.matchedIds,
      recommendedFilter: fallback.recommendedFilter,
      pipelineAction: (fallback as any).pipelineAction || null,
    });
  } catch (error: any) {
    console.error('Ask AI error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Builds the full 5-part executive system status briefing:
 * 1. 48-hour lead inflow + tracks + recent names
 * 2. Finance standing (net revenue, income, expenses, latest payment)
 * 3. Unified calendar schedule (Microsoft + Google Calendar + training batches)
 * 4. Operational pace assessment (good pace vs needs attention)
 * 5. Pending action items across Teams transcripts, Customer Experience, and CRM notes
 */
async function buildExecutiveSystemBriefing(
  opsContext: OperationsIntelligenceSnapshot,
  intentContext?: any
) {
  const fin = opsContext.aggregates.finance;
  const now = new Date();
  const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

  // 1. 48-Hour Leads Status
  const leads48h = opsContext.allLeads.filter((l) => {
    if (!l.dateOfEntry) return false;
    const d = new Date(l.dateOfEntry);
    return !isNaN(d.getTime()) && d >= fortyEightHoursAgo;
  });

  let leadsPart = '';
  if (leads48h.length > 0) {
    const candidateNames = leads48h.slice(0, 3).map((l) => l.name).filter(Boolean).join(', ');
    const uniqueCourses = Array.from(new Set(leads48h.map((l) => l.course).filter(Boolean))).slice(0, 2).join(' and ');
    const trackPhrase = uniqueCourses ? ` mainly for ${uniqueCourses}` : '';
    leadsPart = `Boss, over the last 48 hours we received ${leads48h.length} new leads${trackPhrase}, including ${candidateNames}, bringing total CRM enquiries to ${opsContext.allLeads.length}.`;
  } else {
    const recentNames = opsContext.allLeads.slice(0, 3).map((l) => l.name).filter(Boolean).join(', ');
    leadsPart = `Boss, over the last 48 hours we recorded zero new leads across ${opsContext.allLeads.length} total enquiries in the CRM, with most recent prospects including ${recentNames}.`;
  }

  // 2. Finance Status
  const netWords = numberToIndianWords(fin.netRevenue);
  const incWords = numberToIndianWords(fin.totalIncome);
  const expWords = numberToIndianWords(fin.totalExpense);
  const lastAmtWords = numberToIndianWords(fin.latestIncomeAmount || 0);
  const lastDate = fin.latestIncomeDate || 'recent';
  const financePart = `Financially, we are in a solid position with net revenue at ${netWords} on ${incWords} total income against ${expWords} expenses, and our latest payment cleared on ${lastDate} for ${lastAmtWords}.`;

  // 3. Meeting / Calendar Schedule
  let calendarPart = 'On your meeting schedule, your calendar is clear today with zero conflicts.';
  let upcomingCount = 0;
  try {
    const calEvents =
      (intentContext?.calendarData && intentContext.calendarData.length > 0)
        ? intentContext.calendarData
        : await getUnifiedCalendarEvents({ maxResults: 15 }).catch(() => []);
    if (calEvents && calEvents.length > 0) {
      upcomingCount = calEvents.length;
      const formattedCal = formatCalendarEventsForJarvis(calEvents)
        .replace(/^Boss,\s*/i, '')
        .replace(/That's your schedule for now\.?$/i, '')
        .trim();
      calendarPart = `Looking at your meeting schedule, ${formattedCal}`;
    } else if (opsContext.activeSessions && opsContext.activeSessions.length > 0) {
      const nextSession = opsContext.activeSessions[0];
      calendarPart = `Looking at your training schedule, ${nextSession.title} with trainer ${nextSession.trainer} is lined up for ${nextSession.date}.`;
    }
  } catch {
    if (opsContext.activeSessions && opsContext.activeSessions.length > 0) {
      const nextSession = opsContext.activeSessions[0];
      calendarPart = `Looking at your training schedule, ${nextSession.title} with trainer ${nextSession.trainer} is lined up for ${nextSession.date}.`;
    }
  }

  // 4. Pending Action Items across Teams Transcripts, CX & CRM Notes
  const actionProfiles: ClientActionItemProfile[] =
    (intentContext?.actionItemProfiles && intentContext.actionItemProfiles.length > 0)
      ? intentContext.actionItemProfiles
      : await getAllLeadActionItemProfiles(prisma);

  const activePendingProfiles = actionProfiles
    .filter((p) => !p.isLost && p.pendingCount > 0)
    .sort((a, b) => {
      if (a.isImmediateAction !== b.isImmediateAction) return a.isImmediateAction ? -1 : 1;
      const aHasCx = a.sources.includes('CX') ? 1 : 0;
      const bHasCx = b.sources.includes('CX') ? 1 : 0;
      if (bHasCx !== aHasCx) return bHasCx - aHasCx;
      return (b.score || 0) - (a.score || 0) || b.pendingCount - a.pendingCount;
    });

  const totalPendingItems = activePendingProfiles.reduce((sum, p) => sum + p.pendingCount, 0);
  const immediateLeads = activePendingProfiles.filter((p) => p.isImmediateAction);
  const overdueLeads = activePendingProfiles.filter((p) => p.isOverdue);

  // 5. Good / Bad Operational Pace Assessment
  const isStrongInflow = leads48h.length >= 3;
  const isHealthyFinance = fin.netRevenue > 0;
  const hasHeavyOverdue = overdueLeads.length >= 5;

  let pacePart = '';
  if (isStrongInflow && isHealthyFinance && !hasHeavyOverdue) {
    pacePart = `Overall, operations are running at a good pace with strong 48 hour lead inflow and positive revenue${upcomingCount > 0 ? ', alongside active scheduled sessions' : ''}.`;
  } else if (isHealthyFinance && (leads48h.length > 0 || upcomingCount > 0)) {
    pacePart = `Overall, operations are running at a steady pace with healthy finances, though we should accelerate follow ups to keep momentum high.`;
  } else {
    pacePart = `Overall, operations need closer attention right now because new lead inflow and overdue follow ups require immediate push.`;
  }

  let actionItemsPart = '';
  if (totalPendingItems > 0) {
    const topImmediateNames = (immediateLeads.length > 0 ? immediateLeads : activePendingProfiles)
      .slice(0, 4)
      .map((p) => `${p.clientName} (${p.pendingCount} open)`)
      .join(', ');
    actionItemsPart = `For pending action items across our Teams transcripts, Customer Experience records, and call notes, we have ${totalPendingItems} items open across ${activePendingProfiles.length} leads, with immediate action needed for ${topImmediateNames}.`;
  } else {
    actionItemsPart = 'All action items across Teams transcripts and Customer Experience records are completely cleared.';
  }

  const fullBriefing = `${leadsPart} ${financePart} ${calendarPart} ${pacePart} ${actionItemsPart}`;

  return {
    answer: stripTechnicalCodes(fullBriefing),
    actionAdvice:
      immediateLeads.length > 0
        ? `Immediate action on ${immediateLeads.slice(0, 3).map((p) => p.clientName).join(', ')} pending items.`
        : 'All pipeline channels synchronized.',
    matchedIds: [],
    recommendedFilter: 'all',
  };
}

/**
 * Deterministic multi-entity fallback engine when Gemini API is offline
 */
async function fallbackComprehensiveOperations(
  prompt: string,
  opsContext: OperationsIntelligenceSnapshot,
  transcriptSnapshot: TranscriptSnapshot,
  intentContext?: any
) {
  const q = prompt.toLowerCase();
  const fin = opsContext.aggregates.finance;

  // 0. Comprehensive System Status Briefing FIRST (never allow DB filter or lead search to hijack it)
  const isSystemStatusFallback =
    Boolean(intentContext?.isSystemStatusQuery) ||
    /\b(what(?:'s|\s+is|\s+are)\s+(?:the\s+things\s+)?going\s+on\s+(?:with|in)\s+the\s+system|things\s+going\s+on|system\s+status|status\s+update|tell\s+me\s+about\s+the\s+system|about\s+the\s+system|how\s+is\s+the\s+system|how\s+are\s+things\s+going|how\s+is\s+gap\s*anchor|gap\s*anchor\s+doing|how\s+are\s+we\s+doing|daily\s+briefing|morning\s+briefing|executive\s+briefing|give\s+me\s+an\s+update)\b/i.test(q) ||
    (/\bwhat(?:'s|\s+is|\s+are)\s+(?:the\s+things\s+)?going\s+on\b/i.test(q) &&
      !/\b(lead|candidate|prospect|action\s*item)\b/i.test(q));

  if (isSystemStatusFallback) {
    return buildExecutiveSystemBriefing(opsContext, intentContext);
  }

  // 0a. Check comprehensive full-database filter intents (explicit filter requests)
  const fullDbFilter = detectAndEvaluateFullDatabaseFilter(prompt, opsContext, transcriptSnapshot);
  if (fullDbFilter.intentDetected) {
    return {
      answer: fullDbFilter.suggestedAnswer,
      actionAdvice: fullDbFilter.suggestedActionAdvice,
      matchedIds: fullDbFilter.matchedLeadIds,
      recommendedFilter: fullDbFilter.recommendedFilter,
    };
  }

  // 1. Past Meeting Discussion Query
  if (intentContext?.isMeetingDiscussionQuery) {
    const disc = intentContext.meetingDiscussion || (intentContext.meetingClientQuery ? await getClientMeetingDiscussionSummary(intentContext.meetingClientQuery, prisma) : null);
    if (disc) {
      return {
        answer: disc.answer,
        actionAdvice: 'Click Details on the client card to review full call recording or customer experience transcript.',
        matchedIds: disc.enquiryId ? [disc.enquiryId] : [],
        recommendedFilter: 'all',
      };
    }
  }

  // 2. Executive Focus Query ("What should I focus on today", "What needs my attention")
  if (intentContext?.isExecutiveFocusQuery) {
    let calSummary = 'your calendar is completely clear with zero scheduled sessions today.';
    try {
      const msEvents = intentContext.calendarData || await getUnifiedCalendarEvents({ maxResults: 15 }).catch(() => []);
      if (msEvents && msEvents.length > 0) {
        calSummary = formatCalendarEventsForJarvis(msEvents, { targetDate: 'today' }).replace(/^Boss,\s*/i, '');
      }
    } catch {}

    const profiles = intentContext.actionItemProfiles || await getAllLeadActionItemProfiles(prisma);
    const pendingClients = profiles.filter((p: any) => !p.isLost && p.pendingCount > 0);
    const immediateWaiters = pendingClients.filter((p: any) => p.isImmediateAction).map((p: any) => p.clientName).slice(0, 4);
    const demoWaiters = pendingClients.filter((p: any) => p.category === 'demo').map((p: any) => p.clientName).slice(0, 2);
    const pricingWaiters = pendingClients.filter((p: any) => p.category === 'pricing').map((p: any) => p.clientName).slice(0, 2);

    const prioritiesList: string[] = [];
    if (immediateWaiters.length > 0) prioritiesList.push(`immediate action items for ${immediateWaiters.join(', ')}`);
    if (demoWaiters.length > 0) prioritiesList.push(`locking in demo sessions for ${demoWaiters.join(' and ')}`);
    if (pricingWaiters.length > 0) prioritiesList.push(`responding to pricing questions for ${pricingWaiters.join(' and ')}`);

    const answer = `Boss, here is where your focus should be today. Looking at your schedule, ${calSummary} In your CRM pipeline, your top priorities are ${prioritiesList.join(', and ') || 'keeping outreach moving across active leads'}. Let me know if you would like me to coordinate any of these right away.`;
    return {
      answer: stripTechnicalCodes(answer),
      actionAdvice: 'Prioritize immediate action items, demo confirmations, and pricing follow ups.',
      matchedIds: pendingClients.slice(0, 5).map((p: any) => p.enquiryId),
      recommendedFilter: 'all',
    };
  }

  // 3. Calendar & Schedule Briefing ("what's on my calendar", "what's the schedules", "tomorrow", etc.)
  const isCalendarOrScheduleFallback =
    intentContext?.isCalendarQuery ||
    (/\b(calendar|schedule|schedules|meeting|meetings|appointment|appointments|event|events)\b/i.test(q) &&
    !/\blead|candidate|prospect|finances?|revenue|expense/i.test(q));

  if (isCalendarOrScheduleFallback) {
    let calendarPart = 'Your Microsoft Calendar is completely clear with zero scheduled conflicts.';
    try {
      const msEvents = intentContext?.calendarData || await getUnifiedCalendarEvents({ maxResults: 15 }).catch(() => []);
      if (msEvents && msEvents.length > 0) {
        calendarPart = formatCalendarEventsForJarvis(msEvents, { targetDate: intentContext?.targetCalendarDate });
      }
    } catch {}

    let trainingPart = '';
    const todayStr = new Date().toISOString().split('T')[0];
    const upcomingBatches = (opsContext.activeSessions || []).filter((s) => s.date >= todayStr);
    if (upcomingBatches.length > 0 && !intentContext?.targetCalendarDate) {
      const s = upcomingBatches[0];
      trainingPart = ` Additionally, on your training batch schedule, "${s.title}" with trainer ${s.trainer} is scheduled for ${s.date}${s.time ? ` at ${s.time}` : ''}.`;
    }

    return {
      answer: stripTechnicalCodes(calendarPart.startsWith('Boss') ? `${calendarPart}${trainingPart}` : `Boss, on your calendar, ${calendarPart}${trainingPart}`),
      actionAdvice: 'View your live Microsoft Calendar or Microsoft Bookings dashboard at https://bookings.cloud.microsoft/bookings/calendar to manage invite slots.',
      matchedIds: [],
      recommendedFilter: 'all',
    };
  }

  // 4. Action Items, Teams Transcripts & Customer Experience (CX) Tasks
  if (
    intentContext?.isActionItemsQuery ||
    intentContext?.isTranscriptOrCxSummaryQuery ||
    q.includes('action item') ||
    q.includes('to do') ||
    q.includes('todo') ||
    q.includes('task') ||
    q.includes('open task') ||
    q.includes('customer experience') ||
    /\bcx\b/.test(q)
  ) {
    const actionProfiles = intentContext?.actionItemProfiles || await getAllLeadActionItemProfiles(prisma);
    const answer = formatActionItemsReportForJarvis(actionProfiles, {
      specificClientQuery: intentContext?.specificClientQuery,
      overdueOnly: intentContext?.overdueOnly,
      waitingResponseOnly: intentContext?.waitingResponseOnly,
    });
    return {
      answer: stripTechnicalCodes(answer),
      actionAdvice: 'Open Customer Experience tabs to review and check off client action items.',
      matchedIds: actionProfiles.filter((p: any) => !p.isLost && p.pendingCount > 0).map((p: any) => p.enquiryId),
      recommendedFilter: 'all',
    };
  }

  // 4b. Pure Finance Standing
  if (q.includes('finance doing') || q.includes('how are the finances')) {
    const netWords = numberToIndianWords(fin.netRevenue);
    const incWords = numberToIndianWords(fin.totalIncome);
    const lastAmtWords = numberToIndianWords(fin.latestIncomeAmount || 0);
    const lastDate = fin.latestIncomeDate || 'recent';

    return {
      answer: `Finances are solid, boss. Net revenue is sitting at ${netWords} on ${incWords} total income, with your last payment cleared on ${lastDate} for ${lastAmtWords}.`,
      actionAdvice: '',
      matchedIds: [],
      recommendedFilter: 'all',
    };
  }

  // 1. Latest Inquiries
  if (
    q.includes('latest') ||
    q.includes('recent') ||
    q.includes('newest') ||
    q.includes('new lead') ||
    q.includes('last inquir') ||
    q.includes('last lead')
  ) {
    const latest = opsContext.latestEnquiries.slice(0, 3);
    const summary = latest
      .map(
        (l) =>
          `${l.name} (${l.course}, ${l.country || 'India'}, Ph: ${l.phone}, Query: "${l.lastMessage || 'N/A'}")`
      )
      .join('; ');

    return {
      answer: stripTechnicalCodes(`Our latest incoming inquiries are: ${summary}.`),
      actionAdvice: stripTechnicalCodes(`Initiate prompt contact with ${latest[0]?.name} via WhatsApp or email (${latest[0]?.email || 'N/A'}).`),
      matchedIds: latest.map((l) => l.id),
      recommendedFilter: 'all',
    };
  }

  // 2. Training Batches & Sessions
  if (
    q.includes('session') ||
    q.includes('batch') ||
    q.includes('payout') ||
    q.includes('trainer fee') ||
    q.includes('trainee')
  ) {
    const s = opsContext.activeSessions[0];
    if (s) {
      const pCount = s.participants.length;
      return {
        answer: stripTechnicalCodes(`Our latest scheduled batch is "${s.title}" on ${s.platform} led by ${s.trainer}. Trainer fee payable: ${numberToIndianWords(s.trainerAmountDue)} (Total: ${numberToIndianWords(s.trainerTotalCost)}). Registered participants: ${pCount}.`),
        actionAdvice: 'Verify participant payment receipts before batch kickoff.',
        matchedIds: [],
        recommendedFilter: 'all',
      };
    }
  }

  // 3. Financial Transactions
  if (q.includes('finance') || q.includes('income') || q.includes('expense') || q.includes('revenue') || q.includes('transaction')) {
    const fin = opsContext.aggregates.finance;
    const t = opsContext.financialTransactions.slice(0, 3);
    const details = t.map((x) => `${numberToIndianWords(x.amount)} (${x.type}, ${x.paymentMethod})`).join(', ');
    const paymentNotice = fin.latestIncomeDate
      ? ` Our last incoming payment was received on ${fin.latestIncomeDate} for ${numberToIndianWords(fin.latestIncomeAmount || 0)}. We have had no incoming payments since then.`
      : '';
    return {
      answer: stripTechnicalCodes(`Overall net revenue stands at ${numberToIndianWords(fin.netRevenue)}. Recent transactions: ${details}.${paymentNotice}`),
      actionAdvice: 'Review live finance ledger in the Finance Intelligence view.',
      matchedIds: [],
      recommendedFilter: 'all',
    };
  }

  // 4. Trainer Registrations
  if (q.includes('trainer') || q.includes('applicant') || q.includes('work with us')) {
    const tr = opsContext.trainerRegistrations.slice(0, 3);
    const names = tr.map((x) => `${x.name} (${x.primaryCourse}, ${x.experienceYears} yrs exp, ${x.status})`).join('; ');
    return {
      answer: stripTechnicalCodes(`We have ${opsContext.aggregates.totalTrainers} registered trainer applicants. Recent profiles: ${names}.`),
      actionAdvice: 'Review trainer experience notes in the Work With Us onboarding drawer.',
      matchedIds: [],
      recommendedFilter: 'all',
    };
  }

  // 5. Call Notes & Discussion Logs
  if (
    q.includes('call note') ||
    q.includes('note') ||
    q.includes('spoke') ||
    q.includes('due') ||
    q.includes('whatsapp number') ||
    q.includes('remark') ||
    q.includes('discussion')
  ) {
    const leadsWithNotes = opsContext.allLeads
      .filter((l) => l.notes && l.notes.trim().length > 0)
      .sort((a, b) => (b.dateOfEntry || '').localeCompare(a.dateOfEntry || ''));

    // Check if query matches specific note keywords (e.g. price, demo, proactive, batch)
    const matchingNotes = leadsWithNotes.filter((l) => {
      const nLower = (l.notes || '').toLowerCase();
      return q.split(/\s+/).some((w) => w.length >= 4 && nLower.includes(w));
    });

    const targetList = matchingNotes.length > 0 ? matchingNotes : leadsWithNotes;
    const topSlice = targetList.slice(0, 3);
    const summary = topSlice
      .map((l) => `${l.name}: "${l.notes}"${l.followUpDate ? ` (Due: ${l.followUpDate})` : ''}`)
      .join(' | ');

    return {
      answer: stripTechnicalCodes(`Retrieved ${targetList.length} candidate call notes. Key records: ${summary}.`),
      actionAdvice: 'Click Details on any lead card to review full discussion history or update notes.',
      matchedIds: topSlice.map((l) => l.id),
      recommendedFilter: 'has_notes',
    };
  }

  // 6. Prioritize / Hot Candidates
  if (
    q.includes('priorit') ||
    q.includes('interest') ||
    q.includes('hot') ||
    q.includes('ready') ||
    q.includes('who should i call') ||
    q.includes('evaluat') ||
    q.includes('best candidate') ||
    q.includes('top candidate')
  ) {
    const res = evaluateAllCandidatesPriorities(prompt, opsContext.allLeads);
    return {
      ...res,
      answer: stripTechnicalCodes(res.answer),
      actionAdvice: stripTechnicalCodes(res.actionAdvice),
    };
  }

  // 7. General lead matching (with stopword filtering, voice normalization & executive summarization)
  const SEARCH_STOPWORDS = new Set([
    'seems', 'like', 'should', 'good', 'great', 'okay', 'fine', 'well', 'about', 'with',
    'this', 'that', 'have', 'been', 'were', 'they', 'them', 'what', 'when', 'where',
    'which', 'there', 'their', 'would', 'could', 'really', 'think', 'just', 'some',
    'things', 'jarvis', 'boss', 'please', 'thank', 'thanks', 'help', 'tell', 'give',
    'make', 'sure', 'right', 'now', 'can', 'you', 'for', 'are', 'the', 'and', 'going',
    'how', 'was', 'has', 'had', 'not', 'but', 'from', 'who', 'yes', 'yeah', 'yep',
    'hey', 'hello', 'here', 'doing', 'want', 'need', 'know', 'look', 'looking',
    'filter', 'filtrate', 'out', 'all', 'every', 'enquiry', 'enquiries', 'query',
    'lead', 'leads', 'candidate', 'candidates', 'prospect', 'prospects', 'list',
    'show', 'find', 'get', 'status', 'summary', 'summarize', 'explain', 'details',
    'detail', 'data', 'record', 'records', 'database', 'system',
  ]);

  const normalizedQ = normalizeVoiceDomainTerms(q);
  const meaningfulTerms = normalizedQ
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !SEARCH_STOPWORDS.has(w));

  if (meaningfulTerms.length === 0) {
    return {
      answer: 'I am right here, boss. Ask me for a system status update, pending action items across Teams transcripts and Customer Experience, today\'s calendar, or details on a specific lead.',
      actionAdvice: 'Standing by for your command.',
      matchedIds: [],
      recommendedFilter: 'all',
    };
  }

  const matched = opsContext.allLeads.filter((l) => {
    const primaryHay = `${l.name} ${l.leadCode} ${l.course} ${l.email || ''} ${l.phone} ${l.country || ''}`.toLowerCase();
    const notesHay = (l.notes || '').toLowerCase();
    return meaningfulTerms.some((w) => {
      if (w.length <= 4) {
        const wordRe = new RegExp(`\\b${w}\\b`, 'i');
        return wordRe.test(primaryHay) || wordRe.test(notesHay);
      }
      return primaryHay.includes(w) || notesHay.includes(w);
    });
  });

  if (matched.length === 0) {
    return {
      answer: 'I checked the CRM and did not find a specific lead or operation matching that, boss. Try asking about system status, pending action items, your schedule, or a candidate by name.',
      actionAdvice: 'Specify a candidate name, course, or operational request.',
      matchedIds: [],
      recommendedFilter: 'all',
    };
  }

  setActiveSubjectLead(matched[0]);
  const matchedIds = matched.map((l) => l.id);

  // Single candidate: rich executive summary
  if (matched.length === 1) {
    const c = matched[0];
    const scoreNote = c.score ? `, rated ${c.score} out of 10` : '';
    const notesNote = c.notes ? ` CRM notes mention ${c.notes}.` : '';
    const transcriptNote = c.transcriptSummary ? ` Latest call summary: ${c.transcriptSummary.slice(0, 160)}.` : '';
    const dueNote = c.followUpDate ? ` Follow up is scheduled for ${c.followUpDate}.` : '';
    return {
      answer: stripTechnicalCodes(
        `Boss, ${c.name} inquired about ${c.course} from ${c.country || 'India'} and is currently marked as ${c.contactStatus}${scoreNote}.${notesNote}${transcriptNote}${dueNote}`
      ),
      actionAdvice: 'Click Details on the candidate row for full transcript and Customer Experience actions.',
      matchedIds,
      recommendedFilter: 'all',
    };
  }

  // Multiple candidates: summarized executive cohort breakdown (never a raw 3-name dump)
  return {
    answer: stripTechnicalCodes(summarizeMatchedCohort(matched, 'matching enquiries')),
    actionAdvice: 'Click Details on any lead card to review complete CRM call notes and transcripts.',
    matchedIds,
    recommendedFilter: 'all',
  };
}
