'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import {
  X, RefreshCw, Search, Filter, Globe, BookOpen, MessageSquare, Phone,
  Mail, CheckCircle2, AlertCircle, Sparkles, TrendingUp, UserCheck, Star,
  Send, Calendar, ArrowUpDown, ArrowLeft, Building2, User, Eye, FileText,
  ExternalLink, Upload, ChevronLeft, ChevronRight, Clock, PhoneCall, XCircle,
  Zap, ShieldAlert, Circle, ChevronDown, ChevronUp, Briefcase
} from 'lucide-react';
import { toast } from 'sonner';
import AssignLeadModal from '@/components/AssignLeadModal';
import MobileLeadCards from '@/components/MobileLeadCards';
import DeleteRecordAction from '@/components/DeleteRecordAction';
import { NavDrawerButton } from '@/components/NavigationContext';
import { CallVolumeMeter } from '@/components/call-intelligence/CallVolumeMeter';
import { RedFlagBadge } from '@/components/call-intelligence/RedFlagBadge';
import { LeadDetailsDrawer } from '@/components/call-intelligence/LeadDetailsDrawer';
import { TeamsSyncControls } from '@/components/call-intelligence/TeamsSyncControls';
import { FollowUpAssistantBar } from '@/components/call-intelligence/FollowUpAssistantBar';
import { analyzeEnquiryFollowUp } from '@/lib/followup-intelligence';
import { DailyPipelineBoard } from '@/components/pipeline/DailyPipelineBoard';

interface Enquiry {
  id: string;
  participantName: string;
  email: string | null;
  phone: string;
  country: string | null;
  serviceType: string | null;
  trainingType: string | null;
  topic: string;
  lastMessage: string | null;
  messageTimestamp: string;
  dateSubmitted: string | null;
  receivedDate: string | null;
  leadQuality: string; // Unrated, High, Medium, Low
  contactStatus: string; // Pending, In Touch, Talked, Converted, Lost
  status: string; // Open, Action Required, Processed, Resolved
  source: string;
  processedNotes: string | null;
  assignedToId?: string | null;
  assignedToName?: string | null;
  callScore?: number | null;
  callFollowUpDate?: string | null;
  hasRedFlag?: boolean;
  redFlagReason?: string | null;
  redFlagDismissed?: boolean;
}

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

