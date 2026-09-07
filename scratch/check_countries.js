const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const enquiries = await prisma.enquiry.findMany({ select: { id: true, country: true, phone: true } });
  const countryCounts = {};
  enquiries.forEach(e => {
    const c = e.country || 'Unknown';
    countryCounts[c] = (countryCounts[c] || 0) + 1;
  });
  console.log('Unique Countries in DB:', Object.keys(countryCounts).length);
  console.log(JSON.stringify(countryCounts, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
