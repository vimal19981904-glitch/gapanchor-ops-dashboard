import { google } from 'googleapis';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import ical from 'node-ical';

// ─── TYPES ─────────────────────────────────────────────────────────────
export type MeetingPlatform = 'google_meet' | 'teams' | 'zoom' | 'in_person' | 'other';

export interface CalendarEventItem {
  id: string;
  title: string;
  description: string;
  location: string;
  start: string;
  end: string;
  isAllDay: boolean;
  durationText: string;
  platform: MeetingPlatform;
  platformName: string;
  joinUrl: string | null;
  attendees: { email: string; name?: string; responseStatus?: string }[];
  htmlLink?: string;
  isDemo?: boolean;
}

export interface CalendarStatus {
  connected: boolean;
  configured: boolean;
  email?: string | null;
  lastSynced?: string | null;
  connectionType?: 'ical' | 'oauth' | null;
}

// ─── CONFIGURATION & ENCRYPTION ────────────────────────────────────────
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const REDIRECT_URI =
  process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/calendar/auth-callback';

const ENCRYPTION_SECRET = process.env.NEXTAUTH_SECRET || 'gapanchor-default-secret-salt-2026';
const ALGORITHM = 'aes-256-gcm';

function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const key = crypto.scryptSync(ENCRYPTION_SECRET, 'gapanchor-salt', 32);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

function decrypt(cipherText: string): string | null {
  try {
    const parts = cipherText.split(':');
    if (parts.length !== 3) return null;
    const [ivHex, authTagHex, encrypted] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const key = crypto.scryptSync(ENCRYPTION_SECRET, 'gapanchor-salt', 32);
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('Failed to decrypt calendar tokens:', err);
    return null;
  }
}

// ─── OAUTH2 CLIENT INITIALIZATION ──────────────────────────────────────
export function getOAuth2Client() {
  return new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
}

export function isGoogleConfigured(): boolean {
  return Boolean(CLIENT_ID && CLIENT_SECRET);
}

export function getAuthorizationUrl(): string {
  if (!isGoogleConfigured()) {
    throw new Error('Google OAuth credentials (GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET) are not set');
  }

  const oauth2Client = getOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/userinfo.email',
    ],
  });
}

// ─── TOKEN & FEED STORAGE ──────────────────────────────────────────────
export async function saveTokens(tokens: any, email?: string): Promise<void> {
  const encrypted = encrypt(JSON.stringify(tokens));
  await prisma.integrationConfig.upsert({
    where: { service: 'google_calendar' },
    update: {
      connected: true,
      metadata: JSON.stringify({
        encryptedTokens: encrypted,
        email: email || 'xavierarul40@gmail.com',
        type: 'oauth',
        connectedAt: new Date().toISOString(),
      }),
      lastSynced: new Date(),
    },
    create: {
      service: 'google_calendar',
      connected: true,
      metadata: JSON.stringify({
        encryptedTokens: encrypted,
        email: email || 'xavierarul40@gmail.com',
        type: 'oauth',
        connectedAt: new Date().toISOString(),
      }),
      lastSynced: new Date(),
    },
  });
}

export async function saveIcalFeed(feedUrl: string, email?: string): Promise<void> {
  await prisma.integrationConfig.upsert({
    where: { service: 'google_calendar' },
    update: {
      connected: true,
      metadata: JSON.stringify({
        feedUrl,
        email: email || 'xavierarul40@gmail.com',
        type: 'ical',
        connectedAt: new Date().toISOString(),
      }),
      lastSynced: new Date(),
    },
    create: {
      service: 'google_calendar',
      connected: true,
      metadata: JSON.stringify({
        feedUrl,
        email: email || 'xavierarul40@gmail.com',
        type: 'ical',
        connectedAt: new Date().toISOString(),
      }),
      lastSynced: new Date(),
    },
  });
}

