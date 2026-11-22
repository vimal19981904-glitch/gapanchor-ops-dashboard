import { NextRequest, NextResponse } from 'next/server';
import {
  getWebhookClientState,
  downloadTranscriptContentFromGraph,
  ingestTranscriptContent,
  createOrRenewTranscriptSubscription,
} from '@/lib/teams-transcript-service';

export const dynamic = 'force-dynamic';

/**
 * Microsoft Graph Change Notification Webhook for Teams Meeting Transcripts
 * 
 * Handles:
 * 1. Microsoft Graph Validation Handshake (?validationToken=...)
 * 2. Real-time Transcript Created Change Notifications
 * 3. Subscription Lifecycle Notifications (reauthorizationRequired / missed)
 */

export async function GET(request: NextRequest) {
  return handleValidationOrNotification(request);
}

export async function POST(request: NextRequest) {
  return handleValidationOrNotification(request);
}

async function handleValidationOrNotification(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const validationToken = searchParams.get('validationToken');

  // ─── 1. MICROSOFT GRAPH SUBSCRIPTION VALIDATION HANDSHAKE ──────────
  // When creating/renewing a subscription, Graph sends a validationToken.
  // We must return HTTP 200 with the exact plain-text token within 10s.
  if (validationToken) {
    console.log('[Teams Webhook] Validation handshake received successfully.');
    return new NextResponse(validationToken, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  }

  // Feature Flag Guard: If explicitly disabled, acknowledge but do not process
  if (process.env.TEAMS_TRANSCRIPT_AUTO_SYNC === 'false') {
    return NextResponse.json(
      { message: 'Teams transcript auto-sync is disabled via environment flag.' },
      { status: 200 }
    );
  }

  // ─── 2. PROCESS INCOMING CHANGE NOTIFICATIONS ──────────────────────
  try {
    const rawBody = await request.text();
    if (!rawBody || rawBody.trim().length === 0) {
      return new NextResponse(null, { status: 202 });
    }

    const payload = JSON.parse(rawBody);
    const notifications = payload.value;

    if (!Array.isArray(notifications) || notifications.length === 0) {
      return new NextResponse(null, { status: 202 });
    }

    const expectedClientState = getWebhookClientState();

    // Process all notifications asynchronously
    for (const notification of notifications) {
      const {
        subscriptionId,
        changeType,
        clientState,
        resource,
        resourceData,
        lifecycleEvent,
      } = notification;

      // Security check: verify clientState secret
      if (clientState && clientState !== expectedClientState) {
        console.warn('[Teams Webhook] Rejected notification with mismatched clientState:', subscriptionId);
        continue;
      }

      // Handle Subscription Lifecycle Events
      if (lifecycleEvent) {
        console.log('[Teams Webhook] Received subscription lifecycle event:', lifecycleEvent);
        if (lifecycleEvent === 'reauthorizationRequired' || lifecycleEvent === 'missed') {
          createOrRenewTranscriptSubscription(true).catch((err) =>
            console.error('[Teams Webhook] Error renewing subscription on lifecycle event:', err)
          );
        }
        continue;
      }

      // Process New Transcript Content
      if (changeType === 'created' && resource) {
        console.log('[Teams Webhook] New transcript available for resource:', resource);

        // Fetch and ingest transcript
        (async () => {
          try {
            const transcript = await downloadTranscriptContentFromGraph(resource);
            if (!transcript?.text) {
              console.warn('[Teams Webhook] Could not retrieve transcript text for resource:', resource);
              return;
            }

            const result = await ingestTranscriptContent(transcript.text, {
              meetingId: transcript.meetingId,
              transcriptId: transcript.transcriptId,
              fileId: resourceData?.id || transcript.transcriptId,
            });

            console.log('[Teams Webhook] Transcript ingestion completed:', {
              candidate: result.candidateName,
              score: result.score,
              isDuplicate: result.isDuplicate,
            });
          } catch (err: any) {
            console.error('[Teams Webhook] Ingestion worker error:', err.message);
          }
        })();
      }
    }

    // Always respond with HTTP 202 Accepted immediately per Microsoft Graph webhook specification
    return new NextResponse(null, { status: 202 });
  } catch (error: any) {
    console.error('[Teams Webhook] Handler error:', error);
    // Respond with 202 so Microsoft doesn't spam retries on non-recoverable formatting issues
    return new NextResponse(null, { status: 202 });
  }
}
