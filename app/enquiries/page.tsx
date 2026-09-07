'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import {
  X, RefreshCw, Search, Filter, Globe, BookOpen, MessageSquare, Phone,
  Mail, CheckCircle2, AlertCircle, Sparkles, TrendingUp, UserCheck, Star,
  Send, Calendar, ArrowUpDown, ArrowLeft, Building2, User, Eye, FileText,
  ExternalLink, Upload, ChevronLeft, ChevronRight, Clock, PhoneCall, XCircle,
  Zap, ShieldAlert, Circle
} from 'lucide-react';
import { toast } from 'sonner';
import AssignLeadModal from '@/components/AssignLeadModal';

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

function StatusBadgeSelect({ value, onChange }: { value: string; onChange: (val: string) => void }) {
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
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${current.bg} ${current.color} ${current.border} hover:brightness-125 shadow-sm`}
      >
        <Icon className="w-3.5 h-3.5 flex-shrink-0" />
        <span>{current.label}</span>
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

function QualityBadgeSelect({ value, onChange }: { value: string; onChange: (val: string) => void }) {
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
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${current.bg} ${current.color} ${current.border} hover:brightness-125 shadow-sm`}
      >
        <Icon className="w-3.5 h-3.5 flex-shrink-0" />
        <span>{current.label}</span>
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