function StatusBadgeSelect({ value, onChange, className = '' }: { value: string; onChange: (val: string) => void; className?: string }) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const current = STATUS_CONFIG[value] || STATUS_CONFIG['Pending'];
  const Icon = current.icon;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`inline-flex items-center justify-center gap-1.5 px-2.5 py-1 h-7 rounded-xl text-[11px] font-bold border transition-all cursor-pointer whitespace-nowrap leading-none shrink-0 ${current.bg} ${current.color} ${current.border} hover:brightness-125 shadow-sm ${className || 'w-[114px]'}`}
      >
        <Icon className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="truncate">{current.label}</span>
      </button>

      {open && (
        <div className="absolute left-0 mt-1 w-36 bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-xl shadow-2xl z-50 p-1 space-y-0.5 animate-[fadeIn_0.15s_ease]">
          {Object.entries(STATUS_CONFIG).map(([key, config]) => {
            const ItemIcon = config.icon;
            return (
              <button
                key={key}
                type="button"
                onClick={() => { onChange(key); setOpen(false); }}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer text-left ${
                  value === key ? 'bg-slate-800 text-white font-bold' : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                }`}
              >
                <ItemIcon className={`w-3.5 h-3.5 ${config.color}`} />
                <span>{config.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function QualityBadgeSelect({ value, onChange, className = '' }: { value: string; onChange: (val: string) => void; className?: string }) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const current = QUALITY_CONFIG[value] || QUALITY_CONFIG['Unrated'];
  const Icon = current.icon;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`inline-flex items-center justify-center gap-1.5 px-2.5 py-1 h-7 rounded-xl text-[11px] font-bold border transition-all cursor-pointer whitespace-nowrap leading-none shrink-0 ${current.bg} ${current.color} ${current.border} hover:brightness-125 shadow-sm ${className || 'w-[136px]'}`}
      >
        <Icon className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="truncate">{current.label}</span>
      </button>

      {open && (
        <div className="absolute left-0 mt-1 w-40 bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-xl shadow-2xl z-50 p-1 space-y-0.5 animate-[fadeIn_0.15s_ease]">
          {Object.entries(QUALITY_CONFIG).map(([key, config]) => {
            const ItemIcon = config.icon;
            return (
              <button
                key={key}
                type="button"
                onClick={() => { onChange(key); setOpen(false); }}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer text-left ${
                  value === key ? 'bg-slate-800 text-white font-bold' : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                }`}
              >
                <ItemIcon className={`w-3.5 h-3.5 ${config.color}`} />
                <span>{config.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}


interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

function MiniDonutChart({
  data,
  total,
  title,
  isOpenControlled,
  onToggle,
}: {
  data: DonutSegment[];
  total: number;
  title: string;
  isOpenControlled?: boolean;
  onToggle?: () => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isCurrentlyOpen = isOpenControlled !== undefined ? isOpenControlled : internalOpen;
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isCurrentlyOpen) return;
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        if (isOpenControlled && onToggle) {
          onToggle();
        } else {
          setInternalOpen(false);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isCurrentlyOpen, isOpenControlled, onToggle]);

  const size = 48;
  const strokeWidth = 7;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let accumulatedPct = 0;

  return (
    <div
      ref={containerRef}
      onClick={(e) => {
        e.stopPropagation();
        if (onToggle) {
          onToggle();
        } else {
          setInternalOpen((prev) => !prev);
        }
      }}
      className="sm:relative group/donut cursor-pointer shrink-0 select-none"
    >
      {/* Pure Donut Chart Container */}
      <div className="w-9 h-9 sm:w-12 sm:h-12 flex items-center justify-center transition-all duration-300 ease-out transform group-hover/donut:scale-[1.18] sm:group-hover/donut:scale-[1.8] group-hover/donut:z-40 filter drop-shadow-[0_4px_12px_rgba(0,0,0,0.6)]">
        <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full transform -rotate-90">
          {total === 0 ? (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="#334155"
              strokeWidth={strokeWidth}
            />
          ) : (
            data.map((seg, i) => {
              const pct = seg.value / total;
              if (pct <= 0) return null;
              const strokeDasharray = `${pct * circumference} ${circumference}`;
              const strokeDashoffset = -accumulatedPct * circumference;
              accumulatedPct += pct;

              return (
                <circle
                  key={i}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth={strokeWidth}
                  strokeDasharray={strokeDasharray}
                  strokeDashoffset={strokeDashoffset}
                  className="transition-all duration-500"
                />
              );
            })
          )}
        </svg>
      </div>

      {/* Breakdown Tooltip (Mobile: anchored to card boundaries | Desktop: 192px floating dropdown) */}
      <div
        className={`absolute top-full mt-1.5 sm:mt-2 left-0 right-0 sm:left-auto sm:right-0 sm:w-48 p-2.5 rounded-xl bg-[#090e1a] border border-slate-700/90 shadow-[0_12px_36px_rgba(0,0,0,0.95)] z-50 text-[9.5px] sm:text-[11px] space-y-1 sm:space-y-1.5 ${
          isCurrentlyOpen
            ? 'opacity-100 pointer-events-auto translate-y-0 scale-100'
            : 'opacity-0 pointer-events-none translate-y-1 scale-95 group-hover/donut:opacity-100 group-hover/donut:pointer-events-auto group-hover/donut:translate-y-0 group-hover/donut:scale-100'
        }`}
      >
        <div className="text-[8.5px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-400 pb-1 border-b border-slate-800 flex justify-between items-center gap-1">
          <span className="text-cyan-400 font-semibold truncate">{title}</span>
          <span className="text-slate-500 font-normal shrink-0">{total} total</span>
        </div>
        <div className="space-y-1">
          {data.map((seg, i) => {
            const pct = total > 0 ? Math.round((seg.value / total) * 100) : 0;
            return (
              <div key={i} className="flex items-center justify-between gap-1 text-slate-200">
                <div className="flex items-center gap-1 min-w-0">
                  <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
                  <span className="truncate text-[8.5px] sm:text-[10px] text-slate-300">{seg.label}</span>
                </div>
                <span className="font-mono font-bold text-[8.5px] sm:text-[10px] text-slate-200 shrink-0">
                  {seg.value} <span className="text-[7.5px] sm:text-[9px] text-slate-500 font-normal">({pct}%)</span>
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function EnquiriesPage() {
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDonut, setActiveDonut] = useState<string | null>(null);

  // Close active donut popup when clicking outside anywhere on the page
  useEffect(() => {
    if (!activeDonut) return;
    const handleGlobalClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.group\\/donut')) {
        setActiveDonut(null);
      }
    };
    document.addEventListener('mousedown', handleGlobalClickOutside);
    document.addEventListener('touchstart', handleGlobalClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleGlobalClickOutside);
      document.removeEventListener('touchstart', handleGlobalClickOutside);
    };
  }, [activeDonut]);
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [summary, setSummary] = useState<any>(null);

  // Mobile accordion state
  const [expandedLeadId, setExpandedLeadId] = useState<string | null>(null);
  const handleToggleExpand = (id: string) => setExpandedLeadId(prev => (prev === id ? null : id));
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const toggleRow = (id: string) => setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));

  // Filters
  const [search, setSearch] = useState('');
  const [countryFilter, setCountryFilter] = useState('ALL');
  const [courseFilter, setCourseFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [qualityFilter, setQualityFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'quality'>('date_desc');
  const [smartFollowUpFilter, setSmartFollowUpFilter] = useState('all');
  const [aiMatchedIds, setAiMatchedIds] = useState<string[] | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Reset to page 1 when search or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, countryFilter, courseFilter, statusFilter, qualityFilter, sortBy, smartFollowUpFilter, aiMatchedIds]);

  // Notes & Assign Modal state
  const [editingEnquiry, setEditingEnquiry] = useState<Enquiry | null>(null);
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [selectedDetailEnquiry, setSelectedDetailEnquiry] = useState<Enquiry | null>(null);
  const [selectedCallEnquiry, setSelectedCallEnquiry] = useState<Enquiry | null>(null);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignTargetEnquiry, setAssignTargetEnquiry] = useState<Enquiry | null>(null);

  // User Session
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.user) setCurrentUser(data.user);
      })
      .catch(() => {});
  }, []);

  const openAssignModal = (enquiry: Enquiry) => {
    setAssignTargetEnquiry(enquiry);
    setAssignModalOpen(true);
  };

  const fetchEnquiries = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/enquiries/sync-excel', { cache: 'no-store' });
      const json = await res.json();
      if (json.success) {
        setEnquiries(json.enquiries || []);
        if (json.lastSynced) setLastSynced(json.lastSynced);
        if (json.summary) setSummary(json.summary);
      }
    } catch (err) {
      console.error('Failed to fetch enquiries:', err);
      toast.error('Failed to load enquiries from database.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEnquiries();

    const handleExternalLeadUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { enquiryId, contactStatus, status, leadQuality, notes, enquiry } = customEvent.detail || {};
      if (enquiryId) {
        setEnquiries((prev) =>
          prev.map((e) => {
            if (e.id !== enquiryId) return e;
            if (enquiry) return { ...e, ...enquiry };
            return {
              ...e,
              ...(contactStatus !== undefined ? { contactStatus } : {}),
              ...(status !== undefined ? { status } : {}),
              ...(leadQuality !== undefined ? { leadQuality } : {}),
              ...(notes !== undefined ? { processedNotes: notes } : {}),
            };
          })
        );
      }
    };

    window.addEventListener('gapanchor:lead-updated', handleExternalLeadUpdate);
    return () => window.removeEventListener('gapanchor:lead-updated', handleExternalLeadUpdate);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setSelectedFile(file);
    if (file) handleSyncExcel(file);
  };

  const handleSyncExcel = async (file?: File) => {
    setSyncing(true);
    try {
      let res: Response;
      if (file) {
        const formData = new FormData();
        formData.append('file', file);
        res = await fetch('/api/enquiries/sync-excel', { method: 'POST', body: formData });
      } else {
        res = await fetch('/api/enquiries/sync-excel', { method: 'POST' });
      }
      const json = await res.json();
      if (json.success) {
        toast.success(json.message || 'Outlook synced successfully!');
        setEnquiries(json.enquiries || []);
        if (json.summary) setSummary(json.summary);
        setLastSynced(new Date().toISOString());
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      } else {
        toast.error(`Sync failed: ${json.error}`);
      }
    } catch (err: any) {
      toast.error(`Sync failed: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleUpdateStatus = async (enquiryId: string, updates: { contactStatus?: string; leadQuality?: string; status?: string; notes?: string }) => {
    try {
      const res = await fetch('/api/enquiries/sync-excel', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enquiryId, ...updates }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Saved lead update to database');
        setEnquiries(prev => prev.map(e => e.id === enquiryId ? { ...e, ...json.enquiry } : e));
      } else {
        toast.error(json.error || 'Update failed');
      }
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleSaveNotes = async () => {
    if (!editingEnquiry) return;
    setSavingNote(true);
    try {
      await handleUpdateStatus(editingEnquiry.id, { notes: noteText });
      setEditingEnquiry(null);
    } finally {
      setSavingNote(false);
    }
  };

  // Extract unique countries & courses for dropdown options
  const uniqueCountries = useMemo(() => {
    const set = new Set<string>();
    enquiries.forEach(e => { if (e.country) set.add(e.country); });
    return Array.from(set).sort();
  }, [enquiries]);

  const uniqueCourses = useMemo(() => {
    const set = new Set<string>();
    enquiries.forEach(e => {
      if (e.trainingType) set.add(e.trainingType);
      else if (e.topic) set.add(e.topic);
    });
    return Array.from(set).sort();
  }, [enquiries]);

  // Filtering & Sorting
  const filteredEnquiries = useMemo(() => {
    // 1. If AI copilot matched specific lead IDs, prioritize that curated set
    if (aiMatchedIds && aiMatchedIds.length > 0) {
      const aiSet = new Set(aiMatchedIds);
      let leads = enquiries.filter(item => aiSet.has(item.id));

      // If user typed into the secondary search input, allow searching within AI results
      if (search.trim()) {
        const searchLower = search.toLowerCase().trim();
        leads = leads.filter(item =>
          item.participantName.toLowerCase().includes(searchLower) ||
          (item.email && item.email.toLowerCase().includes(searchLower)) ||
          (item.phone && item.phone.includes(searchLower)) ||
          (item.country && item.country.toLowerCase().includes(searchLower)) ||
          (item.trainingType && item.trainingType.toLowerCase().includes(searchLower)) ||
          (item.topic && item.topic.toLowerCase().includes(searchLower)) ||
          (item.processedNotes && item.processedNotes.toLowerCase().includes(searchLower))
        );
      }

      // Preserve Gemini's recommended priority order
      return leads.sort((a, b) => {
        const idxA = aiMatchedIds.indexOf(a.id);
        const idxB = aiMatchedIds.indexOf(b.id);
        return (idxA === -1 ? 9999 : idxA) - (idxB === -1 ? 9999 : idxB);
      });
    }

    // 2. Standard multi-criteria filtering
    return enquiries.filter(item => {
      const searchLower = search.toLowerCase().trim();
      let matchesSearch = true;
      if (searchLower) {
        const directMatch =
          item.participantName.toLowerCase().includes(searchLower) ||
          (item.email && item.email.toLowerCase().includes(searchLower)) ||
          (item.phone && item.phone.includes(searchLower)) ||
          (item.country && item.country.toLowerCase().includes(searchLower)) ||
          (item.trainingType && item.trainingType.toLowerCase().includes(searchLower)) ||
          (item.topic && item.topic.toLowerCase().includes(searchLower)) ||
          (item.lastMessage && item.lastMessage.toLowerCase().includes(searchLower)) ||
          (item.processedNotes && item.processedNotes.toLowerCase().includes(searchLower));

        const isImportantIntent = searchLower.includes('important') || searchLower.includes('priority') || searchLower.includes('high quality') || searchLower.includes('hot');
        const semanticImportant = isImportantIntent && (item.leadQuality === 'High' || (typeof item.callScore === 'number' && item.callScore >= 8));

        const isDueIntent = searchLower.includes('due') || searchLower.includes('callback') || searchLower.includes('today') || searchLower.includes('overdue');
        const semanticDue = isDueIntent && (Boolean(item.callFollowUpDate) || (item.contactStatus === 'In Touch' && Boolean(item.processedNotes)));

        const tokens = searchLower.split(/\s+/).filter(Boolean);
        const allTokensMatch = tokens.length > 1 && tokens.every(token =>
          item.participantName.toLowerCase().includes(token) ||
          (item.email && item.email.toLowerCase().includes(token)) ||
          (item.phone && item.phone.includes(token)) ||
          (item.country && item.country.toLowerCase().includes(token)) ||
          (item.trainingType && item.trainingType.toLowerCase().includes(token)) ||
          (item.topic && item.topic.toLowerCase().includes(token)) ||
          (item.processedNotes && item.processedNotes.toLowerCase().includes(token))
        );

        matchesSearch = directMatch || semanticImportant || semanticDue || allTokensMatch;
      }

      const matchesCountry = countryFilter === 'ALL' || item.country === countryFilter;
      const isJobSupportItem = (item.serviceType || '').toLowerCase() === 'job support' || (item.trainingType || '').toLowerCase() === 'job support';
      let matchesCourse = false;
      if (courseFilter === 'ALL') {
        matchesCourse = true;
      } else if (courseFilter === 'Job Support') {
        matchesCourse = isJobSupportItem;
      } else if (courseFilter === 'Training') {
        matchesCourse = !isJobSupportItem;
      } else {
        matchesCourse = item.trainingType === courseFilter || item.topic === courseFilter;
      }
      const matchesStatus = statusFilter === 'ALL' || item.contactStatus === statusFilter;
      const matchesQuality = qualityFilter === 'ALL' || item.leadQuality === qualityFilter;

      let matchesSmartFollowUp = true;
      if (smartFollowUpFilter !== 'all') {
        const analysis = analyzeEnquiryFollowUp(item);
        if (smartFollowUpFilter === 'due_today') {
          matchesSmartFollowUp = analysis.isDueTodayOrOverdue;
        } else if (smartFollowUpFilter === 'high_intent') {
          matchesSmartFollowUp = analysis.category === 'high_intent' || (typeof item.callScore === 'number' && item.callScore >= 8);
        } else if (smartFollowUpFilter === 'demo_followup') {
          matchesSmartFollowUp = analysis.category === 'demo_followup';
        } else if (smartFollowUpFilter === 'email_pending') {
          matchesSmartFollowUp = analysis.category === 'whatsapp_missing' || analysis.category === 'email_pending';
        } else if (smartFollowUpFilter === 'red_flags') {
          matchesSmartFollowUp = Boolean(item.hasRedFlag && !item.redFlagDismissed);
        } else if (smartFollowUpFilter === 'has_notes') {
          matchesSmartFollowUp = Boolean(item.processedNotes && item.processedNotes.trim().length > 0);
        }
      }

      return matchesSearch && matchesCountry && matchesCourse && matchesStatus && matchesQuality && matchesSmartFollowUp;
    }).sort((a, b) => {
      if (sortBy === 'date_desc') {
        return new Date(b.messageTimestamp).getTime() - new Date(a.messageTimestamp).getTime();
      }
      if (sortBy === 'date_asc') {
        return new Date(a.messageTimestamp).getTime() - new Date(b.messageTimestamp).getTime();
      }
      if (sortBy === 'quality') {
        const qualityRank: Record<string, number> = { High: 3, Medium: 2, Low: 1, Unrated: 0 };
        return (qualityRank[b.leadQuality] || 0) - (qualityRank[a.leadQuality] || 0);
      }
      return 0;
    });
  }, [enquiries, search, countryFilter, courseFilter, statusFilter, qualityFilter, sortBy, smartFollowUpFilter, aiMatchedIds]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredEnquiries.length / pageSize) || 1;

  const paginatedEnquiries = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredEnquiries.slice(start, start + pageSize);
  }, [filteredEnquiries, currentPage, pageSize]);

  // Stats calculation
  const totalCount = enquiries.length;
  const highQualityCount = enquiries.filter(e => e.leadQuality === 'High').length;
  const talkedCount = enquiries.filter(e => e.contactStatus === 'Talked' || e.contactStatus === 'In Touch' || e.contactStatus === 'Converted').length;
  const pendingCount = enquiries.filter(e => e.contactStatus === 'Pending' || !e.contactStatus).length;

  // Mini Donut Data Calculations
  const manhattanWmsCount = enquiries.filter(e => (e.trainingType || '').toLowerCase().includes('manhattan wms')).length;
  const manhattanProActiveCount = enquiries.filter(e => (e.trainingType || '').toLowerCase().includes('proactive')).length;
  const blueYonderCount = enquiries.filter(e => (e.trainingType || '').toLowerCase().includes('blue yonder') || (e.trainingType || '').toLowerCase().includes('jda')).length;
  const otherCoursesCount = Math.max(0, totalCount - (manhattanWmsCount + manhattanProActiveCount + blueYonderCount));

  const indiaCount = enquiries.filter(e => (e.country || '').toLowerCase().includes('india')).length;
  const usaCount = enquiries.filter(e => (e.country || '').toLowerCase().includes('usa') || (e.country || '').toLowerCase().includes('united states')).length;

  const mediumQualityCount = enquiries.filter(e => e.leadQuality === 'Medium').length;
  const lowQualityCount = enquiries.filter(e => e.leadQuality === 'Low').length;
  const unratedQualityCount = enquiries.filter(e => !e.leadQuality || e.leadQuality === 'Unrated').length;

  const pureTalkedCount = enquiries.filter(e => e.contactStatus === 'Talked' || e.contactStatus === 'In Touch').length;
  const convertedCount = enquiries.filter(e => e.contactStatus === 'Converted').length;
  const lostCount = enquiries.filter(e => e.contactStatus === 'Lost' || e.contactStatus === 'Not Interested').length;

  return (
    <div className="min-h-screen bg-[#080c14] text-slate-100 flex flex-col font-sans" style={{backgroundImage:'radial-gradient(ellipse at 20% 0%, rgba(6,182,212,0.07) 0%, transparent 60%), radial-gradient(ellipse at 80% 100%, rgba(99,102,241,0.07) 0%, transparent 60%)'}}>
      <div className="w-full max-w-full px-2 sm:px-4 md:px-8 py-4 sm:py-6 space-y-4 sm:space-y-5 flex-1 flex flex-col">

        {/* ── Top Navigation Bar ── */}
        <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-3 sm:gap-4 p-3.5 sm:p-5 bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl w-full max-w-full overflow-hidden">
          <div className="flex items-center justify-between w-full xl:w-auto gap-2">
            <div className="flex items-start md:items-center space-x-3 sm:space-x-4 min-w-0 flex-1">
              <Link href="/" className="group flex items-center gap-2 p-2 sm:px-3.5 sm:py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/50 text-slate-300 hover:text-white transition-all shadow-inner shrink-0">
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
                <span className="text-xs font-semibold hidden md:inline">Dashboard</span>
              </Link>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-base md:text-2xl font-black tracking-tight bg-gradient-to-r from-cyan-300 via-white to-indigo-300 bg-clip-text text-transparent truncate">
                    Enquiry Intelligence
                  </h1>
                  <span className="hidden sm:inline px-2.5 py-0.5 text-[10px] font-bold tracking-widest rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/25 uppercase shrink-0">
                    Live CRM
                  </span>
                </div>
                <p className="text-[10px] md:text-[11px] text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap truncate">
                  <span className="inline-flex items-center gap-1 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
                    Supabase PostgreSQL
                  </span>
                  <span className="hidden md:inline text-slate-600 shrink-0">• Real-time DB Persistence</span>
                  {lastSynced && <span className="text-slate-600 shrink-0">• Synced {new Date(lastSynced).toLocaleTimeString()}</span>}
                </p>
              </div>
            </div>

            {/* Pinned Top-Right Navigation Drawer Button for Mobile View */}
            <div className="xl:hidden shrink-0">
              <NavDrawerButton className="!w-8 !h-8 sm:!w-10 sm:!h-10" />
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 w-full xl:w-auto justify-end overflow-visible">
            <TeamsSyncControls onSyncComplete={fetchEnquiries} />
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileChange} />
            <button
              onClick={() => handleSyncExcel()}
              disabled={syncing}
              title="Sync latest enquiries from Outlook Microsoft Graph"
              className="h-7 sm:h-10 flex items-center gap-1 sm:gap-2 px-2.5 sm:px-4 rounded-lg sm:rounded-xl text-[11px] sm:text-sm font-semibold bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 hover:text-white border border-slate-700/80 hover:border-slate-600 shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap shrink-0"
            >
              <RefreshCw className={`w-3 h-3 sm:w-4 sm:h-4 text-cyan-400 ${syncing ? 'animate-spin' : ''}`} />
              <span>{syncing ? 'Syncing Outlook...' : 'Sync Outlook'}</span>
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={syncing}
              title="Upload custom data file"
              className="w-7 h-7 sm:w-10 sm:h-10 flex items-center justify-center rounded-lg sm:rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/50 text-slate-400 hover:text-white transition-all cursor-pointer shrink-0"
            >
              <Upload className="w-3 h-3 sm:w-4 sm:h-4" />
            </button>
            {/* Desktop Navigation Drawer Button */}
            <div className="hidden xl:block shrink-0">
              <NavDrawerButton />
            </div>
          </div>
        </div>

        {/* ── KPI Metric Cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
          {[
            {
              label: 'Total Enquiries',
              value: totalCount,
              icon: MessageSquare,
              color: 'cyan',
              iconBg: 'bg-cyan-500/10',
              iconColor: 'text-cyan-400',
              glow: 'shadow-cyan-500/20',
              border: 'border-cyan-500/15',
              donutTotal: totalCount,
              donutData: [
                { label: 'Manhattan WMS', value: manhattanWmsCount, color: '#06b6d4' },
                { label: 'ProActive', value: manhattanProActiveCount, color: '#6366f1' },
                { label: 'Blue Yonder', value: blueYonderCount, color: '#a855f7' },
                { label: 'Other Courses', value: otherCoursesCount, color: '#64748b' },
              ]
            },
            {
              label: 'Countries Reached',
              value: uniqueCountries.length,
              icon: Globe,
              color: 'emerald',
              iconBg: 'bg-emerald-500/10',
              iconColor: 'text-emerald-400',
              glow: 'shadow-emerald-500/20',
              border: 'border-emerald-500/15',
              donutTotal: totalCount,
              donutData: [
                { label: 'India', value: indiaCount, color: '#10b981' },
                { label: 'USA', value: usaCount, color: '#3b82f6' },
                { label: 'Other Countries', value: Math.max(0, enquiries.length - indiaCount - usaCount), color: '#06b6d4' },
              ]
            },
            {
              label: 'High Quality Leads',
              value: highQualityCount,
              icon: Star,
              color: 'amber',
              iconBg: 'bg-amber-500/10',
              iconColor: 'text-amber-400',
              glow: 'shadow-amber-500/20',
              border: 'border-amber-500/15',
              suffix: highQualityCount > 0 ? '🔥' : '',
              donutTotal: totalCount,
              donutData: [
                { label: 'High Quality', value: highQualityCount, color: '#f59e0b' },
                { label: 'Medium Quality', value: mediumQualityCount, color: '#06b6d4' },
                { label: 'Low Quality', value: lowQualityCount, color: '#64748b' },
                { label: 'Unrated', value: unratedQualityCount, color: '#334155' },
              ]
            },
            {
              label: 'Talked / In Touch',
              value: talkedCount,
              icon: UserCheck,
              color: 'violet',
              iconBg: 'bg-violet-500/10',
              iconColor: 'text-violet-400',
              glow: 'shadow-violet-500/20',
              border: 'border-violet-500/15',
              sub: `${pendingCount} pending`,
              donutTotal: totalCount,
              donutData: [
                { label: 'Talked / Touch', value: pureTalkedCount, color: '#8b5cf6' },
                { label: 'Converted', value: convertedCount, color: '#10b981' },
                { label: 'Pending', value: pendingCount, color: '#f59e0b' },
                { label: 'Lost / Closed', value: lostCount, color: '#f43f5e' },
              ]
            },
          ].map((card) => {
            const isCardActive = activeDonut === card.label;
            return (
              <div
                key={card.label}
                className={`relative p-3.5 sm:p-5 rounded-2xl bg-slate-900/70 backdrop-blur-md border border-slate-700/50 shadow-md shadow-black/20 min-h-[110px] sm:min-h-0 flex flex-col justify-between transition-all ${
                  isCardActive ? 'z-40 ring-1 ring-cyan-500/40' : 'z-10 hover:z-30'
                }`}
              >

                {/* Mobile-only Top Row: Full-width Label + Compact Icon */}
                <div className="flex sm:hidden items-center justify-between w-full mb-1">
                  <p className="text-[8.5px] font-bold text-slate-400 uppercase tracking-wider truncate max-w-[125px]">
                    {card.label}
                  </p>
                  <div className={`p-1 rounded-lg ${card.iconBg} border ${card.border} shadow-inner shrink-0`}>
                    <card.icon className={`w-3.5 h-3.5 ${card.iconColor}`} />
                  </div>
                </div>

                {/* Main row: Desktop has Label + Value + Donut + Icon | Mobile has Value + Donut */}
                <div className="flex items-center justify-between relative gap-2 sm:gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="hidden sm:block text-[10px] font-semibold text-slate-500 uppercase tracking-widest truncate">{card.label}</p>
                    <p className="text-xl sm:text-3xl font-black text-white sm:mt-1 tracking-tight">
                      {card.value}{card.suffix && <span className="ml-1 text-sm sm:text-xl">{card.suffix}</span>}
                    </p>
                    {card.sub && <p className="text-[9px] sm:text-[11px] text-slate-500 mt-0.5">{card.sub}</p>}
                  </div>
                  <div className="flex items-center justify-center shrink-0 px-0.5">
                    <MiniDonutChart
                      data={card.donutData}
                      total={card.donutTotal}
                      title={card.label}
                      isOpenControlled={isCardActive}
                      onToggle={() => setActiveDonut(prev => prev === card.label ? null : card.label)}
                    />
                  </div>
                  <div className={`hidden sm:flex p-2.5 sm:p-3.5 rounded-2xl ${card.iconBg} border ${card.border} shadow-inner shrink-0`}>
                    <card.icon className={`w-4 h-4 sm:w-6 sm:h-6 ${card.iconColor}`} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Executive Call Intelligence & AI Follow-Up Assistant ── */}
        <FollowUpAssistantBar
          enquiries={enquiries}
          activeFilter={smartFollowUpFilter}
          onFilterChange={(f) => setSmartFollowUpFilter(f)}
          onSearchChange={(term) => setSearch(term)}
          aiMatchedIds={aiMatchedIds}
          onAiMatchedIdsChange={(ids) => setAiMatchedIds(ids)}
        />

        {/* ── Filters & Search ── */}
        <div className="p-3 sm:p-4 bg-slate-900/60 backdrop-blur-md border border-slate-700/40 rounded-2xl w-full max-w-full overflow-hidden">
          <div className="flex flex-col lg:flex-row gap-3 items-center justify-between">
            <div className="flex flex-col md:flex-row gap-3 items-center w-full lg:w-auto">
              <div className="relative w-full md:w-72">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search name, email, phone, notes…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950/80 border border-slate-700/50 rounded-xl text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all"
                />
              </div>
              <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 w-full md:w-auto">
                {[
                  { value: countryFilter, onChange: setCountryFilter, options: [['ALL', `All Countries (${uniqueCountries.length})`], ...uniqueCountries.map(c => [c, c])] },
                  { value: courseFilter, onChange: setCourseFilter, options: [['ALL', `All Courses (${uniqueCourses.length})`], ...uniqueCourses.map(c => [c, c])] },
                  { value: qualityFilter, onChange: setQualityFilter, options: [['ALL', 'All Quality'], ['High', '💎 High Quality'], ['Medium', '⚡ Medium Quality'], ['Low', '🧊 Low Quality'], ['Unrated', '⚪ Unrated']] },
                  { value: statusFilter, onChange: setStatusFilter, options: [['ALL', 'All Statuses'], ['Pending', '⏳ Pending'], ['In Touch', '💬 In Touch'], ['Talked', '📞 Talked'], ['Future', '🔮 Future'], ['Converted', '💎 Converted'], ['Lost', '❌ Lost']] },
                ].map((sel, i) => (
                  <select
                    key={i}
                    value={sel.value}
                    onChange={e => sel.onChange(e.target.value)}
                    className="w-full sm:w-auto bg-slate-950/80 border border-slate-700/50 rounded-xl px-2.5 py-2.5 text-xs text-slate-300 focus:outline-none focus:border-cyan-500/50 cursor-pointer hover:border-slate-600 transition-colors truncate"
                  >
                    {sel.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                ))}
                <button
                  onClick={() => { if (sortBy === 'date_desc') setSortBy('quality'); else if (sortBy === 'quality') setSortBy('date_asc'); else setSortBy('date_desc'); }}
                  className="col-span-2 sm:col-span-1 flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700/50 text-xs text-slate-300 hover:text-white hover:border-slate-600 transition-colors cursor-pointer"
                >
                  <ArrowUpDown className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{sortBy === 'date_desc' ? 'Newest First' : sortBy === 'date_asc' ? 'Oldest First' : 'High Quality First'}</span>
                </button>
              </div>
            </div>

            {/* Right-Side Segment Toggle: Unified Liquid Glass Segmented Control */}
            <div className="grid grid-cols-3 p-1 bg-slate-950/60 backdrop-blur-2xl border border-white/10 rounded-full shadow-[inset_0_1px_1px_rgba(255,255,255,0.08),0_4px_20px_rgba(0,0,0,0.5)] shrink-0 w-full sm:w-[350px]">
              <button
                type="button"
                onClick={() => setCourseFilter('ALL')}
                className={`h-8 sm:h-8.5 rounded-full flex items-center justify-center px-2 text-[11px] sm:text-xs font-bold whitespace-nowrap tracking-tight transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] active:scale-95 cursor-pointer ${
                  courseFilter === 'ALL'
                    ? 'bg-gradient-to-b from-white/[0.18] to-white/[0.06] text-white shadow-[0_2px_10px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.35)] border border-white/25 backdrop-blur-xl'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] border border-transparent'
                }`}
              >
                <span>All Leads</span>
              </button>
              <button
                type="button"
                onClick={() => setCourseFilter('Training')}
                className={`h-8 sm:h-8.5 rounded-full flex items-center justify-center gap-1.5 px-2 text-[11px] sm:text-xs font-bold whitespace-nowrap tracking-tight transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] active:scale-95 cursor-pointer ${
                  courseFilter === 'Training'
                    ? 'bg-gradient-to-b from-white/[0.18] to-white/[0.06] text-white shadow-[0_2px_10px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.35)] border border-white/25 backdrop-blur-xl'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] border border-transparent'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5 shrink-0 opacity-90" />
                <span>Training</span>
              </button>
              <button
                type="button"
                onClick={() => setCourseFilter('Job Support')}
                className={`h-8 sm:h-8.5 rounded-full flex items-center justify-center gap-1.5 px-2 text-[11px] sm:text-xs font-bold whitespace-nowrap tracking-tight transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] active:scale-95 cursor-pointer ${
                  courseFilter === 'Job Support'
                    ? 'bg-gradient-to-b from-white/[0.18] to-white/[0.06] text-white shadow-[0_2px_10px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.35)] border border-white/25 backdrop-blur-xl'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] border border-transparent'
                }`}
              >
                <Briefcase className="w-3.5 h-3.5 shrink-0 opacity-90" />
                <span>Job Support</span>
              </button>
            </div>
          </div>
        </div>

        {/* ── Main Table ── */}
        <div className="flex-1 overflow-hidden md:bg-slate-900/60 md:backdrop-blur-md md:border md:border-slate-700/40 md:rounded-2xl md:shadow-2xl flex flex-col">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-32 text-slate-500 space-y-4">
              <div className="relative">
                <div className="w-14 h-14 rounded-full border-2 border-cyan-500/20 border-t-cyan-500 animate-spin" />
                <div className="absolute inset-2 w-10 h-10 rounded-full border-2 border-indigo-500/20 border-t-indigo-400 animate-spin animate-[spin_0.6s_linear_infinite_reverse]" />
              </div>
              <p className="text-sm font-medium text-slate-400">Loading enquiry database…</p>
            </div>
          ) : filteredEnquiries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-3">
              <div className="p-3.5 rounded-2xl bg-slate-800/50 border border-slate-700/40">
                <AlertCircle className="w-8 h-8 text-slate-500" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-slate-300">No enquiries found</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {search ? `No records matched "${search}".` : 'Try clearing your active filters.'}
                </p>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => {
                    setSearch('');
                    setCountryFilter('ALL');
                    setCourseFilter('ALL');
                    setStatusFilter('ALL');
                    setQualityFilter('ALL');
                    setSmartFollowUpFilter('all');
                    setAiMatchedIds(null);
                  }}
                  className="text-xs px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-bold cursor-pointer transition-colors shadow-md"
                >
                  Clear All Filters & Reset
                </button>
                <button onClick={() => fileInputRef.current?.click()} className="text-xs px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white cursor-pointer transition-colors flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5" /> Upload File
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col min-h-0">

              {/* ── Mobile View Cards (< md) ── */}
              <div className="md:hidden overflow-y-auto flex-1">
                <MobileLeadCards
                  leads={paginatedEnquiries}
                  expandedLeadId={expandedLeadId}
                  onToggleExpand={handleToggleExpand}
                  onUpdateStatus={handleUpdateStatus}
                  onAddNotes={(enquiry) => {
                    setEditingEnquiry(enquiry);
                    setNoteText(enquiry.processedNotes || '');
                  }}
                  onViewDetail={(enquiry) => {
                    setSelectedDetailEnquiry(enquiry);
                    setNoteText(enquiry.processedNotes || '');
                  }}
                  onAssign={openAssignModal}
                  onDeleteRecord={(id) => setEnquiries((prev) => prev.filter((e) => e.id !== id))}
                  isAdmin={currentUser?.role === 'admin'}
                />
              </div>

              {/* ── Desktop Table (>= md) ── */}
              <div className="hidden md:block overflow-x-auto flex-1">
                <table className="w-full min-w-[1360px] table-fixed text-left text-xs border-collapse">
                  <thead className="bg-slate-950/70 text-slate-500 uppercase tracking-widest font-semibold border-b border-slate-800/80 sticky top-0 backdrop-blur-xl z-10">
                    <tr>
                      <th className="w-[332px] py-4 pl-5 pr-3 text-[10px]">Lead & Contact</th>
                      <th className="w-[104px] py-4 px-2.5 text-[10px]">Country</th>
                      <th className="w-[112px] py-4 px-2.5 text-[10px]">Type</th>
                      <th className="w-[162px] py-4 px-3 text-[10px]">Course / Service</th>
                      <th className="w-[112px] py-4 px-2.5 text-[10px]">Date</th>
                      <th className="w-[134px] py-4 px-2.5 text-[10px] whitespace-nowrap">Contact Status</th>
                      <th className="w-[146px] py-4 px-2.5 text-[10px] whitespace-nowrap">Call Score</th>
                      <th className="py-4 px-3 text-[10px]">Call Notes</th>
                      <th className="w-[104px] py-4 pl-2.5 pr-5 text-[10px] text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40">
                    {paginatedEnquiries.map(enquiry => (
                      <tr key={enquiry.id} className="group hover:bg-slate-800/40 transition-all duration-150">

                        {/* Lead & Contact */}
                        <td className="py-4 pl-5 pr-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-600/20 to-indigo-600/20 border border-cyan-500/20 flex items-center justify-center flex-shrink-0 text-cyan-400 font-bold text-xs">
                              {enquiry.participantName.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <p
                                  onClick={() => {
                                    setSelectedDetailEnquiry(enquiry);
                                    setNoteText(enquiry.processedNotes || '');
                                  }}
                                  className="font-semibold text-white group-hover:text-cyan-300 transition-colors text-sm truncate cursor-pointer hover:underline"
                                  title="Click to view Lead Details & Call Intelligence"
                                >
                                  {enquiry.participantName}
                                </p>
                                <RedFlagBadge
                                  enquiryId={enquiry.id}
                                  hasRedFlag={Boolean(enquiry.hasRedFlag)}
                                  redFlagReason={enquiry.redFlagReason}
                                  redFlagDismissed={Boolean(enquiry.redFlagDismissed)}
                                  onDismissed={() => {
                                    setEnquiries(prev => prev.map(e => e.id === enquiry.id ? { ...e, redFlagDismissed: true } : e));
                                  }}
                                />
                              </div>
                              <div className="grid grid-cols-[144px_minmax(0,1fr)] items-center gap-x-2 mt-0.5">
                                <div className="min-w-0">
                                  {enquiry.email ? (
                                    <a
                                      href={`mailto:${enquiry.email}`}
                                      title={enquiry.email}
                                      className="inline-flex items-center gap-1 text-[10px] text-slate-500 hover:text-cyan-400 transition-colors max-w-full"
                                    >
                                      <Mail className="w-3 h-3 flex-shrink-0" />
                                      <span className="truncate">{enquiry.email}</span>
                                    </a>
                                  ) : (
                                    <span className="text-[10px] text-slate-700">—</span>
                                  )}
                                </div>
                                <div className="min-w-0">
                                  {enquiry.phone && (
                                    <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 font-mono tabular-nums whitespace-nowrap max-w-full">
                                      <Phone className="w-3 h-3 flex-shrink-0" />
                                      <span className="truncate">{enquiry.phone}</span>
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Country */}
                        <td className="py-4 px-2.5">
                          <span
                            title={enquiry.country || 'India'}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700/50 text-slate-300 text-xs max-w-full"
                          >
                            <Globe className="w-3 h-3 text-cyan-400 shrink-0" />
                            <span className="truncate">{enquiry.country || 'India'}</span>
                          </span>
                        </td>

                        {/* Type */}
                        <td className="py-4 px-2.5 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                            (enquiry.serviceType || '').toLowerCase() === 'job support' || (enquiry.trainingType || '').toLowerCase() === 'job support'
                              ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                              : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
                          }`}>
                            {(enquiry.serviceType || '').toLowerCase() === 'job support' || (enquiry.trainingType || '').toLowerCase() === 'job support' ? 'Job Support' : 'Training'}
                          </span>
                        </td>

                        {/* Course / Service */}
                        <td className="py-4 px-3">
                          <span className="font-semibold text-slate-200 text-xs truncate block" title={enquiry.trainingType || enquiry.topic}>
                            {enquiry.trainingType && enquiry.trainingType !== 'Job Support' ? enquiry.trainingType : (enquiry.topic || 'General')}
                          </span>
                        </td>

                        {/* Date */}
                        <td className="py-4 px-2.5 whitespace-nowrap text-slate-500 text-[11px]">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 shrink-0" />
                            <span>{(enquiry.dateSubmitted ? new Date(enquiry.dateSubmitted) : new Date(enquiry.messageTimestamp)).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                          </div>
                        </td>

                        {/* Contact Status */}
                        <td className="py-4 px-2.5 whitespace-nowrap">
                          <StatusBadgeSelect
                            value={enquiry.contactStatus || 'Pending'}
                            onChange={val => handleUpdateStatus(enquiry.id, { contactStatus: val })}
                          />
                        </td>

                        {/* Call Score (Volume Meter) */}
                        <td className="py-4 px-2.5 whitespace-nowrap">
                          <CallVolumeMeter
                            enquiryId={enquiry.id}
                            initialScore={enquiry.callScore || null}
                            onScoreUpdated={(s) => {
                              setEnquiries(prev => prev.map(e => e.id === enquiry.id ? { ...e, callScore: s } : e));
                            }}
                            compact
                          />
                        </td>

                        {/* Notes */}
                        <td className="py-4 px-3 min-w-0">
                          {enquiry.callFollowUpDate && (
                            <div className="flex items-center gap-1 text-[10px] text-amber-400 font-semibold mb-1 truncate">
                              <Calendar className="w-3 h-3 text-amber-400 shrink-0" />
                              <span>Due: {new Date(enquiry.callFollowUpDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                            </div>
                          )}
                          {enquiry.processedNotes ? (
                            <button onClick={() => { setEditingEnquiry(enquiry); setNoteText(enquiry.processedNotes || ''); }} className="block w-full text-left text-[11px] text-slate-400 italic truncate bg-slate-800/60 px-2.5 py-1.5 rounded-lg border border-slate-700/40 hover:border-cyan-500/40 cursor-pointer transition-colors" title={enquiry.processedNotes}>
                              💬 {enquiry.processedNotes}
                            </button>
                          ) : (
                            <button onClick={() => { setEditingEnquiry(enquiry); setNoteText(''); }} className="flex items-center gap-1 text-[11px] text-slate-600 hover:text-cyan-400 transition-colors cursor-pointer group/note whitespace-nowrap">
                              <Sparkles className="w-3 h-3 group-hover/note:text-amber-400 transition-colors shrink-0" />
                              Add notes
                            </button>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-4 pl-2.5 pr-5 text-right">
                          <div className="flex items-center justify-end">
                            <button
                              onClick={() => {
                                setSelectedDetailEnquiry(enquiry);
                                setNoteText(enquiry.processedNotes || '');
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 hover:text-white border border-slate-700/80 hover:border-slate-600 text-xs font-semibold shadow-sm transition-all cursor-pointer shrink-0"
                              title="View Lead Details & Call Intelligence"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Details</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Pagination & Footer */}
          <div className="px-5 py-3 border-t border-slate-800/60 bg-slate-950/70 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400 flex-shrink-0">
            <div className="flex flex-wrap items-center gap-4">
              <span className="font-medium text-slate-300">
                Showing {filteredEnquiries.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} – {Math.min(currentPage * pageSize, filteredEnquiries.length)} of {filteredEnquiries.length} enquiries
                {filteredEnquiries.length !== totalCount && <span className="text-slate-500 ml-1">(filtered from {totalCount} total)</span>}
              </span>
              <div className="flex items-center gap-1.5 text-[11px]">
                <span className="text-slate-500">Rows per page:</span>
                <select
                  value={pageSize}
                  onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                  className="bg-slate-900 border border-slate-700/60 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none cursor-pointer hover:border-slate-500 transition-colors"
                >
                  <option value={10}>10</option>
                  <option value={15}>15</option>
                  <option value={30}>30</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700/60 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 hover:border-slate-600 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all shadow-sm"
                >
                  <ChevronLeft className="w-4 h-4 text-cyan-400" />
                  <span>Previous</span>
                </button>

                <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-400">
                  <span>Page</span>
                  <span className="px-1.5 py-0.5 rounded bg-slate-800 text-cyan-400 font-bold font-mono">{currentPage}</span>
                  <span>of <span className="font-semibold text-slate-300">{totalPages}</span></span>
                </div>

                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700/60 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 hover:border-slate-600 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all shadow-sm"
                >
                  <span>Next</span>
                  <ChevronRight className="w-4 h-4 text-cyan-400" />
                </button>
              </div>

              <span className="hidden lg:flex items-center gap-1.5 text-emerald-400 border-l border-slate-800 pl-3">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Prisma DB Active</span>
              </span>
            </div>
          </div>
        </div>

        {/* ── Daily Visual Pipeline (Top 10 Active Leads) ── */}
        <DailyPipelineBoard
          enquiries={enquiries}
          onSelectLead={(lead) => {
            const found = enquiries.find((e) => e.id === lead.id);
            if (found) setSelectedDetailEnquiry(found);
          }}
          onUpdateLeadStatus={handleUpdateStatus}
        />

      </div>

      {/* ── Inline Notes Drawer ── */}
      {editingEnquiry && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/70 backdrop-blur-md p-4">
          <div className="bg-slate-900 border border-slate-700/60 rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-4 animate-[fadeInUp_0.2s_ease]">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white">Call Notes</h3>
                <p className="text-xs text-slate-400 mt-0.5">{editingEnquiry.participantName} • {editingEnquiry.trainingType || 'Training'}</p>
              </div>
              <button onClick={() => setEditingEnquiry(null)} className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white cursor-pointer transition-colors"><X className="w-4 h-4" /></button>
            </div>
            <textarea
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              rows={4}
              autoFocus
              className="w-full p-3.5 bg-slate-950/80 border border-slate-700/50 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 resize-none"
              placeholder="e.g. Spoke on 30 Aug. Interested in 6-week Manhattan WMS batch. Follow up Monday…"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setEditingEnquiry(null)} className="px-4 py-2 rounded-xl bg-slate-800 text-xs text-slate-300 hover:bg-slate-700 cursor-pointer">Cancel</button>
              <button onClick={handleSaveNotes} disabled={savingNote} className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-xs text-white font-bold shadow-md cursor-pointer disabled:opacity-60">
                {savingNote ? 'Saving…' : 'Save Notes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Assign Lead Modal ── */}
      <AssignLeadModal
        isOpen={assignModalOpen}
        onClose={() => setAssignModalOpen(false)}
        enquiryId={assignTargetEnquiry?.id || null}
        participantName={assignTargetEnquiry?.participantName}
        topic={assignTargetEnquiry?.topic}
        currentAssignedId={assignTargetEnquiry?.assignedToId}
        onSuccess={fetchEnquiries}
      />

      {/* ── Unified Lead Details & Call Intelligence Drawer (40% Screen Width) ── */}
      <LeadDetailsDrawer
        isOpen={!!selectedDetailEnquiry}
        onClose={() => setSelectedDetailEnquiry(null)}
        enquiry={selectedDetailEnquiry}
        onUpdateStatus={async (id, updates) => {
          await handleUpdateStatus(id, updates);
          setSelectedDetailEnquiry(prev => prev && prev.id === id ? { ...prev, ...updates } : prev);
        }}
        onDeleteSuccess={(id) => {
          setEnquiries((prev) => prev.filter((e) => e.id !== id));
          setSelectedDetailEnquiry(null);
        }}
        onAssignClick={openAssignModal}
      />

    </div>
  );
}

