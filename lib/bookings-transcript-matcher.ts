/**
 * GapAnchor Lead-Call Automation Pipeline
 * Microsoft Bookings & Teams Transcript Matcher
 * 
 * Matches candidate name & time from Teams Transcripts with Microsoft Bookings
 * to retrieve verified customer email and phone number.
 */

export interface TranscriptMetadata {
  rawTitle: string;
  customerName: string;
  meetingDateText: string;
  meetingDate?: Date;
  durationText: string;
  durationMinutes: number;
  bodyText: string;
  dialogueText: string;
}

export interface BookingAppointment {
  id: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  serviceName?: string;
  startDateTime: string;
  endDateTime: string;
  joinWebUrl?: string; // Teams Meeting Link
}

const GENERIC_NAMES = new Set([
  'transcript',
  'meeting',
  'recording',
  'call',
  'session',
  'unknown',
  'candidate',
  'webvtt',
  'speaker',
  'user',
  'guest',
  'none',
  'null',
  'undefined',
  'gapanchor',
]);

/**
 * Extracts candidate speaker name directly from dialogue text or WEBVTT speaker cues
 * e.g. "<v Akhilesh  Rana>" or "00:00:58.543 --> 00:00:59.183 joel Hello."
 */
export function extractSpeakerFromTranscript(text: string): string | null {
  const isHostSpeaker = (name: string) => {
    const n = name.toLowerCase().trim();
    return (
      n.includes('gapanchor') ||
      n.includes('arul') ||
      n.includes('sam') ||
      n.includes('host') ||
      n.includes('admin') ||
      n.includes('trainer') ||
      n.includes('ownership') ||
      GENERIC_NAMES.has(n)
    );
  };

  // 1. WEBVTT speaker tags: <v Speaker Name>
  const vttRegex = /<v\s+([^>]+)>/gi;
  let vttMatch: RegExpExecArray | null;
  while ((vttMatch = vttRegex.exec(text)) !== null) {
    const rawSpeaker = vttMatch[1].trim();
    if (rawSpeaker && !isHostSpeaker(rawSpeaker)) {
      return rawSpeaker.replace(/\s+/g, ' ');
    }
  }

  // 2. Docx timestamp-prefixed speaker patterns:
  // e.g. "00:00:58.543 --> 00:00:59.183 joel Hello." or "--&gt;"
  const docxRegex = /\d{2}:\d{2}:\d{2}[\.,]\d{3}\s*(?:-->|--&gt;)\s*\d{2}:\d{2}:\d{2}[\.,]\d{3}\s+([^:\r\n<]+?)(?:\s+[A-Z0-9]|\s*:)/gi;
  let docxMatch: RegExpExecArray | null;
  while ((docxMatch = docxRegex.exec(text)) !== null) {
    const rawSpeaker = docxMatch[1].trim();
    if (rawSpeaker && rawSpeaker.length >= 2 && !isHostSpeaker(rawSpeaker)) {
      return rawSpeaker
        .replace(/\s+/g, ' ')
        .split(' ')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
    }
  }

  // 3. Standard "Speaker Name: text" format
  const colonRegex = /^([A-Za-z\s]{2,30}):\s+/gm;
  let colonMatch: RegExpExecArray | null;
  while ((colonMatch = colonRegex.exec(text)) !== null) {
    const rawSpeaker = colonMatch[1].trim();
    if (rawSpeaker && !isHostSpeaker(rawSpeaker)) {
      return rawSpeaker.replace(/\s+/g, ' ');
    }
  }

  return null;
}

/**
 * Extracts candidate name, date, and duration from Teams transcript header
 * e.g. "IT support _ Training - Shorya Garg-20261018_065728-Meeting Transcript"
 */
