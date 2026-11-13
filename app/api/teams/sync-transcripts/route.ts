import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { prisma } from '@/lib/prisma';
import { createGraphClient } from '@/lib/graph-client';
import { getValidAccessToken } from '@/lib/outlook-graph-sync';
import { analyzeTranscript } from '@/lib/transcript-ai-analyzer';
import { extractTranscriptMetadata, resolveTargetEnquiry } from '@/lib/bookings-transcript-matcher';
import { extractTextFromDocx } from '@/lib/docx-extractor';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return POST(request);
}

export async function POST(request: NextRequest) {
  try {
    let transcriptItems: { text: string; candidateName?: string; email?: string; phone?: string; fileId?: string }[] = [];

    // ─── STAGE 1: Pre-Fetch Microsoft Calendar Events (Primary Key Bridge) ─
    let calendarEvents: any[] = [];
    const tokenInfo = await getValidAccessToken();
    let client: any = null;

    if (tokenInfo?.accessToken) {
      try {
        client = createGraphClient(tokenInfo.accessToken);
        const now = new Date();
        const start = new Date(now.getTime() - 7 * 24 * 3600 * 1000).toISOString();
        const end = new Date(now.getTime() + 7 * 24 * 3600 * 1000).toISOString();

        const calRes = await client.api('/me/calendarView')
          .query({ startDateTime: start, endDateTime: end })
          .top(50)
          .select('id,subject,start,end,attendees,onlineMeeting,isOnlineMeeting')
          .get();

        calendarEvents = calRes.value || [];
      } catch (calErr: any) {
        console.warn('[Sync Transcripts] Calendar pre-fetch warning:', calErr.message);
      }
    }

    // ─── STAGE 2: Scan Local OneDrive & Downloads Folders ─────────────
    const userProfile = process.env.USERPROFILE || 'C:\\Users\\ARUL XAVIER';
    const localFolders = [
      path.join(userProfile, 'OneDrive - gapanchor', 'www.gapanchor.com', 'Client Trascripts'),
      path.join(userProfile, 'OneDrive - gapanchor', 'www.gapanchor.com', 'Client Transcripts'),
      path.join(userProfile, 'OneDrive - gapanchor', 'Recordings'),
      path.join(userProfile, 'Downloads'),
      path.join(userProfile, 'OneDrive', 'Recordings'),
      path.join(userProfile, 'OneDrive - gapanchor', 'Meetings'),
    ];

    // Expand localFolders to include any subdirectories (e.g. subfolders inside Client Trascripts)
    const allFoldersToScan: string[] = [];
    for (const f of localFolders) {
      if (!fs.existsSync(f)) continue;
      allFoldersToScan.push(f);
      try {
        const subEntries = fs.readdirSync(f, { withFileTypes: true });
        for (const sub of subEntries) {
          if (sub.isDirectory()) {
            allFoldersToScan.push(path.join(f, sub.name));
          }
        }
      } catch {}
    }

    for (const folder of allFoldersToScan) {
      if (!fs.existsSync(folder)) continue;
      try {
        const files = fs.readdirSync(folder);
        // Track unique base meeting names to prevent processing both .docx and .vtt for the same call
        const processedMeetingNames = new Set<string>();

        // Sort files so .docx comes first before .vtt (prioritizing rich formatted transcripts)
        const sortedFiles = [...files].sort((a, b) => {
          if (a.toLowerCase().endsWith('.docx') && !b.toLowerCase().endsWith('.docx')) return -1;
          if (!a.toLowerCase().endsWith('.docx') && b.toLowerCase().endsWith('.docx')) return 1;
          return 0;
        });

        const isDedicatedTranscriptFolder = folder.toLowerCase().includes('trascript') || folder.toLowerCase().includes('transcript');

        for (const file of sortedFiles) {
          const lower = file.toLowerCase();
          // Look for transcript files (.docx, .vtt, .txt)
          if (!lower.endsWith('.docx') && !lower.endsWith('.vtt') && !lower.endsWith('.txt')) {
            continue;
          }

          // Check if name has 'Transcript' or meeting indicators (unless in dedicated transcript folder)
          if (!isDedicatedTranscriptFolder && !lower.includes('transcript') && !lower.includes('training') && !lower.includes('support')) {
            continue;
          }

          const baseMeetingKey = file.replace(/\.(docx|vtt|txt)$/i, '').trim().toLowerCase();
          if (processedMeetingNames.has(baseMeetingKey)) {
            continue;
          }

          const filePath = path.join(folder, file);
          const stat = fs.statSync(filePath);
          // Check files from recent window (up to 90 days for dedicated transcripts folder, 7 days for general folders)
          const maxAgeDays = isDedicatedTranscriptFolder ? 90 : 7;
          if (Date.now() - stat.mtimeMs > maxAgeDays * 24 * 3600 * 1000) continue;

          // Check deduplication against database (both exact fileId and matching base name)
          const baseNameExact = file.replace(/\.(docx|vtt|txt)$/i, '').trim();
          const alreadyLogged = await prisma.leadCall.findFirst({
            where: {
              OR: [
                { driveFileId: file },
                { driveFileId: `${baseNameExact}.docx` },
                { driveFileId: `${baseNameExact}.vtt` },
                { driveFileId: { startsWith: baseNameExact } },
              ],
            },
          });
          if (alreadyLogged) {
            processedMeetingNames.add(baseMeetingKey);
            continue;
          }

          let text = '';
          if (lower.endsWith('.docx')) {
            try {
              const buf = fs.readFileSync(filePath);
              text = extractTextFromDocx(buf);
            } catch (e) {
              console.warn('Docx read error:', file, e);
            }
          } else {
            try {
              text = fs.readFileSync(filePath, 'utf-8');
            } catch (e) {}
          }

          if (text && text.length > 50) {
            processedMeetingNames.add(baseMeetingKey);

            // Extract candidate name from filename (e.g. "IT support & Training - Bhuvanesh.docx" -> "Bhuvanesh")
            const candidateNameFromFile = baseNameExact
              .replace(/^(?:IT support\s*[_&]\s*Training|Training|Session|Meeting)\s*-\s*/i, '')
              .replace(/-\d{8}_\d{6}.*$/, '')
              .replace(/-Meeting Transcript.*$/i, '')
              .replace(/_\d+/g, '')
              .trim();

            const isGenericFile =
              !candidateNameFromFile ||
              /^(?:transcript|meeting|recording|call|session|webvtt|audio|video)(\s*\(\d+\)|\s*_\d+)?$/i.test(candidateNameFromFile) ||
              ['transcript', 'meeting', 'recording', 'call', 'session', 'unknown', 'candidate', 'webvtt'].includes(candidateNameFromFile.toLowerCase());

            transcriptItems.push({
              text,
              fileId: file,
              candidateName: !isGenericFile && candidateNameFromFile.length > 1 ? candidateNameFromFile : undefined,
            });
          }
        }
      } catch (err) {
        console.warn('Error reading local folder:', folder, err);
      }
    }

    // ─── STAGE 3: Cloud Microsoft Graph API Fallback ──────────────────
    let permissionDenied = false;
    let missingScopes: string[] = [];

    if (client && transcriptItems.length === 0) {
      const calendarOnlineMeetings = (calendarEvents || []).filter((e: any) => e.isOnlineMeeting && e.onlineMeeting?.joinUrl);

      for (const mtg of calendarOnlineMeetings) {
        const joinUrl = mtg.onlineMeeting?.joinUrl;
        const subject = mtg.subject || '';

        try {
          const meetingRes = await client.api(`/me/onlineMeetings?$filter=joinWebUrl eq '${joinUrl}'`).get();
          const onlineMtgId = meetingRes.value?.[0]?.id;
          if (onlineMtgId) {
            const transcriptsRes = await client.api(`/me/onlineMeetings/${onlineMtgId}/transcripts`).get();
            const list = transcriptsRes.value || [];
            for (const t of list) {
              try {
                const content = await client.api(`/me/onlineMeetings/${onlineMtgId}/transcripts/${t.id}/content?$format=text/vtt`).get();
                if (content && typeof content === 'string' && content.length > 20) {
                  transcriptItems.push({
                    text: content,
                    candidateName: subject.replace(/^IT support\s*&?\s*Training\s*-\s*/i, '').trim(),
                    fileId: t.id,
                  });
                }
              } catch (err) {}
            }
          }
        } catch (err: any) {
          if (err.statusCode === 403 || err.code === 'Forbidden') {
            permissionDenied = true;
            if (!missingScopes.includes('OnlineMeetingTranscript.Read.All')) {
              missingScopes.push('OnlineMeetingTranscript.Read.All');
            }
          }
        }
      }
    }

    // ─── STAGE 4: Process Any Found Transcripts ───────────────────────
    if (transcriptItems.length === 0) {
      if (permissionDenied) {
        return NextResponse.json({
          success: false,
          needsPermission: true,
          authUrl: '/api/auth/microsoft/connect',
          missingScopes,
          message: 'Microsoft Teams stores transcripts inside the meeting recap. Please download the transcript (.docx) from your Teams chat card, or authorize Graph permissions to auto-sync.',
        });
      }

      return NextResponse.json({
        success: true,
        syncedCount: 0,
        message: 'No new completed transcript file found. Click [Transcript] in Teams chat -> Download as .docx, or paste it directly using [Paste / Upload Transcript].',
      });
    }

    let processedCount = 0;
    for (const item of transcriptItems) {
      const meta = extractTranscriptMetadata(item.text, item.fileId);

      // Primary Key Resolution Cascade (Calendar Bridge -> Email Handle -> First-Name Proximity -> Exact Name)
      const resolved = await resolveTargetEnquiry(prisma, meta, {
        calendarEvents,
        directEmail: item.email,
        directPhone: item.phone,
        directName: item.candidateName,
      });

      let targetEnquiry = resolved.enquiry;
      let rawCandidateName = resolved.resolvedName || item.candidateName || (meta.customerName !== 'Unknown Candidate' ? meta.customerName : null);
      const candidateEmail = resolved.resolvedEmail || item.email || null;
      const candidatePhone = resolved.resolvedPhone || item.phone || null;

      const isGenericName = (name: string | null | undefined): boolean => {
        if (!name || name.trim().length < 2) return true;
        const lower = name.toLowerCase().trim();
        return (
          lower.includes('unknown') ||
          lower === 'candidate' ||
          lower === 'speaker' ||
          lower.startsWith('transcript') ||
          /^(?:transcript|meeting|recording|call|session|webvtt|audio|video)(\s*\(\d+\)|\s*_\d+)?$/i.test(lower)
        );
      };

      // If still no target enquiry and the name is generic, run AI pre-analysis to extract the real candidate name
      if (!targetEnquiry && isGenericName(rawCandidateName)) {
        try {
          const probe = await analyzeTranscript(item.text, 'Candidate');
          if (probe?.candidateName && !isGenericName(probe.candidateName)) {
            rawCandidateName = probe.candidateName;
            const retryResolve = await resolveTargetEnquiry(prisma, { ...meta, customerName: probe.candidateName });
            if (retryResolve.enquiry) {
              targetEnquiry = retryResolve.enquiry;
            }
          }
        } catch (e) {
          console.warn('[Sync Transcripts] Probe analysis warning:', e);
        }
      }

      // SAFETY GUARD: If no existing lead found and candidate name is generic or cannot be identified, NEVER create a dummy lead!
      if (!targetEnquiry) {
        if (isGenericName(rawCandidateName)) {
          console.warn('[Sync Transcripts] Skipping file without identified candidate:', item.fileId, rawCandidateName);
          continue;
        }

        const preAnalysis = await analyzeTranscript(item.text, rawCandidateName!);

        targetEnquiry = await prisma.enquiry.create({
          data: {
            participantName: rawCandidateName,
            email: candidateEmail,
            phone: candidatePhone || 'Not Provided',
            topic: preAnalysis.clientNeed || 'Supply Chain Training',
            trainingType: preAnalysis.clientNeed || 'Supply Chain Training',
            source: 'teams_call_transcript',
            status: 'Talked',
            contactStatus: 'Talked',
            messageTimestamp: new Date(),
            leadQuality: preAnalysis.score >= 8 ? 'High' : preAnalysis.score >= 5 ? 'Medium' : 'Low',
          },
        });
      }

      const resolvedCandidateName = targetEnquiry.participantName || rawCandidateName || 'Candidate';
      const analysis = await analyzeTranscript(item.text, resolvedCandidateName);

      const safeCallDate = (meta.meetingDate && !isNaN(meta.meetingDate.getTime())) ? meta.meetingDate : new Date();
      const safeFollowUpDate = (analysis.followUpDate && !isNaN(new Date(analysis.followUpDate).getTime())) 
        ? new Date(analysis.followUpDate) 
        : new Date(Date.now() + 24 * 3600 * 1000);

      await prisma.leadCall.create({
        data: {
          enquiryId: targetEnquiry.id,
          callDate: safeCallDate,
          durationMinutes: analysis.durationMinutes,
          candidateTalkPct: analysis.candidateTalkPct,
          score: analysis.score,
          summary: analysis.summary,
          customerExperience: analysis.customerExperience,
          clientNeed: analysis.clientNeed,
          budget: analysis.budget,
          timeline: analysis.timeline,
          decisionMaker: analysis.decisionMaker,
          objections: analysis.objections,
          counterPitch: analysis.counterPitch,
          verbatimQuotes: JSON.stringify(analysis.verbatimQuotes),
          rubricBreakdown: JSON.stringify(analysis.rubricBreakdown),
          whatsappDraft: analysis.whatsappDraft,
          nextAction: analysis.nextAction,
          driveFileId: item.fileId || null,
        },
      });

      // Update CRM enquiry record with call score, 'Talked' status, and enrich missing fields
      const updateData: any = {
        callScore: analysis.score,
        callFollowUpDate: safeFollowUpDate,
        hasRedFlag: analysis.hasRedFlag,
        redFlagReason: analysis.redFlagReason,
        redFlagDismissed: false,
        status: targetEnquiry.status === 'Open' || targetEnquiry.status === 'Pending' ? 'Talked' : targetEnquiry.status,
        contactStatus: 'Talked',
        lastMessage: `[Call: ${analysis.score}/10] ${analysis.summary.slice(0, 150)}...`,
      };

      if (!targetEnquiry.email && candidateEmail) {
        updateData.email = candidateEmail;
      }

      await prisma.enquiry.update({
        where: { id: targetEnquiry.id },
        data: updateData,
      });

      processedCount++;
    }

    return NextResponse.json({
      success: true,
      syncedCount: processedCount,
      message: `Successfully synchronized ${processedCount} call transcript(s) into CRM!`,
    });
  } catch (error: any) {
    console.error('[API /api/teams/sync-transcripts] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Error syncing Teams transcripts',
      syncedCount: 0,
    }, { status: 500 });
  }
}
