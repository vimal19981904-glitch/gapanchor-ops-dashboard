'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  X, RefreshCw, Search, Plus, Globe, BookOpen, MessageSquare, Phone,
  Mail, CheckCircle2, AlertCircle, Sparkles, UserCheck, Star,
  Calendar, ArrowLeft, User, Eye, FileText, Upload,
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Clock, PhoneCall, XCircle, Briefcase, Shield,
  DollarSign, Edit3, Trash2
} from 'lucide-react';
import { toast } from 'sonner';
import UserNav from '@/components/UserNav';
import { NavDrawerButton } from '@/components/NavigationContext';
import JobSupportModal from '@/components/JobSupportModal';

interface Participant {
  id?: string;
  participantName: string;
  amountDue: number;
  amountPaid: number;
  paymentStatus: string;
  notes?: string;
}

interface JobSupportSession {
  id: string;
  title: string;
  platform: string;
  trainer: string;
  engineer?: string;
  participantsCount: number;
  currentlyParticipating: number;
  date: string;
  location: string;
  status: string;
  trainerTotalCost: number;
  trainerAmountPaid: number;
  trainerAmountDue: number;
  participants: Participant[];
}

export default function JobSupportOpsPage() {
  const [sessions, setSessions] = useState<JobSupportSession[]>([]);
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
  const [sessionToEdit, setSessionToEdit] = useState<JobSupportSession | null>(null);

  const fetchJobSupportSessions = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/job-support/session');
      const json = await res.json();
      if (json.success) {
        setSessions(json.sessions || []);
      }
    } catch (err) {
      console.error('Failed to fetch job support operations sessions:', err);
      toast.error('Failed to load Job Support operations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobSupportSessions();
  }, []);

  const handleSyncOutlook = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/enquiries/sync-excel', { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        toast.success(json.message || 'Outlook Job Support synced successfully!');
        fetchJobSupportSessions();
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

  const handleOpenEditModal = (session: JobSupportSession) => {
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
        s.participants.some(p => p.participantName.toLowerCase().includes(searchLower));

      const matchesPlatform =
        platformFilter === 'ALL' ||
        s.platform.toLowerCase().includes(platformFilter.toLowerCase());

      const matchesStatus =
        statusFilter === 'ALL' || s.status.toLowerCase() === statusFilter.toLowerCase();

      return matchesSearch && matchesPlatform && matchesStatus;
    });
  }, [sessions, search, platformFilter, statusFilter]);

  // Aggregate Metrics
  const totalEngagements = sessions.length;
  const activeEngagements = sessions.filter(s => s.status !== 'Completed').length;
  const totalClientRevenue = sessions.reduce((acc, s) => {
    return acc + s.participants.reduce((pAcc, p) => pAcc + (p.amountPaid || 0), 0);
  }, 0);
  const totalEngineerCompensationDue = sessions.reduce((acc, s) => acc + (s.trainerAmountDue || 0), 0);

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
                  <h1 className="text-lg md:text-2xl font-black tracking-tight bg-gradient-to-r from-amber-400 via-orange-200 to-amber-100 bg-clip-text text-transparent">
                    Job Support Operations
                  </h1>
                  <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 uppercase tracking-widest">
                    1-on-1 Dedicated Support
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  1-on-1 Engineer Assignment, Session Schedule & Financial Compensation Tracking
                </p>
              </div>
            </div>
            <div className="xl:hidden"><NavDrawerButton className="!w-9 !h-9" /></div>
          </div>

          <div className="flex items-center gap-2 w-full xl:w-auto xl:justify-end">
            <button
              onClick={handleOpenAddModal}
              className="flex-1 xl:flex-none flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white shadow-lg shadow-cyan-500/20 transition-all cursor-pointer truncate"
            >
              <Plus className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">+ New Support</span>
            </button>

            <button
              onClick={handleSyncOutlook}
              disabled={syncing}
              className="flex-1 xl:flex-none flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all disabled:opacity-60 cursor-pointer truncate"
            >
              <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${syncing ? 'animate-spin' : ''}`} />
              <span className="truncate">{syncing ? 'Syncing…' : 'Sync'}</span>
            </button>

            <div className="flex items-center gap-2 shrink-0">
              <UserNav />
              <div className="hidden xl:block"><NavDrawerButton /></div>
            </div>
          </div>
        </div>

        {/* KPI Cards (Training Operations Layout) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
          <div className="p-2.5 sm:p-4 rounded-2xl bg-slate-900/70 border border-cyan-500/20 shadow-lg flex flex-col justify-between">
            <span className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider text-slate-400">Total Support</span>
            <span className="text-sm sm:text-2xl font-black mt-1 text-cyan-400">{totalEngagements}</span>
            <span className="text-[9px] text-slate-500 mt-0.5 truncate">1 Consultant per Client</span>
          </div>

          <div className="p-2.5 sm:p-4 rounded-2xl bg-slate-900/70 border border-indigo-500/20 shadow-lg flex flex-col justify-between">
            <span className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider text-slate-400">Active Engagements</span>
            <span className="text-sm sm:text-2xl font-black mt-1 text-indigo-400">{activeEngagements}</span>
            <span className="text-[9px] text-slate-500 mt-0.5 truncate">Scheduled</span>
          </div>

          <div className="p-2.5 sm:p-4 rounded-2xl bg-slate-900/70 border border-emerald-500/20 shadow-lg flex flex-col justify-between">
            <span className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider text-slate-400">Client Revenue</span>
            <span className="text-xs sm:text-2xl font-black mt-1 text-emerald-400">₹ {totalClientRevenue.toLocaleString()}</span>
            <span className="text-[9px] text-slate-500 mt-0.5 truncate">Client Paid Fees</span>
          </div>

          <div className="p-2.5 sm:p-4 rounded-2xl bg-slate-900/70 border border-rose-500/20 shadow-lg flex flex-col justify-between">
            <span className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Engineer <span className="hidden sm:inline">Compensation </span>Payable
            </span>
            <span className="text-xs sm:text-2xl font-black mt-1 text-rose-400">₹ {totalEngineerCompensationDue.toLocaleString()}</span>
            <span className="text-[9px] text-slate-500 mt-0.5 truncate">Consultant Due</span>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="p-4 bg-slate-900/60 backdrop-blur-md border border-slate-700/40 rounded-2xl space-y-3">
          <div className="flex flex-col lg:flex-row gap-3 items-center justify-between">
            <div className="relative w-full lg:w-80">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search client, engineer, platform, title…"
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
                <option value="ALL">All Target Platforms</option>
                <option value="Manhattan">Manhattan WMS / ProActive</option>
                <option value="AWS">AWS / Cloud Architecture</option>
                <option value="Blue Yonder">Blue Yonder (JDA)</option>
                <option value="Oracle">Oracle RMCS</option>
                <option value="RedPrairie">RedPrairie</option>
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

        {/* Main Job Support Sessions Table (1:1 Training Operations Layout) */}
        <div className="flex-1 bg-slate-900/60 backdrop-blur-md border border-slate-700/40 rounded-2xl overflow-hidden flex flex-col">
          {loading ? (
            <div className="flex items-center justify-center py-24 text-slate-400">Loading Job Support operations…</div>
          ) : filteredSessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-slate-400 space-y-2">
              <Briefcase className="w-10 h-10 text-slate-600" />
              <p className="text-sm font-semibold text-slate-300">No Job Support sessions found</p>
              <p className="text-xs text-slate-500">Click "+ New Support Engagement" to create one</p>
            </div>
          ) : (
            <>
              {/* Mobile View: Expandable Dropdown Cards (md:hidden) */}
              <div className="md:hidden space-y-2.5 p-2 flex-1">
                {filteredSessions.map((session) => {
                  const isExpanded = expandedSessionId === session.id;
                  const clientNames = session.participants.map(p => p.participantName).join(', ') || '1-on-1 Client';
                  const clientTotalPaid = session.participants.reduce((a, b) => a + (b.amountPaid || 0), 0);
                  const clientTotalDue = session.participants.reduce((a, b) => a + (b.amountDue || 0), 0);
                  const engineerName = session.trainer || session.engineer || 'Unassigned';

                  return (
                    <div
                      key={session.id}
                      className="p-3 bg-slate-900/90 border border-slate-800 rounded-2xl flex flex-col gap-2.5 transition-all shadow-md"
                    >
                      {/* Card Header & Chevron Toggle */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 font-bold flex items-center justify-center text-xs shrink-0 mt-0.5">
                            <Briefcase className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-bold text-xs text-white leading-tight">
                              {session.title}
                            </h3>
                            <p className="text-[10.5px] text-cyan-400 font-medium mt-0.5 truncate">
                              👤 Client: {clientNames}
                            </p>
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-md bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 font-bold text-[10px]">
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
                          title={isExpanded ? "Collapse details" : "Expand details"}
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>

                      {/* Expanded Content Dropdown */}
                      {isExpanded && (
                        <div className="pt-2.5 mt-1 border-t border-slate-800/80 space-y-2.5 animate-fade-in text-xs">
                          {/* Engineer Assignment */}
                          <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
                            <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                              Support Engineer
                            </span>
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-[11px] font-bold">
                              <UserCheck className="w-3.5 h-3.5 text-indigo-400" />
                              {engineerName}
                            </span>
                          </div>

                          {/* Client Financials */}
                          <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                            <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                              Client Financials
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-slate-300">Paid Amount:</span>
                              <span className="font-mono font-bold text-emerald-400">₹ {clientTotalPaid.toLocaleString()}</span>
                            </div>
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-slate-400">Total Agreed Fee:</span>
                              <span className="font-mono text-slate-300">₹ {clientTotalDue.toLocaleString()}</span>
                            </div>
                          </div>

                          {/* Engineer Compensation */}
                          <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                            <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                              Engineer Compensation
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-slate-300">Total Pay:</span>
                              <span className="font-mono font-bold text-white">₹ {(session.trainerTotalCost || 0).toLocaleString()}</span>
                            </div>
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-slate-400">Due Balance:</span>
                              <span className="font-mono font-bold text-rose-400">₹ {(session.trainerAmountDue || 0).toLocaleString()}</span>
                            </div>
                          </div>

                          {/* Mode & Date */}
                          <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
                            <div>
                              <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Mode & Schedule</div>
                              <div className="text-slate-200 mt-0.5">{session.location || 'Online Sandbox + Teams'}</div>
                            </div>
                            <div className="text-right">
                              <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Date</div>
                              <div className="text-slate-300 font-mono text-[11px]">
                                {session.date ? new Date(session.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Flexible'}
                              </div>
                            </div>
                          </div>

                          {/* Action Button */}
                          <div className="pt-1 flex items-center justify-end">
                            <button
                              onClick={() => handleOpenEditModal(session)}
                              className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-all cursor-pointer shadow-md shadow-cyan-500/10"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>Edit Support Session</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Desktop View: Full 7-Column Table (hidden md:block) */}
              <div className="hidden md:block overflow-x-auto flex-1">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-950/70 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-800">
                    <tr>
                      <th className="py-3.5 px-4 text-[10px]">Session / Engagement Title</th>
                      <th className="py-3.5 px-4 text-[10px] text-center">Target Platform</th>
                      <th className="py-3.5 px-4 text-[10px] text-center">Assigned Support Engineer</th>
                      <th className="py-3.5 px-4 text-[10px]">Client Financials</th>
                      <th className="py-3.5 px-4 text-[10px]">Engineer Compensation</th>
                      <th className="py-3.5 px-4 text-[10px]">Support Mode & Date</th>
                      <th className="py-3.5 px-4 text-[10px] text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40">
                    {filteredSessions.map((session) => {
                      const clientNames = session.participants.map(p => p.participantName).join(', ') || '1-on-1 Client';
                      const clientTotalPaid = session.participants.reduce((a, b) => a + (b.amountPaid || 0), 0);
                      const clientTotalDue = session.participants.reduce((a, b) => a + (b.amountDue || 0), 0);

                      return (
                        <tr key={session.id} className="hover:bg-slate-800/40 transition-colors">
                          {/* Session Title & Client */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 font-bold flex items-center justify-center text-xs shrink-0">
                                <Briefcase className="w-4 h-4" />
                              </div>
                              <div>
                                <p className="font-bold text-white text-xs">{session.title}</p>
                                <p className="text-[10px] text-cyan-400 font-medium mt-0.5">👤 Client: {clientNames}</p>
                              </div>
                            </div>
                          </td>

                          {/* Target Platform — Uniform fixed width button alignment */}
                          <td className="py-3.5 px-4 text-center">
                            <span className="inline-flex items-center justify-center w-48 px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 font-bold text-xs shadow-sm truncate">
                              {session.platform}
                            </span>
                          </td>

                          {/* Assigned Support Engineer — Uniform fixed width button alignment */}
                          <td className="py-3.5 px-4 text-center">
                            <span className="inline-flex items-center justify-center w-56 px-3 py-1.5 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs font-bold shadow-sm truncate">
                              <UserCheck className="w-3.5 h-3.5 text-indigo-400 shrink-0 mr-1.5" />
                              <span className="truncate">{session.trainer || session.engineer || 'Employee A'}</span>
                            </span>
                          </td>

                          {/* Client Financials */}
                          <td className="py-3.5 px-4">
                            <div className="space-y-0.5">
                              <div className="text-xs font-mono font-bold text-emerald-400">
                                Paid: ₹ {clientTotalPaid.toLocaleString()}
                              </div>
                              <div className="text-[10px] font-mono text-slate-400">
                                Total Fee: ₹ {clientTotalDue.toLocaleString()}
                              </div>
                            </div>
                          </td>

                          {/* Engineer Compensation */}
                          <td className="py-3.5 px-4">
                            <div className="space-y-0.5">
                              <div className="text-xs font-mono font-bold text-white">
                                Pay: ₹ {(session.trainerTotalCost || 0).toLocaleString()}
                              </div>
                              <div className="text-[10px] font-mono text-rose-400 font-semibold">
                                Due: ₹ {(session.trainerAmountDue || 0).toLocaleString()}
                              </div>
                            </div>
                          </td>

                          {/* Support Mode & Date */}
                          <td className="py-3.5 px-4">
                            <div>
                              <p className="text-xs text-slate-300">{session.location || 'Online Sandbox + Teams'}</p>
                              <p className="text-[10px] text-slate-500 mt-0.5 font-mono">
                                {session.date ? new Date(session.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Flexible'}
                              </p>
                            </div>
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
            <span>Showing {filteredSessions.length} Job Support engagement sessions</span>
            <span className="text-[10px] text-slate-500">GapAnchor Job Support Operations & Financial Management</span>
          </div>
        </div>

      </div>

      {/* Modal Integration for Edit / Create */}
      <JobSupportModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onRefresh={fetchJobSupportSessions}
        sessionToEdit={sessionToEdit}
      />
    </div>
  );
}
