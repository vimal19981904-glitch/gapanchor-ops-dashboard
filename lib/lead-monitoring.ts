import { prisma } from '@/lib/prisma';
import { sendLeadAlertEmail, LeadEmailPayload } from '@/lib/email-service';

export function formatTimeElapsed(milliseconds: number): string {
  const totalMinutes = Math.floor(milliseconds / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes} minutes`;
  }
  return `${hours} hour${hours > 1 ? 's' : ''} ${minutes} minute${minutes > 1 ? 's' : ''}`;
}

export async function processPendingLeadsMonitoring(): Promise<{
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
    const fourHoursMs = 4 * 60 * 60 * 1000; // 4 Hours
    const thirtyMinutesMs = 30 * 60 * 1000; // 30 Minutes

    // ─── 1. Register or update active Pending leads into LeadMonitoringAudit ────
    const pendingEnquiries = await prisma.enquiry.findMany({
      where: {
        contactStatus: 'Pending',
      },
      include: {
        monitoringAudit: true,
      },
    });

    leadsCheckedCount = pendingEnquiries.length;

    // Batch register unmonitored pending enquiries
    const unmonitored = pendingEnquiries.filter((e) => !e.monitoringAudit);
    if (unmonitored.length > 0) {
      await prisma.leadMonitoringAudit.createMany({
        data: unmonitored.map((e) => ({
          enquiryId: e.id,
          pendingStartTime: e.updatedAt || e.createdAt || e.messageTimestamp,
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

    // ─── 3. Query leads requiring 1st Alert or Recurring Alert ─────────────────
    const auditsToMonitor = await prisma.leadMonitoringAudit.findMany({
      where: {
        isActive: true,
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

      // Threshold 1: Initial 4 Hours Inactivity Grace Period
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
          const emailResult = await sendLeadAlertEmail(payload);
          if (emailResult.success) {
            await prisma.leadMonitoringAudit.update({
              where: { id: audit.id },
              data: {
                firstAlertSentAt: now,
                lastAlertSentAt: now,
                alertCount: { increment: 1 },
              },
            });
            firstAlertsSentCount++;
          } else {
            errorsEncountered.push(`Failed sending 1st alert for lead ${enquiry.id}: ${emailResult.error}`);
            if (
              emailResult.error?.includes('BadCredentials') ||
              emailResult.error?.includes('Username and Password') ||
              emailResult.error?.includes('Invalid login') ||
              emailResult.error?.includes('Too many login attempts') ||
              emailResult.error?.includes('535') ||
              emailResult.error?.includes('454') ||
              emailResult.error?.includes('EAUTH')
            ) {
              authFailed = true;
            }
          }
        }
        // Condition B: Recurring Alert (every 30 minutes thereafter)
        else if (audit.lastAlertSentAt) {
          const timeSinceLastAlertMs = now.getTime() - new Date(audit.lastAlertSentAt).getTime();
          if (timeSinceLastAlertMs >= thirtyMinutesMs) {
            const emailResult = await sendLeadAlertEmail(payload);
            if (emailResult.success) {
              await prisma.leadMonitoringAudit.update({
                where: { id: audit.id },
                data: {
                  lastAlertSentAt: now,
                  alertCount: { increment: 1 },
                },
              });
              recurringAlertsSentCount++;
            } else {
              errorsEncountered.push(`Failed sending recurring alert for lead ${enquiry.id}: ${emailResult.error}`);
              if (
                emailResult.error?.includes('BadCredentials') ||
                emailResult.error?.includes('Username and Password') ||
                emailResult.error?.includes('Invalid login') ||
                emailResult.error?.includes('Too many login attempts') ||
                emailResult.error?.includes('535') ||
                emailResult.error?.includes('454') ||
                emailResult.error?.includes('EAUTH')
              ) {
                authFailed = true;
              }
            }
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
