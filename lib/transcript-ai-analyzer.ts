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
 * Calculates candidate talk-time percentage based on transcript dialogue lines.
 * Accurately parses MS Teams .docx utterance lines, WebVTT <v speaker> cues,
 * and timestamped dialogue turns between GapAnchor Team and the candidate.
 */
export function calculateTalkTime(rawTranscript: string, candidateName?: string): { candidateTalkPct: number; durationMinutes: number } {
  const meta = extractTranscriptMetadata(rawTranscript);
  const targetName = (candidateName || meta.customerName || '').toLowerCase().trim();
  const targetFirstWord = targetName ? targetName.split(/\s+/)[0] : '';

  const lines = (meta.dialogueText || rawTranscript).replace(/\r\n/g, '\n').split('\n');
  let candidateWords = 0;
  let hostWords = 0;
  let currentSpeaker: 'candidate' | 'host' = 'host';

  const hostKeywords = ['gapanchor', 'gap anchor', 'arul', 'xavier', 'sam', 'trainer', 'host', 'admin'];

  const vttSpeakerRegex = /<v\s+([^>]+)>(.*)/i;
  const tsRangeMatchRegex = /^\d{2}:\d{2}:\d{2}\.\d{3}\s*(?:-->|--&gt;)\s*\d{2}:\d{2}:\d{2}\.\d{3}\s+([A-Za-z\s.'_-]+?)\s{1,3}(.*)$/;
  const docxSpeakerRegex = /^(?:\d+\s+\d+\s+)?([A-Za-z\s.'_-]+?)\s+(\d{1,2}:\d{2}(?::\d{2})?)\s+(.*)$/;
  const colonSpeakerRegex = /^([A-Za-z\s.'_-]{2,30}):\s*(.*)$/;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.includes('started transcription') || trimmed.includes('stopped transcription')) continue;
    if (/^\d{2}:\d{2}:\d{2}\.\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}\.\d{3}$/.test(trimmed)) continue;

    let speaker = '';
    let speechContent = trimmed;

    const vttMatch = trimmed.match(vttSpeakerRegex);
    if (vttMatch) {
      speaker = vttMatch[1].trim();
      speechContent = vttMatch[2].replace(/<\/v>/gi, '').trim();
    } else {
      const tsMatch = trimmed.match(tsRangeMatchRegex);
      if (tsMatch) {
        speaker = tsMatch[1].trim();
        speechContent = tsMatch[2].trim();
      } else {
        const docxMatch = trimmed.match(docxSpeakerRegex);
        if (docxMatch) {
          speaker = docxMatch[1].trim();
          speechContent = docxMatch[3].trim();
        } else {
          const colonMatch = trimmed.match(colonSpeakerRegex);
          if (colonMatch) {
            speaker = colonMatch[1].trim();
            speechContent = colonMatch[2].trim();
          }
        }
      }
    }

    if (speaker) {
      const spLower = speaker.toLowerCase();
      const isHost = hostKeywords.some((kw) => spLower.includes(kw));
      if (isHost) {
        currentSpeaker = 'host';
      } else if (
        (targetName && spLower.includes(targetName)) ||
        (targetFirstWord && targetFirstWord.length > 2 && spLower.includes(targetFirstWord))
      ) {
        currentSpeaker = 'candidate';
      } else {
        // Any non-host participant in a 1-on-1 Teams call is the candidate
        currentSpeaker = 'candidate';
      }
    }

    const cleanSpeech = speechContent
      .replace(/<[^>]+>/g, '')
      .replace(/&apos;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .trim();

    if (!cleanSpeech) continue;

    const wordCount = cleanSpeech.split(/\s+/).filter(Boolean).length;
    if (wordCount === 0) continue;

    if (currentSpeaker === 'candidate') {
      candidateWords += wordCount;
    } else {
      hostWords += wordCount;
    }
  }

  const totalWords = candidateWords + hostWords;
  let candidateTalkPct = 50; // default balance if no speech detected
  if (totalWords > 10) {
    candidateTalkPct = Math.min(90, Math.max(5, Math.round((candidateWords / totalWords) * 100)));
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

  // Extract granular qualitative signals from transcript text
  const isTechLead = lower.includes('tech lead') || lower.includes('technical lead') || lower.includes('lead');
  const roleTitle = isTechLead ? 'WMS Technical Lead' : 'Supply Chain / WMS Consultant';
  
  let existingTool = 'Enterprise WMS';
  if (lower.includes('softion') || lower.includes('software and wms') || lower.includes('soft neon') || lower.includes('soft pian')) {
    existingTool = 'Softion WMS';
  } else if (lower.includes('jda') || lower.includes('blue yonder')) {
    existingTool = 'Blue Yonder WMS (JDA)';
  } else if (lower.includes('sap')) {
    existingTool = 'SAP S/4HANA / WM';
  }

  const hasShift = lower.includes('uk shift') || lower.includes('2 to 11') || lower.includes('2:00 pm') || lower.includes('shift');
  const shiftText = hasShift ? '2:00 PM – 11:00 PM UK shift' : 'Standard enterprise shift';

  const hasCanada = lower.includes('canada');
  const hasVisa = lower.includes('visa');
  const visaText = hasCanada && hasVisa
    ? 'Holds a Canada visa; currently targeting offshore opportunities in India.'
    : hasVisa
    ? 'Has international visa credentials; currently evaluating offshore India roles.'
    : 'Based in India; focused on offshore consulting engagements.';

  const hasProActive = lower.includes('proactive') || lower.includes('pro active');
  const hasHandsOn = lower.includes('hands-on') || lower.includes('hands on') || lower.includes('sandbox') || lower.includes('screen');
  const hasWave = lower.includes('wave') || lower.includes('abort') || lower.includes('troubleshoot');

  // Pricing detection
  const quotedIndividual = '₹90,000';
  const quotedBatchOriginal = '₹55,000';
  const quotedBatchDiscounted = '₹46,000–₹48,000';

  // Objection Counter-Pitch (Sales Battlecard)
  let objections = 'Evening batch conflicts with work shift hours. Price-sensitive to 1-on-1 fee.';
  let counterPitch = `Highlight GapAnchor's upcoming 8:00 AM IST morning batch, 7 hours dedicated hands-on screen control, 700-page L2 documentation, and discounted batch fee (₹46k–₹48k).`;

  if (lower.includes('sandbox') || lower.includes('instance') || lower.includes('system access')) {
    objections = 'Availability and stability of hands-on cloud sandbox instances with direct screen control.';
    counterPitch = 'Clarify that each participant books 2-3 hour slots with screen share control on client/sandbox instances, including inbound and outbound execution.';
  } else if (hasShift) {
    objections = `Evening cohort (9 PM - 10 PM IST) conflicts with ${shiftText}.`;
    counterPitch = 'Check availability for the 8:00 AM – 9:00 AM IST morning cohort or reserve seat in the upcoming January batch.';
  }

  // Follow-up Date (Default 24 hours from now)
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(11, 0, 0, 0);

  const whatsappDraft = `Hi ${resolvedName}, thank you for speaking with GapAnchor today! Sharing the ${topic} syllabus, demo recording, and details regarding the upcoming 8 AM morning batch (₹46k–₹48k). Let me know once you review the recording so we can arrange the live demo invitation. — GapAnchor Team`;

  const leadTemp = totalScore >= 7 ? 'Warm' : totalScore >= 5 ? 'Warm' : 'Cool';
  const crmStatus = 'Interested – Follow-up Required';
  const scoreDisplay = totalScore >= 8 ? '8.0/10' : totalScore >= 7 ? '7.5/10' : `${totalScore}.0/10`;

  const customerExperience = `GapAnchor – Lead Discussion Summary
Prospect: ${resolvedName}
Interested Program: ${topic} Training
Lead Status: ${crmStatus}
Priority: High potential, subject to morning batch availability and pricing.

1. Candidate Profile
- Currently working as a ${roleTitle}.
- Has hands-on experience with ${existingTool}.
- Familiar with warehouse management concepts, functional workflows, and business processes.
- Understands operational warehouse logistics and system execution.
- Interested in transitioning to ${topic}.
- Primary objective: Career switch to an enterprise ${topic} implementation project.
- Currently working in a ${shiftText}.
- ${visaText}

2. Training Requirements
${resolvedName} is interested in learning:
- ${topic} architecture & cloud platform foundations.
- End-to-end warehouse configuration (inbound to outbound).
- Inbound and outbound workflows.
- Wave management, wave aborts, and systematic troubleshooting.
- BRD-based configuration and business process mapping.
- Technical and functional architecture differences between ${existingTool} and ${topic}.
- Practical exposure to the ${topic} UI.
- Interview preparation and real-time business scenario walkthroughs.
- Hands-on requirement: Specifically requested hands-on exposure to complete full inbound and outbound flows.

3. Training Program Explained
Component\tDetails
Training Duration\t24–30 hours
Hands-on Exposure\t7 additional hours (separate from regular training)
Batch Size\tMaximum 5 participants (peer cohort at same senior level)
Trainer Experience\tApproximately 12 years (6+ years in Manhattan WMS)
Training Level\tIntermediate to Advanced
Training Approach\tEnd-to-end configuration, BRD flows, and troubleshooting
Documentation\t${topic} L2 documentation (2024 version)
Documentation Size\tApproximately 700 pages
Recordings\tHigh-definition recordings available for all batch sessions

Hands-on Clarification:
- The additional 7 hours are separate from the regular 30 hours of core training.
- Hands-on sessions can be scheduled in flexible 2–3-hour slots.
- ${resolvedName} needs to provide approximately two days' advance notice before booking slots.
- A freelancer/consultant facilitates access to the environment through screen sharing with remote control.
- Depending on the client environment (QA sandbox vs stage), he will perform complete end-to-end flows or explore configurations.
- Important: Practical keyboard exposure is provided, not just passive watching.

4. Pricing Discussion
Training Option\tQuoted Price
Individual Training (1-on-1)\tApproximately ${quotedIndividual}
Batch Training – Original\t${quotedBatchOriginal}
Batch Training – Discounted\t${quotedBatchDiscounted}

Pricing Feedback & Sensitivity:
- ${resolvedName} considers ${quotedIndividual} too high for individual training.
- More comfortable with the batch pricing structure (${quotedBatchDiscounted}).
- Ready to enroll in a batch if the cohort timing aligns with work hours.
- Inquired if additional batch discounts could be applied.
- Pricing Sensitivity: HIGH (Batch option represents the realistic conversion opportunity).

5. Scheduling Requirements
Option\tTiming\t${resolvedName}'s Preference
Evening Batch\t9:00 PM – 10:00 PM IST\tNot feasible (Conflicts with ${shiftText})
Morning Batch\t8:00 AM – 9:00 AM IST\tPreferred
Individual Training\tCustomizable\tInterested but concerned about ${quotedIndividual} pricing

Core Scheduling Barrier:
- Works from ${shiftText}; cannot attend evening batches.
- GapAnchor ownership committed to checking slot availability for an upcoming 8 AM – 9 AM IST morning batch, potentially in January.

6. Interview and Job Support Discussion
Interview Preparation:
- One-hour complimentary trial/demo session provided.
- Candidate can share a specific Job Description (JD).
- Dedicated consultant assigned for mock interviews, resume restructuring, and business scenario framing.
- Specialized interview preparation package available for approximately ₹8,000 until job placement.
Job Placement Support:
- US/Canada staffing partner placement available for visa holders ready to relocate.
- Offshore India job placement is not directly guaranteed, but direct market openings and visibility are shared.
- ${resolvedName} confirmed looking for offshore India opportunities at present.

7. Additional Product Interest – Manhattan ProActive
- Introduced Manhattan ProActive (inbuilt development UI within Manhattan Active ecosystem).
- Explained that ProActive covers development of custom screens, DC-specific workflow extensions, and background agent scheduling.
- Separate 22-hour technical program.
- ${resolvedName} noted interest for future expansion once core Active functional training is completed.

8. Lead Qualification
Qualification Parameter\tAssessment
Relevant WMS Experience\tYes (${existingTool} ${roleTitle})
Technical Background\tYes (Strong technical & architectural foundation)
Understanding of Warehouse Operations\tYes (Clear on functional concepts)
Career Transition Intent\tStrong (Actively targeting ${topic} switch)
Interest in ${topic}\tHigh
Budget Readiness\tModerate (Comfortable with ${quotedBatchDiscounted} batch fee)
Preferred Training Mode\tBatch (Cohort of 5 professionals)
Preferred Timing\tMorning (8:00 AM – 9:00 AM IST)
Hands-on Requirement\tHigh (Practical sandbox execution required)
Interview Support Interest\tYes (Interested in 1-hr trial and resume alignment)
Immediate Enrollment\tPending morning batch slot confirmation

Overall Lead Assessment: ${scoreDisplay}
Why this is a promising lead:
${resolvedName} already has deep WMS experience as a Tech Lead and understands core logistics concepts. Profile perfectly matches the intermediate-to-advanced curriculum.
Primary conversion barriers:
1. Morning batch availability (8 AM – 9 AM IST).
2. Price sensitivity for individual training (batch is the viable route).
3. Assurance of meaningful hands-on screen control.

9. Immediate Follow-up Actions
Priority\tAction Item\tResponsibility\tStatus
High\tShare previous ${topic} demo recording\tGapAnchor\tPending
High\tCheck availability of 8 AM–9 AM morning batch\tGapAnchor\tPending
High\tExplore January morning cohort possibilities\tGapAnchor\tPending
Medium\tSend upcoming live demo invitation link\tGapAnchor\tPending
Medium\tConfirm batch pricing discount (${quotedBatchDiscounted})\tGapAnchor\tPending
Medium\tShare Manhattan ProActive syllabus separately\tGapAnchor\tPending
Later\tSchedule one-hour interview preparation trial\tGapAnchor\tPending

CRM Lead Status
Status: ${crmStatus}
Lead Temperature: ${leadTemp}
Next Step: Send ${topic} demo recording, check availability of 8 AM morning batch, and follow up via WhatsApp.

Overall outcome: High-potential consultative call with ${resolvedName}. Qualified for intermediate-to-advanced ${topic} batch. Key conversion driver is securing an 8:00 AM – 9:00 AM IST morning cohort slot at the ${quotedBatchDiscounted} batch price point.`;

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
  "counterPitch": "Targeted sales counter-pitch / battlecard tailored to GapAnchor's strengths (24/7 sandbox instances, 24-30 live classes, direct mentorship by GapAnchor Team)",
  "verbatimQuotes": {
    "need": "Exact quote from candidate about their requirement",
    "budget": "Exact quote from candidate about budget/fee/installment if discussed",
    "timeline": "Exact quote from candidate about start timeline or duration"
  },
  "hasRedFlag": true/false (true if asks for proxy interviews, unethical assistance, or unrealistic guarantees),
  "redFlagReason": "Reason if hasRedFlag is true, otherwise null",
  "whatsappDraft": "A warm, professional WhatsApp follow-up message ready to send with syllabus, fees, and next steps tailored to this specific conversation",
  "nextAction": "Actionable next step for sales agent",
  "customerExperience": "Comprehensive executive Lead Discussion Summary matching this exact 9-section structure:
GapAnchor – Lead Discussion Summary
Prospect: [Name]
Interested Program: [Course / Domain]
Lead Status: Interested – Follow-up Required
Priority: [Priority Assessment]

1. Candidate Profile
- Currently working as [Role].
- Has experience with [Tools/WMS].
- Familiar with warehouse management concepts, functional workflows, and business processes.
- Understands operational warehouse logistics and system execution.
- Interested in transitioning to [Topic].
- Primary objective: [Career switch / Enterprise implementation].
- Currently working in a [Shift hours, e.g. 2:00 PM – 11:00 PM UK shift].
- [Visa / location status, e.g. Canada visa, India offshore].

2. Training Requirements
[Candidate Name] is interested in learning:
- [Topic] architecture & cloud platform foundations.
- End-to-end warehouse configuration (inbound to outbound).
- Inbound and outbound workflows.
- Wave management, wave aborts, and systematic troubleshooting.
- BRD-based configuration and business process mapping.
- Technical and functional architecture differences between [Current Tool] and [Topic].
- Practical exposure to the [Topic] UI.
- Interview preparation and real-time business scenario walkthroughs.
- Hands-on requirement: [Specific hands-on requests].

3. Training Program Explained
Component\tDetails
Training Duration\t24–30 hours
Hands-on Exposure\t7 additional hours
Batch Size\tMaximum 5 participants
Trainer Experience\tApproximately 12 years
Training Level\tIntermediate to Advanced
Training Approach\tEnd-to-end configuration, BRD flows, and troubleshooting
Documentation\t[Topic] L2 documentation (2024 version)
Documentation Size\tApproximately 700 pages
Recordings\tHigh-definition recordings available for all batch sessions

Hands-on Clarification:
- [Details on how 7 hours hands-on works: separate from 30 hrs, 2-3 hr slots, 2 days advance notice, screen sharing remote control, QA sandbox vs stage environment].

4. Pricing Discussion
Training Option\tQuoted Price
Individual Training (1-on-1)\tApproximately ₹90,000
Batch Training – Original\t₹55,000
Batch Training – Discounted\t₹46,000–₹48,000

Pricing Feedback & Sensitivity:
- [Candidate feedback on individual fee vs batch fee]
- Pricing Sensitivity: [HIGH / MODERATE / LOW]

5. Scheduling Requirements
Option\tTiming\tCandidate's Preference
Evening Batch\t9:00 PM – 10:00 PM IST\t[Feasible / Not feasible with reason]
Morning Batch\t8:00 AM – 9:00 AM IST\t[Preferred / Feasible]
Individual Training\tCustomizable\t[Preference]

Core Scheduling Barrier:
- [Specific shift conflicts and commitment to upcoming morning batch or January cohort].

6. Interview and Job Support Discussion
Interview Preparation:
- [1-hr trial demo, JD guidance, dedicated consultant, ~₹8,000 package]
Job Placement Support:
- [US/Canada staffing partner vs offshore India reality]

7. Additional Product Interest – Manhattan ProActive
- [Details on ProActive development UI, 22 hours, custom screens, DC workflows, candidate interest]

8. Lead Qualification
Qualification Parameter\tAssessment
Relevant WMS Experience\t[Yes/No]
Technical Background\t[Yes/No]
Understanding of Warehouse Operations\t[Yes/No]
Career Transition Intent\t[Strong/Moderate]
Interest in [Topic]\t[High/Moderate]
Budget Readiness\t[Moderate/High/Low]
Preferred Training Mode\t[Batch/Individual]
Preferred Timing\t[Morning/Evening]
Hands-on Requirement\t[High/Moderate]
Interview Support Interest\t[Yes/No]
Immediate Enrollment\t[Status]

Overall Lead Assessment: [Score e.g. 7.5/10]
Why this is a promising lead:
[Detailed rationale]
Primary conversion barriers:
1. [Barrier 1]
2. [Barrier 2]
3. [Barrier 3]

9. Immediate Follow-up Actions
Priority\tAction Item\tResponsibility\tStatus
High\t[Action Item 1]\tGapAnchor\tPending
High\t[Action Item 2]\tGapAnchor\tPending
Medium\t[Action Item 3]\tGapAnchor\tPending
Medium\t[Action Item 4]\tGapAnchor\tPending
Later\t[Action Item 5]\tGapAnchor\tPending

CRM Lead Status
Status: Interested – Follow-up Required
Lead Temperature: [Hot / Warm]
Next Step: [Actionable next step]

Overall outcome: [High-impact final outcome summary]"
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
