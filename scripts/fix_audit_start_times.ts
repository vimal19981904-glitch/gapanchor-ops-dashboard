import { prisma } from '../lib/prisma';

async function main() {
  const audits = await prisma.leadMonitoringAudit.findMany({
    include: { enquiry: true },
  });

  let updatedCount = 0;
  for (const audit of audits) {
    if (!audit.enquiry) continue;
    const correctStartTime = audit.enquiry.messageTimestamp || audit.enquiry.createdAt || audit.enquiry.updatedAt;
    
    if (correctStartTime && new Date(audit.pendingStartTime).getTime() > new Date(correctStartTime).getTime()) {
      await prisma.leadMonitoringAudit.update({
        where: { id: audit.id },
        data: {
          pendingStartTime: correctStartTime,
        },
      });
      console.log(`Updated audit for ${audit.enquiry.participantName}: pendingStartTime set to ${correctStartTime}`);
      updatedCount++;
    }
  }

  console.log(`✅ Corrected pendingStartTime for ${updatedCount} lead monitoring audits.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