export default function EnquiriesPage() {
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [summary, setSummary] = useState<any>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [countryFilter, setCountryFilter] = useState('ALL');
  const [courseFilter, setCourseFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [qualityFilter, setQualityFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'quality'>('date_desc');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(30);

  // Reset to page 1 when search or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, countryFilter, courseFilter, statusFilter, qualityFilter, sortBy]);

  // Notes & Assign Modal state
  const [editingEnquiry, setEditingEnquiry] = useState<Enquiry | null>(null);
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [selectedDetailEnquiry, setSelectedDetailEnquiry] = useState<Enquiry | null>(null);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignTargetEnquiry, setAssignTargetEnquiry] = useState<Enquiry | null>(null);

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
        toast.success(json.message || 'Outlook & Excel synced successfully!');
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
      await handleUpdateStatus(editingEnquiry.id, { notes: noteText, status: 'Processed' });
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
    return enquiries.filter(item => {
      const searchLower = search.toLowerCase();
      const matchesSearch =
        !search ||
        item.participantName.toLowerCase().includes(searchLower) ||
        (item.email && item.email.toLowerCase().includes(searchLower)) ||
        (item.phone && item.phone.includes(searchLower)) ||
        (item.country && item.country.toLowerCase().includes(searchLower)) ||
        (item.trainingType && item.trainingType.toLowerCase().includes(searchLower)) ||
        (item.processedNotes && item.processedNotes.toLowerCase().includes(searchLower));

      const matchesCountry = countryFilter === 'ALL' || item.country === countryFilter;
      const matchesCourse = courseFilter === 'ALL' || item.trainingType === courseFilter || item.topic === courseFilter;
      const matchesStatus = statusFilter === 'ALL' || item.contactStatus === statusFilter;
      const matchesQuality = qualityFilter === 'ALL' || item.leadQuality === qualityFilter;

      return matchesSearch && matchesCountry && matchesCourse && matchesStatus && matchesQuality;
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
  }, [enquiries, search, countryFilter, courseFilter, statusFilter, qualityFilter, sortBy]);

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

  return (
    <div className="min-h-screen bg-[#080c14] text-slate-100 flex flex-col font-sans" style={{backgroundImage:'radial-gradient(ellipse at 20% 0%, rgba(6,182,212,0.07) 0%, transparent 60%), radial-gradient(ellipse at 80% 100%, rgba(99,102,241,0.07) 0%, transparent 60%)'}}>
      <div className="w-full max-w-full px-4 md:px-8 py-6 space-y-5 flex-1 flex flex-col">

        {/* ── Top Navigation Bar ── */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-5 bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl">
          <div className="flex items-center space-x-4">
            <Link href="/" className="group flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/50 text-slate-300 hover:text-white transition-all shadow-inner">
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
              <span className="text-xs font-semibold hidden sm:inline">Dashboard</span>
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl md:text-2xl font-black tracking-tight bg-gradient-to-r from-cyan-300 via-white to-indigo-300 bg-clip-text text-transparent">
                  Enquiry Intelligence
                </h1>
                <span className="hidden sm:inline px-2.5 py-0.5 text-[10px] font-bold tracking-widest rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/25 uppercase">
                  Live CRM
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                <span className="inline-flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
                  Supabase PostgreSQL • Real-time DB Persistence
                </span>
                {lastSynced && <span className="text-slate-600">• Synced {new Date(lastSynced).toLocaleTimeString()}</span>}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileChange} />
            <button
              onClick={() => handleSyncExcel()}
              disabled={syncing}
              className="group relative flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-cyan-600 via-indigo-600 to-purple-600 hover:from-cyan-500 hover:to-indigo-500 text-white shadow-lg shadow-cyan-500/25 transition-all disabled:opacity-60 overflow-hidden cursor-pointer"
            >
              <span className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl" />
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              <span>{syncing ? 'Extracting & Syncing…' : 'Sync Outlook & Excel'}</span>
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={syncing}
              title="Upload custom Excel file"
              className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/50 text-slate-400 hover:text-white transition-all cursor-pointer"
            >
              <Upload className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── KPI Metric Cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Enquiries', value: totalCount, icon: MessageSquare, color: 'cyan', iconBg: 'bg-cyan-500/10', iconColor: 'text-cyan-400', glow: 'shadow-cyan-500/20', border: 'border-cyan-500/15' },
            { label: 'Countries Reached', value: uniqueCountries.length, icon: Globe, color: 'emerald', iconBg: 'bg-emerald-500/10', iconColor: 'text-emerald-400', glow: 'shadow-emerald-500/20', border: 'border-emerald-500/15' },
            { label: 'High Quality Leads', value: highQualityCount, icon: Star, color: 'amber', iconBg: 'bg-amber-500/10', iconColor: 'text-amber-400', glow: 'shadow-amber-500/20', border: 'border-amber-500/15', suffix: highQualityCount > 0 ? '🔥' : '' },
            { label: 'Talked / In Touch', value: talkedCount, icon: UserCheck, color: 'violet', iconBg: 'bg-violet-500/10', iconColor: 'text-violet-400', glow: 'shadow-violet-500/20', border: 'border-violet-500/15', sub: `${pendingCount} pending` },
          ].map((card) => (
            <div key={card.label} className={`relative overflow-hidden p-5 rounded-2xl bg-slate-900/70 backdrop-blur-md border ${card.border} shadow-lg ${card.glow} transition-all hover:scale-[1.02]`}>
              <div className={`absolute top-0 right-0 w-24 h-24 rounded-full ${card.iconBg} blur-2xl opacity-60`} />
              <div className="flex items-center justify-between relative">
                <div>
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">{card.label}</p>
                  <p className="text-3xl font-black text-white mt-1.5 tracking-tight">
                    {card.value}{card.suffix && <span className="ml-1 text-xl">{card.suffix}</span>}
                  </p>
                  {card.sub && <p className="text-[11px] text-slate-500 mt-0.5">{card.sub}</p>}
                </div>
                <div className={`p-3.5 rounded-2xl ${card.iconBg} border ${card.border} shadow-inner`}>
                  <card.icon className={`w-6 h-6 ${card.iconColor}`} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Course Category Tabs ── */}
        <div className="flex items-center gap-2 p-2 bg-slate-900/60 backdrop-blur-md border border-slate-700/40 rounded-2xl overflow-x-auto scrollbar-hide">
          {[
            { id: 'ALL', label: 'All Enquiries', count: totalCount },
            { id: 'Manhattan WMS', label: 'Manhattan WMS', count: enquiries.filter(e => (e.trainingType || '').toLowerCase().includes('manhattan wms')).length },
            { id: 'Manhattan ProActive', label: 'Manhattan ProActive', count: enquiries.filter(e => (e.trainingType || '').toLowerCase().includes('proactive')).length },
            { id: 'Blue Yonder WMS (JDA)', label: 'Blue Yonder (JDA)', count: enquiries.filter(e => (e.trainingType || '').toLowerCase().includes('blue yonder') || (e.trainingType || '').toLowerCase().includes('jda')).length },
            { id: 'General Training', label: 'Other Courses', count: enquiries.filter(e => !(e.trainingType || '').toLowerCase().includes('manhattan') && !(e.trainingType || '').toLowerCase().includes('blue yonder')).length },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setCourseFilter(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                courseFilter === tab.id
                  ? 'bg-gradient-to-r from-cyan-600/90 to-indigo-600/90 text-white shadow-md shadow-cyan-500/20 border border-cyan-500/20'
                  : 'bg-slate-900/80 text-slate-400 hover:text-white hover:bg-slate-800/80 border border-slate-700/40'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${courseFilter === tab.id ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-500'}`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* ── Filters & Search ── */}
        <div className="p-4 bg-slate-900/60 backdrop-blur-md border border-slate-700/40 rounded-2xl">
          <div className="flex flex-col md:flex-row gap-3 items-center">
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search name, email, phone, notes…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950/80 border border-slate-700/50 rounded-xl text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              {[
                { value: courseFilter, onChange: setCourseFilter, options: [['ALL','All Courses'], ...uniqueCourses.map(c => [c, c])] },
                { value: countryFilter, onChange: setCountryFilter, options: [['ALL',`All Countries (${uniqueCountries.length})`], ...uniqueCountries.map(c => [c, c])] },
                { value: qualityFilter, onChange: setQualityFilter, options: [['ALL','All Quality'], ['High','💎 High Quality'], ['Medium','⚡ Medium Quality'], ['Low','🧊 Low Quality'], ['Unrated','⚪ Unrated']] },
                { value: statusFilter, onChange: setStatusFilter, options: [['ALL','All Statuses'], ['Pending','⏳ Pending'], ['In Touch','💬 In Touch'], ['Talked','📞 Talked'], ['Future','🔮 Future'], ['Converted','💎 Converted'], ['Lost','❌ Lost']] },
              ].map((sel, i) => (
                <select
                  key={i}
                  value={sel.value}
                  onChange={e => sel.onChange(e.target.value)}
                  className="bg-slate-950/80 border border-slate-700/50 rounded-xl px-3 py-2.5 text-xs text-slate-300 focus:outline-none focus:border-cyan-500/50 cursor-pointer hover:border-slate-600 transition-colors"
                >
                  {sel.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              ))}
              <button
                onClick={() => { if (sortBy === 'date_desc') setSortBy('quality'); else if (sortBy === 'quality') setSortBy('date_asc'); else setSortBy('date_desc'); }}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700/50 text-xs text-slate-300 hover:text-white hover:border-slate-600 transition-colors cursor-pointer"
              >
                <ArrowUpDown className="w-3.5 h-3.5 text-cyan-400" />
                <span>{sortBy === 'date_desc' ? 'Newest First' : sortBy === 'date_asc' ? 'Oldest First' : 'High Quality First'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* ── Main Table ── */}
        <div className="flex-1 overflow-hidden bg-slate-900/60 backdrop-blur-md border border-slate-700/40 rounded-2xl shadow-2xl flex flex-col">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-32 text-slate-500 space-y-4">
              <div className="relative">
                <div className="w-14 h-14 rounded-full border-2 border-cyan-500/20 border-t-cyan-500 animate-spin" />
                <div className="absolute inset-2 w-10 h-10 rounded-full border-2 border-indigo-500/20 border-t-indigo-400 animate-spin animate-[spin_0.6s_linear_infinite_reverse]" />
              </div>
              <p className="text-sm font-medium text-slate-400">Loading enquiry database…</p>
            </div>
          ) : filteredEnquiries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32 space-y-4">
              <div className="p-5 rounded-2xl bg-slate-800/50 border border-slate-700/40">
                <AlertCircle className="w-10 h-10 text-slate-600" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-slate-300">No enquiries found</p>
                <p className="text-xs text-slate-500 mt-1">Try adjusting your filters or upload an Excel file to sync data</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setSearch(''); setCountryFilter('ALL'); setCourseFilter('ALL'); setStatusFilter('ALL'); setQualityFilter('ALL'); }} className="text-xs px-4 py-2 rounded-xl border border-slate-700 text-slate-400 hover:text-white hover:border-slate-600 cursor-pointer transition-colors">
                  Clear Filters
                </button>
                <button onClick={() => fileInputRef.current?.click()} className="text-xs px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 cursor-pointer transition-colors flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5" /> Upload Excel
                </button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-950/70 text-slate-500 uppercase tracking-widest font-semibold border-b border-slate-800/80 sticky top-0 backdrop-blur-xl z-10">
                  <tr>
                    <th className="py-4 px-5 text-[10px]">Lead & Contact</th>
                    <th className="py-4 px-4 text-[10px]">Country</th>
                    <th className="py-4 px-4 text-[10px]">Course / Service</th>
                    <th className="py-4 px-4 text-[10px]">Date</th>
                    <th className="py-4 px-4 text-[10px]">Contact Status</th>
                    <th className="py-4 px-4 text-[10px]">Lead Quality</th>
                    <th className="py-4 px-4 text-[10px]">Call Notes</th>
                    <th className="py-4 px-5 text-[10px] text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {paginatedEnquiries.map(enquiry => (
                    <tr key={enquiry.id} className="group hover:bg-slate-800/40 transition-all duration-150">

                      {/* Lead & Contact */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-600/20 to-indigo-600/20 border border-cyan-500/20 flex items-center justify-center flex-shrink-0 text-cyan-400 font-bold text-xs">
                            {enquiry.participantName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-white group-hover:text-cyan-300 transition-colors">{enquiry.participantName}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              {enquiry.email && (
                                <a href={`mailto:${enquiry.email}`} className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-cyan-400 transition-colors truncate max-w-[160px]">
                                  <Mail className="w-3 h-3 flex-shrink-0" />{enquiry.email}
                                </a>
                              )}
                              {enquiry.phone && (
                                <span className="flex items-center gap-1 text-[10px] text-slate-500 font-mono">
                                  <Phone className="w-3 h-3" />{enquiry.phone}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Country */}
                      <td className="py-4 px-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700/50 text-slate-300 text-xs">
                          <Globe className="w-3 h-3 text-cyan-400" />
                          {enquiry.country || 'India'}
                        </span>
                      </td>

                      {/* Course */}
                      <td className="py-4 px-4">
                        <p className="font-medium text-slate-200 text-xs leading-tight">{enquiry.trainingType || enquiry.topic || 'Training'}</p>
                        {enquiry.serviceType && <p className="text-[10px] text-slate-600 mt-0.5">{enquiry.serviceType}</p>}
                      </td>

                      {/* Date */}
                      <td className="py-4 px-4 whitespace-nowrap text-slate-500 text-[11px]">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {(enquiry.dateSubmitted ? new Date(enquiry.dateSubmitted) : new Date(enquiry.messageTimestamp)).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>
                      </td>

                      {/* Contact Status */}
                      <td className="py-4 px-4">
                        <StatusBadgeSelect
                          value={enquiry.contactStatus || 'Pending'}
                          onChange={val => handleUpdateStatus(enquiry.id, { contactStatus: val })}
                        />
                      </td>

                      {/* Lead Quality */}
                      <td className="py-4 px-4">
                        <QualityBadgeSelect
                          value={enquiry.leadQuality || 'Unrated'}
                          onChange={val => handleUpdateStatus(enquiry.id, { leadQuality: val })}
                        />
                      </td>

                      {/* Notes */}
                      <td className="py-4 px-4 max-w-[200px]">
                        {enquiry.processedNotes ? (
                          <button onClick={() => { setEditingEnquiry(enquiry); setNoteText(enquiry.processedNotes || ''); }} className="w-full text-left text-[11px] text-slate-400 italic truncate bg-slate-800/60 px-2.5 py-1.5 rounded-lg border border-slate-700/40 hover:border-cyan-500/40 cursor-pointer transition-colors" title={enquiry.processedNotes}>
                            💬 {enquiry.processedNotes}
                          </button>
                        ) : (
                          <button onClick={() => { setEditingEnquiry(enquiry); setNoteText(''); }} className="flex items-center gap-1 text-[11px] text-slate-600 hover:text-cyan-400 transition-colors cursor-pointer group/note">
                            <Sparkles className="w-3 h-3 group-hover/note:text-amber-400 transition-colors" />
                            Add notes
                          </button>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => { setSelectedDetailEnquiry(enquiry); setNoteText(enquiry.processedNotes || ''); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-600/90 to-indigo-600/90 hover:from-cyan-500 hover:to-indigo-500 text-white text-xs font-bold shadow-md shadow-cyan-500/20 transition-all cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">View</span>
                          </button>

                          <button
                            onClick={() => openAssignModal(enquiry)}
                            className="p-1.5 rounded-xl bg-brand-500/10 text-brand-300 hover:bg-brand-500/20 border border-brand-500/20 transition-all cursor-pointer"
                            title="Assign to Employee"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                          </button>

                          {enquiry.phone && (
                            <a href={`https://wa.me/${enquiry.phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer" className="p-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 transition-all cursor-pointer" title="WhatsApp">
                              <MessageSquare className="w-3.5 h-3.5" />
                            </a>
                          )}
                          {enquiry.email && (
                            <a href={`mailto:${enquiry.email}?subject=Regarding your ${enquiry.trainingType || 'GapAnchor Training'} enquiry`} className="p-1.5 rounded-xl bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 border border-cyan-500/20 transition-all cursor-pointer" title="Send Email">
                              <Mail className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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

      {/* ── Client Detail Modal ── */}
      {selectedDetailEnquiry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700/60 rounded-2xl p-6 max-w-2xl w-full shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto">

            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-600 to-indigo-600 flex items-center justify-center text-white font-black text-lg shadow-lg shadow-cyan-500/20">
                  {selectedDetailEnquiry.participantName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-white text-lg">{selectedDetailEnquiry.participantName}</h3>
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 uppercase tracking-wider">Client</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Source: <strong className="text-slate-300 capitalize">{selectedDetailEnquiry.source || 'Excel'}</strong>
                    <span className="ml-2 font-mono text-slate-600">#{selectedDetailEnquiry.id.slice(-8)}</span>
                  </p>
                </div>
              </div>
              <button onClick={() => setSelectedDetailEnquiry(null)} className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white cursor-pointer transition-colors"><X className="w-5 h-5" /></button>
            </div>

            {/* Quick Action Bar */}
            <div className="flex flex-wrap items-center gap-2 p-3 bg-slate-950/60 rounded-xl border border-slate-800/60">
              <div className="flex gap-2 flex-1">
                {selectedDetailEnquiry.phone && (
                  <a href={`https://wa.me/${selectedDetailEnquiry.phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30 text-xs font-semibold transition-all">
                    <MessageSquare className="w-4 h-4" /> WhatsApp
                  </a>
                )}
                {selectedDetailEnquiry.email && (
                  <a href={`mailto:${selectedDetailEnquiry.email}?subject=Regarding ${selectedDetailEnquiry.trainingType || 'GapAnchor'} enquiry`} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 border border-cyan-500/30 text-xs font-semibold transition-all">
                    <Mail className="w-4 h-4" /> Email
                  </a>
                )}
              </div>
              <div className="flex items-center gap-2">
                <StatusBadgeSelect
                  value={selectedDetailEnquiry.contactStatus || 'Pending'}
                  onChange={async val => {
                    await handleUpdateStatus(selectedDetailEnquiry.id, { contactStatus: val });
                    setSelectedDetailEnquiry(p => p ? { ...p, contactStatus: val } : null);
                  }}
                />
                <QualityBadgeSelect
                  value={selectedDetailEnquiry.leadQuality || 'Unrated'}
                  onChange={async val => {
                    await handleUpdateStatus(selectedDetailEnquiry.id, { leadQuality: val });
                    setSelectedDetailEnquiry(p => p ? { ...p, leadQuality: val } : null);
                  }}
                />
              </div>
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Email', value: selectedDetailEnquiry.email || '—', icon: Mail },
                { label: 'Phone', value: selectedDetailEnquiry.phone || '—', icon: Phone },
                { label: 'Country', value: selectedDetailEnquiry.country || 'India', icon: Globe },
                { label: 'Received', value: new Date(selectedDetailEnquiry.messageTimestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }), icon: Calendar },
              ].map(info => (
                <div key={info.label} className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/60">
                  <div className="flex items-center gap-1.5 mb-1">
                    <info.icon className="w-3 h-3 text-slate-600" />
                    <span className="text-[9px] text-slate-500 uppercase tracking-wider font-medium">{info.label}</span>
                  </div>
                  <span className="text-xs font-semibold text-slate-200 truncate block" title={info.value}>{info.value}</span>
                </div>
              ))}
            </div>

            {/* Message Body */}
            <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/60">
              <div className="flex items-center gap-1.5 mb-2">
                <FileText className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-bold text-slate-300">Enquiry Message</span>
                <span className="ml-auto text-[10px] text-slate-600 font-mono">{selectedDetailEnquiry.trainingType || selectedDetailEnquiry.topic}</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed whitespace-pre-wrap bg-slate-900/60 p-3 rounded-lg border border-slate-800/40">
                {selectedDetailEnquiry.lastMessage || 'No message body.'}
              </p>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                <Sparkles className="w-4 h-4 text-amber-400" />
                Call Notes & Discussion Log
              </label>
              <textarea value={noteText} onChange={e => setNoteText(e.target.value)} rows={3} className="w-full p-3.5 bg-slate-950/80 border border-slate-700/50 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 resize-none" placeholder="Spoke on 30 Aug. Interested in 6-week Manhattan WMS batch…" />
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <span className="text-[10px] text-slate-600">Persisted in Supabase PostgreSQL</span>
              <div className="flex gap-2">
                <button onClick={() => setSelectedDetailEnquiry(null)} className="px-4 py-2 rounded-xl bg-slate-800 text-xs text-slate-300 hover:bg-slate-700 cursor-pointer">Close</button>
                <button onClick={async () => { setSavingNote(true); try { await handleUpdateStatus(selectedDetailEnquiry.id, { notes: noteText, status: 'Processed' }); setSelectedDetailEnquiry(null); } finally { setSavingNote(false); } }} disabled={savingNote} className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-xs text-white font-bold shadow-lg shadow-cyan-500/15 cursor-pointer disabled:opacity-60">
                  {savingNote ? 'Saving…' : 'Save to DB'}
                </button>
              </div>
            </div>
          </div>
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

    </div>
  );
}