export function extractTranscriptMetadata(rawTranscript: string, fallbackFileName?: string): TranscriptMetadata {
  const lines = rawTranscript.replace(/\r\n/g, '\n').split('\n').map(l => l.trim()).filter(Boolean);

  const titleLine = lines[0] || '';
  const dateLine = lines[1] || '';
  const durationLine = lines[2] || '';

  // 1. Extract customer name from title line
  let customerName = 'Unknown Candidate';

  const titleMatch = titleLine.match(/(?:IT support\s*[_&]\s*Training|Training|Session|Meeting)\s*-\s*([^-]+?)(?:-\d{8}_\d{6})?(?:-Meeting Transcript)?$/i);
  if (titleMatch && titleMatch[1]) {
    customerName = titleMatch[1].trim();
  } else if (titleLine.includes('-') && !titleLine.startsWith('WEBVTT')) {
    // Fallback: split by "-"
    const parts = titleLine.split('-');
    if (parts.length >= 2) {
      const extracted = parts[1].replace(/_\d+/g, '').replace(/Meeting Transcript/gi, '').trim();
      if (extracted) customerName = extracted;
    }
  }

  // 1b. If customerName is generic or unknown, extract candidate speaker from dialogue text
  if (customerName === 'Unknown Candidate' || !customerName || GENERIC_NAMES.has(customerName.toLowerCase())) {
    const speakerFromDialogue = extractSpeakerFromTranscript(rawTranscript);
    if (speakerFromDialogue) {
      customerName = speakerFromDialogue;
    }
  }

  // 1c. Fallback to filename ONLY if it is not generic and dialogue didn't yield a name
  if ((customerName === 'Unknown Candidate' || !customerName || GENERIC_NAMES.has(customerName.toLowerCase())) && fallbackFileName) {
    const cleaned = fallbackFileName
      .replace(/\.(docx|vtt|txt)$/i, '')
      .replace(/^(?:IT support\s*[_&]\s*Training|Training|Session|Meeting)\s*-\s*/i, '')
      .replace(/-\d{8}_\d{6}.*$/, '')
      .replace(/-Meeting Transcript.*$/i, '')
      .replace(/_\d+/g, '')
      .trim();
    const isGenericFile = /^(?:transcript|meeting|recording|call|session|webvtt|audio|video)(\s*\(\d+\)|\s*_\d+)?$/i.test(cleaned);
    if (cleaned && cleaned.length > 1 && !isGenericFile && !GENERIC_NAMES.has(cleaned.toLowerCase())) {
      customerName = cleaned;
    }
  }

  // 2. Parse Duration (e.g. "1m 24s" or "24m 10s" or "01:24")
  let durationMinutes = 1;
  const minMatch = durationLine.match(/(\d+)\s*m/i);
  if (minMatch) {
    durationMinutes = Math.max(1, parseInt(minMatch[1], 10));
  }

  // 3. Extract Dialogue Text (excluding start/stop markers)
  const dialogueLines = lines.slice(3).filter(line => 
    !line.includes('started transcription') && 
    !line.includes('stopped transcription')
  );

  return {
    rawTitle: titleLine,
    customerName,
    meetingDateText: dateLine,
    meetingDate: dateLine ? new Date(dateLine) : undefined,
    durationText: durationLine,
    durationMinutes,
    bodyText: rawTranscript,
    dialogueText: dialogueLines.join('\n'),
  };
}

/**
 * Matches a transcript with Microsoft Bookings appointments
 * 1. Checks Teams join URL / Meeting ID
 * 2. Checks Customer Name + Appointment Date within +/- 24 hours
 */
export function matchBookingToTranscript(
  transcriptMeta: TranscriptMetadata,
  appointments: BookingAppointment[]
): BookingAppointment | null {
  if (!appointments || appointments.length === 0) return null;

  const targetName = transcriptMeta.customerName.toLowerCase().trim();

  // Primary match: exact or fuzzy name match
  for (const appt of appointments) {
    const apptName = (appt.customerName || '').toLowerCase().trim();
    if (apptName && (apptName.includes(targetName) || targetName.includes(apptName))) {
      return appt;
    }
  }

  return null;
}

/**
 * Assembles the enriched Server B JSON payload with Bookings metadata heading
 */
export function assembleEnrichedPayload(
  transcriptMeta: TranscriptMetadata,
  booking: BookingAppointment | null,
  aiAnalysis: {
    score: number;
    summary: string;
    clientNeed?: string;
    budget?: string;
    timeline?: string;
    decisionMaker?: string;
    objections?: string;
    counterPitch?: string;
    verbatimQuotes?: Record<string, string>;
    whatsappDraft?: string;
    hasRedFlag?: boolean;
    redFlagReason?: string | null;
  }
) {
  const candidateEmail = booking?.customerEmail || null;
  const candidatePhone = booking?.customerPhone || null;
  const candidateName = booking?.customerName || transcriptMeta.customerName;

  return {
    candidateEmail,
    candidatePhone,
    candidateName,
    durationMinutes: transcriptMeta.durationMinutes,
    candidateTalkPct: 60,
    score: aiAnalysis.score,
    summary: aiAnalysis.summary,
    clientNeed: aiAnalysis.clientNeed || 'IT support & Training',
    budget: aiAnalysis.budget || 'In evaluation',
    timeline: aiAnalysis.timeline || 'Flexible',
    decisionMaker: aiAnalysis.decisionMaker || 'Self',
    objections: aiAnalysis.objections || null,
    counterPitch: aiAnalysis.counterPitch || null,
    verbatimQuotes: aiAnalysis.verbatimQuotes || {},
    hasRedFlag: Boolean(aiAnalysis.hasRedFlag),
    redFlagReason: aiAnalysis.redFlagReason || null,
    whatsappDraft: aiAnalysis.whatsappDraft || `Hi ${candidateName}, thank you for speaking with GapAnchor today! Sharing the syllabus and program details as discussed.`,
    teamsMeetingId: booking?.id || transcriptMeta.rawTitle,
  };
}

