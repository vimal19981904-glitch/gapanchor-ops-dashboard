'use client';

import React, { useState, useRef } from 'react';
import { ListTodo, CheckCircle2, Clock } from 'lucide-react';
import { useTeamsIndicators } from './useTeamsIndicators';

export interface LeadTeamsIndicatorsProps {
  enquiryId: string;
  className?: string;
  onOpenDrawer?: () => void;
  onUploadTranscript?: () => void;
}

/**
 * Microsoft Teams official icon without the "T" text box.
 * Renders the dual-silhouette avatars with crisp vector geometry and clean bulb-on lighting.
 */
function TeamsBrandIcon({ active }: { active: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`w-5 h-5 transition-all duration-200 ${
        active
          ? 'drop-shadow-[0_1px_2px_rgba(99,102,241,0.5)]'
          : 'opacity-25 grayscale'
      }`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Background Silhouette */}
      <circle cx="16.5" cy="7" r="2.2" fill={active ? '#505AC9' : '#64748b'} />
      <path
        d="M13.5 11C13.5 10.17 14.17 9.5 15 9.5H18C18.83 9.5 19.5 10.17 19.5 11V16C19.5 16.55 19.05 17 18.5 17H14.5C13.95 17 13.5 16.55 13.5 16V11Z"
        fill={active ? '#505AC9' : '#64748b'}
      />
      {/* Foreground Silhouette */}
      <circle cx="9" cy="5.5" r="3" fill={active ? '#7B83EB' : '#94a3b8'} />
      <path
        d="M4.5 10.5C4.5 9.67 5.17 9 6 9H12C12.83 9 13.5 9.67 13.5 10.5V17.5C13.5 18.33 12.83 19 12 19H6C5.17 19 4.5 18.33 4.5 17.5V10.5Z"
        fill={active ? '#7B83EB' : '#94a3b8'}
      />
    </svg>
  );
}

export function LeadTeamsIndicators({
  enquiryId,
  className = '',
  onOpenDrawer,
  onUploadTranscript,
}: LeadTeamsIndicatorsProps) {
  const { getIndicator } = useTeamsIndicators();
  const data = getIndicator(enquiryId);

  const [hoveredIcon, setHoveredIcon] = useState<'teams' | 'tasks' | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number } | null>(null);
  const taskRef = useRef<HTMLButtonElement>(null);
  const teamsRef = useRef<HTMLButtonElement>(null);

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
      {/* ── Plain Background, No Outer Box, Generous Spacing ── */}
      <div className={`flex items-center gap-3 shrink-0 mr-3.5 ${className}`}>
        {/* ── 1. Teams Transcript Indicator ── */}
        <button
          type="button"
          ref={teamsRef}
          onMouseEnter={handleTeamsMouseEnter}
          onMouseLeave={handleMouseLeave}
          onClick={(e) => {
            e.stopPropagation();
            if (!hasTranscript && onUploadTranscript) {
              onUploadTranscript();
            } else if (onOpenDrawer) {
              onOpenDrawer();
            }
          }}
          className="p-0 border-0 bg-transparent flex items-center justify-center cursor-pointer transition-transform hover:scale-115 active:scale-95 outline-none select-none"
          aria-label={hasTranscript ? 'Teams Transcript Available' : 'No Teams Transcript - Click to upload'}
          title={hasTranscript ? 'Teams Transcript Available (Click to view)' : 'No Teams Transcript (Click to upload)'}
        >
          <TeamsBrandIcon active={hasTranscript} />
        </button>

        {/* ── 2. Action Items Indicator ── */}
        <button
          type="button"
          ref={taskRef}
          onMouseEnter={handleTaskMouseEnter}
          onMouseLeave={handleMouseLeave}
          onClick={onOpenDrawer}
          className={`p-0 border-0 bg-transparent flex items-center justify-center cursor-pointer transition-transform hover:scale-115 active:scale-95 outline-none select-none ${
            taskStatus === 'completed'
              ? 'text-emerald-400 drop-shadow-[0_1px_2px_rgba(16,185,129,0.5)]'
              : taskStatus === 'pending'
              ? 'text-rose-400 drop-shadow-[0_1px_2px_rgba(244,63,94,0.5)]'
              : 'text-slate-600 opacity-25 hover:opacity-50'
          }`}
          aria-label={`Action Items: ${taskStatus}`}
          title={
            taskStatus === 'completed'
              ? 'All Action Items Completed'
              : taskStatus === 'pending'
              ? `${pendingItems.length} Pending Action Items`
              : 'No Action Items'
          }
        >
          <ListTodo className="w-5 h-5 stroke-[2.2]" />
        </button>
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
                  All Action Items Completed
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
                    Completed ({completedItems.length})
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
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
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
