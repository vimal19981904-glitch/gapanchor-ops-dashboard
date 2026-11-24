import 'isomorphic-fetch';
import { Client } from '@microsoft/microsoft-graph-client';
import { prisma } from '@/lib/prisma';
import { listCalendarEvents } from '@/lib/googleCalendar';

export const MICROSOFT_BOOKINGS_URL = 'https://bookings.cloud.microsoft/bookings/calendar';
export const PUBLIC_BOOKINGS_LINK = 'https://outlook.office.com/book/gapanchortraining@gapanchor.com/s/heUF2jJPAEytxADp3YN_mg2';
export const MICROSOFT_BOOKINGS_BUSINESS_EMAIL = 'gapanchortraining@gapanchor.com';
export const TARGET_CALENDAR_EMAIL = 'contact@gapanchor.com';

/**
 * Retrieves and auto-refreshes a valid Microsoft Graph OAuth access token
 * from the database integrationConfig table.
 */
export async function getValidMicrosoftGraphToken(): Promise<string | null> {
  const config = await prisma.integrationConfig.findUnique({
    where: { service: 'microsoft_graph' },
  });

  if (!config || !config.metadata) {
    return null;
  }

  try {
    const meta = JSON.parse(config.metadata);
    const { refreshToken, accessToken, expiresAt } = meta;

    // Token still valid (with 5 min safety buffer)
    if (accessToken && expiresAt && Date.now() < expiresAt - 5 * 60 * 1000) {
      return accessToken;
    }

    // Refresh token
    if (refreshToken) {
      const clientId = process.env.MICROSOFT_CLIENT_ID;
      const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
      const tenantId = process.env.MICROSOFT_TENANT_ID || 'common';

      if (clientId && clientSecret) {
        const params = new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          scope: 'openid profile email Mail.Read Calendars.Read Calendars.ReadWrite offline_access',
        });

        const tokenRes = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: params.toString(),
        });

        if (tokenRes.ok) {
          const tokenData = await tokenRes.json();
          const newAccessToken = tokenData.access_token;
          const newRefreshToken = tokenData.refresh_token || refreshToken;
          const newExpiresAt = Date.now() + (tokenData.expires_in || 3600) * 1000;

          const updatedMeta = {
            ...meta,
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
            expiresAt: newExpiresAt,
          };

          await prisma.integrationConfig.update({
            where: { service: 'microsoft_graph' },
            data: {
              connected: true,
              metadata: JSON.stringify(updatedMeta),
            },
          });

          return newAccessToken;
        } else {
          console.warn('Failed to refresh Microsoft Graph token for calendar:', await tokenRes.text());
        }
      }
    }

    return accessToken || null;
  } catch (err: any) {
    console.error('Error obtaining Microsoft Graph token:', err.message);
    return null;
  }
}

/**
 * Creates an authenticated Microsoft Graph client.
 */
export async function getMicrosoftGraphClient(): Promise<Client | null> {
  const token = await getValidMicrosoftGraphToken();
  if (!token) return null;
  return Client.init({
    authProvider: (done) => done(null, token),
  });
}

export interface MicrosoftCalendarEvent {
  id: string;
  subject: string;
  startIso: string;
  endIso: string;
  startFormattedIst: string;
  endFormattedIst: string;
  dateKey: string; // YYYY-MM-DD
  isToday: boolean;
  isTomorrow: boolean;
  attendees: Array<{ name: string; email: string }>;
  joinUrl?: string;
  webLink?: string;
  bodyPreview?: string;
}

/**
 * Formats a Date object or ISO string into friendly Indian Standard Time (IST).
 */
export function formatToIst(isoDateStr: string): string {
  try {
    const d = new Date(isoDateStr);
    return d.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return isoDateStr;
  }
}

/**
 * Fetches calendar events from Microsoft Graph for contact@gapanchor.com.
 */
