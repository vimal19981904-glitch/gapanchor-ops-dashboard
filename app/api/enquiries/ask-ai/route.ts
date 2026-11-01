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
  evaluateAllCandidatesPriorities,
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

    // ─── STAGE 2: Comprehensive Multi-Lead Context ────────────────
    const allComprehensiveLeads = await getComprehensiveLeadContext(prisma);
    const transcriptSnapshot = await getTranscriptKnowledgeSnapshot();

    // ─── STAGE 3: If Gemini API Key Available: Real Neural Reasoning ───
    if (effectiveApiKey) {
      // Intelligently select candidates with activity: transcripts, call scores, notes, follow-up dates
      const activeCandidates = allComprehensiveLeads.filter(
        (l) => l.score || l.transcriptSummary || l.notes || l.followUpDate || l.hasRedFlag
      );

      // Compact representation containing ALL rich signals: primary key, notes, transcripts, scores, dates
      const compactProfiles = activeCandidates.slice(0, 25).map((l) => ({
        id: l.id,
        primaryKey: l.leadCode,
        name: l.name,
        course: l.course,
        score: l.score ? `${l.score}/10` : 'Unrated',
        quality: l.leadQuality,
        status: l.status,
        contactStatus: l.contactStatus,
        due: l.followUpDate,
        isDue: l.isDue,
        notes: l.notes ? l.notes.slice(0, 120) : null,
        transcriptSummary: l.transcriptSummary ? l.transcriptSummary.slice(0, 140) : null,
        quotes: l.quotes && l.quotes.length > 0 ? l.quotes.slice(0, 2).join(' | ') : null,
        timeline: l.timeline,
        budget: l.budget,
        flag: l.hasRedFlag ? l.redFlagReason : null,
      }));

      const systemPrompt = `You are J.A.R.V.I.S., British AI operations controller for GapAnchor enterprise academy (Manhattan Active WMS, Blue Yonder, SAP).
You have full access to all candidate records: call transcripts, call notes, meeting dialogues, scheduled callback dates, and the visual pipeline.

User asks: "${prompt}"

VERIFIED CANDIDATE INTELLIGENCE & CALL TRANSCRIPTS:
${JSON.stringify(compactProfiles, null, 2)}

OPERATIONAL RULES:
1. Each candidate has a unique human-friendly primary key (e.g. GAMA-0355 for Arya Suriyanarayanan, GAMA-0136 for Soundarya, etc.). When referencing candidates in "answer", cite their primary key in brackets (e.g. "Arya Suriyanarayanan [GAMA-0355]").
2. NEVER evaluate only a single candidate like Bhuvanesh. We have multiple high-intent candidates with transcripts and notes (e.g. Arya Suriyanarayanan [GAMA-0355] and Bhuvanesh both rated 9/10, Shorya Garg rated 8/10, etc.).
3. Evaluate candidates objectively across call transcripts, call notes, urgent timelines, and scheduled callbacks.
4. If the user asks for top priorities or candidates, evaluate and present ALL top-tier candidates fairly, comparing their courses and immediate next actions.
5. If the user asks to remove leads (e.g. "remove all lost enquiries", "remove [name] from pipeline"), recognize and confirm the removal.
6. "answer": Concise spoken briefing (1 to 2 crisp sentences, max 35 words) delivered in British Jarvis cadence.
7. "actionAdvice": Crisp tactical next directive for the operations team.
8. "matchedIds": Array of matching lead ID strings from the provided dataset (never invented IDs).
9. "recommendedFilter": "all" | "due_today" | "high_intent" | "demo_followup" | "email_pending" | "red_flags" | "has_notes" or null.
10. If the user prompt requests pushing, staging, or removing leads, set "pipelineAction": { "type": "push_due" | "push_priority" | "push_top10" | "add_specific" | "remove_lost" | "remove_lead", "leadIds": [...], "removeLeadIds": [...] }.

Respond ONLY with valid JSON with keys: "answer", "actionAdvice", "matchedIds", "recommendedFilter", optional "pipelineAction".`;

      try {
        const geminiRes = await callGemini(systemPrompt, {
          apiKey: effectiveApiKey,
          model,
          jsonMode: true,
          temperature: 0.1,
          maxOutputTokens: 300,
        });

        const parsed = JSON.parse(geminiRes.text);

        return NextResponse.json({
          success: true,
          isRealGemini: true,
          model: 'GAP Neural v2',
          answer: parsed.answer || 'Analysis complete, sir.',
          actionAdvice: parsed.actionAdvice || null,
          matchedIds: Array.isArray(parsed.matchedIds) ? parsed.matchedIds : [],
          recommendedFilter: parsed.recommendedFilter || null,
          pipelineAction: parsed.pipelineAction || null,
        });
      } catch (geminiErr: any) {
        console.error('AI API execution error:', geminiErr);
        // Fallback to deterministic multi-candidate engine
        return NextResponse.json({
          success: true,
          isRealGemini: false,
          apiError: geminiErr.message,
          ...fallbackComprehensiveSearch(prompt, allComprehensiveLeads, transcriptSnapshot),
        });
      }
    }

    // ─── STAGE 4: Deterministic Multi-Lead Heuristics ─────────────
    const fallback = fallbackComprehensiveSearch(prompt, allComprehensiveLeads, transcriptSnapshot);
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

