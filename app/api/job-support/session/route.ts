import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

function computePaymentStatus(due: number, paid: number): 'PAID' | 'PARTIAL' | 'PENDING' {
  if (paid >= due && due > 0) return 'PAID';
  if (paid > 0 && paid < due) return 'PARTIAL';
  return 'PENDING';
}

const DEFAULT_JOB_SUPPORT_SESSIONS = [
  {
    title: 'Cloud Architecture Online Job Support - [Oladayo Olawepo]',
    platform: 'Cloud Architecture',
    trainer: 'Senior Cloud Architect',
    participantsCount: 1,
    currentlyParticipating: 1,
    date: new Date().toISOString(),
    status: 'In Progress',
    location: 'Online Sandbox + Teams Remote Access',
    trainerTotalCost: 45000,
    trainerAmountPaid: 15000,
    trainerAmountDue: 30000,
    participants: [
      { participantName: 'Oladayo Olawepo', amountDue: 75000, amountPaid: 25000, paymentStatus: 'PARTIAL', notes: 'AWS / Cloud Architecture 1-on-1 Support' },
    ],
  },
  {
    title: 'Manhattan WMS 1-on-1 Support - [Sakhr Tantaoui]',
    platform: 'Manhattan WMS',
    trainer: 'Employee A (Manhattan WMS)',
    participantsCount: 1,
    currentlyParticipating: 1,
    date: new Date().toISOString(),
    status: 'Scheduled',
    location: 'Teams Sandbox + AnyDesk',
    trainerTotalCost: 50000,
    trainerAmountPaid: 50000,
    trainerAmountDue: 0,
    participants: [
      { participantName: 'Sakhr Tantaoui', amountDue: 85000, amountPaid: 85000, paymentStatus: 'PAID', notes: 'Manhattan WMS Daily Standup Support' },
    ],
  },
  {
    title: 'Manhattan ProActive Job Support - [Divya Gupta]',
    platform: 'Manhattan ProActive',
    trainer: 'Arul Xavier',
    participantsCount: 1,
    currentlyParticipating: 1,
    date: new Date().toISOString(),
    status: 'In Progress',
    location: 'Online Sandbox + Teams',
    trainerTotalCost: 40000,
    trainerAmountPaid: 20000,
    trainerAmountDue: 20000,
    participants: [
      { participantName: 'Divya Gupta', amountDue: 70000, amountPaid: 35000, paymentStatus: 'PARTIAL', notes: 'ProActive Technical Issue Escalations' },
    ],
  },
];

