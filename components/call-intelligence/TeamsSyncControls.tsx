'use client';

import React, { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface TeamsSyncControlsProps {
  onSyncComplete?: () => void;
  compact?: boolean;
  className?: string;
}

export function TeamsSyncControls({ onSyncComplete, compact = false, className = '' }: TeamsSyncControlsProps) {
  const [syncing, setSyncing] = useState(false);

  const handleSyncTeams = async () => {
    try {
      setSyncing(true);
      const res = await fetch('/api/teams/sync-transcripts', {
        method: 'POST',
      });
      const data = await res.json();
      if (data.needsPermission) {
        toast.error('Azure permissions required to read Teams transcripts & chats automatically.', {
          action: {
            label: 'Authorize Teams',
            onClick: () => {
              window.location.href = data.authUrl || '/api/auth/microsoft/connect';
            },
          },
          duration: 10000,
        });
        return;
      }

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to sync Teams transcripts');
      }

      if (data.syncedCount > 0) {
        toast.success(data.message || `Synced ${data.syncedCount} new call transcripts!`);
      } else {
        toast.info(data.message || 'No new Teams transcripts found.');
      }

      if (onSyncComplete) onSyncComplete();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Error syncing Teams transcripts');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleSyncTeams}
      disabled={syncing}
      className={`h-9 sm:h-10 flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-semibold bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 hover:text-white border border-slate-700/80 hover:border-slate-600 shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap shrink-0 ${
        compact ? '!h-7 !px-2 !py-1 !text-[11px]' : ''
      } ${className}`}
      title="Sync completed Teams call transcripts from OneDrive"
    >
      <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-400 ${syncing ? 'animate-spin' : ''}`} />
      <span>{syncing ? 'Syncing Teams...' : 'Sync Teams Calls'}</span>
    </button>
  );
}
