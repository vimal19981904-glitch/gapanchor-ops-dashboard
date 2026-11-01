/**
 * GapAnchor Follow-Up Intelligence Engine
 * Parses raw sales notes, call summaries, and timestamps to determine:
 * - Follow-up urgency (Due Today, Overdue, Upcoming, Awaiting Reply)
 * - Recommended action items
 * - Natural language match against user queries
 */

export interface FollowUpAnalysis {
  isFollowUpNeeded: boolean;
  isDueTodayOrOverdue: boolean;
  urgency: 'high' | 'medium' | 'low' | 'none';
  suggestedAction: string;
  category: 'demo_followup' | 'email_pending' | 'whatsapp_missing' | 'high_intent' | 'general' | 'lost';
  matchedKeywords: string[];
}

export interface CourseCurriculumInfo {
  name: string;
  syllabusUrl: string;
  sandboxUrl: string;
  duration: string;
  mentor: string;
}

export const COURSE_CURRICULA: Record<string, CourseCurriculumInfo> = {
  'manhattan wms': {
    name: 'Manhattan Active WMS',
    syllabusUrl: 'https://gapanchor.com/curriculum/manhattan-active-wms.pdf',
    sandboxUrl: 'https://gapanchor.com/sandbox-demo/manhattan-wms',
    duration: '6 Weeks (Weekend Batches)',
    mentor: 'Arul Xavier',
  },
  'manhattan proactive': {
    name: 'Manhattan ProActive & Scale',
    syllabusUrl: 'https://gapanchor.com/curriculum/manhattan-proactive.pdf',
    sandboxUrl: 'https://gapanchor.com/sandbox-demo/manhattan-proactive',
    duration: '6 Weeks (Weekend Batches)',
    mentor: 'Arul Xavier',
  },
  'blue yonder': {
    name: 'Blue Yonder (JDA) WMS / TMS',
    syllabusUrl: 'https://gapanchor.com/curriculum/blue-yonder-wms.pdf',
    sandboxUrl: 'https://gapanchor.com/sandbox-demo/blue-yonder',
    duration: '8 Weeks (Weekend Batches)',
    mentor: 'Senior Industry Architect',
  },
  'jda': {
    name: 'Blue Yonder (JDA) WMS',
    syllabusUrl: 'https://gapanchor.com/curriculum/blue-yonder-wms.pdf',
    sandboxUrl: 'https://gapanchor.com/sandbox-demo/blue-yonder',
    duration: '8 Weeks',
    mentor: 'Senior Industry Architect',
  },
  'kinaxis': {
    name: 'Kinaxis RapidResponse',
    syllabusUrl: 'https://gapanchor.com/curriculum/kinaxis-rapidresponse.pdf',
    sandboxUrl: 'https://gapanchor.com/sandbox-demo/kinaxis',
    duration: '6 Weeks',
    mentor: 'Enterprise Supply Chain Specialist',
  },
  'sap': {
    name: 'SAP S/4HANA Supply Chain & WM',
    syllabusUrl: 'https://gapanchor.com/curriculum/sap-s4hana.pdf',
    sandboxUrl: 'https://gapanchor.com/sandbox-demo/sap-wm',
    duration: '8 Weeks',
    mentor: 'Certified SAP Solutions Architect',
  },
  'job support': {
    name: 'Production Job Support & On-Call Mentoring',
    syllabusUrl: 'https://gapanchor.com/services/job-support-agreement.pdf',
    sandboxUrl: 'https://gapanchor.com/services/job-support-overview',
    duration: 'Monthly Retainer / On-Demand',
    mentor: 'Dedicated GapAnchor Engineer',
  },
};

export function getCurriculumForTopic(topicOrCourse?: string | null): CourseCurriculumInfo {
  const lower = (topicOrCourse || '').toLowerCase();
  for (const [key, info] of Object.entries(COURSE_CURRICULA)) {
    if (lower.includes(key)) return info;
  }
  return COURSE_CURRICULA['manhattan wms'];
}

/**
 * Analyzes an enquiry's notes, status, dates, and score to provide follow-up intelligence
 */