function fallbackComprehensiveSearch(
  prompt: string,
  leads: any[],
  transcriptSnapshot: TranscriptSnapshot
) {
  const q = prompt.toLowerCase();

  // 1. Prioritize / Hot Candidates / "Who should I call" / "Evaluate candidates"
  if (
    q.includes('priorit') ||
    q.includes('interest') ||
    q.includes('hot') ||
    q.includes('ready') ||
    q.includes('who should i call') ||
    q.includes('evaluat') ||
    q.includes('best candidate') ||
    q.includes('top candidate') ||
    q.includes('top lead')
  ) {
    return evaluateAllCandidatesPriorities(prompt, leads);
  }

  // 2. Transcripts / quotes / call recordings
  if (q.includes('transcript') || q.includes('call') || q.includes('quote') || q.includes('spoke')) {
    return searchTranscriptsHeuristically(prompt, transcriptSnapshot);
  }

  // 3. Due Callbacks
  if (q.includes('due') || q.includes('today') || q.includes('callback') || q.includes('overdue')) {
    const dueLeads = leads.filter((l) => l.isDue || l.followUpDate);
    const matchedIds = dueLeads.map((l) => l.id);
    const topNames = dueLeads.slice(0, 3).map((l) => l.name).join(', ');
    return {
      answer: `Found ${dueLeads.length} leads with scheduled callbacks. Priority contacts: ${topNames || 'None scheduled'}.`,
      actionAdvice: 'Review callback notes in the detail drawer and initiate scheduled follow-ups.',
      matchedIds,
      recommendedFilter: 'due_today',
    };
  }

  // 4. Red flags
  if (q.includes('flag') || q.includes('risk') || q.includes('issue') || q.includes('objection')) {
    const flagged = leads.filter((l) => l.hasRedFlag);
    const matchedIds = flagged.map((l) => l.id);
    return {
      answer: `Found ${flagged.length} leads with active red flags or recorded objections.`,
      actionAdvice: 'Review candidate objections before scheduling follow-up calls.',
      matchedIds,
      recommendedFilter: 'red_flags',
    };
  }

  // 5. General matching across name, course, notes, lastMessage
  const matched = leads.filter((l) => {
    const hay = `${l.name} ${l.course} ${l.notes || ''} ${l.transcriptSummary || ''}`.toLowerCase();
    return q.split(' ').some((w) => w.length > 2 && hay.includes(w));
  });

  const matchedIds = matched.map((l) => l.id);
  const sampleNames = matched.slice(0, 3).map((l) => l.name).join(', ');

  return {
    answer: `Found ${matched.length} candidates matching "${prompt}": ${sampleNames || 'None'}.`,
    actionAdvice: 'Click Details on any lead to view full call history, notes, and transcript analysis.',
    matchedIds,
    recommendedFilter: 'all',
  };
}
