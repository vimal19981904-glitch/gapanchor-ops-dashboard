import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { maskEnquiriesForDemo } from '@/lib/demoDataMasker';

export async function POST(req: Request) {
  try {
    const cookieStore = cookies();
    const sessionCookie = cookieStore.get('gapanchor_session');

    if (!sessionCookie || !sessionCookie.value) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const sessionUser = JSON.parse(sessionCookie.value);

    // 100% DB-Free Demo Account Interceptor
    if (sessionUser.isDemo || sessionUser.email?.toLowerCase() === 'demo@gapanchor.com') {
      const demoEnquiries = await prisma.enquiry.findMany({
        take: 50,
        orderBy: { messageTimestamp: 'desc' },
      });
      const masked = maskEnquiriesForDemo(demoEnquiries);
      return NextResponse.json({
        success: true,
        count: masked.length,
        enquiries: masked,
        isDemo: true,
      });
    }

    // Role-based where clause
    const whereClause: any = {};
    if (sessionUser.role === 'employee') {
      whereClause.assignedToId = sessionUser.id;
    }

    const { filters } = await req.json().catch(() => ({ filters: {} }));

    if (filters?.country && filters.country !== 'ALL') {
      whereClause.country = filters.country;
    }
    if (filters?.course && filters.course !== 'ALL') {
      if (filters.course === 'Training' || filters.course === 'Job Support') {
        whereClause.serviceType = filters.course;
      } else {
        whereClause.trainingType = filters.course;
      }
    }
    if (filters?.status && filters.status !== 'ALL') {
      whereClause.contactStatus = filters.status;
    }
    if (filters?.quality && filters.quality !== 'ALL') {
      whereClause.leadQuality = filters.quality;
    }

    const enquiries = await prisma.enquiry.findMany({
      where: whereClause,
      orderBy: { messageTimestamp: 'desc' },
    });

    return NextResponse.json({
      success: true,
      count: enquiries.length,
      enquiries,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
