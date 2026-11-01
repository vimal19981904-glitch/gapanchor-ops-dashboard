'use client';

import React, { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface RedFlagBadgeProps {
  enquiryId: string;
  hasRedFlag: boolean;
  redFlagReason?: string | null;
  redFlagDismissed?: boolean;
  onDismissed?: () => void;
}

export function RedFlagBadge({
  enquiryId,
  hasRedFlag,
  redFlagReason,
  redFlagDismissed = false,
  onDismissed,
}: RedFlagBadgeProps) {
  const [dismissed, setDismissed] = useState(redFlagDismissed);
  const [isDismissing, setIsDismissing] = useState(false);

  if (!hasRedFlag || dismissed) return null;

  const handleDismiss = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDismissing(true);
    try {
      const res = await fetch('/api/enquiries/call-intelligence', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enquiryId, dismissRedFlag: true }),
      });
      const data = await res.json();
      if (data.success) {
        setDismissed(true);
        if (onDismissed) onDismissed();
      }
    } catch (err) {
      console.error('Failed to dismiss red flag:', err);
    } finally {
      setIsDismissing(false);
    }
  };

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      title={redFlagReason || 'Red flag flagged during sales call analysis'}
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30 animate-pulse hover:animate-none transition-all shadow-sm"
    >
      <AlertTriangle className="w-3 h-3 text-rose-400" />
      <span className="truncate max-w-[120px]">{redFlagReason || 'Risk Flag'}</span>
      <button
        onClick={handleDismiss}
        disabled={isDismissing}
        title="Dismiss Red Flag"
        className="ml-1 text-rose-400 hover:text-white hover:bg-rose-600/40 rounded p-0.5 transition-colors"
      >
        <X className="w-2.5 h-2.5" />
      </button>
    </div>
  );
}
