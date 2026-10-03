'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Users,
  RefreshCw,
  Plus,
  ExternalLink,
  Maximize2,
  Mail,
  Phone,
  Edit,
  Trash2,
  Search,
  ChevronDown,
  ChevronUp,
  Award,
  Wrench,
  GraduationCap,
} from 'lucide-react';
import { toast } from 'sonner';
import TrainerModal from './TrainerModal';

interface TrainersCardProps {
  onRefreshParent?: () => void;
}

export default function TrainersCard({ onRefreshParent }: TrainersCardProps) {
  const [trainers, setTrainers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // Filters & Search
  const [activeRoleFilter, setActiveRoleFilter] = useState<'All' | 'Trainer' | 'Employee' | 'Both'>('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTrainer, setEditingTrainer] = useState<any | null>(null);

  const fetchTrainers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/trainers');
      const data = await res.json();
      if (data.success) {
        setTrainers(data.trainers || []);
      }
    } catch (err) {
      console.error('Error loading trainers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrainers();
  }, []);

  const handleSyncWorkWithUs = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/trainers/sync', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || 'Synced candidates from Outlook Work With Us!');
        fetchTrainers();
        if (onRefreshParent) onRefreshParent();
      } else {
        toast.error(data.error || 'Failed to sync Work With Us folder');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error syncing Work With Us');
    } finally {
      setSyncing(false);
    }
  };

  const handleDeleteTrainer = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to remove ${name}?`)) return;
    try {
      const res = await fetch(`/api/trainers?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        toast.success(`Removed ${name} from registry`);
        fetchTrainers();
      } else {
        toast.error(data.error || 'Failed to remove trainer');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error deleting trainer');
    }
  };

  // Filtered trainers list
  const filteredTrainers = trainers.filter((t) => {
    const matchesRole =
      activeRoleFilter === 'All'
        ? true
        : activeRoleFilter === 'Trainer'
        ? t.role === 'Trainer' || t.role === 'Both'
        : activeRoleFilter === 'Employee'
        ? t.role === 'Employee' || t.role === 'Both'
        : t.role === 'Both';

    const matchesSearch =
      !searchQuery.trim() ||
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.email && t.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (t.primaryCourse && t.primaryCourse.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesRole && matchesSearch;
  });

  // Limit display to top 4 items on main landing page card
  const displayedTrainers = filteredTrainers.slice(0, 4);

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
      id="trainers-section"
      className="w-full rounded-3xl border border-border p-4 sm:p-6 shadow-2xl transition-all duration-300 space-y-4"
      style={{ background: 'var(--surface-1)' }}
    >
      {/* 1. Header Row */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shadow-md shadow-indigo-500/20">
            <Users size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-extrabold bg-gradient-to-r from-indigo-400 via-cyan-200 to-indigo-100 bg-clip-text text-transparent tracking-tight">
                Trainers & Operations
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[11px] font-bold border border-indigo-500/30">
                {trainers.length} Staff Registered
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Work With Us Outlook Intake • Trainer Assignment & Support Staff
            </p>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleSyncWorkWithUs}
            disabled={syncing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-950/60 hover:bg-indigo-900 text-indigo-300 border border-indigo-500/40 text-xs font-bold transition-all shadow-sm cursor-pointer disabled:opacity-50"
            title="Sync applications from Outlook Work With Us"
          >
            <RefreshCw size={12} className={syncing ? 'animate-spin text-indigo-400' : 'text-indigo-400'} />
            <span>{syncing ? 'Syncing...' : 'Sync'}</span>
          </button>

          <button
            onClick={() => {
              setEditingTrainer(null);
              setIsModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md shadow-indigo-600/30 cursor-pointer"
          >
            <Plus size={13} />
            <span>Add Staff</span>
          </button>

          <Link
            href="/trainers"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-border text-xs font-bold transition-all cursor-pointer"
            title="Open full page view with Donut Chart and all staff analytics"
          >
            <Maximize2 size={13} />
            <span>Intelligence Deck</span>
          </Link>
        </div>
      </div>

      {/* 2. Filters & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
        <div className="flex items-center p-0.5 rounded-xl bg-slate-900 border border-border text-xs font-bold overflow-x-auto">
          <button
            onClick={() => setActiveRoleFilter('All')}
            className={`px-3 py-1 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              activeRoleFilter === 'All' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setActiveRoleFilter('Trainer')}
            className={`px-3 py-1 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              activeRoleFilter === 'Trainer' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Trainers
          </button>
          <button
            onClick={() => setActiveRoleFilter('Employee')}
            className={`px-3 py-1 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              activeRoleFilter === 'Employee' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Job Support
          </button>
          <button
            onClick={() => setActiveRoleFilter('Both')}
            className={`px-3 py-1 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              activeRoleFilter === 'Both' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Dual Role
          </button>
        </div>

        <div className="relative flex-1 max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search candidate..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-border pl-8 pr-3 py-1 text-xs bg-slate-900 text-white outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* 3. Candidate List: Desktop Table (hidden on mobile) & Mobile Dropdown Cards (block on mobile) */}
      <div className="hidden md:block overflow-x-auto rounded-xl border border-border/80">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-slate-900/90 text-slate-400 border-b border-border/60">
              <th className="px-3 py-2 font-bold uppercase text-[10px]">Candidate / Staff</th>
              <th className="px-2.5 py-2 font-bold uppercase text-[10px]">Role</th>
              <th className="px-2.5 py-2 font-bold uppercase text-[10px]">Platform</th>
              <th className="px-2.5 py-2 font-bold uppercase text-[10px]">Batches / Support</th>
              <th className="px-2.5 py-2 font-bold uppercase text-[10px]">Status</th>
              <th className="px-2 py-2 text-center font-bold uppercase text-[10px]">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400 font-semibold">
                  Loading candidates...
                </td>
              </tr>
            ) : displayedTrainers.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400 font-semibold">
                  No staff entries found.
                </td>
              </tr>
            ) : (
              displayedTrainers.map((trainer) => (
                <tr key={trainer.id} className="hover:bg-slate-800/50 transition-colors">
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-indigo-500/20 text-indigo-300 font-bold flex items-center justify-center border border-indigo-500/30 text-xs shrink-0">
                        {trainer.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-bold text-white text-xs leading-tight">{trainer.name}</div>
                        <div className="text-[10px] text-slate-400 truncate max-w-[150px]">
                          {trainer.email || trainer.phone || 'Work With Us Candidate'}
                        </div>
                      </div>
                    </div>
                  </td>

                  <td className="px-2.5 py-2.5">{getRoleBadge(trainer.role)}</td>

                  <td className="px-2.5 py-2.5 font-semibold text-slate-200">{trainer.primaryCourse}</td>

                  <td className="px-2.5 py-2.5 font-mono text-[10.5px]">
                    <span className="text-indigo-300 font-bold">{trainer.totalBatches || 0} Batches</span>
                    <span className="text-slate-500 mx-1">•</span>
                    <span className="text-cyan-300 font-semibold">{trainer.jobSupportLeads || 0} Support</span>
                  </td>

                  <td className="px-2.5 py-2.5">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[9.5px] font-bold ${
                        trainer.status === 'Active'
                          ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/40'
                          : trainer.status === 'Onboarding'
                          ? 'bg-amber-950/60 text-amber-300 border border-amber-500/40'
                          : 'bg-slate-800 text-slate-300 border border-slate-700'
                      }`}
                    >
                      {trainer.status || 'Active'}
                    </span>
                  </td>

                  <td className="px-2 py-2.5 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => {
                          setEditingTrainer(trainer);
                          setIsModalOpen(true);
                        }}
                        className="p-1 rounded text-slate-400 hover:text-indigo-300 hover:bg-indigo-500/10 transition-colors cursor-pointer"
                        title="Edit details"
                      >
                        <Edit size={13} />
                      </button>
                      <button
                        onClick={() => handleDeleteTrainer(trainer.id, trainer.name)}
                        className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                        title="Delete candidate"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View with Expandable Dropdown (block on mobile only) */}
      <div className="block md:hidden space-y-2">
        {loading ? (
          <div className="p-4 text-center text-slate-400 text-xs font-semibold">Loading candidates...</div>
        ) : displayedTrainers.length === 0 ? (
          <div className="p-4 text-center text-slate-400 text-xs font-semibold">No staff entries found.</div>
        ) : (
          displayedTrainers.map((trainer) => (
            <MobileTrainerCard
              key={trainer.id}
              trainer={trainer}
              getRoleBadge={getRoleBadge}
              onEdit={() => {
                setEditingTrainer(trainer);
                setIsModalOpen(true);
              }}
              onDelete={() => handleDeleteTrainer(trainer.id, trainer.name)}
            />
          ))
        )}
      </div>

      {/* Footer Link to Dedicated Page */}
      <div className="flex items-center justify-between pt-1 text-xs">
        <span className="text-slate-400 text-[11px]">
          Showing 4 of {trainers.length} registered candidates
        </span>
        <Link
          href="/trainers"
          className="inline-flex items-center gap-1 font-bold text-indigo-400 hover:text-indigo-300 hover:underline transition-all"
        >
          <span>View Full Page & Analytics Graphs →</span>
        </Link>
      </div>

      {/* Trainer Edit / Add Modal */}
      <TrainerModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingTrainer(null);
        }}
        onRefresh={fetchTrainers}
        trainerToEdit={editingTrainer}
      />
    </div>
  );
}

function MobileTrainerCard({
  trainer,
  getRoleBadge,
  onEdit,
  onDelete,
}: {
  trainer: any;
  getRoleBadge: (role: string) => React.ReactNode;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-3 space-y-2.5 transition-all">
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
              className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white border border-slate-700/60 shrink-0 cursor-pointer"
              title={expanded ? 'Collapse details' : 'Expand details'}
            >
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>
        </div>

        {/* Line 2: Email Address (Cleanly aligned under candidate name) */}
        <div className="pl-10.5 pr-2">
          <p className="text-[10.5px] text-slate-400 truncate">
            {trainer.email || trainer.phone || 'Work With Us Candidate'}
          </p>
        </div>
      </div>

      {/* Expanded Dropdown Details Container */}
      {expanded && (
        <div className="pt-2.5 border-t border-slate-800 space-y-2 text-[11px] animate-fade-in">
          <div className="grid grid-cols-2 gap-2 text-slate-300">
            <div>
              <span className="text-[9.5px] uppercase font-bold text-slate-400 block">Platform</span>
              <span className="font-semibold text-white">{trainer.primaryCourse}</span>
            </div>
            <div>
              <span className="text-[9.5px] uppercase font-bold text-slate-400 block">Batches / Support</span>
              <span className="font-mono text-indigo-300 font-bold">{trainer.totalBatches || 0} B</span>
              <span className="text-slate-500 mx-1">•</span>
              <span className="font-mono text-cyan-300 font-bold">{trainer.jobSupportLeads || 0} JS</span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span
              className={`px-2 py-0.5 rounded text-[9.5px] font-bold ${
                trainer.status === 'Active'
                  ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/40'
                  : 'bg-slate-800 text-slate-300 border border-slate-700'
              }`}
            >
              {trainer.status || 'Active'}
            </span>

            <div className="flex items-center gap-2">
              <button
                onClick={onEdit}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-indigo-300 bg-indigo-950/70 border border-indigo-500/30 text-[10.5px] font-semibold"
              >
                <Edit size={12} /> Edit Details
              </button>
              <button
                onClick={onDelete}
                className="p-1 rounded-lg text-slate-400 hover:text-rose-400 bg-slate-800/80 border border-slate-700/50"
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