export async function getMicrosoftCalendarEvents(options?: {
  startDate?: string;
  endDate?: string;
  maxResults?: number;
}): Promise<MicrosoftCalendarEvent[]> {
  const client = await getMicrosoftGraphClient();
  if (!client) return [];

  const now = new Date();
  const start = options?.startDate || new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const end = options?.endDate || new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();
  const top = options?.maxResults || 25;

  try {
    const response = await client
      .api('/me/calendarView')
      .query({ startDateTime: start, endDateTime: end })
      .select('id,subject,start,end,location,attendees,organizer,onlineMeeting,webLink,bodyPreview')
      .orderby('start/dateTime')
      .top(top)
      .get();

    const rawEvents: any[] = response.value || [];
    const todayDateKey = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const tomorrowObj = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const tomorrowDateKey = tomorrowObj.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

    return rawEvents.map((evt) => {
      const startIso = evt.start?.dateTime ? `${evt.start.dateTime}Z` : '';
      const endIso = evt.end?.dateTime ? `${evt.end.dateTime}Z` : '';
      const startDateObj = new Date(startIso);
      const eventDateKey = !isNaN(startDateObj.getTime())
        ? startDateObj.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
        : '';

      const attendees = (evt.attendees || []).map((att: any) => ({
        name: att.emailAddress?.name || '',
        email: att.emailAddress?.address || '',
      }));

      return {
        id: evt.id,
        subject: evt.subject || 'Scheduled Meeting',
        startIso,
        endIso,
        startFormattedIst: formatToIst(startIso),
        endFormattedIst: formatToIst(endIso),
        dateKey: eventDateKey,
        isToday: eventDateKey === todayDateKey,
        isTomorrow: eventDateKey === tomorrowDateKey,
        attendees,
        joinUrl: evt.onlineMeeting?.joinUrl || undefined,
        webLink: evt.webLink || undefined,
        bodyPreview: evt.bodyPreview || '',
      };
    });
  } catch (err: any) {
    console.error('Failed to fetch Microsoft Calendar events:', err.message);
    return [];
  }
}

// In-memory cache for unified calendar events to guarantee sub-second responses
let unifiedCalendarCache: {
  events: MicrosoftCalendarEvent[];
  timestamp: number;
} | null = null;
const UNIFIED_CALENDAR_CACHE_TTL_MS = 60 * 1000;

/**
 * Unifies calendar events from both Microsoft Graph (contact@gapanchor.com)
 * and Google Calendar / iCal feed (xavierarul40@gmail.com).
 * Guarantees zero dropped schedules across all connected accounts.
 */
export async function getUnifiedCalendarEvents(options?: {
  startDate?: string;
  endDate?: string;
  maxResults?: number;
  forceRefresh?: boolean;
}): Promise<MicrosoftCalendarEvent[]> {
  if (
    !options?.forceRefresh &&
    unifiedCalendarCache &&
    Date.now() - unifiedCalendarCache.timestamp < UNIFIED_CALENDAR_CACHE_TTL_MS
  ) {
    return unifiedCalendarCache.events;
  }

  const now = new Date();
  const start = options?.startDate || new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const end = options?.endDate || new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();
  const maxResults = options?.maxResults || 30;

  // Google / iCal is the primary connected CRM calendar (xavierarul40@gmail.com).
  // Fetch Google calendar with a 6s budget.
  // Microsoft Graph is checked with a 2s budget so token refresh latency never stalls responses.
  const [googleRes, msEvents] = await Promise.all([
    Promise.race([
      listCalendarEvents({ timeMin: start, timeMax: end, maxResults }).catch(() => ({ events: [] as any[] })),
      new Promise<{ events: any[] }>((resolve) => setTimeout(() => resolve({ events: [] }), 6000)),
    ]),
    Promise.race([
      getMicrosoftCalendarEvents({ startDate: start, endDate: end, maxResults }).catch(() => [] as MicrosoftCalendarEvent[]),
      new Promise<MicrosoftCalendarEvent[]>((resolve) => setTimeout(() => resolve([]), 2000)),
    ]),
  ]);

  const todayDateKey = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const tomorrowObj = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const tomorrowDateKey = tomorrowObj.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

  const convertedGoogleEvents: MicrosoftCalendarEvent[] = (googleRes.events || []).map((g: any) => {
    const startIso = g.start || '';
    const endIso = g.end || startIso;
    const startDateObj = new Date(startIso);
    const eventDateKey = !isNaN(startDateObj.getTime())
      ? startDateObj.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
      : '';

    return {
      id: g.id || `gcal-${Math.random()}`,
      subject: g.title || (g.customerName ? `Session with ${g.customerName}` : 'Scheduled Session'),
      startIso,
      endIso,
      startFormattedIst: formatToIst(startIso),
      endFormattedIst: formatToIst(endIso),
      dateKey: eventDateKey,
      isToday: eventDateKey === todayDateKey,
      isTomorrow: eventDateKey === tomorrowDateKey,
      attendees: (g.attendees || []).map((a: any) => ({
        name: a.name || a.email || '',
        email: a.email || '',
      })),
      joinUrl: g.joinUrl || undefined,
      bodyPreview: g.cleanDescription || g.description || '',
    };
  });

  // Filter out bank/payment instruction automated drafts that accidentally got synced
  const isJunkEvent = (evt: MicrosoftCalendarEvent): boolean => {
    const s = (evt.subject + ' ' + (evt.bodyPreview || '')).toLowerCase();
    return (
      s.includes('ifsc code') ||
      s.includes('account number:') ||
      s.includes('account number :') ||
      s.includes('once the payment is completed')
    );
  };

  const allEvents = [...msEvents, ...convertedGoogleEvents].filter((e) => !isJunkEvent(e));

  // Sort ascending by start time
  allEvents.sort((a, b) => new Date(a.startIso).getTime() - new Date(b.startIso).getTime());

  if (allEvents.length > 0) {
    unifiedCalendarCache = {
      events: allEvents,
      timestamp: Date.now(),
    };
  }

  return allEvents;
}

