import { prisma } from '@/lib/prisma';
import { sendLeadAlertEmail, LeadEmailPayload } from '@/lib/email-service';

export async function sendNtfyLeadAlert(payload: LeadEmailPayload): Promise<void> {
  try {
    const topic = process.env.NTFY_TOPIC || 'gapanchor-leads-alert';
    const baseUrl = 'https://dashboard-green-psi-12.vercel.app';
    const title = `❗ 4h Pending SLA: ${payload.leadName}`;
    const message = [
      `Lead: ${payload.leadName}`,
      `Received: ${payload.leadArrivalTime}`,
      `Pending For: ${payload.timeInPendingFormatted}`,
      `Course: ${payload.courseOrService || 'General'}`,
      `Phone: ${payload.leadPhone || 'N/A'}`,
      `Email: ${payload.leadEmail || 'N/A'}`,
      `Country: ${payload.country || 'N/A'}`,
      `Status: Still Pending (Follow-up Required)`,
    ].join('\n');

    await fetch(`https://ntfy.sh/${topic}`, {
      method: 'POST',
      headers: {
        Title: title,
        Priority: 'urgent',
        Click: `${baseUrl}/enquiries`,
      },
      body: message,
    });
  } catch (err: any) {
    console.error('[NTFY SLA Alert] Failed to dispatch push notification:', err?.message || err);
  }
}

