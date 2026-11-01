/**
 * GapAnchor Lead-Call Automation Pipeline
 * AI Transcript Analyzer & Deterministic Rubric Scoring Engine
 * 
 * Supports:
 * 1. Google Gemini 1.5 Flash (100% Free Tier via Google AI Studio, 1M context)
 * 2. Deterministic Pure-Code Heuristic Fallback (Runs locally without any API key)
 */

import { extractTranscriptMetadata, TranscriptMetadata } from './bookings-transcript-matcher';
import { callGemini } from './gemini-client';

export interface RubricBreakdown {
  need: number;          // 1 - 3
  budget: number;        // 0 - 3
  timeline: number;      // 0 - 2
  decisionMaker: number; // 0 - 2
  engagementBonus: number; // 0 or 1
  totalScore: number;    // 1 - 10
}

export interface CallAnalysisResult {
  score: number;
  durationMinutes: number;
  candidateTalkPct: number;
  rubricBreakdown: RubricBreakdown;
  summary: string;
  customerExperience: string;
  clientNeed: string;
  budget: string;
  timeline: string;
  decisionMaker: string;
  objections: string;
  counterPitch: string;
  verbatimQuotes: {
    need?: string;
    budget?: string;
    timeline?: string;
  };
  hasRedFlag: boolean;
  redFlagReason: string | null;
  whatsappDraft: string;
  nextAction: string;
  followUpDate: string;
  candidateName: string;
}

/**
 * Calculates candidate talk-time percentage based on transcript dialogue lines
 */
export function calculateTalkTime(rawTranscript: string, candidateName: string): { candidateTalkPct: number; durationMinutes: number } {
  const meta = extractTranscriptMetadata(rawTranscript);
  const targetName = (candidateName || meta.customerName || '').toLowerCase().trim();

  const lines = meta.dialogueText.split('\n');
  let candidateWords = 0;
  let hostWords = 0;
  let currentSpeaker: 'candidate' | 'host' = 'host';

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Speaker change lines often have name or timestamp, e.g. "Arul Xavier 01:23" or "Candidate Name:"
    const lower = trimmed.toLowerCase();
    if (targetName && lower.includes(targetName)) {
      currentSpeaker = 'candidate';
      continue;
    } else if (
      lower.includes('gapanchor') ||
      lower.includes('arul') ||
      lower.includes('host') ||
      lower.includes('trainer') ||
      lower.includes('admin')
    ) {
      currentSpeaker = 'host';
      continue;
    }

    const wordCount = trimmed.split(/\s+/).length;
    if (currentSpeaker === 'candidate') {
      candidateWords += wordCount;
    } else {
      hostWords += wordCount;
    }
  }

  const totalWords = candidateWords + hostWords;
  let candidateTalkPct = 50; // default balance
  if (totalWords > 20) {
    candidateTalkPct = Math.min(95, Math.max(5, Math.round((candidateWords / totalWords) * 100)));
  }

  return {
    candidateTalkPct,
    durationMinutes: meta.durationMinutes || 15,
  };
}

/**
 * Deterministic Fallback Analyzer (Zero API keys required)
 * Uses keyword matching and regex heuristics to generate structured scores
 */
