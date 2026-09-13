import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const targetId = body.enquiryId || body.recordId || body.id;

    if (!targetId || typeof targetId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Record ID is required for deletion.' },
        { status: 400 }
      );
    }

    // 1. Try finding in DB
    const existing = await prisma.enquiry.findUnique({
      where: { id: targetId },
    });

    let participantName = body.recordName || body.participantName || 'Enquiry';

    if (existing) {
      participantName = existing.participantName;

      // Log purge in IntegrationConfig metadata for audit
      try {
        const auditLog = await prisma.integrationConfig.findUnique({
          where: { service: 'enquiry_purge_log' },
        });
        const currentLogs = auditLog?.metadata ? JSON.parse(auditLog.metadata) : [];
        currentLogs.unshift({
          id: existing.id,
          participantName: existing.participantName,
          email: existing.email,
          phone: existing.phone,
          trainingType: existing.trainingType,
          deletedAt: new Date().toISOString(),
        });

        await prisma.integrationConfig.upsert({
          where: { service: 'enquiry_purge_log' },
          update: {
            metadata: JSON.stringify(currentLogs.slice(0, 500)),
            lastSynced: new Date(),
          },
          create: {
            service: 'enquiry_purge_log',
            connected: true,
            metadata: JSON.stringify(currentLogs.slice(0, 500)),
            lastSynced: new Date(),
          },
        });
      } catch (logErr) {
        console.error('Audit log error:', logErr);
      }

      // 2. Perform actual deletion from enquiries table
      await prisma.enquiry.delete({
        where: { id: targetId },
      });
    }

    return NextResponse.json({
      success: true,
      message: `Record "${participantName}" has been permanently deleted.`,
      recordId: targetId,
    });
  } catch (error: any) {
    console.error('Error deleting enquiry record:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete record' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  return POST(request);
}
