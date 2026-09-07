const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function normalizeCountry(phone, rawCountry) {
  let cleaned = (phone || '').replace(/[^\d+]/g, '');
  if (cleaned.includes('+')) {
    cleaned = '+' + cleaned.replace(/\+/g, '');
  }

  // Country Code rules based on phone number prefix
  if (cleaned.startsWith('+91') || (cleaned.length === 10 && /^[6789]/.test(cleaned)) || (cleaned.length === 12 && cleaned.startsWith('91'))) {
    return 'India';
  }
  if (cleaned.startsWith('+1') || (cleaned.length === 11 && cleaned.startsWith('1'))) {
    return 'USA';
  }
  if (cleaned.startsWith('+44')) {
    return 'United Kingdom';
  }
  if (cleaned.startsWith('+971')) {
    return 'United Arab Emirates';
  }
  if (cleaned.startsWith('+966')) {
    return 'Saudi Arabia';
  }
  if (cleaned.startsWith('+33')) {
    return 'France';
  }
  if (cleaned.startsWith('+49')) {
    return 'Germany';
  }
  if (cleaned.startsWith('+32')) {
    return 'Belgium';
  }
  if (cleaned.startsWith('+31')) {
    return 'Netherlands';
  }
  if (cleaned.startsWith('+34')) {
    return 'Spain';
  }
  if (cleaned.startsWith('+62')) {
    return 'Indonesia';
  }
  if (cleaned.startsWith('+52')) {
    return 'Mexico';
  }

  // Sub-region / State / City fallback mapping
  const text = (rawCountry || '').trim().toLowerCase();
  if (!text || text === 'unknown' || text === 'n/a') {
    return 'India';
  }

  if (
    text.includes('india') || text.includes('karnataka') || text.includes('gujarat') ||
    text.includes('madhya pradesh') || text.includes('maharashtra') || text.includes('uttar pradesh') ||
    text.includes('bangalore') || text.includes('ahmedabad') || text.includes('delhi') ||
    text.includes('mumbai') || text.includes('punjab') || text.includes('haryana') ||
    text.includes('kerala') || text.includes('tamil nadu') || text.includes('telangana') ||
    text.includes('andhra') || text.includes('rajasthan') || text.includes('baghpat') ||
    text.includes('baraut') || text.includes('gwalior') || text.includes('kalyan') ||
    text.includes('gundlupet') || text.includes('malhargarh')
  ) {
    return 'India';
  }

  if (
    text.includes('united states') || text.includes('usa') || text.includes('us') ||
    text.includes('kansas') || text.includes('missouri') || text.includes('california') ||
    text.includes('north carolina') || text.includes('ohio') || text.includes('new hampshire') ||
    text.includes('michigan') || text.includes('illinois') || text.includes('massachusetts') ||
    text.includes('texas') || text.includes('new york') || text.includes('georgia') ||
    text.includes('pennsylvania') || text.includes('florida')
  ) {
    return 'USA';
  }

  if (text.includes('canada') || text.includes('alberta') || text.includes('ontario') || text.includes('toronto') || text.includes('nova scotia') || text.includes('prince edward')) {
    return 'Canada';
  }

  if (text.includes('mexico') || text.includes('gomez farias') || text.includes('sayula') || text.includes('jal')) {
    return 'Mexico';
  }

  if (text.includes('united kingdom') || text.includes('uk') || text.includes('england') || text.includes('scotland') || text.includes('wales')) {
    return 'United Kingdom';
  }

  return rawCountry.trim();
}

async function main() {
  const enquiries = await prisma.enquiry.findMany();
  let updated = 0;

  for (const e of enquiries) {
    const normalized = normalizeCountry(e.phone, e.country);
    if (normalized !== e.country) {
      await prisma.enquiry.update({
        where: { id: e.id },
        data: { country: normalized },
      });
      updated++;
    }
  }

  console.log(`Updated ${updated} enquiry records with normalized country names.`);

  const remaining = await prisma.enquiry.findMany({ select: { country: true } });
  const counts = {};
  remaining.forEach(r => { counts[r.country] = (counts[r.country] || 0) + 1; });
  console.log('Unique Countries after migration:');
  console.log(JSON.stringify(counts, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
