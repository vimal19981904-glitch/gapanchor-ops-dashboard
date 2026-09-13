import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseEnquiryExcel, DEFAULT_EXCEL_PATH } from '@/lib/xlsx-parser';
import { exec } from 'child_process';
import util from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { writeFile } from 'fs/promises';
import { cookies } from 'next/headers';

const execPromise = util.promisify(exec);

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

    const { searchParams } = new URL(request.url);
    const country = searchParams.get('country');
    const course = searchParams.get('course');
    const leadQuality = searchParams.get('leadQuality');
    const contactStatus = searchParams.get('contactStatus');
    const search = searchParams.get('search');

    const whereClause: any = {};
    if (sessionUser.role === 'employee') {
      whereClause.assignedToId = sessionUser.id;
    }

    if (country && country !== 'ALL') whereClause.country = country;
    if (course && course !== 'ALL') whereClause.trainingType = { contains: course };
    if (leadQuality && leadQuality !== 'ALL') whereClause.leadQuality = leadQuality;
    if (contactStatus && contactStatus !== 'ALL') whereClause.contactStatus = contactStatus;
    if (search) {
      whereClause.OR = [
        { participantName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { country: { contains: search, mode: 'insensitive' } },
        { trainingType: { contains: search, mode: 'insensitive' } },
      ];
    }

    const enquiries = await prisma.enquiry.findMany({
      where: whereClause,
      orderBy: { messageTimestamp: 'desc' },
    });

    const total = await prisma.enquiry.count();
    const config = await prisma.integrationConfig.findUnique({ where: { service: 'excel_enquiries' } });
    const metadata = config?.metadata ? JSON.parse(config.metadata) : null;

    const uniqueCountriesCount = new Set(enquiries.map(e => e.country).filter(Boolean)).size;
    const liveSummary = {
      ...(metadata?.summary || {}),
      totalEnquiries: total,
      uniqueCountries: uniqueCountriesCount,
    };

    return NextResponse.json({
      success: true,
      total,
      enquiries,
      lastSynced: config?.lastSynced || null,
      summary: liveSummary,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const cookieStore = cookies();
    const sessionCookie = cookieStore.get('gapanchor_session');
    let sessionUser: any = null;

    if (sessionCookie && sessionCookie.value) {
      try {
        sessionUser = JSON.parse(sessionCookie.value);
      } catch (err) {}
    }

    if (sessionUser && sessionUser.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Only administrators can perform Outlook & Excel sync operations.' },
        { status: 403 }
      );
    }

    let filePath = DEFAULT_EXCEL_PATH;
    let scriptOutput = '';

    // Check if request is multipart/form-data (manual file upload)
    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      try {
        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        if (file && file.size > 0) {
          const bytes = await file.arrayBuffer();
          const buffer = Buffer.from(bytes);
          const tempPath = path.join(os.tmpdir(), `enquiries-${Date.now()}.xlsx`);
          await writeFile(tempPath, buffer);
          filePath = tempPath;
        }
      } catch (err: any) {
        console.warn('FormData parsing error:', err.message);
      }
    } else {
      // Direct 1-Click Sync: Run python extractor script locally if present
      const localScriptPath = path.join(process.cwd(), 'scripts', 'extract_outlook_enquiries.py');
      const userScriptPath = `c:\\Project X - Online training platform\\anitigravity\\extract_enquiries.py`;
      const scriptToRun = fs.existsSync(localScriptPath)
        ? localScriptPath
        : fs.existsSync(userScriptPath)
        ? userScriptPath
        : null;

      if (scriptToRun) {
        try {
          const { stdout } = await execPromise(`python "${scriptToRun}"`, {
            cwd: path.dirname(scriptToRun),
            maxBuffer: 20 * 1024 * 1024,
          });
          scriptOutput = stdout;
          console.log('Outlook extractor script finished successfully.');
        } catch (err: any) {
          console.warn('Outlook python script execution note:', err.message);
        }
      }
    }

    let enquiries: any[] = [];
    let summary: any = null;
    let totalParsed = 0;
    let insertedCount = 0;
    let updatedCount = 0;
    let isExcelParsed = false;

    try {
      const parsed = parseEnquiryExcel(filePath);
      enquiries = parsed.enquiries;
      summary = parsed.summary;
      totalParsed = parsed.totalParsed;
      isExcelParsed = true;
    } catch (parseErr: any) {
      console.warn('Excel parse note (running in cloud environment):', parseErr.message);
    }

    if (isExcelParsed && enquiries.length > 0) {
      const existingEnquiries = await prisma.enquiry.findMany();

      const txOperations: any[] = [];

      for (const item of enquiries) {
        const itemEmail = (item.email || '').trim().toLowerCase();
        const itemName = (item.participantName || '').trim().toLowerCase();
        const itemPhone = (item.phone || '').trim().toLowerCase();
        const itemTraining = (item.trainingType || item.topic || '').trim().toLowerCase();
        const itemDate = item.messageTimestamp ? new Date(item.messageTimestamp) : null;

        // Find existing record matching participant identity + course/topic + 24h date window
        const existing = existingEnquiries.find(e => {
          const eEmail = (e.email || '').trim().toLowerCase();
          const eName = (e.participantName || '').trim().toLowerCase();
          const ePhone = (e.phone || '').trim().toLowerCase();
          const eTraining = (e.trainingType || e.topic || '').trim().toLowerCase();
          const eDate = e.messageTimestamp ? new Date(e.messageTimestamp) : null;

          const identityMatch = (itemEmail && eEmail && itemEmail === eEmail) ||
                                (itemName && eName && itemName === eName) ||
                                (itemPhone && ePhone && itemPhone.length > 5 && itemPhone === ePhone);
          if (!identityMatch) return false;

          const topicMatch = itemTraining === eTraining || 
                             (itemTraining.includes('manhattan') && eTraining.includes('manhattan') && itemTraining.includes('proactive') === eTraining.includes('proactive'));
          if (!topicMatch) return false;

          if (itemDate && eDate) {
            const timeDiffHours = Math.abs(itemDate.getTime() - eDate.getTime()) / (1000 * 60 * 60);
            return timeDiffHours <= 24;
          }
          return true;
        });

        if (existing) {
          txOperations.push(
            prisma.enquiry.update({
              where: { id: existing.id },
              data: {
                participantName: item.participantName || existing.participantName,
                phone: item.phone || existing.phone,
                country: item.country || existing.country,
                serviceType: item.serviceType || existing.serviceType,
                trainingType: item.trainingType || existing.trainingType,
                topic: item.topic || item.trainingType || existing.topic,
                lastMessage: item.lastMessage || existing.lastMessage,
                dateSubmitted: item.dateSubmitted || existing.dateSubmitted,
                receivedDate: item.receivedDate || existing.receivedDate,
                messageTimestamp: item.messageTimestamp || existing.messageTimestamp,
              },
            })
          );
          updatedCount++;
        } else {
          txOperations.push(
            prisma.enquiry.create({
              data: {
                participantName: item.participantName,
                email: item.email || null,
                phone: item.phone || '',
                country: item.country || 'India',
                serviceType: item.serviceType || 'Training',
                trainingType: item.trainingType || 'General Training',
                topic: item.topic || item.trainingType || 'General Training',
                lastMessage: item.lastMessage || item.trainingType,
                dateSubmitted: item.dateSubmitted,
                receivedDate: item.receivedDate,
                messageTimestamp: item.messageTimestamp || new Date(),
                source: 'excel',
                status: 'Open',
                leadQuality: item.trainingType?.toLowerCase().includes('proactive') ? 'High' : 'Unrated',
                contactStatus: 'Pending',
              },
            })
          );
          insertedCount++;
        }
      }

      if (txOperations.length > 0) {
        // Execute transaction in chunks of 50
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
    }

    const allEnquiries = await prisma.enquiry.findMany({
      orderBy: { messageTimestamp: 'desc' },
    });

    const config = await prisma.integrationConfig.findUnique({ where: { service: 'excel_enquiries' } });
    const meta = config?.metadata ? JSON.parse(config.metadata) : null;

    return NextResponse.json({
      success: true,
      message: isExcelParsed
        ? `Successfully synced ${totalParsed} records (${insertedCount} new, ${updatedCount} updated)`
        : `Refreshed ${allEnquiries.length} live database records. (For new Outlook extraction, run local sync or use file upload)`,
      totalParsed: totalParsed || allEnquiries.length,
      insertedCount,
      updatedCount,
      summary: summary || meta?.summary || null,
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
