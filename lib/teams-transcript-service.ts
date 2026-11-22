/**
 * GapAnchor Ops Dashboard - Microsoft Teams Transcript Automation Service
 * 
 * Manages Microsoft Graph change notification subscriptions for Teams meeting transcripts,
 * retrieves raw transcript content via Graph API, and routes it directly into the
 * CRM AI Customer Experience Dossier and Lead Center pipeline.
 */

import { prisma } from '@/lib/prisma';
import { createGraphClient } from '@/lib/graph-client';
import { getValidAccessToken } from '@/lib/outlook-graph-sync';
import { analyzeTranscript } from '@/lib/transcript-ai-analyzer';
import {
  extractTranscriptMetadata,
  resolveTargetEnquiry,
} from '@/lib/bookings-transcript-matcher';

export const TARGET_ORGANIZER_EMAIL = 'contact@gapanchor.com';
export const SUBSCRIPTION_SERVICE_KEY = 'teams_transcript_subscription';

export interface GraphSubscriptionRecord {
  id: string;
  resource: string;
  changeType: string;
  notificationUrl: string;
  lifecycleNotificationUrl?: string;
  expirationDateTime: string;
  clientState: string;
}

/**
 * Returns the public root URL of the CRM deployment.
 * Prefers NEXTAUTH_URL, VERCEL_URL, or defaults to the verified production domain.
 */
