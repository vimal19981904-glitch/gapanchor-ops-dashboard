'use client';

import React, { useState, useRef } from 'react';
import { ListTodo, CheckCircle2, Clock } from 'lucide-react';
import { useTeamsIndicators } from './useTeamsIndicators';

export interface LeadTeamsIndicatorsProps {
  enquiryId: string;
  className?: string;
  onOpenDrawer?: () => void;
}

/**
 * Microsoft Teams official icon without the "T" text box.
 * Renders the dual-silhouette avatars with high-precision SVG paths.
 */
function TeamsBrandIcon({ glowing }: { glowing: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`w-3.5 h-3.5 transition-all duration-300 ${
        glowing
          ? 'drop-shadow-[0_0_8px_rgba(123,131,235,0.95)] filter drop-shadow(0 0 4px #7B83EB)'
          : 'opacity-30 grayscale'
      }`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Background Silhouette */}
      <circle cx="16.5" cy="7" r="2.2" fill={glowing ? '#505AC9' : '#64748b'} />
      <path
        d="M13.5 11C13.5 10.17 14.17 9.5 15 9.5H18C18.83 9.5 19.5 10.17 19.5 11V16C19.5 16.55 19.05 17 18.5 17H14.5C13.95 17 13.5 16.55 13.5 16V11Z"
        fill={glowing ? '#505AC9' : '#64748b'}
      />
      {/* Foreground Silhouette */}
      <circle cx="9" cy="5.5" r="3" fill={glowing ? '#7B83EB' : '#94a3b8'} />
      <path
        d="M4.5 10.5C4.5 9.67 5.17 9 6 9H12C12.83 9 13.5 9.67 13.5 10.5V17.5C13.5 18.33 12.83 19 12 19H6C5.17 19 4.5 18.33 4.5 17.5V10.5Z"
        fill={glowing ? '#7B83EB' : '#94a3b8'}
      />
    </svg>
  );
}

