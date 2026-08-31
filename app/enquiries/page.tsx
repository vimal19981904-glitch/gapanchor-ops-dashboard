'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import {
  X, RefreshCw, Search, Filter, Globe, BookOpen, MessageSquare, Phone,
  Mail, CheckCircle2, AlertCircle, Sparkles, TrendingUp, UserCheck, Star,
  Send, Calendar, ArrowUpDown, ArrowLeft, Building2, User, Eye, FileText,
  ExternalLink, Upload
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

  // Notes Drawer state
  const [editingEnquiry, setEditingEnquiry] = useState<Enquiry | null>(null);
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [selectedDetailEnquiry, setSelectedDetailEnquiry] = useState<Enquiry | null>(null);

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
    const fileToUpload = file || selectedFile;
    if (!fileToUpload) {
      // Open file picker
      fileInputRef.current?.click();
      return;
    }
    setSyncing(true);
    try {
      const formData = new FormData();
      formData.append('file', fileToUpload);
      const res = await fetch('/api/enquiries/sync-excel', { method: 'POST', body: formData });
      const json = await res.json();
      if (json.success) {
        toast.success(json.message || 'Excel synced successfully!');
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

  // Stats calculation
  const totalCount = enquiries.length;
  const highQualityCount = enquiries.filter(e => e.leadQuality === 'High').length;
  const talkedCount = enquiries.filter(e => e.contactStatus === 'Talked' || e.contactStatus === 'In Touch' || e.contactStatus === 'Converted').length;
  const pendingCount = enquiries.filter(e => e.contactStatus === 'Pending' || !e.contactStatus).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 flex flex-col font-sans">
      <div className="max-w-7xl mx-auto w-full space-y-6 flex-1 flex flex-col">
        
        {/* Page Top Navigation Bar */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl">
          <div className="flex items-center space-x-4">
            <Link
              href="/"
              className="p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer flex items-center gap-2 group"
              title="Return to Main Ops Dashboard"
            >
              <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
              <span className="text-xs font-semibold hidden sm:inline">Dashboard</span>
            </Link>

            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-2xl font-extrabold bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                  Enquiry Intelligence Command Center
                </h1>
                <span className="px-3 py-1 text-xs font-semibold rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  Full Page View
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Upload your Excel file to sync enquiries into the database
                {lastSynced && <span className="ml-2 text-slate-500">• Last Synced: {new Date(lastSynced).toLocaleTimeString()}</span>}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3 w-full md:w-auto justify-end">
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleFileChange}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={syncing}
              className="flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-500/25 transition-all disabled:opacity-50 cursor-pointer"
            >
              {syncing
                ? <RefreshCw className="w-4 h-4 animate-spin" />
                : <Upload className="w-4 h-4" />}
              <span>{syncing ? 'Uploading & Syncing...' : 'Upload Excel & Sync'}</span>
            </button>
          </div>
        </div>

        {/* Top KPI Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex items-center justify-between shadow-lg">
            <div>
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Total Enquiries</p>
              <p className="text-2xl font-black text-white mt-1">{summary?.totalEnquiries || totalCount}</p>
            </div>
            <div className="p-3 rounded-xl bg-cyan-500/10 text-cyan-400">
              <MessageSquare className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex items-center justify-between shadow-lg">
            <div>
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Countries Reached</p>
              <p className="text-2xl font-black text-emerald-400 mt-1">{summary?.uniqueCountries || uniqueCountries.length}</p>
            </div>
            <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400">
              <Globe className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex items-center justify-between shadow-lg">
            <div>
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">High Quality Leads</p>
              <p className="text-2xl font-black text-amber-400 mt-1">{highQualityCount} 🔥</p>
            </div>
            <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400">
              <Star className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex items-center justify-between shadow-lg">
            <div>
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Talked / In Touch</p>
              <p className="text-2xl font-black text-indigo-400 mt-1">{talkedCount} <span className="text-xs text-slate-500 font-normal">({pendingCount} pending)</span></p>
            </div>
            <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400">
              <UserCheck className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Course Category Tabs Navigation */}
        <div className="flex items-center space-x-2 p-2 bg-slate-900 border border-slate-800 rounded-2xl overflow-x-auto">
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
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                courseFilter === tab.id
                  ? 'bg-gradient-to-r from-cyan-600 to-indigo-600 text-white shadow-md shadow-cyan-500/20'
                  : 'bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                courseFilter === tab.id ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Filters & Control Panel */}
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
          <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
            
            {/* Search Input */}
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search lead name, email, phone, notes..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
              />
            </div>

            {/* Filter Dropdowns */}
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              
              {/* Course Filter */}
              <select
                value={courseFilter}
                onChange={e => setCourseFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-cyan-500/50 cursor-pointer"
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
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-cyan-500/50 cursor-pointer"
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
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-cyan-500/50 cursor-pointer"
              >
                <option value="ALL">All Quality Ratings</option>
                <option value="High">🔥 High Quality</option>
                <option value="Medium">⚡ Medium Quality</option>
                <option value="Low">❄️ Low Quality</option>
                <option value="Unrated">⚪ Unrated</option>
              </select>

              {/* Contact Status Filter */}
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-cyan-500/50 cursor-pointer"
              >
                <option value="ALL">All Contact Statuses</option>
                <option value="Pending">⏳ Pending</option>
                <option value="In Touch">💬 In Touch</option>
                <option value="Talked">📞 Talked</option>
                <option value="Converted">✅ Converted</option>
                <option value="Lost">❌ Lost</option>
              </select>

              {/* Sort Order */}
              <button
                onClick={() => {
                  if (sortBy === 'date_desc') setSortBy('quality');
                  else if (sortBy === 'quality') setSortBy('date_asc');
                  else setSortBy('date_desc');
                }}
                className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 hover:text-white transition-colors cursor-pointer"
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
        <div className="flex-1 overflow-hidden bg-slate-900 border border-slate-800 rounded-2xl shadow-xl flex flex-col">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 text-slate-400 space-y-3">
              <RefreshCw className="w-8 h-8 animate-spin text-cyan-500" />
              <p className="text-sm">Loading enquiry database records...</p>
            </div>
          ) : filteredEnquiries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-slate-400 space-y-3">
              <AlertCircle className="w-10 h-10 text-slate-600" />
              <p className="text-sm font-medium">No enquiries match your current filters.</p>
              <button
                onClick={() => { setSearch(''); setCountryFilter('ALL'); setCourseFilter('ALL'); setStatusFilter('ALL'); setQualityFilter('ALL'); }}
                className="text-xs text-cyan-400 underline hover:text-cyan-300 cursor-pointer"
              >
                Clear all filters
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left text-xs text-slate-300 border-collapse">
                <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800 sticky top-0 backdrop-blur-md z-10">
                  <tr>
                    <th className="py-3.5 px-4">Lead Name & Contact</th>
                    <th className="py-3.5 px-3">Country</th>
                    <th className="py-3.5 px-3">Course / Service</th>
                    <th className="py-3.5 px-3">Date Submitted</th>
                    <th className="py-3.5 px-3">Contact Status</th>
                    <th className="py-3.5 px-3">Lead Quality</th>
                    <th className="py-3.5 px-4 text-left">Discussion Notes</th>
                    <th className="py-3.5 px-4 text-right">Quick Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredEnquiries.map(enquiry => (
                    <tr key={enquiry.id} className="hover:bg-slate-800/50 transition-colors group">
                      
                      {/* Name & Contact */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-white group-hover:text-cyan-300 transition-colors text-sm">
                          {enquiry.participantName}
                        </div>
                        <div className="flex items-center space-x-2 text-[11px] text-slate-400 mt-1">
                          {enquiry.email && (
                            <span className="flex items-center space-x-1 truncate max-w-[200px]" title={enquiry.email}>
                              <Mail className="w-3 h-3 text-slate-500" />
                              <span>{enquiry.email}</span>
                            </span>
                          )}
                          {enquiry.phone && (
                            <span className="flex items-center space-x-1 font-mono text-slate-400">
                              <Phone className="w-3 h-3 text-slate-500" />
                              <span>{enquiry.phone}</span>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Country */}
                      <td className="py-3.5 px-3">
                        <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-200">
                          <Globe className="w-3.5 h-3.5 text-cyan-400" />
                          <span>{enquiry.country || 'India'}</span>
                        </span>
                      </td>

                      {/* Course / Service */}
                      <td className="py-3.5 px-3">
                        <div className="font-medium text-slate-200">
                          {enquiry.trainingType || enquiry.topic || 'Training'}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {enquiry.serviceType}
                        </div>
                      </td>

                      {/* Date Submitted */}
                      <td className="py-3.5 px-3 whitespace-nowrap text-slate-400">
                        {enquiry.dateSubmitted
                          ? new Date(enquiry.dateSubmitted).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                          : new Date(enquiry.messageTimestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </td>

                      {/* Contact Status Selectable */}
                      <td className="py-3.5 px-3">
                        <select
                          value={enquiry.contactStatus || 'Pending'}
                          onChange={e => handleUpdateStatus(enquiry.id, { contactStatus: e.target.value })}
                          className={`px-3 py-1 rounded-xl text-xs font-semibold border focus:outline-none cursor-pointer transition-colors ${
                            enquiry.contactStatus === 'Converted'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : enquiry.contactStatus === 'Talked' || enquiry.contactStatus === 'In Touch'
                              ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30'
                              : enquiry.contactStatus === 'Lost'
                              ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          }`}
                        >
                          <option value="Pending" className="bg-slate-900 text-slate-100">⏳ Pending</option>
                          <option value="In Touch" className="bg-slate-900 text-slate-100">💬 In Touch</option>
                          <option value="Talked" className="bg-slate-900 text-slate-100">📞 Talked</option>
                          <option value="Converted" className="bg-slate-900 text-slate-100">✅ Converted</option>
                          <option value="Lost" className="bg-slate-900 text-slate-100">❌ Lost</option>
                        </select>
                      </td>

                      {/* Lead Quality Selectable */}
                      <td className="py-3.5 px-3">
                        <select
                          value={enquiry.leadQuality || 'Unrated'}
                          onChange={e => handleUpdateStatus(enquiry.id, { leadQuality: e.target.value })}
                          className={`px-3 py-1 rounded-xl text-xs font-semibold border focus:outline-none cursor-pointer transition-colors ${
                            enquiry.leadQuality === 'High'
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                              : enquiry.leadQuality === 'Medium'
                              ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
                              : enquiry.leadQuality === 'Low'
                              ? 'bg-slate-800 text-slate-400 border-slate-700'
                              : 'bg-slate-950 text-slate-400 border-slate-800'
                          }`}
                        >
                          <option value="Unrated" className="bg-slate-900 text-slate-100">⚪ Unrated</option>
                          <option value="High" className="bg-slate-900 text-slate-100">🔥 High Quality</option>
                          <option value="Medium" className="bg-slate-900 text-slate-100">⚡ Medium</option>
                          <option value="Low" className="bg-slate-900 text-slate-100">❄️ Low</option>
                        </select>
                      </td>

                      {/* Discussion Notes Preview */}
                      <td className="py-3.5 px-4 max-w-[220px]">
                        {enquiry.processedNotes ? (
                          <div
                            onClick={() => { setEditingEnquiry(enquiry); setNoteText(enquiry.processedNotes || ''); }}
                            className="text-[11px] text-slate-300 italic truncate bg-slate-950 p-2 rounded-lg border border-slate-800/80 cursor-pointer hover:border-cyan-500/50"
                            title={enquiry.processedNotes}
                          >
                            💬 "{enquiry.processedNotes}"
                          </div>
                        ) : (
                          <button
                            onClick={() => { setEditingEnquiry(enquiry); setNoteText(''); }}
                            className="text-[11px] text-slate-500 hover:text-cyan-400 underline cursor-pointer"
                          >
                            + Add Call Notes
                          </button>
                        )}
                      </td>

                      {/* Quick Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => { setSelectedDetailEnquiry(enquiry); setNoteText(enquiry.processedNotes || ''); }}
                            title="View Full Client Intelligence & Outlook Details"
                            className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-md shadow-cyan-500/20 transition-all cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Detail</span>
                          </button>
                          {enquiry.phone && (
                            <a
                              href={`https://wa.me/${enquiry.phone.replace(/[^0-9]/g, '')}`}
                              target="_blank"
                              rel="noreferrer"
                              title="Chat on WhatsApp"
                              className="p-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 transition-colors"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                            </a>
                          )}
                          {enquiry.email && (
                            <a
                              href={`mailto:${enquiry.email}?subject=Regarding your enquiry for ${enquiry.trainingType || 'GapAnchor Training'}`}
                              title="Send Email"
                              className="p-1.5 rounded-xl bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 border border-cyan-500/20 transition-colors"
                            >
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

          {/* Footer info bar */}
          <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between text-xs text-slate-400">
            <span>Showing {filteredEnquiries.length} of {totalCount} enquiries</span>
            <div className="flex items-center space-x-3">
              <span className="flex items-center space-x-1.5 text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                <span>Prisma Database Persistence Active</span>
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* Single Client Lead Intelligence Detail Modal */}
      {selectedDetailEnquiry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-2xl w-full space-y-5 shadow-2xl animate-fadeIn text-slate-100 max-h-[90vh] overflow-y-auto">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center space-x-3">
                <div className="p-3 rounded-xl bg-gradient-to-tr from-cyan-600 to-indigo-600 text-white shadow-lg shadow-cyan-500/20">
                  <User className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="font-extrabold text-white text-xl">
                      {selectedDetailEnquiry.participantName}
                    </h3>
                    <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                      Client Profile
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Source: <strong className="text-slate-200 capitalize">{selectedDetailEnquiry.source || 'Outlook'}</strong>
                    <span className="ml-2">• ID: {selectedDetailEnquiry.id}</span>
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedDetailEnquiry(null)}
                className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Actions Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800">
              <div className="flex items-center space-x-2">
                {selectedDetailEnquiry.phone && (
                  <a
                    href={`https://wa.me/${selectedDetailEnquiry.phone.replace(/[^0-9]/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30 text-xs font-semibold transition-colors"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>WhatsApp Chat</span>
                  </a>
                )}
                {selectedDetailEnquiry.email && (
                  <a
                    href={`mailto:${selectedDetailEnquiry.email}?subject=Regarding your enquiry for ${selectedDetailEnquiry.trainingType || 'GapAnchor Training'}`}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 border border-cyan-500/30 text-xs font-semibold transition-colors"
                  >
                    <Mail className="w-4 h-4" />
                    <span>Send Email</span>
                  </a>
                )}
              </div>

              <div className="flex items-center space-x-2">
                {/* Contact Status */}
                <select
                  value={selectedDetailEnquiry.contactStatus || 'Pending'}
                  onChange={async (e) => {
                    const newStatus = e.target.value;
                    await handleUpdateStatus(selectedDetailEnquiry.id, { contactStatus: newStatus });
                    setSelectedDetailEnquiry(prev => prev ? { ...prev, contactStatus: newStatus } : null);
                  }}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-200 focus:outline-none cursor-pointer"
                >
                  <option value="Pending">⏳ Pending</option>
                  <option value="In Touch">💬 In Touch</option>
                  <option value="Talked">📞 Talked</option>
                  <option value="Converted">✅ Converted</option>
                  <option value="Lost">❌ Lost</option>
                </select>

                {/* Lead Quality */}
                <select
                  value={selectedDetailEnquiry.leadQuality || 'Unrated'}
                  onChange={async (e) => {
                    const newQuality = e.target.value;
                    await handleUpdateStatus(selectedDetailEnquiry.id, { leadQuality: newQuality });
                    setSelectedDetailEnquiry(prev => prev ? { ...prev, leadQuality: newQuality } : null);
                  }}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-200 focus:outline-none cursor-pointer"
                >
                  <option value="Unrated">⚪ Unrated</option>
                  <option value="High">🔥 High Quality</option>
                  <option value="Medium">⚡ Medium</option>
                  <option value="Low">❄️ Low</option>
                </select>
              </div>
            </div>

            {/* Client Metadata Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-medium">Email Address</span>
                <span className="text-xs font-semibold text-slate-200 truncate block mt-0.5" title={selectedDetailEnquiry.email || 'N/A'}>
                  {selectedDetailEnquiry.email || 'N/A'}
                </span>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-medium">Phone Number</span>
                <span className="text-xs font-mono font-semibold text-slate-200 block mt-0.5">
                  {selectedDetailEnquiry.phone || 'N/A'}
                </span>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-medium">Country / Region</span>
                <span className="text-xs font-semibold text-slate-200 block mt-0.5">
                  {selectedDetailEnquiry.country || 'India'}
                </span>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-medium">Enquiry Received</span>
                <span className="text-xs font-semibold text-slate-200 block mt-0.5">
                  {new Date(selectedDetailEnquiry.messageTimestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>

            {/* Original Message / Outlook Body */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 flex items-center space-x-1.5">
                  <FileText className="w-4 h-4 text-cyan-400" />
                  <span>Course / Service Message Details</span>
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  {selectedDetailEnquiry.trainingType || selectedDetailEnquiry.topic}
                </span>
              </div>
              <div className="p-3 bg-slate-900 rounded-lg text-xs text-slate-300 font-sans border border-slate-800/80 whitespace-pre-wrap leading-relaxed">
                {selectedDetailEnquiry.lastMessage || 'No body text provided.'}
              </div>
            </div>

            {/* Call & Follow-Up Discussion Notes */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-200 flex items-center space-x-1.5">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Call Notes & Client Discussion Log</span>
              </label>
              <textarea
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                rows={4}
                className="w-full p-3.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-sans leading-relaxed"
                placeholder="Record notes from your phone call (e.g. Spoke on 30th Aug. Requested 6-week Manhattan WMS training batch. Agreed on payment terms...)"
              />
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <span className="text-[11px] text-slate-500">Persisted permanently in Prisma database</span>
              <div className="flex space-x-2">
                <button
                  onClick={() => setSelectedDetailEnquiry(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-xs text-slate-300 hover:bg-slate-700 cursor-pointer"
                >
                  Close
                </button>
                <button
                  onClick={async () => {
                    setSavingNote(true);
                    try {
                      await handleUpdateStatus(selectedDetailEnquiry.id, { notes: noteText, status: 'Processed' });
                      setSelectedDetailEnquiry(null);
                    } finally {
                      setSavingNote(false);
                    }
                  }}
                  disabled={savingNote}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-xs text-white font-bold shadow-lg shadow-cyan-500/20 cursor-pointer disabled:opacity-50"
                >
                  {savingNote ? 'Saving...' : 'Save Client Notes to DB'}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
