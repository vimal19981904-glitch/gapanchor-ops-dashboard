'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Users, RefreshCw, Search, Plus, ArrowLeft, Mail, Phone, Trash2,
  GraduationCap, Wrench, Award, PanelRightOpen, FileText, CheckCircle2,
  ChevronDown, ChevronUp
} from 'lucide-react';
import { toast } from 'sonner';
import UserNav from '@/components/UserNav';
import { NavDrawerButton } from '@/components/NavigationContext';
import TrainersDonutChart from '@/components/TrainersDonutChart';
import TrainerModal, { formatPhone } from '@/components/TrainerModal';

export default function TrainersFullPage() {
  const [trainers, setTrainers] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'All' | 'Trainer' | 'Employee' | 'Both'>('All');
  const [courseFilter, setCourseFilter] = useState('ALL');

  // Drawer / Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [trainerToEdit, setTrainerToEdit] = useState<any | null>(null);

  const fetchTrainersData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/trainers');
      const data = await res.json();
      if (data.success) {
        setTrainers(data.trainers || []);
        setSummary(data.summary || null);
      }
    } catch (err) {
      console.error('Failed to fetch trainers:', err);
      toast.error('Failed to load trainers data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrainersData();
  }, []);

  const handleSyncWorkWithUs = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/trainers/sync', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || 'Work With Us candidates synced successfully!');
        fetchTrainersData();
      } else {
        if (data.authUrl || data.requiresAuth) {
          toast.error(data.error || 'Microsoft Outlook authorization required.', {
            action: {
              label: 'Connect Outlook',
              onClick: () => {
                window.location.href = data.authUrl || '/api/auth/microsoft/connect';
              },
            },
            duration: 10000,
          });
          setTimeout(() => {
            window.location.href = data.authUrl || '/api/auth/microsoft/connect';
          }, 2500);
        } else {
          toast.error(`Sync error: ${data.error}`);
        }
      }
    } catch (err: any) {
      toast.error(`Sync error: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleDeleteTrainer = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to remove ${name} from registry?`)) return;
    try {
      const res = await fetch(`/api/trainers?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        toast.success(`Removed ${name}`);
        fetchTrainersData();
      } else {
        toast.error(data.error || 'Failed to remove trainer');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error deleting candidate');
    }
  };

  // Filtered List
  const filteredTrainers = useMemo(() => {
    return trainers.filter((t) => {
      const searchLower = search.toLowerCase();
      const matchesSearch =
        !search ||
        (t.name && t.name.toLowerCase().includes(searchLower)) ||
        (t.email && t.email.toLowerCase().includes(searchLower)) ||
        (t.primaryCourse && t.primaryCourse.toLowerCase().includes(searchLower)) ||
        (t.notes && t.notes.toLowerCase().includes(searchLower));

      const matchesRole =
        roleFilter === 'All'
          ? true
          : roleFilter === 'Trainer'
          ? t.role === 'Trainer' || t.role === 'Both'
          : roleFilter === 'Employee'
          ? t.role === 'Employee' || t.role === 'Both'
          : t.role === 'Both';

      const matchesCourse =
        courseFilter === 'ALL' ||
        (t.primaryCourse && t.primaryCourse.toLowerCase().includes(courseFilter.toLowerCase()));

      return matchesSearch && matchesRole && matchesCourse;
    });
  }, [trainers, search, roleFilter, courseFilter]);

  const getRoleBadge = (role: string) => {
    if (role === 'Both') {
      return (
        <span className="inline-flex items-center justify-center gap-1 px-2 w-[130px] h-6 rounded-full text-[10px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 shadow-sm shrink-0 whitespace-nowrap">
          <Award className="w-3 h-3 text-emerald-400 shrink-0" /> Dual Role (Both)
        </span>
      );
    } else if (role === 'Employee') {
      return (
        <span className="inline-flex items-center justify-center gap-1 px-2 w-[130px] h-6 rounded-full text-[10px] font-bold bg-cyan-950/80 text-cyan-300 border border-cyan-500/40 shadow-sm shrink-0 whitespace-nowrap">
          <Wrench className="w-3 h-3 text-cyan-400 shrink-0" /> Job Support Staff
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center justify-center gap-1 px-2 w-[130px] h-6 rounded-full text-[10px] font-bold bg-indigo-950/80 text-indigo-300 border border-indigo-500/40 shadow-sm shrink-0 whitespace-nowrap">
          <GraduationCap className="w-3 h-3 text-indigo-400 shrink-0" /> Batch Trainer
        </span>
      );
    }
  };

  return (
    <div
      className="min-h-screen bg-[#080c14] text-slate-100 flex flex-col font-sans"
      style={{
        backgroundImage:
          'radial-gradient(ellipse at 20% 0%, rgba(99,102,241,0.12) 0%, transparent 60%), radial-gradient(ellipse at 80% 100%, rgba(6,182,212,0.10) 0%, transparent 60%)',
      }}
    >
      <div className="w-full max-w-full px-2 sm:px-6 md:px-8 py-3 sm:py-6 space-y-3 sm:space-y-4 flex-1 flex flex-col">
        {/* Top Navigation Bar */}
        <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3 p-3.5 sm:p-5 bg-slate-900/60 backdrop-blur-xl border border-indigo-500/20 rounded-2xl shadow-2xl">
          {/* Top Row: Back Button + Title & Badges + Mobile Drawer Button */}
          <div className="flex items-center justify-between w-full xl:w-auto gap-3">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <Link
                href="/"
                className="group flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/50 text-slate-300 hover:text-white transition-all shrink-0"
                title="Back to Dashboard"
              >
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
              </Link>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-base sm:text-xl font-black tracking-tight bg-gradient-to-r from-indigo-400 via-cyan-200 to-indigo-100 bg-clip-text text-transparent">
                    Trainers & Operations
                  </h1>
                  <span className="px-2 py-0.5 text-[9px] sm:text-[10px] font-bold rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase tracking-wider shrink-0">
                    Outlook Intake
                  </span>
                </div>
                <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5 truncate">
                  Batch Training, Job Support Engineers & Staff Analytics
                </p>
              </div>
            </div>

            {/* Mobile Navigation Drawer Button */}
            <div className="shrink-0 xl:hidden">
              <NavDrawerButton className="!w-9 !h-9" />
            </div>
          </div>

          {/* Action Buttons Row: Add Staff & Sync Outlook + Desktop Drawer Button */}
          <div className="flex items-center gap-2 w-full xl:w-auto justify-end">
            <button
              onClick={() => {
                setTrainerToEdit(null);
                setModalOpen(true);
              }}
              className="flex-1 xl:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white shadow-md shadow-indigo-500/20 transition-all cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span>Add Staff</span>
            </button>

            <button
              onClick={handleSyncWorkWithUs}
              disabled={syncing}
              className="flex-1 xl:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-950/80 hover:bg-indigo-900 text-indigo-200 border border-indigo-500/40 transition-all disabled:opacity-60 cursor-pointer whitespace-nowrap"
            >
              <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${syncing ? 'animate-spin text-indigo-400' : 'text-indigo-400'}`} />
              <span>{syncing ? 'Syncing...' : 'Sync Outlook'}</span>
            </button>

            <div className="hidden xl:block shrink-0">
              <NavDrawerButton />
            </div>
          </div>
        </div>

        {/* Top Donut Analytics & Metrics Section */}
        <TrainersDonutChart trainers={trainers} summary={summary} />

        {/* Filter Bar */}
        <div className="p-3 sm:p-4 bg-slate-900/60 backdrop-blur-md border border-slate-700/40 rounded-2xl space-y-3">
          <div className="flex flex-col lg:flex-row gap-3 items-center justify-between">
            {/* Role Filter Tabs */}
            <div className="flex items-center p-1 rounded-xl bg-slate-950/80 border border-slate-700/50 text-xs font-bold w-full lg:w-auto overflow-x-auto">
              <button
                onClick={() => setRoleFilter('All')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                  roleFilter === 'All' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                All
              </button>

              <button
                onClick={() => setRoleFilter('Trainer')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                  roleFilter === 'Trainer' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                <GraduationCap className="w-3.5 h-3.5" />
                <span>Trainers</span>
              </button>

              <button
                onClick={() => setRoleFilter('Employee')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                  roleFilter === 'Employee' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Wrench className="w-3.5 h-3.5" />
                <span>Job Support</span>
              </button>

              <button
                onClick={() => setRoleFilter('Both')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                  roleFilter === 'Both' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Award className="w-3.5 h-3.5" />
                <span>Dual Role</span>
              </button>
            </div>

            {/* Search & Course Filter */}
            <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
              <div className="relative flex-1 lg:w-72">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search trainer, course, or email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-950/80 border border-slate-700/50 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <select
                value={courseFilter}
                onChange={(e) => setCourseFilter(e.target.value)}
                className="bg-slate-950/80 border border-slate-700/50 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none cursor-pointer"
              >
                <option value="ALL">All Platforms & Courses</option>
                <option value="Manhattan">Manhattan WMS</option>
                <option value="Blue Yonder">Blue Yonder (JDA)</option>
                <option value="Kinaxis">Kinaxis</option>
                <option value="SAP">SAP S/4HANA</option>
              </select>
            </div>
          </div>
        </div>

        {/* Full Staff Table (Desktop) & Mobile Expandable Cards */}
        <div className="flex-1 bg-transparent border-0 md:bg-slate-900/60 md:backdrop-blur-md md:border md:border-slate-700/40 md:rounded-2xl overflow-hidden flex flex-col">
          {loading ? (
            <div className="flex items-center justify-center py-24 text-slate-400">Loading staff registry...</div>
          ) : filteredTrainers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-slate-400 space-y-2">
              <Users className="w-10 h-10 text-slate-600" />
              <p className="text-sm font-semibold text-slate-300">No candidates found</p>
              <p className="text-xs text-slate-500">Click "+ Add Trainer / Staff" or "Sync Work With Us"</p>
            </div>
          ) : (
            <>
              {/* Desktop Table (hidden on mobile) */}
              <div className="hidden md:block overflow-x-auto flex-1">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-950/70 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                    <tr>
                      <th className="py-3.5 px-4 text-[10px]">Candidate / Staff Member</th>
                      <th className="py-3.5 px-4 text-[10px]">Role</th>
                      <th className="py-3.5 px-4 text-[10px]">Primary Platform</th>
                      <th className="py-3.5 px-4 text-[10px]">Operational Metrics</th>
                      <th className="py-3.5 px-4 text-[10px]">Status</th>
                      <th className="py-3.5 px-4 text-[10px]">Intake Source</th>
                      <th className="py-3.5 px-4 text-[10px] text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40">
                    {filteredTrainers.map((t) => (
                      <tr
                        key={t.id}
                        onClick={() => {
                          setTrainerToEdit(t);
                          setModalOpen(true);
                        }}
                        className="hover:bg-slate-800/60 transition-colors cursor-pointer group align-middle"
                      >
                        {/* Name & Contact */}
                        <td className="py-3 px-4 max-w-xs sm:max-w-md overflow-hidden align-middle">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500/20 to-cyan-500/20 text-indigo-300 font-bold flex items-center justify-center border border-indigo-500/30 text-xs shrink-0 group-hover:scale-105 transition-transform shadow-sm">
                              {(t.name || 'C').charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-bold text-white text-sm leading-tight truncate">{t.name}</p>
                              <div className="text-[11px] text-slate-400 flex items-center gap-3 mt-0.5 truncate">
                                {t.email && (
                                  <span className="flex items-center gap-1 truncate">
                                    <Mail size={11} className="text-slate-500 shrink-0" /> {t.email}
                                  </span>
                                )}
                                {t.phone && (
                                  <span className="flex items-center gap-1 font-mono shrink-0">
                                    <Phone size={11} className="text-slate-500 shrink-0" /> {formatPhone(t.phone)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Role */}
                        <td className="py-3 px-4 align-middle">{getRoleBadge(t.role)}</td>

                        {/* Platform */}
                        <td className="py-3 px-4 font-semibold text-slate-200 align-middle">{t.primaryCourse}</td>

                        {/* Operational Metrics */}
                        <td className="py-3 px-4 font-mono text-[11px] align-middle">
                          <div className="text-indigo-300 font-bold">{t.totalBatches || 0} Batches Taken</div>
                          <div className="text-cyan-300 font-semibold">{t.jobSupportLeads || 0} Job Support Leads</div>
                        </td>

                        {/* Status */}
                        <td className="py-3 px-4 align-middle">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-md text-[10px] font-extrabold ${
                              t.status === 'Active'
                                ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-500/40'
                                : t.status === 'Onboarding'
                                ? 'bg-amber-950/70 text-amber-300 border border-amber-500/40'
                                : 'bg-slate-800 text-slate-300 border border-slate-700'
                            }`}
                          >
                            {t.status || 'Active'}
                          </span>
                        </td>

                        {/* Source */}
                        <td className="py-3 px-4 text-slate-400 text-[11px] align-middle">
                          {t.source === 'outlook_work_with_us' ? (
                            <span className="text-indigo-400 font-medium flex items-center gap-1">
                              <Mail size={12} /> Outlook Work With Us
                            </span>
                          ) : (
                            <span className="text-slate-400">Manual Entry</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right whitespace-nowrap align-middle">
                          <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => {
                                setTrainerToEdit(t);
                                setModalOpen(true);
                              }}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-indigo-300 bg-indigo-950/70 hover:bg-indigo-900 border border-indigo-500/30 hover:border-indigo-400/60 transition-all text-xs font-semibold shadow-sm cursor-pointer"
                              title="View candidate profile drawer"
                            >
                              <PanelRightOpen size={14} className="text-indigo-400" />
                              <span className="hidden xl:inline text-[11px]">View Details</span>
                            </button>
                            <button
                              onClick={() => handleDeleteTrainer(t.id, t.name)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-slate-800/50 hover:border-rose-500/30 transition-colors cursor-pointer"
                              title="Delete candidate"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card List with Chevron Dropdown (block on mobile) */}
              <div className="block md:hidden px-0 py-1 space-y-2 flex-1 overflow-y-auto">
                {filteredTrainers.map((t) => (
                  <MobileTrainerCardFull
                    key={t.id}
                    trainer={t}
                    getRoleBadge={getRoleBadge}
                    onOpenDrawer={() => {
                      setTrainerToEdit(t);
                      setModalOpen(true);
                    }}
                    onDelete={() => handleDeleteTrainer(t.id, t.name)}
                  />
                ))}
              </div>
            </>
          )}

          {/* Footer */}
          <div className="px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl md:rounded-none border border-slate-800/80 md:border-0 md:border-t bg-slate-950/70 flex items-center justify-between text-xs text-slate-400 mt-2 md:mt-0">
            <span>Showing {filteredTrainers.length} registered staff members</span>
            <span className="text-[10px] text-slate-500">GapAnchor Trainers & Operations Intelligence</span>
          </div>
        </div>
      </div>

      {/* Glossy Liquid Glass Side Drawer */}
      <TrainerModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setTrainerToEdit(null);
        }}
        onRefresh={fetchTrainersData}
        trainerToEdit={trainerToEdit}
      />
    </div>
  );
}

function MobileTrainerCardFull({
  trainer,
  getRoleBadge,
  onOpenDrawer,
  onDelete,
}: {
  trainer: any;
  getRoleBadge: (role: string) => React.ReactNode;
  onOpenDrawer: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="w-full rounded-xl bg-slate-950/90 border border-slate-800/90 p-3 space-y-2.5 transition-all shadow-sm">
      {/* Top Header Row (Line 1: Avatar + Name on Left & Role Badge + Chevron on Right) */}
      <div className="flex flex-col gap-1.5 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center justify-between gap-2 w-full">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500/20 to-cyan-500/20 text-indigo-300 font-bold flex items-center justify-center border border-indigo-500/30 text-xs shrink-0 shadow-sm">
              {(trainer.name || 'C').charAt(0).toUpperCase()}
            </div>
            <span className="font-bold text-white text-xs sm:text-sm truncate">
              {trainer.name}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {getRoleBadge(trainer.role)}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(!expanded);
              }}
              className="p-1 rounded-lg bg-slate-900 text-slate-400 hover:text-white border border-slate-800 shrink-0 cursor-pointer"
              title={expanded ? 'Collapse details' : 'Expand details'}
            >
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>
        </div>

        {/* Line 2: Email Address (Cleanly aligned under candidate name) */}
        <div className="pl-10.5 pr-2">
          <p className="text-[10.5px] text-slate-400 truncate">
            {trainer.email || trainer.phone || 'Outlook Candidate'}
          </p>
        </div>
      </div>

      {/* Expanded Dropdown Details Container */}
      {expanded && (
        <div className="pt-2.5 border-t border-slate-800/80 space-y-2.5 text-[11px] animate-fade-in">
          <div className="grid grid-cols-2 gap-2 text-slate-300">
            <div>
              <span className="text-[9.5px] uppercase font-bold text-slate-400 block">Primary Platform</span>
              <span className="font-semibold text-white truncate block">{trainer.primaryCourse}</span>
            </div>
            <div>
              <span className="text-[9.5px] uppercase font-bold text-slate-400 block">Operational Metrics</span>
              <span className="font-mono text-indigo-300 font-bold">{trainer.totalBatches || 0} Batches</span>
              <span className="text-slate-500 mx-1">•</span>
              <span className="font-mono text-cyan-300 font-bold">{trainer.jobSupportLeads || 0} Support</span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span
              className={`px-2 py-0.5 rounded text-[9.5px] font-bold ${
                trainer.status === 'Active'
                  ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-500/40'
                  : 'bg-slate-800 text-slate-300 border border-slate-700'
              }`}
            >
              {trainer.status || 'Active'}
            </span>

            <div className="flex items-center gap-2">
              <button
                onClick={onOpenDrawer}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-indigo-300 bg-indigo-950/80 border border-indigo-500/40 text-[10.5px] font-semibold"
              >
                <PanelRightOpen size={12} /> View Profile
              </button>
              <button
                onClick={onDelete}
                className="p-1 rounded-lg text-slate-400 hover:text-rose-400 bg-slate-900 border border-slate-800"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
