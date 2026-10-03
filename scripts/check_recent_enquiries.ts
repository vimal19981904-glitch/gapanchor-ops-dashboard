import { prisma } from '../lib/prisma';

async function main() {
  const recent = await prisma.enquiry.findMany({
    orderBy: [
      { messageTimestamp: 'desc' },
      { createdAt: 'desc' }
    ],
    take: 30,
    select: {
      id: true,
      participantName: true,
      email: true,
      phone: true,
      contactStatus: true,
      messageTimestamp: true,
      createdAt: true,
      updatedAt: true,
    }
  });

  console.log(`Found ${recent.length} recent enquiries:`);
  recent.forEach((e, idx) => {
    console.log(`${idx + 1}. [${e.contactStatus}] ${e.participantName} (${e.email || 'no email'}) - MsgTime: ${e.messageTimestamp} | Created: ${e.createdAt}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
