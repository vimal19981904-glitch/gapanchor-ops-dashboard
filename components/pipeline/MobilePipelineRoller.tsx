'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  StageConfig,
  StageKey,
  PipelineEnquiry,
  mapEnquiryToStage,
  getCardStatusBadge,
} from './DailyPipelineBoard';
import { MoreVertical, GripVertical, Check, Sparkles, Undo2, Star } from 'lucide-react';
import { toast } from 'sonner';
import { jarvisAudioFx } from '../../lib/jarvis-audio-fx';

// ============================================================================
// ⚙️ TWEAKABLE CONFIGURATION CONSTANTS
// Adjust these parameters to fine-tune the mobile rolling pipeline experience
// ============================================================================
export const ROLLER_CONFIG = {
  HOLD_DURATION_MS: 400,     // 1. Hold duration: ~400ms to lift card
  MOVE_TOLERANCE_PX: 8,      // 2. Tolerance: ~8px movement before cancelling long-press
  EDGE_ZONE_RATIO: 0.28,     // 3. Zone widths: Left (28%), Dead Zone (44%), Right (28%)
  DEAD_ZONE_RATIO: 0.44,     // Dead zone: 44% of viewport width
  V_MIN_PX_S: 120,           // Gentle minimum speed at zone boundary (120 px/s)
  V_MAX_PX_S: 1400,          // 4. Max speed: 1400 px/s at extreme screen edge
  SPEED_POWER: 1.6,          // Power curve (1.6) for exponential velocity ramp
  TILE_WIDTH: 112,           // 5. Tile size: width 112px for thumb ergonomics (>=104px)
  TILE_HEIGHT: 138,          // Tile size: height 138px (>=132px)
  TILE_SPACING: 128,         // Center-to-center distance between consecutive stage tiles
  MAX_TILT_DEG: 28,          // Maximum 3D coverflow tilt angle (+/- 28 deg)
  DECELERATION_TIME_MS: 150, // Dead zone momentum decay time (~150ms)
};

export const STAGE_THEME: Record<
  StageKey,
  { border: string; ring: string; shadow: string; pulseGlow: string; text: string }
