import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { callGemini, getGeminiConfig } from '@/lib/gemini-client';
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

      // Dynamically match any specific prospects across all 463+ leads
      const matchedProspects = opsContext.allLeads
        .filter((l) => {
          const name = l.name.toLowerCase();
          const code = l.leadCode.toLowerCase();
          const email = (l.email || '').toLowerCase();
          const phone = (l.phone || '').toLowerCase();
          const country = (l.country || '').toLowerCase();
          const course = l.course.toLowerCase();
          return queryWords.some(
            (w) =>
              name.includes(w) ||
              code.includes(w) ||
              email.includes(w) ||
              phone.includes(w) ||
              country.includes(w) ||
              course.includes(w)
          );
        })
        .slice(0, 10);

      // Evaluated candidates with notes, call transcripts, scores, callback reminders
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
          notes: l.notes ? l.notes.slice(0, 140) : null,
          transcriptSummary: l.transcriptSummary ? l.transcriptSummary.slice(0, 150) : null,
          quotes: l.quotes && l.quotes.length > 0 ? l.quotes.slice(0, 2).join(' | ') : null,
          timeline: l.timeline,
          budget: l.budget,
          flag: l.hasRedFlag ? l.redFlagReason : null,
        }));

      const systemPrompt = `You are J.A.R.V.I.S., the British AI operations controller for GapAnchor enterprise academy (Manhattan Active WMS, Blue Yonder, SAP, Kinaxis).
You have live neural database access across all GapAnchor systems:
1. All 463+ candidate leads (full contact details: email, phone, country, course, service type, initial query message, entry dates, status, notes, call transcripts & scores).
2. Live Training Batches & Sessions (platform, trainer, scheduled times, trainer total payout, trainer amount paid/due, trainee participants with fees & payment statuses: PAID, PARTIAL, PENDING).
3. Financial Ledger Transactions (income, expenses, payment methods, transaction notes, amounts).
4. Trainer Registrations (work-with-us candidate profiles, experience years, primary domains, contact info).

USER INQUIRY: "${prompt}"

==============================
1. LATEST INCOMING ENQUIRIES (Most Recent First):
${JSON.stringify(opsContext.latestEnquiries.slice(0, 10), null, 2)}

2. DYNAMICALLY MATCHED PROSPECTS:
${JSON.stringify(matchedProspects, null, 2)}

3. HIGH-INTENT EVALUATED CANDIDATES (Call Notes & Transcripts):
${JSON.stringify(evaluatedCandidates, null, 2)}

4. ACTIVE TRAINING BATCHES & TRAINER PAYOUTS (Session & SessionParticipant):
${JSON.stringify(opsContext.activeSessions.slice(0, 6), null, 2)}

5. RECENT FINANCIAL TRANSACTIONS:
${JSON.stringify(opsContext.financialTransactions.slice(0, 6), null, 2)}

6. TRAINER REGISTRATIONS (Work With Us Applications):
${JSON.stringify(opsContext.trainerRegistrations.slice(0, 6), null, 2)}

7. DATABASE TOTALS & AGGREGATES:
${JSON.stringify(opsContext.aggregates, null, 2)}
==============================

OPERATIONAL INSTRUCTIONS:
1. Directly answer the user's inquiry with verified facts from the live database sections above.
2. If asked about "latest inquiry", "latest leads", or "recent enquiries", cite the exact recent candidates from "LATEST INCOMING ENQUIRIES" (e.g. ${opsContext.latestEnquiries[0]?.name || 'Candidate'} [${opsContext.latestEnquiries[0]?.leadCode || 'GAMA'}], their course, phone, email, country, date of entry, and their initial message).
3. If asked for a candidate's contact info (phone, email, country), provide the exact real data from the database.
4. If asked about batches, trainer payouts, or trainee fees, cite the exact platform, trainer name (e.g. Jose Paul, Arul Xavier), trainer amount due/paid, participant names, and payment status (PAID/PENDING).
5. If asked about finances, revenue, or expenses, cite the exact transactions, dates, payment methods, and amounts.
6. If asked about trainers or work-with-us applicants, cite the registered applicants, experience, and domains.
7. Tone & Cadence: Deliver a sharp, polished, articulate British J.A.R.V.I.S. operational briefing. Be clear, specific, and direct without hallucinating.
8. "answer": Concise, spoken operational briefing (2 to 4 crisp sentences) directly answering the prompt with exact data.
9. "actionAdvice": Crisp tactical next directive for the operations team.
10. "matchedIds": Array of matching lead ID strings from the provided dataset (never invented IDs).
11. "recommendedFilter": "all" | "due_today" | "high_intent" | "demo_followup" | "email_pending" | "red_flags" | "has_notes" or null.
12. Optional "pipelineAction": if the prompt requests pushing, staging, or removing leads.

Respond ONLY with valid JSON with keys: "answer", "actionAdvice", "matchedIds", "recommendedFilter", optional "pipelineAction".`;

      try {
        const geminiRes = await callGemini(systemPrompt, {
          apiKey: effectiveApiKey,
          model,
          jsonMode: true,
          temperature: 0.1,
          maxOutputTokens: 800,
        });

        const parsed = JSON.parse(geminiRes.text);

        return NextResponse.json({
          success: true,
          isRealGemini: true,
          model: 'GAP Neural v2 (Gemini Flash)',
          answer: parsed.answer || 'Operational analysis complete, sir.',
          actionAdvice: parsed.actionAdvice || null,
          matchedIds: Array.isArray(parsed.matchedIds) ? parsed.matchedIds : [],
          recommendedFilter: parsed.recommendedFilter || null,
          pipelineAction: parsed.pipelineAction || null,
        });
      } catch (geminiErr: any) {
        console.error('AI API execution error:', geminiErr);
        // Fallback to deterministic multi-entity engine
        return NextResponse.json({
          success: true,
          isRealGemini: false,
          apiError: geminiErr.message,
          ...fallbackComprehensiveOperations(prompt, opsContext, transcriptSnapshot),
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
      ...fallback,
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
          `${l.name} [${l.leadCode}] (${l.course}, ${l.country || 'India'}, Ph: ${l.phone}, Query: "${l.lastMessage || 'N/A'}")`
      )
      .join('; ');

    return {
      answer: `Our latest incoming inquiries are: ${summary}.`,
      actionAdvice: `Initiate prompt contact with ${latest[0]?.name} via WhatsApp or email (${latest[0]?.email || 'N/A'}).`,
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
        answer: `Our latest scheduled batch is "${s.title}" on ${s.platform} led by ${s.trainer}. Trainer fee payable: ₹${s.trainerAmountDue.toLocaleString()} (Total: ₹${s.trainerTotalCost.toLocaleString()}). Registered participants: ${pCount}.`,
        actionAdvice: 'Verify participant payment receipts before batch kickoff.',
        matchedIds: [],
        recommendedFilter: 'all',
      };
    }
  }

  // 3. Financial Transactions
  if (q.includes('finance') || q.includes('income') || q.includes('expense') || q.includes('revenue') || q.includes('transaction')) {
    const t = opsContext.financialTransactions.slice(0, 3);
    const details = t.map((x) => `₹${x.amount.toLocaleString()} (${x.type}, ${x.paymentMethod})`).join(', ');
    return {
      answer: `Recent financial transactions recorded: ${details}. Total recorded operations: ${opsContext.aggregates.totalTransactions}.`,
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
      answer: `We have ${opsContext.aggregates.totalTrainers} registered trainer applicants. Recent profiles: ${names}.`,
      actionAdvice: 'Review trainer experience notes in the Work With Us onboarding drawer.',
      matchedIds: [],
      recommendedFilter: 'all',
    };
  }

  // 5. Prioritize / Hot Candidates
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
    return evaluateAllCandidatesPriorities(prompt, opsContext.allLeads);
  }

  // 6. General lead matching
  const matched = opsContext.allLeads.filter((l) => {
    const hay = `${l.name} ${l.leadCode} ${l.course} ${l.email || ''} ${l.phone} ${l.country || ''} ${l.notes || ''}`.toLowerCase();
    return q.split(' ').some((w) => w.length > 2 && hay.includes(w));
  });

  const matchedIds = matched.map((l) => l.id);
  const sampleNames = matched.slice(0, 3).map((l) => `${l.name} [${l.leadCode}]`).join(', ');

  return {
    answer: `Located ${matched.length} candidates matching your query: ${sampleNames || 'None found'}.`,
    actionAdvice: 'Click Details on any lead card to review complete CRM call notes and transcripts.',
    matchedIds,
    recommendedFilter: 'all',
  };
}
