/**
 * GapAnchor Lead-Call Automation Pipeline
 * Transcript Parser, Engagement Math, Rubric Scorer & Payload Assembler
 */

export interface TranscriptSegment {
  speaker: string;
  text: string;
  startTimeSec: number;
  endTimeSec: number;
}

export interface CallIntelligenceOutput {
  candidateName: string;
  candidateEmail?: string;
  candidatePhone?: string;
  durationMinutes: number;
  candidateTalkPct: number;
  score: number;
  rubricBreakdown: {
    need: number;
    budget: number;
    timeline: number;
    decisionMaker: number;
    engagementBonus: number;
  };
  summary: string;
  clientNeed: string;
  budget: string;
  timeline: string;
  decisionMaker: string;
  objections: string;
  counterPitch: string;
  verbatimQuotes: Record<string, string>;
  hasRedFlag: boolean;
  redFlagReason: string | null;
  whatsappDraft: string;
  nextAction: string;
}

/**
 * Parses WebVTT / Teams transcripts into structured speaker segments
 */
export function parseVttTranscript(vttContent: string): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  const lines = vttContent.replace(/\r\n/g, '\n').split('\n');

  let currentSpeaker = '';
  let currentStart = 0;
  let currentEnd = 0;
  let currentText = '';

  const timeRegex = /(\d{2}):(\d{2}):(\d{2})(?:\.(\d{3}))?\s*-->\s*(\d{2}):(\d{2}):(\d{2})(?:\.(\d{3}))?/;
  const speakerRegex = /<v ([^>]+)>(.*?)<\/v>/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line === 'WEBVTT') continue;

    const timeMatch = line.match(timeRegex);
    if (timeMatch) {
      const h1 = parseInt(timeMatch[1], 10);
      const m1 = parseInt(timeMatch[2], 10);
      const s1 = parseInt(timeMatch[3], 10);
      currentStart = h1 * 3600 + m1 * 60 + s1;

      const h2 = parseInt(timeMatch[5], 10);
      const m2 = parseInt(timeMatch[6], 10);
      const s2 = parseInt(timeMatch[7], 10);
      currentEnd = h2 * 3600 + m2 * 60 + s2;
      continue;
    }

    const speakerMatch = line.match(speakerRegex);
    if (speakerMatch) {
      currentSpeaker = speakerMatch[1].trim();
      currentText = speakerMatch[2].trim();
      segments.push({
        speaker: currentSpeaker,
        text: currentText,
        startTimeSec: currentStart,
        endTimeSec: currentEnd,
      });
      continue;
    }

    // Standard "Speaker: Text" format
    if (line.includes(':')) {
      const parts = line.split(':');
      currentSpeaker = parts[0].trim();
      currentText = parts.slice(1).join(':').trim();
      segments.push({
        speaker: currentSpeaker,
        text: currentText,
        startTimeSec: currentStart,
        endTimeSec: currentEnd,
      });
    }
  }

  return segments;
}

/**
 * Computes call duration and candidate talk-time percentage
 */
export function computeTalkTimeMetrics(segments: TranscriptSegment[], hostName: string = 'Sam') {
  if (!segments || segments.length === 0) {
    return { durationMinutes: 0, candidateTalkPct: 50 };
  }

  const lastSegment = segments[segments.length - 1];
  const durationSeconds = lastSegment ? lastSegment.endTimeSec : 0;
  const durationMinutes = Math.max(1, Math.round(durationSeconds / 60));

  let hostTalkSeconds = 0;
  let candidateTalkSeconds = 0;

  for (const seg of segments) {
    const duration = Math.max(1, seg.endTimeSec - seg.startTimeSec);
    const speakerLower = seg.speaker.toLowerCase();
    const isHost = speakerLower.includes(hostName.toLowerCase()) || 
                   speakerLower.includes('host') ||
                   speakerLower.includes('gapanchor') ||
                   speakerLower.includes('ownership') ||
                   speakerLower.includes('moderator') ||
                   speakerLower.includes('sam');

    if (isHost) {
      hostTalkSeconds += duration;
    } else {
      candidateTalkSeconds += duration;
    }
  }

  const totalTalk = hostTalkSeconds + candidateTalkSeconds;
  const candidateTalkPct = totalTalk > 0 ? Math.round((candidateTalkSeconds / totalTalk) * 100) : 50;

  return { durationMinutes, candidateTalkPct };
}

/**
 * Deterministic Scoring Rubric: Need(0-3) + Budget(0-3) + Timeline(0-2) + DM(0-2) + EngagementBonus(0-1) = Score (1-10)
 */
export function calculateRubricScore(params: {
  needLevel: 'high' | 'med' | 'low';
  budgetLevel: 'high' | 'med' | 'unwilling';
  timelineLevel: 'immediate' | 'within30' | 'vague';
  decisionMaker: 'direct' | 'influencer' | 'student';
  candidateTalkPct: number;
}): { score: number; rubricBreakdown: any } {
  const needPoints = params.needLevel === 'high' ? 3 : params.needLevel === 'med' ? 2 : 1;
  const budgetPoints = params.budgetLevel === 'high' ? 3 : params.budgetLevel === 'med' ? 2 : 0;
  const timelinePoints = params.timelineLevel === 'immediate' ? 2 : params.timelineLevel === 'within30' ? 1 : 0;
  const dmPoints = params.decisionMaker === 'direct' ? 2 : 1;
  const engagementBonus = params.candidateTalkPct >= 55 ? 1 : 0;

  const rawScore = needPoints + budgetPoints + timelinePoints + dmPoints + engagementBonus;
  const finalScore = Math.min(10, Math.max(1, rawScore));

  return {
    score: finalScore,
    rubricBreakdown: {
      need: needPoints,
      budget: budgetPoints,
      timeline: timelinePoints,
      decisionMaker: dmPoints,
      engagementBonus,
    },
  };
}
