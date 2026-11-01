import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const DEFAULT_SECRET = 'gapanchor_call_secret_2026';

export async function GET(request: NextRequest) {
  return NextResponse.json({
    status: 'online',
    endpoint: '/api/leads/call-summary',
    timestamp: new Date().toISOString(),
    message: 'GapAnchor Lead Call Intelligence Webhook is active.',
  });
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    const expectedToken = process.env.CRM_WEBHOOK_API_KEY || DEFAULT_SECRET;

    if (!token || token !== expectedToken) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Invalid or missing Bearer token' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      candidateEmail,
      candidatePhone,
      candidateName,
      teamsMeetingId,
      driveFileId,
      durationMinutes = 0,
      candidateTalkPct = 0,
      score = 5,
      rubricBreakdown,
      summary,
      clientNeed,
      budget,
      timeline,
      decisionMaker,
      objections,
      counterPitch,
      verbatimQuotes,
      hasRedFlag = false,
      redFlagReason = null,
      followUpDate,
      nextAction,
      whatsappDraft,
    } = body;

    if (!candidateEmail && !candidatePhone) {
      return NextResponse.json(
        { success: false, error: 'At least candidateEmail or candidatePhone is required' },
        { status: 400 }
      );
    }

    const cleanEmail = candidateEmail ? candidateEmail.trim().toLowerCase() : null;
    const cleanPhone = candidatePhone ? candidatePhone.replace(/\D/g, '').slice(-10) : null;

    // ─── 4-Tier Safe Resolution Engine ─────────────────────────────
    let matchedEnquiry = null;

    // Tier 1: Match Active Enquiry by Email (ignoring old resolved ones)
    if (cleanEmail) {
      matchedEnquiry = await prisma.enquiry.findFirst({
        where: {
          email: { equals: cleanEmail, mode: 'insensitive' },
          status: { not: 'Resolved' },
        },
        orderBy: { messageTimestamp: 'desc' },
      });
    }

    // Tier 2: Match by last 10 digits of Phone Number
    if (!matchedEnquiry && cleanPhone && cleanPhone.length >= 10) {
      matchedEnquiry = await prisma.enquiry.findFirst({
        where: {
          phone: { contains: cleanPhone },
          status: { not: 'Resolved' },
        },
        orderBy: { messageTimestamp: 'desc' },
      });
    }

    // Fallback search including Resolved if still not found
    if (!matchedEnquiry && cleanEmail) {
      matchedEnquiry = await prisma.enquiry.findFirst({
        where: { email: { equals: cleanEmail, mode: 'insensitive' } },
        orderBy: { messageTimestamp: 'desc' },
      });
    }

    // Tier 3: Automated Provisioning for fresh inbound Teams calls
    if (!matchedEnquiry) {
      matchedEnquiry = await prisma.enquiry.create({
        data: {
          participantName: candidateName || 'Call Candidate',
          email: cleanEmail,
          phone: candidatePhone || 'Not Provided',
          topic: clientNeed || 'Enterprise Training Inquiry',
          trainingType: clientNeed || 'Supply Chain Training',
          source: 'teams_booking_call',
          status: 'Talked',
          contactStatus: 'Talked',
          messageTimestamp: new Date(),
          leadQuality: score >= 8 ? 'High' : score >= 5 ? 'Medium' : 'Low',
        },
      });
    }

    // ─── Tier 4: Insert Multi-Call Timeline Record ──────────────────
    const leadCall = await prisma.leadCall.create({
      data: {
        enquiryId: matchedEnquiry.id,
        callDate: new Date(),
        durationMinutes: Number(durationMinutes) || 0,
        candidateTalkPct: Number(candidateTalkPct) || 0,
        score: Math.min(10, Math.max(1, Number(score) || 1)),
        summary: summary || 'Automated call transcription summary recorded.',
        clientNeed: clientNeed || null,
        budget: budget || null,
        timeline: timeline || null,
        decisionMaker: decisionMaker || null,
        objections: objections || null,
        counterPitch: counterPitch || null,
        verbatimQuotes: typeof verbatimQuotes === 'object' ? JSON.stringify(verbatimQuotes) : (verbatimQuotes || null),
        rubricBreakdown: typeof rubricBreakdown === 'object' ? JSON.stringify(rubricBreakdown) : (rubricBreakdown || null),
        whatsappDraft: whatsappDraft || null,
        nextAction: nextAction || null,
        teamsMeetingId: teamsMeetingId || null,
        driveFileId: driveFileId || null,
      },
    });

    // ─── Update Enquiry State & Scoring ────────────────────────────
    const parsedFollowUp = followUpDate ? new Date(followUpDate) : null;
    const updatedEnquiry = await prisma.enquiry.update({
      where: { id: matchedEnquiry.id },
      data: {
        callScore: leadCall.score,
        callFollowUpDate: parsedFollowUp && !isNaN(parsedFollowUp.getTime()) ? parsedFollowUp : null,
        hasRedFlag: Boolean(hasRedFlag),
        redFlagReason: hasRedFlag ? (redFlagReason || 'Red flag flagged by AI') : null,
        redFlagDismissed: false,
        status: matchedEnquiry.status === 'Open' ? 'Talked' : matchedEnquiry.status,
        contactStatus: 'Talked',
        lastMessage: summary ? `[Call Note: ${leadCall.score}/10] ${summary.slice(0, 150)}...` : matchedEnquiry.lastMessage,
      },
      include: {
        callTimeline: {
          orderBy: { callDate: 'desc' },
          take: 5,
        },
      },
    });

    return NextResponse.json({
      success: true,
      leadCallId: leadCall.id,
      enquiryId: updatedEnquiry.id,
      candidateName: updatedEnquiry.participantName,
      score: updatedEnquiry.callScore,
      status: updatedEnquiry.status,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[API /api/leads/call-summary] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Internal Server Error processing call summary',
      },
      { status: 500 }
    );
  }
}