export interface CalendarMatchResult {
  candidateEmail?: string;
  candidateName?: string;
  candidatePhone?: string;
  eventId?: string;
  joinUrl?: string;
  matchedSubject?: string;
}

/**
 * Matches a transcript with Microsoft Outlook/Teams Calendar Events
 * Retrieves the attendee's verified email and name from the calendar event.
 */
export function matchCalendarEventToTranscript(
  meta: TranscriptMetadata,
  calendarEvents: any[]
): CalendarMatchResult | null {
  if (!calendarEvents || calendarEvents.length === 0) return null;

  const candNameLower = (meta.customerName || '').toLowerCase().trim();
  const rawTitleLower = (meta.rawTitle || '').toLowerCase().trim();
  const firstName = candNameLower.split(/\s+/)[0];

  for (const event of calendarEvents) {
    const subj = (event.subject || '').toLowerCase().trim();
    if (!subj) continue;

    // Check if subject matches or contains candidate name or rawTitle contains subject
    const matchesFullName = candNameLower && candNameLower !== 'unknown candidate' && (subj.includes(candNameLower) || rawTitleLower.includes(subj));
    const matchesFirstName = firstName && firstName.length >= 3 && subj.includes(firstName);

    if (matchesFullName || matchesFirstName) {
      const attendees = event.attendees || [];
      const externalAttendee = attendees.find((a: any) => {
        const addr = (a.emailAddress?.address || '').toLowerCase();
        return (
          addr &&
          !addr.endsWith('@gapanchor.com') &&
          !addr.includes('gapanchortraining') &&
          !addr.includes('avpartners')
        );
      });

      if (externalAttendee?.emailAddress?.address) {
        return {
          candidateEmail: externalAttendee.emailAddress.address.toLowerCase().trim(),
          candidateName: externalAttendee.emailAddress.name?.trim() || meta.customerName,
          eventId: event.id,
          joinUrl: event.onlineMeeting?.joinUrl,
          matchedSubject: event.subject,
        };
      }
    }
  }

  return null;
}

export interface ResolveEnquiryResult {
  enquiry: any | null;
  resolvedEmail?: string;
  resolvedPhone?: string;
  resolvedName?: string;
  matchedBy: 'direct_id' | 'direct_email' | 'direct_phone' | 'calendar_attendee' | 'email_prefix' | 'first_name_proximity' | 'exact_name' | 'none';
}

/**
 * Resolves a transcript to an existing CRM Enquiry using a 4-Tier Cascade:
 * Tier 1: Calendar Event attendee email match (Primary Key)
 * Tier 2: Email username prefix heuristic (e.g. aryasuriyanarayanan@gmail.com -> Arya Suriyanarayanan)
 * Tier 3: First name token + active pending lead proximity (within 7 days)
 * Tier 4: Exact participantName match
 */