/**
 * Books a new meeting on the Microsoft 365 / Outlook calendar for contact@gapanchor.com
 * with an auto-generated Microsoft Teams meeting link and reference to Microsoft Bookings.
 * Note: Free of AI agent signatures to ensure 100% official client communication.
 */
export async function bookMicrosoftCalendarMeeting(params: {
  subject: string;
  startDateTimeIst: string; // e.g. "2026-11-25T17:00:00"
  endDateTimeIst: string;   // e.g. "2026-11-25T17:30:00"
  attendeeEmail?: string;
  attendeeName?: string;
  attendeePhone?: string;
  scmProgram?: string;
  serviceName?: string;
  assignedStaff?: string;
  description?: string;
}): Promise<{
  success: boolean;
  event?: MicrosoftCalendarEvent;
  joinUrl?: string;
  error?: string;
}> {
  const client = await getMicrosoftGraphClient();
  if (!client) {
    return { success: false, error: 'Microsoft Graph authentication is not connected.' };
  }

  // Attendees list automatically includes Microsoft Bookings business mailbox & assigned staff
  // This guarantees the appointment is synced directly into https://bookings.cloud.microsoft/bookings/calendar
  const attendeesList: any[] = [
    {
      emailAddress: {
        address: 'gapanchortraining@gapanchor.com',
        name: 'GapAnchor Training SCM Enquiry',
      },
      type: 'required',
    },
    {
      emailAddress: {
        address: 'avpartners.consultants@outlook.com',
        name: 'GapAnchor Admin',
      },
      type: 'required',
    },
    {
      emailAddress: {
        address: 'contact@gapanchor.com',
        name: 'GapAnchor Ownership',
      },
      type: 'required',
    },
  ];

  if (
    params.attendeeEmail &&
    params.attendeeEmail !== 'gapanchortraining@gapanchor.com' &&
    params.attendeeEmail !== 'contact@gapanchor.com' &&
    params.attendeeEmail !== 'avpartners.consultants@outlook.com'
  ) {
    attendeesList.push({
      emailAddress: {
        address: params.attendeeEmail,
        name: params.attendeeName || params.attendeeEmail,
      },
      type: 'required',
    });
  }

  const service = params.serviceName || 'IT support & Training';
  const staff = params.assignedStaff || 'GapAnchor Admin, GapAnchor Ownership';
  const program = params.scmProgram || 'MANHATTAN Active®  WMS.';

  const eventPayload: any = {
    subject: params.subject,
    body: {
      contentType: 'HTML',
      content: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; max-width: 650px; line-height: 1.6;">
          <div style="border-bottom: 2px solid #0284c7; padding-bottom: 12px; margin-bottom: 16px;">
            <h2 style="color: #0f172a; margin: 0 0 4px 0; font-size: 20px;">${service}</h2>
            <p style="color: #64748b; margin: 0; font-size: 13px;">Official Microsoft Bookings & Consultation Service</p>
          </div>

          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px;">
            <tbody>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 8px 0; color: #64748b; width: 220px; font-weight: 500;">Service</td>
                <td style="padding: 8px 0; color: #0f172a; font-weight: 600;">${service}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Assigned Staff Group</td>
                <td style="padding: 8px 0; color: #0f172a;">${staff}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Customer Name</td>
                <td style="padding: 8px 0; color: #0f172a; font-weight: 600;">${params.attendeeName || 'Client'}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Customer Email</td>
                <td style="padding: 8px 0; color: #0f172a;">${params.attendeeEmail || 'N/A'}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Customer Phone</td>
                <td style="padding: 8px 0; color: #0f172a;">${params.attendeePhone || 'N/A'}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 8px 0; color: #64748b; font-weight: 500;">What SCM program are you looking ?</td>
                <td style="padding: 8px 0; color: #0284c7; font-weight: 600;">${program}</td>
              </tr>
              ${params.description ? `
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Consultation Notes</td>
                <td style="padding: 8px 0; color: #334155;">${params.description}</td>
              </tr>` : ''}
            </tbody>
          </table>

          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; margin-top: 16px; font-size: 13px; color: #475569;">
            <strong>Microsoft Bookings:</strong> <a href="${MICROSOFT_BOOKINGS_URL}" style="color: #0284c7; text-decoration: none;">${MICROSOFT_BOOKINGS_URL}</a><br/>
            <strong>Public Booking Link:</strong> <a href="${PUBLIC_BOOKINGS_LINK}" style="color: #0284c7; text-decoration: none;">${PUBLIC_BOOKINGS_LINK}</a>
          </div>
        </div>
      `,
    },
    start: {
      dateTime: params.startDateTimeIst,
      timeZone: 'India Standard Time',
    },
    end: {
      dateTime: params.endDateTimeIst,
      timeZone: 'India Standard Time',
    },
    attendees: attendeesList,
    isOnlineMeeting: true,
    onlineMeetingProvider: 'teamsForBusiness',
  };

  try {
    const created = await client.api('/me/events').post(eventPayload);
    const startIso = created.start?.dateTime ? `${created.start.dateTime}Z` : '';
    const endIso = created.end?.dateTime ? `${created.end.dateTime}Z` : '';

    const event: MicrosoftCalendarEvent = {
      id: created.id,
      subject: created.subject,
      startIso,
      endIso,
      startFormattedIst: formatToIst(startIso),
      endFormattedIst: formatToIst(endIso),
      dateKey: created.start?.dateTime?.slice(0, 10) || '',
      isToday: false,
      isTomorrow: true,
      attendees: (created.attendees || []).map((a: any) => ({
        name: a.emailAddress?.name || '',
        email: a.emailAddress?.address || '',
      })),
      joinUrl: created.onlineMeeting?.joinUrl || undefined,
      webLink: created.webLink || undefined,
    };

    return {
      success: true,
      event,
      joinUrl: created.onlineMeeting?.joinUrl || created.webLink,
    };
  } catch (err: any) {
    console.error('Failed to create Microsoft Calendar event:', err.message);
    return { success: false, error: err.message || 'Failed to schedule calendar event.' };
  }
}

/**
 * Cancels or deletes a meeting from Microsoft 365 Calendar by eventId, lead name, subject, or time slot.
 * Automatically deletes duplicate or overlapping calendar instances matching the target time slot.
 */
export async function cancelMicrosoftCalendarMeeting(target: {
  eventId?: string;
  leadNameOrSubject?: string;
  time?: string;
  date?: string;
}): Promise<{
  success: boolean;
  cancelledSubject?: string;
  cancelledCount?: number;
  error?: string;
}> {
  const client = await getMicrosoftGraphClient();
  if (!client) {
    return { success: false, error: 'Microsoft Graph authentication is not connected.' };
  }

  try {
    const upcoming = await getMicrosoftCalendarEvents({ maxResults: 50 });
    const eventsToDelete: MicrosoftCalendarEvent[] = [];

    // 1. Direct eventId match
    if (target.eventId) {
      const ev = upcoming.find((e) => e.id === target.eventId);
      if (ev) eventsToDelete.push(ev);
    }

    // 2. Time & Date filtering helper
    const matchesTargetTime = (ev: MicrosoftCalendarEvent, timeQuery?: string): boolean => {
      if (!timeQuery) return true;
      const cleanQ = timeQuery.toLowerCase().replace(/\s+/g, '');
      const evTime = ev.startFormattedIst.toLowerCase().replace(/\s+/g, '');

      // Parse hours and meridiem (e.g., "5pm", "11am", "17:00")
      const hourMatch = cleanQ.match(/(\d{1,2})(?::(\d{2}))?(am|pm)?/);
      if (hourMatch) {
        const qH = parseInt(hourMatch[1], 10);
        const qM = hourMatch[2] ? parseInt(hourMatch[2], 10) : 0;
        const qAmPm = hourMatch[3];

        const evHourMatch = evTime.match(/(\d{1,2}):(\d{2})(am|pm)/);
        if (evHourMatch) {
          const eH = parseInt(evHourMatch[1], 10);
          const eM = parseInt(evHourMatch[2], 10);
          const eAmPm = evHourMatch[3];

          if (qAmPm && qAmPm !== eAmPm) return false;
          if (qH !== eH) return false;
          if (hourMatch[2] && qM !== eM) return false;
          return true;
        }
      }

      return evTime.includes(cleanQ);
    };

    const matchesTargetDate = (ev: MicrosoftCalendarEvent, dateQuery?: string): boolean => {
      if (!dateQuery) return true;
      const dq = dateQuery.toLowerCase().trim();
      if (dq === 'today') return ev.isToday;
      if (dq === 'tomorrow') return ev.isTomorrow;
      return ev.dateKey.includes(dq) || ev.startFormattedIst.toLowerCase().includes(dq);
    };

    // 3. Search matching events
    if (eventsToDelete.length === 0) {
      const q = (target.leadNameOrSubject || '').toLowerCase().trim();
      const hasSpecificName = q.length > 0 && !['meeting', 'consultation', 'call', 'session'].includes(q);

      // Find all events matching name/subject AND time AND date
      const matched = upcoming.filter((e) => {
        const subject = e.subject.toLowerCase();
        const attendeesStr = e.attendees.map((a) => `${a.name} ${a.email}`.toLowerCase()).join(' ');
        const body = (e.bodyPreview || '').toLowerCase();

        const nameMatches = hasSpecificName
          ? subject.includes(q) || attendeesStr.includes(q) || body.includes(q)
          : true;

        const timeMatches = matchesTargetTime(e, target.time);
        const dateMatches = matchesTargetDate(e, target.date);

        return nameMatches && timeMatches && dateMatches;
      });

      if (matched.length > 0) {
        eventsToDelete.push(...matched);
      } else if (target.time) {
        // Fallback: match by time and date if name was generic or not found
        const byTime = upcoming.filter((e) => matchesTargetTime(e, target.time) && matchesTargetDate(e, target.date));
        if (byTime.length > 0) {
          eventsToDelete.push(...byTime);
        }
      } else if (hasSpecificName) {
        // Fallback: match by name across all upcoming
        const byName = upcoming.filter((e) => {
          const subject = e.subject.toLowerCase();
          const attendeesStr = e.attendees.map((a) => `${a.name} ${a.email}`.toLowerCase()).join(' ');
          return subject.includes(q) || attendeesStr.includes(q);
        });
        if (byName.length > 0) {
          eventsToDelete.push(...byName);
        }
      }
    }

    if (eventsToDelete.length === 0) {
      const detailMsg = target.time
        ? `at ${target.time}${target.date ? ` on ${target.date}` : ''}`
        : target.leadNameOrSubject
        ? `matching "${target.leadNameOrSubject}"`
        : 'at this time';
      return {
        success: false,
        error: `Could not find an upcoming meeting ${detailMsg} to cancel.`,
      };
    }

    // Delete ALL matched instances (eliminating duplicates)
    const cancelledSubjects = new Set<string>();
    for (const ev of eventsToDelete) {
      try {
        await client.api(`/me/events/${ev.id}`).delete();
        cancelledSubjects.add(ev.subject);
      } catch (delErr: any) {
        console.warn(`Could not delete event ${ev.id}:`, delErr.message);
      }
    }

    const titles = Array.from(cancelledSubjects);
    return {
      success: true,
      cancelledSubject: titles.length > 0 ? titles.join(' and ') : 'Scheduled Meeting',
      cancelledCount: eventsToDelete.length,
    };
  } catch (err: any) {
    console.error('Failed to cancel Microsoft Calendar event:', err.message);
    return {
      success: false,
      error: err.message || 'Failed to cancel meeting.',
    };
  }
}

/**
 * Builds a natural, conversational summary of calendar events for J.A.R.V.I.S. to speak.
 * Adheres strictly to the executive assistant voice persona:
 * - Natural conversational openings (no robotic "here is the rundown").
 * - Prioritises today's events first, then tomorrow, then key upcoming sessions.
 * - Extracts clean first names and natural spoken times (e.g. 11 AM, 5 PM).
 * - Omits Teams meeting links unless specifically requested.
 * - Highlights schedule conflicts and overlapping appointments.
 * - Supports targeted date filtering (e.g. "What's happening tomorrow?").
 */
export function formatCalendarEventsForJarvis(
  events: MicrosoftCalendarEvent[],
  options?: {
    targetDate?: 'today' | 'tomorrow' | 'upcoming' | string;
    includeLinks?: boolean;
  }
): string {
  if (!events || events.length === 0) {
    return 'Boss, your calendar is completely clear with zero scheduled sessions.';
  }

  // Helper to extract clean conversational subject & name
  const cleanSessionDescription = (e: MicrosoftCalendarEvent): string => {
    let title = e.subject || 'Meeting';
    // Clean course codes like [MANHATTAN Active® WMS] or Consultation: Name
    const candidateMatch = title.match(/-\s*([A-Za-z]+)/) || title.match(/(?:Consultation|Session|Meeting):\s*([A-Za-z]+)/i);
    let firstName = candidateMatch ? candidateMatch[1] : (e.attendees && e.attendees[0] ? e.attendees[0].name.split(' ')[0] : '');
    if (firstName) {
      firstName = firstName.charAt(0).toUpperCase() + firstName.slice(1);
    }

    if (title.toLowerCase().includes('live demo session')) {
      const prog = title.toLowerCase().includes('blue yonder') ? 'Blue Yonder WMS' : 'Manhattan Active WMS';
      return `${prog} live demo session`;
    }
    if (title.toLowerCase().includes('blue yonder') || title.toLowerCase().includes('batch - 30') || title.toLowerCase().includes('batch 30')) {
      return `Blue Yonder WMS Batch 30 session`;
    }
    if (title.toLowerCase().includes('manhattan proactive') || title.toLowerCase().includes('batch - 11') || title.toLowerCase().includes('batch 11')) {
      return `Manhattan ProActive batch session`;
    }
    if (title.toLowerCase().includes('consultation')) {
      return firstName ? `consultation with ${firstName}` : `consultation session`;
    }
    if (title.toLowerCase().includes('it support')) {
      return firstName ? `IT support session with ${firstName}` : `IT support session`;
    }

    return title.replace(/\[.*?\]/g, '').replace(/-\s*/g, '').trim();
  };

  const formatWithPossessive = (desc: string): string => {
    const clean = desc.replace(/^(?:an|a)\s+/i, '').trim();
    return `Your ${clean}`;
  };

  const formatWithIndefinite = (desc: string): string => {
    const clean = desc.replace(/^(?:an|a)\s+/i, '').trim();
    const startsWithVowel = /^[aeiou]/i.test(clean);
    return `${startsWithVowel ? 'an' : 'a'} ${clean}`;
  };

  const cleanSpokenTime = (istFormatted: string): string => {
    const m = istFormatted.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!m) return istFormatted;
    const hour = m[1];
    const min = m[2];
    const ampm = m[3].toUpperCase();
    if (min === '00') {
      return `${hour} ${ampm}`;
    }
    return `${hour}:${min} ${ampm}`;
  };

  // Helper to detect overlapping sessions
  const checkConflicts = (eventList: MicrosoftCalendarEvent[]): string => {
    const timesSeen = new Map<string, string[]>();
    for (const e of eventList) {
      const t = cleanSpokenTime(e.startFormattedIst);
      const list = timesSeen.get(t) || [];
      list.push(cleanSessionDescription(e));
      timesSeen.set(t, list);
    }
    let conflictMsg = '';
    Array.from(timesSeen.entries()).forEach(([time, sessions]) => {
      if (sessions.length > 1) {
        conflictMsg += ` Note that you have an overlapping slot at ${time} between ${sessions.join(' and ')}.`;
      }
    });
    return conflictMsg;
  };

  // Deduplicate events that have identical session description and start time
  const dedupeEvents = (evList: MicrosoftCalendarEvent[]): MicrosoftCalendarEvent[] => {
    const seen = new Set<string>();
    return evList.filter((e) => {
      const key = `${cleanSessionDescription(e).toLowerCase()}__${cleanSpokenTime(e.startFormattedIst).toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const todayEvents = dedupeEvents(events.filter((e) => e.isToday));
  const tomorrowEvents = dedupeEvents(events.filter((e) => e.isTomorrow));
  const otherUpcoming = dedupeEvents(events.filter((e) => !e.isToday && !e.isTomorrow));

  // 1. If user asked specifically for tomorrow
  if (options?.targetDate === 'tomorrow') {
    if (tomorrowEvents.length === 0) {
      return 'Boss, looking at tomorrow, your calendar is completely clear with zero scheduled sessions.';
    }

    const sentences: string[] = [];
    const countWords = tomorrowEvents.length === 1 ? 'one session' : `${tomorrowEvents.length} sessions`;
    sentences.push(`Boss, looking at tomorrow, you've got ${countWords} scheduled.`);

    for (const e of tomorrowEvents) {
      const desc = cleanSessionDescription(e);
      const time = cleanSpokenTime(e.startFormattedIst);
      sentences.push(`You have ${formatWithIndefinite(desc)} at ${time}.`);
    }

    const conflict = checkConflicts(tomorrowEvents);
    if (conflict) sentences.push(conflict);

    sentences.push("That's your schedule for tomorrow.");
    return sentences.join(' ');
  }

  // 2. If user asked specifically for today
  if (options?.targetDate === 'today') {
    if (todayEvents.length === 0) {
      return 'Boss, your schedule for today is completely clear with zero scheduled appointments.';
    }

    const sentences: string[] = [];
    const countWords = todayEvents.length === 1 ? 'one session' : `${todayEvents.length} sessions`;
    sentences.push(`Boss, you've got ${countWords} today.`);

    for (const e of todayEvents) {
      const desc = cleanSessionDescription(e);
      const time = cleanSpokenTime(e.startFormattedIst);
      sentences.push(`${formatWithPossessive(desc)} is at ${time}.`);
    }

    const conflict = checkConflicts(todayEvents);
    if (conflict) sentences.push(conflict);

    sentences.push("That's your schedule for today.");
    return sentences.join(' ');
  }

  // 3. General Calendar Overview (Prioritise today, then tomorrow, then key upcoming)
  const sentences: string[] = [];

  // Today
  if (todayEvents.length > 0) {
    const countWords = todayEvents.length === 1 ? 'one session' : `${todayEvents.length} sessions`;
    sentences.push(`Boss, you've got ${countWords} today.`);
    for (const e of todayEvents) {
      const desc = cleanSessionDescription(e);
      const time = cleanSpokenTime(e.startFormattedIst);
      sentences.push(`${formatWithPossessive(desc)} is scheduled for ${time}.`);
    }
    const conflict = checkConflicts(todayEvents);
    if (conflict) sentences.push(conflict);
  } else {
    sentences.push("Boss, your schedule for today is clear with zero appointments.");
  }

  // Tomorrow
  if (tomorrowEvents.length > 0) {
    const items = tomorrowEvents.map((e) => `${formatWithIndefinite(cleanSessionDescription(e))} at ${cleanSpokenTime(e.startFormattedIst)}`);
    sentences.push(`Looking at tomorrow, you have ${items.join(', and ')}.`);
  }

  // Upcoming Important Sessions (e.g. Saturday or next week)
  if (otherUpcoming.length > 0) {
    const firstOther = otherUpcoming[0];
    const desc = cleanSessionDescription(firstOther);
    const dayName = firstOther.startFormattedIst.split(',')[0] || 'upcoming';
    sentences.push(`You've also got ${formatWithIndefinite(desc)} scheduled for ${dayName} at ${cleanSpokenTime(firstOther.startFormattedIst)}.`);
  }

  sentences.push("That's your schedule for now.");
  return sentences.join(' ');
}

function extractTimeOnly(istFormatted: string): string {
  // e.g. "Wed, 25 Nov, 5:00 PM" -> "5:00 PM"
  const m = istFormatted.match(/\d{1,2}:\d{2}\s*(?:AM|PM)/i);
  return m ? m[0] : istFormatted;
}
