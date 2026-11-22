import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { callGemini, getGeminiConfig } from '@/lib/gemini-client';
import { numberToIndianWords, sanitizeIndianCurrencyForSpeech } from '@/lib/utils';
import { listCalendarEvents } from '@/lib/googleCalendar';
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
 * and all currency values are formatted into natural Indian spoken words.
 */
function cleanOutput(text: string): string {
  if (!text) return '';
  const noCodes = stripTechnicalCodes(text);
  const normalizedBoss = noCodes
    .replace(/\b(?:hey\s+)?(?:man|partner|sir)\b/gi, (match) => {
      if (/^hey/i.test(match)) return 'Hey boss';
      return 'boss';
    });
  return sanitizeIndianCurrencyForSpeech(normalizedBoss);
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
    const { prompt, apiKey: requestApiKey } = body;

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
      const actionResult = await executeJarvisPipelineAction(pipelineActionType, prompt, prisma);
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
    // Uses 30s in-memory cache and conditional external calendar fetch
    const [opsContext, transcriptSnapshot, calendarData] = await Promise.all([
      getCachedOperationsSnapshot(prisma),
      getCachedTranscriptSnapshot(),
      needsCalendar
        ? listCalendarEvents({ maxResults: 10 }).catch(() => ({ events: [] }))
        : Promise.resolve({ events: [] }),
    ]);

    // Full 503+ database filter intent evaluation (never truncated)
    const fullDbFilter = detectAndEvaluateFullDatabaseFilter(prompt, opsContext, transcriptSnapshot);

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

      // Query Intent Classification
      const isFinanceOnlyQuery =
        /\b(how\s+are\s+the\s+finances|finance\s+status|how's\s+finance\s+doing|financial\s+update|revenue|expenses|net\s+profit)\b/i.test(pLower) &&
        !/\blead|candidate|prospect|system\s+status|going\s+on/i.test(pLower);

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

      // Upcoming Calendar Events & Cohorts
      const upcomingCalendarEvents = (calendarData?.events || []).map((e: any) => ({
        title: e.title || e.summary || 'Meeting / Session',
        start: e.start,
        end: e.end,
        description: e.description || '',
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

      const systemPrompt = `You are J.A.R.V.I.S., the co-founder, partner, and operations controller for GapAnchor enterprise academy (Manhattan Active WMS, Blue Yonder, SAP, Kinaxis). You are speaking directly to your CEO / business partner.
You have live neural database access across all GapAnchor systems:
1. All ${totalLeadsCount} candidate leads (full contact details: email, phone, country, course, service type, initial query message, entry dates, status, CRM call notes, call transcripts & scores).
2. Live Training Batches & Sessions (platform, trainer, scheduled times, trainer total payout, trainer amount paid/due, trainee participants with fees & payment statuses: PAID, PARTIAL, PENDING).
3. Live Calendar Events & Training Schedules (upcoming demos, meetings, batches).
4. Financial Ledger Transactions (income, expenses, payment methods, transaction notes, amounts).
5. Trainer Registrations (work-with-us candidate profiles, experience years, primary domains, contact info).

USER INQUIRY: "${prompt}"

==============================
1. LATEST INCOMING ENQUIRIES (Most Recent First):
${JSON.stringify(opsContext.latestEnquiries.slice(0, 10), null, 2)}

2. DYNAMICALLY MATCHED PROSPECTS (Searched across Name, Lead Code, Phone, Email, Course, Call Notes, Messages):
${JSON.stringify(matchedProspects, null, 2)}

3. ACTIVE CRM CALL NOTES & DISCUSSION LOGS (Real caller remarks, price discussions, demo requests, callback notes):
${JSON.stringify(leadsWithCallNotes, null, 2)}

4. HIGH-INTENT EVALUATED CANDIDATES (Call Notes & Transcripts):
${JSON.stringify(evaluatedCandidates, null, 2)}

5. ACTIVE TRAINING BATCHES & TRAINER PAYOUTS (Session & SessionParticipant):
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
==============================

OPERATIONAL INSTRUCTIONS & PERSONA:
1. CASUAL AMERICAN STYLE (MANDATORY SALUTATION: ALWAYS ADDRESS USER AS "BOSS"):
   - ALWAYS address the user as "boss" (e.g. "Alright boss...", "Here's what's going on, boss...").
   - Speak like a sharp, confident, trustworthy operations partner.
   - NEVER output or read "practical directive" or include a heading called practical directive.

2. STRICT INTENT-BASED REPORTING (CRITICAL):
${isSystemStatusQuery ? `
   - THIS IS A SYSTEM / GAPANCHOR STATUS BRIEFING:
     Deliver a crisp, cohesive 3-part operational report:
     1. Leads Status: Scan of recent pipeline and last 48-hour inquiries across our ${totalLeadsCount} leads (state courses, active inquiries).
     2. Calendar Status: State upcoming scheduled sessions or calendar events (from UPCOMING CALENDAR EVENTS & SESSIONS). If calendar has zero conflicts or is clear, state that cleanly.
     3. Finance Status: Short concise finance update (net revenue is ${finNetWords} on ${finIncomeWords} income vs ${finExpenseWords} expenses, with last payment on ${lastPaymentDate} for ${lastPaymentWords}). Keep finance short and concise (1 to 2 sentences max).
` : isFinanceOnlyQuery ? `
   - THIS IS A FINANCE-SPECIFIC QUERY:
     Deliver concise financial standing: Net revenue is ${finNetWords} on ${finIncomeWords} total income vs ${finExpenseWords} expenses, with last payment on ${lastPaymentDate} for ${lastPaymentWords}.
` : `
   - THIS IS A LEADS / CANDIDATES / CRM QUERY:
     * DO NOT MENTION FINANCES UNDER ANY CIRCUMSTANCE: Do NOT mention net revenue, income, expenses, or payment records! The user is asking about LEADS.
     * SCAN ALL ${totalLeadsCount} LEADS ACROSS THE FULL DATABASE: You have live access to the entire database of ${totalLeadsCount} enquiries. Provide a thorough, insightful breakdown answering the user's specific prompt.
     * DETAIL THE EXACT NEXT STEPS: When the user asks for next steps, details, or priorities, clearly articulate who to call, which candidates have high intent (demo requests, active notes, callbacks), their specific course tracks (Manhattan Active, Blue Yonder, etc.), and the immediate operational actions to take.
`}

3. CURRENCY IN SPOKEN INDIAN WORDS (WHEN APPLICABLE):
   - When stating money amounts, ALWAYS write them in natural Indian spoken words (e.g. "${finNetWords}", "${lastPaymentWords}", "800 US dollars").
   - NEVER output bare currency symbols like ₹ or Rs. or numbers with commas like ₹6,57,062. This ensures text-to-speech reads the money naturally without mispronouncing.

4. STRICT NAME DIRECTIVE:
   - Under NO circumstance should you speak or include primary key codes like [GAMA-0224], [GABY-0002], [GAGN-0001], or bare codes in "answer" or "actionAdvice". Speak ONLY the real person's name (e.g. 'Bovani Anusha', 'Pramod P', 'Karandeep Singh'). Technical codes are strictly forbidden in speech.

5. "answer": Spoken operational briefing directly answering the prompt with exact data (never include GAMA/GABY codes, write money in words).
6. "actionAdvice": Crisp tactical next directive for the operations team.
7. "matchedIds": Array of matching lead ID strings from the provided dataset. If the user asked a general system status overview, leave matchedIds as [] so the table retains all leads. If the user asked about next steps or specific leads, return all relevant lead IDs.
8. "recommendedFilter": "all" | "due_today" | "high_intent" | "demo_followup" | "email_pending" | "red_flags" | "has_notes" or null.
9. Optional "pipelineAction": if the prompt requests pushing, staging, or removing leads.
${fullDbFilter.intentDetected ? `
10. MANDATORY FULL-DATABASE QUERY DIRECTIVE:
    - The user specifically requested: "${prompt}".
    - We evaluated ALL ${opsContext.allLeads.length} enquiries across our CRM database and identified EXACTLY ${fullDbFilter.uniqueCandidateNames.length} matching candidates.
    - You MUST:
      * ALWAYS address the user as "boss".
      * State explicitly that you evaluated all ${opsContext.allLeads.length} enquiries in the database.
      * Clearly state that the table below is filtered to all ${fullDbFilter.uniqueCandidateNames.length} matching candidates.
      * Mention key candidate names from this list (e.g. ${fullDbFilter.uniqueCandidateNames.slice(0, 7).join(', ')}).
      * Never state there are only 4 candidates or truncate the real count.
` : ''}

Respond ONLY with valid JSON with keys: "answer", "actionAdvice", "matchedIds", "recommendedFilter", optional "pipelineAction".`;

      try {
        const geminiRes = await callGemini(systemPrompt, {
          apiKey: effectiveApiKey,
          model,
          jsonMode: true,
          temperature: 0.1,
          maxOutputTokens: 2500,
        });

        const parsed = JSON.parse(geminiRes.text);
        const cleanAnswer = cleanOutput(parsed.answer || 'Operational analysis complete, boss.');
        const cleanAdvice = parsed.actionAdvice ? cleanOutput(parsed.actionAdvice) : null;

        let finalMatchedIds: string[] = [];
        if (isSystemStatusQuery) {
          finalMatchedIds = []; // System overview keeps all CRM leads visible
        } else if (fullDbFilter.intentDetected && fullDbFilter.matchedLeadIds.length > 0) {
          // Guarantee that ALL matching candidates across the database are retained
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
        const fallback = await fallbackComprehensiveOperations(prompt, opsContext, transcriptSnapshot);
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
    const fallback = await fallbackComprehensiveOperations(prompt, opsContext, transcriptSnapshot);
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
  transcriptSnapshot: TranscriptSnapshot
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

    // 2. Calendar Status: Check Google / iCal database events & active training cohorts
    let calendarPart = 'On the calendar, all schedules are aligned with zero conflicts.';
    try {
      const calData = await listCalendarEvents({ maxResults: 5 });
      const upcomingEvents = (calData?.events || []).filter((e) => {
        const start = new Date(e.start);
        return !isNaN(start.getTime()) && start >= now;
      });

      if (upcomingEvents.length > 0) {
        const nextEv = upcomingEvents[0];
        const dateStr = new Date(nextEv.start).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        calendarPart = `On your calendar, you have "${nextEv.title}" upcoming on ${dateStr}.`;
      } else if (calData?.events && calData.events.length > 0) {
        const nextEv = calData.events[0];
        calendarPart = `On your calendar, upcoming schedule includes "${nextEv.title}".`;
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

  const matchedIds = matched.map((l) => l.id);
  const sampleNames = matched.slice(0, 3).map((l) => l.name).join(', ');

  return {
    answer: stripTechnicalCodes(`Located ${matched.length} candidates matching your query: ${sampleNames || 'None found'}.`),
    actionAdvice: 'Click Details on any lead card to review complete CRM call notes and transcripts.',
    matchedIds,
    recommendedFilter: 'all',
  };
}
