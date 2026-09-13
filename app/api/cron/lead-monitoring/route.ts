import { NextRequest, NextResponse } from 'next/server';
import { processPendingLeadsMonitoring } from '@/lib/lead-monitoring';
import { sendLeadAlertEmail, LeadEmailPayload } from '@/lib/email-service';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const isTest = searchParams.get('test') === 'true';

    if (isTest) {
      const recipient = searchParams.get('to') || process.env.ALERT_EMAIL_RECIPIENT || 'avpartners.consultants@outlook.com';
      const now = new Date();

      // Retrieve real Karandeep Singh enquiry from database if available
      const karandeepDb = await prisma.enquiry.findFirst({
        where: { participantName: { contains: 'Karandeep', mode: 'insensitive' } }
      });

      const arrivalDate = karandeepDb?.messageTimestamp 
        ? new Date(karandeepDb.messageTimestamp)
        : (karandeepDb?.dateSubmitted ? new Date(karandeepDb.dateSubmitted) : new Date(now.getTime() - (4 * 3600 * 1000 + 30 * 60 * 1000)));
      
      const breachDate = new Date(arrivalDate.getTime() + (4 * 3600 * 1000));
      const elapsedMs = now.getTime() - arrivalDate.getTime();
      const elapsedHours = Math.floor(elapsedMs / (1000 * 60 * 60));
      const elapsedMins = Math.floor((elapsedMs % (1000 * 60 * 60)) / (1000 * 60));

      const samplePayload: LeadEmailPayload = {
        leadId: karandeepDb?.id || 'cmtz5fd4g00007g4upre57n71',
        leadName: karandeepDb?.participantName || 'Karandeep Singh',
        leadEmail: karandeepDb?.email || 'kdsr000@gmail.com',
        leadPhone: karandeepDb?.phone ? (karandeepDb.phone.startsWith('+') ? karandeepDb.phone : `+${karandeepDb.phone}`) : '+91 9881927282',
        country: karandeepDb?.country || 'India',
        courseOrService: karandeepDb?.trainingType || karandeepDb?.serviceType || 'Manhattan ProActive Training',
        leadQuality: karandeepDb?.leadQuality ? `${karandeepDb.leadQuality} Quality` : 'High Quality',
        leadArrivalTime: arrivalDate.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }),
        slaBreachTime: `${breachDate.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })} (4h SLA Breached)`,
        alertTriggeredTime: now.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }),
        timeInPendingFormatted: `${elapsedHours > 0 ? `${elapsedHours} hours ` : ''}${elapsedMins} minutes`,
        isFirstAlert: true,
        alertCount: 1,
      };

      const emailResult = await sendLeadAlertEmail(samplePayload);

      return NextResponse.json({
        success: emailResult.success,
        mode: 'TEST_TRIGGER',
        recipient,
        payloadSent: samplePayload,
        emailResult,
        note: emailResult.success
          ? 'Upgraded test alert email dispatched successfully!'
          : 'Email trigger attempted.',
      });
    }

    const result = await processPendingLeadsMonitoring();
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
