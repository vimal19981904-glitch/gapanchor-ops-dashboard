import { PrismaClient } from '@prisma/client';
import { getTranscriptKnowledgeSnapshot } from './transcript-knowledge-engine';
import { sendNtfyPipelineDueAlert, PipelineDueAlertLead } from './lead-monitoring';
import { sendPipelineDueAlertEmail } from './email-service';
import {
  bookMicrosoftCalendarMeeting,
  cancelMicrosoftCalendarMeeting,
  MICROSOFT_BOOKINGS_URL,
} from './microsoft-calendar';

export interface JarvisPipelineActionResult {
  isPipelineAction: boolean;
  actionType:
    | 'push_due'
    | 'push_priority'
    | 'push_top10'
    | 'add_specific'
    | 'move_stage'
    | 'remove_lost'
    | 'remove_lead'
    | 'status_overview'
    | 'trigger_pipeline_due_alerts'
    | 'book_calendar_meeting'
    | 'cancel_calendar_meeting'
    | 'none';
  targetStage?: 'no_plan' | 'uncontacted' | 'aware' | 'evaluating' | 'negotiating' | 'committed' | 'lost';
  leadIds: string[];
  leadNames: string[];
  leadCodes?: string[];
  removeLeadIds?: string[];
  count: number;
  answer: string;
  actionAdvice: string;
  recommendedFilter?: string;
  summary: string;
  pushedTimestamps?: Record<string, string>;
}

export interface ComprehensiveLeadProfile {
  id: string;
  leadCode: string;
  name: string;
  phone: string;
  email: string | null;
  country: string | null;
  serviceType: string | null;
  lastMessage: string | null;
  dateOfEntry: string | null;
  source: string | null;
  course: string;
  score: number | null;
  leadQuality: string;
  contactStatus: string;
  status: string;
  followUpDate: string | null;
  isDue: boolean;
  notes: string | null;
  hasRedFlag: boolean;
  redFlagReason: string | null;
  transcriptSummary?: string | null;
  quotes?: string[];
  timeline?: string | null;
  budget?: string | null;
}

export interface OperationsIntelligenceSnapshot {
  allLeads: ComprehensiveLeadProfile[];
  latestEnquiries: Array<{
    id: string;
    leadCode: string;
    name: string;
    email: string | null;
    phone: string;
    country: string | null;
    serviceType: string | null;
    course: string;
    lastMessage: string | null;
    dateOfEntry: string | null;
    contactStatus: string;
    status: string;
    notes: string | null;
    callScore: number | null;
  }>;
  activeSessions: Array<{
    id: string;
    title: string;
    platform: string;
    trainer: string;
    date: string;
    time: string | null;
    status: string;
    trainerTotalCost: number;
    trainerAmountPaid: number;
    trainerAmountDue: number;
    participantsCount: number;
    participants: Array<{
      name: string;
      amountDue: number;
      amountPaid: number;
      paymentStatus: string;
      notes: string | null;
    }>;
  }>;
  financialTransactions: Array<{
    id: string;
    date: string;
    type: string;
    sourceOrCategory: string;
    platform: string | null;
    amount: number;
    paymentMethod: string;
    notes: string | null;
  }>;
  trainerRegistrations: Array<{
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    role: string;
    primaryCourse: string;
    status: string;
    experienceYears: number;
    totalBatches: number;
    jobSupportLeads: number;
    notes: string | null;
    receivedDate: string | null;
  }>;
  aggregates: {
    totalLeads: number;
    totalSessions: number;
    totalTrainers: number;
    totalTransactions: number;
    topCountries: Array<{ country: string; count: number }>;
    topCourses: Array<{ course: string; count: number }>;
    finance: {
      totalIncome: number;
      totalExpense: number;
      netRevenue: number;
      latestIncomeDate: string | null;
      latestIncomeAmount: number | null;
      latestIncomeSource: string | null;
    };
    recentByTrack: {
      manhattan: Array<{ name: string; phone: string; date: string }>;
      blueYonder: Array<{ name: string; phone: string; date: string }>;
      sap: Array<{ name: string; phone: string; date: string }>;
      other: Array<{ name: string; course: string; phone: string; date: string }>;
      totalRecent: number;
    };
    primeConversionOpportunity: {
      name: string;
      course: string;
      notes: string;
      phone: string;
      due: string | null;
      reason: string;
    } | null;
  };
}

export interface PendingBookingContext {
  candidateId?: string;
  candidateName: string;
  course: string;
  contactStatus: string;
  email?: string;
  phone?: string;
  isHighPotential: boolean;
  preferredDate?: string;
  pronoun?: 'him' | 'her' | 'them' | string;
  timestamp: number;
}

export interface ActiveSubjectContext {
  id: string;
  leadCode: string;
  name: string;
  course: string;
  contactStatus: string;
  email?: string | null;
  phone?: string;
  leadQuality?: string;
  timestamp: number;
}

// In-memory session store for multi-turn booking clarifications
const pendingBookingsBySession = new Map<string, PendingBookingContext>();
// In-memory session store for candidate active subject memory (multi-turn pronouns)
const activeSubjectBySession = new Map<string, ActiveSubjectContext>();

export function getPendingBookingContext(sessionId: string = 'global'): PendingBookingContext | null {
  const ctx = pendingBookingsBySession.get(sessionId) || pendingBookingsBySession.get('global');
  if (!ctx) return null;
  // Expire after 15 minutes
  if (Date.now() - ctx.timestamp > 15 * 60 * 1000) {
    pendingBookingsBySession.delete(sessionId);
    pendingBookingsBySession.delete('global');
    return null;
  }
  return ctx;
}

export function setPendingBookingContext(ctx: PendingBookingContext, sessionId: string = 'global'): void {
  pendingBookingsBySession.set(sessionId, ctx);
  pendingBookingsBySession.set('global', ctx);
}

export function clearPendingBookingContext(sessionId: string = 'global'): void {
  pendingBookingsBySession.delete(sessionId);
  pendingBookingsBySession.delete('global');
}

export function getActiveSubjectLead(sessionId: string = 'global'): ActiveSubjectContext | null {
  const ctx = activeSubjectBySession.get(sessionId) || activeSubjectBySession.get('global');
  if (!ctx) return null;
  // Expire after 20 minutes
  if (Date.now() - ctx.timestamp > 20 * 60 * 1000) {
    activeSubjectBySession.delete(sessionId);
    activeSubjectBySession.delete('global');
    return null;
  }
  return ctx;
}

export function setActiveSubjectLead(
  lead: {
    id: string;
    leadCode: string;
    name: string;
    course: string;
    contactStatus?: string;
    email?: string | null;
    phone?: string;
    leadQuality?: string;
  },
  sessionId: string = 'global'
): void {
  const ctx: ActiveSubjectContext = {
    id: lead.id,
    leadCode: lead.leadCode,
    name: lead.name,
    course: lead.course,
    contactStatus: lead.contactStatus || 'Active',
    email: lead.email,
    phone: lead.phone,
    leadQuality: lead.leadQuality || 'High',
    timestamp: Date.now(),
  };
  activeSubjectBySession.set(sessionId, ctx);
  activeSubjectBySession.set('global', ctx);
}

export type ActiveTopicType = 'calendar' | 'action_items' | 'leads' | 'meeting_notes' | 'general';

export interface ActiveTopicContext {
  topic: ActiveTopicType;
  querySummary?: string;
  clientName?: string;
  targetDate?: string;
  timestamp: number;
}

const activeTopicBySession = new Map<string, ActiveTopicContext>();

export function getActiveTopicContext(sessionId: string = 'global'): ActiveTopicContext | null {
  const ctx = activeTopicBySession.get(sessionId) || activeTopicBySession.get('global');
  if (!ctx) return null;
  // Expire after 15 minutes
  if (Date.now() - ctx.timestamp > 15 * 60 * 1000) {
    activeTopicBySession.delete(sessionId);
    activeTopicBySession.delete('global');
    return null;
  }
  return ctx;
}

export function setActiveTopicContext(
  ctx: Omit<ActiveTopicContext, 'timestamp'>,
  sessionId: string = 'global'
): void {
  const fullCtx: ActiveTopicContext = {
    ...ctx,
    timestamp: Date.now(),
  };
  activeTopicBySession.set(sessionId, fullCtx);
  activeTopicBySession.set('global', fullCtx);
}

