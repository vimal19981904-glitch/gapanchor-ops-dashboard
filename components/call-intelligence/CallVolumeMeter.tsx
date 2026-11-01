'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Volume2 } from 'lucide-react';

interface CallVolumeMeterProps {
  enquiryId: string;
  initialScore: number | null;
  onScoreUpdated?: (newScore: number) => void;
  compact?: boolean;
}

export function CallVolumeMeter({
  enquiryId,
  initialScore,
  onScoreUpdated,
  compact = false,
}: CallVolumeMeterProps) {
  const [score, setScore] = useState<number | null>(initialScore);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showSlider, setShowSlider] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentScore = score ?? 0;

  // Sync state if initialScore updates from parent
  useEffect(() => {
    setScore(initialScore);
  }, [initialScore]);

  // Click outside to close slider
  useEffect(() => {
    if (!showSlider) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSlider(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSlider]);

  // Determine color scheme based on 1-10 score
  const getColor = (s: number) => {
    if (s >= 8) return { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30', bar: 'bg-emerald-500' };
    if (s >= 5) return { bg: 'bg-cyan-500/15', text: 'text-cyan-400', border: 'border-cyan-500/30', bar: 'bg-cyan-500' };
    if (s >= 1) return { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30', bar: 'bg-amber-500' };
    return { bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/20', bar: 'bg-slate-600' };
  };

  const colors = getColor(currentScore);

  const handleUpdateScore = async (newScore: number) => {
    setScore(newScore);
    setIsUpdating(true);
    try {
      const res = await fetch('/api/enquiries/call-intelligence', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enquiryId, callScore: newScore }),
      });
      const data = await res.json();
      if (data.success && onScoreUpdated) {
        onScoreUpdated(newScore);
      }
    } catch (err) {
      console.error('Failed to update score:', err);
    } finally {
      setIsUpdating(false);
    }
  };

  if (compact) {
    return (
      <div className="relative inline-block text-left" ref={containerRef}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setShowSlider(!showSlider);
          }}
          title="Click to override 1-10 Lead Call Score"
          className={`inline-flex items-center justify-center gap-1.5 px-3 py-1 h-7 rounded-xl text-[11px] font-bold border transition-all cursor-pointer whitespace-nowrap leading-none shrink-0 ${colors.bg} ${colors.text} ${colors.border} hover:brightness-125 shadow-sm min-w-[125px]`}
        >
          <Volume2 className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{currentScore > 0 ? `${currentScore}/10 Score` : '⚪ Unrated'}</span>
        </button>

        {showSlider && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute z-50 top-full mt-1.5 left-0 w-48 p-3.5 bg-slate-900/95 backdrop-blur-xl rounded-xl border border-slate-700/80 shadow-2xl animate-in fade-in zoom-in-95 duration-150 space-y-2.5"
          >
            <div className="flex items-center justify-between text-xs text-slate-300 font-bold">
              <span>Volume Score:</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-extrabold ${colors.bg} ${colors.text} border ${colors.border}`}>
                {currentScore > 0 ? `${currentScore}/10` : 'Unrated'}
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              value={currentScore || 5}
              disabled={isUpdating}
              onChange={(e) => handleUpdateScore(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-medium">
              <span>Low (1)</span>
              <span>Med (5)</span>
              <span>Hot (10)</span>
            </div>
            <div className="grid grid-cols-5 gap-1 pt-1 border-t border-slate-800">
              {[2, 4, 6, 8, 10].map((pt) => (
                <button
                  key={pt}
                  type="button"
                  onClick={() => handleUpdateScore(pt)}
                  className={`text-[10px] font-bold py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer ${currentScore === pt ? 'ring-1 ring-cyan-400 text-cyan-300' : ''}`}
                >
                  {pt}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${colors.bg} ${colors.border}`}>
        <Volume2 className={`w-3.5 h-3.5 ${colors.text}`} />
        <span className={`text-xs font-bold ${colors.text}`}>
          {currentScore > 0 ? `${currentScore}/10` : 'No Call Yet'}
        </span>
      </div>

      {/* 10-segment mini volume meter */}
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((seg) => (
          <button
            key={seg}
            disabled={isUpdating}
            onClick={() => handleUpdateScore(seg)}
            title={`Set Score to ${seg}/10`}
            className={`w-1.5 h-4 rounded-sm transition-all hover:scale-125 ${
              seg <= currentScore ? colors.bar : 'bg-slate-700/60'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