export function LeadTeamsIndicators({
  enquiryId,
  className = '',
  onOpenDrawer,
}: LeadTeamsIndicatorsProps) {
  const { getIndicator } = useTeamsIndicators();
  const data = getIndicator(enquiryId);

  const [hoveredIcon, setHoveredIcon] = useState<'teams' | 'tasks' | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number } | null>(null);
  const taskRef = useRef<HTMLDivElement>(null);
  const teamsRef = useRef<HTMLDivElement>(null);

  const hasTranscript = Boolean(data?.hasTranscript);
  const actionItemsData = data?.actionItems;
  const taskStatus = actionItemsData?.status || 'none'; // 'none' | 'completed' | 'pending'
  const items = actionItemsData?.items || [];
  const completedItems = items.filter((i) => i.status === 'completed');
  const pendingItems = items.filter((i) => i.status === 'pending');

  const handleTaskMouseEnter = () => {
    if (taskRef.current) {
      const rect = taskRef.current.getBoundingClientRect();
      setTooltipPos({
        top: rect.top - 8,
        left: rect.left + rect.width / 2,
      });
      setHoveredIcon('tasks');
    }
  };

  const handleTeamsMouseEnter = () => {
    if (teamsRef.current) {
      const rect = teamsRef.current.getBoundingClientRect();
      setTooltipPos({
        top: rect.top - 8,
        left: rect.left + rect.width / 2,
      });
      setHoveredIcon('teams');
    }
  };

  const handleMouseLeave = () => {
    setHoveredIcon(null);
    setTooltipPos(null);
  };

  return (
    <>
      <div className={`flex items-center gap-1.5 shrink-0 ${className}`}>
        {/* ── 1. Teams Transcript Indicator ── */}
        <div
          ref={teamsRef}
          onMouseEnter={handleTeamsMouseEnter}
          onMouseLeave={handleMouseLeave}
          onClick={onOpenDrawer}
          className={`relative flex items-center justify-center w-6 h-6 rounded-md transition-all select-none cursor-pointer ${
            hasTranscript
              ? 'bg-indigo-950/40 border border-indigo-500/40 shadow-[0_0_10px_rgba(123,131,235,0.3)] hover:scale-110 hover:border-indigo-400'
              : 'bg-transparent border border-transparent opacity-40 hover:opacity-70'
          }`}
          aria-label={hasTranscript ? 'Teams Transcript Available' : 'No Teams Transcript'}
        >
          <TeamsBrandIcon glowing={hasTranscript} />
        </div>

        {/* ── 2. Action Items Indicator ── */}
        <div
          ref={taskRef}
          onMouseEnter={handleTaskMouseEnter}
          onMouseLeave={handleMouseLeave}
          onClick={onOpenDrawer}
          className={`relative flex items-center justify-center w-6 h-6 rounded-md transition-all select-none cursor-pointer ${
            taskStatus === 'completed'
              ? 'bg-emerald-950/40 border border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.35)] hover:scale-110 hover:border-emerald-400 text-emerald-400 drop-shadow-[0_0_6px_rgba(52,211,153,0.85)]'
              : taskStatus === 'pending'
              ? 'bg-rose-950/40 border border-rose-500/40 shadow-[0_0_10px_rgba(244,63,94,0.35)] hover:scale-110 hover:border-rose-400 text-rose-400 drop-shadow-[0_0_6px_rgba(244,63,94,0.85)]'
              : 'bg-transparent border border-transparent text-slate-600 opacity-40 hover:opacity-70'
          }`}
          aria-label={`Action Items: ${taskStatus}`}
        >
          <ListTodo className="w-3.5 h-3.5" />
        </div>
      </div>

      {/* ── Fixed Position Compact Floating Tooltip ── */}
      {hoveredIcon === 'tasks' && tooltipPos && (
        <div
          className="fixed z-[9999] pointer-events-none -translate-x-1/2 -translate-y-full w-64 max-w-xs bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-xl p-2.5 shadow-2xl text-[11px] text-slate-200 animate-in fade-in zoom-in-95 duration-150"
          style={{ top: `${tooltipPos.top}px`, left: `${tooltipPos.left}px` }}
        >
          {taskStatus === 'none' ? (
            <div className="flex items-center gap-1.5 text-slate-400 py-0.5">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <span>No action items recorded</span>
            </div>
          ) : taskStatus === 'completed' ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between pb-1 border-b border-slate-800 text-emerald-400 font-bold">
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  All Action Items Done
                </span>
                <span className="text-[10px] bg-emerald-500/20 px-1.5 py-0.2 rounded-full border border-emerald-500/30">
                  {completedItems.length}/{completedItems.length}
                </span>
              </div>
              <ul className="space-y-1 max-h-36 overflow-y-auto pr-1">
                {completedItems.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-1.5 text-slate-300 text-[10.5px]">
                    <span className="text-emerald-400 font-bold mt-0.5">✓</span>
                    <span className="truncate" title={item.text}>
                      {item.text}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between pb-1 border-b border-slate-800 text-rose-400 font-bold">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-rose-400" />
                  Action Items
                </span>
                <span className="text-[10px] bg-rose-500/20 px-1.5 py-0.2 rounded-full border border-rose-500/30">
                  {pendingItems.length} Pending
                </span>
              </div>

              {/* Pending Items First */}
              <div className="space-y-0.5">
                <p className="text-[9.5px] uppercase tracking-wider font-extrabold text-rose-400/90">Pending</p>
                <ul className="space-y-1 max-h-24 overflow-y-auto pr-1">
                  {pendingItems.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-1.5 text-slate-200 text-[10.5px]">
                      <span className="text-rose-400 font-bold mt-0.5">•</span>
                      <span className="truncate" title={item.text}>
                        {item.text}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Completed Items (if any) */}
              {completedItems.length > 0 && (
                <div className="space-y-0.5 pt-1 border-t border-slate-800/80">
                  <p className="text-[9.5px] uppercase tracking-wider font-extrabold text-emerald-400/80">
                    Done ({completedItems.length})
                  </p>
                  <ul className="space-y-0.5 max-h-16 overflow-y-auto pr-1">
                    {completedItems.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-1.5 text-slate-400 line-through text-[10px]">
                        <span className="text-emerald-500 font-bold">✓</span>
                        <span className="truncate" title={item.text}>
                          {item.text}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Fixed Position Tooltip for Teams Icon ── */}
      {hoveredIcon === 'teams' && tooltipPos && (
        <div
          className="fixed z-[9999] pointer-events-none -translate-x-1/2 -translate-y-full px-2.5 py-1.5 bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-lg shadow-xl text-[11px] text-slate-200 whitespace-nowrap animate-in fade-in zoom-in-95 duration-150"
          style={{ top: `${tooltipPos.top}px`, left: `${tooltipPos.left}px` }}
        >
          {hasTranscript ? (
            <div className="flex items-center gap-1.5 text-indigo-300 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
              <span>Teams Transcript Synced</span>
            </div>
          ) : (
            <span className="text-slate-400">No Teams Transcript</span>
          )}
        </div>
      )}
    </>
  );
}