export function analyzeTranscriptDeterministically(
  rawTranscript: string,
  candidateName?: string
): CallAnalysisResult {
  const meta = extractTranscriptMetadata(rawTranscript);
  const resolvedName = candidateName || meta.customerName || 'Candidate';
  const { candidateTalkPct, durationMinutes } = calculateTalkTime(rawTranscript, resolvedName);

  const lower = rawTranscript.toLowerCase();

  // 1. Need Level (1 - 3)
  let need = 2; // Medium default
  let needDesc = 'Interested in supply chain domain training';
  if (lower.includes('urgent') || lower.includes('project cutover') || lower.includes('joined a new project') || lower.includes('client requirement') || lower.includes('switch job')) {
    need = 3;
    needDesc = 'High Need: Active cutover or immediate role transition requiring hands-on proficiency.';
  } else if (lower.includes('just exploring') || lower.includes('curious') || lower.includes('future maybe')) {
    need = 1;
    needDesc = 'Low Need: General inquiry or exploratory research.';
  }

  // 2. Budget (0 - 3)
  let budget = 2; // Medium default
  let budgetDesc = 'Standard fee discussion (₹35k - ₹45k range)';
  if (lower.includes('company will reimburse') || lower.includes('employer approved') || lower.includes('budget is fine') || lower.includes('50,000') || lower.includes('50000') || lower.includes('ready to pay')) {
    budget = 3;
    budgetDesc = 'Confirmed High: Self-funded or employer-approved enterprise budget.';
  } else if (lower.includes('free') || lower.includes('too expensive') || lower.includes('cannot afford') || lower.includes('discount')) {
    budget = 1;
    budgetDesc = 'Budget Constrained: Seeking discounts or free materials.';
  }

  // 3. Timeline (0 - 2)
  let timeline = 1; // <30 days default
  let timelineDesc = 'Upcoming month batch enrollment';
  if (lower.includes('immediate') || lower.includes('next week') || lower.includes('this weekend') || lower.includes('asap') || lower.includes('right away')) {
    timeline = 2;
    timelineDesc = 'Immediate: Target start within 7 to 14 days.';
  } else if (lower.includes('next year') || lower.includes('after 3 months') || lower.includes('not sure')) {
    timeline = 0;
    timelineDesc = 'Long Term: 2+ months out.';
  }

  // 4. Decision Maker (0 - 2)
  let decisionMaker = 2;
  let dmDesc = 'Self-financing / direct decision maker';
  if (lower.includes('need to ask my parents') || lower.includes('check with friend') || lower.includes('college student')) {
    decisionMaker = 1;
    dmDesc = 'Influenced: Dependent on third-party approval.';
  }

  // 5. Engagement Bonus
  const engagementBonus = candidateTalkPct >= 55 ? 1 : 0;

  // Total Rubric Score (1 to 10)
  const totalScore = Math.min(10, Math.max(1, need + budget + timeline + decisionMaker + engagementBonus));

  // Red Flag Check
  let hasRedFlag = false;
  let redFlagReason: string | null = null;
  if (lower.includes('proxy interview') || lower.includes('fake experience') || lower.includes('cheat') || lower.includes('exam proxy')) {
    hasRedFlag = true;
    redFlagReason = 'Candidate inquired about unethical job support or interview proxying.';
  } else if (lower.includes('guarantee job') || lower.includes('100% placement only')) {
    hasRedFlag = true;
    redFlagReason = 'Expects 100% job placement guarantee without commitment to practice.';
  }

  // Course Identification
  let topic = 'Manhattan Active WMS';
  if (lower.includes('blue yonder') || lower.includes('jda')) topic = 'Blue Yonder WMS';
  else if (lower.includes('kinaxis') || lower.includes('rapidresponse')) topic = 'Kinaxis RapidResponse';
  else if (lower.includes('sap') || lower.includes('s/4hana')) topic = 'SAP S/4HANA Supply Chain';

  // Objection Counter-Pitch (Sales Battlecard)
  let objections = 'Sandbox access, live mentorship availability, and weekend batch schedule.';
  let counterPitch = `Highlight GapAnchor's 24/7 dedicated ${topic} cloud sandbox instances, direct real-time mentorship by Arul Xavier, and practical supply chain configuration blueprints.`;

  if (lower.includes('sandbox') || lower.includes('instance') || lower.includes('system access')) {
    objections = 'Availability and stability of hands-on cloud sandbox instances.';
    counterPitch = 'Clarify that each participant receives their own dedicated sandbox access with live configuration data, not shared demo recordings.';
  } else if (lower.includes('timing') || lower.includes('weekend') || lower.includes('busy')) {
    objections = 'Time conflict with current working hours.';
    counterPitch = 'Present the weekend flexible cohort (Saturday & Sunday mornings IST / US evenings) with all sessions recorded in high-definition.';
  }

  // Follow-up Date (Default 24 hours from now)
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(11, 0, 0, 0);

  const whatsappDraft = `Hi ${resolvedName}, thank you for taking the time to speak today! Sharing the ${topic} syllabus, live sandbox access details, and upcoming batch schedule. Let me know if you have any questions before we reserve your seat. — GapAnchor Team`;

  const leadTemp = totalScore >= 7 ? 'Hot' : totalScore >= 4 ? 'Warm' : 'Cool';
  const crmStatus = totalScore >= 4 ? 'Interested – Follow-up Required' : 'Evaluating – Pipeline';

  const customerExperience = `Call Summary – ${resolvedName} | GapAnchor Consulting

Purpose: Career guidance and training enquiry regarding ${topic}.

1. Lead Background
• ${resolvedName} connected with GapAnchor to explore specialized training in ${topic}.
• Evaluating career prospects, practical market requirements, and hands-on skill development.
• Focus is on functional workflows and real-world system implementations.

2. Career Guidance Provided
• Recommended ${topic} as a strategic career path given expanding enterprise adoption.
• Highlighted that functional WMS/SCM consultant roles bridge operational business workflows and systems, not pure coding.
• Advised reviewing career prospects, hands-on practice bandwidth, and personal suitability before enrolling.
• Emphasized real-world sandbox instance practice over passive video sessions.

3. Training Options Discussed
• Offered live walkthrough demo with trainer to preview the full syllabus, live instances, and implementation scenarios.
• Offered access to intermediate and advanced batch demo recordings to review live class dynamics and user interface.
• Agreed to share detailed syllabus and batch cohort timing.
• Recommended thorough hands-on evaluation of the curriculum before finalizing enrollment.

4. Customer Response
• ${resolvedName} acknowledged the guidance and agreed to review the information.
• Currently evaluating schedule alignment and enrollment decision.
• Follow-up scheduled via WhatsApp to share curriculum and answer pending queries.

5. Next Actions
Action Item\tStatus
Share ${topic} training details\tPending
Share intermediate and advanced demo sessions\tPending
Follow up with ${resolvedName} via WhatsApp\tPending
Arrange a trainer-led demo if interested\tAwaiting confirmation

CRM Lead Status
Status: ${crmStatus}
Lead Temperature: ${leadTemp}
Next Step: Send the course details and demo information via WhatsApp, then follow up to understand preferences and answer questions.

Overall outcome: Consultative guidance provided to ${resolvedName} regarding ${topic}. Advised to review training modules and sandbox walkthrough before confirming cohort seat.`;

  return {
    score: totalScore,
    durationMinutes,
    candidateTalkPct,
    rubricBreakdown: {
      need,
      budget,
      timeline,
      decisionMaker,
      engagementBonus,
      totalScore,
    },
    summary: `Spoke with ${resolvedName} regarding ${topic} enterprise training. Need evaluated at ${need}/3, budget at ${budget}/3, and timeline at ${timeline}/2. Candidate accounted for ${candidateTalkPct}% of call dialogue.`,
    customerExperience,
    clientNeed: `${topic} Training & Hands-On Sandbox`,
    budget: budgetDesc,
    timeline: timelineDesc,
    decisionMaker: dmDesc,
    objections,
    counterPitch,
    verbatimQuotes: {
      need: `Candidate indicated interest in hands-on ${topic} implementation training.`,
      budget: budgetDesc,
      timeline: timelineDesc,
    },
    hasRedFlag,
    redFlagReason,
    whatsappDraft,
    nextAction: `Follow up via WhatsApp with ${topic} curriculum and batch schedule.`,
    followUpDate: tomorrow.toISOString(),
    candidateName: resolvedName,
  };
}

