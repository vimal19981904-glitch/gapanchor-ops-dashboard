'use client';

import React, { useState, useRef, useCallback } from 'react';
import {
  StageConfig,
  StageKey,
  PipelineEnquiry,
  mapEnquiryToStage,
  getCardStatusBadge,
} from './DailyPipelineBoard';
import {
  MoreVertical,
  ChevronRight,
  ChevronLeft,
  ArrowRight,
  ArrowLeft,
  Undo2,
  Sparkles,
  Check,
  Star,
} from 'lucide-react';
import { toast } from 'sonner';
import { jarvisAudioFx } from '../../lib/jarvis-audio-fx';
import { addOpsNotification } from '../../lib/notifications-store';

// ─── Stage Ordering & Navigation Helpers ─────────────────────────────────────
export const STAGE_ORDER: StageKey[] = [
  'no_plan',
  'uncontacted',
  'aware',
  'evaluating',
  'negotiating',
  'committed',
  'lost',
];

export function getAdjacentStages(currentStage: StageKey, stages: StageConfig[]) {
  const currentIndex = STAGE_ORDER.indexOf(currentStage);

  // Previous stage (left)
  let prevKey: StageKey;
  if (currentIndex <= 0) {
    prevKey = 'lost';
  } else {
    prevKey = STAGE_ORDER[currentIndex - 1];
  }

  // Next stage (right)
  let nextKey: StageKey;
  if (currentIndex >= STAGE_ORDER.length - 1) {
    nextKey = 'evaluating'; // Reactivate / loop
  } else if (currentIndex === STAGE_ORDER.length - 2) {
    nextKey = 'lost';
  } else {
    nextKey = STAGE_ORDER[currentIndex + 1];
  }

  const prevStage = stages.find((s) => s.key === prevKey) || stages[0];
  const nextStage = stages.find((s) => s.key === nextKey) || stages[stages.length - 1];

  return { prevStage, nextStage };
}

// ─── Stage Accent Themes ─────────────────────────────────────────────────────
export const STAGE_THEME: Record<
  StageKey,
  {
    border: string;
    bg: string;
    glow: string;
    text: string;
    pillBg: string;
    pillText: string;
  }
> = {
  no_plan: {
    border: 'border-slate-500/50',
    bg: 'bg-slate-900/90',
    glow: 'rgba(148,163,184,0.4)',
    text: 'text-slate-300',
    pillBg: 'bg-slate-800',
    pillText: 'text-slate-300',
  },
  uncontacted: {
    border: 'border-sky-500/50',
    bg: 'bg-slate-900/90',
    glow: 'rgba(56,189,248,0.5)',
    text: 'text-sky-300',
    pillBg: 'bg-sky-500/20',
    pillText: 'text-sky-300',
  },
  aware: {
    border: 'border-blue-500/50',
    bg: 'bg-slate-900/90',
    glow: 'rgba(96,165,250,0.5)',
    text: 'text-blue-300',
    pillBg: 'bg-blue-500/20',
    pillText: 'text-blue-300',
  },
  evaluating: {
    border: 'border-purple-500/50',
    bg: 'bg-slate-900/90',
    glow: 'rgba(192,132,252,0.5)',
    text: 'text-purple-300',
    pillBg: 'bg-purple-500/20',
    pillText: 'text-purple-300',
  },
  negotiating: {
    border: 'border-amber-500/50',
    bg: 'bg-slate-900/90',
    glow: 'rgba(251,191,36,0.5)',
    text: 'text-amber-300',
    pillBg: 'bg-amber-500/20',
    pillText: 'text-amber-300',
  },
  committed: {
    border: 'border-emerald-500/50',
    bg: 'bg-slate-900/90',
    glow: 'rgba(52,211,153,0.5)',
    text: 'text-emerald-300',
    pillBg: 'bg-emerald-500/20',
    pillText: 'text-emerald-300',
  },
  lost: {
    border: 'border-rose-500/50',
    bg: 'bg-slate-900/90',
    glow: 'rgba(251,113,133,0.5)',
    text: 'text-rose-300',
    pillBg: 'bg-rose-500/20',
    pillText: 'text-rose-300',
  },
};

interface MobilePipelineRollerProps {
  leads: PipelineEnquiry[];
  allGroupedLeads: Record<StageKey, PipelineEnquiry[]>;
  stages: StageConfig[];
  activeStage: StageKey;
  onSelectStage: (stage: StageKey) => void;
  onMoveLead: (leadId: string, newStage: StageKey) => Promise<void>;
  onSelectLead?: (lead: PipelineEnquiry) => void;
  activeMenuLeadId: string | null;
  onToggleMenu: (leadId: string | null) => void;
  pushedLeadIds: string[];
}

