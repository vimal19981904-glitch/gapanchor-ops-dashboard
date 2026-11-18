import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { callGemini, getGeminiConfig } from '@/lib/gemini-client';
import { numberToIndianWords, sanitizeIndianCurrencyForSpeech } from '@/lib/utils';
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
} from '@/lib/jarvis-pipeline-controller';

export const dynamic = 'force-dynamic';

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

    // ─── STAGE 2: Load Full Multi-Entity Operations Snapshot ──────
    // Covers: Leads (463+), Batches & Participants, Finances, Trainers, Transcripts
    const [opsContext, transcriptSnapshot] = await Promise.all([
      getComprehensiveOperationsSnapshot(prisma),
      getTranscriptKnowledgeSnapshot().catch(() => ({ records: [], highInterestCandidates: [], compactPromptContext: '', totalTranscripts: 0 })),
    ]);

    // ─── STAGE 3: If Gemini API Key Available: Real Neural Reasoning ───
    if (effectiveApiKey) {
      const pLower = prompt.toLowerCase();
      const queryWords = pLower
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(
          (w) =>
            w.length >= 3 &&
            !['what', 'when', 'where', 'who', 'how', 'show', 'tell', 'the', 'are', 'is', 'for', 'and', 'with', 'about', 'from', 'all', 'our', 'my'].includes(w)
        );

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
        .slice(0, 25)
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
        .slice(0, 30)
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
        .slice(0, 20)
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

      const isDetailed = /\b(detail|detailed|in[\s-]depth|breakdown|deep[\s-]dive|elaborate|brief me in detail|full report|full update)\b/i.test(prompt);

      const systemPrompt = `You are J.A.R.V.I.S., the co-founder, partner, and operations controller for GapAnchor enterprise academy (Manhattan Active WMS, Blue Yonder, SAP, Kinaxis). You are speaking directly to your CEO / business partner.
You have live neural database access across all GapAnchor systems:
1. All 500+ candidate leads (full contact details: email, phone, country, course, service type, initial query message, entry dates, status, CRM call notes, call transcripts & scores).
2. Live Training Batches & Sessions (platform, trainer, scheduled times, trainer total payout, trainer amount paid/due, trainee participants with fees & payment statuses: PAID, PARTIAL, PENDING).
3. Financial Ledger Transactions (income, expenses, payment methods, transaction notes, amounts).
4. Trainer Registrations (work-with-us candidate profiles, experience years, primary domains, contact info).

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

6. RECENT FINANCIAL TRANSACTIONS:
${JSON.stringify(opsContext.financialTransactions.slice(0, 6), null, 2)}

7. TRAINER REGISTRATIONS (Work With Us Applications):
${JSON.stringify(opsContext.trainerRegistrations.slice(0, 6), null, 2)}

8. DATABASE TOTALS & AGGREGATES:
${JSON.stringify(opsContext.aggregates, null, 2)}
==============================

OPERATIONAL INSTRUCTIONS & PERSONA:
1. CASUAL AMERICAN STYLE (MANDATORY SALUTATION: ALWAYS ADDRESS USER AS "BOSS"):
   - When the user asks general questions, greetings, or quick summaries (e.g. "what's going on", "tell me about the system", "how's it going", "how are we doing", "what's up", "how's finance doing"):
     * Speak like a casual, witty American co-founder talking directly to his CEO.
     * STRICT ADDRESS DIRECTIVE: ALWAYS call the user "boss" (e.g. "Honestly, boss, we're crushing it today!", "Pipeline's looking pretty slick, boss—no fires to put out, coffee's kicking in!", "Net profit is sitting pretty at ${finNetWords}, boss, so nobody's going broke today!").
     * NEVER call the user "man" or "partner" or "sir". Use "boss" exclusively.
     * Keep it funny, relaxed, and lighthearted with natural American idioms.
     * Keep it SHORT and PUNCHY: 2 to 3 sentences MAXIMUM.
     * NEVER dump long lists of candidates or recite raw data tables during small talk.
2. STRICT DATA FIDELITY IN DETAIL MODE:
   - When the user says "give me the things in detail", "breakdown", "in depth", "detail", "detailed", "full report", "deep dive":
     * STOP JOKING AND DO NOT PLAY WITH THE DATA. Shift immediately into precise, high-rigor executive data delivery with uncompromised accuracy, addressing the user as "boss" (e.g. "Alright boss, here is the full executive breakdown across our active operations...").
     * Deliver the exact 3-part CRM briefing:
       - Part 1: Priority new leads from the recent influx grouped cleanly by training track (e.g. Blue Yonder, Manhattan Active, SAP). Speak only candidate real names without technical codes.
       - Part 2: Review call notes and transcripts to highlight our prime high-conversion lead (e.g. Pramod P who needs a demo session conducted in 2 days) and specify the tactical next step.
       - Part 3: Deliver the financial standing and cash flow alert: Total net revenue (${finNetWords} on ${finIncomeWords} income vs ${finExpenseWords} expenses), and explicitly state when the last payment came in: "Our last incoming payment was recorded on ${lastPaymentDate} for ${lastPaymentWords}."
3. CURRENCY IN SPOKEN INDIAN WORDS:
   - When stating money amounts, ALWAYS write them in natural Indian spoken words (e.g. "${finNetWords}", "${lastPaymentWords}", "800 US dollars").
   - NEVER output bare currency symbols like ₹ or Rs. or numbers with commas like ₹6,57,062. This ensures text-to-speech reads the money naturally without mispronouncing.
4. STRICT NAME DIRECTIVE:
   - Under NO circumstance should you speak or include primary key codes like [GAMA-0224], [GABY-0002], [GAGN-0001], or bare codes in "answer" or "actionAdvice". Speak ONLY the real person's name (e.g. 'Bovani Anusha', 'Pramod P', 'Karandeep Singh'). Technical codes are strictly forbidden in speech.
5. If asked about "call notes", cite the exact candidate name, phone, and their exact call note from "ACTIVE CRM CALL NOTES & DISCUSSION LOGS" (without codes).
6. If asked about "latest inquiry" or "recent enquiries", cite the exact candidates from "LATEST INCOMING ENQUIRIES" by name.
7. If asked for a candidate's contact info (phone, email, country), provide the exact real data from the database.
8. If asked about batches, trainer payouts, or trainee fees, cite the exact platform, trainer name, trainer amount due/paid, participant names, and payment status.
9. "answer": Spoken operational briefing directly answering the prompt with exact data (never include GAMA/GABY codes, write money in words).
10. "actionAdvice": Crisp tactical next directive for the operations team.
11. "matchedIds": Array of matching lead ID strings from the provided dataset (never invented IDs).
12. "recommendedFilter": "all" | "due_today" | "high_intent" | "demo_followup" | "email_pending" | "red_flags" | "has_notes" or null.
13. Optional "pipelineAction": if the prompt requests pushing, staging, or removing leads.

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
        const cleanAnswer = cleanOutput(parsed.answer || 'Operational analysis complete, sir.');
        const cleanAdvice = parsed.actionAdvice ? cleanOutput(parsed.actionAdvice) : null;

        return NextResponse.json({
          success: true,
          isRealGemini: true,
          model: 'GAP Neural v2 (Gemini Flash)',
          answer: cleanAnswer,
          actionAdvice: cleanAdvice,
          matchedIds: Array.isArray(parsed.matchedIds) ? parsed.matchedIds : [],
          recommendedFilter: parsed.recommendedFilter || null,
          pipelineAction: parsed.pipelineAction || null,
        });
      } catch (geminiErr: any) {
        console.error('AI API execution error:', geminiErr);
        // Fallback to deterministic multi-entity engine
        const fallback = fallbackComprehensiveOperations(prompt, opsContext, transcriptSnapshot);
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
    const fallback = fallbackComprehensiveOperations(prompt, opsContext, transcriptSnapshot);
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
function fallbackComprehensiveOperations(
  prompt: string,
  opsContext: OperationsIntelligenceSnapshot,
  transcriptSnapshot: TranscriptSnapshot
) {
  const q = prompt.toLowerCase();
  const fin = opsContext.aggregates.finance;
  const isDetailed = /\b(detail|detailed|in[\s-]depth|breakdown|deep[\s-]dive|elaborate|brief me in detail|full report|full update)\b/i.test(prompt);

  // 0. Comprehensive CRM Executive Briefing ("What's going on?", "How is finance doing?", "Status update", "Daily briefing", "Morning briefing")
  if (
    q.includes("what's going on") ||
    q.includes('whats going on') ||
    q.includes('what is going on') ||
    q.includes('how is the finance doing') ||
    q.includes('how are the finances') ||
    q.includes('finance doing') ||
    q.includes('how are we doing') ||
    q.includes('daily briefing') ||
    q.includes('morning briefing') ||
    q.includes('executive briefing') ||
    q.includes('give me an update') ||
    q.includes('status update') ||
    q.includes('tell me about the system') ||
    q.includes('about the system')
  ) {
    const rByTrack = opsContext.aggregates.recentByTrack;
    const prime = opsContext.aggregates.primeConversionOpportunity;
    const netWords = numberToIndianWords(fin.netRevenue);
    const incWords = numberToIndianWords(fin.totalIncome);
    const expWords = numberToIndianWords(fin.totalExpense);
    const lastAmtWords = numberToIndianWords(fin.latestIncomeAmount || 0);
    const lastDate = fin.latestIncomeDate || 'October 24, 2026';

    // A. Default Short Co-founder Mode (when not asking for deep details) - Casual American style ("boss")
    if (!isDetailed) {
      if (q.includes('finance')) {
        return {
          answer: `Hey boss, finances are looking pretty sweet right now! Net profit is sitting comfortably at ${netWords} on ${incWords} total income, so the ship is sailing smooth. That last check cleared on ${lastDate} for ${lastAmtWords}. Honestly, can't complain!`,
          actionAdvice: 'Feel free to peep the live ledger in the Finance Intelligence panel whenever you want.',
          matchedIds: [],
          recommendedFilter: 'all',
        };
      }

      return {
        answer: `Honestly, boss, we're crushing it today! Inquiry pipeline is buzzing across Blue Yonder and Manhattan Active, and net profit is sitting solid at ${netWords}. No fires to put out, coffee's kicking in, and everything's rolling smooth!`,
        actionAdvice: prime
          ? stripTechnicalCodes(`Prime play: hit up ${prime.name} for ${prime.course} to close that batch.`)
          : 'Zero fires on the radar, boss. Smooth sailing.',
        matchedIds: opsContext.allLeads.slice(0, 3).map((l) => l.id),
        recommendedFilter: 'all',
      };
    }

    // B. Explicit Detailed Breakdown Mode

    // Part 1: Recent leads grouped by track (Names only, no codes)
    const trackSummaries: string[] = [];
    if (rByTrack.blueYonder.length > 0) {
      trackSummaries.push(`Blue Yonder: ${rByTrack.blueYonder.map((x) => x.name).join(', ')}`);
    }
    if (rByTrack.manhattan.length > 0) {
      trackSummaries.push(`Manhattan Active WMS: ${rByTrack.manhattan.map((x) => x.name).join(', ')}`);
    }
    if (rByTrack.sap.length > 0) {
      trackSummaries.push(`SAP: ${rByTrack.sap.map((x) => x.name).join(', ')}`);
    }
    if (rByTrack.other.length > 0) {
      trackSummaries.push(`Supply Chain & Analytics: ${rByTrack.other.map((x) => `${x.name} (${x.course})`).join(', ')}`);
    }

    const leadsPart = trackSummaries.length > 0
      ? `Starting with our newest candidate inquiries grouped by track: ${trackSummaries.join('; ')}.`
      : `We have 501 active prospects recorded in CRM.`;

    // Part 2: Prime follow-up opportunity from call notes & transcripts
    const followUpPart = prime
      ? `Moving to follow-ups, our prime conversion opportunity is ${prime.name} for ${prime.course}. Their call log notes: "${prime.notes}". They are actively primed for conversion.`
      : `Our top active callback candidates are ready for immediate contact.`;

    // Part 3: Finance net worth & cash flow alert
    const lastPaymentAlert = fin.latestIncomeDate
      ? `Regarding our finances, overall net revenue stands at ${netWords} (total income ${incWords} against ${expWords} in expenses). Our last incoming payment arrived on ${lastDate} for ${lastAmtWords}, and we have not recorded any new incoming payments since that date.`
      : `Overall net revenue stands at ${netWords}.`;

    return {
      answer: stripTechnicalCodes(`${leadsPart} ${followUpPart} ${lastPaymentAlert}`),
      actionAdvice: prime
        ? stripTechnicalCodes(`Engage ${prime.name} immediately via WhatsApp (${prime.phone}) to lock in batch confirmation and release invoicing.`)
        : `Prioritize closing demo stage candidates to restart inbound cash flow.`,
      matchedIds: opsContext.allLeads.slice(0, 5).map((l) => l.id),
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
