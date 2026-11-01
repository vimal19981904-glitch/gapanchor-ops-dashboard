import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const enquiryId = searchParams.get('enquiryId');

    if (!enquiryId) {
      return NextResponse.json({ success: false, error: 'enquiryId is required' }, { status: 400 });
    }

    const enquiry = await prisma.enquiry.findUnique({
      where: { id: enquiryId },
      include: {
        callTimeline: {
          orderBy: { callDate: 'desc' },
        },
      },
    });

    if (!enquiry) {
      return NextResponse.json({ success: false, error: 'Enquiry not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      enquiry,
      callTimeline: enquiry.callTimeline,
    });
  } catch (error: any) {
    console.error('Error fetching call intelligence:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { enquiryId, leadCallId, callScore, dismissRedFlag, followUpDate, customerExperience } = body;

    if (!enquiryId) {
      return NextResponse.json({ success: false, error: 'enquiryId is required' }, { status: 400 });
    }

    if (typeof customerExperience === 'string') {
      if (leadCallId) {
        await prisma.leadCall.update({
          where: { id: leadCallId },
          data: { customerExperience },
        });
      } else if (customerExperience.trim().length > 0) {
        await prisma.leadCall.create({
          data: {
            enquiryId,
            score: typeof callScore === 'number' ? callScore : 6,
            summary: `Manual customer experience summary`,
            customerExperience,
          },
        });
      }
    }

    const updateData: any = {};

    if (typeof callScore === 'number') {
      updateData.callScore = Math.min(10, Math.max(1, callScore));
    }

    if (dismissRedFlag === true) {
      updateData.redFlagDismissed = true;
    }

    if (followUpDate !== undefined) {
      updateData.callFollowUpDate = followUpDate ? new Date(followUpDate) : null;
    }

    const updated = await prisma.enquiry.update({
      where: { id: enquiryId },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      enquiry: updated,
    });
  } catch (error: any) {
    console.error('Error updating call intelligence:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