/**
 * Main Analysis Entry Point:
 * Uses Google Gemini AI via callGemini;
 * Otherwise falls back to deterministic engine.
 */
export async function analyzeTranscript(
  rawTranscript: string,
  candidateName?: string
): Promise<CallAnalysisResult> {
  const meta = extractTranscriptMetadata(rawTranscript);
  const resolvedName = candidateName || meta.customerName || 'Candidate';
  const { candidateTalkPct, durationMinutes } = calculateTalkTime(rawTranscript, resolvedName);

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_KEY;

  if (!apiKey) {
    // Graceful offline deterministic fallback
    return analyzeTranscriptDeterministically(rawTranscript, resolvedName);
  }

  const systemPrompt = `You are the Lead Call Intelligence AI for GapAnchor Consulting (enterprise supply chain technology training in Manhattan Active WMS, Manhattan ProActive, Blue Yonder WMS, Kinaxis, and SAP S/4HANA).
Analyze the following real call transcript with candidate "${resolvedName}".

Extract genuine qualitative signals and output ONLY a valid JSON object matching this schema:
{
  "needScore": 1-3 (3: active project/urgent job switch, 2: skill upgrade, 1: casual inquiry),
  "budgetScore": 0-3 (3: confirmed budget/employer funded, 2: open to discussion/installments, 1: looking for discount, 0: unwilling/free only),
  "timelineScore": 0-2 (2: immediate/within 14 days, 1: within 30 days, 0: vague/future),
  "decisionMakerScore": 0-2 (2: direct self-payer, 1: needs third-party approval, 0: not authorized),
  "summary": "2-3 sentence executive sales summary of what actually happened and was discussed on this call",
  "clientNeed": "Specific domain requirement discussed on the call (e.g. Manhattan Active & ProActive WMS Hands-On Configuration)",
  "budget": "Candidate's budget capacity, quoted fee, discounts, or installment requests discussed",
  "timeline": "Candidate's expected start date, cohort timing, or urgency discussed",
  "decisionMaker": "Decision maker status",
  "objections": "Main concerns, process knowledge gaps, scheduling, or hesitation discussed",
  "counterPitch": "Targeted sales counter-pitch / battlecard tailored to GapAnchor's strengths (24/7 sandbox instances, 24-30 live classes, direct mentorship by Arul Xavier/Sam)",
  "verbatimQuotes": {
    "need": "Exact quote from candidate about their requirement",
    "budget": "Exact quote from candidate about budget/fee/installment if discussed",
    "timeline": "Exact quote from candidate about start timeline or duration"
  },
  "hasRedFlag": true/false (true if asks for proxy interviews, unethical assistance, or unrealistic guarantees),
  "redFlagReason": "Reason if hasRedFlag is true, otherwise null",
  "whatsappDraft": "A warm, professional WhatsApp follow-up message ready to send with syllabus, fees, and next steps tailored to this specific conversation",
  "nextAction": "Actionable next step for sales agent",
  "customerExperience": "Comprehensive executive Call Summary matching this exact structure:
Call Summary – [Name] | GapAnchor Consulting

Purpose: [1-2 sentences on actual purpose]

1. Lead Background
[Actual background points from conversation]

2. Career Guidance Provided
[Actual guidance discussed regarding role, architecture, syllabus]

3. Training Options Discussed
[Actual options discussed on the call: batch timeline, sandbox access, live sessions, pricing/installments]

4. Customer Response
[Actual customer reactions, questions asked, intent]

5. Next Actions
Action Item\tStatus
[Items discussed on call with Pending / Awaiting confirmation]

CRM Lead Status
Status: [Status]
Lead Temperature: [Hot / Warm / Cool]
Next Step: [Next actionable step]

Overall outcome: [Comprehensive 1-2 sentence final summary]"
}

Transcript:
"""
${rawTranscript.slice(0, 45000)}
"""`;

  try {
    const res = await callGemini(systemPrompt, { jsonMode: true });
    const parsed = JSON.parse(res.text);

    const need = Math.min(3, Math.max(1, Number(parsed.needScore) || 2));
    const budget = Math.min(3, Math.max(0, Number(parsed.budgetScore) || 2));
    const timeline = Math.min(2, Math.max(0, Number(parsed.timelineScore) || 1));
    const decisionMaker = Math.min(2, Math.max(0, Number(parsed.decisionMakerScore) || 2));
    const engagementBonus = candidateTalkPct >= 55 ? 1 : 0;

    const totalScore = Math.min(10, Math.max(1, need + budget + timeline + decisionMaker + engagementBonus));

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(11, 0, 0, 0);

    return {
      score: totalScore,
      durationMinutes,
      candidateTalkPct,
      rubricBreakdown: {
        need,
        budget,
        timeline,
        decisionMaker,
        engagementBonus,
        totalScore,
      },
      summary: parsed.summary || `Call completed with ${resolvedName}.`,
      customerExperience: parsed.customerExperience || `Call Summary – ${resolvedName} | GapAnchor Consulting\n\nPurpose: Career guidance and training enquiry.\n\n1. Lead Background\n• ${resolvedName} connected with GapAnchor for career guidance.\n\n2. Career Guidance Provided\n• Advised on functional implementation pathways and industry expectations.\n\n3. Training Options Discussed\n• Live trainer walkthrough demo and cloud sandbox practice.\n\n4. Customer Response\n• Positive engagement, evaluating enrollment details.\n\n5. Next Actions\nAction Item\tStatus\nShare course curriculum\tPending\nFollow up via WhatsApp\tPending\n\nCRM Lead Status\nStatus: Interested – Follow-up Required\nLead Temperature: ${totalScore >= 7 ? 'Hot' : 'Warm'}\nNext Step: ${parsed.nextAction || 'Send course details via WhatsApp'}\n\nOverall outcome: ${parsed.summary || 'Consultative discussion completed.'}`,
      clientNeed: parsed.clientNeed || 'Supply Chain Enterprise Training',
      budget: parsed.budget || 'Fee standard',
      timeline: parsed.timeline || 'Upcoming batch',
      decisionMaker: parsed.decisionMaker || 'Direct',
      objections: parsed.objections || 'None recorded',
      counterPitch: parsed.counterPitch || 'Share GapAnchor 24/7 dedicated sandbox access demo.',
      verbatimQuotes: parsed.verbatimQuotes || {},
      hasRedFlag: Boolean(parsed.hasRedFlag),
      redFlagReason: parsed.hasRedFlag ? (parsed.redFlagReason || 'Red flag flagged') : null,
      whatsappDraft: parsed.whatsappDraft || `Hi ${resolvedName}, great connecting today! Sharing the details as discussed.`,
      nextAction: parsed.nextAction || 'Send curriculum overview.',
      followUpDate: tomorrow.toISOString(),
      candidateName: resolvedName,
    };
  } catch (error) {
    console.warn('[Gemini 1.5 Flash] Call failed, falling back to deterministic analyzer:', error);
    return analyzeTranscriptDeterministically(rawTranscript, resolvedName);
  }
}
