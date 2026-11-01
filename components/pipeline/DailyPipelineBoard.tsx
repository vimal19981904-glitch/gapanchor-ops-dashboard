'use client';

import React, { useMemo, useState, useEffect } from 'react';
import {
  Globe,
  GripVertical,
  MoreVertical,
  CheckCircle2,
  XCircle,
  Volume2,
  Clock,
  MessageSquare,
  PhoneCall,
  Calendar,
  ArrowRight,
  Sparkles,
  Plus,
  Search,
  Filter,
  RotateCcw,
  X,
  Zap,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { jarvisAudioFx } from '../../lib/jarvis-audio-fx';
import { MobilePipelineRoller } from './MobilePipelineRoller';
import { useIsMobile } from '../../hooks/useIsMobile';
import { addOpsNotification } from '../../lib/notifications-store';

export interface PipelineEnquiry {
  id: string;
  leadCode?: string | null;
  participantName: string;
  email: string | null;
  phone: string;
  country: string | null;
  serviceType: string | null;
  trainingType: string | null;
  topic: string;
  lastMessage?: string | null;
  messageTimestamp: string;
  contactStatus: string;
  leadQuality: string;
  callScore?: number | null;
  assignedToName?: string | null;
  status?: string;
  manualStage?: StageKey;
  callFollowUpDate?: string | Date | null;
}

export interface DailyPipelineBoardProps {
  enquiries: PipelineEnquiry[];
  onSelectLead?: (enquiry: PipelineEnquiry) => void;
  onUpdateLeadStatus?: (
    enquiryId: string,
    updates: { contactStatus?: string; status?: string; leadQuality?: string }
  ) => Promise<void>;
  className?: string;
}

export type StageKey =
  | 'no_plan'
  | 'uncontacted'
  | 'aware'
  | 'evaluating'
  | 'negotiating'
  | 'committed'
  | 'lost';

export interface StageConfig {
  key: StageKey;
  label: string;
  dotColor: string;
  glowColor: string;
  headerTextColor: string;
  badgeBg: string;
  badgeColor: string;
}

export const STAGES: StageConfig[] = [
  {
    key: 'no_plan',
    label: 'No plan yet',
    dotColor: 'bg-slate-500',
    glowColor: 'shadow-slate-500/30',
    headerTextColor: 'text-slate-400',
    badgeBg: 'bg-slate-800/80',
    badgeColor: 'text-slate-400',
  },
  {
    key: 'uncontacted',
    label: 'Uncontacted',
    dotColor: 'bg-sky-400',
    glowColor: 'shadow-sky-400/40',
    headerTextColor: 'text-sky-300',
    badgeBg: 'bg-sky-500/10',
    badgeColor: 'text-sky-300',
  },
  {
    key: 'aware',
    label: 'Aware',
    dotColor: 'bg-blue-400',
    glowColor: 'shadow-blue-400/40',
    headerTextColor: 'text-blue-300',
    badgeBg: 'bg-blue-500/10',
    badgeColor: 'text-blue-300',
  },
  {
    key: 'evaluating',
    label: 'Evaluating',
    dotColor: 'bg-purple-400',
    glowColor: 'shadow-purple-400/40',
    headerTextColor: 'text-purple-300',
    badgeBg: 'bg-purple-500/10',
    badgeColor: 'text-purple-300',
  },
  {
    key: 'negotiating',
    label: 'Negotiating',
    dotColor: 'bg-amber-400',
    glowColor: 'shadow-amber-400/50',
    headerTextColor: 'text-amber-300',
    badgeBg: 'bg-amber-500/10',
    badgeColor: 'text-amber-300',
  },
  {
    key: 'committed',
    label: 'Committed',
    dotColor: 'bg-emerald-400',
    glowColor: 'shadow-emerald-400/40',
    headerTextColor: 'text-emerald-300',
    badgeBg: 'bg-emerald-500/10',
    badgeColor: 'text-emerald-300',
  },
  {
    key: 'lost',
    label: 'Lost',
    dotColor: 'bg-rose-400',
    glowColor: 'shadow-rose-400/40',
    headerTextColor: 'text-rose-300',
    badgeBg: 'bg-rose-500/10',
    badgeColor: 'text-rose-300',
  },
];

/**
 * Maps an enquiry to one of the 7 pipeline stages with full 2-way CRM synchronization
 */
export function mapEnquiryToStage(lead: PipelineEnquiry): StageKey {
  const cStatus = (lead.contactStatus || '').trim().toLowerCase();
  const sStatus = (lead.status || '').trim().toLowerCase();

  // 1. Lost
  if (cStatus === 'lost' || sStatus === 'lost' || cStatus === 'not interested') return 'lost';

  // 2. Committed / Converted
  if (
    cStatus === 'converted' ||
    sStatus === 'committed' ||
    (sStatus === 'resolved' && cStatus === 'converted')
  ) {
    return 'committed';
  }

  // 3. Negotiating vs Evaluating (under Talked)
  if (sStatus === 'negotiating') return 'negotiating';
  if (sStatus === 'evaluating') return 'evaluating';

  if (cStatus === 'talked') {
    if (lead.callScore && lead.callScore >= 7) {
      return 'negotiating';
    }
    return 'evaluating';
  }

  // 4. Aware (In Touch)
  if (cStatus === 'in touch') return 'aware';
  if (cStatus === 'future') return 'evaluating';

  // 5. Uncontacted vs No Plan (Pending)
  if (cStatus === 'pending' || !cStatus) {
    if (sStatus === 'no_plan') return 'no_plan';
    if (lead.email || lead.lastMessage) {
      return 'uncontacted';
    }
    return 'no_plan';
  }

  if (lead.manualStage) return lead.manualStage;

  return 'no_plan';
}

/**
 * Returns database status updates corresponding to a target pipeline stage.
 * When moved to 'committed', contactStatus is strictly 'Converted'.
 */
export function getStageUpdates(newStage: StageKey): { contactStatus: string; status: string } {
  switch (newStage) {
    case 'no_plan':
      return { contactStatus: 'Pending', status: 'no_plan' };
    case 'uncontacted':
      return { contactStatus: 'Pending', status: 'Open' };
    case 'aware':
      return { contactStatus: 'In Touch', status: 'Active' };
    case 'evaluating':
      return { contactStatus: 'Talked', status: 'evaluating' };
    case 'negotiating':
      return { contactStatus: 'Talked', status: 'negotiating' };
    case 'committed':
      return { contactStatus: 'Converted', status: 'Resolved' };
    case 'lost':
      return { contactStatus: 'Lost', status: 'Resolved' };
  }
}

/**
 * Status badge info on cards
 */
export function getCardStatusBadge(lead: PipelineEnquiry, stage: StageKey) {
  if (stage === 'lost') {
    return {
      text: 'Archived / Lost',
      className: 'bg-rose-500/10 text-rose-300 border-rose-500/30',
      dotColor: 'bg-rose-400',
    };
  }

  if (stage === 'committed') {
    return {
      text: 'Converted & Enrolled',
      className: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
      dotColor: 'bg-emerald-400',
    };
  }

  if (stage === 'negotiating') {
    return {
      text: 'Schedule & Fee Review',
      className: 'bg-amber-500/10 text-amber-300 border-amber-500/40',
      dotColor: 'bg-amber-400',
    };
  }

  if (stage === 'evaluating') {
    return {
      text: 'Curriculum Review',
      className: 'bg-purple-500/10 text-purple-300 border-purple-500/30',
      dotColor: 'bg-purple-400',
    };
  }

  if (stage === 'aware') {
    return {
      text: 'In Active Dialogue',
      className: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
      dotColor: 'bg-blue-400',
    };
  }

  if (stage === 'uncontacted') {
    return {
      text: 'Modules Email Sent (Flow)',
      className: 'bg-sky-500/10 text-sky-300 border-sky-500/30',
      dotColor: 'bg-sky-400',
    };
  }

  return {
    text: 'Awaiting Action Plan',
    className: 'bg-slate-800/80 text-slate-400 border-slate-700/80',
    dotColor: 'bg-slate-500',
  };
}

export type PipelineViewFilter = 'all' | 'top10' | 'due' | 'priority' | 'pushed';

export function DailyPipelineBoard({
  enquiries,
  onSelectLead,
  onUpdateLeadStatus,
  className = '',
}: DailyPipelineBoardProps) {
  // Local state for optimistic updates
  const [localEnquiries, setLocalEnquiries] = useState<PipelineEnquiry[]>(enquiries || []);
  const [draggingLeadId, setDraggingLeadId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<StageKey | null>(null);
  const [activeMenuLeadId, setActiveMenuLeadId] = useState<string | null>(null);

  // Dynamic Pipeline Capacity & Filters
  const [viewFilter, setViewFilter] = useState<PipelineViewFilter>('all');
  const [pushedLeadIds, setPushedLeadIds] = useState<string[]>([]);
  const [removedLeadIds, setRemovedLeadIds] = useState<string[]>([]);
  const [newlyPushedIds, setNewlyPushedIds] = useState<Set<string>>(new Set());
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [leadSearchTerm, setLeadSearchTerm] = useState('');

  // Mobile Pipeline Specific State
  const [activeMobileStage, setActiveMobileStage] = useState<StageKey>('evaluating');
  const isMobile = useIsMobile(768);

  // Sync when parent enquiries prop changes (real-time reflection of table changes)
  useEffect(() => {
    if (enquiries) {
      setLocalEnquiries(enquiries);
    }
  }, [enquiries]);

  // Load saved pushed and removed lead IDs from localStorage
  useEffect(() => {
    try {
      const savedPushed = localStorage.getItem('gapanchor_pushed_pipeline_ids');
      if (savedPushed) {
        const parsed = JSON.parse(savedPushed);
        if (Array.isArray(parsed)) setPushedLeadIds(parsed);
      }
      const savedRemoved = localStorage.getItem('gapanchor_removed_pipeline_ids');
      if (savedRemoved) {
        const parsed = JSON.parse(savedRemoved);
        if (Array.isArray(parsed)) setRemovedLeadIds(parsed);
      }
    } catch {}
  }, []);

  // Listen for J.A.R.V.I.S. voice pipeline action events (push and remove)
  useEffect(() => {
    const handlePipelineAction = (e: any) => {
      const detail = e.detail;
      if (!detail) return;
      const { type, leadIds = [], removeLeadIds = [], targetStage, summary } = detail;

      // ─── 1. Removal Actions (Remove Lost / Remove Lead) ───
      if (type === 'remove_lost' || type === 'remove_lead' || (Array.isArray(removeLeadIds) && removeLeadIds.length > 0)) {
        const idsToRemove = Array.isArray(removeLeadIds) && removeLeadIds.length > 0 ? removeLeadIds : leadIds;
        if (idsToRemove.length > 0) {
          setRemovedLeadIds((prev) => {
            const next = Array.from(new Set([...idsToRemove, ...prev]));
            try {
              localStorage.setItem('gapanchor_removed_pipeline_ids', JSON.stringify(next));
            } catch {}
            return next;
          });

          setPushedLeadIds((prev) => {
            const next = prev.filter((id) => !idsToRemove.includes(id));
            try {
              localStorage.setItem('gapanchor_pushed_pipeline_ids', JSON.stringify(next));
            } catch {}
            return next;
          });

          try {
            jarvisAudioFx.playSuccessChime();
          } catch {}

          toast.success(
            <span>
              <strong>J.A.R.V.I.S.:</strong> {summary || `Removed ${idsToRemove.length} prospect(s) from pipeline board`}
            </span>,
            { duration: 4000 }
          );
          return;
        }
      }

      // ─── 2. Add / Push Actions ───
      if (Array.isArray(leadIds) && leadIds.length > 0) {
        // Un-hide if previously removed
        setRemovedLeadIds((prev) => {
          const next = prev.filter((id) => !leadIds.includes(id));
          try {
            localStorage.setItem('gapanchor_removed_pipeline_ids', JSON.stringify(next));
          } catch {}
          return next;
        });

        setPushedLeadIds((prev) => {
          const next = Array.from(new Set([...leadIds, ...prev]));
          try {
            localStorage.setItem('gapanchor_pushed_pipeline_ids', JSON.stringify(next));
          } catch {}
          return next;
        });

        // Optimistically update stages for pushed leads if targetStage specified
        if (targetStage) {
          const updates = getStageUpdates(targetStage);
          setLocalEnquiries((prev) =>
            prev.map((item) =>
              leadIds.includes(item.id)
                ? {
                    ...item,
                    contactStatus: updates.contactStatus,
                    status: updates.status,
                    manualStage: targetStage,
                  }
                : item
            )
          );
        }

        setNewlyPushedIds(new Set(leadIds));
        setTimeout(() => setNewlyPushedIds(new Set()), 6000);
        setViewFilter('all');

        try {
          jarvisAudioFx.playSuccessChime();
        } catch {}

        toast.success(
          <span>
            <strong>J.A.R.V.I.S.:</strong> {summary || `Staged ${leadIds.length} prospects on the board`}
          </span>,
          { duration: 4000 }
        );

        // Smoothly scroll to the pipeline board
        const boardEl = document.getElementById('pipeline-workflow-section');
        if (boardEl) {
          boardEl.scrollIntoView({ behavior: 'smooth' });
        }
      }
    };

    window.addEventListener('gapanchor:pipeline-action', handlePipelineAction);
    return () => window.removeEventListener('gapanchor:pipeline-action', handlePipelineAction);
  }, []);

  // Close menus when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.card-context-menu-container')) {
        setActiveMenuLeadId(null);
      }
    };
    window.addEventListener('mousedown', handleOutsideClick);
    return () => window.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Compute active pipeline leads dynamically, excluding removedLeadIds
  const displayedLeads = useMemo(() => {
    const removedSet = new Set(removedLeadIds);
    const sorted = [...localEnquiries]
      .filter((l) => !removedSet.has(l.id))
      .sort((a, b) => {
        const timeA = new Date(a.messageTimestamp || 0).getTime();
        const timeB = new Date(b.messageTimestamp || 0).getTime();
        return timeB - timeA;
      });

    const top10 = sorted.slice(0, 10);
    const pushedSet = new Set(pushedLeadIds);

    if (viewFilter === 'top10') {
      return top10;
    }

    if (viewFilter === 'due') {
      const now = new Date();
      return sorted.filter((l) => {
        if (!l.callFollowUpDate) return false;
        return new Date(l.callFollowUpDate) <= now;
      });
    }

    if (viewFilter === 'priority') {
      return sorted.filter(
        (l) =>
          (l.callScore && l.callScore >= 7) ||
          l.leadQuality === 'High' ||
          ['negotiating', 'evaluating'].includes(l.status || '')
      );
    }

    if (viewFilter === 'pushed') {
      return sorted.filter((l) => pushedSet.has(l.id));
    }

    // Default 'all': Combines Top 10 + all Jarvis pushed leads + any currently evaluating/negotiating/committed leads
    const activePipelineSet = new Set<string>();
    top10.forEach((l) => activePipelineSet.add(l.id));
    pushedLeadIds.forEach((id) => {
      if (!removedSet.has(id)) activePipelineSet.add(id);
    });
    sorted.forEach((l) => {
      if (['negotiating', 'evaluating', 'committed'].includes(l.status || '')) {
        activePipelineSet.add(l.id);
      }
    });

    return sorted.filter((l) => activePipelineSet.has(l.id));
  }, [localEnquiries, pushedLeadIds, removedLeadIds, viewFilter]);

  // Group displayed leads into the 7 stages
  const groupedLeads = useMemo(() => {
    const map: Record<StageKey, PipelineEnquiry[]> = {
      no_plan: [],
      uncontacted: [],
      aware: [],
      evaluating: [],
      negotiating: [],
      committed: [],
      lost: [],
    };

    displayedLeads.forEach((lead) => {
      const stage = mapEnquiryToStage(lead);
      map[stage].push(lead);
    });

    return map;
  }, [displayedLeads]);

  /**
   * Core workflow action: moves lead to target stage & persists to database,
   * keeping the Leads table and CRM state 100% interconnected.
   */
  const handleMoveLead = async (leadId: string, newStage: StageKey) => {
    const currentLead = localEnquiries.find((e) => e.id === leadId);
    if (!currentLead) return;

    const currentStage = mapEnquiryToStage(currentLead);
    if (currentStage === newStage) return;

    const updates = getStageUpdates(newStage);

    // Optimistic UI state update
    setLocalEnquiries((prev) =>
      prev.map((item) =>
        item.id === leadId
          ? {
              ...item,
              contactStatus: updates.contactStatus,
              status: updates.status,
              manualStage: newStage,
            }
          : item
      )
    );

    // Ensure lead is retained in pushedLeadIds if moved
    setPushedLeadIds((prev) => {
      if (!prev.includes(leadId)) {
        const next = [leadId, ...prev];
        try {
          localStorage.setItem('gapanchor_pushed_pipeline_ids', JSON.stringify(next));
        } catch {}
        return next;
      }
      return prev;
    });

    // Un-hide from removed list
    setRemovedLeadIds((prev) => {
      if (prev.includes(leadId)) {
        const next = prev.filter((id) => id !== leadId);
        try {
          localStorage.setItem('gapanchor_removed_pipeline_ids', JSON.stringify(next));
        } catch {}
        return next;
      }
      return prev;
    });

    try {
      jarvisAudioFx.playSuccessChime();
    } catch {}

    const targetConfig = STAGES.find((s) => s.key === newStage);
    addOpsNotification({
      title: `Moved ${currentLead.participantName}`,
      description: `Prospect moved to ${targetConfig?.label || newStage}${newStage === 'committed' ? ' (Converted)' : ''}`,
      category: 'pipeline',
    });

    toast.success(
      <span>
        Moved <strong>{currentLead.participantName}</strong> to{' '}
        <span className="font-bold text-cyan-300">{targetConfig?.label || newStage}</span>
        {newStage === 'committed' && (
          <span className="text-emerald-400 font-bold ml-1">(Converted)</span>
        )}
      </span>,
      { duration: 2500 }
    );

    if (onUpdateLeadStatus) {
      try {
        await onUpdateLeadStatus(leadId, updates);
      } catch (err: any) {
        console.error('Failed to update lead status via parent handler:', err);
      }
    } else {
      try {
        const res = await fetch('/api/enquiries/sync-excel', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            enquiryId: leadId,
            contactStatus: updates.contactStatus,
            status: updates.status,
          }),
        });
        const json = await res.json();
        if (!json.success) {
          throw new Error(json.error || 'Failed to update database');
        }
      } catch (err: any) {
        setLocalEnquiries((prev) =>
          prev.map((item) => (item.id === leadId ? currentLead : item))
        );
        try {
          jarvisAudioFx.playErrorBuzz();
        } catch {}
        toast.error(`Could not move lead: ${err.message || 'Network error'}`);
        return;
      }
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('gapanchor:lead-updated', {
          detail: { enquiryId: leadId, ...updates },
        })
      );
    }
  };

  /**
   * Manually removes a lead from the active pipeline board without deleting it from the DB.
   */
  const handleRemoveFromPipeline = (leadId: string) => {
    const currentLead = localEnquiries.find((e) => e.id === leadId);
    setRemovedLeadIds((prev) => {
      const next = Array.from(new Set([leadId, ...prev]));
      try {
        localStorage.setItem('gapanchor_removed_pipeline_ids', JSON.stringify(next));
      } catch {}
      return next;
    });

    setPushedLeadIds((prev) => {
      const next = prev.filter((id) => id !== leadId);
      try {
        localStorage.setItem('gapanchor_pushed_pipeline_ids', JSON.stringify(next));
      } catch {}
      return next;
    });

    addOpsNotification({
      title: 'Removed from Board',
      description: `${currentLead?.participantName || 'Prospect'} removed from active pipeline view`,
      category: 'pipeline',
    });

    try {
      jarvisAudioFx.playSuccessChime();
    } catch {}

    toast.info(
      <span>
        Removed <strong>{currentLead?.participantName || 'Prospect'}</strong> from pipeline board. (Data preserved in CRM)
      </span>,
      { duration: 3000 }
    );
  };

  /**
   * Clears all leads currently in the Lost column from the pipeline board.
   */
  const handleClearAllLostLeads = () => {
    const lostLeads = displayedLeads.filter((l) => mapEnquiryToStage(l) === 'lost');
    const lostIds = lostLeads.map((l) => l.id);
    if (lostIds.length === 0) {
      toast.info('No lost leads currently on the board.');
      return;
    }

    setRemovedLeadIds((prev) => {
      const next = Array.from(new Set([...lostIds, ...prev]));
      try {
        localStorage.setItem('gapanchor_removed_pipeline_ids', JSON.stringify(next));
      } catch {}
      return next;
    });

    setPushedLeadIds((prev) => {
      const next = prev.filter((id) => !lostIds.includes(id));
      try {
        localStorage.setItem('gapanchor_pushed_pipeline_ids', JSON.stringify(next));
      } catch {}
      return next;
    });

    addOpsNotification({
      title: 'Cleared Lost Leads',
      description: `Removed ${lostIds.length} lost prospect(s) from pipeline board`,
      category: 'pipeline',
    });

    try {
      jarvisAudioFx.playSuccessChime();
    } catch {}

    toast.success(`Removed ${lostIds.length} lost prospect(s) from pipeline board.`);
  };

  const handleManualAddLeadToStage = async (lead: PipelineEnquiry, targetStage: StageKey = 'evaluating') => {
    setPushedLeadIds((prev) => {
      const next = Array.from(new Set([lead.id, ...prev]));
      try {
        localStorage.setItem('gapanchor_pushed_pipeline_ids', JSON.stringify(next));
      } catch {}
      return next;
    });

    setRemovedLeadIds((prev) => {
      const next = prev.filter((id) => id !== lead.id);
      try {
        localStorage.setItem('gapanchor_removed_pipeline_ids', JSON.stringify(next));
      } catch {}
      return next;
    });

    await handleMoveLead(lead.id, targetStage);
    setSearchModalOpen(false);
    setLeadSearchTerm('');
  };

  const handleResetBoard = () => {
    setPushedLeadIds([]);
    setRemovedLeadIds([]);
    try {
      localStorage.removeItem('gapanchor_pushed_pipeline_ids');
      localStorage.removeItem('gapanchor_removed_pipeline_ids');
    } catch {}
    setViewFilter('top10');
    toast.info('Pipeline reset to top 10 recent prospects.');
  };

  const filteredSearchLeads = useMemo(() => {
    if (!leadSearchTerm.trim()) return localEnquiries.slice(0, 15);
    const q = leadSearchTerm.toLowerCase();
    return localEnquiries
      .filter((l) => {
        const hay = `${l.participantName} ${l.leadCode || ''} ${l.phone} ${l.trainingType || ''} ${l.topic || ''}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 20);
  }, [localEnquiries, leadSearchTerm]);

  return (
    <div id="pipeline-workflow-section" className={`mt-8 space-y-4 ${className}`}>
      {/* ── DESKTOP & TABLET VIEW (>= md): 100% UNTOUCHED ── */}
      <div className="hidden md:block space-y-4">
        {/* ── Top Header Bar ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap px-1">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-base font-extrabold text-white tracking-tight">
              Pipeline
            </h2>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/25">
              Interactive Workflow
            </span>
            {pushedLeadIds.length > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30">
                <Sparkles className="w-2.5 h-2.5 text-purple-400" />
                {pushedLeadIds.length} Pushed by J.A.R.V.I.S.
              </span>
            )}
            {removedLeadIds.length > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                {removedLeadIds.length} Hidden
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {displayedLeads.length} prospects active on this board (say &quot;Remove [Key]&quot; or &quot;Remove lost&quot; to J.A.R.V.I.S.)
          </p>
        </div>

        {/* View Mode Filters & Quick Actions */}
        <div className="flex items-center gap-2 flex-wrap text-xs">


          {/* Add Prospect Button */}
          <button
            type="button"
            onClick={() => setSearchModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500/20 to-blue-500/20 hover:from-cyan-500/30 hover:to-blue-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-bold transition-all shadow-sm active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Prospect</span>
          </button>

          {/* Reset Board Button */}
          {(pushedLeadIds.length > 0 || removedLeadIds.length > 0) && (
            <button
              type="button"
              onClick={handleResetBoard}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
              title="Reset Board to Default Top 10"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}

          <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 text-[11px] font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Live Drag & Drop
          </span>
        </div>
      </div>

      {/* ── 7-Column Open Workflow Board ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3.5 overflow-x-auto pb-4 pt-1">
        {STAGES.map((stage) => {
          const leadsInStage = groupedLeads[stage.key] || [];
          const isOverThis = dragOverStage === stage.key;

          return (
            <div key={stage.key} className="flex flex-col min-w-[210px] flex-1">
              {/* Stage Heading */}
              <div className="flex items-center gap-2 px-1 pb-2.5 mb-1.5 select-none">
                <span
                  className={`w-2 h-2 rounded-full ${stage.dotColor} ${stage.glowColor} shadow-sm shrink-0`}
                />
                <span className="text-xs font-semibold text-slate-200 tracking-tight">
                  {stage.label}
                </span>
                <span className="text-xs text-slate-500 font-normal ml-0.5">
                  {leadsInStage.length}
                </span>

                {/* Clear Lost Quick Button in Lost column */}
                {stage.key === 'lost' && leadsInStage.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearAllLostLeads}
                    className="ml-auto flex items-center gap-1 text-[10px] font-bold text-rose-400 hover:text-rose-300 px-1.5 py-0.5 rounded bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 transition-colors"
                    title="Remove all lost prospects from active board"
                  >
                    <X className="w-2.5 h-2.5" />
                    Clear
                  </button>
                )}
              </div>

              {/* Open Drop Lane */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (dragOverStage !== stage.key) {
                    setDragOverStage(stage.key);
                  }
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    if (dragOverStage === stage.key) {
                      setDragOverStage(null);
                    }
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const droppedId = e.dataTransfer.getData('text/plain') || draggingLeadId;
                  setDraggingLeadId(null);
                  setDragOverStage(null);
                  if (droppedId) {
                    handleMoveLead(droppedId, stage.key);
                  }
                }}
                className={`space-y-3 flex-1 min-h-[440px] p-1.5 rounded-2xl transition-all duration-200 ${
                  isOverThis
                    ? 'bg-cyan-500/[0.04] ring-2 ring-dashed ring-cyan-400/60 shadow-lg shadow-cyan-500/10'
                    : 'bg-transparent'
                }`}
              >
                {/* Visual Drop Target */}
                {isOverThis && (
                  <div className="p-3 border-2 border-dashed border-cyan-400/60 bg-cyan-500/10 rounded-xl text-center flex items-center justify-center gap-2 text-cyan-300 text-xs font-bold animate-pulse">
                    <ArrowRight className="w-3.5 h-3.5" />
                    <span>Drop in {stage.label}</span>
                  </div>
                )}

                {/* Empty State */}
                {leadsInStage.length === 0 && !isOverThis && (
                  <div className="h-32 flex items-center justify-center border border-dashed border-slate-800/60 rounded-xl text-center px-4">
                    <span className="text-[11px] text-slate-600 font-medium">
                      No prospects
                    </span>
                  </div>
                )}

                {/* ── Draggable Cards ── */}
                {leadsInStage.map((lead) => {
                  const badge = getCardStatusBadge(lead, stage.key);
                  const isBeingDragged = draggingLeadId === lead.id;
                  const isMenuOpen = activeMenuLeadId === lead.id;
                  const isNewlyPushed = newlyPushedIds.has(lead.id);

                  return (
                    <div
                      key={lead.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', lead.id);
                        e.dataTransfer.effectAllowed = 'move';
                        setDraggingLeadId(lead.id);
                        try {
                          jarvisAudioFx.playWakeTone();
                        } catch {}
                      }}
                      onDragEnd={() => {
                        setDraggingLeadId(null);
                        setDragOverStage(null);
                      }}
                      onClick={() => onSelectLead && onSelectLead(lead)}
                      className={`group relative p-3.5 rounded-xl transition-all duration-200 cursor-grab active:cursor-grabbing select-none shadow-md flex flex-col justify-between min-h-[124px] ${
                        isBeingDragged
                          ? 'opacity-40 scale-[0.97] ring-2 ring-cyan-400 shadow-2xl shadow-cyan-500/30 -rotate-1 bg-slate-900 border-cyan-500/50'
                          : isNewlyPushed
                          ? 'bg-slate-900/95 ring-2 ring-cyan-400 shadow-xl shadow-cyan-500/20 border-cyan-400/70 animate-pulse'
                          : 'bg-slate-900/60 border border-slate-800/80 hover:border-slate-700/80 hover:shadow-xl hover:bg-slate-900/90'
                      }`}
                    >
                      {/* Top Header & Details Section */}
                      <div>
                        {/* Top Row: Grip Handle, Name, Primary Key Badge & 3-Dots Menu */}
                        <div className="flex items-start justify-between gap-1.5">
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            <GripVertical className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400 shrink-0 cursor-grab" />
                            <h4 className="text-[13px] font-bold text-white group-hover:text-cyan-200 transition-colors truncate">
                              {lead.participantName}
                            </h4>
                            {/* Sequential Primary Key Badge */}
                            <span
                              className="font-mono text-[9.5px] font-bold px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/25 shrink-0 tracking-wider"
                              title={`Primary Key: ${lead.leadCode || `#${lead.id.slice(-6)}`}`}
                            >
                              {lead.leadCode || `#${lead.id.slice(-6)}`}
                            </span>
                          </div>

                          {/* 3-Dots Context Menu Container */}
                          <div className="relative card-context-menu-container shrink-0">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenuLeadId(isMenuOpen ? null : lead.id);
                              }}
                              className="p-1 rounded-md text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                              title="Quick Actions & Move Stage"
                            >
                              <MoreVertical className="w-3.5 h-3.5" />
                            </button>

                            {/* Context Dropdown Popover */}
                            {isMenuOpen && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className="absolute right-0 mt-1 w-52 bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-xl shadow-2xl z-50 p-1.5 space-y-1 animate-[fadeIn_0.15s_ease]"
                              >
                                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800 flex justify-between items-center">
                                  <span>Move to Stage</span>
                                  <span className="text-[9px] font-mono text-cyan-400">{lead.leadCode}</span>
                                </div>
                                {STAGES.map((s) => {
                                  const isCurrent = stage.key === s.key;
                                  return (
                                    <button
                                      key={s.key}
                                      type="button"
                                      onClick={() => {
                                        setActiveMenuLeadId(null);
                                        handleMoveLead(lead.id, s.key);
                                      }}
                                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors text-left ${
                                        isCurrent
                                          ? 'bg-slate-800 text-cyan-300 font-semibold cursor-default'
                                          : 'text-slate-300 hover:bg-slate-800/70 hover:text-white cursor-pointer'
                                      }`}
                                    >
                                      <div className="flex items-center gap-2">
                                        <span className={`w-1.5 h-1.5 rounded-full ${s.dotColor}`} />
                                        <span>{s.label}</span>
                                      </div>
                                      {isCurrent && (
                                        <span className="text-[10px] text-cyan-400 font-bold">
                                          Current
                                        </span>
                                      )}
                                    </button>
                                  );
                                })}

                                {/* Manual Removal from Board */}
                                <div className="pt-1 mt-1 border-t border-slate-800">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveMenuLeadId(null);
                                      handleRemoveFromPipeline(lead.id);
                                    }}
                                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-colors text-left"
                                  >
                                    <XCircle className="w-3.5 h-3.5 shrink-0" />
                                    <span>Remove from Board</span>
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Course / Role Details */}
                        <div className="mt-1.5 space-y-0.5 text-xs">
                          <p className="font-medium text-slate-300 truncate">
                            {lead.trainingType || lead.topic || 'Enterprise Training'}
                          </p>
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 truncate">
                            <Globe className="w-3 h-3 text-slate-500 shrink-0" />
                            <span>{lead.country || 'Global'}</span>
                            <span>•</span>
                            <span className="truncate">{lead.serviceType || 'Training'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Bottom Status Pill */}
                      <div className="mt-2.5 pt-2 border-t border-slate-800/60">
                        <div
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold border ${badge.className} w-full truncate`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${badge.dotColor} shrink-0`} />
                          <span className="truncate">{badge.text}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      </div>

      {/* ── MOBILE PIPELINE VIEW (< md / phone width): INTERACTIVE TABBED & DRAGGABLE WORKFLOW ── */}
      <div className="md:hidden space-y-3 px-1">
        {/* 1. Mobile Header Row */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-extrabold text-white tracking-tight">Pipeline</h2>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              {displayedLeads.length} active{pushedLeadIds.length > 0 ? ` · ${pushedLeadIds.length} pushed by JARVIS` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setLocalEnquiries(enquiries || []);
                toast.info('Pipeline refreshed');
                try {
                  jarvisAudioFx.playWakeTone();
                } catch {}
              }}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white active:scale-95 transition-all cursor-pointer"
              title="Refresh Pipeline"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setSearchModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-bold flex items-center gap-1 shadow-sm active:scale-95 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Add</span>
            </button>
          </div>
        </div>

        {/* 2. Mobile Filter Chips: All / Top 10 / High Priority / Callbacks */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-1">
          {[
            { id: 'all', label: 'All' },
            { id: 'top10', label: 'Top 10' },
            { id: 'priority', label: 'High Priority' },
            { id: 'due', label: 'Callbacks' },
          ].map((f) => {
            const isActive = viewFilter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setViewFilter(f.id as PipelineViewFilter)}
                className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/50 shadow-sm'
                    : 'bg-slate-900/80 text-slate-400 border border-slate-800 hover:text-slate-200'
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        {/* 3. Horizontal Stages Tab Bar */}
        <div className="flex items-center gap-4 overflow-x-auto scrollbar-none border-b border-slate-800/80 pb-2">
          {STAGES.map((stage) => {
            const count = (groupedLeads[stage.key] || []).length;
            const isActive = activeMobileStage === stage.key;
            const shortLabel = stage.key === 'no_plan' ? 'No plan' : stage.label;

            return (
              <button
                key={stage.key}
                type="button"
                onClick={() => {
                  setActiveMobileStage(stage.key);
                  try {
                    jarvisAudioFx.playWakeTone();
                  } catch {}
                }}
                className={`relative pb-2 flex items-center gap-1.5 whitespace-nowrap text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  isActive ? 'text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${stage.dotColor} ${stage.glowColor} shrink-0`}
                />
                <span>{shortLabel}</span>
                <span
                  className={`text-[11px] ${
                    isActive ? 'text-cyan-400 font-extrabold' : 'text-slate-500 font-normal'
                  }`}
                >
                  {count}
                </span>
                {isActive && (
                  <span
                    className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full transition-all bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]"
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* 4. Active Stage Leads List with 3D Rolling Pipeline Touch Drag & Drop */}
        {isMobile && (
          <MobilePipelineRoller
            leads={groupedLeads[activeMobileStage] || []}
            allGroupedLeads={groupedLeads}
            stages={STAGES}
            activeStage={activeMobileStage}
            onSelectStage={setActiveMobileStage}
            onMoveLead={handleMoveLead}
            onSelectLead={onSelectLead}
            activeMenuLeadId={activeMenuLeadId}
            onToggleMenu={setActiveMenuLeadId}
            pushedLeadIds={pushedLeadIds}
          />
        )}
      </div>

      {/* ── Search & Add Prospect Modal ── */}
      {searchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl p-5 space-y-4 animate-[fadeInUp_0.15s_ease]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white">Add Prospect to Pipeline</h3>
              </div>
              <button
                type="button"
                onClick={() => setSearchModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={leadSearchTerm}
                onChange={(e) => setLeadSearchTerm(e.target.value)}
                placeholder="Search by candidate name, primary key (e.g. GAMA-0355), phone..."
                autoFocus
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              />
            </div>

            {/* Results List */}
            <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
              {filteredSearchLeads.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  No matching candidates found.
                </div>
              ) : (
                filteredSearchLeads.map((lead) => (
                  <div
                    key={lead.id}
                    className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 flex items-center justify-between gap-3 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white truncate">{lead.participantName}</span>
                        <span className="font-mono text-[9px] font-bold px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/25">
                          {lead.leadCode || `#${lead.id.slice(-6)}`}
                        </span>
                        {lead.callScore && (
                          <span className="text-[10px] font-bold text-cyan-400">★ {lead.callScore}/10</span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 truncate">
                        {lead.trainingType || lead.topic || 'Training'} • {lead.phone}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleManualAddLeadToStage(lead, 'evaluating')}
                        className="px-2.5 py-1 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[11px] font-semibold hover:bg-purple-500/30 transition-colors"
                      >
                        + Evaluating
                      </button>
                      <button
                        type="button"
                        onClick={() => handleManualAddLeadToStage(lead, 'negotiating')}
                        className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[11px] font-semibold hover:bg-amber-500/30 transition-colors"
                      >
                        + Negotiating
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DailyPipelineBoard;
