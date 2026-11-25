'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Calendar, RefreshCw, Search, Plus, Globe, BookOpen, MessageSquare, Phone,
  Mail, CheckCircle2, AlertCircle, Sparkles, UserCheck, Star,
  ArrowLeft, User, Eye, FileText, Upload, ChevronDown, ChevronUp, Clock,
  XCircle, Briefcase, Shield, DollarSign, Edit3, Trash2, Users, GraduationCap,
  MapPin, Layers
} from 'lucide-react';
import { toast } from 'sonner';
import { NavDrawerButton } from '@/components/NavigationContext';
import OpsModal from '@/components/OpsModal';

interface Participant {
  id?: string;
  participantName: string;
  amountDue: number;
  amountPaid: number;
  paymentStatus: string;
  notes?: string;
}

interface TrainingSession {
  id: string;
  title: string;
  platform: string;
  trainer: string;
  participantsCount: number;
  currentlyParticipating: number;
  date: string;
  time?: string;
  location: string;
  status: string;
  trainerTotalCost?: number;
  trainerAmountPaid?: number;
  trainerAmountDue?: number;
  paymentSummary?: {
    paidCount: number;
    partialCount: number;
    pendingCount: number;
  };
  participants: Participant[];
}

export default function TrainingOpsPage() {
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [masterParticipants, setMasterParticipants] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // Mobile card expand state
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [platformFilter, setPlatformFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals
  const [modalOpen, setModalOpen] = useState(false);
  const [sessionToEdit, setSessionToEdit] = useState<TrainingSession | null>(null);

  const fetchTrainingSessions = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ops');
      const json = await res.json();
      if (json.success) {
        setSessions(json.sessions || []);
        setMasterParticipants(json.masterParticipants || []);
      }
    } catch (err) {
      console.error('Failed to fetch training operations sessions:', err);
      toast.error('Failed to load Training operations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrainingSessions();
  }, []);

  const handleSyncOutlook = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/enquiries/sync-excel', { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        toast.success(json.message || 'Outlook Training Leads synced successfully!');
        fetchTrainingSessions();
      } else {
        toast.error(`Sync failed: ${json.error}`);
      }
    } catch (err: any) {
      toast.error(`Sync failed: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleOpenAddModal = () => {
    setSessionToEdit(null);
    setModalOpen(true);
  };

  const handleOpenEditModal = (session: TrainingSession) => {
    setSessionToEdit(session);
    setModalOpen(true);
  };

  // Filtered Sessions
  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      const searchLower = search.toLowerCase();
      const matchesSearch =
        !search ||
        s.title.toLowerCase().includes(searchLower) ||
        s.platform.toLowerCase().includes(searchLower) ||
        s.trainer.toLowerCase().includes(searchLower) ||
        (s.participants && s.participants.some(p => p.participantName.toLowerCase().includes(searchLower)));

      const matchesPlatform =
        platformFilter === 'ALL' ||
        s.platform.toLowerCase().includes(platformFilter.toLowerCase());

      const matchesStatus =
        statusFilter === 'ALL' || s.status.toLowerCase() === statusFilter.toLowerCase();

      return matchesSearch && matchesPlatform && matchesStatus;
    });
  }, [sessions, search, platformFilter, statusFilter]);

  // Aggregate Metrics
  const totalSessions = sessions.length;
  const totalEnrolled = sessions.reduce((acc, s) => acc + (s.participantsCount || 0), 0);
  const totalActive = sessions.reduce((acc, s) => acc + (s.currentlyParticipating || 0), 0);
  const totalPaidCount = sessions.reduce((acc, s) => acc + (s.paymentSummary?.paidCount || 0), 0);
  const totalPartialCount = sessions.reduce((acc, s) => acc + (s.paymentSummary?.partialCount || 0), 0);
  const totalPendingCount = sessions.reduce((acc, s) => acc + (s.paymentSummary?.pendingCount || 0), 0);

  return (
    <div
      className="min-h-screen bg-[#080c14] text-slate-100 flex flex-col font-sans tracking-tight antialiased"
      style={{
        fontFamily: 'var(--font-jakarta), system-ui, sans-serif',
        backgroundImage:
          'radial-gradient(ellipse at 20% 0%, rgba(6,182,212,0.08) 0%, transparent 60%), radial-gradient(ellipse at 80% 100%, rgba(99,102,241,0.08) 0%, transparent 60%)',
      }}
    >
      <div className="w-full max-w-full px-2.5 sm:px-6 md:px-8 py-3 sm:py-6 space-y-3 sm:space-y-4 flex-1 flex flex-col">

        {/* Top Header Bar */}
        <div className="p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 sm:border-cyan-500/20 rounded-xl shadow-2xl space-y-2 sm:space-y-0 sm:flex sm:items-center sm:justify-between">
          {/* Top Row: Back button, Title, Mobile Drawer Toggle */}
          <div className="flex items-center justify-between w-full sm:w-auto gap-2.5">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <Link
                href="/"
                className="group flex items-center justify-center w-7 h-7 sm:w-auto sm:h-auto sm:px-3 sm:py-2 rounded-lg sm:rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/50 text-slate-300 hover:text-white transition-all shrink-0"
                title="Return to Dashboard"
              >
                <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 group-hover:-translate-x-0.5 transition-transform" />
                <span className="text-xs font-semibold hidden md:inline ml-1.5">Dashboard</span>
              </Link>
              <h1 className="text-sm sm:text-xl md:text-2xl font-bold sm:font-black tracking-tight text-white truncate">
                GapAnchor Training Operations
              </h1>
            </div>
            <div className="sm:hidden shrink-0">
              <NavDrawerButton className="!w-7 !h-7" />
            </div>
          </div>

          {/* Action Buttons: Add Session & Sync (Compact on mobile, full on desktop) */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handleOpenAddModal}
              className="flex-1 sm:flex-initial h-7 sm:h-auto flex items-center justify-center gap-1.5 px-2.5 sm:px-4 py-1 sm:py-2.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-semibold sm:font-bold bg-slate-800/80 sm:bg-gradient-to-b sm:from-white/[0.18] sm:to-white/[0.06] hover:bg-slate-700/80 sm:hover:from-white/[0.24] sm:hover:to-white/[0.10] text-slate-200 sm:text-white shadow-sm sm:shadow-[0_2px_10px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.35)] border border-slate-700/80 sm:border-white/25 backdrop-blur-xl transition-all cursor-pointer active:scale-95 whitespace-nowrap"
            >
              <Plus className="w-3 h-3 sm:w-4 sm:h-4 text-cyan-400 sm:text-white" />
              <span>Add Session</span>
            </button>

            <button
              onClick={handleSyncOutlook}
              disabled={syncing}
              className="flex-1 sm:flex-initial h-7 sm:h-auto flex items-center justify-center gap-1.5 px-2.5 sm:px-4 py-1 sm:py-2.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-semibold sm:font-bold bg-slate-800/80 sm:bg-white/[0.04] hover:bg-slate-700/80 sm:hover:bg-white/[0.08] text-slate-200 border border-slate-700/80 sm:border-white/15 hover:border-slate-600 sm:hover:border-white/25 backdrop-blur-xl transition-all disabled:opacity-60 cursor-pointer active:scale-95 whitespace-nowrap"
            >
              <RefreshCw className={`w-3 h-3 sm:w-4 sm:h-4 text-cyan-400 sm:text-slate-200 ${syncing ? 'animate-spin' : ''}`} />
              <span>{syncing ? 'Syncing…' : 'Sync'}</span>
            </button>

            <div className="hidden sm:block shrink-0">
              <NavDrawerButton />
            </div>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
          <div className="p-3 sm:p-4 rounded-xl bg-slate-900/70 border border-slate-800/80 sm:border-cyan-500/20 shadow-sm sm:shadow-lg flex flex-col justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Total Training Batches</span>
            <span className="text-xl sm:text-2xl font-bold sm:font-black mt-1 text-white sm:text-cyan-400">{totalSessions}</span>
            <span className="text-[10px] text-slate-500 mt-1">SCM Cohorts Pipeline</span>
          </div>

          <div className="p-3 sm:p-4 rounded-xl bg-slate-900/70 border border-slate-800/80 sm:border-indigo-500/20 shadow-sm sm:shadow-lg flex flex-col justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Total Active Enrollees</span>
            <span className="text-xl sm:text-2xl font-bold sm:font-black mt-1 text-white sm:text-indigo-400">{totalActive} / {totalEnrolled}</span>
            <span className="text-[10px] text-slate-500 mt-1">Active vs Enrolled</span>
          </div>

          <div className="p-3 sm:p-4 rounded-xl bg-slate-900/70 border border-slate-800/80 sm:border-emerald-500/20 shadow-sm sm:shadow-lg flex flex-col justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Paid Enrollees</span>
            <span className="text-xl sm:text-2xl font-bold sm:font-black mt-1 text-white sm:text-emerald-400">{totalPaidCount}</span>
            <span className="text-[10px] text-slate-500 mt-1">Full Fee Completed</span>
          </div>

          <div className="p-3 sm:p-4 rounded-xl bg-slate-900/70 border border-slate-800/80 sm:border-amber-500/25 shadow-sm sm:shadow-lg flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Partial / Pending Fee</span>
              <span className="hidden sm:inline-block text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/25 uppercase tracking-wider">
                Status
              </span>
            </div>
            <div className="flex items-center gap-3 sm:gap-4 mt-1.5 sm:mt-2">
              <div className="flex items-baseline gap-1">
                <span className="text-xl sm:text-2xl font-bold sm:font-black text-amber-400">{totalPartialCount}</span>
                <span className="text-[10px] sm:text-xs font-semibold text-slate-400">partial</span>
              </div>
              <div className="h-4 sm:h-5 w-px bg-slate-800" />
              <div className="flex items-baseline gap-1">
                <span className="text-xl sm:text-2xl font-bold sm:font-black text-rose-400">{totalPendingCount}</span>
                <span className="text-[10px] sm:text-xs font-semibold text-slate-400">pending</span>
              </div>
            </div>
            <span className="text-[10px] text-slate-500 mt-1">Fee Tracking Status</span>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="p-3 sm:p-4 bg-slate-900/60 backdrop-blur-md border border-slate-800/80 sm:border-slate-700/40 rounded-xl space-y-2.5 sm:space-y-3">
          <div className="flex flex-col lg:flex-row gap-2.5 sm:gap-3 items-center justify-between">
            <div className="relative w-full lg:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <input
                type="text"
                placeholder="Search batch, trainer, platform, participant…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 sm:py-2 bg-slate-950/80 border border-slate-800 sm:border-slate-700/50 rounded-lg sm:rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
              />
            </div>

            <div className="grid grid-cols-2 lg:flex lg:items-center gap-2 w-full lg:w-auto">
              <select
                value={platformFilter}
                onChange={e => setPlatformFilter(e.target.value)}
                className="w-full lg:w-auto bg-slate-950/80 border border-slate-800 sm:border-slate-700/50 rounded-lg sm:rounded-xl px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs text-slate-300 focus:outline-none"
              >
                <option value="ALL">All Platforms</option>
                <option value="Manhattan">Manhattan WMS</option>
                <option value="Blue Yonder">Blue Yonder (JDA)</option>
                <option value="Kinaxis">Kinaxis</option>
                <option value="SAP">SAP S/4HANA</option>
              </select>

              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="w-full lg:w-auto bg-slate-950/80 border border-slate-800 sm:border-slate-700/50 rounded-lg sm:rounded-xl px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs text-slate-300 focus:outline-none"
              >
                <option value="ALL">All Statuses</option>
                <option value="Upcoming">Upcoming</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
          </div>
        </div>

        {/* Main Training Sessions Table */}
        <div className="flex-1 bg-slate-900/60 backdrop-blur-md border border-slate-700/40 rounded-xl overflow-hidden flex flex-col">
          {loading ? (
            <div className="flex items-center justify-center py-24 text-slate-400">Loading Training operations…</div>
          ) : filteredSessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-slate-400 space-y-2">
              <Calendar className="w-10 h-10 text-slate-600" />
              <p className="text-sm font-semibold text-slate-300">No Training sessions found</p>
              <p className="text-xs text-slate-500">Click "+ Add Session" to create one</p>
            </div>
          ) : (
            <>
              {/* Mobile View (< md) - Sleek 2-Line Cards matching Leads CRM styling */}
              <div className="md:hidden space-y-2 p-1.5 sm:p-2 flex-1">
                {filteredSessions.map((session) => {
                  const isExpanded = expandedSessionId === session.id;
                  const pSummary = session.paymentSummary || { paidCount: 0, partialCount: 0, pendingCount: 0 };
                  const initial = session.platform ? session.platform.trim().charAt(0).toUpperCase() : 'T';

                  return (
                    <div
                      key={session.id}
                      className={`rounded-xl border transition-all ${
                        isExpanded
                          ? 'bg-slate-900/95 border-slate-700/80 shadow-lg'
                          : 'bg-slate-900/70 hover:bg-slate-800/60 border-slate-800/80'
                      }`}
                    >
                      {/* 2-Line Header matching Leads CRM format */}
                      <div
                        className="p-3 cursor-pointer select-none"
                        onClick={() => setExpandedSessionId(isExpanded ? null : session.id)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setExpandedSessionId(isExpanded ? null : session.id);
                          }
                        }}
                      >
                        {/* Line 1: Avatar + Title + Trainer (Left) & Status Badge + Chevron (Right) */}
                        <div className="flex items-center justify-between gap-2 w-full">
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-600/20 to-indigo-600/20 border border-cyan-500/20 text-cyan-400 font-bold text-xs flex items-center justify-center shrink-0 shadow-sm">
                              {initial}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-white text-xs truncate">
                                  {session.title}
                                </span>
                                <span className="px-1.5 py-0.5 text-[8.5px] font-semibold rounded bg-slate-800 text-slate-300 border border-slate-700/60 shrink-0">
                                  {session.trainer}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                              session.status === 'Completed'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                : session.status === 'In Progress'
                                ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30'
                                : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                            }`}>
                              {session.status}
                            </span>
                            <div className="w-6 h-6 rounded-lg text-slate-400 hover:text-cyan-400 flex items-center justify-center shrink-0 transition-colors">
                              {isExpanded ? <ChevronUp size={16} className="text-cyan-400" /> : <ChevronDown size={16} />}
                            </div>
                          </div>
                        </div>

                        {/* Line 2: Enrollment (Left) & Platform Name (Right) */}
                        <div className="flex items-center justify-between gap-2 mt-2 pl-10.5 text-xs">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-slate-800/80 border border-slate-700/80 text-slate-300 font-medium text-[10px] shrink-0">
                            <Users size={10} className="text-cyan-400" />
                            <span>{session.currentlyParticipating || session.participantsCount} / {session.participantsCount} Enrolled</span>
                          </span>
                          <span className="px-2.5 py-0.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-300 font-medium text-[10px] truncate max-w-[170px]">
                            {session.platform}
                          </span>
                        </div>
                      </div>

                      {/* Clean Expandable Details */}
                      {isExpanded && (
                        <div className="px-3 pb-3 pt-0 border-t border-slate-800/80 mt-1 space-y-2 text-xs">
                          <div className="grid grid-cols-1 gap-1.5 pt-2">
                            {/* Fee Status Summary */}
                            <div className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-slate-950/60 border border-slate-800/70">
                              <span className="text-[11px] text-slate-400 font-medium">Fee Breakdown</span>
                              <div className="flex items-center gap-2.5 text-[10px] text-slate-400">
                                <span>Paid: <strong className="font-bold font-mono text-slate-200">{pSummary.paidCount}</strong></span>
                                <span>Partial: <strong className="font-bold font-mono text-slate-200">{pSummary.partialCount}</strong></span>
                                <span>Pending: <strong className="font-bold font-mono text-slate-200">{pSummary.pendingCount}</strong></span>
                              </div>
                            </div>

                            {/* Schedule & Location */}
                            <div className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-slate-950/60 border border-slate-800/70">
                              <span className="text-[11px] text-slate-400 font-medium">Schedule & Mode</span>
                              <span className="text-slate-300 text-[11px] font-medium truncate max-w-[200px]">
                                {session.date || 'TBD'} • {session.location || 'Online'}
                              </span>
                            </div>

                            {/* Trainer info */}
                            <div className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-slate-950/60 border border-slate-800/70">
                              <span className="text-[11px] text-slate-400 font-medium">Trainer</span>
                              <span className="text-slate-300 text-[11px] font-medium">{session.trainer}</span>
                            </div>
                          </div>

                          {/* Action Button */}
                          <div className="pt-1">
                            <button
                              onClick={() => handleOpenEditModal(session)}
                              className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700/80 transition-all cursor-pointer active:scale-95"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-cyan-400" />
                              <span>Edit Training Session</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Desktop Table View (>= md) */}
              <div className="hidden md:block overflow-x-auto flex-1">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-950/70 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-800">
                    <tr>
                      <th className="py-3.5 px-4 text-[10px]">Session / Batch Title</th>
                      <th className="py-3.5 px-4 text-[10px] text-center">Platform</th>
                      <th className="py-3.5 px-4 text-[10px] text-center">Trainer & Schedule</th>
                      <th className="py-3.5 px-4 text-[10px] text-center">Enrollment</th>
                      <th className="py-3.5 px-4 text-[10px]">Fee Status Breakdown</th>
                      <th className="py-3.5 px-4 text-[10px]">Location / Mode</th>
                      <th className="py-3.5 px-4 text-[10px] text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40">
                    {filteredSessions.map((session) => {
                      const pSummary = session.paymentSummary || { paidCount: 0, partialCount: 0, pendingCount: 0 };

                      return (
                        <tr key={session.id} className="hover:bg-slate-800/40 transition-colors">
                          {/* Title */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 font-bold flex items-center justify-center text-xs shrink-0">
                                <Calendar className="w-4 h-4" />
                              </div>
                              <div>
                                <p className="font-bold text-white text-xs">{session.title}</p>
                                <p className="text-[10px] text-cyan-400 font-medium mt-0.5">Trainer: {session.trainer}</p>
                              </div>
                            </div>
                          </td>

                          {/* Platform */}
                          <td className="py-3.5 px-4 text-center">
                            <span className="inline-flex items-center justify-center w-40 px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 font-bold text-xs shadow-sm truncate">
                              {session.platform}
                            </span>
                          </td>

                          {/* Trainer & Schedule */}
                          <td className="py-3.5 px-4 text-center">
                            <div className="inline-flex flex-col items-center justify-center w-48 px-2 py-1 rounded-lg bg-slate-950/60 border border-slate-800">
                              <span className="text-xs font-semibold text-slate-200">{session.trainer}</span>
                              <span className="text-[10px] text-slate-500 font-mono mt-0.5">
                                {new Date(session.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </span>
                            </div>
                          </td>

                          {/* Enrollment */}
                          <td className="py-3.5 px-4 text-center">
                            <span className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs font-bold">
                              <Users className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                              <span>{session.currentlyParticipating || session.participantsCount} / {session.participantsCount}</span>
                            </span>
                          </td>

                          {/* Fee Status Breakdown */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap text-xs text-slate-400">
                              <span>Paid: <strong className="font-bold font-mono text-slate-200">{pSummary.paidCount}</strong></span>
                              <span>Partial: <strong className="font-bold font-mono text-slate-200">{pSummary.partialCount}</strong></span>
                              <span>Pending: <strong className="font-bold font-mono text-slate-200">{pSummary.pendingCount}</strong></span>
                            </div>
                          </td>

                          {/* Location */}
                          <td className="py-3.5 px-4">
                            <span className="text-xs text-slate-300">{session.location || 'Online Sandbox + Teams'}</span>
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <button
                              onClick={() => handleOpenEditModal(session)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-b from-white/[0.18] to-white/[0.06] hover:from-white/[0.24] hover:to-white/[0.10] text-white text-xs font-bold shadow-[0_2px_10px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.35)] border border-white/25 backdrop-blur-xl transition-all cursor-pointer ml-auto active:scale-95"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>Edit Session</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Footer */}
          <div className="px-4 py-3 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between text-xs text-slate-400">
            <span>Showing {filteredSessions.length} Training Cohort sessions</span>
            <span className="text-[10px] text-slate-500">GapAnchor Training Operations & Cohort Management</span>
          </div>
        </div>

      </div>

      {/* Modal Integration for Edit / Create */}
      <OpsModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onRefresh={fetchTrainingSessions}
        sessionToEdit={sessionToEdit}
        masterParticipantsList={masterParticipants}
      />
    </div>
  );
}
