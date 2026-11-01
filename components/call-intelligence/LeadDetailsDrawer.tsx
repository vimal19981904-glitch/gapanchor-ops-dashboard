'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Phone,
  Mail,
  Calendar,
  Globe,
  BookOpen,
  Sparkles,
  UserCheck,
  Trash2,
  Clock,
  Mic,
  Copy,
  Check,
  Flame,
  Award,
  GraduationCap,
  MessageCircle,
  MessageSquare,
  FileText,
  PhoneCall,
  User,
  ExternalLink,
  ChevronRight,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Star,
  Zap,
  Circle,
} from 'lucide-react';
import { toast } from 'sonner';
import { CallVolumeMeter } from './CallVolumeMeter';
import { WhatsAppFollowupButton } from './WhatsAppFollowupButton';
import { RedFlagBadge } from './RedFlagBadge';
import { TranscriptUploadModal } from './TranscriptUploadModal';
import DeleteRecordAction from '@/components/DeleteRecordAction';
import { analyzeEnquiryFollowUp, getCurriculumForTopic } from '@/lib/followup-intelligence';
import { CustomerExperienceTab } from './CustomerExperienceTab';

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; bg: string; border: string }> = {
  'Pending': { label: 'Pending', icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
  'In Touch': { label: 'In Touch', icon: MessageSquare, color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30' },
  'Talked': { label: 'Talked', icon: PhoneCall, color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/30' },
  'Future': { label: 'Future', icon: Calendar, color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/30' },
  'Converted': { label: 'Converted', icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
  'Lost': { label: 'Lost', icon: XCircle, color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/30' },
};

const QUALITY_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; bg: string; border: string }> = {
  'High': { label: 'High Quality', icon: Star, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
  'Medium': { label: 'Medium Quality', icon: Zap, color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30' },
  'Low': { label: 'Low Quality', icon: ShieldAlert, color: 'text-slate-400', bg: 'bg-slate-800/60', border: 'border-slate-700' },
  'Unrated': { label: 'Unrated', icon: Circle, color: 'text-slate-500', bg: 'bg-slate-900/50', border: 'border-slate-800' },
};

function DrawerStatusSelect({ value, onChange, className = '' }: { value: string; onChange: (val: string) => void; className?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = STATUS_CONFIG[value] || STATUS_CONFIG['Pending'];
  const Icon = current.icon;

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className="relative inline-block text-left" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer whitespace-nowrap ${current.bg} ${current.color} ${current.border} hover:brightness-125 shadow-sm ${className}`}
      >
        <Icon className="w-3.5 h-3.5" />
        <span>{current.label}</span>
      </button>

      {open && (
        <div className="absolute left-0 mt-1 w-36 bg-slate-900/95 backdrop-blur-xl border border-slate-700 rounded-xl shadow-2xl z-50 p-1 space-y-0.5">
          {Object.entries(STATUS_CONFIG).map(([k, cfg]) => {
            const ItemIcon = cfg.icon;
            return (
              <button
                key={k}
                type="button"
                onClick={() => { onChange(k); setOpen(false); }}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-left transition-colors cursor-pointer ${
                  value === k ? 'bg-slate-800 text-white font-bold' : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                }`}
              >
                <ItemIcon className={`w-3.5 h-3.5 ${cfg.color}`} />
                <span>{cfg.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DrawerQualitySelect({ value, onChange, className = '' }: { value: string; onChange: (val: string) => void; className?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = QUALITY_CONFIG[value] || QUALITY_CONFIG['Unrated'];
  const Icon = current.icon;

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className="relative inline-block text-left" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer whitespace-nowrap ${current.bg} ${current.color} ${current.border} hover:brightness-125 shadow-sm ${className}`}
      >
        <Icon className="w-3.5 h-3.5" />
        <span>{current.label}</span>
      </button>

      {open && (
        <div className="absolute left-0 mt-1 w-40 bg-slate-900/95 backdrop-blur-xl border border-slate-700 rounded-xl shadow-2xl z-50 p-1 space-y-0.5">
          {Object.entries(QUALITY_CONFIG).map(([k, cfg]) => {
            const ItemIcon = cfg.icon;
            return (
              <button
                key={k}
                type="button"
                onClick={() => { onChange(k); setOpen(false); }}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-left transition-colors cursor-pointer ${
                  value === k ? 'bg-slate-800 text-white font-bold' : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                }`}
              >
                <ItemIcon className={`w-3.5 h-3.5 ${cfg.color}`} />
                <span>{cfg.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TalkTimeDonut({ candidatePct = 50, hostName = 'Sam' }: { candidatePct: number; hostName?: string }) {
  const safeCandidate = Math.min(100, Math.max(0, candidatePct || 50));
  const safeHost = 100 - safeCandidate;

  const size = 52;
  const strokeWidth = 5.5;
  const radius = (size - strokeWidth) / 2; // 23.25
  const circumference = 2 * Math.PI * radius; // ~146.08
  const candidateDash = (safeCandidate / 100) * circumference;

  return (
    <div className="flex items-center gap-3 w-full">
      <div className="relative w-[52px] h-[52px] shrink-0">
        <svg width={size} height={size} className="transform -rotate-90">
          {/* Background Track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#1e293b"
            strokeWidth={strokeWidth}
          />
          {/* Host / Sam Segment (Indigo - Full base) */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#6366f1"
            strokeWidth={strokeWidth}
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={0}
            className="transition-all duration-700 ease-out"
          />
          {/* Candidate Segment (Teal - Overlaid from 12 o'clock) */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#14b8a6"
            strokeWidth={strokeWidth}
            strokeDasharray={`${candidateDash} ${circumference}`}
            strokeDashoffset={0}
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-[10px] font-extrabold text-teal-300 leading-none">
            {safeCandidate}%
          </span>
        </div>
      </div>

      <div className="space-y-1 text-xs min-w-0 flex-1">
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="w-2 h-2 rounded-full bg-teal-400 shrink-0" />
            <span className="text-slate-400 text-[11px] truncate">Candidate:</span>
          </div>
          <span className="font-bold text-teal-300 text-xs shrink-0">{safeCandidate}%</span>
        </div>
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="w-2 h-2 rounded-full bg-indigo-400 shrink-0" />
            <span className="text-slate-400 text-[11px] truncate">{hostName} (Host):</span>
          </div>
          <span className="font-bold text-indigo-300 text-xs shrink-0">{safeHost}%</span>
        </div>
      </div>
    </div>
  );
}

interface LeadCallRecord {
  id: string;
  callDate: string;
  durationMinutes: number;
  candidateTalkPct: number;
  score: number;
  summary: string;
  customerExperience?: string | null;
  clientNeed?: string | null;
  budget?: string | null;
  timeline?: string | null;
  decisionMaker?: string | null;
  objections?: string | null;
  counterPitch?: string | null;
  verbatimQuotes?: string | null;
  whatsappDraft?: string | null;
  nextAction?: string | null;
}

interface LeadDetailsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  enquiry: any;
  onUpdateStatus: (id: string, updates: any) => Promise<void>;
  onDeleteSuccess: (id: string) => void;
  onAssignClick: (enquiry: any) => void;
  onEnrollClick?: (enquiry: any) => void;
}

export function LeadDetailsDrawer({
  isOpen,
  onClose,
  enquiry,
  onUpdateStatus,
  onDeleteSuccess,
  onAssignClick,
  onEnrollClick,
}: LeadDetailsDrawerProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'call_intel' | 'cx'>('overview');
  const [callHistory, setCallHistory] = useState<LeadCallRecord[]>([]);
  const [isLoadingCalls, setIsLoadingCalls] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [contactStatus, setContactStatus] = useState('Pending');
  const [leadQuality, setLeadQuality] = useState('Unrated');
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [copiedPitch, setCopiedPitch] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [followUpDate, setFollowUpDate] = useState('');
  const [isSavingFollowUp, setIsSavingFollowUp] = useState(false);
  const [isMessageExpanded, setIsMessageExpanded] = useState(false);

  // Sync state when enquiry changes
  useEffect(() => {
    if (enquiry) {
      setNoteText(enquiry.processedNotes || '');
      setContactStatus(enquiry.contactStatus || 'Pending');
      setLeadQuality(enquiry.leadQuality || 'Unrated');
      setFollowUpDate(enquiry.callFollowUpDate ? new Date(enquiry.callFollowUpDate).toISOString().slice(0, 10) : '');
    }
  }, [enquiry]);

  const fetchCallTimeline = () => {
    if (enquiry?.id) {
      setIsLoadingCalls(true);
      fetch(`/api/enquiries/call-intelligence?enquiryId=${enquiry.id}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.callTimeline) {
            setCallHistory(data.callTimeline);
          }
        })
        .catch((err) => console.error('Error fetching call timeline:', err))
        .finally(() => setIsLoadingCalls(false));
    }
  };

  // Fetch Call Intelligence timeline when opened
  useEffect(() => {
    if (isOpen && enquiry?.id) {
      fetchCallTimeline();
    }
  }, [isOpen, enquiry?.id]);

  if (!isOpen || !enquiry) return null;

  const latestCall = callHistory[0];
  const parsedQuotes = latestCall?.verbatimQuotes
    ? (typeof latestCall.verbatimQuotes === 'string'
        ? JSON.parse(latestCall.verbatimQuotes)
        : latestCall.verbatimQuotes)
    : null;

  const handleCopyPitch = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPitch(true);
    setTimeout(() => setCopiedPitch(false), 2000);
  };

  const handleSaveNotes = async () => {
    setIsSavingNote(true);
    try {
      await onUpdateStatus(enquiry.id, { notes: noteText });
      toast.success('Notes saved to database');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save notes');
    } finally {
      setIsSavingNote(false);
    }
  };

  const handleSaveFollowUpDate = async (newDate: string) => {
    setFollowUpDate(newDate);
    setIsSavingFollowUp(true);
    try {
      const isoDate = newDate ? new Date(newDate).toISOString() : null;
      await fetch('/api/enquiries/call-intelligence', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enquiryId: enquiry.id,
          followUpDate: isoDate,
        }),
      });
      await onUpdateStatus(enquiry.id, { callFollowUpDate: isoDate });
      toast.success(newDate ? `Follow-up scheduled for ${newDate}` : 'Follow-up date cleared');
    } catch (err: any) {
      toast.error('Failed to update follow-up date');
    } finally {
      setIsSavingFollowUp(false);
    }
  };

  const handleSaveCX = async (updatedCX: string) => {
    if (!enquiry?.id) return;
    const res = await fetch('/api/enquiries/call-intelligence', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        enquiryId: enquiry.id,
        leadCallId: latestCall?.id || null,
        customerExperience: updatedCX,
      }),
    });
    if (!res.ok) {
      throw new Error('Failed to update Customer Experience summary');
    }
    fetchCallTimeline();
  };

  const followUpInfo = analyzeEnquiryFollowUp(enquiry);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
    >
      {/* 40% Width Drawer Container */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:w-[540px] md:w-[48vw] lg:w-[42vw] xl:w-[40vw] h-full bg-[#0b1324] border-l border-slate-700/80 shadow-[-20px_0_50px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden text-slate-100 animate-in slide-in-from-right duration-300"
      >
        {/* Header */}
        <div className="p-3 sm:p-5 border-b border-slate-800 bg-slate-900/60 backdrop-blur-md flex items-start justify-between shrink-0">
          {/* Mobile Header (< sm / iPhone 16) */}
          <div className="flex sm:hidden items-center gap-3 min-w-0 flex-1 pr-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-600 to-indigo-600 flex items-center justify-center text-white font-extrabold text-base shadow-md shadow-cyan-500/20 shrink-0">
              {enquiry.participantName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              {/* Row 1: Name + RedFlag */}
              <div className="flex items-center gap-1.5 min-w-0">
                <h2 className="text-sm font-bold text-white tracking-tight truncate">
                  {enquiry.participantName}
                </h2>
                <RedFlagBadge
                  enquiryId={enquiry.id}
                  hasRedFlag={Boolean(enquiry.hasRedFlag)}
                  redFlagReason={enquiry.redFlagReason}
                  redFlagDismissed={Boolean(enquiry.redFlagDismissed)}
                />
              </div>
              {/* Row 2: Subtitle line (platform • country) */}
              <p className="text-[11px] text-slate-400 truncate mt-0.5">
                <span>{enquiry.trainingType || enquiry.topic || 'Enterprise Training'}</span>
                <span className="mx-1 text-slate-500">•</span>
                <span>{enquiry.country || 'India'}</span>
              </p>
              {/* Row 3: CLIENT badge and #id under the name */}
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="px-1.5 py-0.2 text-[8.5px] font-extrabold rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 uppercase tracking-wider">
                  Client
                </span>
                <span className="font-mono text-[10px] text-slate-500">#{enquiry.id.slice(-6)}</span>
              </div>
            </div>
          </div>

          {/* Desktop Header (>= sm) - 100% UNTOUCHED */}
          <div className="hidden sm:flex items-center gap-3.5 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-600 to-indigo-600 flex items-center justify-center text-white font-extrabold text-lg shadow-lg shadow-cyan-500/20 shrink-0">
              {enquiry.participantName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-white tracking-tight truncate">
                  {enquiry.participantName}
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-extrabold rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 uppercase tracking-wider">
                  Client
                </span>
                <RedFlagBadge
                  enquiryId={enquiry.id}
                  hasRedFlag={Boolean(enquiry.hasRedFlag)}
                  redFlagReason={enquiry.redFlagReason}
                  redFlagDismissed={Boolean(enquiry.redFlagDismissed)}
                />
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-2 mt-0.5 truncate">
                <span>{enquiry.trainingType || enquiry.topic || 'Enterprise Training'}</span>
                <span>•</span>
                <span>{enquiry.country || 'India'}</span>
                <span>•</span>
                <span className="font-mono text-slate-500">#{enquiry.id.slice(-6)}</span>
              </p>
            </div>
          </div>

          {/* Close (X) button */}
          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 text-slate-400 hover:text-white rounded-lg sm:rounded-xl bg-slate-800/60 hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
            title="Close Drawer"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Tab Navigation Bar */}
        <div className="flex items-center justify-between px-3 sm:px-5 border-b border-slate-800/80 bg-slate-950/60 shrink-0 h-10 sm:h-auto overflow-x-auto scrollbar-none">
          <div className="flex items-center gap-1 whitespace-nowrap min-w-0 flex-1">
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex items-center gap-1.5 h-10 sm:h-auto sm:py-3 px-2.5 sm:px-3.5 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'overview'
                  ? 'border-cyan-400 text-cyan-300 bg-cyan-500/5'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-cyan-400" />
              <span className="sm:hidden">Overview</span>
              <span className="hidden sm:inline">Inquiry Overview</span>
            </button>

            <button
              onClick={() => setActiveTab('call_intel')}
              className={`flex items-center gap-1.5 h-10 sm:h-auto sm:py-3 px-2.5 sm:px-3.5 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap shrink-0 relative ${
                activeTab === 'call_intel'
                  ? 'border-cyan-400 sm:border-indigo-400 text-cyan-300 sm:text-indigo-300 bg-cyan-500/5 sm:bg-indigo-500/5'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <PhoneCall className="w-3.5 h-3.5 text-cyan-400 sm:text-indigo-400" />
              <span className="sm:hidden">Calls</span>
              <span className="hidden sm:inline">Call Intelligence & Battlecards</span>
              {enquiry.callScore && (
                <span className="px-1.5 py-0.2 rounded-full text-[9px] sm:text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  {enquiry.callScore}/10
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('cx')}
              className={`flex items-center gap-1.5 h-10 sm:h-auto sm:py-3 px-2.5 sm:px-3.5 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap shrink-0 relative ${
                activeTab === 'cx'
                  ? 'border-cyan-400 sm:border-emerald-400 text-cyan-300 sm:text-emerald-300 bg-cyan-500/5 sm:bg-emerald-500/5'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-cyan-400 sm:text-emerald-400" />
              <span className="sm:hidden">CX</span>
              <span className="hidden sm:inline">Customer Experience</span>
              {latestCall?.customerExperience?.trim() && (
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              )}
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-2">
            <CallVolumeMeter
              enquiryId={enquiry.id}
              initialScore={enquiry.callScore || latestCall?.score || null}
              compact
            />
          </div>
        </div>

        {/* ─── MOBILE ONLY: Status Chips Row (Pending, Unrated in one small row) ─── */}
        <div className="flex sm:hidden items-center gap-2 px-3 py-1.5 bg-slate-950/40 border-b border-slate-800/60">
          <DrawerStatusSelect
            value={contactStatus}
            className="h-7 py-0.5 px-2 text-[10px]"
            onChange={async (val) => {
              setContactStatus(val);
              try {
                await onUpdateStatus(enquiry.id, { contactStatus: val });
                toast.success(`Status updated to ${val}`);
              } catch (e: any) {
                toast.error(e.message || 'Failed to update status');
              }
            }}
          />
          <DrawerQualitySelect
            value={leadQuality}
            className="h-7 py-0.5 px-2 text-[10px]"
            onChange={async (val) => {
              setLeadQuality(val);
              try {
                await onUpdateStatus(enquiry.id, { leadQuality: val });
                toast.success(`Quality set to ${val}`);
              } catch (e: any) {
                toast.error(e.message || 'Failed to update quality');
              }
            }}
          />
        </div>

        {/* ─── MOBILE ONLY: Action Buttons (In ONE row, compact 32-34px height) ─── */}
        <div className="flex sm:hidden items-center gap-1.5 px-3 py-1.5 bg-slate-900/60 border-b border-slate-800/80 overflow-x-auto scrollbar-none h-[42px]">
          {enquiry.phone && (() => {
            const cleanPhone = enquiry.phone.replace(/\D/g, '');
            const formattedPhone = cleanPhone.startsWith('91') || cleanPhone.length > 10 ? cleanPhone : `91${cleanPhone}`;
            const curriculum = getCurriculumForTopic(enquiry.trainingType || enquiry.topic);
            const message = latestCall?.whatsappDraft ||
              `Hi ${enquiry.participantName}, thank you for speaking with GapAnchor today regarding ${curriculum.name}! 👋\n\n` +
              `As discussed, here are your access details:\n` +
              `📄 *Official Curriculum Syllabus*: ${curriculum.syllabusUrl}\n` +
              `☁️ *24/7 Cloud Sandbox Practice Walkthrough*: ${curriculum.sandboxUrl}\n` +
              `⏱️ *Program Structure*: ${curriculum.duration} with direct mentoring by ${curriculum.mentor}.\n\n` +
              `Please review the syllabus and let me know if you would like me to reserve your seat in the upcoming weekend batch! 🚀\n\n` +
              `Best regards,\nArul Xavier\nGapAnchor Operations`;
            const waUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
            return (
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="h-[32px] px-2.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 border border-slate-700/80 hover:border-cyan-500/40 text-cyan-300 text-xs font-semibold flex items-center gap-1 shrink-0 transition-all shadow-sm active:scale-95 no-underline"
                title="WhatsApp Follow-up"
              >
                <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
                <span>WA</span>
              </a>
            );
          })()}

          {enquiry.email && (
            <a
              href={`mailto:${enquiry.email}?subject=Regarding ${enquiry.trainingType || 'GapAnchor Training'}`}
              className="h-[32px] px-2.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 border border-slate-700/80 hover:border-cyan-500/40 text-slate-200 hover:text-cyan-300 text-xs font-semibold flex items-center gap-1 shrink-0 transition-all shadow-sm active:scale-95 no-underline"
            >
              <Mail className="w-3.5 h-3.5 text-slate-400" />
              <span>Email</span>
            </a>
          )}

          <button
            type="button"
            onClick={() => setUploadModalOpen(true)}
            className="h-[32px] px-2.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 border border-slate-700/80 hover:border-cyan-500/40 text-slate-200 hover:text-cyan-300 text-xs font-semibold flex items-center gap-1 shrink-0 transition-all shadow-sm active:scale-95 cursor-pointer"
            title="Upload or paste Teams call transcript for this lead"
          >
            <PhoneCall className="w-3.5 h-3.5 text-cyan-400" />
            <span>Analyze</span>
          </button>

          <button
            type="button"
            onClick={() => onAssignClick(enquiry)}
            className="h-[32px] px-2.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 border border-slate-700/80 hover:border-cyan-500/40 text-slate-200 hover:text-cyan-300 text-xs font-semibold flex items-center gap-1 shrink-0 transition-all shadow-sm active:scale-95 cursor-pointer"
          >
            <UserCheck className="w-3.5 h-3.5 text-cyan-400" />
            <span>Assign</span>
          </button>
        </div>

        {/* ─── DESKTOP ONLY: Action Toolbar (>= sm) - 100% UNTOUCHED ─── */}
        <div className="hidden sm:flex px-5 py-2.5 bg-slate-900/60 border-b border-slate-800/80 items-center justify-between gap-2.5 flex-wrap shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            {enquiry.phone && (
              <WhatsAppFollowupButton
                phone={enquiry.phone}
                candidateName={enquiry.participantName}
                courseOrNeed={enquiry.trainingType || enquiry.topic}
                customDraft={latestCall?.whatsappDraft}
              />
            )}
            {enquiry.email && (
              <a
                href={`mailto:${enquiry.email}?subject=Regarding ${enquiry.trainingType || 'GapAnchor Training'}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 border border-cyan-500/30 text-xs font-semibold transition-all shadow-sm"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Email</span>
              </a>
            )}
            <DrawerStatusSelect
              value={contactStatus}
              onChange={async (val) => {
                setContactStatus(val);
                try {
                  await onUpdateStatus(enquiry.id, { contactStatus: val });
                  toast.success(`Status updated to ${val}`);
                } catch (e: any) {
                  toast.error(e.message || 'Failed to update status');
                }
              }}
            />
            <DrawerQualitySelect
              value={leadQuality}
              onChange={async (val) => {
                setLeadQuality(val);
                try {
                  await onUpdateStatus(enquiry.id, { leadQuality: val });
                  toast.success(`Quality set to ${val}`);
                } catch (e: any) {
                  toast.error(e.message || 'Failed to update quality');
                }
              }}
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setUploadModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20 border border-indigo-500/30 text-xs font-semibold transition-all shadow-sm cursor-pointer"
              title="Upload or paste Teams call transcript for this lead"
            >
              <PhoneCall className="w-3.5 h-3.5 text-indigo-400" />
              <span>Analyze Call</span>
            </button>

            <button
              onClick={() => onAssignClick(enquiry)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all cursor-pointer"
            >
              <UserCheck className="w-3.5 h-3.5 text-cyan-400" />
              <span>{enquiry.assignedToName ? enquiry.assignedToName : 'Assign'}</span>
            </button>

            {onEnrollClick && (
              <button
                onClick={() => onEnrollClick(enquiry)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-sm"
              >
                <GraduationCap className="w-3.5 h-3.5" />
                <span>Enroll in Batch</span>
              </button>
            )}
          </div>
        </div>

        {/* Drawer Body Scroll Area */}
        <div className="flex-1 overflow-y-auto p-2.5 sm:p-5 space-y-2.5 sm:space-y-5 pb-8 sm:pb-5">
          {activeTab === 'overview' ? (
            /* ── TAB 1: INQUIRY OVERVIEW ── */
            <div className="animate-in fade-in duration-150">
              {/* ── MOBILE ONLY: Inquiry Overview (< sm / iPhone 16) ── */}
              <div className="sm:hidden space-y-2.5">
                {/* 1. Inquiry message first, clamped to 3-4 lines with 'Read more' */}
                <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800/70 space-y-1.5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200">Client Inquiry Body</span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      Source: {enquiry.source || 'Outlook'}
                    </span>
                  </div>
                  <p className={`text-xs text-slate-300 leading-relaxed whitespace-pre-wrap bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/40 ${!isMessageExpanded ? 'line-clamp-3' : ''}`}>
                    {enquiry.lastMessage || 'No message body provided.'}
                  </p>
                  {(enquiry.lastMessage || '').length > 110 && (
                    <button
                      type="button"
                      onClick={() => setIsMessageExpanded(!isMessageExpanded)}
                      className="text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 pt-0.5 cursor-pointer block"
                    >
                      {isMessageExpanded ? 'Show less' : 'Read more'}
                    </button>
                  )}
                </div>

                {/* 2. Contact info in a compact 2-column grid: Email, Phone, Country, Received */}
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Email', value: enquiry.email || '—', icon: Mail },
                    { label: 'Phone', value: enquiry.phone || '—', icon: Phone },
                    { label: 'Country', value: enquiry.country || 'India', icon: Globe },
                    {
                      label: 'Received',
                      value: new Date(enquiry.messageTimestamp).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      }),
                      icon: Calendar,
                    },
                  ].map((info) => (
                    <div key={info.label} className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/60">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <info.icon className="w-3 h-3 text-cyan-400/80" />
                        <span className="text-[9px] text-slate-400 uppercase tracking-wider font-bold">
                          {info.label}
                        </span>
                      </div>
                      <span className="text-xs font-semibold text-slate-200 truncate block" title={info.value}>
                        {info.value}
                      </span>
                    </div>
                  ))}
                </div>

                {/* 3. Course & Service as small chips in one line: Training · Manhattan ProActive */}
                <div className="bg-slate-900/60 px-3 py-2.5 rounded-xl border border-slate-800/60 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <BookOpen className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span className="text-xs font-bold text-slate-200 truncate">Course & Service</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 text-xs">
                    <span className="px-2 py-0.5 text-[10px] font-semibold rounded-md bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                      {(enquiry.serviceType || '').toLowerCase() === 'job support' ? 'Job Support' : 'Training'}
                    </span>
                    <span className="text-slate-500 text-xs">•</span>
                    <span className="px-2 py-0.5 text-[10px] font-semibold rounded-md bg-slate-800/80 text-slate-200 border border-slate-700/60 truncate max-w-[150px]" title={enquiry.trainingType || enquiry.topic || 'General'}>
                      {enquiry.trainingType || enquiry.topic || 'General'}
                    </span>
                  </div>
                </div>

                {/* 4. Call Notes & Discussion Log (Mobile compact) */}
                <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                      <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Call Notes & Discussion</span>
                    </label>
                    <button
                      onClick={handleSaveNotes}
                      disabled={isSavingNote}
                      className="px-2.5 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-xs text-white font-bold transition-all shadow-sm disabled:opacity-60 cursor-pointer active:scale-95"
                    >
                      {isSavingNote ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                  <textarea
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    rows={2}
                    className="w-full p-2.5 bg-slate-950/60 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 resize-none"
                    placeholder="Enter notes from call or WhatsApp..."
                  />
                </div>

                {/* 5. AI Follow-Up Assessment (Mobile compact) */}
                <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                      <span className="text-xs font-bold text-slate-200">Follow-Up Action</span>
                    </div>
                    <span className={`px-2 py-0.5 text-[9px] font-bold rounded-full border ${
                      followUpInfo.urgency === 'high'
                        ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}>
                      {followUpInfo.urgency === 'high' ? 'High Urgency' : followUpInfo.urgency === 'medium' ? 'Active' : 'Routine'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed font-medium bg-slate-950/50 p-2 rounded-lg border border-slate-800/50">
                    {followUpInfo.suggestedAction}
                  </p>
                  <div className="flex items-center gap-2 pt-0.5">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold shrink-0">
                      Next Date:
                    </span>
                    <input
                      type="date"
                      value={followUpDate}
                      onChange={(e) => handleSaveFollowUpDate(e.target.value)}
                      disabled={isSavingFollowUp}
                      className="flex-1 bg-slate-950/60 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-cyan-500/50 cursor-pointer"
                    />
                    {followUpDate && (
                      <button
                        type="button"
                        onClick={() => handleSaveFollowUpDate('')}
                        disabled={isSavingFollowUp}
                        className="text-[10px] text-rose-400 hover:text-rose-300 underline font-semibold shrink-0 cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                {/* 6. Delete Record & Close */}
                <div className="pt-2 flex justify-between items-center border-t border-slate-800/60">
                  <DeleteRecordAction
                    recordId={enquiry.id}
                    recordName={enquiry.participantName}
                    buttonStyle="full"
                    onDeleteSuccess={(id) => {
                      onDeleteSuccess(id);
                      onClose();
                    }}
                  />
                  <button
                    onClick={onClose}
                    className="px-3.5 py-1.5 rounded-lg bg-slate-800 text-xs text-slate-300 hover:bg-slate-700 transition-colors cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>

              {/* ── DESKTOP ONLY: Tab 1 Content (>= sm) - 100% UNTOUCHED ── */}
              <div className="hidden sm:block sm:space-y-4">
                {/* Contact Information Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {[
                    { label: 'Email', value: enquiry.email || '—', icon: Mail },
                    { label: 'Phone', value: enquiry.phone || '—', icon: Phone },
                    { label: 'Country', value: enquiry.country || 'India', icon: Globe },
                    {
                      label: 'Received',
                      value: new Date(enquiry.messageTimestamp).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      }),
                      icon: Calendar,
                    },
                  ].map((info) => (
                    <div key={info.label} className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/60">
                      <div className="flex items-center gap-1.5 mb-1">
                        <info.icon className="w-3 h-3 text-slate-500" />
                        <span className="text-[9px] text-slate-400 uppercase tracking-wider font-bold">
                          {info.label}
                        </span>
                      </div>
                      <span className="text-xs font-semibold text-slate-200 truncate block" title={info.value}>
                        {info.value}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Course & Platform Requirements */}
                <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <BookOpen className="w-4 h-4 text-cyan-400" />
                      <span className="text-xs font-bold text-slate-200">Course & Service Details</span>
                    </div>
                    <span
                      className={`px-2 py-0.5 text-[10px] font-extrabold rounded-full border ${
                        (enquiry.serviceType || '').toLowerCase() === 'job support'
                          ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                          : 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30'
                      }`}
                    >
                      {(enquiry.serviceType || '').toLowerCase() === 'job support' ? 'Job Support' : 'Training'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800/50">
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider block mb-0.5">
                        Service Type
                      </span>
                      <span className="font-semibold text-slate-200">
                        {enquiry.serviceType || 'IT support & Training'}
                      </span>
                    </div>
                    <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800/50">
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider block mb-0.5">
                        Target Platform
                      </span>
                      <span className="font-semibold text-slate-200">
                        {enquiry.trainingType || enquiry.topic}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Inquiry Message Body */}
                <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/60 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300">Client Inquiry Body</span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      Source: {enquiry.source || 'Outlook'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap bg-slate-900/60 p-3 rounded-lg border border-slate-800/40">
                    {enquiry.lastMessage || 'No message body provided.'}
                  </p>
                </div>

                {/* Call Notes & Discussion Log */}
                <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      Call Notes & Discussion Log
                    </label>
                    <button
                      onClick={handleSaveNotes}
                      disabled={isSavingNote}
                      className="px-3 py-1 rounded-lg bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-xs text-white font-bold transition-all shadow-sm disabled:opacity-60 cursor-pointer"
                    >
                      {isSavingNote ? 'Saving...' : 'Save to DB'}
                    </button>
                  </div>
                  <textarea
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    rows={3}
                    className="w-full p-3 bg-slate-900/90 border border-slate-700/60 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 resize-none"
                    placeholder="Enter notes from call or WhatsApp discussion..."
                  />
                </div>

                {/* AI Follow-Up Assessment & Callback Scheduler */}
                <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-cyan-400" />
                      <span className="text-xs font-bold text-slate-200">AI Follow-Up Intelligence & Callback Scheduler</span>
                    </div>
                    <span className={`px-2 py-0.5 text-[10px] font-extrabold rounded-full border ${
                      followUpInfo.urgency === 'high'
                        ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                        : followUpInfo.urgency === 'medium'
                        ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}>
                      {followUpInfo.urgency === 'high' ? 'High Urgency' : followUpInfo.urgency === 'medium' ? 'Active Touchpoint' : 'Routine'}
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800/60 space-y-1">
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Suggested Follow-Up Action</div>
                    <p className="text-xs text-slate-200 leading-relaxed font-medium">
                      {followUpInfo.suggestedAction}
                    </p>
                  </div>

                  {/* Follow-up Date Input */}
                  <div className="flex items-center justify-between gap-3 pt-1">
                    <div className="flex-1">
                      <label className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold mb-1">
                        Next Follow-Up Date:
                      </label>
                      <input
                        type="date"
                        value={followUpDate}
                        onChange={(e) => handleSaveFollowUpDate(e.target.value)}
                        disabled={isSavingFollowUp}
                        className="w-full bg-slate-900 border border-slate-700/60 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500/50 cursor-pointer"
                      />
                    </div>
                    {followUpDate && (
                      <button
                        type="button"
                        onClick={() => handleSaveFollowUpDate('')}
                        disabled={isSavingFollowUp}
                        className="text-[10px] text-rose-400 hover:text-rose-300 underline font-semibold mt-4 cursor-pointer"
                      >
                        Clear Date
                      </button>
                    )}
                  </div>
                </div>

                {/* Delete Record Area */}
                <div className="pt-2 flex justify-between items-center border-t border-slate-800/60">
                  <DeleteRecordAction
                    recordId={enquiry.id}
                    recordName={enquiry.participantName}
                    buttonStyle="full"
                    onDeleteSuccess={(id) => {
                      onDeleteSuccess(id);
                      onClose();
                    }}
                  />
                  <button
                    onClick={onClose}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-xs text-slate-300 hover:bg-slate-700 transition-colors"
                  >
                    Close Drawer
                  </button>
                </div>
              </div>
            </div>
          ) : activeTab === 'cx' ? (
            /* ── TAB 3: CUSTOMER EXPERIENCE ── */
            <CustomerExperienceTab
              enquiry={enquiry}
              latestCall={latestCall}
              onSaveCX={handleSaveCX}
              onOpenUploadModal={() => setUploadModalOpen(true)}
            />
          ) : (
            /* ── TAB 2: CALL INTELLIGENCE & BATTLECARDS ── */
            <div className="space-y-4 animate-in fade-in duration-150">
              {isLoadingCalls ? (
                <div className="flex items-center justify-center py-12 text-slate-400 text-sm">
                  Loading call intelligence...
                </div>
              ) : !latestCall ? (
                <div className="text-center py-10 px-4 rounded-xl border border-dashed border-slate-800 bg-slate-950/40 space-y-3">
                  <PhoneCall className="w-8 h-8 text-slate-500 mx-auto" />
                  <div>
                    <p className="text-sm font-medium text-slate-300">No Call Intelligence Recorded Yet</p>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                      Upload or paste a Microsoft Teams transcript to generate the 1-10 rubric score, candidate talk-time, and objection battlecards.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setUploadModalOpen(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-xs font-bold text-white shadow-md cursor-pointer transition-all"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Paste / Upload Teams Transcript</span>
                  </button>
                </div>
              ) : (
                <>
                  {/* Call Overview Metrics */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                        <Clock className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-400">Call Duration</div>
                        <div className="text-sm font-bold text-white">{latestCall.durationMinutes} mins</div>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center">
                      <TalkTimeDonut
                        candidatePct={latestCall.candidateTalkPct}
                        hostName="Sam"
                      />
                    </div>
                  </div>

                  {/* AI Call Summary */}
                  <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80">
                    <div className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                      AI Call Summary
                    </div>
                    <p className="text-xs text-slate-200 leading-relaxed">
                      {latestCall.summary.replace(/Arul\s+Xavier/gi, 'Sam').replace(/\bArul\b/gi, 'Sam')}
                    </p>
                  </div>

                  {/* Discovery Matrix Grid */}
                  <div className="grid grid-cols-2 gap-2.5 text-xs">
                    <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                      <span className="text-slate-400 font-medium block mb-1">Core Need:</span>
                      <span className="text-white font-semibold">{latestCall.clientNeed || 'Not specified'}</span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                      <span className="text-slate-400 font-medium block mb-1">Budget Readiness:</span>
                      <span className="text-emerald-400 font-semibold">{latestCall.budget || 'In evaluation'}</span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                      <span className="text-slate-400 font-medium block mb-1">Timeline Urgency:</span>
                      <span className="text-cyan-400 font-semibold">{latestCall.timeline || 'Flexible'}</span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                      <span className="text-slate-400 font-medium block mb-1">Decision Authority:</span>
                      <span className="text-indigo-300 font-semibold">{latestCall.decisionMaker || 'Self / Direct'}</span>
                    </div>
                  </div>

                  {/* Objection Battlecard (Counter-Pitch) */}
                  {latestCall.counterPitch && (
                    <div className="p-4 rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-500/5 border border-amber-500/20">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300 uppercase tracking-wide">
                          <Flame className="w-3.5 h-3.5 text-amber-400" />
                          Sales Battlecard (Objection Pitch)
                        </div>
                        <button
                          onClick={() => handleCopyPitch(
                            latestCall.counterPitch!.replace(/Arul\s+Xavier/gi, 'Sam').replace(/\bArul\b/gi, 'Sam')
                          )}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400 hover:text-white transition-colors"
                        >
                          {copiedPitch ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-400">Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy Pitch</span>
                            </>
                          )}
                        </button>
                      </div>
                      {latestCall.objections && (
                        <div className="text-xs text-amber-200/80 mb-2 italic">
                          Objection: "{latestCall.objections.replace(/Arul\s+Xavier/gi, 'Sam').replace(/\bArul\b/gi, 'Sam')}"
                        </div>
                      )}
                      <p className="text-xs text-slate-200 leading-relaxed bg-slate-900/60 p-3 rounded-lg border border-amber-500/10">
                        {latestCall.counterPitch.replace(/Arul\s+Xavier/gi, 'Sam').replace(/\bArul\b/gi, 'Sam')}
                      </p>
                    </div>
                  )}

                  {/* Verbatim Candidate Quotes */}
                  {parsedQuotes && (
                    <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                      <div className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                        Verbatim Candidate Quotes
                      </div>
                      <div className="space-y-2 text-xs">
                        {Object.entries(parsedQuotes).map(([key, val]) => (
                          <div key={key} className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80">
                            <span className="text-cyan-400 font-semibold uppercase text-[10px] block mb-0.5">
                              {key}
                            </span>
                            <span className="text-slate-300 italic">{String(val)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Multi-Call Timeline History */}
                  {callHistory.length > 1 && (
                    <div className="pt-2">
                      <div className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                        Multi-Call History ({callHistory.length} calls)
                      </div>
                      <div className="space-y-2">
                        {callHistory.map((call, idx) => (
                          <div
                            key={call.id}
                            className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center font-bold text-slate-400 text-[10px]">
                                #{callHistory.length - idx}
                              </span>
                              <div>
                                <span className="font-semibold text-white">
                                  {new Date(call.callDate).toLocaleDateString('en-IN', {
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric',
                                  })}
                                </span>
                                <span className="text-slate-400 text-[10px] block">
                                  {call.durationMinutes} min call
                                </span>
                              </div>
                            </div>
                            <span className="font-bold text-cyan-400">{call.score}/10</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Transcript Upload & AI Analysis Modal */}
      <TranscriptUploadModal
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        enquiryId={enquiry.id}
        defaultCandidateName={enquiry.participantName}
        defaultCandidateEmail={enquiry.email || ''}
        defaultCandidatePhone={enquiry.phone || ''}
        onSuccess={() => {
          fetchCallTimeline();
          onUpdateStatus(enquiry.id, { contactStatus: 'Talked' });
        }}
      />
    </div>
  );
}