export function formatTimeElapsed(milliseconds: number): string {
  const totalMinutes = Math.floor(milliseconds / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes} minutes`;
  }
  return `${hours} hour${hours > 1 ? 's' : ''} ${minutes} minute${minutes > 1 ? 's' : ''}`;
}

export async function processPendingLeadsMonitoring(forceAlert: boolean = false): Promise<{
  success: boolean;
  leadsCheckedCount: number;
  firstAlertsSentCount: number;
  recurringAlertsSentCount: number;
  statusChangesDetectedCount: number;
  errorsEncountered: string[];
  executionDurationMs: number;
}> {
  const startTime = Date.now();
  const errorsEncountered: string[] = [];

  let leadsCheckedCount = 0;
  let firstAlertsSentCount = 0;
  let recurringAlertsSentCount = 0;
  let statusChangesDetectedCount = 0;

  try {
    const now = new Date();
    const fourHoursMs = 4.0 * 60 * 60 * 1000; // 4.0 Hours (240 minutes)
    const thirtyMinutesMs = 30 * 60 * 1000; // 30 Minutes

    // ─── 1. Register or update top 30 most recent Pending leads into LeadMonitoringAudit ────
    const recentEnquiries = await prisma.enquiry.findMany({
      orderBy: [
        { messageTimestamp: 'desc' },
        { createdAt: 'desc' },
      ],
      take: 30,
      include: {
        monitoringAudit: true,
      },
    });

    const pendingEnquiries = recentEnquiries.filter((e) => e.contactStatus === 'Pending');
    leadsCheckedCount = pendingEnquiries.length;

    // Batch register unmonitored pending enquiries
    const unmonitored = pendingEnquiries.filter((e) => !e.monitoringAudit);
    if (unmonitored.length > 0) {
      await prisma.leadMonitoringAudit.createMany({
        data: unmonitored.map((e) => ({
          enquiryId: e.id,
          pendingStartTime: e.messageTimestamp || e.updatedAt || e.createdAt,
          isActive: true,
        })),
        skipDuplicates: true,
      });
    }

    // Reactivate any previously inactive audits that returned to Pending
    const inactiveToReactivate = pendingEnquiries.filter((e) => e.monitoringAudit && !e.monitoringAudit.isActive);
    if (inactiveToReactivate.length > 0) {
      await prisma.leadMonitoringAudit.updateMany({
        where: {
          enquiryId: { in: inactiveToReactivate.map((e) => e.id) },
        },
        data: {
          isActive: true,
          statusChangedAt: null,
        },
      });
    }

    // ─── 2. Detect status changes for leads no longer in Pending status ──────────
    const activeAudits = await prisma.leadMonitoringAudit.findMany({
      where: { isActive: true },
      include: { enquiry: true },
    });

    const auditsToDeactivate = activeAudits.filter((a) => !a.enquiry || a.enquiry.contactStatus !== 'Pending');
    if (auditsToDeactivate.length > 0) {
      await prisma.leadMonitoringAudit.updateMany({
        where: { id: { in: auditsToDeactivate.map((a) => a.id) } },
        data: {
          isActive: false,
          statusChangedAt: now,
        },
      });
      statusChangesDetectedCount = auditsToDeactivate.length;
    }

    // ─── 3. Query top 30 recent pending leads requiring 1st Alert or Recurring Alert ─────
    const recentPendingIds = pendingEnquiries.map((e) => e.id);
    const auditsToMonitor = await prisma.leadMonitoringAudit.findMany({
      where: {
        isActive: true,
        enquiryId: { in: recentPendingIds },
        enquiry: {
          contactStatus: 'Pending',
        },
      },
      include: {
        enquiry: true,
      },
    });

    for (const audit of auditsToMonitor) {
      const enquiry = audit.enquiry;
      if (!enquiry) continue;

      const elapsedMs = now.getTime() - new Date(audit.pendingStartTime).getTime();

      // Threshold 1: Initial 4.0 Hours Inactivity Grace Period
      if (elapsedMs >= fourHoursMs) {
        const arrivalDate = enquiry.messageTimestamp ? new Date(enquiry.messageTimestamp) : new Date(audit.pendingStartTime);
        const breachDate = new Date(arrivalDate.getTime() + fourHoursMs);

        const timeInPendingFormatted = formatTimeElapsed(elapsedMs);
        const leadArrivalTime = arrivalDate.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
        const slaBreachTime = `${breachDate.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })} (4h SLA Breached)`;
        const alertTriggeredTime = now.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

        const payload: LeadEmailPayload = {
          leadId: enquiry.id,
          leadName: enquiry.participantName,
          leadEmail: enquiry.email,
          leadPhone: enquiry.phone,
          country: enquiry.country,
          courseOrService: enquiry.trainingType || enquiry.serviceType || enquiry.topic,
          leadQuality: enquiry.leadQuality,
          leadArrivalTime,
          slaBreachTime,
          alertTriggeredTime,
          timeInPendingFormatted,
          isFirstAlert: !audit.firstAlertSentAt,
          alertCount: audit.alertCount + 1,
        };

        let authFailed = false;
        // Condition A: First Alert (after 4 hours)
        if (!audit.firstAlertSentAt) {
          // Send push notification to mobile phone immediately
          await sendNtfyLeadAlert(payload);
          
          // Non-blocking email attempt in background so SMTP timeouts never delay or fail the SLA check
          sendLeadAlertEmail(payload).catch((err) =>
            console.warn(`[Lead Alert] Email background dispatch failed:`, err?.message || err)
          );

          await prisma.leadMonitoringAudit.update({
            where: { id: audit.id },
            data: {
              firstAlertSentAt: now,
              lastAlertSentAt: now,
              alertCount: { increment: 1 },
            },
          });
          firstAlertsSentCount++;
        }
        // Condition B: Recurring Alert (every 30 minutes thereafter if still Pending, or immediately if forceAlert=true)
        else if (audit.lastAlertSentAt) {
          const timeSinceLastAlertMs = now.getTime() - new Date(audit.lastAlertSentAt).getTime();
          if (forceAlert || timeSinceLastAlertMs >= thirtyMinutesMs) {
            // Send recurring mobile push notification
            await sendNtfyLeadAlert(payload);
            
            // Non-blocking email attempt in background
            sendLeadAlertEmail(payload).catch((err) =>
              console.warn(`[Lead Alert] Email background dispatch failed:`, err?.message || err)
            );

            await prisma.leadMonitoringAudit.update({
              where: { id: audit.id },
              data: {
                lastAlertSentAt: now,
                alertCount: { increment: 1 },
              },
            });
            recurringAlertsSentCount++;
          }
        }

        // If credentials are bad or batch limit reached, don't stall the loop
        if (authFailed) {
          errorsEncountered.push('SMTP Authentication or Rate-Limit detected. Halting remaining email alerts for this cycle.');
          break;
        }

        if (firstAlertsSentCount + recurringAlertsSentCount >= 5) {
          console.log('Batch alert dispatch limit reached (5 alerts). Remainder will process next cycle.');
          break;
        }
      }
    }

    const executionDurationMs = Date.now() - startTime;
    const nextExecutionTime = new Date(now.getTime() + 5 * 60 * 1000); // +5 minutes

    // ─── 4. Log cron execution audit ──────────────────────────────────────────
    await prisma.cronExecutionLog.create({
      data: {
        executionTimestamp: now,
        leadsCheckedCount,
        firstAlertsSentCount,
        recurringAlertsSentCount,
        statusChangesDetectedCount,
        errorsEncountered: errorsEncountered.length > 0 ? JSON.stringify(errorsEncountered) : null,
        executionDurationMs,
        nextExecutionTime,
      },
    });

    return {
      success: true,
      leadsCheckedCount,
      firstAlertsSentCount,
      recurringAlertsSentCount,
      statusChangesDetectedCount,
      errorsEncountered,
      executionDurationMs,
    };
  } catch (error: any) {
    const executionDurationMs = Date.now() - startTime;
    errorsEncountered.push(`Fatal cron execution error: ${error.message}`);

    try {
      await prisma.cronExecutionLog.create({
        data: {
          executionTimestamp: new Date(),
          leadsCheckedCount,
          firstAlertsSentCount,
          recurringAlertsSentCount,
          statusChangesDetectedCount,
          errorsEncountered: JSON.stringify(errorsEncountered),
          executionDurationMs,
        },
      });
    } catch (e) {
      console.error('Failed writing cron error log:', e);
    }

    return {
      success: false,
      leadsCheckedCount,
      firstAlertsSentCount,
      recurringAlertsSentCount,
      statusChangesDetectedCount,
      errorsEncountered,
      executionDurationMs,
    };
  }
}
