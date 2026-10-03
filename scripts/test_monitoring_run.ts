import { processPendingLeadsMonitoring } from '../lib/lead-monitoring';
import { prisma } from '../lib/prisma';

async function main() {
  console.log('Running processPendingLeadsMonitoring() for top 30 recent enquiries...');
  const res = await processPendingLeadsMonitoring();
  console.log('Execution result:', JSON.stringify(res, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