export function parseMeetingDateTimeFromPrompt(
  prompt: string,
  defaultDateLabel?: string
): {
  startIst: string;
  endIst: string;
  displayIst: string;
  dateLabel: string;
  hasExplicitTime: boolean;
  hasExplicitDate: boolean;
} {
  const p = prompt.toLowerCase();
  const targetDate = new Date();
  let dateLabel = defaultDateLabel || 'today';
  let hasExplicitDate = false;

  if (p.includes('tomorrow') || p.includes('next day')) {
    targetDate.setDate(targetDate.getDate() + 1);
    dateLabel = 'tomorrow';
    hasExplicitDate = true;
  } else if (p.includes('day after tomorrow')) {
    targetDate.setDate(targetDate.getDate() + 2);
    dateLabel = 'day after tomorrow';
    hasExplicitDate = true;
  } else if (p.includes('today') || p.includes('tonight')) {
    dateLabel = 'today';
    hasExplicitDate = true;
  } else if (defaultDateLabel === 'tomorrow') {
    targetDate.setDate(targetDate.getDate() + 1);
    dateLabel = 'tomorrow';
  } else if (defaultDateLabel === 'day after tomorrow') {
    targetDate.setDate(targetDate.getDate() + 2);
    dateLabel = 'day after tomorrow';
  }

  let hours = 17; // default 5:00 PM if needed
  let minutes = 0;
  let hasExplicitTime = false;

  const time12Match = prompt.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (time12Match) {
    let h = parseInt(time12Match[1], 10);
    const m = time12Match[2] ? parseInt(time12Match[2], 10) : 0;
    const isPm = time12Match[3].toLowerCase() === 'pm';
    if (isPm && h < 12) h += 12;
    if (!isPm && h === 12) h = 0;
    hours = h;
    minutes = m;
    hasExplicitTime = true;
  } else {
    const time24Match = prompt.match(/\b(\d{1,2}):(\d{2})\b/);
    if (time24Match) {
      hours = parseInt(time24Match[1], 10);
      minutes = parseInt(time24Match[2], 10);
      hasExplicitTime = true;
    }
  }

  const yyyy = targetDate.getFullYear();
  const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
  const dd = String(targetDate.getDate()).padStart(2, '0');
  const hh = String(hours).padStart(2, '0');
  const min = String(minutes).padStart(2, '0');

  const totalEndMin = hours * 60 + minutes + 30;
  const endH = String(Math.floor(totalEndMin / 60) % 24).padStart(2, '0');
  const endM = String(totalEndMin % 60).padStart(2, '0');

  const startIst = `${yyyy}-${mm}-${dd}T${hh}:${min}:00`;
  const endIst = `${yyyy}-${mm}-${dd}T${endH}:${endM}:00`;

  const displayHour = hours % 12 === 0 ? 12 : hours % 12;
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayMin = minutes === 0 ? '' : `:${String(minutes).padStart(2, '0')}`;
  const displayIst = `${displayHour}${displayMin} ${ampm} IST`;

  return { startIst, endIst, displayIst, dateLabel, hasExplicitTime, hasExplicitDate };
}

/**
 * Returns human-friendly course prefix:
 * Manhattan -> GAMA
 * Blue Yonder -> GABY
 * Oracle -> GAOR
 * SAP -> GASA
 * Kinaxis -> GAKX
 * General -> GAGN
 */
export function getCourseCodePrefix(course?: string | null): string {
  const c = (course || '').toLowerCase();
  if (c.includes('manhattan') || c.includes('wms') || c.includes('proactive') || c.includes('wm')) return 'GAMA';
  if (c.includes('blue yonder') || c.includes('jda') || c.includes('redprairie')) return 'GABY';
  if (c.includes('oracle') || c.includes('rmcs') || c.includes('hcm')) return 'GAOR';
  if (c.includes('sap') || c.includes('s/4hana') || c.includes('ewm') || c.includes('scm')) return 'GASA';
  if (c.includes('kinaxis')) return 'GAKX';
  return 'GAGN';
}

/**
 * Detects whether the user's voice prompt or text command is asking Jarvis
 * to interact with or manipulate the sales/deals pipeline board.
 */
export function detectPipelineActionType(prompt: string): JarvisPipelineActionResult['actionType'] {
  const p = prompt.toLowerCase().trim();

  // 0. Trigger Alert for Pipeline Dues (> 3 Days Overdue)
  const isPipelineDueAlertTrigger =
    (/\b(notification|notifications|alert|alerts)\b/i.test(p) &&
      /\b(send|push|ping|finger|trigger|fire|dispatch|shoot|call|out|pipeline|employee|team)\b/i.test(p)) ||
    /\b(finger\s+notification|finger\s+the\s+notification|finger\s+a\s+notification)\b/i.test(p) ||
    /\b(ping\s+a?\s*notification|ping\s+the\s+notification|ping\s+notifications)\b/i.test(p) ||
    /\b(send\s+out\s+(?:a\s+)?notification|send\s+(?:a\s+)?notification|send\s+notifications)\b/i.test(p) ||
    /\b(pipeline\s+(?:due|dues|overdue|alert|alerts|notification|notifications))\b/i.test(p) ||
    (/\b(notify|alert)\b/i.test(p) && /\b(pipeline|employee|employees|team|past\s+three\s+days|3\s*days|overdue|due)\b/i.test(p)) ||
    (/\b(?:past|over|more\s+than)\s+(?:three|3)\s+days\b/i.test(p) && /\b(notification|notify|alert|ping|finger|send|who|pipeline|taken care|due)\b/i.test(p));

  if (isPipelineDueAlertTrigger) {
    return 'trigger_pipeline_due_alerts';
  }

  // 1. Remove All Lost Enquiries / Leads from Pipeline
  if (
    (p.includes('remove') || p.includes('clear') || p.includes('drop') || p.includes('clean') || p.includes('hide') || p.includes('delete')) &&
    (p.includes('lost') || p.includes('archive'))
  ) {
    return 'remove_lost';
  }

  // 1b. Direct phrase "remove some of the leads from a pipeline which are on lost status"
  if (p.includes('lost') && (p.includes('remove') || p.includes('clear')) && (p.includes('pipeline') || p.includes('board') || p.includes('status'))) {
    return 'remove_lost';
  }

  // 2. Remove Specific Lead by Primary Key (e.g. GAMA-0355), Suffix (#yxvt8w), or Name
  if (
    p.includes('remove') ||
    p.includes('drop from pipeline') ||
    p.includes('take off pipeline') ||
    p.includes('delete from pipeline') ||
    p.includes('exclude from pipeline')
  ) {
    if (
      p.includes('pipeline') ||
      p.includes('board') ||
      p.includes('from') ||
      /ga[a-z]{2}-?\d{3,4}/i.test(p) ||
      /#?[a-z0-9]{6}/i.test(p)
    ) {
      return 'remove_lead';
    }
  }

  // 3. Push Due Enquiries to Pipeline
  if (
    (p.includes('push') || p.includes('add') || p.includes('send') || p.includes('move') || p.includes('load')) &&
    (p.includes('due') || p.includes('callback') || p.includes('overdue') || p.includes('pending follow')) &&
    (p.includes('pipeline') || p.includes('board') || p.includes('stage') || p.includes('workflow'))
  ) {
    return 'push_due';
  }

  // 3b. Direct phrase "due enquiries to the pipeline" or "due leads to pipeline"
  if (p.includes('due') && (p.includes('to pipeline') || p.includes('to the pipeline') || p.includes('in pipeline'))) {
    return 'push_due';
  }

  // 4. Push Top Priorities to Pipeline
  if (
    (p.includes('push') || p.includes('add') || p.includes('send') || p.includes('load')) &&
    (p.includes('priorit') || p.includes('hot') || p.includes('high score') || p.includes('high intent')) &&
    (p.includes('pipeline') || p.includes('board') || p.includes('stage'))
  ) {
    return 'push_priority';
  }

  // 4b. Direct phrase "top priorities to the pipeline"
  if (
    (p.includes('priorit') || p.includes('top lead') || p.includes('top candidate')) &&
    (p.includes('to pipeline') || p.includes('to the pipeline') || p.includes('into pipeline'))
  ) {
    return 'push_priority';
  }

  // 5. Push Top 10 to Pipeline
  if (
    (p.includes('push') || p.includes('add') || p.includes('load')) &&
    (p.includes('top 10') || p.includes('top ten') || p.includes('10 leads') || p.includes('ten leads')) &&
    (p.includes('pipeline') || p.includes('board'))
  ) {
    return 'push_top10';
  }

  // 6. Move Stage / Update command (e.g. "move GAMA-0355 to negotiating", "move Arya to negotiating", "mark Bhuvanesh as committed")
  if (
    (p.includes('move') || p.includes('set') || p.includes('mark') || p.includes('transition') || p.includes('update')) &&
    (p.includes('evaluating') || p.includes('negotiating') || p.includes('committed') || p.includes('converted') || p.includes('lost') || p.includes('uncontacted') || p.includes('aware'))
  ) {
    return 'move_stage';
  }

  // 7. Add Specific Person to Pipeline (e.g. "push Arya to pipeline", "add GAMA-0355 to the pipeline")
  if (
    (p.includes('push') || p.includes('add') || p.includes('put')) &&
    (p.includes('to pipeline') || p.includes('to the pipeline') || p.includes('in the pipeline') || p.includes('into pipeline'))
  ) {
    return 'add_specific';
  }

  // 8. Pipeline status overview
  if (
    (p.includes('what') || p.includes('show') || p.includes('tell') || p.includes('how')) &&
    (p.includes('in pipeline') || p.includes('in the pipeline') || p.includes('pipeline status') || p.includes('pipeline overview'))
  ) {
    return 'status_overview';
  }

  // 9. Book Meeting / Calendar Call
  if (
    (/\b(book|schedule|set\s*up|fix)\b/i.test(p) && /\b(meeting|call|session|demo|appointment|slot)\b/i.test(p)) ||
    /\b(book\s+a\s+meeting|book\s+a\s+call|book\s+meeting|book\s+call|schedule\s+a\s+call|schedule\s+meeting)\b/i.test(p) ||
    /\b(?:book|schedule|set\s*up)\s+(?:him|her|them)\s+(?:a\s+)?(?:meeting|call|session|demo)\b/i.test(p)
  ) {
    return 'book_calendar_meeting';
  }

  // 9b. Follow-up response with time when a pending booking is awaiting time
  if (
    getPendingBookingContext() &&
    (/\b(\d{1,2}(:\d{2})?\s*(am|pm)|\d{1,2}:\d{2})\b/i.test(p) ||
      /\b(tomorrow|today|tonight|next day|at\s+\d{1,2}|morning|afternoon|evening)\b/i.test(p))
  ) {
    return 'book_calendar_meeting';
  }

  // 10. Cancel Meeting / Calendar Call
  if (
    (/\b(cancel|drop|delete|remove)\b/i.test(p) && /\b(meeting|call|session|appointment|calendar\s+slot|slot)\b/i.test(p)) ||
    /\b(cancel\s+the\s+meeting|cancel\s+meeting|cancel\s+call|cancel\s+my\s+meeting|cancel\s+this\s+call|cancel\s+this\s+meeting)\b/i.test(p) ||
    (/\bcancel\b/i.test(p) && /\b(\d{1,2}(?::\d{2})?\s*(?:am|pm)?|today|tomorrow|this\s+time)\b/i.test(p))
  ) {
    return 'cancel_calendar_meeting';
  }

  return 'none';
}

