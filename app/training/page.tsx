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
import UserNav from '@/components/UserNav';
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
      className="min-h-screen bg-[#080c14] text-slate-100 flex flex-col font-sans"
      style={{
        backgroundImage:
          'radial-gradient(ellipse at 20% 0%, rgba(6,182,212,0.08) 0%, transparent 60%), radial-gradient(ellipse at 80% 100%, rgba(99,102,241,0.08) 0%, transparent 60%)',
      }}
    >
      <div className="w-full max-w-full px-3 sm:px-6 md:px-8 py-4 sm:py-6 space-y-4 flex-1 flex flex-col">

        {/* Top Header Bar */}
        <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-3 p-4 bg-slate-900/60 backdrop-blur-xl border border-cyan-500/20 rounded-2xl shadow-2xl">
          <div className="flex items-center justify-between w-full xl:w-auto gap-3">
            <div className="flex items-center space-x-3">
              <Link
                href="/"
                className="group flex items-center gap-2 p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/50 text-slate-300 hover:text-white transition-all"
              >
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
                <span className="text-xs font-semibold hidden md:inline">Dashboard</span>
              </Link>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-lg md:text-2xl font-black tracking-tight bg-gradient-to-r from-cyan-400 via-indigo-200 to-cyan-100 bg-clip-text text-transparent">
                    Training Operations
                  </h1>
                  <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 uppercase tracking-widest">
                    SCM Platform Cohorts
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  SCM Platform Cohorts • Session Schedule • Fee & Participant Tracking
                </p>
              </div>
            </div>
            <div className="xl:hidden"><NavDrawerButton className="!w-9 !h-9" /></div>
          </div>

          <div className="flex items-center gap-2.5 w-full xl:w-auto justify-between xl:justify-end flex-wrap">
            <button
              onClick={handleOpenAddModal}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white shadow-lg shadow-cyan-500/20 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Add Session</span>
            </button>

            <UserNav />
            <button
              onClick={handleSyncOutlook}
              disabled={syncing}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all disabled:opacity-60 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              <span>{syncing ? 'Syncing…' : 'Sync'}</span>
            </button>
            <div className="hidden xl:block"><NavDrawerButton /></div>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-4 rounded-2xl bg-slate-900/70 border border-cyan-500/20 shadow-lg flex flex-col justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Total Training Batches</span>
            <span className="text-2xl font-black mt-1 text-cyan-400">{totalSessions}</span>
            <span className="text-[10px] text-slate-500 mt-1">SCM Cohorts Pipeline</span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/70 border border-indigo-500/20 shadow-lg flex flex-col justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Total Active Enrollees</span>
            <span className="text-2xl font-black mt-1 text-indigo-400">{totalActive} / {totalEnrolled}</span>
            <span className="text-[10px] text-slate-500 mt-1">Active vs Enrolled</span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/70 border border-emerald-500/20 shadow-lg flex flex-col justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Paid Enrollees</span>
            <span className="text-2xl font-black mt-1 text-emerald-400">{totalPaidCount}</span>
            <span className="text-[10px] text-slate-500 mt-1">Full Fee Completed</span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/70 border border-rose-500/20 shadow-lg flex flex-col justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Partial / Pending Fee</span>
            <span className="text-2xl font-black mt-1 text-amber-400">{totalPartialCount} <span className="text-sm font-normal text-slate-400">partial</span> • {totalPendingCount} <span className="text-sm font-normal text-rose-400">pending</span></span>
            <span className="text-[10px] text-slate-500 mt-1">Fee Tracking Status</span>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="p-4 bg-slate-900/60 backdrop-blur-md border border-slate-700/40 rounded-2xl space-y-3">
          <div className="flex flex-col lg:flex-row gap-3 items-center justify-between">
            <div className="relative w-full lg:w-80">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search batch, trainer, platform, participant…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-950/80 border border-slate-700/50 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
              <select
                value={platformFilter}
                onChange={e => setPlatformFilter(e.target.value)}
                className="bg-slate-950/80 border border-slate-700/50 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none"
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
                className="bg-slate-950/80 border border-slate-700/50 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none"
              >
                <option value="ALL">All Statuses</option>
                <option value="In Progress">⚡ In Progress</option>
                <option value="Scheduled">📅 Scheduled</option>
                <option value="Completed">✅ Completed</option>
              </select>
            </div>
          </div>
        </div>

        {/* Main Training Sessions Table */}
        <div className="flex-1 bg-slate-900/60 backdrop-blur-md border border-slate-700/40 rounded-2xl overflow-hidden flex flex-col">
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
              {/* Mobile View (< md) */}
              <div className="md:hidden space-y-2.5 p-2 flex-1">
                {filteredSessions.map((session) => {
                  const isExpanded = expandedSessionId === session.id;
                  const pSummary = session.paymentSummary || { paidCount: 0, partialCount: 0, pendingCount: 0 };

                  return (
                    <div
                      key={session.id}
                      className="p-3 bg-slate-900/90 border border-slate-800 rounded-2xl flex flex-col gap-2.5 transition-all shadow-md"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 font-bold flex items-center justify-center text-xs shrink-0 mt-0.5">
                            <Calendar className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-bold text-xs text-white leading-tight">
                              {session.title}
                            </h3>
                            <p className="text-[10.5px] text-cyan-400 font-medium mt-0.5 truncate">
                              👨‍🏫 Trainer: {session.trainer}
                            </p>
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 font-bold text-[10px]">
                                {session.platform}
                              </span>
                              <span className={`px-2 py-0.5 text-[9.5px] font-bold rounded-md uppercase border ${
                                session.status === 'Completed'
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                  : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
                              }`}>
                                {session.status}
                              </span>
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => setExpandedSessionId(isExpanded ? null : session.id)}
                          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/60 transition-colors shrink-0 cursor-pointer"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>

                      {isExpanded && (
                        <div className="pt-2.5 mt-1 border-t border-slate-800/80 space-y-2.5 animate-fade-in text-xs">
                          {/* Enrollment */}
                          <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
                            <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                              Enrollment & Active
                            </span>
                            <span className="text-slate-200 font-bold text-xs">
                              {session.currentlyParticipating || session.participantsCount} / {session.participantsCount} Active
                            </span>
                          </div>

                          {/* Fee Status Summary */}
                          <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                            <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                              Fee Status Summary
                            </div>
                            <div className="flex items-center gap-2 flex-wrap pt-1">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                Paid: {pSummary.paidCount}
                              </span>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                Partial: {pSummary.partialCount}
                              </span>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                Pending: {pSummary.pendingCount}
                              </span>
                            </div>
                          </div>

                          {/* Action Button */}
                          <div className="pt-1 flex items-center justify-end">
                            <button
                              onClick={() => handleOpenEditModal(session)}
                              className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-all cursor-pointer shadow-md"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
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
                                <p className="text-[10px] text-cyan-400 font-medium mt-0.5">👨‍🏫 Trainer: {session.trainer}</p>
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
                            <span className="inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs font-bold">
                              <Users className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                              <span>{session.currentlyParticipating || session.participantsCount} / {session.participantsCount}</span>
                            </span>
                          </td>

                          {/* Fee Status Breakdown */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
                                <span>Paid: <strong className="font-bold">{pSummary.paidCount}</strong></span>
                              </span>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border border-amber-500/20 bg-amber-500/10 text-amber-400">
                                <span>Partial: <strong className="font-bold">{pSummary.partialCount}</strong></span>
                              </span>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border border-rose-500/20 bg-rose-500/10 text-rose-400">
                                <span>Pending: <strong className="font-bold">{pSummary.pendingCount}</strong></span>
                              </span>
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
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-600/90 hover:bg-cyan-500 text-white text-xs font-bold transition-all cursor-pointer ml-auto shadow-md shadow-cyan-500/10"
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
