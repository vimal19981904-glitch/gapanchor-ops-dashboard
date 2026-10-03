import { prisma } from '../lib/prisma';

async function main() {
  const activeAudits = await prisma.leadMonitoringAudit.findMany({
    where: { isActive: true },
    include: { enquiry: true },
    orderBy: { pendingStartTime: 'desc' },
  });

  console.log(`Active Lead Monitoring Audits (${activeAudits.length}):`);
  activeAudits.forEach((a, i) => {
    console.log(`${i+1}. Lead: ${a.enquiry?.participantName || 'N/A'} (${a.enquiry?.email})`);
    console.log(`   Status: ${a.enquiry?.contactStatus} | Started: ${a.pendingStartTime}`);
    console.log(`   1st Alert Sent: ${a.firstAlertSentAt} | Last Alert: ${a.lastAlertSentAt} | Count: ${a.alertCount}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
