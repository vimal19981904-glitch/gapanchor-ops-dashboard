import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const sessions = await prisma.session.findMany({ orderBy: { date: 'desc' } });

    const totalSessions = sessions.length;
    const totalParticipants = sessions.reduce((sum, s) => sum + s.participantsCount, 0);

    const platformCounts: Record<string, number> = {};
    sessions.forEach(s => {
      platformCounts[s.platform] = (platformCounts[s.platform] || 0) + 1;
    });

    return NextResponse.json({
      success: true,
      summary: { totalSessions, totalParticipants, platformCounts },
      sessions,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title, platform, trainer, participantsCount, date, time, location } = body;

    if (!title || !platform) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    const session = await prisma.session.create({
      data: {
        title,
        platform,
        trainer: trainer || 'Arul Xavier',
        participantsCount: parseInt(participantsCount || '0', 10),
        date: date ? new Date(date) : new Date(),
        time: time || '10:00 AM - 01:00 PM IST',
        status: 'Scheduled',
        quarter: 'Q3',
        location: location || 'Online Sandbox',
      },
    });

    return NextResponse.json({ success: true, session });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
