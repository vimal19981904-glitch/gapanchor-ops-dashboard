import { NextRequest, NextResponse } from 'next/server';
import {
  createOrRenewTranscriptSubscription,
  getSavedSubscription,
} from '@/lib/teams-transcript-service';

export const dynamic = 'force-dynamic';

/**
 * Microsoft Graph Teams Transcript Subscription Lifecycle & Renewal Cron
 * 
 * Invoked periodically (or on demand) to ensure the change notification subscription
 * remains active and does not lapse past Microsoft's ~3-day expiration window.
 */

export async function GET(request: NextRequest) {
  return handleRenewal(request);
}

export async function POST(request: NextRequest) {
  return handleRenewal(request);
}

async function handleRenewal(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const force = searchParams.get('force') === 'true';

    const currentSub = await getSavedSubscription();
    let hoursRemaining = 0;
    if (currentSub?.expirationDateTime) {
      hoursRemaining = (new Date(currentSub.expirationDateTime).getTime() - Date.now()) / (1000 * 3600);
    }

    // Attempt creation or renewal
    const result = await createOrRenewTranscriptSubscription(force);

    return NextResponse.json({
      success: result.success,
      isNew: result.isNew,
      subscriptionId: result.subscription?.id,
      expirationDateTime: result.subscription?.expirationDateTime,
      hoursRemaining: result.subscription?.expirationDateTime
        ? ((new Date(result.subscription.expirationDateTime).getTime() - Date.now()) / (1000 * 3600)).toFixed(1)
        : null,
      error: result.error,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Cron /api/cron/renew-teams-subscription] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to process subscription renewal',
      },
      { status: 500 }
    );
  }
}
