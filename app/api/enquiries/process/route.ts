import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendWhatsAppMessage } from '@/lib/whatsapp-client';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { enquiryId, customNote, customMessage } = body;

    if (!enquiryId) {
      return NextResponse.json({ success: false, error: 'enquiryId is required' }, { status: 400 });
    }

    // 1. Fetch enquiry from database
    const enquiry = await prisma.enquiry.findUnique({
      where: { id: enquiryId },
    });

    if (!enquiry) {
      return NextResponse.json({ success: false, error: 'Enquiry record not found' }, { status: 404 });
    }

    // 2. Update status in PostgreSQL DB
    const updatedEnquiry = await prisma.enquiry.update({
      where: { id: enquiryId },
      data: {
        status: 'Processed',
        contactStatus: 'Talked',
        processedAt: new Date(),
        processedNotes: customNote || 'Processed via Ops Dashboard action button',
      },
    });

    // 3. Construct default background message text if none provided
    const candidateName = enquiry.participantName || 'Valued Candidate';
    const courseTopic = enquiry.topic || enquiry.trainingType || 'Supply Chain Management Platform';

    const defaultMsg = customMessage || 
      `Hello ${candidateName}, thank you for contacting GapAnchor! 👋\n\nYour enquiry regarding *${courseTopic}* has been processed by our operations team. One of our technical advisors will reach out to you shortly.\n\nWebsite: https://gapanchor.com\nEmail: contact@gapanchor.com`;

    // 4. Send background Meta WhatsApp message directly to candidate's phone
    let whatsappResult: any = { success: false, note: 'No phone number provided' };
    if (enquiry.phone) {
      whatsappResult = await sendWhatsAppMessage(enquiry.phone, defaultMsg);
    }

    return NextResponse.json({
      success: true,
      message: `Lead for ${candidateName} has been processed successfully!`,
      enquiry: updatedEnquiry,
      whatsappResult,
    });
  } catch (error: any) {
    console.error('Error processing enquiry:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