export async function getIcalFeedConfig(): Promise<{ url: string; email?: string } | null> {
  const envUrl = process.env.GOOGLE_CALENDAR_ICAL_URL;
  if (envUrl) {
    return { url: envUrl, email: process.env.GOOGLE_CALENDAR_EMAIL || 'xavierarul40@gmail.com' };
  }

  try {
    const config = await prisma.integrationConfig.findUnique({
      where: { service: 'google_calendar' },
    });

    if (config?.connected && config.metadata) {
      const meta = JSON.parse(config.metadata);
      if (meta.feedUrl) {
        return { url: meta.feedUrl, email: meta.email || 'xavierarul40@gmail.com' };
      }
    }
  } catch (err) {
    console.error('Error fetching iCal feed config:', err);
  }
  return null;
}

export async function getStoredCredentials(): Promise<{ tokens: any; email?: string } | null> {
  try {
    const config = await prisma.integrationConfig.findUnique({
      where: { service: 'google_calendar' },
    });

    if (!config || !config.connected || !config.metadata) return null;

    const meta = JSON.parse(config.metadata);
    if (!meta.encryptedTokens) return null;

    const decrypted = decrypt(meta.encryptedTokens);
    if (!decrypted) return null;

    return {
      tokens: JSON.parse(decrypted),
      email: meta.email || null,
    };
  } catch (err) {
    console.error('Error fetching calendar credentials:', err);
    return null;
  }
}

export async function disconnectGoogleCalendar(): Promise<void> {
  await prisma.integrationConfig.upsert({
    where: { service: 'google_calendar' },
    update: {
      connected: false,
      metadata: null,
      lastSynced: new Date(),
    },
    create: {
      service: 'google_calendar',
      connected: false,
      metadata: null,
      lastSynced: new Date(),
    },
  });
}

export async function getCalendarStatus(): Promise<CalendarStatus> {
  const configured = isGoogleConfigured();
  const creds = await getStoredCredentials();
  const icalFeed = await getIcalFeedConfig();

  const isConnected = Boolean(creds?.tokens || icalFeed?.url);
  const email = creds?.email || icalFeed?.email || (isConnected ? 'xavierarul40@gmail.com' : null);
  const connectionType = creds?.tokens ? 'oauth' : icalFeed?.url ? 'ical' : null;

  return {
    connected: isConnected,
    configured: configured || Boolean(icalFeed?.url),
    email,
    connectionType,
    lastSynced: new Date().toISOString(),
  };
}

export async function getAuthenticatedClient() {
  const creds = await getStoredCredentials();
  if (!creds || !creds.tokens) return null;

  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials(creds.tokens);

  // Automatically persist refreshed tokens
  oauth2Client.on('tokens', async (newTokens) => {
    const merged = { ...creds.tokens, ...newTokens };
    await saveTokens(merged, creds.email);
  });

  return oauth2Client;
}