> = {
  no_plan: {
    border: 'border-slate-400',
    ring: 'ring-slate-400',
    shadow: 'shadow-[0_0_35px_rgba(148,163,184,0.45)]',
    pulseGlow: 'animate-pulse bg-slate-500/25',
    text: 'text-slate-300',
  },
  uncontacted: {
    border: 'border-sky-400',
    ring: 'ring-sky-400',
    shadow: 'shadow-[0_0_35px_rgba(56,189,248,0.5)]',
    pulseGlow: 'animate-pulse bg-sky-500/25',
    text: 'text-sky-300',
  },
  aware: {
    border: 'border-blue-400',
    ring: 'ring-blue-400',
    shadow: 'shadow-[0_0_35px_rgba(96,165,250,0.5)]',
    pulseGlow: 'animate-pulse bg-blue-500/25',
    text: 'text-blue-300',
  },
  evaluating: {
    border: 'border-purple-400',
    ring: 'ring-purple-400',
    shadow: 'shadow-[0_0_35px_rgba(192,132,252,0.5)]',
    pulseGlow: 'animate-pulse bg-purple-500/25',
    text: 'text-purple-300',
  },
  negotiating: {
    border: 'border-amber-400',
    ring: 'ring-amber-400',
    shadow: 'shadow-[0_0_35px_rgba(251,191,36,0.5)]',
    pulseGlow: 'animate-pulse bg-amber-500/25',
    text: 'text-amber-300',
  },
  committed: {
    border: 'border-emerald-400',
    ring: 'ring-emerald-400',
    shadow: 'shadow-[0_0_35px_rgba(52,211,153,0.5)]',
    pulseGlow: 'animate-pulse bg-emerald-500/25',
    text: 'text-emerald-300',
  },
  lost: {
    border: 'border-rose-400',
    ring: 'ring-rose-400',
    shadow: 'shadow-[0_0_35px_rgba(251,113,133,0.5)]',
    pulseGlow: 'animate-pulse bg-rose-500/25',
    text: 'text-rose-300',
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

interface DragState {
  lead: PipelineEnquiry;
  sourceStage: StageKey;
  pointerX: number;
  pointerY: number;
  startX: number;
  startY: number;
  ghostX: number;
  ghostY: number;
  cardRect: DOMRect;
  startTime: number;
}

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
  // ── States ────────────────────────────────────────────────────────────────
  const [holdingLeadId, setHoldingLeadId] = useState<string | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [targetStageKey, setTargetStageKey] = useState<StageKey | null>(null);
  const [isDropping, setIsDropping] = useState(false);
  const [droppingIntoStage, setDroppingIntoStage] = useState<StageKey | null>(null);
  const [ariaAnnouncement, setAriaAnnouncement] = useState<string>('');
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [collapsingLeadId, setCollapsingLeadId] = useState<string | null>(null);

  // ── Refs for 60 FPS Animation Without React Re-renders ────────────────────
  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);
  const holdStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const currentPointerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const rollerOffsetRef = useRef<number>(0);
  const velocityRef = useRef<number>(0);
  const rafIdRef = useRef<number | null>(null);
  const lastRafTimeRef = useRef<number>(0);
  const rollerContainerRef = useRef<HTMLDivElement | null>(null);
  const tilesRef = useRef<(HTMLDivElement | null)[]>([]);
  const targetStageRef = useRef<StageKey | null>(null);
  const isDraggingRef = useRef(false);

  // Check prefers-reduced-motion
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, []);

  // Haptic feedback helper (navigator.vibrate with silent fallback)
  const triggerHaptic = useCallback((ms = 10) => {
    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(ms);
      }
    } catch {}
  }, []);

  // Lock / Unlock Page Scroll during drag
  const lockPageScroll = useCallback((lock: boolean) => {
    if (typeof document === 'undefined') return;
    if (lock) {
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
      document.documentElement.style.overscrollBehavior = 'contain';
    } else {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
      document.documentElement.style.overscrollBehavior = '';
    }
  }, []);

  // Index of a stage
  const getStageIndex = useCallback(
    (key: StageKey) => stages.findIndex((s) => s.key === key),
    [stages]
  );

  // ── 1. Long Press Start & Movement Detection ──────────────────────────────
  const handlePointerDown = (e: React.PointerEvent, lead: PipelineEnquiry) => {
    // Only primary touch / left mouse button
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    if (dragState) return;

    const targetEl = e.currentTarget as HTMLElement;
    const rect = targetEl.getBoundingClientRect();
    const clientX = e.clientX;
    const clientY = e.clientY;

    holdStartPosRef.current = { x: clientX, y: clientY };
    currentPointerRef.current = { x: clientX, y: clientY };
    setHoldingLeadId(lead.id);

    // Cancel any previous hold timer
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);

    holdTimerRef.current = setTimeout(() => {
      // 1) START: Haptic tick + card lifts
      triggerHaptic(12);

      try {
        jarvisAudioFx.playWakeTone();
      } catch {}

      const sourceStage = mapEnquiryToStage(lead);
      const stageIdx = getStageIndex(sourceStage);
      const screenW = window.innerWidth;
      const screenCenterX = screenW / 2;

      // Center the roller on the lead's current stage initially
      const initialOffset = screenCenterX - stageIdx * ROLLER_CONFIG.TILE_SPACING;
      rollerOffsetRef.current = initialOffset;
      velocityRef.current = 0;
      targetStageRef.current = sourceStage;
      setTargetStageKey(sourceStage);

      isDraggingRef.current = true;
      lockPageScroll(true);

      setDragState({
        lead,
        sourceStage,
        pointerX: clientX,
        pointerY: clientY,
        startX: clientX,
        startY: clientY,
        ghostX: clientX,
        ghostY: clientY - 56, // Position slightly above fingertip so finger doesn't hide it
        cardRect: rect,
        startTime: Date.now(),
      });

      setHoldingLeadId(null);
      setAriaAnnouncement(
        `Picked up ${lead.participantName}. Currently in ${
          stages.find((s) => s.key === sourceStage)?.label || sourceStage
        }.`
      );
    }, ROLLER_CONFIG.HOLD_DURATION_MS);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    currentPointerRef.current = { x: e.clientX, y: e.clientY };

    // If still in pre-drag holding period, enforce movement tolerance
    if (!dragState && holdStartPosRef.current) {
      const dX = e.clientX - holdStartPosRef.current.x;
      const dY = e.clientY - holdStartPosRef.current.y;
      const dist = Math.sqrt(dX * dX + dY * dY);

      if (dist > ROLLER_CONFIG.MOVE_TOLERANCE_PX) {
        // Fast vertical swipe or scroll: cancel long-press hold to allow normal list scrolling
        if (holdTimerRef.current) {
          clearTimeout(holdTimerRef.current);
          holdTimerRef.current = null;
        }
        setHoldingLeadId(null);
        holdStartPosRef.current = null;
      }
      return;
    }

    // Drag is active: update ghost position
    if (dragState) {
      setDragState((prev) =>
        prev
          ? {
              ...prev,
              pointerX: e.clientX,
              pointerY: e.clientY,
              ghostX: e.clientX,
              ghostY: e.clientY - 56,
            }
          : null
      );
    }
  };

  const handlePointerUp = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    holdStartPosRef.current = null;
    setHoldingLeadId(null);

    if (dragState && isDraggingRef.current) {
      finalizeDrop();
    }
  };

  // ── 2. Auto-Roll Animation Frame Loop (60 FPS, Zero List Re-renders) ───────
  useEffect(() => {
    if (!dragState) return;

    lastRafTimeRef.current = performance.now();

    const loop = (time: number) => {
      const dt = Math.min((time - lastRafTimeRef.current) / 1000, 0.05); // cap at 50ms
      lastRafTimeRef.current = time;

      const screenW = window.innerWidth;
      const screenH = window.innerHeight;
      const screenCenterX = screenW / 2;
      const screenCenterY = screenH / 2;
      const pointerX = currentPointerRef.current.x;
      const pointerY = currentPointerRef.current.y;

      const leftThreshold = screenW * ROLLER_CONFIG.EDGE_ZONE_RATIO;
      const rightThreshold = screenW * (1 - ROLLER_CONFIG.EDGE_ZONE_RATIO);
      const zoneWidth = screenW * ROLLER_CONFIG.EDGE_ZONE_RATIO;

      let targetVelocity = 0;

      if (pointerX < leftThreshold) {
        // In LEFT zone: roll toward EARLIER stages (positive offset move toward No plan yet)
        const depth = Math.max(0, Math.min(1, (leftThreshold - pointerX) / zoneWidth));
        const speed =
          ROLLER_CONFIG.V_MIN_PX_S +
          (ROLLER_CONFIG.V_MAX_PX_S - ROLLER_CONFIG.V_MIN_PX_S) *
            Math.pow(depth, ROLLER_CONFIG.SPEED_POWER);
        targetVelocity = speed;
      } else if (pointerX > rightThreshold) {
        // In RIGHT zone: roll toward LATER stages (negative offset move toward Lost)
        const depth = Math.max(0, Math.min(1, (pointerX - rightThreshold) / zoneWidth));
        const speed =
          ROLLER_CONFIG.V_MIN_PX_S +
          (ROLLER_CONFIG.V_MAX_PX_S - ROLLER_CONFIG.V_MIN_PX_S) *
            Math.pow(depth, ROLLER_CONFIG.SPEED_POWER);
        targetVelocity = -speed;
      } else {
        // In DEAD zone (center 44%): roller decelerates to 0 smoothly in ~150ms
        targetVelocity = 0;
      }

      // Smooth velocity interpolation
      const lerpFactor = targetVelocity === 0 ? 0.16 : 0.28;
      velocityRef.current += (targetVelocity - velocityRef.current) * lerpFactor;

      // Update roller offset
      let nextOffset = rollerOffsetRef.current + velocityRef.current * dt;

      // Soft rubber-band boundaries (no wrap-around)
      const minOffset =
        screenCenterX - (stages.length - 1) * ROLLER_CONFIG.TILE_SPACING - 80;
      const maxOffset = screenCenterX + 80;

      if (nextOffset < minOffset) {
        nextOffset = minOffset + (nextOffset - minOffset) * 0.3;
        velocityRef.current *= 0.5;
      } else if (nextOffset > maxOffset) {
        nextOffset = maxOffset + (nextOffset - maxOffset) * 0.3;
        velocityRef.current *= 0.5;
      }

      rollerOffsetRef.current = nextOffset;

      // Hit-test and 3D Coverflow direct DOM transforms
      let hitStageKey: StageKey | null = null;
      let closestStageKey: StageKey = stages[0].key;
      let minDistance = Infinity;

      const tileHalfW = ROLLER_CONFIG.TILE_WIDTH / 2;
      const tileHalfH = ROLLER_CONFIG.TILE_HEIGHT / 2;
      const rollerBandTop = screenCenterY - tileHalfH - 35;
      const rollerBandBottom = screenCenterY + tileHalfH + 35;

      stages.forEach((stage, idx) => {
        const tileEl = tilesRef.current[idx];
        if (!tileEl) return;

        const tileCenterX = nextOffset + idx * ROLLER_CONFIG.TILE_SPACING;
        const distFromCenter = (tileCenterX - screenCenterX) / ROLLER_CONFIG.TILE_SPACING;
        const absDist = Math.abs(distFromCenter);

        // Keep track of tile closest to screen center
        if (absDist < minDistance) {
          minDistance = absDist;
          closestStageKey = stage.key;
        }

        // Direct hit-test: pointer inside tile bounds (with generous vertical thumb margin)
        const tileLeft = tileCenterX - tileHalfW;
        const tileRight = tileCenterX + tileHalfW;

        if (
          pointerX >= tileLeft &&
          pointerX <= tileRight &&
          pointerY >= rollerBandTop &&
          pointerY <= rollerBandBottom
        ) {
          hitStageKey = stage.key;
        }

        // 3D Coverflow transform math
        const scale = Math.max(0.80, 1 - Math.min(0.20, absDist * 0.18));
        const opacity = Math.max(0.52, 1 - Math.min(0.48, absDist * 0.35));
        const rotateY = prefersReducedMotion
          ? 0
          : Math.max(
              -ROLLER_CONFIG.MAX_TILT_DEG,
              Math.min(ROLLER_CONFIG.MAX_TILT_DEG, -distFromCenter * 24)
            );
        const translateZ = Math.max(-120, -absDist * 60);

        tileEl.style.transform = `translateX(${tileCenterX - ROLLER_CONFIG.TILE_WIDTH / 2}px) translateZ(${translateZ}px) rotateY(${rotateY}deg) scale(${scale})`;
        tileEl.style.opacity = `${opacity}`;
      });

      // When pointer is in center dead zone, automatically lock onto the stage centered in the pipe cradle
      const isInDeadZone = pointerX >= leftThreshold && pointerX <= rightThreshold;
      const activeCandidate = hitStageKey || (isInDeadZone ? closestStageKey : (pointerY >= rollerBandTop - 80 && pointerY <= rollerBandBottom + 80 ? closestStageKey : null));

      if (activeCandidate !== targetStageRef.current) {
        targetStageRef.current = activeCandidate;
        setTargetStageKey(activeCandidate);
        if (activeCandidate) {
          triggerHaptic(10);
          setAriaAnnouncement(
            `Over ${stages.find((s) => s.key === activeCandidate)?.label || activeCandidate}`
          );
        }
      }

      rafIdRef.current = requestAnimationFrame(loop);
    };

    rafIdRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, [dragState, stages, prefersReducedMotion, triggerHaptic]);

  // ── 3. Finalize Drop or Cancel ─────────────────────────────────────────────
  const finalizeDrop = async () => {
    if (!dragState) return;

    const lead = dragState.lead;
    const sourceStage = dragState.sourceStage;
    const targetStage = targetStageRef.current;

    isDraggingRef.current = false;
    lockPageScroll(false);

    // DROP: Release over a tile that is NOT the current stage
    if (targetStage && targetStage !== sourceStage) {
      setIsDropping(true);
      setDroppingIntoStage(targetStage);
      triggerHaptic(20);

      try {
        jarvisAudioFx.playSuccessChime();
      } catch {}

      // Moved card collapses out of list with height animation
      setCollapsingLeadId(lead.id);

      const targetStageConfig = stages.find((s) => s.key === targetStage);

      // Perform move via existing handler
      try {
        await onMoveLead(lead.id, targetStage);

        // Show toast "Moved <Name> -> <Stage> - Undo" for 5 s
        toast(
          <div className="flex items-center justify-between w-full gap-2">
            <div className="min-w-0 pr-1">
              <p className="text-xs font-bold text-white truncate">
                Moved <strong>{lead.participantName}</strong>
              </p>
              <p className="text-[11px] text-slate-300">
                To <span className="font-bold text-cyan-300">{targetStageConfig?.label || targetStage}</span>
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
      }

      setTimeout(() => {
        setDragState(null);
        setIsDropping(false);
        setDroppingIntoStage(null);
        setCollapsingLeadId(null);
      }, 260);
    } else {
      // CANCEL: Release on current stage tile, outside tiles, or cancelled
      triggerHaptic(8);
      setDragState(null);
    }
  };

  // Window-level safety cleanup and pointer tracking
  useEffect(() => {
    const handleGlobalPointerMove = (e: PointerEvent) => {
      currentPointerRef.current = { x: e.clientX, y: e.clientY };

      // If still in pre-drag holding period, enforce movement tolerance
      if (!isDraggingRef.current && holdStartPosRef.current) {
        const dX = e.clientX - holdStartPosRef.current.x;
        const dY = e.clientY - holdStartPosRef.current.y;
        const dist = Math.sqrt(dX * dX + dY * dY);

        if (dist > ROLLER_CONFIG.MOVE_TOLERANCE_PX) {
          if (holdTimerRef.current) {
            clearTimeout(holdTimerRef.current);
            holdTimerRef.current = null;
          }
          setHoldingLeadId(null);
          holdStartPosRef.current = null;
        }
        return;
      }

      // Drag is active: update ghost position
      if (isDraggingRef.current) {
        setDragState((prev) =>
          prev
            ? {
                ...prev,
                pointerX: e.clientX,
                pointerY: e.clientY,
                ghostX: e.clientX,
                ghostY: e.clientY - 56,
              }
            : null
        );
      }
    };

    const handleGlobalPointerUp = () => {
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
      holdStartPosRef.current = null;
      setHoldingLeadId(null);

      if (dragState && isDraggingRef.current) {
        finalizeDrop();
      }
    };

    const handleCancel = () => {
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
      holdStartPosRef.current = null;
      setHoldingLeadId(null);

      if (dragState) {
        isDraggingRef.current = false;
        lockPageScroll(false);
        setDragState(null);
      }
    };

    window.addEventListener('pointermove', handleGlobalPointerMove, { passive: true });
    window.addEventListener('pointerup', handleGlobalPointerUp);
    window.addEventListener('pointercancel', handleCancel);
    window.addEventListener('orientationchange', handleCancel);

    return () => {
      window.removeEventListener('pointermove', handleGlobalPointerMove);
      window.removeEventListener('pointerup', handleGlobalPointerUp);
      window.removeEventListener('pointercancel', handleCancel);
      window.removeEventListener('orientationchange', handleCancel);
      lockPageScroll(false);
    };
  }, [dragState, lockPageScroll]);

  return (
    <>
      {/* ── Screen Reader Live Announcements ── */}
      <div className="sr-only" aria-live="assertive">
        {ariaAnnouncement}
      </div>

      {/* ── Active Stage Leads List (Normal View with Long-Press Drag Mode) ── */}
      <div
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="space-y-3 pt-1 min-h-[300px]"
      >
        {leads.length === 0 ? (
          <div className="p-8 text-center rounded-2xl border border-dashed border-slate-800/80 bg-slate-900/30">
            <p className="text-sm font-semibold text-slate-300">
              No prospects in {stages.find((s) => s.key === activeStage)?.label}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Long-press a lead from another stage to roll here, or tap + Add
            </p>
          </div>
        ) : (
          leads.map((lead) => {
            const isBeingDragged = dragState?.lead.id === lead.id;
            const isHolding = holdingLeadId === lead.id;
            const isCollapsing = collapsingLeadId === lead.id;
            const isMenuOpen = activeMenuLeadId === lead.id;
            const badge = getCardStatusBadge(lead, activeStage);

            // Status pill text matching existing design
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
                onPointerDown={(e) => handlePointerDown(e, lead)}
                onContextMenu={(e) => e.preventDefault()}
                onClick={() => {
                  // Normal tap opens prospect details drawer (unchanged)
                  if (!isDraggingRef.current && !dragState && onSelectLead) {
                    onSelectLead(lead);
                  }
                }}
                style={{
                  WebkitTouchCallout: 'none',
                  userSelect: 'none',
                  maxHeight: isCollapsing ? '0px' : '220px',
                  opacity: isCollapsing ? 0 : isBeingDragged ? 0.25 : 1,
                  transform: isHolding ? 'scale(0.98)' : 'scale(1)',
                  transition: 'max-height 0.3s ease, opacity 0.25s ease, transform 0.2s ease',
                  overflow: isCollapsing ? 'hidden' : 'visible',
                }}
                className={`group relative p-4 rounded-2xl border transition-all select-none cursor-pointer ${
                  isBeingDragged
                    ? 'border-dashed border-cyan-500/60 bg-slate-900/40 shadow-inner'
                    : isHolding
                    ? 'bg-slate-900 ring-2 ring-cyan-400/80 border-cyan-400 shadow-xl'
                    : 'bg-[#0f172a]/95 border-slate-800/80 shadow-md active:scale-[0.99] hover:border-slate-700/80'
                }`}
              >
                {/* Hold Progress Halo Feedback */}
                {isHolding && (
                  <div className="absolute inset-0 rounded-2xl pointer-events-none ring-2 ring-cyan-400 animate-pulse bg-cyan-500/10" />
                )}

                {/* Row 1: Name, Stars/Score Badge, 3-dots Menu */}
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-base font-bold text-white tracking-tight truncate">
                    {lead.participantName}
                  </h3>
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
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleMenu(isMenuOpen ? null : lead.id);
                        }}
                        className="p-1 rounded-md text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer"
                        title="Actions"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {/* 3-dots Context Menu Popover */}
                      {isMenuOpen && (
                        <div
                          onPointerDown={(e) => e.stopPropagation()}
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

                {/* Row 2: Topic / Platform & Quality / JARVIS Pills */}
                <div className="flex items-center gap-2 flex-wrap text-xs mt-1">
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

                {/* Row 3: Country / Service on left, Stage status pill on right */}
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
              </div>
            );
          })
        )}
      </div>

      {/* ── 3D ROLLING PIPELINE OVERLAY (Center Screen Coverflow Roller) ── */}
      {dragState && (
        <div
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="fixed inset-0 z-50 overflow-hidden bg-slate-950/85 backdrop-blur-xl animate-[fadeIn_0.2s_ease-out] select-none touch-none"
          style={{ WebkitTouchCallout: 'none', userSelect: 'none' }}
        >
          {/* Subtle Zone Guidance Vignette (Left 28%, Dead Zone 44%, Right 28%) */}
          <div className="absolute inset-0 pointer-events-none flex justify-between px-2 opacity-25">
            <div className="w-[28%] h-full border-r border-dashed border-cyan-500/20 flex items-center justify-center">
              <span className="text-[10px] font-mono text-cyan-400/60 uppercase tracking-widest rotate-[-90deg]">
                ← Earlier Stages
              </span>
            </div>
            <div className="flex-1 h-full flex flex-col items-center justify-between py-12">
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">
                Dead Zone (Stable)
              </span>
            </div>
            <div className="w-[28%] h-full border-l border-dashed border-cyan-500/20 flex items-center justify-center">
              <span className="text-[10px] font-mono text-cyan-400/60 uppercase tracking-widest rotate-[90deg]">
                Later Stages →
              </span>
            </div>
          </div>

          {/* Fixed Center Alignment Notch / Target Guide */}
          <div className="absolute top-[34%] left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-none z-30">
            <div className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,1)] animate-ping" />
            <div className="w-0.5 h-7 bg-gradient-to-b from-cyan-400/80 to-transparent mt-1" />
          </div>

          {/* Top Cue Header */}
          <div className="absolute top-8 left-0 right-0 text-center px-4 pointer-events-none z-30 animate-fade-in">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/90 border border-white/15 shadow-xl backdrop-blur-md">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
              <span className="text-xs font-bold text-white">
                Release over a stage to move {dragState.lead.participantName}
              </span>
            </div>
          </div>

          {/* ── 3D HORIZONTAL PIPE ROLLER CYLINDER DRUM BODY ── */}
          <div className="absolute top-1/2 left-0 right-0 -translate-y-1/2 h-[184px] pointer-events-none flex items-center justify-center">
            {/* Cylindrical Pipe Metallic Conduit Outer Shell */}
            <div
              className="w-full h-[168px] relative border-y border-cyan-500/30 shadow-[0_0_50px_rgba(34,211,238,0.18)] overflow-hidden"
              style={{
                background:
                  'linear-gradient(180deg, rgba(30,41,59,0.95) 0%, rgba(15,23,42,0.98) 18%, rgba(2,6,23,0.99) 50%, rgba(15,23,42,0.98) 82%, rgba(30,41,59,0.95) 100%)',
              }}
            >
              {/* Pipe Chrome Highlights & Specular Neon Glints */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-cyan-400/80 to-transparent" />
              <div className="absolute top-2.5 left-0 right-0 h-0.5 bg-white/15" />
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />

              {/* Cylindrical Pipe End-Cap Flanges */}
              <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-cyan-500/20 to-transparent border-r border-cyan-500/30 flex items-center justify-center">
                <div className="w-1.5 h-20 rounded-full bg-cyan-400/40" />
              </div>
              <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-cyan-500/20 to-transparent border-l border-cyan-500/30 flex items-center justify-center">
                <div className="w-1.5 h-20 rounded-full bg-cyan-400/40" />
              </div>

              {/* Metallic Groove Seams along the Pipe */}
              <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-cyan-500/15 -translate-y-1/2" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(34,211,238,0.08),transparent_70%)] pointer-events-none" />
            </div>

            {/* Fixed Center Docking Cradle / Receiver Slot Bracket */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[124px] h-[156px] rounded-2xl border-2 border-cyan-400/80 shadow-[0_0_25px_rgba(34,211,238,0.45)] pointer-events-none z-20 flex flex-col justify-between p-1.5">
              {/* Top Cradle Notch */}
              <div className="flex items-center justify-between px-1">
                <div className="w-2.5 h-2.5 border-t-2 border-l-2 border-cyan-300" />
                <span className="text-[8px] font-mono font-black text-cyan-300 tracking-wider uppercase animate-pulse">
                  Target Stage
                </span>
                <div className="w-2.5 h-2.5 border-t-2 border-r-2 border-cyan-300" />
              </div>

              {/* Bottom Cradle Notch */}
              <div className="flex items-center justify-between px-1">
                <div className="w-2.5 h-2.5 border-b-2 border-l-2 border-cyan-300" />
                <span className="text-[7.5px] font-mono text-cyan-400/70 uppercase">
                  Release to Drop
                </span>
                <div className="w-2.5 h-2.5 border-b-2 border-r-2 border-cyan-300" />
              </div>
            </div>
          </div>

          {/* ── 3D HORIZONTAL ROLLER (CENTER OF SCREEN) ── */}
          <div
            ref={rollerContainerRef}
            style={{ perspective: prefersReducedMotion ? 'none' : '900px' }}
            className="absolute top-1/2 left-0 w-full -translate-y-1/2 h-[200px] flex items-center pointer-events-none"
          >
            {stages.map((stage, idx) => {
              const isTarget = targetStageKey === stage.key;
              const isCurrent = stage.key === dragState.sourceStage;
              const isDroppingIntoThis = isDropping && droppingIntoStage === stage.key;
              const count = (allGroupedLeads[stage.key] || []).length;
              const theme = STAGE_THEME[stage.key];

              return (
                <div
                  key={stage.key}
                  ref={(el) => {
                    tilesRef.current[idx] = el;
                  }}
                  style={{
                    width: `${ROLLER_CONFIG.TILE_WIDTH}px`,
                    height: `${ROLLER_CONFIG.TILE_HEIGHT}px`,
                    position: 'absolute',
                    top: `calc(50% - ${ROLLER_CONFIG.TILE_HEIGHT / 2}px)`,
                    left: 0,
                    willChange: 'transform, opacity',
                  }}
                  className={`rounded-2xl p-3.5 flex flex-col justify-between border transition-all shadow-2xl pointer-events-auto ${
                    isDroppingIntoThis
                      ? `${theme.border} ${theme.ring} ring-4 ${theme.shadow} ${theme.pulseGlow} scale-105`
                      : isTarget
                      ? `${theme.border} ${theme.ring} ring-2 ${theme.shadow} bg-slate-900/98 scale-[1.02]`
                      : isCurrent
                      ? 'bg-slate-900/85 border-slate-700/80'
                      : 'bg-slate-950/80 border-slate-800/80'
                  }`}
                >
                  {/* Tile Header: Dot & Stage Live Count */}
                  <div className="flex items-center justify-between">
                    <span
                      className={`w-3 h-3 rounded-full ${stage.dotColor} ${
                        isTarget ? 'shadow-[0_0_12px_rgba(255,255,255,0.8)] scale-110' : ''
                      } transition-transform`}
                    />
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                      {count}
                    </span>
                  </div>

                  {/* Tile Center: Stage Name */}
                  <div className="text-center my-auto">
                    <h4
                      className={`text-sm font-extrabold tracking-tight leading-tight transition-colors ${
                        isTarget ? theme.text : 'text-white'
                      }`}
                    >
                      {stage.label}
                    </h4>
                    {isCurrent && (
                      <span className="inline-block mt-1 text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                        Current
                      </span>
                    )}
                  </div>

                  {/* Tile Footer / Drop Cue */}
                  <div className="text-center">
                    {isTarget ? (
                      <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider animate-pulse ${theme.text}`}>
                        <Check className="w-3 h-3 stroke-[3]" />
                        <span>Move to {stage.label}</span>
                      </span>
                    ) : (
                      <span className="text-[9.5px] text-slate-500 font-medium">Stage {idx + 1}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── LIFTED GHOST CARD FOLLOWING FINGER ── */}
          <div
            style={{
              position: 'fixed',
              left: 0,
              top: 0,
              width: `${Math.min(dragState.cardRect.width, 340)}px`,
              transform: isDropping
                ? `translate3d(${window.innerWidth / 2 - Math.min(dragState.cardRect.width, 340) / 2}px, ${window.innerHeight / 2 - 50}px, 0) scale(0.35)`
                : `translate3d(${dragState.ghostX - Math.min(dragState.cardRect.width, 340) / 2}px, ${dragState.ghostY - 48}px, 0) rotate(-2.5deg) scale(1.04)`,
              opacity: isDropping ? 0 : 1,
              transition: isDropping ? 'transform 0.24s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.22s ease-in' : 'none',
              pointerEvents: 'none',
              zIndex: 70,
              willChange: 'transform, opacity',
            }}
            className="p-3.5 rounded-2xl bg-slate-900/98 border-2 border-cyan-400 shadow-[0_20px_60px_rgba(0,0,0,0.9),0_0_25px_rgba(34,211,238,0.35)] backdrop-blur-2xl"
          >
            <div className="flex items-center justify-between gap-1.5">
              <div className="flex items-center gap-1.5 min-w-0">
                <GripVertical className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <h4 className="text-sm font-bold text-white truncate">
                  {dragState.lead.participantName}
                </h4>
              </div>
              <span className="font-mono text-[9px] font-bold px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 shrink-0">
                {dragState.lead.leadCode || `#${dragState.lead.id.slice(-6)}`}
              </span>
            </div>
            <p className="text-xs text-slate-300 font-medium truncate mt-1">
              {dragState.lead.trainingType || dragState.lead.topic || 'Training Platform'}
            </p>
            <div className="mt-2 flex items-center justify-between text-[10px] text-cyan-300 font-bold border-t border-slate-800 pt-1.5">
              <span>Moving prospect...</span>
              <span className="font-mono">{targetStageKey ? stages.find((s) => s.key === targetStageKey)?.label : 'Drag to Stage'}</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