export function getAppBaseUrl(): string {
  if (process.env.NEXTAUTH_URL && !process.env.NEXTAUTH_URL.includes('localhost')) {
    return process.env.NEXTAUTH_URL.replace(/\/$/, '');
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/\/$/, '')}`;
  }
  return 'https://dashboard-green-psi-12.vercel.app';
}

/**
 * Computes a deterministic, secure clientState token for webhook validation.
 */
export function getWebhookClientState(): string {
  const secret =
    process.env.MICROSOFT_CLIENT_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    'gapanchor-teams-transcript-secure-state';
  // Return clean alphanumeric key
  return Buffer.from(secret).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 32);
}

/**
 * Retrieves an active Microsoft Graph access token.
 * Prefers Azure AD Application Credentials (Client Credentials) for background webhooks,
 * falling back to verified Delegated tokens in IntegrationConfig.
 */
export async function getTeamsServiceToken(): Promise<{
  accessToken: string;
  isAppToken: boolean;
  accountEmail: string;
} | null> {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  const tenantId = process.env.MICROSOFT_TENANT_ID;

  // 1. Try Azure AD Client Credentials (App-only access)
  if (clientId && clientSecret && tenantId) {
    try {
      const params = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'client_credentials',
        scope: 'https://graph.microsoft.com/.default',
      });

      const res = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });

      if (res.ok) {
        const data = await res.json();
        return {
          accessToken: data.access_token,
          isAppToken: true,
          accountEmail: TARGET_ORGANIZER_EMAIL,
        };
      }
    } catch (err: any) {
      console.warn('[Teams Transcript Service] Client credentials fetch warning:', err.message);
    }
  }

  // 2. Fall back to Delegated user token in IntegrationConfig
  const delegated = await getValidAccessToken();
  if (delegated?.accessToken) {
    return {
      accessToken: delegated.accessToken,
      isAppToken: Boolean(delegated.isAppToken),
      accountEmail: delegated.accountEmail || TARGET_ORGANIZER_EMAIL,
    };
  }

  return null;
}

/**
 * Retrieves the currently saved subscription state from IntegrationConfig.
 */
export async function getSavedSubscription(): Promise<GraphSubscriptionRecord | null> {
  try {
    const config = await prisma.integrationConfig.findUnique({
      where: { service: SUBSCRIPTION_SERVICE_KEY },
    });
    if (config?.metadata) {
      return JSON.parse(config.metadata) as GraphSubscriptionRecord;
    }
  } catch (err) {
    console.error('[Teams Transcript Service] Error loading saved subscription:', err);
  }
  return null;
}

/**
 * Saves subscription state to IntegrationConfig.
 */
export async function saveSubscriptionRecord(sub: GraphSubscriptionRecord): Promise<void> {
  try {
    await prisma.integrationConfig.upsert({
      where: { service: SUBSCRIPTION_SERVICE_KEY },
      create: {
        service: SUBSCRIPTION_SERVICE_KEY,
        connected: true,
        metadata: JSON.stringify(sub),
        lastSynced: new Date(),
      },
      update: {
        connected: true,
        metadata: JSON.stringify(sub),
        lastSynced: new Date(),
      },
    });
  } catch (err) {
    console.error('[Teams Transcript Service] Error saving subscription record:', err);
  }
}

/**
 * Creates or renews the Microsoft Graph Change Notification subscription for Teams Transcripts.
 * Subscribes to: `users/{organizerEmail}/onlineMeetings/getAllTranscripts` (or tenant-wide `communications/onlineMeetings/getAllTranscripts`)
 */
export async function createOrRenewTranscriptSubscription(forceRecreate = false): Promise<{
  success: boolean;
  subscription?: GraphSubscriptionRecord;
  error?: string;
  isNew?: boolean;
}> {
  const tokenInfo = await getTeamsServiceToken();
  if (!tokenInfo?.accessToken) {
    return {
      success: false,
      error: 'Microsoft Graph access token is unavailable. Ensure MICROSOFT_CLIENT_ID & SECRET are configured.',
    };
  }

  const baseUrl = getAppBaseUrl();
  const notificationUrl = `${baseUrl}/api/webhooks/teams-transcripts`;
  const lifecycleNotificationUrl = `${baseUrl}/api/webhooks/teams-transcripts`;
  const clientState = getWebhookClientState();

  // Resource path: Target organizer's meetings
  const resource = `users/${tokenInfo.accountEmail}/onlineMeetings/getAllTranscripts`;

  const existing = await getSavedSubscription();

  // Check if existing subscription is still healthy and has > 12 hours remaining
  if (!forceRecreate && existing?.id) {
    const expiresAt = new Date(existing.expirationDateTime).getTime();
    const now = Date.now();
    const hoursRemaining = (expiresAt - now) / (1000 * 3600);

    if (hoursRemaining > 12) {
      return { success: true, subscription: existing, isNew: false };
    }

    // Proactively renew existing subscription via PATCH
    try {
      // Teams transcript subscriptions support up to 4230 minutes (~2.9 days)
      const newExpiration = new Date(Date.now() + 4200 * 60 * 1000).toISOString();
      const patchRes = await fetch(`https://graph.microsoft.com/v1.0/subscriptions/${existing.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${tokenInfo.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ expirationDateTime: newExpiration }),
      });

      if (patchRes.ok) {
        const updatedSub = await patchRes.json();
        const record: GraphSubscriptionRecord = {
          id: updatedSub.id || existing.id,
          resource: updatedSub.resource || resource,
          changeType: updatedSub.changeType || 'created',
          notificationUrl: updatedSub.notificationUrl || notificationUrl,
          lifecycleNotificationUrl: updatedSub.lifecycleNotificationUrl || lifecycleNotificationUrl,
          expirationDateTime: updatedSub.expirationDateTime || newExpiration,
          clientState,
        };
        await saveSubscriptionRecord(record);
        return { success: true, subscription: record, isNew: false };
      } else {
        const patchErr = await patchRes.text();
        console.warn('[Teams Transcript Service] Subscription renewal failed, creating fresh:', patchErr);
      }
    } catch (renewErr: any) {
      console.warn('[Teams Transcript Service] PATCH renewal exception:', renewErr.message);
    }
  }

  // Create fresh subscription via POST
  try {
    // 4200 minutes = ~70 hours (~2.9 days), safely under the 4230-minute max limit
    const expirationDateTime = new Date(Date.now() + 4200 * 60 * 1000).toISOString();

    const payload = {
      changeType: 'created',
      notificationUrl,
      lifecycleNotificationUrl,
      resource,
      expirationDateTime,
      clientState,
    };

    const createRes = await fetch('https://graph.microsoft.com/v1.0/subscriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenInfo.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      console.error('[Teams Transcript Service] Subscription creation failed:', errText);
      return {
        success: false,
        error: `Microsoft Graph returned status ${createRes.status}: ${errText}`,
      };
    }

    const createdData = await createRes.json();
    const record: GraphSubscriptionRecord = {
      id: createdData.id,
      resource: createdData.resource || resource,
      changeType: createdData.changeType || 'created',
      notificationUrl: createdData.notificationUrl || notificationUrl,
      lifecycleNotificationUrl: createdData.lifecycleNotificationUrl || lifecycleNotificationUrl,
      expirationDateTime: createdData.expirationDateTime || expirationDateTime,
      clientState,
    };

    await saveSubscriptionRecord(record);
    return { success: true, subscription: record, isNew: true };
  } catch (err: any) {
    console.error('[Teams Transcript Service] Error creating subscription:', err);
    return { success: false, error: err.message || 'Unknown error creating Graph subscription' };
  }
}

