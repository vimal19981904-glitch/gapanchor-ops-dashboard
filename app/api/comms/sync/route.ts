import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { fetchDemoEnquiries } from '@/lib/graph-client';
import { prisma } from '@/lib/prisma';

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !(session as any).accessToken) {
      return NextResponse.json({ success: false, error: 'Not authenticated with Outlook' }, { status: 401 });
    }

    const messages = await fetchDemoEnquiries((session as any).accessToken);
    let newEnquiriesCount = 0;

    for (const msg of messages) {
      const existing = await prisma.enquiry.findFirst({
        where: { source: 'outlook', whatsappMessageId: msg.id },
      });

      if (!existing) {
        await prisma.enquiry.create({
          data: {
            participantName: msg.from?.emailAddress?.name || msg.from?.emailAddress?.address || 'Unknown',
            phone: 'N/A',
            topic: msg.subject || 'Demo Enquiry',
            lastMessage: msg.bodyPreview || '',
            messageTimestamp: new Date(msg.receivedDateTime),
            status: 'Open',
            source: 'outlook',
            whatsappMessageId: msg.id, // Reusing this field to track outlook message ID
          },
        });
        newEnquiriesCount++;
      }
    }

    return NextResponse.json({ success: true, count: newEnquiriesCount });
  } catch (error: any) {
    console.error('Outlook sync error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
