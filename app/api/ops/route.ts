import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getQuarterFromDate } from '@/lib/utils';

// Helper to determine payment status
function computePaymentStatus(due: number, paid: number): 'PAID' | 'PARTIAL' | 'PENDING' {
  if (paid >= due && due > 0) return 'PAID';
  if (paid > 0 && paid < due) return 'PARTIAL';
  return 'PENDING';
}


const DEFAULT_TRAINERS: Record<string, string> = {
  'Manhattan WMS': 'Arul Xavier',
  'Blue Yonder': 'Senior Supply Chain Specialist',
  'Kinaxis': 'Arul Xavier',
  'SAP S/4HANA': 'SAP Certified Principal',
};

const DEFAULT_MASTER_PARTICIPANTS = [
  'John Doe',
  'Jane Smith',
  'Mike Johnson',
  'Sarah Lee',
  'Tom Wilson',
  'Alex Turner',
  'David Miller',
  'Emma Davis',
  'Robert Taylor',
  'Sophia White',
];

export async function GET() {
  try {
    const sessions = await prisma.session.findMany({
      include: {
        participants: {
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { date: 'desc' },
    });

    // Fetch existing participant names from WhatsApp/Outlook Enquiries to build master list
    const enquiries = await prisma.enquiry.findMany({
      select: { participantName: true },
    });
    const enquiryNames = Array.from(new Set(enquiries.map((e) => e.participantName).filter(Boolean)));
    const masterParticipants = Array.from(new Set([...DEFAULT_MASTER_PARTICIPANTS, ...enquiryNames]));

    let totalSessions = sessions.length;
    let totalParticipants = 0;
    let totalCurrentlyParticipating = 0;
    let grandPaidCount = 0;
    let grandPartialCount = 0;
    let grandPendingCount = 0;

    const platformCounts: Record<string, number> = {};

    const enrichedSessions = sessions.map((s) => {
      platformCounts[s.platform] = (platformCounts[s.platform] || 0) + 1;
      totalParticipants += s.participantsCount;
      totalCurrentlyParticipating += s.currentlyParticipating;

      let paidCount = 0;
      let partialCount = 0;
      let pendingCount = 0;

      s.participants.forEach((p) => {
        if (p.paymentStatus === 'PAID') paidCount++;
        else if (p.paymentStatus === 'PARTIAL') partialCount++;
        else pendingCount++;
      });

      grandPaidCount += paidCount;
      grandPartialCount += partialCount;
      grandPendingCount += pendingCount;

      return {
        ...s,
        paymentSummary: {
          paidCount,
          partialCount,
          pendingCount,
        },
      };
    });

    return NextResponse.json({
      success: true,
      summary: {
        totalSessions,
        totalParticipants,
        totalCurrentlyParticipating,
        platformCounts,
        paymentSummary: {
          paidCount: grandPaidCount,
          partialCount: grandPartialCount,
          pendingCount: grandPendingCount,
        },
      },
      masterParticipants,
      sessions: enrichedSessions,
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
      participantsCount,
      currentlyParticipating,
      date,
      time,
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

    const defaultTrainer = DEFAULT_TRAINERS[platform] || 'Arul Xavier';
    const totalEnrolled = parseInt(participantsCount || (Array.isArray(participants) ? participants.length : 0), 10);
    const activeCount = parseInt(currentlyParticipating || 0, 10);

    const tCost = parseFloat(trainerTotalCost || 0);
    const tPaid = parseFloat(trainerAmountPaid || 0);
    const tDue = trainerAmountDue !== undefined ? parseFloat(trainerAmountDue) : Math.max(0, tCost - tPaid);

    const session = await prisma.session.create({
      data: {
        title,
        platform,
        trainer: trainer || defaultTrainer,
        participantsCount: totalEnrolled,
        currentlyParticipating: activeCount,
        date: date ? new Date(date) : new Date(),
        time: time || '10:00 AM - 01:00 PM IST',
        status: status || 'Scheduled',
        quarter: 'Q3',
        location: location || 'Online Sandbox + Teams',
        trainerTotalCost: tCost,
        trainerAmountPaid: tPaid,
        trainerAmountDue: tDue,
        participants: {
          create: participants.map((p: any) => {
            const due = parseFloat(p.amountDue || 0);
            const paid = parseFloat(p.amountPaid || 0);
            return {
              participantName: p.participantName || p.name || 'Participant',
              amountDue: due,
              amountPaid: paid,
              paymentStatus: computePaymentStatus(due, paid),
              notes: p.notes || null,
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
      participantsCount,
      currentlyParticipating,
      date,
      time,
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

    const defaultTrainer = DEFAULT_TRAINERS[platform] || 'Arul Xavier';
    const totalEnrolled = parseInt(participantsCount || (Array.isArray(participants) ? participants.length : 0), 10);
    const activeCount = parseInt(currentlyParticipating || 0, 10);

    const tCost = parseFloat(trainerTotalCost || 0);
    const tPaid = parseFloat(trainerAmountPaid || 0);
    const tDue = trainerAmountDue !== undefined ? parseFloat(trainerAmountDue) : Math.max(0, tCost - tPaid);

    // Delete existing participants and recreate with updated payment information
    await prisma.sessionParticipant.deleteMany({
      where: { sessionId: id },
    });

    const updatedSession = await prisma.session.update({
      where: { id },
      data: {
        title,
        platform,
        trainer: trainer || defaultTrainer,
        participantsCount: totalEnrolled,
        currentlyParticipating: activeCount,
        date: date ? new Date(date) : new Date(),
        time: time || '10:00 AM - 01:00 PM IST',
        status: status || 'Scheduled',
        location: location || 'Online Sandbox + Teams',
        trainerTotalCost: tCost,
        trainerAmountPaid: tPaid,
        trainerAmountDue: tDue,
        participants: {
          create: participants.map((p: any) => {
            const due = parseFloat(p.amountDue || 0);
            const paid = parseFloat(p.amountPaid || 0);
            return {
              participantName: p.participantName || p.name || 'Participant',
              amountDue: due,
              amountPaid: paid,
              paymentStatus: computePaymentStatus(due, paid),
              notes: p.notes || null,
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
    let id = searchParams.get('id');

    if (!id) {
      try {
        const body = await request.json();
        id = body.id || body.sessionId;
      } catch (e) {
        // ignore
      }
    }

    if (!id) {
      return NextResponse.json({ success: false, error: 'Session ID is required.' }, { status: 400 });
    }

    // 1. Fetch existing session with participants for purge log archive
    const existing = await prisma.session.findUnique({
      where: { id },
      include: { participants: true },
    });

    if (existing) {
      try {
        const auditLog = await prisma.integrationConfig.findUnique({
          where: { service: 'session_purge_log' },
        });
        const currentLogs = auditLog?.metadata ? JSON.parse(auditLog.metadata) : [];
        currentLogs.unshift({
          id: existing.id,
          title: existing.title,
          platform: existing.platform,
          trainer: existing.trainer,
          participantsCount: existing.participantsCount,
          date: existing.date,
          participants: existing.participants,
          deletedAt: new Date().toISOString(),
        });

        await prisma.integrationConfig.upsert({
          where: { service: 'session_purge_log' },
          update: {
            metadata: JSON.stringify(currentLogs.slice(0, 500)),
            lastSynced: new Date(),
          },
          create: {
            service: 'session_purge_log',
            connected: true,
            metadata: JSON.stringify(currentLogs.slice(0, 500)),
            lastSynced: new Date(),
          },
        });
      } catch (logErr) {
        console.error('Session purge audit log error:', logErr);
      }

      // 2. Perform actual deletion from Session table
      await prisma.session.delete({
        where: { id },
      });
    }

    return NextResponse.json({ success: true, message: 'Session batch deleted successfully and archived.' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

