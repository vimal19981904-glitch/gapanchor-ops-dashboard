import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createGraphClient } from '@/lib/graph-client';
import { getValidAccessToken } from '@/lib/outlook-graph-sync';
import { analyzeTranscript } from '@/lib/transcript-ai-analyzer';
import { extractTranscriptMetadata, resolveTargetEnquiry } from '@/lib/bookings-transcript-matcher';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      transcriptText,
      enquiryId,
      candidateEmail,
      candidatePhone,
      candidateName: providedName,
    } = body;

    if (!transcriptText || typeof transcriptText !== 'string' || transcriptText.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'transcriptText is required and cannot be empty.' },
        { status: 400 }
      );
    }

    // 1. Extract metadata from transcript header
    const meta = extractTranscriptMetadata(transcriptText);

    // 2. Fetch recent Calendar Events if Graph is connected
    let calendarEvents: any[] = [];
    try {
      const tokenInfo = await getValidAccessToken();
      if (tokenInfo?.accessToken) {
        const client = createGraphClient(tokenInfo.accessToken);
        const now = new Date();
        const start = new Date(now.getTime() - 7 * 24 * 3600 * 1000).toISOString();
        const end = new Date(now.getTime() + 7 * 24 * 3600 * 1000).toISOString();
        const calRes = await client.api('/me/calendarView')
          .query({ startDateTime: start, endDateTime: end })
          .top(50)
          .select('id,subject,start,end,attendees,onlineMeeting,isOnlineMeeting')
          .get();
        calendarEvents = calRes.value || [];
      }
    } catch (e) {
      console.warn('Calendar query in process-transcript:', e);
    }

    // 3. Resolve Target Enquiry using 4-Tier Cascade
    const resolved = await resolveTargetEnquiry(prisma, meta, {
      calendarEvents,
      directEnquiryId: enquiryId,
      directEmail: candidateEmail,
      directPhone: candidatePhone,
      directName: providedName,
    });

    let targetEnquiry = resolved.enquiry;
    const resolvedCandidateName = resolved.resolvedName || providedName || meta.customerName || 'Call Candidate';
    const resolvedEmail = resolved.resolvedEmail || (candidateEmail ? candidateEmail.trim().toLowerCase() : null);
    const resolvedPhone = resolved.resolvedPhone || (candidatePhone ? candidatePhone.trim() : null);

    // 4. Run AI Scoring & Extraction
    const analysis = await analyzeTranscript(transcriptText, resolvedCandidateName);

    // 5. Provision fresh lead ONLY if completely unrepresented
    if (!targetEnquiry) {
      if (!resolvedCandidateName || resolvedCandidateName.toLowerCase().includes('unknown') || resolvedCandidateName.trim().length < 2) {
        return NextResponse.json({
          success: false,
          error: 'Could not identify candidate name from transcript. Please select an existing lead or specify candidate name.',
        }, { status: 400 });
      }

      targetEnquiry = await prisma.enquiry.create({
        data: {
          participantName: resolvedCandidateName,
          email: resolvedEmail,
          phone: resolvedPhone || 'Not Provided',
          topic: analysis.clientNeed || 'Supply Chain Training',
          trainingType: analysis.clientNeed || 'Supply Chain Training',
          source: 'teams_call_transcript',
          status: 'Talked',
          contactStatus: 'Talked',
          messageTimestamp: new Date(),
          leadQuality: analysis.score >= 8 ? 'High' : analysis.score >= 5 ? 'Medium' : 'Low',
        },
      });
    }

    // 6. Create LeadCall Timeline Record
    const leadCall = await prisma.leadCall.create({
      data: {
        enquiryId: targetEnquiry.id,
        callDate: new Date(),
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
      },
    });

    // 7. Update Enquiry Scoring & Status
    const parsedFollowUp = analysis.followUpDate ? new Date(analysis.followUpDate) : null;
    const updateData: any = {
      callScore: analysis.score,
      callFollowUpDate: parsedFollowUp && !isNaN(parsedFollowUp.getTime()) ? parsedFollowUp : null,
      hasRedFlag: analysis.hasRedFlag,
      redFlagReason: analysis.hasRedFlag ? analysis.redFlagReason : null,
      redFlagDismissed: false,
      status: targetEnquiry.status === 'Open' || targetEnquiry.status === 'Pending' ? 'Talked' : targetEnquiry.status,
      contactStatus: 'Talked',
      lastMessage: `[Call Score: ${analysis.score}/10] ${analysis.summary.slice(0, 150)}...`,
    };

    if (!targetEnquiry.email && resolvedEmail) {
      updateData.email = resolvedEmail;
    }

    const updatedEnquiry = await prisma.enquiry.update({
      where: { id: targetEnquiry.id },
      data: updateData,
      include: {
        callTimeline: {
          orderBy: { callDate: 'desc' },
          take: 5,
        },
      },
    });

    return NextResponse.json({
      success: true,
      enquiry: updatedEnquiry,
      leadCall,
      analysis,
    });
  } catch (error: any) {
    console.error('[API /api/leads/process-transcript] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to process transcript.' },
      { status: 500 }
    );
  }
}
