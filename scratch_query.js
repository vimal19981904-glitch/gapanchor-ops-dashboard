const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const transactions = await prisma.transaction.findMany();
  const sessions = await prisma.session.findMany();
  const enquiries = await prisma.enquiry.findMany();
  const devLogs = await prisma.devLog.findMany();

  console.log('=== TRANSACTIONS SUMMARY ===');
  console.log('Total Transactions:', transactions.length);
  const income = transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
  const expense = transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
  console.log(`Income: ₹${income}, Expense: ₹${expense}, Net: ₹${income - expense}`);
  console.log('By Quarter:', transactions);

  console.log('\n=== SESSIONS (TRAINING OPS) ===');
  console.log(sessions);

  console.log('\n=== ENQUIRIES (LEAD GENERATION / WHATSAPP) ===');
  console.log('Total Enquiries:', enquiries.length);
  console.log(enquiries);

  console.log('\n=== DEV LOGS ===');
  console.log(devLogs);
}

main().catch(console.error).finally(() => prisma.$disconnect());