export async function resolveTargetEnquiry(
  prisma: any,
  meta: TranscriptMetadata,
  options: {
    calendarEvents?: any[];
    directEnquiryId?: string;
    directEmail?: string;
    directPhone?: string;
    directName?: string;
  } = {}
): Promise<ResolveEnquiryResult> {
  const { calendarEvents = [], directEnquiryId, directEmail, directPhone, directName } = options;
  const candidateName = (directName || meta.customerName || '').trim();

  // 1. Direct Enquiry ID Match
  if (directEnquiryId) {
    const enquiry = await prisma.enquiry.findUnique({
      where: { id: directEnquiryId },
    });
    if (enquiry) {
      return { enquiry, resolvedName: enquiry.participantName, resolvedEmail: enquiry.email || undefined, matchedBy: 'direct_id' };
    }
  }

  // 2. Direct Email Match
  if (directEmail) {
    const enquiry = await prisma.enquiry.findFirst({
      where: { email: { equals: directEmail.toLowerCase().trim(), mode: 'insensitive' } },
      orderBy: { messageTimestamp: 'desc' },
    });
    if (enquiry) {
      return { enquiry, resolvedName: enquiry.participantName, resolvedEmail: directEmail, matchedBy: 'direct_email' };
    }
  }

  // 3. Direct Phone Match
  if (directPhone) {
    const cleanDigits = directPhone.replace(/\D/g, '').slice(-10);
    if (cleanDigits.length >= 10) {
      const enquiry = await prisma.enquiry.findFirst({
        where: { phone: { contains: cleanDigits } },
        orderBy: { messageTimestamp: 'desc' },
      });
      if (enquiry) {
        return { enquiry, resolvedName: enquiry.participantName, resolvedEmail: enquiry.email || undefined, matchedBy: 'direct_phone' };
      }
    }
  }

  // 4. Tier 1: Microsoft Calendar Event Bridge (Primary Key)
  if (calendarEvents.length > 0) {
    const calMatch = matchCalendarEventToTranscript(meta, calendarEvents);
    if (calMatch?.candidateEmail) {
      const enquiry = await prisma.enquiry.findFirst({
        where: { email: { equals: calMatch.candidateEmail, mode: 'insensitive' } },
        orderBy: { messageTimestamp: 'desc' },
      });
      if (enquiry) {
        return {
          enquiry,
          resolvedEmail: calMatch.candidateEmail,
          resolvedName: calMatch.candidateName || enquiry.participantName,
          matchedBy: 'calendar_attendee',
        };
      }
    }
  }

  // 5. Tier 2: Email Prefix / Handle Heuristic (e.g. aryasuriyanarayanan@gmail.com -> Arya Suriyanarayanan)
  const normName = candidateName.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (normName.length >= 4 && !GENERIC_NAMES.has(normName) && !normName.startsWith('transcript')) {
    const recentEnquiries = await prisma.enquiry.findMany({
      where: {
        email: { not: null },
        messageTimestamp: { gte: new Date(Date.now() - 60 * 24 * 3600 * 1000) },
      },
      orderBy: { messageTimestamp: 'desc' },
      take: 50,
    });

    for (const enq of recentEnquiries) {
      if (!enq.email) continue;
      const prefix = enq.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
      if (
        prefix &&
        (prefix === normName ||
          (prefix.length >= 6 && normName.includes(prefix)) ||
          (normName.length >= 6 && prefix.includes(normName)))
      ) {
        return {
          enquiry: enq,
          resolvedEmail: enq.email,
          resolvedName: enq.participantName,
          matchedBy: 'email_prefix',
        };
      }
    }
  }

  // 6. Tier 3: First Name Token + Proximity (Pending/Open/In Touch/Talked leads within 60 days)
  const firstName = candidateName.split(/\s+/)[0].toLowerCase().trim();
  const isGenericCandidate = GENERIC_NAMES.has(firstName) || /^(?:transcript|meeting|recording|call|session|webvtt)(\s*\(\d+\)|\s*_\d+)?$/i.test(candidateName);
  if (firstName.length >= 3 && !isGenericCandidate) {
    const activeLeads = await prisma.enquiry.findMany({
      where: {
        status: { in: ['Open', 'Pending', 'In Touch', 'Talked', 'negotiating'] },
        messageTimestamp: { gte: new Date(Date.now() - 60 * 24 * 3600 * 1000) },
      },
      orderBy: { messageTimestamp: 'desc' },
    });

    for (const enq of activeLeads) {
      const leadFirst = enq.participantName.split(/\s+/)[0].toLowerCase().trim();
      if (leadFirst === firstName) {
        return {
          enquiry: enq,
          resolvedEmail: enq.email || undefined,
          resolvedName: enq.participantName,
          matchedBy: 'first_name_proximity',
        };
      }
    }
  }

  // 7. Tier 4: Exact Name Match (only for valid non-generic names)
  if (candidateName && !isGenericCandidate && !GENERIC_NAMES.has(candidateName.toLowerCase())) {
    const enquiry = await prisma.enquiry.findFirst({
      where: { participantName: { equals: candidateName, mode: 'insensitive' } },
      orderBy: { messageTimestamp: 'desc' },
    });
    if (enquiry) {
      return { enquiry, resolvedName: enquiry.participantName, resolvedEmail: enquiry.email || undefined, matchedBy: 'exact_name' };
    }
  }

  return { enquiry: null, matchedBy: 'none' };
}

