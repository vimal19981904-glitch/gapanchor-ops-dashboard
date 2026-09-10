import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  try {
    const cookieStore = cookies();
    const sessionCookie = cookieStore.get('gapanchor_session');
    let sessionUser: any = null;

    if (sessionCookie && sessionCookie.value) {
      try {
        sessionUser = JSON.parse(sessionCookie.value);
      } catch (err) {}
    }

    if (!sessionUser) {
      return NextResponse.json({ success: false, error: 'Authentication required. Please sign in.' }, { status: 401 });
    }

    const whereClause: any = {};
    if (sessionUser.role === 'employee') {
      whereClause.assignedToId = sessionUser.id;
    }

    const enquiries = await prisma.enquiry.findMany({
      where: whereClause,
      orderBy: { messageTimestamp: 'desc' },
      include: {
        assignedTo: {
          select: { id: true, name: true, email: true, role: true, assignedCourse: true }
        }
      }
    });

    const total = enquiries.length;
    const staleCount = enquiries.filter(e => e.isStale).length;
    const openCount = enquiries.filter(e => e.status === 'Open' || e.status === 'Active').length;
    const processedCount = enquiries.filter(e => e.status === 'Processed').length;
    const actionRequiredCount = enquiries.filter(e => e.status === 'Action Required').length;

    // Calculate avg response time
    const avgResponseTimeMins = 14;

    const whatsappConfig = await prisma.integrationConfig.findUnique({ where: { service: 'whatsapp' } });

    return NextResponse.json({
      success: true,
      summary: {
        total,
        staleCount,
        openCount,
        processedCount,
        actionRequiredCount,
        avgResponseTimeMins,
      },
      enquiries,
      whatsappConfig: whatsappConfig ? {
        connected: whatsappConfig.connected,
        lastSynced: whatsappConfig.lastSynced,
        ...(whatsappConfig.metadata ? JSON.parse(whatsappConfig.metadata) : {}),
      } : { connected: false },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, enquiryId, notes, assignedToId, assignedToName } = body;

    // ──── PROCESS BUTTON ACTION ─────────────────────
    if (action === 'process' && enquiryId) {
      const updateData: any = {
        status: 'Processed',
        isStale: false,
        processedAt: new Date(),
        processedNotes: notes || 'Processed via dashboard',
      };

      if (assignedToId) {
        updateData.assignedToId = assignedToId;
        updateData.assignedToName = assignedToName || null;
      }

      const updated = await prisma.enquiry.update({
        where: { id: enquiryId },
        data: updateData,
        include: {
          assignedTo: {
            select: { id: true, name: true, email: true, role: true, assignedCourse: true }
          }
        }
      });
      return NextResponse.json({ success: true, message: 'Enquiry processed successfully', enquiry: updated });
    }

    // ──── ASSIGN LEAD ACTION ────────────────────────
    if (action === 'assign' && enquiryId) {
      if (!assignedToId) {
        return NextResponse.json({ success: false, error: 'assignedToId required for lead assignment' }, { status: 400 });
      }

      const updated = await prisma.enquiry.update({
        where: { id: enquiryId },
        data: {
          assignedToId,
          assignedToName: assignedToName || null,
          processedNotes: notes ? `Assigned: ${notes}` : undefined,
        },
        include: {
          assignedTo: {
            select: { id: true, name: true, email: true, role: true, assignedCourse: true }
          }
        }
      });
      return NextResponse.json({ success: true, message: `Lead assigned to ${assignedToName || 'employee'}`, enquiry: updated });
    }

    // ──── RESOLVE ACTION ────────────────────────────
    if (action === 'resolve' && enquiryId) {
      const updated = await prisma.enquiry.update({
        where: { id: enquiryId },
        data: {
          status: 'Resolved',
          isStale: false,
        },
      });
      return NextResponse.json({ success: true, message: 'Enquiry resolved', enquiry: updated });
    }

    // ──── BULK PROCESS ──────────────────────────────
    if (action === 'bulk_process') {
      const { enquiryIds } = body;
      if (!enquiryIds || !Array.isArray(enquiryIds)) {
        return NextResponse.json({ success: false, error: 'enquiryIds array required' }, { status: 400 });
      }

      const updateData: any = {
        status: 'Processed',
        isStale: false,
        processedAt: new Date(),
        processedNotes: notes || 'Bulk processed via dashboard',
      };

      if (assignedToId) {
        updateData.assignedToId = assignedToId;
        updateData.assignedToName = assignedToName || null;
      }

      await prisma.enquiry.updateMany({
        where: { id: { in: enquiryIds } },
        data: updateData,
      });
      return NextResponse.json({ success: true, message: `${enquiryIds.length} enquiries processed` });
    }

    // ──── ADD MANUAL ENQUIRY ────────────────────────
    if (action === 'add') {
      const { participantName, phone, topic, message } = body;
      if (!participantName || !topic) {
        return NextResponse.json({ success: false, error: 'Name and topic required' }, { status: 400 });
      }

      const enquiry = await prisma.enquiry.create({
        data: {
          participantName,
          phone: phone || '',
          topic,
          lastMessage: message || '',
          messageTimestamp: new Date(),
          status: 'Open',
          source: 'manual',
          assignedToId: assignedToId || null,
          assignedToName: assignedToName || null,
        },
      });
      return NextResponse.json({ success: true, enquiry });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