export async function GET() {
  try {
    // Query sessions tagged with "Job Support" in title or platform
    let sessions = await prisma.session.findMany({
      where: {
        OR: [
          { title: { contains: 'Job Support', mode: 'insensitive' } },
          { platform: { contains: 'Job Support', mode: 'insensitive' } },
          { location: { contains: 'Remote Access', mode: 'insensitive' } },
        ],
      },
      include: {
        participants: {
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { date: 'desc' },
    });

    // If database has no sessions created yet, return pre-populated default job support sessions
    if (sessions.length === 0) {
      return NextResponse.json({
        success: true,
        sessions: DEFAULT_JOB_SUPPORT_SESSIONS.map((s, idx) => ({ id: `default-js-${idx}`, ...s })),
      });
    }

    return NextResponse.json({
      success: true,
      sessions,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      title,
      platform,
      trainer,
      engineer,
      participantsCount,
      currentlyParticipating,
      date,
      location,
      status,
      trainerTotalCost = 0,
      trainerAmountPaid = 0,
      trainerAmountDue,
      participants = [],
    } = body;

    if (!title || !platform) {
      return NextResponse.json({ success: false, error: 'Session Title and Platform are required.' }, { status: 400 });
    }

    const assignedEngineer = engineer || trainer || 'Employee A (Manhattan WMS)';
    const totalEnrolled = parseInt(participantsCount || (Array.isArray(participants) ? participants.length : 1), 10);
    const activeCount = parseInt(currentlyParticipating || 1, 10);

    const tCost = parseFloat(trainerTotalCost || 0);
    const tPaid = parseFloat(trainerAmountPaid || 0);
    const tDue = trainerAmountDue !== undefined ? parseFloat(trainerAmountDue) : Math.max(0, tCost - tPaid);

    const session = await prisma.session.create({
      data: {
        title: title.includes('Job Support') ? title : `${title} - Job Support`,
        platform,
        trainer: assignedEngineer,
        participantsCount: totalEnrolled,
        currentlyParticipating: activeCount,
        date: date ? new Date(date) : new Date(),
        time: 'Flexible / On-Demand 1-on-1',
        status: status || 'In Progress',
        quarter: 'Q3',
        location: location || 'Online Sandbox + Remote Access',
        trainerTotalCost: tCost,
        trainerAmountPaid: tPaid,
        trainerAmountDue: tDue,
        participants: {
          create: participants.map((p: any) => {
            const due = parseFloat(p.amountDue || 0);
            const paid = parseFloat(p.amountPaid || 0);
            return {
              participantName: p.participantName || p.name || 'Client',
              amountDue: due,
              amountPaid: paid,
              paymentStatus: computePaymentStatus(due, paid),
              notes: p.notes || '1-on-1 Support Client',
            };
          }),
        },
      },
      include: {
        participants: true,
      },
    });

    return NextResponse.json({ success: true, session });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const {
      id,
      title,
      platform,
      trainer,
      engineer,
      participantsCount,
      currentlyParticipating,
      date,
      location,
      status,
      trainerTotalCost = 0,
      trainerAmountPaid = 0,
      trainerAmountDue,
      participants = [],
    } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Session ID is required for update.' }, { status: 400 });
    }

    // Handle updating default simulated session IDs
    if (id.startsWith('default-js-')) {
      return NextResponse.json({
        success: true,
        session: { id, title, platform, trainer: engineer || trainer, date, location, trainerTotalCost, trainerAmountPaid, trainerAmountDue, participants },
      });
    }

    const assignedEngineer = engineer || trainer || 'Employee A (Manhattan WMS)';
    const totalEnrolled = parseInt(participantsCount || (Array.isArray(participants) ? participants.length : 1), 10);
    const activeCount = parseInt(currentlyParticipating || 1, 10);

    const tCost = parseFloat(trainerTotalCost || 0);
    const tPaid = parseFloat(trainerAmountPaid || 0);
    const tDue = trainerAmountDue !== undefined ? parseFloat(trainerAmountDue) : Math.max(0, tCost - tPaid);

    await prisma.sessionParticipant.deleteMany({
      where: { sessionId: id },
    });

    const updatedSession = await prisma.session.update({
      where: { id },
      data: {
        title,
        platform,
        trainer: assignedEngineer,
        participantsCount: totalEnrolled,
        currentlyParticipating: activeCount,
        date: date ? new Date(date) : new Date(),
        location: location || 'Online Sandbox + Remote Access',
        status: status || 'In Progress',
        trainerTotalCost: tCost,
        trainerAmountPaid: tPaid,
        trainerAmountDue: tDue,
        participants: {
          create: participants.map((p: any) => {
            const due = parseFloat(p.amountDue || 0);
            const paid = parseFloat(p.amountPaid || 0);
            return {
              participantName: p.participantName || p.name || 'Client',
              amountDue: due,
              amountPaid: paid,
              paymentStatus: computePaymentStatus(due, paid),
              notes: p.notes || '1-on-1 Support Client',
            };
          }),
        },
      },
      include: {
        participants: true,
      },
    });

    return NextResponse.json({ success: true, session: updatedSession });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Session ID is required.' }, { status: 400 });
    }

    if (!id.startsWith('default-js-')) {
      await prisma.session.delete({
        where: { id },
      });
    }

    return NextResponse.json({ success: true, message: 'Job Support session deleted successfully.' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
