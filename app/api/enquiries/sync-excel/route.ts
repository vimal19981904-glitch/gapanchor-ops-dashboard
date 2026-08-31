import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseEnquiryExcel, DEFAULT_EXCEL_PATH } from '@/lib/xlsx-parser';
import { exec } from 'child_process';
import util from 'util';
import fs from 'fs';
import path from 'path';

const execPromise = util.promisify(exec);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const country = searchParams.get('country');
    const course = searchParams.get('course');
    const leadQuality = searchParams.get('leadQuality');
    const contactStatus = searchParams.get('contactStatus');
    const search = searchParams.get('search');

    const whereClause: any = {};

    if (country) whereClause.country = country;
    if (course) whereClause.trainingType = { contains: course };
    if (leadQuality) whereClause.leadQuality = leadQuality;
    if (contactStatus) whereClause.contactStatus = contactStatus;
    if (search) {
      whereClause.OR = [
        { participantName: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } },
        { country: { contains: search } },
        { trainingType: { contains: search } },
      ];
    }

    const enquiries = await prisma.enquiry.findMany({
      where: whereClause,
      orderBy: { messageTimestamp: 'desc' },
    });

    const total = await prisma.enquiry.count();
    const config = await prisma.integrationConfig.findUnique({ where: { service: 'excel_enquiries' } });
    const metadata = config?.metadata ? JSON.parse(config.metadata) : null;

    return NextResponse.json({
      success: true,
      total,
      enquiries,
      lastSynced: config?.lastSynced || null,
      summary: metadata?.summary || null,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const filePath = body.filePath || DEFAULT_EXCEL_PATH;
    const userScriptPath = `c:\\Project X - Online training platform\\anitigravity\\extract_enquiries.py`;
    const localScriptPath = path.join(process.cwd(), 'scripts', 'extract_outlook_enquiries.py');

    let scriptOutput = '';
    const scriptToRun = fs.existsSync(userScriptPath) ? userScriptPath : (fs.existsSync(localScriptPath) ? localScriptPath : null);

    if (scriptToRun) {
      try {
        const { stdout } = await execPromise(`python "${scriptToRun}"`, {
          cwd: path.dirname(scriptToRun),
          maxBuffer: 20 * 1024 * 1024,
        });
        scriptOutput = stdout;
      } catch (err: any) {
        console.warn('Outlook python script execution note:', err.message);
      }
    }

    const { enquiries, summary, totalParsed } = parseEnquiryExcel(filePath);

    let insertedCount = 0;
    let updatedCount = 0;

    // Fast in-memory lookup map
    const existingEnquiries = await prisma.enquiry.findMany();
    const emailMap = new Map<string, typeof existingEnquiries[0]>();
    const nameMap = new Map<string, typeof existingEnquiries[0]>();

    existingEnquiries.forEach(e => {
      if (e.email && e.email.trim() !== '') {
        emailMap.set(e.email.trim().toLowerCase(), e);
      }
      if (e.participantName && e.messageTimestamp) {
        const key = `${e.participantName.trim().toLowerCase()}_${new Date(e.messageTimestamp).getTime()}`;
        nameMap.set(key, e);
      }
    });

    const txOperations: any[] = [];

    for (const item of enquiries) {
      const emailKey = item.email ? item.email.trim().toLowerCase() : '';
      const nameKey = `${item.participantName.trim().toLowerCase()}_${item.messageTimestamp ? new Date(item.messageTimestamp).getTime() : 0}`;

      const existing = (emailKey && emailMap.get(emailKey)) || nameMap.get(nameKey);

      if (existing) {
        txOperations.push(
          prisma.enquiry.update({
            where: { id: existing.id },
            data: {
              phone: item.phone || existing.phone,
              country: item.country || existing.country,
              serviceType: item.serviceType || existing.serviceType,
              trainingType: item.trainingType,
              topic: item.topic || item.trainingType,
              lastMessage: item.lastMessage || existing.lastMessage,
              dateSubmitted: item.dateSubmitted || existing.dateSubmitted,
              receivedDate: item.receivedDate || existing.receivedDate,
              messageTimestamp: item.messageTimestamp,
            },
          })
        );
        updatedCount++;
      } else {
        txOperations.push(
          prisma.enquiry.create({
            data: {
              participantName: item.participantName,
              email: item.email,
              phone: item.phone,
              country: item.country,
              serviceType: item.serviceType,
              trainingType: item.trainingType,
              topic: item.topic,
              lastMessage: item.lastMessage,
              dateSubmitted: item.dateSubmitted,
              receivedDate: item.receivedDate,
              messageTimestamp: item.messageTimestamp,
              source: 'excel',
              status: 'Open',
              leadQuality: 'Unrated',
              contactStatus: 'Pending',
            },
          })
        );
        insertedCount++;
      }
    }

    if (txOperations.length > 0) {
      // Execute transaction in chunks of 50 to avoid SQLite limits
      const chunkSize = 50;
      for (let i = 0; i < txOperations.length; i += chunkSize) {
        await prisma.$transaction(txOperations.slice(i, i + chunkSize));
      }
    }

    // Save integration metadata
    await prisma.integrationConfig.upsert({
      where: { service: 'excel_enquiries' },
      create: {
        service: 'excel_enquiries',
        connected: true,
        lastSynced: new Date(),
        metadata: JSON.stringify({ filePath, summary, totalParsed, insertedCount, updatedCount }),
      },
      update: {
        connected: true,
        lastSynced: new Date(),
        metadata: JSON.stringify({ filePath, summary, totalParsed, insertedCount, updatedCount }),
      },
    });

    const allEnquiries = await prisma.enquiry.findMany({
      orderBy: { messageTimestamp: 'desc' },
    });

    return NextResponse.json({
      success: true,
      message: `Successfully synced ${totalParsed} records (${insertedCount} new, ${updatedCount} updated)`,
      totalParsed,
      insertedCount,
      updatedCount,
      summary,
      enquiries: allEnquiries,
      scriptOutput,
    });
  } catch (error: any) {
    console.error('Excel sync error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { enquiryId, leadQuality, contactStatus, status, notes, directEnquiry } = body;

    if (directEnquiry) {
      const created = await prisma.enquiry.create({
        data: {
          participantName: directEnquiry.participantName || 'Web Lead',
          email: directEnquiry.email || null,
          phone: directEnquiry.phone || '',
          country: directEnquiry.country || 'India',
          serviceType: directEnquiry.serviceType || 'Training',
          trainingType: directEnquiry.trainingType || 'Manhattan WMS',
          topic: directEnquiry.topic || directEnquiry.trainingType || 'Training',
          lastMessage: directEnquiry.message || directEnquiry.trainingType || 'Web Demo Request',
          messageTimestamp: new Date(),
          source: 'web_form',
          status: 'Open',
          leadQuality: 'Unrated',
          contactStatus: 'Pending',
        },
      });
      return NextResponse.json({ success: true, enquiry: created });
    }

    if (!enquiryId) {
      return NextResponse.json({ success: false, error: 'enquiryId required' }, { status: 400 });
    }

    const dataToUpdate: any = {};
    if (leadQuality !== undefined) dataToUpdate.leadQuality = leadQuality;
    if (contactStatus !== undefined) dataToUpdate.contactStatus = contactStatus;
    if (status !== undefined) dataToUpdate.status = status;
    if (notes !== undefined) dataToUpdate.processedNotes = notes;

    const updated = await prisma.enquiry.update({
      where: { id: enquiryId },
      data: dataToUpdate,
    });

    return NextResponse.json({ success: true, enquiry: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
