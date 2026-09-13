'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X, RefreshCw, Search, Filter, Globe, BookOpen, MessageSquare, Phone,
  Mail, CheckCircle2, AlertCircle, Sparkles, TrendingUp, UserCheck, Star,
  Send, Calendar, ArrowUpDown, Upload, Clock, PhoneCall, XCircle, Zap, ShieldAlert, Circle
} from 'lucide-react';
import { toast } from 'sonner';

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
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 h-7 rounded-xl text-[11px] font-bold border transition-all cursor-pointer whitespace-nowrap leading-none shrink-0 ${current.bg} ${current.color} ${current.border} hover:brightness-125 shadow-sm`}
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
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 h-7 rounded-xl text-[11px] font-bold border transition-all cursor-pointer whitespace-nowrap leading-none shrink-0 ${current.bg} ${current.color} ${current.border} hover:brightness-125 shadow-sm`}
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

interface EnquiryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefreshParent?: () => void;
}

export default function EnquiryModal({ isOpen, onClose, onRefreshParent }: EnquiryModalProps) {
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [summary, setSummary] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [countryFilter, setCountryFilter] = useState('ALL');
  const [courseFilter, setCourseFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [qualityFilter, setQualityFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'quality'>('date_desc');

  // Notes Modal state
  const [editingEnquiry, setEditingEnquiry] = useState<Enquiry | null>(null);
  const [noteText, setNoteText] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);

  const fetchEnquiries = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/enquiries/sync-excel');
      const json = await res.json();
      if (json.success) {
        setEnquiries(json.enquiries || []);
        if (json.lastSynced) setLastSynced(json.lastSynced);
        if (json.summary) setSummary(json.summary);
      }
    } catch (err) {
      console.error('Failed to fetch enquiries:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchEnquiries();
      fetch('/api/auth/me')
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.user) setCurrentUser(data.user);
        })
        .catch(() => {});
    }
  }, [isOpen]);

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
        if (onRefreshParent) onRefreshParent();
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
        toast.success('Updated enquiry record');
        setEnquiries(prev => prev.map(e => e.id === enquiryId ? { ...e, ...json.enquiry } : e));
      } else {
        toast.error(json.error || 'Update failed');
      }
    } catch (err: any) {
      toast.error(err.message);
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
        (item.trainingType && item.trainingType.toLowerCase().includes(searchLower));

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

  // Stats calculation
  const totalCount = enquiries.length;
  const highQualityCount = enquiries.filter(e => e.leadQuality === 'High').length;
  const talkedCount = enquiries.filter(e => e.contactStatus === 'Talked' || e.contactStatus === 'In Touch' || e.contactStatus === 'Converted').length;
  const pendingCount = enquiries.filter(e => e.contactStatus === 'Pending' || !e.contactStatus).length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-3 md:p-6 overflow-y-auto animate-fadeIn">
      <div className="relative w-full max-w-7xl max-h-[92vh] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-900/90 backdrop-blur-sm sticky top-0 z-20">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-cyan-600 to-indigo-600 shadow-lg shadow-cyan-500/20 text-white">
              <Globe className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-xl font-bold bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                  Enquiry Intelligence Command Center
                </h2>
                <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  Excel & Email Sync
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Auto-extracted from Outlook Demo Enquiries Excel (`DemoEnquiry_Extracted.xlsx`)
                {lastSynced && <span className="ml-2 text-slate-500">• Last Synced: {new Date(lastSynced).toLocaleTimeString()}</span>}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {currentUser?.role === 'admin' && (
              <>
                {/* Hidden file input for Excel upload */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleSyncExcel(file);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                />
                <button
                  onClick={() => handleSyncExcel()}
                  disabled={syncing}
                  className="flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-cyan-600 via-indigo-600 to-purple-600 hover:from-cyan-500 hover:to-indigo-500 text-white shadow-lg shadow-cyan-500/25 transition-all disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                  <span>{syncing ? 'Extracting & Syncing...' : 'Sync Outlook & Excel'}</span>
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={syncing}
                  title="Upload custom Excel file"
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                </button>
              </>
            )}

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Top KPI Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-950/60 border-b border-slate-800/80">
          <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Total Enquiries</p>
              <p className="text-xl font-bold text-white mt-0.5">{totalCount}</p>
            </div>
            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
              <MessageSquare className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Countries Reached</p>
              <p className="text-xl font-bold text-emerald-400 mt-0.5">{uniqueCountries.length}</p>
            </div>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <Globe className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">High Quality Leads</p>
              <p className="text-xl font-bold text-amber-400 mt-0.5">{highQualityCount} 🔥</p>
            </div>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
              <Star className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Talked / In Touch</p>
              <p className="text-xl font-bold text-indigo-400 mt-0.5">{talkedCount} <span className="text-xs text-slate-500 font-normal">({pendingCount} pending)</span></p>
            </div>
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
              <UserCheck className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Course Category Tabs Navigation */}
        <div className="flex items-center space-x-2 px-4 py-2 bg-slate-950 border-b border-slate-800 overflow-x-auto">
          {[
            { id: 'ALL', label: 'All Enquiries', count: totalCount },
            { id: 'Manhattan WMS', label: 'Manhattan WMS', count: enquiries.filter(e => (e.trainingType || '').toLowerCase().includes('manhattan wms')).length },
            { id: 'Manhattan ProActive', label: 'Manhattan ProActive', count: enquiries.filter(e => (e.trainingType || '').toLowerCase().includes('proactive')).length },
            { id: 'Blue Yonder WMS (JDA)', label: 'Blue Yonder WMS (JDA)', count: enquiries.filter(e => (e.trainingType || '').toLowerCase().includes('blue yonder') || (e.trainingType || '').toLowerCase().includes('jda')).length },
            { id: 'General Training', label: 'General / Other Courses', count: enquiries.filter(e => !(e.trainingType || '').toLowerCase().includes('manhattan') && !(e.trainingType || '').toLowerCase().includes('blue yonder')).length },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setCourseFilter(tab.id)}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                courseFilter === tab.id
                  ? 'bg-gradient-to-r from-cyan-600 to-indigo-600 text-white shadow-md shadow-cyan-500/20'
                  : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                courseFilter === tab.id ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Filters & Control Panel */}
        <div className="p-4 bg-slate-900/90 border-b border-slate-800 space-y-3">
          <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
            
            {/* Search Input */}
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search name, email, phone, country..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
              />
            </div>

            {/* Filter Dropdowns */}
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              
              {/* Course Filter */}
              <select
                value={courseFilter}
                onChange={e => setCourseFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-cyan-500/50 cursor-pointer"
              >
                <option value="ALL">All Courses</option>
                {uniqueCourses.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>

              {/* Country Filter */}
              <select
                value={countryFilter}
                onChange={e => setCountryFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-cyan-500/50 cursor-pointer"
              >
                <option value="ALL">All Countries ({uniqueCountries.length})</option>
                {uniqueCountries.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>

              {/* Lead Quality Filter */}
              <select
                value={qualityFilter}
                onChange={e => setQualityFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-cyan-500/50 cursor-pointer"
              >
                <option value="ALL">All Quality Ratings</option>
                <option value="High">💎 High Quality</option>
                <option value="Medium">⚡ Medium Quality</option>
                <option value="Low">🧊 Low Quality</option>
                <option value="Unrated">⚪ Unrated</option>
              </select>

              {/* Contact Status Filter */}
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-cyan-500/50 cursor-pointer"
              >
                <option value="ALL">All Contact Statuses</option>
                <option value="Pending">⏳ Pending</option>
                <option value="In Touch">💬 In Touch</option>
                <option value="Talked">📞 Talked</option>
                <option value="Future">🔮 Future</option>
                <option value="Converted">💎 Converted</option>
                <option value="Lost">❌ Lost</option>
              </select>

              {/* Sort Order */}
              <button
                onClick={() => {
                  if (sortBy === 'date_desc') setSortBy('quality');
                  else if (sortBy === 'quality') setSortBy('date_asc');
                  else setSortBy('date_desc');
                }}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                <ArrowUpDown className="w-3.5 h-3.5 text-cyan-400" />
                <span>
                  {sortBy === 'date_desc' && 'Sort: Newest First'}
                  {sortBy === 'date_asc' && 'Sort: Oldest First'}
                  {sortBy === 'quality' && 'Sort: High Quality First'}
                </span>
              </button>

            </div>
          </div>
        </div>

        {/* Main Table Content Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 space-y-3">
              <RefreshCw className="w-8 h-8 animate-spin text-cyan-500" />
              <p className="text-sm">Loading Excel enquiry records...</p>
            </div>
          ) : filteredEnquiries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 space-y-2">
              <AlertCircle className="w-10 h-10 text-slate-600" />
              <p className="text-sm font-medium">No enquiries match your current filters.</p>
              <button
                onClick={() => { setSearch(''); setCountryFilter('ALL'); setCourseFilter('ALL'); setStatusFilter('ALL'); setQualityFilter('ALL'); }}
                className="text-xs text-cyan-400 underline hover:text-cyan-300 mt-1 cursor-pointer"
              >
                Clear all filters
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-800/80 bg-slate-950/40">
              <table className="w-full text-left text-xs text-slate-300 border-collapse">
                <thead className="bg-slate-900/90 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Lead Name & Contact</th>
                    <th className="py-3 px-3">Country</th>
                    <th className="py-3 px-3">Course / Service</th>
                    <th className="py-3 px-3">Date Submitted</th>
                    <th className="py-3 px-3">Contact Status</th>
                    <th className="py-3 px-3">Lead Quality</th>
                    <th className="py-3 px-4 text-right">Quick Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredEnquiries.map(enquiry => (
                    <tr key={enquiry.id} className="hover:bg-slate-800/40 transition-colors group">
                      
                      {/* Name & Contact */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-white group-hover:text-cyan-300 transition-colors">
                          {enquiry.participantName}
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center space-x-2">
                          {enquiry.email && <span>{enquiry.email}</span>}
                          {enquiry.phone && <span>{enquiry.phone}</span>}
                        </div>
                      </td>

                      {/* Country */}
                      <td className="py-3 px-3">
                        <span className="inline-flex items-center space-x-1 text-xs text-slate-300">
                          <Globe className="w-3 h-3 text-cyan-400" />
                          <span>{enquiry.country || 'India'}</span>
                        </span>
                      </td>

                      {/* Course / Service */}
                      <td className="py-3 px-3">
                        <div className="font-medium text-slate-200">
                          {enquiry.trainingType || enquiry.topic || 'Training'}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {enquiry.serviceType}
                        </div>
                      </td>

                      {/* Date Submitted */}
                      <td className="py-3 px-3 whitespace-nowrap text-slate-400">
                        {enquiry.dateSubmitted
                          ? new Date(enquiry.dateSubmitted).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                          : new Date(enquiry.messageTimestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </td>

                      {/* Contact Status Selectable */}
                      <td className="py-3 px-3">
                        <StatusBadgeSelect
                          value={enquiry.contactStatus || 'Pending'}
                          onChange={val => handleUpdateStatus(enquiry.id, { contactStatus: val })}
                        />
                      </td>

                      {/* Lead Quality Selectable */}
                      <td className="py-3 px-3">
                        <QualityBadgeSelect
                          value={enquiry.leadQuality || 'Unrated'}
                          onChange={val => handleUpdateStatus(enquiry.id, { leadQuality: val })}
                        />
                      </td>

                      {/* Quick Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          {enquiry.phone && (
                            <a
                              href={`https://wa.me/${enquiry.phone.replace(/[^0-9]/g, '')}`}
                              target="_blank"
                              rel="noreferrer"
                              title="Chat on WhatsApp"
                              className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 transition-colors"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                            </a>
                          )}
                          {enquiry.email && (
                            <a
                              href={`mailto:${enquiry.email}?subject=Regarding your enquiry for ${enquiry.trainingType || 'GapAnchor Training'}`}
                              title="Send Email"
                              className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 border border-cyan-500/20 transition-colors"
                            >
                              <Mail className="w-3.5 h-3.5" />
                            </a>
                          )}
                          <button
                            onClick={() => { setEditingEnquiry(enquiry); setNoteText(enquiry.processedNotes || ''); }}
                            title="Add Notes & Activity Log"
                            className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors cursor-pointer"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer info bar */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs text-slate-400">
          <span>Showing {filteredEnquiries.length} of {totalCount} enquiries</span>
          <div className="flex items-center space-x-3">
            <span className="flex items-center space-x-1 text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Direct Excel Connector Active</span>
            </span>
          </div>
        </div>

      </div>

      {/* Note Edit Modal Overlay */}
      {editingEnquiry && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white text-base">Enquiry Notes: {editingEnquiry.participantName}</h3>
              <button onClick={() => setEditingEnquiry(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-2">Add discussion notes or follow-up status details:</p>
              <textarea
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                rows={4}
                className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                placeholder="E.g., Talked on phone on 28th July. Interested in Manhattan WMS 6-week batch..."
              />
            </div>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setEditingEnquiry(null)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-xs text-slate-300 hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await handleUpdateStatus(editingEnquiry.id, { notes: noteText, status: 'Processed' });
                  setEditingEnquiry(null);
                }}
                className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-xs text-white font-semibold"
              >
                Save Notes
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