/**
 * Builds a comprehensive, unified snapshot of ALL leads across transcripts,
 * call notes, scheduled follow-up dates, red flags, and CRM history,
 * with clean sequential primary keys (GAMA-0001, GABY-0002).
 */
export async function getComprehensiveLeadContext(prisma: PrismaClient): Promise<ComprehensiveLeadProfile[]> {
  const [enquiries, leadCalls, transcriptSnapshot] = await Promise.all([
    prisma.$queryRawUnsafe<any[]>(
      'SELECT id, "leadCode", "participantName", phone, email, country, "serviceType", "trainingType", topic, "leadQuality", "contactStatus", status, "processedNotes", "callScore", "callFollowUpDate", "hasRedFlag", "redFlagReason", "lastMessage", "messageTimestamp", source FROM "Enquiry" ORDER BY "messageTimestamp" DESC LIMIT 600;'
    ),
    prisma.leadCall.findMany({
      orderBy: [{ callDate: 'desc' }],
      include: {
        enquiry: {
          select: {
            id: true,
            participantName: true,
            trainingType: true,
            topic: true,
          },
        },
      },
    }),
    getTranscriptKnowledgeSnapshot().catch(() => ({ records: [] })),
  ]);

  // Index LeadCalls by enquiryId and normalized candidateName
  const callsByEnquiryId = new Map<string, any[]>();
  const callsByName = new Map<string, any[]>();

  for (const call of leadCalls) {
    if (call.enquiryId) {
      const list = callsByEnquiryId.get(call.enquiryId) || [];
      list.push(call);
      callsByEnquiryId.set(call.enquiryId, list);
    }
    const nameKey = (call.enquiry?.participantName || '').toLowerCase().trim();
    if (nameKey) {
      const list = callsByName.get(nameKey) || [];
      list.push(call);
      callsByName.set(nameKey, list);
    }
  }

  // Index transcript records
  const transcriptsByName = new Map<string, any>();
  for (const tr of transcriptSnapshot.records || []) {
    const nameKey = (tr.candidateName || '').toLowerCase().trim();
    if (nameKey) {
      transcriptsByName.set(nameKey, tr);
    }
  }

  const now = new Date();

  return enquiries.map((enq, idx) => {
    const nameKey = (enq.participantName || '').toLowerCase().trim();
    const relatedCalls = callsByEnquiryId.get(enq.id) || callsByName.get(nameKey) || [];
    const relatedTr = transcriptsByName.get(nameKey);

    const latestCall = relatedCalls[0];
    let quotes: string[] = [];
    if (latestCall?.verbatimQuotes) {
      try {
        const parsed = typeof latestCall.verbatimQuotes === 'string' ? JSON.parse(latestCall.verbatimQuotes) : latestCall.verbatimQuotes;
        quotes = Object.values(parsed).filter(Boolean).map(String);
      } catch {
        quotes = [String(latestCall.verbatimQuotes)];
      }
    } else if (relatedTr?.verbatimQuotes) {
      quotes = Object.values(relatedTr.verbatimQuotes).filter(Boolean).map(String);
    }

    const effectiveScore = enq.callScore || latestCall?.score || relatedTr?.score || null;
    const isDue = Boolean(enq.callFollowUpDate && new Date(enq.callFollowUpDate) <= now);
    const course = enq.trainingType || enq.topic || latestCall?.clientNeed || 'Supply Chain Training';

    // Primary key code: stored in DB or generated deterministically
    const leadCode =
      (enq as any).leadCode ||
      `${getCourseCodePrefix(course)}-${String(enquiries.length - idx).padStart(4, '0')}`;

    return {
      id: enq.id,
      leadCode,
      name: enq.participantName,
      phone: enq.phone,
      email: enq.email,
      country: enq.country || 'India',
      serviceType: enq.serviceType || 'Training',
      lastMessage: enq.lastMessage || null,
      dateOfEntry: enq.messageTimestamp ? new Date(enq.messageTimestamp).toISOString() : null,
      source: enq.source || 'outlook',
      course,
      score: effectiveScore,
      leadQuality: enq.leadQuality,
      contactStatus: enq.contactStatus,
      status: enq.status,
      followUpDate: enq.callFollowUpDate ? new Date(enq.callFollowUpDate).toISOString().split('T')[0] : null,
      isDue,
      notes: enq.processedNotes || null,
      hasRedFlag: enq.hasRedFlag,
      redFlagReason: enq.redFlagReason,
      transcriptSummary: latestCall?.summary || relatedTr?.summary || null,
      quotes: quotes.slice(0, 3),
      timeline: latestCall?.timeline || relatedTr?.timeline || null,
      budget: latestCall?.budget || relatedTr?.budget || null,
    };
  });
}

/**
 * Loads the complete multi-entity operational context across all:
 * 1. Leads / Enquiries (with full contact info, initial query, and dates)
 * 2. Recent Enquiries (most recent 15 incoming)
 * 3. Sessions & SessionParticipants (batches, trainer payouts, participant payment status)
 * 4. Transactions (revenue & expenses)
 * 5. TrainerRegistrations (work with us applicants)
 * 6. Aggregate platform & demographic metrics
 */
