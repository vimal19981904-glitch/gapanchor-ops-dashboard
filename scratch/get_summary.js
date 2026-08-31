const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const transactions = await prisma.transaction.findMany();
  console.log('=== ALL TRANSACTIONS ===');
  console.table(transactions);
  
  const summaryByQuarter = {};
  for (const t of transactions) {
    const q = t.quarter || 'Unknown';
    if (!summaryByQuarter[q]) summaryByQuarter[q] = { income: 0, expense: 0, count: 0, byCategory: {} };
    if (t.type === 'income') summaryByQuarter[q].income += t.amount;
    if (t.type === 'expense') summaryByQuarter[q].expense += t.amount;
    summaryByQuarter[q].count++;
    
    if (!summaryByQuarter[q].byCategory[t.category]) summaryByQuarter[q].byCategory[t.category] = 0;
    summaryByQuarter[q].byCategory[t.category] += t.amount;
  }
  
  console.log('\n=== SUMMARY BY QUARTER ===');
  console.log(JSON.stringify(summaryByQuarter, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