/**
 * Downloads raw transcript content (VTT format) from Microsoft Graph API given a notification resource URL.
 */
export async function downloadTranscriptContentFromGraph(
  resourceUrl: string
): Promise<{ text: string; transcriptId: string; meetingId?: string } | null> {
  const tokenInfo = await getTeamsServiceToken();
  if (!tokenInfo?.accessToken) {
    console.error('[Teams Transcript Service] Cannot download transcript without Graph token.');
    return null;
  }

  // Normalized content URL: e.g. "users/{userId}/onlineMeetings/{meetingId}/transcripts/{transcriptId}/content?$format=text/vtt"
  let contentUrl = resourceUrl.startsWith('http')
    ? resourceUrl
    : `https://graph.microsoft.com/v1.0/${resourceUrl.replace(/^\//, '')}`;

  if (!contentUrl.includes('/content')) {
    contentUrl = `${contentUrl.split('?')[0]}/content?$format=text/vtt`;
  } else if (!contentUrl.includes('$format')) {
    contentUrl = `${contentUrl}?$format=text/vtt`;
  }

  try {
    const res = await fetch(contentUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${tokenInfo.accessToken}`,
        Accept: 'text/vtt, text/plain',
      },
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error(`[Teams Transcript Service] Failed to download transcript (${res.status}):`, errBody);
      return null;
    }

    const vttText = await res.text();
    if (!vttText || vttText.trim().length === 0) {
      console.warn('[Teams Transcript Service] Downloaded empty transcript content.');
      return null;
    }

    // Extract transcript ID and meeting ID from path
    // Format: .../onlineMeetings/{meetingId}/transcripts/{transcriptId}/...
    const meetingMatch = contentUrl.match(/onlineMeetings\/([^/]+)/i);
    const transcriptMatch = contentUrl.match(/transcripts\/([^/?]+)/i);

    return {
      text: vttText,
      transcriptId: transcriptMatch ? transcriptMatch[1] : `transcript_${Date.now()}`,
      meetingId: meetingMatch ? meetingMatch[1] : undefined,
    };
  } catch (err: any) {
    console.error('[Teams Transcript Service] Error downloading transcript from Graph:', err.message);
    return null;
  }
}

/**
 * Ingests a raw transcript string into the CRM:
 * 1. Idempotency check: skips if meeting/transcript is already in LeadCall.
 * 2. Matches candidate using Calendar Bridge & bookings-transcript-matcher.
 * 3. Runs Gemini AI Customer Experience analysis (dossier, scoring, objections).
 * 4. Links intelligence to Enquiry and creates LeadCall entry in PostgreSQL.
 */
export async function ingestTranscriptContent(
  transcriptText: string,
  options: {
    meetingId?: string;
    transcriptId?: string;
    fileId?: string;
    directName?: string;
    directEmail?: string;
    directPhone?: string;
  } = {}
): Promise<{
  success: boolean;
  isDuplicate?: boolean;
  enquiryId?: string;
  leadCallId?: string;
  candidateName?: string;
  score?: number;
  message?: string;
}> {
  const { meetingId, transcriptId, fileId, directName, directEmail, directPhone } = options;
  const uniqueKey = transcriptId || fileId || meetingId || `mtg_${Date.now()}`;

  // 1. Idempotency check: Skip if already recorded in LeadCall
  const existingCall = await prisma.leadCall.findFirst({
    where: {
      OR: [
        { driveFileId: uniqueKey },
        ...(transcriptId ? [{ driveFileId: transcriptId }] : []),
        ...(fileId ? [{ driveFileId: fileId }] : []),
        ...(meetingId ? [{ teamsMeetingId: meetingId }] : []),
      ],
    },
  });

  if (existingCall) {
    return {
      success: true,
      isDuplicate: true,
      enquiryId: existingCall.enquiryId,
      leadCallId: existingCall.id,
      message: 'Transcript has already been ingested. Skipping duplicate creation.',
    };
  }

  // 2. Extract metadata from transcript
  const meta = extractTranscriptMetadata(transcriptText, fileId || uniqueKey);

  // 3. Pre-fetch calendar events for Primary Key attendee matching
  let calendarEvents: any[] = [];
  try {
    const tokenInfo = await getTeamsServiceToken();
    if (tokenInfo?.accessToken) {
      const client = createGraphClient(tokenInfo.accessToken);
      const now = new Date();
      const start = new Date(now.getTime() - 7 * 24 * 3600 * 1000).toISOString();
      const end = new Date(now.getTime() + 7 * 24 * 3600 * 1000).toISOString();

      const calRes = await client
        .api('/me/calendarView')
        .query({ startDateTime: start, endDateTime: end })
        .top(50)
        .select('id,subject,start,end,attendees,onlineMeeting,isOnlineMeeting')
        .get();

      calendarEvents = calRes.value || [];
    }
  } catch (calErr: any) {
    console.warn('[Teams Transcript Service] Calendar pre-fetch notice:', calErr.message);
  }

  // 4. Resolve Target CRM Enquiry
  const resolved = await resolveTargetEnquiry(prisma, meta, {
    calendarEvents,
    directName: directName || (meta.customerName !== 'Unknown Candidate' ? meta.customerName : undefined),
    directEmail,
    directPhone,
  });

  let targetEnquiry = resolved.enquiry;
  let rawCandidateName =
    resolved.resolvedName ||
    directName ||
    (meta.customerName !== 'Unknown Candidate' ? meta.customerName : null);
  const candidateEmail = resolved.resolvedEmail || directEmail || null;
  const candidatePhone = resolved.resolvedPhone || directPhone || null;

  const isGenericName = (name: string | null | undefined): boolean => {
    if (!name || name.trim().length < 2) return true;
    const lower = name.toLowerCase().trim();
    return (
      lower.includes('unknown') ||
      lower === 'candidate' ||
      lower === 'speaker' ||
      lower.startsWith('transcript') ||
      /^(?:transcript|meeting|recording|call|session|webvtt|audio|video)(\s*\(\d+\)|\s*_\d+)?$/i.test(lower)
    );
  };

  // If candidate name is unknown, probe via AI analysis to extract real participant name
  if (!targetEnquiry && isGenericName(rawCandidateName)) {
    try {
      const probe = await analyzeTranscript(transcriptText, 'Candidate');
      if (probe?.candidateName && !isGenericName(probe.candidateName)) {
        rawCandidateName = probe.candidateName;
        const retryResolve = await resolveTargetEnquiry(prisma, {
          ...meta,
          customerName: probe.candidateName,
        });
        if (retryResolve.enquiry) {
          targetEnquiry = retryResolve.enquiry;
        }
      }
    } catch (probeErr) {
      console.warn('[Teams Transcript Service] Probe analysis warning:', probeErr);
    }
  }

  // If still no existing lead:
  if (!targetEnquiry) {
    if (isGenericName(rawCandidateName)) {
      // Create pending triage record so transcript is never lost or misassigned
      targetEnquiry = await prisma.enquiry.create({
        data: {
          participantName: 'Unassigned Teams Candidate',
          email: candidateEmail,
          phone: candidatePhone || 'Not Provided',
          topic: 'Teams Meeting Review',
          trainingType: 'Supply Chain Training',
          source: 'teams_unmatched',
          status: 'Action Required',
          contactStatus: 'Talked',
          messageTimestamp: new Date(),
          leadQuality: 'Unrated',
        },
      });
    } else {
      // Create fresh Enquiry for identified candidate
      const preAnalysis = await analyzeTranscript(transcriptText, rawCandidateName!);
      targetEnquiry = await prisma.enquiry.create({
        data: {
          participantName: rawCandidateName!,
          email: candidateEmail,
          phone: candidatePhone || 'Not Provided',
          topic: preAnalysis.clientNeed || 'Supply Chain Training',
          trainingType: preAnalysis.clientNeed || 'Supply Chain Training',
          source: 'teams_call_transcript',
          status: 'Talked',
          contactStatus: 'Talked',
          messageTimestamp: new Date(),
          leadQuality: preAnalysis.score >= 8 ? 'High' : preAnalysis.score >= 5 ? 'Medium' : 'Low',
        },
      });
    }
  }

  const resolvedCandidateName = targetEnquiry.participantName || rawCandidateName || 'Candidate';

  // 5. Run Full Gemini AI Dossier Analysis
  const analysis = await analyzeTranscript(transcriptText, resolvedCandidateName);

  const safeCallDate =
    meta.meetingDate && !isNaN(meta.meetingDate.getTime()) ? meta.meetingDate : new Date();
  const safeFollowUpDate =
    analysis.followUpDate && !isNaN(new Date(analysis.followUpDate).getTime())
      ? new Date(analysis.followUpDate)
      : new Date(Date.now() + 24 * 3600 * 1000);

  // 6. Save LeadCall Record
  const newCall = await prisma.leadCall.create({
    data: {
      enquiryId: targetEnquiry.id,
      callDate: safeCallDate,
      durationMinutes: analysis.durationMinutes,
      candidateTalkPct: analysis.candidateTalkPct,
      score: analysis.score,
      summary: analysis.summary,
      customerExperience: analysis.customerExperience,
      clientNeed: analysis.clientNeed,
      budget: analysis.budget,
      timeline: analysis.timeline,
      decisionMaker: analysis.decisionMaker,
      objections: analysis.objections,
      counterPitch: analysis.counterPitch,
      verbatimQuotes: JSON.stringify(analysis.verbatimQuotes),
      rubricBreakdown: JSON.stringify(analysis.rubricBreakdown),
      whatsappDraft: analysis.whatsappDraft,
      nextAction: analysis.nextAction,
      teamsMeetingId: meetingId || null,
      driveFileId: uniqueKey,
    },
  });

  // 7. Update CRM Enquiry Status
  const updateData: any = {
    callScore: analysis.score,
    callFollowUpDate: safeFollowUpDate,
    hasRedFlag: analysis.hasRedFlag,
    redFlagReason: analysis.redFlagReason,
    redFlagDismissed: false,
    status:
      targetEnquiry.status === 'Open' || targetEnquiry.status === 'Pending'
        ? 'Talked'
        : targetEnquiry.status,
    contactStatus: 'Talked',
    lastMessage: `[Call: ${analysis.score}/10] ${analysis.summary.slice(0, 150)}...`,
  };

  if (!targetEnquiry.email && candidateEmail) {
    updateData.email = candidateEmail;
  }

  await prisma.enquiry.update({
    where: { id: targetEnquiry.id },
    data: updateData,
  });

  return {
    success: true,
    isDuplicate: false,
    enquiryId: targetEnquiry.id,
    leadCallId: newCall.id,
    candidateName: resolvedCandidateName,
    score: analysis.score,
    message: `Successfully processed and linked transcript for ${resolvedCandidateName}!`,
  };
}
