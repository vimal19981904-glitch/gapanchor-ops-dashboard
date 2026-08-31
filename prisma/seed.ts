import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding GapAnchor Ops Dashboard database...');

  // ─── Integration Configs ──────────────────────────
  await prisma.integrationConfig.upsert({
    where: { service: 'microsoft_graph' },
    update: {},
    create: {
      service: 'microsoft_graph',
      connected: false,
      metadata: JSON.stringify({
        outlookEmail: 'avpartners.consultants@outlook.com',
        scope: ['Mail.Read', 'Calendars.Read'],
      }),
    },
  });

  await prisma.integrationConfig.upsert({
    where: { service: 'whatsapp' },
    update: {},
    create: {
      service: 'whatsapp',
      connected: true,
      metadata: JSON.stringify({
        phoneNumber: '+91 7598 505 274',
        businessAccountId: 'act_gapanchor_7598505274',
      }),
    },
  });

  await prisma.integrationConfig.upsert({
    where: { service: 'github' },
    update: {},
    create: {
      service: 'github',
      connected: false,
      metadata: JSON.stringify({ repo: '' }),
    },
  });

  // ─── Finance Transactions ─────────────────────────
  const transactions = [
    { date: new Date('2026-07-28'), type: 'income', sourceOrCategory: 'Training Fees', platform: 'Manhattan WMS', amount: 450000, paymentMethod: 'UPI', notes: 'Corporate Batch #14 WMS Deep Dive', quarter: 'Q3', year: 2026, origin: 'manual' },
    { date: new Date('2026-07-25'), type: 'income', sourceOrCategory: 'Consulting', platform: 'Kinaxis', amount: 280000, paymentMethod: 'Bank Transfer', notes: 'Supply Chain Alignment Audit - Milestone 1', quarter: 'Q3', year: 2026, origin: 'manual' },
    { date: new Date('2026-07-20'), type: 'expense', sourceOrCategory: 'Infrastructure', amount: 45000, paymentMethod: 'Credit Card', notes: 'AWS Lab Sandbox Instances & Cloud Lab', quarter: 'Q3', year: 2026, origin: 'outlook_email' },
    { date: new Date('2026-07-15'), type: 'income', sourceOrCategory: 'Training Fees', platform: 'Blue Yonder', amount: 320000, paymentMethod: 'UPI', notes: 'Advanced Demand Planning Bootcamp', quarter: 'Q3', year: 2026, origin: 'manual' },
    { date: new Date('2026-07-10'), type: 'expense', sourceOrCategory: 'Marketing', amount: 65000, paymentMethod: 'UPI', notes: 'LinkedIn Ads for Q3 Executive Cohorts', quarter: 'Q3', year: 2026, origin: 'manual' },
    { date: new Date('2026-07-02'), type: 'expense', sourceOrCategory: 'Software', amount: 18500, paymentMethod: 'Credit Card', notes: 'Zoom Enterprise & WhatsApp Cloud API usage', quarter: 'Q3', year: 2026, origin: 'outlook_email' },
    { date: new Date('2026-06-25'), type: 'income', sourceOrCategory: 'Training Fees', platform: 'SAP S/4HANA', amount: 510000, paymentMethod: 'Bank Transfer', notes: 'SAP MM/WM Enterprise Training Cohort', quarter: 'Q2', year: 2026, origin: 'manual' },
    { date: new Date('2026-06-18'), type: 'expense', sourceOrCategory: 'Ops', amount: 55000, paymentMethod: 'Cash', notes: 'Training Materials, Badges & Venue Logistics', quarter: 'Q2', year: 2026, origin: 'manual' },
    { date: new Date('2026-05-12'), type: 'income', sourceOrCategory: 'Consulting', platform: 'Manhattan WMS', amount: 375000, paymentMethod: 'Bank Transfer', notes: 'WMS Process Audit & Optimization Milestone 2', quarter: 'Q2', year: 2026, origin: 'manual' },
    { date: new Date('2026-04-05'), type: 'income', sourceOrCategory: 'Training Fees', platform: 'Blue Yonder', amount: 290000, paymentMethod: 'UPI', notes: 'BY Luminate Planning Weekend Cohort', quarter: 'Q2', year: 2026, origin: 'manual' },
  ];

  for (const tx of transactions) {
    await prisma.transaction.create({ data: tx });
  }

  // ─── Training Sessions ────────────────────────────
  const sessions = [
    { title: 'Manhattan WMS Architecture & Wave Management', platform: 'Manhattan WMS', trainer: 'Arul Xavier', participantsCount: 28, date: new Date('2026-08-05'), time: '10:00 AM - 01:00 PM IST', status: 'Scheduled', quarter: 'Q3', location: 'Online Sandbox + Teams' },
    { title: 'Blue Yonder Demand & Fulfillment Masterclass', platform: 'Blue Yonder', trainer: 'Senior Supply Chain Specialist', participantsCount: 22, date: new Date('2026-08-01'), time: '02:00 PM - 05:00 PM IST', status: 'In Progress', quarter: 'Q3', location: 'Online Sandbox' },
    { title: 'Kinaxis RapidResponse Control Tower Immersion', platform: 'Kinaxis', trainer: 'Arul Xavier', participantsCount: 35, date: new Date('2026-07-24'), time: '09:30 AM - 12:30 PM IST', status: 'Completed', quarter: 'Q3', location: 'HYD Enterprise Center' },
    { title: 'SAP S/4HANA Supply Chain & Logistics Integration', platform: 'SAP S/4HANA', trainer: 'SAP Certified Principal', participantsCount: 40, date: new Date('2026-07-14'), time: '10:00 AM - 04:00 PM IST', status: 'Completed', quarter: 'Q3', location: 'BLR Partner Hub' },
  ];

  for (const s of sessions) {
    await prisma.session.create({ data: s });
  }

  // ─── WhatsApp Enquiries ───────────────────────────
  const enquiries = [
    { participantName: 'Rohan Sharma', phone: '+91 98765 43210', topic: 'Manhattan WMS Batch Schedule Inquiry', lastMessage: 'Hi GapAnchor team, when is the next Manhattan WMS weekend cohort starting?', messageTimestamp: new Date('2026-08-02T07:15:00Z'), isStale: false, status: 'Open', source: 'whatsapp' },
    { participantName: 'Priya Nair', phone: '+91 91234 56789', topic: 'Corporate Invoice Receipt Request', lastMessage: 'Please share the GST invoice for the Blue Yonder training fees paid yesterday.', messageTimestamp: new Date('2026-08-01T10:20:00Z'), isStale: true, staleReason: 'No response for over 22 hours', status: 'Action Required', source: 'whatsapp' },
    { participantName: 'Vikram Mehta', phone: '+91 99887 76655', topic: 'Kinaxis Certification Eligibility', lastMessage: 'Is there a prerequisite test before taking the Kinaxis RapidResponse module?', messageTimestamp: new Date('2026-07-31T14:45:00Z'), isStale: true, staleReason: 'No response for 42 hours', status: 'Action Required', source: 'whatsapp' },
    { participantName: 'Ananya Roy', phone: '+91 98112 23344', topic: 'SAP S/4HANA Group Discount', lastMessage: 'We have 5 engineers from our team enrolling for SAP WM. Any group discount?', messageTimestamp: new Date('2026-08-02T08:05:00Z'), isStale: false, status: 'Active', source: 'whatsapp' },
    { participantName: 'Deepak Patel', phone: '+91 87654 32109', topic: 'Blue Yonder Demo Access', lastMessage: 'Can I get sandbox access to Blue Yonder Luminate for practice before the session?', messageTimestamp: new Date('2026-08-02T06:30:00Z'), isStale: false, status: 'Open', source: 'whatsapp' },
    { participantName: 'Sneha Iyer', phone: '+91 76543 21098', topic: 'Manhattan WMS Certification Timeline', lastMessage: 'How long does the Manhattan WMS certification track take? Is it self-paced?', messageTimestamp: new Date('2026-07-30T11:00:00Z'), isStale: true, staleReason: 'No response for 68 hours', status: 'Action Required', source: 'whatsapp' },
  ];

  for (const e of enquiries) {
    await prisma.enquiry.create({ data: e });
  }

  // ─── Dev Progress ─────────────────────────────────
  const devLogs = [
    { quarter: 'Q3 2026', title: 'GapAnchor Ops Dashboard v2 Enterprise Build', type: 'feature', description: 'Full enterprise rebuild: TypeScript, Tailwind, SQLite/Prisma, live Graph API OAuth2, WhatsApp Cloud API, GitHub integration, dark/light mode.', date: new Date('2026-08-02'), shippedBy: 'Antigravity Team' },
    { quarter: 'Q3 2026', title: 'Enquiry Process Button & SQLite Persistence', type: 'feature', description: 'Added Process button on WhatsApp enquiries that writes to the enquiries table with timestamp and notes.', date: new Date('2026-08-02'), shippedBy: 'Antigravity Team' },
    { quarter: 'Q2 2026', title: 'Automated Certificate Verification Portal', type: 'feature', description: 'Shipped online verification portal for GapAnchor training program graduates.', date: new Date('2026-06-20'), shippedBy: 'Antigravity Team' },
    { quarter: 'Q2 2026', title: 'Manhattan & Kinaxis Live Lab Environment', type: 'infra', description: 'Configured dedicated cloud sandbox instances for hands-on student practice.', date: new Date('2026-06-10'), shippedBy: 'DevOps' },
  ];

  for (const d of devLogs) {
    await prisma.devLog.create({ data: d });
  }

  console.log('✅ Seed complete!');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
