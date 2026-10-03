import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

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

    // Fetch all enquiries where serviceType or trainingType indicates Job Support
    const whereClause: any = {
      OR: [
        { serviceType: { contains: 'Job Support', mode: 'insensitive' } },
        { trainingType: { contains: 'Job Support', mode: 'insensitive' } },
        { topic: { contains: 'Job Support', mode: 'insensitive' } },
      ],
    };

    if (sessionUser.role === 'employee') {
      whereClause.assignedToId = sessionUser.id;
    }

    const jobSupportLeads = await prisma.enquiry.findMany({
      where: whereClause,
      orderBy: { messageTimestamp: 'desc' },
      include: {
        assignedTo: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });

    const totalLeads = jobSupportLeads.length;
    const activeCount = jobSupportLeads.filter(e => e.status === 'Active' || e.contactStatus === 'In Touch' || e.contactStatus === 'Talked').length;
    const assignedCount = jobSupportLeads.filter(e => e.assignedToId || e.assignedToName).length;
    const pendingAssignCount = Math.max(0, totalLeads - assignedCount);
    const completedCount = jobSupportLeads.filter(e => e.contactStatus === 'Converted' || e.status === 'Resolved' || e.status === 'Processed').length;

    // Platform breakdown
    const manhattanCount = jobSupportLeads.filter(e => (e.trainingType || e.topic || '').toLowerCase().includes('manhattan')).length;
    const blueYonderCount = jobSupportLeads.filter(e => (e.trainingType || e.topic || '').toLowerCase().includes('blue yonder') || (e.trainingType || e.topic || '').toLowerCase().includes('jda')).length;
    const generalCount = Math.max(0, totalLeads - manhattanCount - blueYonderCount);

    return NextResponse.json({
      success: true,
      summary: {
        totalLeads,
        activeCount,
        assignedCount,
        pendingAssignCount,
        completedCount,
        manhattanCount,
        blueYonderCount,
        generalCount,
      },
      jobSupportLeads,
    });
  } catch (error: any) {
    console.error('Job Support API GET error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
