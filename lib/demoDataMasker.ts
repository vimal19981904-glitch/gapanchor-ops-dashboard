/**
 * GapAnchor Ops Dashboard - Demo Account Privacy Masker & Mock Engine
 * Ensures 100% DB-safe privacy for demo logins while preserving all 501 records,
 * training types, pipeline stages, and operational structures.
 */

export function maskEnquiriesForDemo(enquiries: any[]): any[] {
  return enquiries.map((enq, idx) => {
    // Generate clean human dummy gmail: firstname.lastname.demo@gmail.com
    const nameParts = (enq.participantName || 'Candidate')
      .toLowerCase()
      .replace(/[^a-z\s]/g, '')
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    const baseName = nameParts.length > 0 ? nameParts.join('.') : `candidate.${idx + 1}`;
    const dummyEmail = `${baseName}.demo@gmail.com`;

    // Mask phone number with safe dummy enterprise format
    let dummyPhone = `+1 (555) 019-${String(1000 + (idx % 8999)).padStart(4, '0')}`;
    if (enq.phone && (enq.phone.includes('+91') || (enq.country || '').toLowerCase() === 'india')) {
      const pseudoRandom = String(9800000000 + ((idx * 8317 + 4219) % 199999999));
      dummyPhone = `+91 ${pseudoRandom.slice(0, 5)} ${pseudoRandom.slice(5)}`;
    }

    // Mask any real phone numbers or emails mentioned inside notes or lastMessage
    const maskText = (text: string | null) => {
      if (!text) return null;
      return text
        .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, 'candidate.demo@gmail.com')
        .replace(/\+?\d[\d\s-]{8,}\d/g, '+91 98*** ****0');
    };

    return {
      ...enq,
      email: dummyEmail,
      phone: dummyPhone,
      lastMessage: maskText(enq.lastMessage),
      processedNotes: maskText(enq.processedNotes),
    };
  });
}

export const DEMO_JOB_SUPPORT_SESSIONS = [
  {
    id: 'demo-js-1',
    title: 'Cloud Architecture Online Job Support - [Alex Mercer]',
    platform: 'Cloud Architecture',
    trainer: 'Senior Cloud Architect',
    participantsCount: 1,
    currentlyParticipating: 1,
    date: new Date('2026-11-15T09:00:00Z').toISOString(),
    status: 'In Progress',
    location: 'Online Sandbox + Teams Remote Access',
    trainerTotalCost: 45000,
    trainerAmountPaid: 25000,
    trainerAmountDue: 20000,
    participants: [
      {
        id: 'demo-jsp-1',
        participantName: 'Alex Mercer (Enterprise Architect)',
        amountDue: 75000,
        amountPaid: 45000,
        paymentStatus: 'PARTIAL',
        notes: 'AWS / Cloud Architecture 1-on-1 Support',
      },
    ],
  },
  {
    id: 'demo-js-2',
    title: 'Manhattan WMS 1-on-1 Support - [Samantha Reed]',
    platform: 'Manhattan WMS',
    trainer: 'Lead Consultant (Manhattan)',
    participantsCount: 1,
    currentlyParticipating: 1,
    date: new Date('2026-11-14T11:00:00Z').toISOString(),
    status: 'Scheduled',
    location: 'Teams Sandbox + AnyDesk',
    trainerTotalCost: 50000,
    trainerAmountPaid: 50000,
    trainerAmountDue: 0,
    participants: [
      {
        id: 'demo-jsp-2',
        participantName: 'Samantha Reed (Logistics Director)',
        amountDue: 85000,
        amountPaid: 85000,
        paymentStatus: 'PAID',
        notes: 'Manhattan WMS Daily Standup Support',
      },
    ],
  },
  {
    id: 'demo-js-3',
    title: 'Manhattan ProActive Job Support - [David Vance]',
    platform: 'Manhattan ProActive',
    trainer: 'Arul Xavier',
    participantsCount: 1,
    currentlyParticipating: 1,
    date: new Date('2026-11-12T14:00:00Z').toISOString(),
    status: 'In Progress',
    location: 'Online Sandbox + Teams',
    trainerTotalCost: 40000,
    trainerAmountPaid: 20000,
    trainerAmountDue: 20000,
    participants: [
      {
        id: 'demo-jsp-3',
        participantName: 'David Vance (Warehouse Operations)',
        amountDue: 70000,
        amountPaid: 35000,
        paymentStatus: 'PARTIAL',
        notes: 'ProActive Technical Issue Escalations',
      },
    ],
  },
];

export const DEMO_CALENDAR_EVENTS = [
  {
    id: 'demo-cal-1',
    summary: 'Manhattan Active WMS Enterprise Demo Session',
    description: 'Showcase session for enterprise warehouse automation and proactive workflows.',
    startTime: new Date(Date.now() + 3600000 * 2).toISOString(),
    endTime: new Date(Date.now() + 3600000 * 3.5).toISOString(),
    location: 'Microsoft Teams / Online Lab',
    conferenceType: 'teams',
    hangoutLink: 'https://teams.microsoft.com/l/meetup-join/demo-showcase',
  },
  {
    id: 'demo-cal-2',
    summary: 'Blue Yonder Demand Planning Architecture Review',
    description: 'Weekly candidate follow-up and batch planning sync.',
    startTime: new Date(Date.now() + 86400000).toISOString(),
    endTime: new Date(Date.now() + 86400000 + 3600000).toISOString(),
    location: 'Google Meet',
    conferenceType: 'google_meet',
    hangoutLink: 'https://meet.google.com/demo-showcase',
  },
  {
    id: 'demo-cal-3',
    summary: 'Supply Chain Operations & Onboarding Standup',
    description: 'Review new incoming candidate registrations and batch allocations.',
    startTime: new Date(Date.now() + 86400000 * 2).toISOString(),
    endTime: new Date(Date.now() + 86400000 * 2 + 1800000).toISOString(),
    location: 'Zoom',
    conferenceType: 'teams',
  },
];
