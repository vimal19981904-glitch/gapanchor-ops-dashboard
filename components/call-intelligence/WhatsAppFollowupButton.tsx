'use client';

import React from 'react';
import { MessageSquare } from 'lucide-react';
import { getCurriculumForTopic } from '@/lib/followup-intelligence';

interface WhatsAppFollowupButtonProps {
  phone: string;
  candidateName?: string;
  courseOrNeed?: string;
  customDraft?: string | null;
  compact?: boolean;
}

export function WhatsAppFollowupButton({
  phone,
  candidateName = 'there',
  courseOrNeed,
  customDraft,
  compact = false,
}: WhatsAppFollowupButtonProps) {
  if (!phone || phone === 'Not Provided') return null;

  const cleanPhone = phone.replace(/\D/g, '');
  const formattedPhone = cleanPhone.startsWith('91') || cleanPhone.length > 10 ? cleanPhone : `91${cleanPhone}`;
  const curriculum = getCurriculumForTopic(courseOrNeed);

  const message = customDraft || 
    `Hi ${candidateName}, thank you for speaking with GapAnchor today regarding ${curriculum.name}! 👋\n\n` +
    `As discussed, here are your access details:\n` +
    `📄 *Official Curriculum Syllabus*: ${curriculum.syllabusUrl}\n` +
    `☁️ *24/7 Cloud Sandbox Practice Walkthrough*: ${curriculum.sandboxUrl}\n` +
    `⏱️ *Program Structure*: ${curriculum.duration} with direct mentoring by ${curriculum.mentor}.\n\n` +
    `Please review the syllabus and let me know if you would like me to reserve your seat in the upcoming weekend batch! 🚀\n\n` +
    `Best regards,\nArul Xavier\nGapAnchor Operations`;

  const waUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;

  if (compact) {
    return (
      <a
        href={waUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        title={`WhatsApp ${candidateName}`}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30 transition-all shadow-sm hover:brightness-110 active:scale-[0.98]"
      >
        <MessageSquare className="w-3 h-3" />
        <span>WhatsApp</span>
      </a>
    );
  }

  return (
    <a
      href={waUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      title={`WhatsApp ${candidateName} with ${curriculum.name} syllabus`}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30 text-xs font-semibold transition-all shadow-sm hover:brightness-110 active:scale-[0.98]"
    >
      <MessageSquare className="w-3.5 h-3.5" />
      <span>WhatsApp</span>
    </a>
  );
}

