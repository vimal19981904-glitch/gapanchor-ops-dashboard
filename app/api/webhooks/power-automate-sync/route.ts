import { NextRequest, NextResponse } from 'next/server';
import { syncRecentOutlookEnquiries } from '@/lib/outlook-webhook-sync';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * Power Automate Automated Sync Endpoint
 * Called via HTTP Action in Power Automate when an email arrives.
 * Optimized for real-time webhooks: checks the latest incoming emails and
 * inserts new enquiries into PostgreSQL in ~1-2 seconds without timing out.
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    let payload: any = {};
    try {
      const text = await request.text();
      if (text) {
        payload = JSON.parse(text);
      }
    } catch {
      // Body is optional
    }

    console.log('[Power Automate Webhook] Trigger received:', {
      source: payload.source || 'Power Automate Flow',
      keyword: payload.keyword || payload.course || 'Unknown',
      timestamp: new Date().toISOString(),
    });

    // 1. Run Fast Microsoft Graph Cloud Sync (Checks top 15 emails, inserts new lead in ~1-2 seconds!)
    const syncResult = await syncRecentOutlookEnquiries(15);

    // 2. Fetch latest 5 enquiries for immediate feedback
    const latestLeads = await prisma.enquiry.findMany({
      take: 5,
      orderBy: { messageTimestamp: 'desc' },
      select: {
        id: true,
        participantName: true,
        email: true,
        phone: true,
        country: true,
        trainingType: true,
        contactStatus: true,
        leadQuality: true,
        messageTimestamp: true,
      },
    });

    const durationMs = Date.now() - startTime;

    return NextResponse.json({
      success: syncResult.success,
      triggerSource: 'power_automate_flow',
      message: syncResult.success
        ? `Microsoft Graph fast sync completed in ${durationMs}ms: ${syncResult.insertedCount} new enquiries inserted.`
        : `Graph Sync notice: ${syncResult.error || 'Failed to complete full sync'}`,
      durationMs,
      timestamp: new Date().toISOString(),
      syncSummary: {
        checkedCount: syncResult.checkedCount,
        insertedCount: syncResult.insertedCount,
      },
      latestLeads,
    });
  } catch (error: any) {
    console.error('[Power Automate Webhook] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Internal server error triggering Graph sync',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
