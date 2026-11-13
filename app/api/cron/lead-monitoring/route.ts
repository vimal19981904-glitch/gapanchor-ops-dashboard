import { NextRequest, NextResponse } from 'next/server';
import { processPendingLeadsMonitoring, sendNtfyLeadAlert } from '@/lib/lead-monitoring';
import { syncOutlookGraphEnquiries } from '@/lib/outlook-graph-sync';
import { sendLeadAlertEmail, LeadEmailPayload } from '@/lib/email-service';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const isTest = searchParams.get('test') === 'true';
    const forceAlert = searchParams.get('force') === 'true';

    if (isTest) {
      const recipient = searchParams.get('to') || process.env.ALERT_EMAIL_RECIPIENT || 'contact@gapanchor.com';
      const now = new Date();

      // Retrieve Harriet S or Karandeep Singh enquiry from database if available
      const latestPending = await prisma.enquiry.findFirst({
        where: { contactStatus: 'Pending' },
        orderBy: [{ messageTimestamp: 'desc' }, { createdAt: 'desc' }],
      });

      const lead = latestPending || (await prisma.enquiry.findFirst({
        where: { participantName: { contains: 'Karandeep', mode: 'insensitive' } }
      }));

      const arrivalDate = lead?.messageTimestamp 
        ? new Date(lead.messageTimestamp)
        : (lead?.dateSubmitted ? new Date(lead.dateSubmitted) : new Date(now.getTime() - (4 * 3600 * 1000 + 15 * 60 * 1000)));
      
      const breachDate = new Date(arrivalDate.getTime() + (4 * 3600 * 1000));
      const elapsedMs = now.getTime() - arrivalDate.getTime();
      const elapsedHours = Math.floor(elapsedMs / (1000 * 60 * 60));
      const elapsedMins = Math.floor((elapsedMs % (1000 * 60 * 60)) / (1000 * 60));

      const samplePayload: LeadEmailPayload = {
        leadId: lead?.id || 'cmtz5fd4g00007g4upre57n71',
        leadName: lead?.participantName || 'Harriet S',
        leadEmail: lead?.email || 'happyemployee01@gmail.com',
        leadPhone: lead?.phone ? (lead.phone.startsWith('+') ? lead.phone : `+${lead.phone}`) : '+1 6789488641',
        country: lead?.country || 'United States',
        courseOrService: lead?.trainingType || lead?.serviceType || lead?.topic || 'Manhattan Active WMS',
        leadQuality: lead?.leadQuality ? `${lead.leadQuality} Quality` : 'High Quality',
        leadArrivalTime: arrivalDate.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }),
        slaBreachTime: `${breachDate.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })} (4h SLA Breached)`,
        alertTriggeredTime: now.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }),
        timeInPendingFormatted: `${elapsedHours > 0 ? `${elapsedHours} hours ` : ''}${elapsedMins} mins`,
        isFirstAlert: true,
        alertCount: 1,
      };

      // Dispatch to mobile via ntfy immediately
      await sendNtfyLeadAlert(samplePayload);

      // Dispatch non-blocking email in background
      sendLeadAlertEmail(samplePayload).catch((err) =>
        console.warn('[Test Email] Background dispatch error:', err?.message || err)
      );

      return NextResponse.json({
        success: true,
        mode: 'TEST_TRIGGER',
        recipient,
        payloadSent: samplePayload,
        note: 'Live mobile push SLA notification dispatched to ntfy successfully!',
      });
    }

    // ─── 1. Optional Graph Cloud Sync (Intake from contact@gapanchor.com -> Demo enquiry!) ───
    let graphSyncResult: any = null;
    if (searchParams.get('sync') === 'true') {
      try {
        graphSyncResult = await syncOutlookGraphEnquiries();
      } catch (graphErr: any) {
        console.error('Graph Sync failed during cron:', graphErr.message);
        graphSyncResult = { success: false, error: graphErr.message };
      }
    }

    // ─── 2. Run Lead SLA Breach Monitoring & Mobile Push Alerts ───
    const result = await processPendingLeadsMonitoring(forceAlert);
    const recentLogs = await prisma.cronExecutionLog.findMany({
      take: 10,
      orderBy: { executionTimestamp: 'desc' },
    });

    const activePendingMonitored = await prisma.leadMonitoringAudit.findMany({
      where: { isActive: true },
      include: { enquiry: true },
    });

    return NextResponse.json({
      success: result.success,
      timestamp: new Date().toISOString(),
      graphSync: graphSyncResult,
      execution: result,
      activePendingCount: activePendingMonitored.length,
      activePendingLeads: activePendingMonitored.slice(0, 10).map((a) => ({
        auditId: a.id,
        enquiryId: a.enquiryId,
        participantName: a.enquiry?.participantName,
        email: a.enquiry?.email,
        phone: a.enquiry?.phone,
        pendingStartTime: a.pendingStartTime,
        firstAlertSentAt: a.firstAlertSentAt,
        lastAlertSentAt: a.lastAlertSentAt,
        alertCount: a.alertCount,
      })),
      recentCronLogs: recentLogs,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Error processing lead monitoring cron' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