const SWIPE_THRESHOLD_PX = 72; // Horizontal pixels needed to trigger stage roll

export function MobilePipelineRoller({
  leads,
  allGroupedLeads,
  stages,
  activeStage,
  onSelectStage,
  onMoveLead,
  onSelectLead,
  activeMenuLeadId,
  onToggleMenu,
  pushedLeadIds,
}: MobilePipelineRollerProps) {
  // ── Swipe Interaction State ───────────────────────────────────────────────
  const [activeSwipeLeadId, setActiveSwipeLeadId] = useState<string | null>(null);
  const [swipeOffset, setSwipeOffset] = useState<number>(0);
  const [collapsingLeadIds, setCollapsingLeadIds] = useState<Record<string, 'left' | 'right'>>({});

  // Touch tracking refs
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);
  const isHorizontalSwipe = useRef<boolean | null>(null);
  const hasThresholdHapticFired = useRef<boolean>(false);

  // Haptic feedback helper
  const triggerHaptic = useCallback((ms = 10) => {
    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(ms);
      }
    } catch {}
  }, []);

  // ── Execute Roll to Stage (shared between swipe & roller buttons) ─────────
  const handleRoll = async (
    lead: PipelineEnquiry,
    targetStageKey: StageKey,
    direction: 'left' | 'right'
  ) => {
    const sourceStage = mapEnquiryToStage(lead);
    if (sourceStage === targetStageKey) return;

    // Trigger haptic + audio cue
    triggerHaptic(20);
    try {
      jarvisAudioFx.playSuccessChime();
    } catch {}

    // Mark lead as collapsing in given direction
    setCollapsingLeadIds((prev) => ({ ...prev, [lead.id]: direction }));

    const targetStageConfig = stages.find((s) => s.key === targetStageKey);

    try {
      await onMoveLead(lead.id, targetStageKey);

      // Log to persistent Ops notifications store
      try {
        addOpsNotification({
          title: `Pipeline Rolled: ${lead.participantName}`,
          description: `Rolled ${lead.participantName} [${lead.leadCode || `#${lead.id.slice(-6)}`}] to ${targetStageConfig?.label || targetStageKey}`,
          category: 'pipeline',
        });
      } catch {}

      // Toast with 5s Undo button
      toast(
        <div className="flex items-center justify-between w-full gap-2">
          <div className="min-w-0 pr-1">
            <p className="text-xs font-bold text-white truncate">
              Moved <strong>{lead.participantName}</strong>
            </p>
            <p className="text-[11px] text-slate-300">
              Rolled to{' '}
              <span className="font-bold text-cyan-300">
                {targetStageConfig?.label || targetStageKey}
              </span>
            </p>
          </div>
          <button
            onClick={async () => {
              toast.dismiss();
              await onMoveLead(lead.id, sourceStage);
              toast.info(`Undid move for ${lead.participantName}`);
            }}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 text-xs font-bold flex items-center gap-1 active:scale-95 transition-all shrink-0 cursor-pointer"
          >
            <Undo2 className="w-3.5 h-3.5" />
            <span>Undo</span>
          </button>
        </div>,
        { duration: 5000 }
      );
    } catch (err) {
      toast.error(`Failed to move ${lead.participantName}`);
    } finally {
      setTimeout(() => {
        setCollapsingLeadIds((prev) => {
          const next = { ...prev };
          delete next[lead.id];
          return next;
        });
      }, 280);
    }
  };

  // ── Touch Event Handlers for Fluid Horizontal Swipe ───────────────────────
  const handleTouchStart = (e: React.TouchEvent, leadId: string) => {
    if (e.touches.length !== 1) return;
    touchStartPos.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
    isHorizontalSwipe.current = null;
    hasThresholdHapticFired.current = false;
    setActiveSwipeLeadId(leadId);
    setSwipeOffset(0);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartPos.current || !activeSwipeLeadId) return;

    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const dx = currentX - touchStartPos.current.x;
    const dy = currentY - touchStartPos.current.y;

    // Determine swipe axis if not yet locked
    if (isHorizontalSwipe.current === null) {
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      if (absDy > 8 && absDy > absDx) {
        // Vertical scroll: do not hijack
        isHorizontalSwipe.current = false;
        return;
      }
      if (absDx > 8 && absDx > absDy) {
        // Horizontal roll swipe: lock axis
        isHorizontalSwipe.current = true;
      }
    }

    if (isHorizontalSwipe.current) {
      // Elastic resistance curve so card doesn't fly off prematurely
      const sign = Math.sign(dx);
      const abs = Math.abs(dx);
      const dampenedDx = sign * Math.min(abs, 160);

      setSwipeOffset(dampenedDx);

      // Trigger tactile haptic tick once when crossing the threshold
      const reachedThreshold = Math.abs(dampenedDx) >= SWIPE_THRESHOLD_PX;
      if (reachedThreshold && !hasThresholdHapticFired.current) {
        triggerHaptic(12);
        hasThresholdHapticFired.current = true;
      } else if (!reachedThreshold && hasThresholdHapticFired.current) {
        hasThresholdHapticFired.current = false;
      }
    }
  };

  const handleTouchEnd = (lead: PipelineEnquiry) => {
    if (!isHorizontalSwipe.current || !activeSwipeLeadId) {
      touchStartPos.current = null;
      setActiveSwipeLeadId(null);
      setSwipeOffset(0);
      return;
    }

    const { prevStage, nextStage } = getAdjacentStages(activeStage, stages);

    if (swipeOffset >= SWIPE_THRESHOLD_PX) {
      // Swiped Right -> Roll to Next Stage
      handleRoll(lead, nextStage.key, 'right');
    } else if (swipeOffset <= -SWIPE_THRESHOLD_PX) {
      // Swiped Left -> Roll to Previous Stage
      handleRoll(lead, prevStage.key, 'left');
    }

    // Reset swipe state
    touchStartPos.current = null;
    setActiveSwipeLeadId(null);
    setSwipeOffset(0);
    isHorizontalSwipe.current = null;
    hasThresholdHapticFired.current = false;
  };

  const { prevStage, nextStage } = getAdjacentStages(activeStage, stages);
  const prevTheme = STAGE_THEME[prevStage.key];
  const nextTheme = STAGE_THEME[nextStage.key];

  return (
    <div className="space-y-3 pt-1 select-none">
      {/* ── Subtitle Cue: Simple roller guidance ── */}
      <div className="flex items-center justify-between px-1 text-[11px] text-slate-400">
        <span className="flex items-center gap-1">
          <ChevronLeft className="w-3.5 h-3.5 text-cyan-400" />
          <span>Swipe left to {prevStage.label}</span>
        </span>
        <span className="flex items-center gap-1">
          <span>Swipe right to {nextStage.label}</span>
          <ChevronRight className="w-3.5 h-3.5 text-cyan-400" />
        </span>
      </div>

      {/* ── Leads List ── */}
      {leads.length === 0 ? (
        <div className="p-8 text-center rounded-2xl border border-dashed border-slate-800/80 bg-slate-900/30">
          <p className="text-sm font-semibold text-slate-300">
            No prospects in {stages.find((s) => s.key === activeStage)?.label}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Swipe a lead from another stage to roll here, or tap + Add
          </p>
        </div>
      ) : (
        leads.map((lead) => {
          const isSwipingThis = activeSwipeLeadId === lead.id;
          const currentOffset = isSwipingThis ? swipeOffset : 0;
          const isCollapsing = collapsingLeadIds[lead.id];
          const isMenuOpen = activeMenuLeadId === lead.id;
          const badge = getCardStatusBadge(lead, activeStage);

          const isThresholdReached = Math.abs(currentOffset) >= SWIPE_THRESHOLD_PX;
          const isMovingRight = currentOffset > 0;
          const isMovingLeft = currentOffset < 0;

          // Compute transform for card exit animation
          let cardTransform = `translateX(${currentOffset}px)`;
          if (isCollapsing === 'right') {
            cardTransform = 'translateX(110%)';
          } else if (isCollapsing === 'left') {
            cardTransform = 'translateX(-110%)';
          }

          // Status pill text
          let badgeText = 'Curriculum Review';
          if (activeStage === 'evaluating') {
            badgeText = lead.callScore ? 'In Dialogue' : 'Curriculum Review';
          } else if (activeStage === 'negotiating') {
            badgeText = 'Fee Review';
          } else if (activeStage === 'committed') {
            badgeText = 'Converted & Enrolled';
          } else if (activeStage === 'aware') {
            badgeText = 'In Dialogue';
          } else if (activeStage === 'uncontacted') {
            badgeText = 'Modules Sent';
          } else if (activeStage === 'no_plan') {
            badgeText = 'No Plan Set';
          } else if (activeStage === 'lost') {
            badgeText = 'Archived / Lost';
          }

          return (
            <div
              key={lead.id}
              className="relative overflow-hidden rounded-2xl touch-pan-y"
              style={{
                maxHeight: isCollapsing ? '0px' : '260px',
                opacity: isCollapsing ? 0 : 1,
                marginBottom: isCollapsing ? '0px' : '12px',
                transition:
                  'max-height 0.28s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.24s ease, margin-bottom 0.28s ease',
              }}
            >
              {/* ── BACKGROUND ROLLER ACTION BARS ── */}

              {/* 1. LEFT BACKGROUND (Revealed when moving RIGHT) -> Roll to Next Stage */}
              <div
                className={`absolute inset-0 flex items-center justify-start pl-4 rounded-2xl border transition-colors ${
                  isMovingRight
                    ? isThresholdReached
                      ? `${nextTheme.border} ${nextTheme.bg} shadow-[inset_0_0_20px_${nextTheme.glow}]`
                      : 'border-slate-800 bg-slate-900/90'
                    : 'opacity-0 pointer-events-none'
                }`}
                style={{
                  opacity: isMovingRight ? Math.min(1, Math.abs(currentOffset) / 35) : 0,
                }}
              >
                <div className="flex items-center gap-2.5">
                  {/* Glowing Right Roller Icon */}
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                      isThresholdReached
                        ? 'bg-cyan-400 text-slate-950 scale-110 shadow-[0_0_15px_rgba(34,211,238,0.8)]'
                        : 'bg-slate-800 text-cyan-300 scale-100 border border-slate-700'
                    }`}
                  >
                    <ArrowRight className="w-5 h-5 stroke-[2.5]" />
                  </div>

                  <div className="text-left">
                    <p
                      className={`text-xs font-black uppercase tracking-wider transition-colors ${
                        isThresholdReached ? 'text-white' : 'text-slate-300'
                      }`}
                    >
                      {isThresholdReached ? 'Release to Roll →' : `Roll to ${nextStage.label}`}
                    </p>
                    <p className="text-[10px] text-slate-400 font-medium">
                      Next pipeline stage
                    </p>
                  </div>
                </div>
              </div>

              {/* 2. RIGHT BACKGROUND (Revealed when moving LEFT) -> Roll to Prev Stage */}
              <div
                className={`absolute inset-0 flex items-center justify-end pr-4 rounded-2xl border transition-colors ${
                  isMovingLeft
                    ? isThresholdReached
                      ? `${prevTheme.border} ${prevTheme.bg} shadow-[inset_0_0_20px_${prevTheme.glow}]`
                      : 'border-slate-800 bg-slate-900/90'
                    : 'opacity-0 pointer-events-none'
                }`}
                style={{
                  opacity: isMovingLeft ? Math.min(1, Math.abs(currentOffset) / 35) : 0,
                }}
              >
                <div className="flex items-center gap-2.5 flex-row-reverse text-right">
                  {/* Glowing Left Roller Icon */}
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                      isThresholdReached
                        ? 'bg-amber-400 text-slate-950 scale-110 shadow-[0_0_15px_rgba(251,191,36,0.8)]'
                        : 'bg-slate-800 text-amber-300 scale-100 border border-slate-700'
                    }`}
                  >
                    <ArrowLeft className="w-5 h-5 stroke-[2.5]" />
                  </div>

                  <div className="text-right">
                    <p
                      className={`text-xs font-black uppercase tracking-wider transition-colors ${
                        isThresholdReached ? 'text-white' : 'text-slate-300'
                      }`}
                    >
                      {isThresholdReached ? '← Release to Roll' : `Roll to ${prevStage.label}`}
                    </p>
                    <p className="text-[10px] text-slate-400 font-medium">
                      Previous pipeline stage
                    </p>
                  </div>
                </div>
              </div>

              {/* ── FOREGROUND CARD (SWIPABLE & TAPPABLE) ── */}
              <div
                onTouchStart={(e) => handleTouchStart(e, lead.id)}
                onTouchMove={handleTouchMove}
                onTouchEnd={() => handleTouchEnd(lead)}
                onClick={() => {
                  // If swiped, don't open drawer; if stationary tap, open details drawer
                  if (Math.abs(currentOffset) < 6 && onSelectLead) {
                    onSelectLead(lead);
                  }
                }}
                style={{
                  transform: cardTransform,
                  transition: isSwipingThis
                    ? 'none'
                    : 'transform 0.26s cubic-bezier(0.16, 1, 0.3, 1)',
                  willChange: 'transform',
                }}
                className={`relative p-4 rounded-2xl border transition-shadow cursor-pointer select-none bg-[#0f172a] shadow-md active:scale-[0.99] ${
                  isSwipingThis && isThresholdReached
                    ? isMovingRight
                      ? `${nextTheme.border} ring-2 ring-cyan-400/50 shadow-xl`
                      : `${prevTheme.border} ring-2 ring-amber-400/50 shadow-xl`
                    : 'border-slate-800/80 hover:border-slate-700/80'
                }`}
              >
                {/* Row 1: Candidate Name, Primary Key, Score & Kebab Menu */}
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex items-center gap-2">
                    <h3 className="text-base font-bold text-white tracking-tight truncate">
                      {lead.participantName}
                    </h3>
                    <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700 shrink-0">
                      {lead.leadCode || `#${lead.id.slice(-6)}`}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {lead.callScore && (
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${
                          lead.callScore >= 7
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : lead.callScore >= 4
                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        <span className="text-[10px]">★</span>
                        <span>{lead.callScore}/10</span>
                      </span>
                    )}

                    <div className="relative">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleMenu(isMenuOpen ? null : lead.id);
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                        title="Actions"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {/* 3-dots Context Menu Popover */}
                      {isMenuOpen && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="absolute right-0 mt-1 w-48 bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-xl shadow-2xl z-50 p-1.5 space-y-1 animate-[fadeIn_0.15s_ease]"
                        >
                          <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800">
                            Move to Stage
                          </div>
                          {stages
                            .filter((s) => s.key !== activeStage)
                            .map((st) => (
                              <button
                                key={st.key}
                                type="button"
                                onClick={async () => {
                                  onToggleMenu(null);
                                  await onMoveLead(lead.id, st.key);
                                  onSelectStage(st.key);
                                }}
                                className="w-full text-left px-2 py-1.5 rounded-lg text-xs font-medium text-slate-200 hover:bg-slate-800 flex items-center justify-between transition-colors cursor-pointer"
                              >
                                <span>{st.label}</span>
                                <span className={`w-1.5 h-1.5 rounded-full ${st.dotColor}`} />
                              </button>
                            ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Row 2: Topic / Platform & Quality Pills */}
                <div className="flex items-center gap-2 flex-wrap text-xs mt-1.5">
                  <span className="text-slate-300 font-medium">
                    {lead.trainingType || lead.topic || 'Training Platform'}
                  </span>
                  {lead.leadQuality && lead.leadQuality.toLowerCase() === 'high' && (
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      High
                    </span>
                  )}
                  {lead.leadQuality && lead.leadQuality.toLowerCase() === 'medium' && (
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                      Medium
                    </span>
                  )}
                  {pushedLeadIds.includes(lead.id) && (
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      JARVIS
                    </span>
                  )}
                </div>

                {/* Row 3: Country / Service & Stage Status Pill */}
                <div className="flex items-center justify-between pt-2 mt-1 border-t border-slate-800/40">
                  <span className="text-xs text-slate-400 font-medium">
                    {lead.country || 'India'} · {lead.serviceType || 'Training'}
                  </span>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                      badge.className
                    }`}
                  >
                    {badgeText}
                  </span>
                </div>

                {/* ── ROW 4: DIRECT ROLLER ICONS (1-Tap Fast Rolling) ── */}
                <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-slate-800/60 gap-2">
                  {/* Left Roller Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRoll(lead, prevStage.key, 'left');
                    }}
                    className="flex-1 flex items-center justify-start gap-1 px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 active:scale-95 transition-all cursor-pointer text-[11px] font-bold text-slate-300 min-w-0"
                    title={`Roll backward to ${prevStage.label}`}
                  >
                    <ChevronLeft className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{prevStage.label}</span>
                  </button>

                  {/* Stage Dot Indicator in Center */}
                  <div
                    className="px-2 py-1 rounded-lg bg-slate-900/60 border border-slate-800 text-[10px] font-mono text-slate-400 shrink-0 flex items-center gap-1"
                    title={`Current: ${stages.find((s) => s.key === activeStage)?.label}`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        stages.find((s) => s.key === activeStage)?.dotColor
                      }`}
                    />
                    <span className="hidden xs:inline">Roll</span>
                  </div>

                  {/* Right Roller Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRoll(lead, nextStage.key, 'right');
                    }}
                    className="flex-1 flex items-center justify-end gap-1 px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 active:scale-95 transition-all cursor-pointer text-[11px] font-bold text-slate-300 min-w-0 text-right"
                    title={`Roll forward to ${nextStage.label}`}
                  >
                    <span className="truncate">{nextStage.label}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  </button>
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