// ─── MEETING PLATFORM & LINK EXTRACTION ────────────────────────────────
export function extractMeetingInfo(event: any): {
  platform: MeetingPlatform;
  platformName: string;
  joinUrl: string | null;
} {
  const description = event.description || '';
  const location = event.location || '';
  const hangoutLink = event.hangoutLink || null;
  const conferenceData = event.conferenceData || {};

  // 1. Check conferenceData video entry points
  if (conferenceData.entryPoints && Array.isArray(conferenceData.entryPoints)) {
    const videoEp = conferenceData.entryPoints.find((ep: any) => ep.entryPointType === 'video');
    if (videoEp?.uri) {
      if (videoEp.uri.includes('meet.google.com')) {
        return { platform: 'google_meet', platformName: 'Google Meet', joinUrl: videoEp.uri };
      }
      if (videoEp.uri.includes('teams.microsoft.com') || videoEp.uri.includes('teams.live.com')) {
        return { platform: 'teams', platformName: 'Microsoft Teams', joinUrl: videoEp.uri };
      }
      if (videoEp.uri.includes('zoom.us')) {
        return { platform: 'zoom', platformName: 'Zoom', joinUrl: videoEp.uri };
      }
      return { platform: 'other', platformName: 'Video Call', joinUrl: videoEp.uri };
    }
  }

  // 2. Check hangoutLink
  if (hangoutLink) {
    return { platform: 'google_meet', platformName: 'Google Meet', joinUrl: hangoutLink };
  }

  // 3. Scan description and location with Regex
  const textToScan = `${location} ${description}`;

  // Microsoft Teams
  const teamsMatch = textToScan.match(/https:\/\/(?:teams\.microsoft\.com|teams\.live\.com)\/[^\s"<>'`]+/i);
  if (teamsMatch) {
    return { platform: 'teams', platformName: 'Microsoft Teams', joinUrl: teamsMatch[0] };
  }

  // Zoom
  const zoomMatch = textToScan.match(/https:\/\/[a-zA-Z0-9_\-\.]*\.?zoom\.us\/(?:j\/[0-9]+[^\s"<>'`]*|[^\s"<>'`]+)/i);
  if (zoomMatch) {
    return { platform: 'zoom', platformName: 'Zoom', joinUrl: zoomMatch[0] };
  }

  // Google Meet
  const meetMatch = textToScan.match(/https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}/i);
  if (meetMatch) {
    return { platform: 'google_meet', platformName: 'Google Meet', joinUrl: meetMatch[0] };
  }

  // In-Person or Physical Venue
  if (
    location.toLowerCase().includes('office') ||
    location.toLowerCase().includes('room') ||
    location.toLowerCase().includes('floor') ||
    location.toLowerCase().includes('campus') ||
    location.toLowerCase().includes('hub') ||
    location.toLowerCase().includes('center') ||
    location.toLowerCase().includes('blr') ||
    location.toLowerCase().includes('hyd')
  ) {
    return { platform: 'in_person', platformName: 'In-Person', joinUrl: null };
  }

  return { platform: 'other', platformName: location ? 'Meeting' : 'Scheduled', joinUrl: null };
}

// ─── DURATION & FORMATTING ─────────────────────────────────────────────
export function formatDuration(startIso: string, endIso: string, isAllDay: boolean): string {
  if (isAllDay) return 'All Day';
  const s = new Date(startIso).getTime();
  const e = new Date(endIso).getTime();
  const diffMs = Math.max(0, e - s);
  const totalMins = Math.round(diffMs / (1000 * 60));

  if (totalMins < 60) return `${totalMins}m`;
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

export function formatCalendarEvent(event: any): CalendarEventItem {
  const isAllDay = Boolean(event.start?.date && !event.start?.dateTime);
  const start = event.start?.dateTime || event.start?.date || new Date().toISOString();
  const end = event.end?.dateTime || event.end?.date || start;
  const meetingInfo = extractMeetingInfo(event);

  return {
    id: event.id || `evt-${Math.random().toString(36).substring(2, 9)}`,
    title: event.summary || '(No title)',
    description: event.description || '',
    location: event.location || '',
    start,
    end,
    isAllDay,
    durationText: formatDuration(start, end, isAllDay),
    platform: meetingInfo.platform,
    platformName: meetingInfo.platformName,
    joinUrl: meetingInfo.joinUrl,
    attendees: (event.attendees || []).map((a: any) => ({
      email: a.email || '',
      name: a.displayName || a.email || '',
      responseStatus: a.responseStatus || 'needsAction',
    })),
    htmlLink: event.htmlLink || undefined,
  };
}

// ─── ICAL REAL-TIME FEED PARSER ────────────────────────────────────────
export async function fetchIcalEvents(
  feedUrl: string,
  options: { search?: string; maxResults?: number } = {}
): Promise<CalendarEventItem[]> {
  const normalizedUrl = feedUrl.replace(/^webcal:\/\//i, 'https://');
  const parsedData = await ical.async.fromURL(normalizedUrl);

  const items: CalendarEventItem[] = [];

  for (const k in parsedData) {
    const ev: any = parsedData[k];
    if (ev.type !== 'VEVENT') continue;

    const start = ev.start ? new Date(ev.start).toISOString() : new Date().toISOString();
    const end = ev.end ? new Date(ev.end).toISOString() : start;
    const isAllDay = Boolean(ev.datetype === 'date');
    const meetingInfo = extractMeetingInfo({
      description: ev.description || '',
      location: ev.location || '',
      hangoutLink: ev.url || null,
    });

    items.push({
      id: ev.uid || `ical-${k}`,
      title: ev.summary || '(No title)',
      description: ev.description || '',
      location: ev.location || '',
      start,
      end,
      isAllDay,
      durationText: formatDuration(start, end, isAllDay),
      platform: meetingInfo.platform,
      platformName: meetingInfo.platformName,
      joinUrl: meetingInfo.joinUrl,
      attendees: Array.isArray(ev.attendee)
        ? ev.attendee.map((a: any) => ({
            email: typeof a === 'string' ? a.replace(/^mailto:/i, '') : a.val ? a.val.replace(/^mailto:/i, '') : '',
            name: a.params?.CN || undefined,
          }))
        : [],
    });
  }

  // Sort ascending by start time
  items.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  // Filter search
  const filtered = options.search
    ? items.filter(
        (e) =>
          e.title.toLowerCase().includes(options.search!.toLowerCase()) ||
          e.description.toLowerCase().includes(options.search!.toLowerCase()) ||
          e.location.toLowerCase().includes(options.search!.toLowerCase())
      )
    : items;

  return options.maxResults ? filtered.slice(0, options.maxResults) : filtered;
}

// ─── API OPERATIONS: LIST & CREATE ────────────────────────────────────
export async function listCalendarEvents(options: {
  timeMin?: string;
  timeMax?: string;
  maxResults?: number;
  search?: string;
}): Promise<{ events: CalendarEventItem[]; connected: boolean; isDemo: boolean }> {
  // 1. Check if an iCal feed is configured
  const icalFeed = await getIcalFeedConfig();
  if (icalFeed?.url) {
    try {
      const events = await fetchIcalEvents(icalFeed.url, options);
      return { events, connected: true, isDemo: false };
    } catch (err: any) {
      console.error('Error fetching iCal feed:', err);
    }
  }

  // 2. Check if OAuth client is authenticated
  const authClient = await getAuthenticatedClient();
  if (authClient) {
    try {
      const calendar = google.calendar({ version: 'v3', auth: authClient });
      const nowIso = new Date().toISOString();
      const thirtyDaysAhead = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      const response = await calendar.events.list({
        calendarId: 'primary',
        timeMin: options.timeMin || nowIso,
        timeMax: options.timeMax || thirtyDaysAhead,
        maxResults: options.maxResults || 250,
        singleEvents: true,
        orderBy: 'startTime',
        q: options.search || undefined,
      });

      const rawItems = response.data.items || [];
      const formatted = rawItems.map(formatCalendarEvent);

      return { events: formatted, connected: true, isDemo: false };
    } catch (err: any) {
      console.error('Google Calendar list events error:', err?.message || err);
    }
  }

  // 3. No connection -> return clean empty list (ZERO DUMMY DATA)
  return { events: [], connected: false, isDemo: false };
}

export async function createCalendarEvent(eventData: {
  summary: string;
  description?: string;
  location?: string;
  startTime: string;
  endTime: string;
  conferenceType?: 'google_meet' | 'teams' | 'zoom' | 'none';
  attendees?: string[];
}): Promise<{ success: boolean; event?: CalendarEventItem; error?: string }> {
  const authClient = await getAuthenticatedClient();

  if (!authClient) {
    return { success: false, error: 'Please connect your Google Calendar via OAuth to create live events.' };
  }

  try {
    const calendar = google.calendar({ version: 'v3', auth: authClient });

    const requestBody: any = {
      summary: eventData.summary,
      description: eventData.description,
      location: eventData.location,
      start: { dateTime: new Date(eventData.startTime).toISOString() },
      end: { dateTime: new Date(eventData.endTime).toISOString() },
      attendees: (eventData.attendees || []).map((e) => ({ email: e })),
    };

    let conferenceDataVersion: number | undefined;

    if (eventData.conferenceType === 'google_meet') {
      requestBody.conferenceData = {
        createRequest: {
          requestId: `gapanchor-${Date.now()}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      };
      conferenceDataVersion = 1;
    }

    const res = await calendar.events.insert({
      calendarId: 'primary',
      conferenceDataVersion,
      requestBody,
    });

    return { success: true, event: formatCalendarEvent(res.data) };
  } catch (err: any) {
    console.error('Failed to create calendar event:', err);
    return { success: false, error: err?.message || 'Failed to create event' };
  }
}