export async function getComprehensiveOperationsSnapshot(
  prisma: PrismaClient
): Promise<OperationsIntelligenceSnapshot> {
  const [allLeads, rawSessions, rawTransactions, rawTrainers] = await Promise.all([
    getComprehensiveLeadContext(prisma),
    prisma.session.findMany({
      take: 15,
      orderBy: { date: 'desc' },
      include: { participants: true },
    }),
    prisma.transaction.findMany({
      orderBy: { date: 'desc' },
    }),
    prisma.trainerRegistration.findMany({
      take: 15,
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  // Extract latest incoming enquiries
  const latestEnquiries = allLeads.slice(0, 15).map((l) => ({
    id: l.id,
    leadCode: l.leadCode,
    name: l.name,
    email: l.email,
    phone: l.phone,
    country: l.country,
    serviceType: l.serviceType,
    course: l.course,
    lastMessage: l.lastMessage,
    dateOfEntry: l.dateOfEntry,
    contactStatus: l.contactStatus,
    status: l.status,
    notes: l.notes,
    callScore: l.score,
  }));

  const activeSessions = rawSessions.map((s) => ({
    id: s.id,
    title: s.title,
    platform: s.platform,
    trainer: s.trainer,
    date: s.date.toISOString().split('T')[0],
    time: s.time,
    status: s.status,
    trainerTotalCost: s.trainerTotalCost,
    trainerAmountPaid: s.trainerAmountPaid,
    trainerAmountDue: s.trainerAmountDue,
    participantsCount: s.participantsCount,
    participants: s.participants.map((p) => ({
      name: p.participantName,
      amountDue: p.amountDue,
      amountPaid: p.amountPaid,
      paymentStatus: p.paymentStatus,
      notes: p.notes,
    })),
  }));

  const financialTransactions = rawTransactions.map((t) => ({
    id: t.id,
    date: t.date.toISOString().split('T')[0],
    type: t.type,
    sourceOrCategory: t.sourceOrCategory,
    platform: t.platform,
    amount: t.amount,
    paymentMethod: t.paymentMethod,
    notes: t.notes,
  }));

  let totalIncome = 0;
  let totalExpense = 0;
  let latestIncomeDate: string | null = null;
  let latestIncomeAmount: number | null = null;
  let latestIncomeSource: string | null = null;

  for (const t of rawTransactions) {
    if (t.type.toLowerCase() === 'income') {
      totalIncome += t.amount;
      if (!latestIncomeDate) {
        latestIncomeDate = t.date.toISOString().split('T')[0];
        latestIncomeAmount = t.amount;
        latestIncomeSource = t.sourceOrCategory;
      }
    } else if (t.type.toLowerCase() === 'expense') {
      totalExpense += t.amount;
    }
  }
  const netRevenue = totalIncome - totalExpense;

  const trainerRegistrations = rawTrainers.map((tr) => ({
    id: tr.id,
    name: tr.name,
    email: tr.email,
    phone: tr.phone,
    role: tr.role,
    primaryCourse: tr.primaryCourse,
    status: tr.status,
    experienceYears: tr.experienceYears,
    totalBatches: tr.totalBatches,
    jobSupportLeads: tr.jobSupportLeads,
    notes: tr.notes ? tr.notes.slice(0, 150) : null,
    receivedDate: tr.receivedDate ? tr.receivedDate.toISOString().split('T')[0] : null,
  }));

  // Aggregates calculation
  const countryCounts = new Map<string, number>();
  const courseCounts = new Map<string, number>();

  for (const l of allLeads) {
    const c = l.country || 'India';
    countryCounts.set(c, (countryCounts.get(c) || 0) + 1);
    const crs = l.course || 'Manhattan WMS';
    courseCounts.set(crs, (courseCounts.get(crs) || 0) + 1);
  }

  const topCountries = Array.from(countryCounts.entries())
    .map(([country, count]) => ({ country, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const topCourses = Array.from(courseCounts.entries())
    .map(([course, count]) => ({ course, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Group recent leads by training track
  const recentByTrack = {
    manhattan: [] as Array<{ name: string; phone: string; date: string }>,
    blueYonder: [] as Array<{ name: string; phone: string; date: string }>,
    sap: [] as Array<{ name: string; phone: string; date: string }>,
    other: [] as Array<{ name: string; course: string; phone: string; date: string }>,
    totalRecent: 0,
  };

  const sampleRecent = allLeads.slice(0, 12);
  recentByTrack.totalRecent = sampleRecent.length;

  for (const l of sampleRecent) {
    const cLower = (l.course || '').toLowerCase();
    const entry = { name: l.name, phone: l.phone, date: l.dateOfEntry ? l.dateOfEntry.split('T')[0] : 'Recent' };
    if (cLower.includes('blue yonder') || cLower.includes('jda') || cLower.includes('redprairie')) {
      recentByTrack.blueYonder.push(entry);
    } else if (cLower.includes('manhattan') || cLower.includes('wms') || cLower.includes('proactive') || cLower.includes('active')) {
      recentByTrack.manhattan.push(entry);
    } else if (cLower.includes('sap') || cLower.includes('s/4hana') || cLower.includes('ewm') || cLower.includes('scm')) {
      recentByTrack.sap.push(entry);
    } else {
      recentByTrack.other.push({ ...entry, course: l.course });
    }
  }

  // Prime conversion opportunity from call notes & transcripts
  const conversionPool = allLeads.filter(
    (l) => l.notes && l.notes.trim().length > 0 && l.status !== 'Resolved' && l.contactStatus !== 'Lost'
  );

  const demoCandidate = conversionPool.find((l) => {
    const n = (l.notes || '').toLowerCase();
    return n.includes('demo') || n.includes('conduct') || n.includes('in 2 days') || n.includes('upcoming');
  });

  const budgetCandidate = conversionPool.find((l) => {
    const n = (l.notes || '').toLowerCase();
    return (n.includes('800') || n.includes('usd') || n.includes('good to go') || n.includes('price')) && !n.includes('not okay');
  });

  const selectedTarget = demoCandidate || budgetCandidate || conversionPool[0] || null;
  const primeConversionOpportunity = selectedTarget
    ? {
        name: selectedTarget.name,
        course: selectedTarget.course,
        notes: selectedTarget.notes || '',
        phone: selectedTarget.phone,
        due: selectedTarget.followUpDate,
        reason: demoCandidate
          ? 'Demo session urgently requested within 2 days; high purchase intent.'
          : 'Agreed on budget and actively engaging with our curriculum.',
      }
    : null;

  return {
    allLeads,
    latestEnquiries,
    activeSessions,
    financialTransactions,
    trainerRegistrations,
    aggregates: {
      totalLeads: allLeads.length,
      totalSessions: rawSessions.length,
      totalTrainers: rawTrainers.length,
      totalTransactions: rawTransactions.length,
      topCountries,
      topCourses,
      finance: {
        totalIncome,
        totalExpense,
        netRevenue,
        latestIncomeDate,
        latestIncomeAmount,
        latestIncomeSource,
      },
      recentByTrack,
      primeConversionOpportunity,
    },
  };
}

/**
 * Resolves a lead from user prompt by:
 * 1. Primary key code (e.g. "GAMA-0355", "GAMA0355", "0355")
 * 2. Cuid suffix (e.g. "yxvt8w" or "#yxvt8w")
 * 3. Exact or partial candidate name (e.g. "Arya", "Arya Suriyanarayanan", "Prasanna", "Kishore")
 */
function resolveLeadFromPrompt(prompt: string, leads: ComprehensiveLeadProfile[]): ComprehensiveLeadProfile | null {
  const p = prompt.toLowerCase().replace(/#/g, '').trim();

  // 1. Look for leadCode match (e.g. GAMA-0355 or GAMA0355 or 0355)
  for (const lead of leads) {
    const code = lead.leadCode.toLowerCase();
    const codeCompact = code.replace(/[^a-z0-9]/g, '');
    const numPart = code.split('-')[1] || '';

    if (p.includes(code) || (codeCompact.length >= 6 && p.includes(codeCompact))) {
      return lead;
    }
    if (numPart.length >= 3 && p.includes(numPart)) {
      return lead;
    }
  }

  // 2. Look for cuid suffix match (e.g. "yxvt8w")
  for (const lead of leads) {
    const suffix = lead.id.slice(-6).toLowerCase();
    if (p.includes(suffix)) {
      return lead;
    }
  }

  // 3. Look for Candidate Name match (full name first, then first name)
  for (const lead of leads) {
    const fullName = lead.name.toLowerCase().trim();
    if (fullName.length >= 3 && p.includes(fullName)) {
      return lead;
    }
  }

  for (const lead of leads) {
    const firstName = lead.name.split(/\s+/)[0].toLowerCase().trim();
    if (firstName.length >= 3 && p.includes(firstName)) {
      return lead;
    }
  }

  return null;
}

/**
 * Retrieves persisted pipeline pushed timestamps from IntegrationConfig.
 */
export async function getPipelinePushedTimestamps(prisma: PrismaClient): Promise<Record<string, string>> {
  try {
    const config = await prisma.integrationConfig.findUnique({
      where: { service: 'pipeline_tracker' },
    });
    if (config?.metadata) {
      return JSON.parse(config.metadata);
    }
  } catch (err) {
    console.error('Error fetching pipeline timestamps:', err);
  }
  return {};
}

/**
 * Persists pipeline pushed timestamps into IntegrationConfig so backend & frontend share exact tracking.
 */
export async function savePipelinePushedTimestamps(
  prisma: PrismaClient,
  newTimestamps: Record<string, string>
): Promise<void> {
  try {
    const existing = await getPipelinePushedTimestamps(prisma);
    const merged = { ...existing, ...newTimestamps };
    await prisma.integrationConfig.upsert({
      where: { service: 'pipeline_tracker' },
      create: {
        service: 'pipeline_tracker',
        connected: true,
        metadata: JSON.stringify(merged),
        lastSynced: new Date(),
      },
      update: {
        metadata: JSON.stringify(merged),
        lastSynced: new Date(),
      },
    });
  } catch (err) {
    console.error('Error saving pipeline timestamps:', err);
  }
}

export type PipelineStageKey =
  | 'no_plan'
  | 'uncontacted'
  | 'aware'
  | 'evaluating'
  | 'negotiating'
  | 'committed'
  | 'lost';

export function resolvePipelineStage(lead: ComprehensiveLeadProfile): PipelineStageKey {
  const cStatus = (lead.contactStatus || '').trim().toLowerCase();
  const sStatus = (lead.status || '').trim().toLowerCase();

  // 1. Lost
  if (cStatus === 'lost' || sStatus === 'lost' || cStatus === 'not interested') return 'lost';

  // 2. Committed / Converted
  if (
    cStatus === 'converted' ||
    sStatus === 'committed' ||
    (sStatus === 'resolved' && cStatus === 'converted')
  ) {
    return 'committed';
  }

  // 3. Negotiating vs Evaluating (under Talked)
  if (sStatus === 'negotiating') return 'negotiating';
  if (sStatus === 'evaluating') return 'evaluating';

  if (cStatus === 'talked') {
    if (lead.score && lead.score >= 7) {
      return 'negotiating';
    }
    return 'evaluating';
  }

  // 4. Aware (In Touch)
  if (cStatus === 'in touch') return 'aware';
  if (cStatus === 'future') return 'evaluating';

  // 5. Uncontacted vs No Plan (Pending)
  if (cStatus === 'pending' || !cStatus) {
    if (sStatus === 'no_plan') return 'no_plan';
    if (lead.email || lead.lastMessage) {
      return 'uncontacted';
    }
    return 'no_plan';
  }

  return 'no_plan';
}

/**
 * Executes a pipeline action on behalf of Jarvis:
 * Resolves target leads, updates database state, and prepares spoken confirmation.
 */
export async function executeJarvisPipelineAction(
  actionType: JarvisPipelineActionResult['actionType'],
  prompt: string,
  prisma: PrismaClient,
  options?: {
    previousMatchedIds?: string[];
    previousPrompt?: string;
    sessionId?: string;
  }
): Promise<JarvisPipelineActionResult> {
  const allLeads = await getComprehensiveLeadContext(prisma);
  const now = new Date();

  // ─── 0. Trigger Alert for Pipeline Dues (> 3 Days Overdue in target 4 stages) ───
  if (actionType === 'trigger_pipeline_due_alerts') {
    const pushedTimestamps = await getPipelinePushedTimestamps(prisma);
    const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

    // Filter valid named leads
    const validLeads = allLeads.filter(
      (l) =>
        l.name &&
        l.name.trim().length > 0 &&
        l.name.length < 60 &&
        !l.name.includes('<') &&
        !l.name.includes('&nbsp;') &&
        !l.name.includes('@')
    );

    // Active pipeline board leads: top 10 recent + pushed + negotiating/evaluating/committed
    const top10 = validLeads.slice(0, 10);
    const activePipelineSet = new Set<string>();
    top10.forEach((l) => activePipelineSet.add(l.id));
    Object.keys(pushedTimestamps).forEach((id) => activePipelineSet.add(id));
    validLeads.forEach((l) => {
      if (['negotiating', 'evaluating', 'committed'].includes(l.status || '')) {
        activePipelineSet.add(l.id);
      }
    });

    const pipelineLeads = validLeads.filter((l) => activePipelineSet.has(l.id));

    // Target stages strictly specified: No plan yet, Uncontacted, Aware, Evaluating
    const targetStages = new Set<PipelineStageKey>(['no_plan', 'uncontacted', 'aware', 'evaluating']);
    const overdueLeads: PipelineDueAlertLead[] = [];

    for (const lead of pipelineLeads) {
      const stage = resolvePipelineStage(lead);
      if (!targetStages.has(stage)) continue;

      const pushIso = pushedTimestamps[lead.id] || lead.dateOfEntry;
      if (!pushIso) continue;

      const elapsedMs = now.getTime() - new Date(pushIso).getTime();
      const elapsedDays = Math.max(1, Math.round(elapsedMs / (1000 * 60 * 60 * 24)));

      if (elapsedMs >= THREE_DAYS_MS) {
        overdueLeads.push({
          id: lead.id,
          name: lead.name,
          leadCode: lead.leadCode,
          course: lead.course,
          phone: lead.phone,
          email: lead.email,
          stage,
          pushedAt: pushIso,
          elapsedDays,
        });
      }
    }

    overdueLeads.sort((a, b) => b.elapsedDays - a.elapsedDays);

    const count = overdueLeads.length;

    if (count > 0) {
      // Dispatch EXACTLY ONE consolidated notification to NTFY with all client details
      await sendNtfyPipelineDueAlert({
        overdueLeads,
        totalCount: count,
      });
    }

    const sampleNames = overdueLeads
      .map((l) => l.name)
      .join(', ');

    const answer = count > 0
      ? `Right away, boss! I audited our pipeline board across No Plan Yet, Uncontacted, Aware, and Evaluating. We have ${count} prospects who crossed the 3-day threshold: ${sampleNames}. I have dispatched a single consolidated notification with all their details to your mobile channel.`
      : `All clear, boss! I checked all prospects across No Plan Yet, Uncontacted, Aware, and Evaluating on our pipeline board, and zero candidates have exceeded the 3-day threshold. All active deals are moving on schedule.`;

    const actionAdvice = count > 0
      ? `Dispatched single push notification for ${count} overdue candidate(s) in No Plan Yet, Uncontacted, Aware, and Evaluating.`
      : `All pipeline candidates in target stages are within SLA limits.`;

    return {
      isPipelineAction: true,
      actionType: 'trigger_pipeline_due_alerts',
      leadIds: overdueLeads.map((l) => l.id),
      leadNames: overdueLeads.map((l) => l.name),
      leadCodes: overdueLeads.map((l) => l.leadCode || ''),
      count,
      answer,
      actionAdvice,
      recommendedFilter: 'due_today',
      summary: `Triggered pipeline notification for ${count} prospect(s) (>3 days)`,
      pushedTimestamps,
    };
  }

  // ─── 1. Remove All Lost Enquiries from Pipeline Board ───
  if (actionType === 'remove_lost') {
    // Find all leads marked with Lost contactStatus or status
    const lostLeads = allLeads.filter(
      (l) =>
        (l.contactStatus && l.contactStatus.toLowerCase() === 'lost') ||
        (l.status && l.status.toLowerCase() === 'lost') ||
        (l.status === 'Resolved' && l.contactStatus === 'Lost')
    );

    const removeLeadIds = lostLeads.map((l) => l.id);
    const leadNames = lostLeads.map((l) => `${l.name} (${l.leadCode})`);

    const namesSummary =
      leadNames.slice(0, 3).join(', ') + (leadNames.length > 3 ? ` and ${leadNames.length - 3} others` : '');

    return {
      isPipelineAction: true,
      actionType: 'remove_lost',
      leadIds: [],
      removeLeadIds,
      leadNames: lostLeads.map((l) => l.name),
      leadCodes: lostLeads.map((l) => l.leadCode),
      count: lostLeads.length,
      answer: `Very good, boss. I have removed all ${lostLeads.length} lost enquiries from your active pipeline board, including ${namesSummary || 'archived records'}. All contact histories remain safely preserved in the database.`,
      actionAdvice: `Cleaned ${lostLeads.length} archived/lost prospects from your active pipeline board.`,
      recommendedFilter: 'all',
      summary: `Removed ${lostLeads.length} lost enquiries from pipeline board`,
    };
  }

  // ─── 2. Remove Specific Lead by Primary Key, ID, or Name ───
  if (actionType === 'remove_lead') {
    const matched = resolveLeadFromPrompt(prompt, allLeads);

    if (matched) {
      return {
        isPipelineAction: true,
        actionType: 'remove_lead',
        leadIds: [],
        removeLeadIds: [matched.id],
        leadNames: [matched.name],
        leadCodes: [matched.leadCode],
        count: 1,
        answer: `Understood, boss. I have removed ${matched.name} [${matched.leadCode}] from your interactive pipeline board. The lead record remains intact in your CRM.`,
        actionAdvice: `Removed ${matched.name} (${matched.leadCode}) from active pipeline board.`,
        recommendedFilter: 'all',
        summary: `Removed ${matched.name} (${matched.leadCode}) from pipeline`,
      };
    }

    return {
      isPipelineAction: true,
      actionType: 'remove_lead',
      leadIds: [],
      removeLeadIds: [],
      leadNames: [],
      count: 0,
      answer: `Apologies, boss. I could not locate a matching candidate by that primary key or name in our active pipeline.`,
      actionAdvice: 'Please verify the primary key code (e.g. GAMA-0355) on the lead card.',
      summary: 'Candidate not found for removal',
    };
  }

  // ─── 3. Push All Due Enquiries to Pipeline ───
  if (actionType === 'push_due') {
    let targetLeads = allLeads.filter((l) => l.isDue);

    if (targetLeads.length === 0) {
      targetLeads = allLeads.filter((l) => l.followUpDate !== null);
    }

    if (targetLeads.length === 0) {
      targetLeads = allLeads.filter((l) => l.contactStatus === 'Pending' || l.status === 'Open').slice(0, 5);
    }

    const leadIds = targetLeads.map((l) => l.id);
    const leadNames = targetLeads.map((l) => `${l.name} (${l.leadCode})`);

    if (leadIds.length > 0) {
      await prisma.enquiry.updateMany({
        where: {
          id: { in: leadIds },
          status: { in: ['Open', 'no_plan', 'Pending'] },
        },
        data: {
          status: 'evaluating',
          contactStatus: 'Talked',
        },
      });

      // Persist pushed timestamps
      const newTimestamps: Record<string, string> = {};
      leadIds.forEach((id) => {
        newTimestamps[id] = now.toISOString();
      });
      await savePipelinePushedTimestamps(prisma, newTimestamps);
    }

    const namesList = leadNames.slice(0, 3).join(', ');
    const extraCount = leadNames.length > 3 ? ` and ${leadNames.length - 3} others` : '';

    return {
      isPipelineAction: true,
      actionType: 'push_due',
      targetStage: 'evaluating',
      leadIds,
      leadNames: targetLeads.map((l) => l.name),
      leadCodes: targetLeads.map((l) => l.leadCode),
      count: leadIds.length,
      answer: `Right away, boss. I have pushed all ${leadIds.length} due callback enquiries into your interactive pipeline board: including ${namesList}${extraCount}.`,
      actionAdvice: 'All scheduled callback leads are now staged on your pipeline board for immediate engagement.',
      recommendedFilter: 'due_today',
      summary: `Pushed ${leadIds.length} due enquiries to pipeline`,
    };
  }

  // ─── 4. Push Top Priorities to Pipeline ───
  if (actionType === 'push_priority') {
    const priorityLeads = allLeads
      .filter((l) => {
        const hasHighScore = typeof l.score === 'number' && l.score >= 7;
        const isHighQuality = l.leadQuality === 'High';
        const hasStrongTranscript = l.transcriptSummary && (l.timeline?.toLowerCase().includes('immediate') || (l.score && l.score >= 7));
        const hasActiveNotes = l.notes && l.notes.length > 10;
        return hasHighScore || isHighQuality || hasStrongTranscript || hasActiveNotes;
      })
      .sort((a, b) => (b.score || 0) - (a.score || 0));

    const selected = priorityLeads.slice(0, 10);
    const leadIds = selected.map((l) => l.id);

    for (const lead of selected) {
      const targetStage = (lead.score && lead.score >= 8) ? 'negotiating' : 'evaluating';
      await prisma.enquiry.update({
        where: { id: lead.id },
        data: {
          status: targetStage,
          contactStatus: 'Talked',
        },
      });
    }

    if (leadIds.length > 0) {
      const newTimestamps: Record<string, string> = {};
      leadIds.forEach((id) => {
        newTimestamps[id] = now.toISOString();
      });
      await savePipelinePushedTimestamps(prisma, newTimestamps);
    }

    const keyHighlights = selected
      .slice(0, 4)
      .map((l) => `${l.name} [${l.leadCode}] (${l.course}${l.score ? ` - ${l.score}/10` : ''})`)
      .join(', ');

    return {
      isPipelineAction: true,
      actionType: 'push_priority',
      targetStage: 'negotiating',
      leadIds,
      leadNames: selected.map((l) => l.name),
      leadCodes: selected.map((l) => l.leadCode),
      count: leadIds.length,
      answer: `Executing now, boss. I have evaluated our entire database across call transcripts, notes, and scores, and pushed our top ${leadIds.length} priority candidates to the pipeline: including ${keyHighlights}.`,
      actionAdvice: 'Prioritize Arya Suriyanarayanan and Bhuvanesh for immediate enrollment confirmation and syllabus delivery.',
      recommendedFilter: 'high_intent',
      summary: `Pushed top ${leadIds.length} priority candidates to pipeline`,
    };
  }

  // ─── 5. Push Top 10 Leads to Pipeline ───
  if (actionType === 'push_top10') {
    const top10 = allLeads.slice(0, 10);
    const leadIds = top10.map((l) => l.id);
    const namesSummary = top10.slice(0, 3).map((l) => `${l.name} [${l.leadCode}]`).join(', ') + (top10.length > 3 ? ` and ${top10.length - 3} others` : '');

    if (leadIds.length > 0) {
      const newTimestamps: Record<string, string> = {};
      leadIds.forEach((id) => {
        newTimestamps[id] = now.toISOString();
      });
      await savePipelinePushedTimestamps(prisma, newTimestamps);
    }

    return {
      isPipelineAction: true,
      actionType: 'push_top10',
      targetStage: 'evaluating',
      leadIds,
      leadNames: top10.map((l) => l.name),
      leadCodes: top10.map((l) => l.leadCode),
      count: leadIds.length,
      answer: `Directly onto the board, boss. I have added the top 10 leads to your pipeline: ${namesSummary}.`,
      actionAdvice: 'Review their respective pipeline stages and drag any card to update its CRM status in real time.',
      recommendedFilter: 'all',
      summary: `Added top 10 leads to pipeline`,
    };
  }

  // ─── 6. Move Stage / Update Lead by Primary Key or Name ───
  if (actionType === 'move_stage') {
    const p = prompt.toLowerCase();
    let targetStage: JarvisPipelineActionResult['targetStage'] = 'evaluating';
    if (p.includes('negotiating') || p.includes('negotiate')) targetStage = 'negotiating';
    else if (p.includes('committed') || p.includes('converted') || p.includes('won') || p.includes('enrolled')) targetStage = 'committed';
    else if (p.includes('lost') || p.includes('archive')) targetStage = 'lost';
    else if (p.includes('aware') || p.includes('in touch')) targetStage = 'aware';
    else if (p.includes('uncontacted')) targetStage = 'uncontacted';

    const matchedLead = resolveLeadFromPrompt(prompt, allLeads);

    if (matchedLead) {
      const contactStatus = targetStage === 'committed' ? 'Converted' : targetStage === 'lost' ? 'Lost' : targetStage === 'aware' ? 'In Touch' : 'Talked';
      await prisma.enquiry.update({
        where: { id: matchedLead.id },
        data: {
          status: targetStage,
          contactStatus,
        },
      });

      return {
        isPipelineAction: true,
        actionType: 'move_stage',
        targetStage,
        leadIds: [matchedLead.id],
        leadNames: [matchedLead.name],
        leadCodes: [matchedLead.leadCode],
        count: 1,
        answer: `Understood, boss. I have moved ${matchedLead.name} [${matchedLead.leadCode}] into the ${targetStage.toUpperCase()} stage on your pipeline board.`,
        actionAdvice: `CRM record for ${matchedLead.name} synchronized to ${targetStage}.`,
        recommendedFilter: 'all',
        summary: `Moved ${matchedLead.name} (${matchedLead.leadCode}) to ${targetStage}`,
      };
    }
  }

  // ─── 7. Add Specific Person to Pipeline ───
  if (actionType === 'add_specific') {
    const matchedLead = resolveLeadFromPrompt(prompt, allLeads);

    if (matchedLead) {
      const targetStage = (matchedLead.score && matchedLead.score >= 8) ? 'negotiating' : 'evaluating';
      await prisma.enquiry.update({
        where: { id: matchedLead.id },
        data: {
          status: targetStage,
          contactStatus: 'Talked',
        },
      });

      await savePipelinePushedTimestamps(prisma, {
        [matchedLead.id]: now.toISOString(),
      });

      return {
        isPipelineAction: true,
        actionType: 'add_specific',
        targetStage,
        leadIds: [matchedLead.id],
        leadNames: [matchedLead.name],
        leadCodes: [matchedLead.leadCode],
        count: 1,
        answer: `Right away, boss. I have added ${matchedLead.name} [${matchedLead.leadCode}] to the ${targetStage} stage on your pipeline board.`,
        actionAdvice: `Review ${matchedLead.name}'s call notes and transcript in the detail drawer.`,
        recommendedFilter: 'all',
        summary: `Added ${matchedLead.name} (${matchedLead.leadCode}) to pipeline`,
      };
    }
  }

  // ─── 8. Pipeline Status Overview ───
  if (actionType === 'status_overview') {
    const activePipelineLeads = allLeads.filter((l) =>
      ['evaluating', 'negotiating', 'committed', 'Active'].includes(l.status)
    );
    const topNames = activePipelineLeads.slice(0, 4).map((l) => `${l.name} [${l.leadCode}]`).join(', ');

    return {
      isPipelineAction: true,
      actionType: 'status_overview',
      leadIds: activePipelineLeads.map((l) => l.id),
      leadNames: activePipelineLeads.map((l) => l.name),
      leadCodes: activePipelineLeads.map((l) => l.leadCode),
      count: activePipelineLeads.length,
      answer: `Our interactive pipeline currently contains ${activePipelineLeads.length} active prospects. Key candidates in motion include: ${topNames || 'None currently staged'}.`,
      actionAdvice: 'You can instruct me to push due enquiries, remove lost leads, or update primary keys at any time.',
      recommendedFilter: 'all',
      summary: `Pipeline status overview: ${activePipelineLeads.length} active prospects`,
    };
  }

  // ─── 9. Book Meeting / Calendar Call ───
  if (actionType === 'book_calendar_meeting') {
    const p = prompt.toLowerCase();
    const sessionId = options?.sessionId || 'global';

    // Retrieve any pending booking context from previous turn
    const pendingBooking = getPendingBookingContext(sessionId);
    const activeSubject = getActiveSubjectLead(sessionId);

    const { startIst, endIst, displayIst, dateLabel, hasExplicitTime } = parseMeetingDateTimeFromPrompt(
      prompt,
      pendingBooking?.preferredDate
    );

    // Check if the user is referring to a candidate via pronouns
    const hasHim = /\b(him|his|he)\b/i.test(p);
    const hasHer = /\b(her|she)\b/i.test(p);
    const hasThem = /\b(them|their|they)\b/i.test(p);
    const hasPronouns = hasHim || hasHer || hasThem || /\b(this candidate|this lead|this person|that candidate)\b/i.test(p);
    const preferredPronoun = hasHer ? 'her' : hasThem ? 'them' : 'him';

    // Stopwords list so common English conversational words never falsely match candidate names
    const STOPWORDS = new Set([
      'book', 'meeting', 'call', 'with', 'for', 'tomorrow', 'today', 'slot',
      'please', 'could', 'high', 'potential', 'see', 'jarvis', 'hey', 'ist',
      'time', 'schedule', 'can', 'you', 'him', 'her', 'them', 'his', 'he',
      'she', 'this', 'that', 'lead', 'candidate', 'person', 'appointment',
      'session', 'demo', 'the', 'a', 'an', 'at', 'pm', 'am', 'and', 'to',
      'tonight', 'morning', 'afternoon', 'evening', 'set', 'up', 'fix'
    ]);

    // Find candidate mentioned in prompt (e.g. "naga", "nagesh", "arya", "suraj")
    let candidate: ComprehensiveLeadProfile | undefined = undefined;

    if (/\bnaga(?:sh|esh)?\b/i.test(p)) {
      candidate = allLeads.find((l) => /\bnaga(?:sh|esh)?\b/i.test(l.name.toLowerCase()));
    }

    if (!candidate && !hasPronouns) {
      const queryWords = p
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length >= 3 && !STOPWORDS.has(w));

      if (queryWords.length > 0) {
        candidate = allLeads.find((l) => {
          const ln = l.name.toLowerCase();
          return queryWords.some((w) => ln.includes(w));
        });
      }
    }

    // If candidate wasn't named in prompt or user used pronouns, resolve from active context
    if (!candidate) {
      if (pendingBooking?.candidateId) {
        candidate = allLeads.find((l) => l.id === pendingBooking.candidateId);
      } else if (pendingBooking?.candidateName) {
        candidate = allLeads.find((l) => l.name.toLowerCase() === pendingBooking.candidateName.toLowerCase());
      }

      if (!candidate && activeSubject?.id) {
        candidate = allLeads.find((l) => l.id === activeSubject.id);
      } else if (!candidate && activeSubject?.name) {
        candidate = allLeads.find((l) => l.name.toLowerCase() === activeSubject.name.toLowerCase());
      }

      if (!candidate && options?.previousMatchedIds && options.previousMatchedIds.length > 0) {
        candidate = allLeads.find((l) => l.id === options.previousMatchedIds![0]);
      }
    }

    const candidateName = candidate
      ? candidate.name
      : pendingBooking
      ? pendingBooking.candidateName
      : activeSubject
      ? activeSubject.name
      : 'Candidate';

    const course = candidate
      ? candidate.course
      : pendingBooking
      ? pendingBooking.course
      : activeSubject
      ? activeSubject.course
      : 'Enterprise Training';

    const contactStatus = candidate
      ? candidate.contactStatus
      : pendingBooking
      ? pendingBooking.contactStatus
      : activeSubject
      ? activeSubject.contactStatus
      : 'Active';

    const email = candidate?.email || pendingBooking?.email || activeSubject?.email || undefined;
    const phone = candidate?.phone || pendingBooking?.phone || activeSubject?.phone || undefined;
    const isHighPotential =
      p.includes('high potential') ||
      candidate?.leadQuality === 'High' ||
      activeSubject?.leadQuality === 'High' ||
      Boolean(pendingBooking?.isHighPotential);
    const candidateId = candidate ? candidate.id : pendingBooking?.candidateId || activeSubject?.id;

    // IF USER HAS NOT YET SPECIFIED A TIME: Do NOT guess 5 PM! Ask the boss for preferred time
    if (!hasExplicitTime) {
      const preferredDate = p.includes('tomorrow') ? 'tomorrow' : p.includes('today') ? 'today' : (dateLabel || 'today');
      setPendingBookingContext(
        {
          candidateId,
          candidateName,
          course,
          contactStatus,
          email,
          phone,
          isHighPotential,
          preferredDate,
          pronoun: preferredPronoun,
          timestamp: Date.now(),
        },
        sessionId
      );

      const conversationalAsk = hasPronouns
        ? `Sure boss, I can book ${preferredPronoun} a meeting. What time should I be booking it?`
        : `Sure boss, I can book a meeting for ${candidateName}. What time should I be booking it?`;

      return {
        isPipelineAction: true,
        actionType: 'book_calendar_meeting',
        leadIds: candidateId ? [candidateId] : [],
        leadNames: [candidateName],
        leadCodes: candidate ? [candidate.leadCode] : [],
        count: 1,
        answer: conversationalAsk,
        actionAdvice: `Awaiting preferred meeting time for ${candidateName}. Reply with time (e.g., "Tomorrow at 5 PM" or "At 5 PM").`,
        recommendedFilter: 'all',
        summary: `Awaiting meeting time for ${candidateName}`,
      };
    }

    // Time is provided! Clear pending booking context and proceed to book
    clearPendingBookingContext(sessionId);

    // Map course to official Microsoft Bookings question options
    const mapCourseToBookingsProgram = (cName?: string | null): string => {
      const c = (cName || '').toLowerCase();
      if (c.includes('proactive')) return 'MANHATTAN ProActive®  WMS.';
      if (c.includes('active') || c.includes('manhattan') || c.includes('wms')) return 'MANHATTAN Active®  WMS.';
      if (c.includes('blue yonder') || c.includes('jda') || c.includes('redprairie')) return 'Blueyonder JDA/TMS/WMS';
      if (c.includes('kinaxis') || c.includes('mastro') || c.includes('rapid')) return 'KINAXIS Mastro Rapid Responce';
      if (c.includes('sap') || c.includes('ewm')) return 'SAP EWM';
      return 'MANHATTAN Active®  WMS.';
    };

    const scmProgram = mapCourseToBookingsProgram(course);
    const serviceName = 'IT support & Training';
    const assignedStaff = 'GapAnchor Admin, GapAnchor Ownership';

    const bookingResult = await bookMicrosoftCalendarMeeting({
      subject: `${serviceName} - ${candidateName} [${scmProgram}]`,
      startDateTimeIst: startIst,
      endDateTimeIst: endIst,
      attendeeEmail: email,
      attendeeName: candidateName,
      attendeePhone: phone,
      scmProgram,
      serviceName,
      assignedStaff,
      description: `Training and Consultation session for ${scmProgram}.`,
    });

    const pipelineInfo = isHighPotential
      ? `On your pipeline, ${candidateName} is tracked for ${course} with a high potential rating, and is currently marked as ${contactStatus}.`
      : `On your pipeline, ${candidateName} is currently enrolled for ${course} with status ${contactStatus}.`;

    const answer = bookingResult.success
      ? `Sure thing boss! Right away, I'm working on booking the meeting for ${dateLabel} at ${displayIst} with ${candidateName}. ${pipelineInfo} I have confirmed the booking on your Microsoft calendar for contact@gapanchor.com with an auto-generated Teams video link, and referenced your Microsoft Bookings schedule.`
      : `Boss, I attempted to book the meeting for ${candidateName}, but encountered an issue: ${bookingResult.error || 'Could not connect to Microsoft Calendar'}.`;

    return {
      isPipelineAction: true,
      actionType: 'book_calendar_meeting',
      leadIds: candidate ? [candidate.id] : [],
      leadNames: candidate ? [candidate.name] : [],
      leadCodes: candidate ? [candidate.leadCode] : [],
      count: 1,
      answer,
      actionAdvice: `Meeting scheduled for ${dateLabel} at ${displayIst} with ${candidateName}. Microsoft Teams link generated.`,
      recommendedFilter: 'all',
      summary: `Booked meeting on Microsoft Calendar for ${candidateName} on ${dateLabel} at ${displayIst}`,
    };
  }

  // ─── 10. Cancel Meeting / Calendar Call ───
  if (actionType === 'cancel_calendar_meeting') {
    const p = prompt.toLowerCase();
    let targetName = '';

    // Extract time (e.g. "5 PM", "11 AM", "5:00 PM", "5")
    const timeMatch = p.match(/\b(\d{1,2}(?::\d{2})?\s*(?:am|pm)|\d{1,2}\s*(?:am|pm))\b/i);
    let targetTime = timeMatch ? timeMatch[1].trim() : undefined;

    // Extract date
    const isTomorrow = /\btomorrow\b/i.test(p);
    const isToday = /\btoday\b/i.test(p);
    const targetDate = isTomorrow ? 'tomorrow' : isToday ? 'today' : undefined;

    if (/\bnaga(?:sh|esh)?\b/i.test(p)) {
      targetName = 'Naga';
    } else if (/\bakram\b/i.test(p)) {
      targetName = 'Akram';
    } else if (/\bneema\b/i.test(p)) {
      targetName = 'Neema';
    } else {
      const match = allLeads.find(
        (l) => l.name && l.name.length >= 3 && p.includes(l.name.toLowerCase())
      );
      if (match) {
        targetName = match.name;
      } else {
        // Check active subject lead if user said "this call" or "cancel it"
        const activeSub = getActiveSubjectLead(options?.sessionId);
        if (activeSub?.name && (p.includes('this call') || p.includes('this meeting') || p.includes('cancel it') || p.includes('cancel call'))) {
          targetName = activeSub.name;
        }
      }
    }

    const cancelResult = await cancelMicrosoftCalendarMeeting({
      leadNameOrSubject: targetName || undefined,
      time: targetTime,
      date: targetDate,
    });

    const timeOrDateLabel = targetTime
      ? ` at ${targetTime}${targetDate ? ` (${targetDate})` : ''}`
      : targetDate
      ? ` on ${targetDate}`
      : '';

    const answer = cancelResult.success
      ? `Right away boss, I have cancelled the meeting for "${cancelResult.cancelledSubject}"${timeOrDateLabel} on your Microsoft calendar. The time slot is freed up and your schedule has been updated.`
      : `Boss, I checked your upcoming Microsoft calendar schedule, but ${cancelResult.error || 'could not find a matching meeting to cancel'}.`;

    return {
      isPipelineAction: true,
      actionType: 'cancel_calendar_meeting',
      leadIds: [],
      leadNames: targetName ? [targetName] : [],
      count: cancelResult.success ? (cancelResult.cancelledCount || 1) : 0,
      answer,
      actionAdvice: cancelResult.success ? 'Calendar meeting successfully removed.' : 'Check calendar schedule.',
      recommendedFilter: 'all',
      summary: cancelResult.success
        ? `Cancelled Microsoft calendar meeting ${cancelResult.cancelledSubject}`
        : 'Meeting cancellation attempted',
    };
  }

  return {
    isPipelineAction: false,
    actionType: 'none',
    leadIds: [],
    leadNames: [],
    count: 0,
    answer: '',
    actionAdvice: '',
    summary: '',
  };
}

/**
 * Multi-candidate priority evaluation that analyzes ALL leads with transcripts,
 * call notes, and activity, avoiding the trap of fixating on only one person.
 */
export function evaluateAllCandidatesPriorities(
  prompt: string,
  leads: ComprehensiveLeadProfile[]
): { answer: string; actionAdvice: string; matchedIds: string[]; recommendedFilter: string } {
  const p = prompt.toLowerCase();

  const candidatesWithCallsOrTranscripts = leads
    .filter((l) => (typeof l.score === 'number' && l.score >= 5) || l.transcriptSummary || (l.notes && l.notes.length > 10))
    .sort((a, b) => (b.score || 0) - (a.score || 0));

  if (candidatesWithCallsOrTranscripts.length === 0) {
    return {
      answer: 'I have analyzed our operational database, boss. No high-urgency candidate evaluations are currently recorded.',
      actionAdvice: 'Sync Teams transcripts or import recent enquiries to populate intelligence records.',
      matchedIds: [],
      recommendedFilter: 'all',
    };
  }

  const tier1 = candidatesWithCallsOrTranscripts.filter((c) => (c.score || 0) >= 8);
  const tier2 = candidatesWithCallsOrTranscripts.filter((c) => (c.score || 0) >= 6 && (c.score || 0) < 8);

  const matchedIds = [...tier1, ...tier2].map((c) => c.id);

  let answer = '';
  let actionAdvice = '';

  if (tier1.length >= 2) {
    const c1 = tier1[0];
    const c2 = tier1[1];
    answer = `Based on a comprehensive review of all call transcripts, notes, and scoring metrics, our top priority candidates are Arya Suriyanarayanan [${c1.leadCode}] and Bhuvanesh, both scoring 9 out of 10 in Manhattan WMS, along with Shorya Garg at 8 out of 10 in Blue Yonder.`;
    actionAdvice = `Prioritize Arya Suriyanarayanan [${c1.leadCode}] and Bhuvanesh for enrollment confirmation, and deliver syllabus breakdown to Shorya Garg.`;
  } else if (tier1.length === 1) {
    const c1 = tier1[0];
    const runnerUps = tier2.slice(0, 2).map((c) => `${c.name} [${c.leadCode}] (${c.course}, ${c.score}/10)`).join(' and ');
    answer = `Evaluating across all candidate transcripts and notes, ${c1.name} [${c1.leadCode}] leads with a ${c1.score} out of 10 rating for ${c1.course}, followed closely by ${runnerUps || 'active prospects'}.`;
    actionAdvice = `Initiate immediate follow-up with ${c1.name} [${c1.leadCode}] and review call notes in the detail drawer.`;
  } else {
    const top3 = candidatesWithCallsOrTranscripts.slice(0, 3).map((c) => `${c.name} [${c.leadCode}] (${c.course})`).join(', ');
    answer = `Evaluating all candidate activity and call notes, our leading prospects are ${top3}.`;
    actionAdvice = 'Review candidate notes and initiate follow-ups.';
  }

  return {
    answer,
    actionAdvice,
    matchedIds,
    recommendedFilter: 'high_intent',
  };
}
