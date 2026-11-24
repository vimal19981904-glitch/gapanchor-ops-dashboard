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
 * Scans ALL 502+ database enquiries to identify matching candidate subsets
 * for filtering prompts (transcripts, notes, due dates, country, course, status).
 * Prevents premature truncation so J.A.R.V.I.S. always evaluates the entire database.
 */
function detectAndEvaluateFullDatabaseFilter(
  prompt: string,
  opsContext: OperationsIntelligenceSnapshot,
  transcriptSnapshot: TranscriptSnapshot
): DatabaseFilterMatch {
  const p = prompt.toLowerCase().trim();
  const allLeads = opsContext.allLeads;

  // 1. Transcript / Call Recording filter
  const isTranscriptQuery =
    /\b(transcript|transcripts|recording|recordings|cx|customer experience|call analysis)\b/i.test(p) ||
    (/\bfiltrate\b/i.test(p) && (/\bcall\b/i.test(p) || /\bpeople\b/i.test(p) || /\blead\b/i.test(p) || /\btranscript/i.test(p))) ||
    (/\bwho\s+(?:has|have)\s+call/i.test(p)) ||
    (/\bwho\s+talked\b/i.test(p));

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

  // 5. Course filter
  const courseKeywords: Record<string, string> = {
    'blue yonder': 'Blue Yonder WMS',
    jda: 'Blue Yonder WMS (JDA)',
    manhattan: 'Manhattan Active WMS',
    'active wms': 'Manhattan Active WMS',
    proactive: 'Manhattan ProActive WMS',
    sap: 'SAP S/4HANA',
    's/4hana': 'SAP S/4HANA',
    kinaxis: 'Kinaxis RapidResponse',
    oracle: 'Oracle SCM',
  };

  for (const [key, courseName] of Object.entries(courseKeywords)) {
    const re = new RegExp(`\\b${key}\\b`, 'i');
    if (re.test(p) && /\b(filter|filtrate|show|list|who|leads|candidates|track)\b/i.test(p)) {
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
          suggestedAnswer: `Boss, I scanned all ${allLeads.length} database enquiries and filtered the table to all ${uniqueCandidateNames.length} candidates interested in ${courseName}, including ${uniqueCandidateNames.slice(0, 5).join(', ')}.`,
          suggestedActionAdvice: `Check upcoming batch schedule and trainer availability for ${courseName}.`,
        };
      }
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
      /\b(how\s+is\s+the\s+system|how\s+is\s+gap\s*anchor\s+doing|how\s+are\s+we\s+doing|system\s+status|what's\s+going\s+on\s+with\s+the\s+system|what\s+is\s+going\s+on\s+with\s+the\s+system|daily\s+briefing|morning\s+briefing|executive\s+briefing|overall\s+status|update\s+on\s+the\s+system)\b/i.test(pLower) ||
      (/\bwhat('s|\s+is)\s+going\s+on\b/i.test(pLower) && !/\blead|candidate|prospect|enquir|detail|next\s+step/i.test(pLower));

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

    const isActionItemsQuery =
      Boolean(specificClientQuery) ||
      isOverdueQuery ||
      isWaitingResponseQuery ||
      /\b(action\s*items?|to\s*-?\s*do(?:s)?|pending\s*tasks?|open\s*tasks?|tasks?\s*left|checklist|what\s+tasks?\s+are\s+left|pending\s+items?|pending\s+action\s+items?|what\s+do\s+i\s+need\s+to\s+follow\s+up\s+on|follow\s+ups?\s+pending|pending\s+follow\s*ups?)\b/i.test(pLower);

    const isExecutiveFocusQuery =
      /\b(what\s+should\s+i\s+focus\s+on|what\s+needs\s+my\s+attention|focus\s+today|what's\s+my\s+focus|priorities\s+for\s+today|what\s+should\s+i\s+do\s+today)\b/i.test(pLower);

    // Update active topic context for multi-turn sessions
    if (isCalendarQuery) {
      setActiveTopicContext({ topic: 'calendar', targetDate: targetCalendarDate }, sessionIdStr);
    } else if (isActionItemsQuery) {
      setActiveTopicContext({ topic: 'action_items', clientName: specificClientQuery }, sessionIdStr);
    } else if (isMeetingDiscussionQuery) {
      setActiveTopicContext({ topic: 'meeting_notes', clientName: meetingClientQuery }, sessionIdStr);
    } else if (isExecutiveFocusQuery) {
      setActiveTopicContext({ topic: 'general' }, sessionIdStr);
    }

    // Preload action items if relevant
    const actionItemProfiles = (isActionItemsQuery || isExecutiveFocusQuery)
      ? await getAllLeadActionItemProfiles(prisma)
      : [];

    // Preload meeting discussion if relevant
    const meetingDiscussion = (isMeetingDiscussionQuery && meetingClientQuery)
      ? await getClientMeetingDiscussionSummary(meetingClientQuery, prisma)
      : null;

    const intentContext = {
      isCalendarQuery,
      targetCalendarDate,
      isActionItemsQuery,
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
        matchedIds: profiles.filter((p) => p.pendingCount > 0).slice(0, 8).map((p) => p.enquiryId),
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
${isActionItemsQuery || isExecutiveFocusQuery ? `
10. CRM TO-DO LISTS & IMMEDIATE ACTION ITEMS (Checked vs Pending Tasks):
${JSON.stringify(actionItemProfiles, null, 2)}
` : ''}
${meetingDiscussion ? `
11. MEETING DISCUSSION RECORD FOR ${meetingClientQuery}:
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
   - THIS IS AN ACTION ITEMS / TO-DO QUERY:
     * Focus ONLY on genuinely pending items (exclude completed tasks).
     * Group action items by client: demo requests (e.g. Sugnan Paul, Pramod P), pricing inquiries (e.g. Arya), batch scheduling (e.g. Hema Sai, Omsai Kumar, Upasana), retry outreach for disconnected calls (e.g. Sagar, Shorya Garg).
     * If asking for a specific client (e.g. "${specificClientQuery || ''}"), focus exclusively on that client's open tasks.
     * If asking about overdue activities, list the clients with overdue deadlines first.
     * If asking which clients are waiting for a response, list those waiting on demo confirmations or pricing.
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
   - THIS IS A SYSTEM / GAPANCHOR STATUS BRIEFING:
     Deliver a crisp, cohesive 3-part operational report:
     1. Leads Status: Pipeline scan of recent inquiries across our ${totalLeadsCount} leads.
     2. Calendar Status: Today and upcoming sessions on Microsoft Calendar with zero conflicts.
     3. Finance Status: Concise finance update (net revenue is ${finNetWords} on ${finIncomeWords} income vs ${finExpenseWords} expenses, with last payment on ${lastPaymentDate} for ${lastPaymentWords}).
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
 * Deterministic multi-entity fallback engine when Gemini API is offline
 */
async function fallbackComprehensiveOperations(
  prompt: string,
  opsContext: OperationsIntelligenceSnapshot,
  transcriptSnapshot: TranscriptSnapshot,
  intentContext?: any
) {
  // 0a. Check comprehensive full-database filter intents (transcripts, notes, dues, country, course)
  const fullDbFilter = detectAndEvaluateFullDatabaseFilter(prompt, opsContext, transcriptSnapshot);
  if (fullDbFilter.intentDetected) {
    return {
      answer: fullDbFilter.suggestedAnswer,
      actionAdvice: fullDbFilter.suggestedActionAdvice,
      matchedIds: fullDbFilter.matchedLeadIds,
      recommendedFilter: fullDbFilter.recommendedFilter,
    };
  }

  const q = prompt.toLowerCase();
  const fin = opsContext.aggregates.finance;
  const isDetailed = /\b(detail|detailed|in[\s-]depth|breakdown|deep[\s-]dive|elaborate|brief me in detail|full report|full update)\b/i.test(prompt);

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
    const pendingClients = profiles.filter((p: any) => p.pendingCount > 0);
    const demoWaiters = pendingClients.filter((p: any) => p.category === 'demo').map((p: any) => p.clientName).slice(0, 2);
    const pricingWaiters = pendingClients.filter((p: any) => p.category === 'pricing').map((p: any) => p.clientName).slice(0, 1);
    const overdueWaiters = pendingClients.filter((p: any) => p.isOverdue).map((p: any) => p.clientName).slice(0, 2);

    const prioritiesList: string[] = [];
    if (demoWaiters.length > 0) prioritiesList.push(`locking in demo sessions for ${demoWaiters.join(' and ')}`);
    if (pricingWaiters.length > 0) prioritiesList.push(`responding to pricing questions for ${pricingWaiters.join(', ')}`);
    if (overdueWaiters.length > 0) prioritiesList.push(`reaching out to overdue contacts including ${overdueWaiters.join(' and ')}`);

    const answer = `Boss, here is where your focus should be today. Looking at your schedule, ${calSummary} In your CRM pipeline, your top priorities are ${prioritiesList.join(', and ')}. Let me know if you would like me to coordinate any of these right away.`;
    return {
      answer: stripTechnicalCodes(answer),
      actionAdvice: 'Prioritize demo confirmations and outreach to overdue contacts.',
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

  // 4. Action Items & To-Do Lists
  if (
    intentContext?.isActionItemsQuery ||
    q.includes('action item') ||
    q.includes('to do') ||
    q.includes('todo') ||
    q.includes('task') ||
    q.includes('open task')
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
      matchedIds: actionProfiles.map((p: any) => p.enquiryId),
      recommendedFilter: 'all',
    };
  }

  // 0. Comprehensive System Status Briefing ("What's going on with the system", "How is the system", "How is GapAnchor doing", "Daily briefing", "System status")
  const isSystemStatusFallback =
    (
      q.includes("what's going on with the system") ||
      q.includes('what is going on with the system') ||
      q.includes('system status') ||
      q.includes('status update') ||
      q.includes('tell me about the system') ||
      q.includes('about the system') ||
      q.includes('how is the system') ||
      q.includes('how is gap anchor') ||
      q.includes('gap anchor doing') ||
      q.includes('how are we doing') ||
      q.includes('daily briefing') ||
      q.includes('morning briefing') ||
      q.includes('executive briefing') ||
      q.includes('give me an update') ||
      (q.includes("what's going on") && !q.includes('lead') && !q.includes('candidate') && !q.includes('prospect'))
    );

  if (isSystemStatusFallback || q.includes('finance doing') || q.includes('how are the finances')) {
    // If user asked purely about finances only
    if (q.includes('finance doing') || q.includes('how are the finances') || (q.includes('finance') && !q.includes('system') && !q.includes('going on'))) {
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

    // 1. Leads Status: Scan all leads and evaluate the last 48 hours
    const now = new Date();
    const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

    const leads48h = opsContext.allLeads.filter((l) => {
      if (!l.dateOfEntry) return false;
      const d = new Date(l.dateOfEntry);
      return !isNaN(d.getTime()) && d >= fortyEightHoursAgo;
    });

    const displayLeads = leads48h.length > 0 ? leads48h : opsContext.allLeads.slice(0, 4);
    const count48 = leads48h.length > 0 ? leads48h.length : displayLeads.length;
    const candidateNames = displayLeads.slice(0, 3).map((l) => l.name).filter(Boolean).join(', ');
    const uniqueCourses = Array.from(new Set(displayLeads.map((l) => l.course).filter(Boolean))).slice(0, 2).join(' and ');
    const trackPhrase = uniqueCourses ? ` primarily in ${uniqueCourses}` : '';

    const leadsPart = `Over the last 48 hours, we tracked ${count48} inquiries in the pipeline${trackPhrase}, including ${candidateNames}.`;

    // 2. Calendar Status: Check Microsoft Graph calendar events & active training cohorts
    let calendarPart = 'On the calendar, all schedules are aligned with zero conflicts.';
    try {
      const msEvents = await getMicrosoftCalendarEvents({ maxResults: 5 });
      if (msEvents && msEvents.length > 0) {
        calendarPart = `On your calendar, ${formatCalendarEventsForJarvis(msEvents)}`;
      } else if (opsContext.activeSessions && opsContext.activeSessions.length > 0) {
        const nextSession = opsContext.activeSessions[0];
        calendarPart = `On your training calendar, ${nextSession.title} with trainer ${nextSession.trainer} is scheduled for ${nextSession.date}.`;
      }
    } catch {
      if (opsContext.activeSessions && opsContext.activeSessions.length > 0) {
        const nextSession = opsContext.activeSessions[0];
        calendarPart = `On your training calendar, ${nextSession.title} with trainer ${nextSession.trainer} is scheduled for ${nextSession.date}.`;
      }
    }

    // 3. Short Finance Status: Net profit, total income, and latest income date
    const netWords = numberToIndianWords(fin.netRevenue);
    const incWords = numberToIndianWords(fin.totalIncome);
    const lastAmtWords = numberToIndianWords(fin.latestIncomeAmount || 0);
    const lastDate = fin.latestIncomeDate || 'recent';

    const financePart = `Financially, net revenue is sitting solid at ${netWords} on ${incWords} total income, with your last payment cleared on ${lastDate} for ${lastAmtWords}.`;

    const fullBriefing = `${leadsPart} ${calendarPart} ${financePart}`;

    return {
      answer: stripTechnicalCodes(fullBriefing),
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

  // 7. General lead matching
  const matched = opsContext.allLeads.filter((l) => {
    const hay = `${l.name} ${l.course} ${l.email || ''} ${l.phone} ${l.country || ''} ${l.notes || ''}`.toLowerCase();
    return q.split(' ').some((w) => w.length > 2 && hay.includes(w));
  });

  if (matched.length > 0) {
    setActiveSubjectLead(matched[0]);
  }

  const matchedIds = matched.map((l) => l.id);
  const sampleNames = matched.slice(0, 3).map((l) => l.name).join(', ');

  return {
    answer: stripTechnicalCodes(`Located ${matched.length} candidates matching your query: ${sampleNames || 'None found'}.`),
    actionAdvice: 'Click Details on any lead card to review complete CRM call notes and transcripts.',
    matchedIds,
    recommendedFilter: 'all',
  };
}