export function analyzeEnquiryFollowUp(enquiry: {
  processedNotes?: string | null;
  lastMessage?: string | null;
  contactStatus?: string | null;
  callFollowUpDate?: string | Date | null;
  callScore?: number | null;
  hasRedFlag?: boolean | null;
  messageTimestamp?: string | Date | null;
}): FollowUpAnalysis {
  const notes = (enquiry.processedNotes || '').toLowerCase();
  const lastMsg = (enquiry.lastMessage || '').toLowerCase();
  const status = (enquiry.contactStatus || 'Pending').toLowerCase();
  const score = enquiry.callScore || 0;
  const combinedText = `${notes} ${lastMsg}`;

  const matchedKeywords: string[] = [];

  // Check explicit followUpDate from DB
  let isDueTodayOrOverdue = false;
  if (enquiry.callFollowUpDate) {
    const fDate = new Date(enquiry.callFollowUpDate);
    if (!isNaN(fDate.getTime())) {
      const now = new Date();
      // Due if today or earlier
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      if (fDate <= endOfToday) {
        isDueTodayOrOverdue = true;
        matchedKeywords.push('followup_date_due');
      }
    }
  }

  // Detect patterns in notes
  const isDemo = combinedText.includes('demo') || combinedText.includes('attended');
  const isEmailSent = combinedText.includes('sent an email') || combinedText.includes('email to connect') || combinedText.includes('emailed');
  const isNoWhatsapp = combinedText.includes('not in whatsapp') || combinedText.includes('no whatsapp');
  const isNoReply = combinedText.includes('no reply') || combinedText.includes('no response') || combinedText.includes('didn\'t reply');
  const isLost = status === 'lost' || combinedText.includes('not interested') || combinedText.includes('lost');
  const isHighIntent = score >= 8 || combinedText.includes('interested') || combinedText.includes('budget approved') || combinedText.includes('architect') || combinedText.includes('enroll');

  if (isDemo) matchedKeywords.push('demo');
  if (isEmailSent) matchedKeywords.push('email_sent');
  if (isNoWhatsapp) matchedKeywords.push('no_whatsapp');
  if (isNoReply) matchedKeywords.push('awaiting_reply');
  if (isHighIntent) matchedKeywords.push('high_intent');

  // Determine Category and Action
  if (isLost) {
    return {
      isFollowUpNeeded: false,
      isDueTodayOrOverdue: false,
      urgency: 'none',
      suggestedAction: 'Marked closed / not interested. Keep in quarterly nurture newsletter.',
      category: 'lost',
      matchedKeywords,
    };
  }

  if (isHighIntent || score >= 8) {
    return {
      isFollowUpNeeded: true,
      isDueTodayOrOverdue: isDueTodayOrOverdue || true,
      urgency: 'high',
      suggestedAction: 'High Intent Lead! Send syllabus + sandbox walkthrough via WhatsApp and close batch seat.',
      category: 'high_intent',
      matchedKeywords,
    };
  }

  if (isDemo && (isNoReply || status === 'talked' || status === 'in touch')) {
    return {
      isFollowUpNeeded: true,
      isDueTodayOrOverdue: true,
      urgency: 'high',
      suggestedAction: 'Attended Demo but no reply yet. Send 1-click WhatsApp check-in with sandbox recording link.',
      category: 'demo_followup',
      matchedKeywords,
    };
  }

  if (isNoWhatsapp || isEmailSent) {
    return {
      isFollowUpNeeded: true,
      isDueTodayOrOverdue: false,
      urgency: 'medium',
      suggestedAction: 'Number missing on WhatsApp. Check email reply or attempt voice call follow-up.',
      category: 'whatsapp_missing',
      matchedKeywords,
    };
  }

  if (isNoReply) {
    return {
      isFollowUpNeeded: true,
      isDueTodayOrOverdue: false,
      urgency: 'medium',
      suggestedAction: 'Awaiting candidate response. Send warm follow-up check-in or course updates.',
      category: 'email_pending',
      matchedKeywords,
    };
  }

  // Leads in "In Touch" or "Talked" with notes
  if (status === 'in touch' || status === 'talked' || (enquiry.processedNotes && enquiry.processedNotes.trim().length > 0)) {
    return {
      isFollowUpNeeded: true,
      isDueTodayOrOverdue,
      urgency: isDueTodayOrOverdue ? 'high' : 'medium',
      suggestedAction: isDueTodayOrOverdue 
        ? 'Callback due today! Review call notes and re-engage candidate.' 
        : 'Active discussion in progress. Follow up on next scheduled touchpoint.',
      category: 'general',
      matchedKeywords,
    };
  }

  return {
    isFollowUpNeeded: false,
    isDueTodayOrOverdue: false,
    urgency: 'none',
    suggestedAction: 'New / pending lead awaiting initial contact.',
    category: 'general',
    matchedKeywords,
  };
}
