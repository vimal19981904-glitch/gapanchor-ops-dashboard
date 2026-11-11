'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Bell,
  CheckCheck,
  Trash2,
  Database,
  ArrowRight,
  RefreshCw,
  Sparkles,
  FileText,
  DollarSign,
  X,
  Layers,
} from 'lucide-react';
import {
  OpsNotification,
  getOpsNotifications,
  clearOpsNotifications,
  markAllNotificationsRead,
} from '@/lib/notifications-store';

function formatRelativeTime(isoString: string): string {
  try {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);

    if (diffSec < 30) return 'Just now';
    if (diffSec < 60) return `${diffSec}s ago`;
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHour < 24) return `${diffHour}h ago`;
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return 'Recently';
  }
}

function getCategoryIcon(category: OpsNotification['category']) {
  switch (category) {
    case 'pipeline':
      return <Layers className="w-3.5 h-3.5 text-cyan-400" />;
    case 'sync':
      return <RefreshCw className="w-3.5 h-3.5 text-indigo-400" />;
    case 'finance':
      return <DollarSign className="w-3.5 h-3.5 text-emerald-400" />;
    case 'lead':
      return <FileText className="w-3.5 h-3.5 text-amber-400" />;
    case 'system':
    default:
      return <Database className="w-3.5 h-3.5 text-cyan-300" />;
  }
}

export function OpsNotificationBell({ className = '' }: { className?: string }) {
  const [notifications, setNotifications] = useState<OpsNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sync notifications from store
  useEffect(() => {
    setNotifications(getOpsNotifications());

    const handleUpdate = (e: any) => {
      if (e.detail?.notifications) {
        setNotifications(e.detail.notifications);
      } else {
        setNotifications(getOpsNotifications());
      }
    };

    window.addEventListener('gapanchor:notification-updated', handleUpdate);
    return () => window.removeEventListener('gapanchor:notification-updated', handleUpdate);
  }, []);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleToggle = () => {
    setIsOpen((prev) => !prev);
  };

  const handleMarkAllRead = () => {
    markAllNotificationsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleClear = () => {
    clearOpsNotifications();
    setNotifications([]);
  };

  return (
    <div className={`relative inline-block ${className}`} ref={dropdownRef}>
      {/* ── Sleek Bell Icon Button (No card border, seamless with X close button) ── */}
      <button
        type="button"
        onClick={handleToggle}
        className="relative p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 active:scale-95 transition-colors cursor-pointer group flex items-center justify-center"
        title="Database Activity & Ops Logs"
        aria-label="Open Notifications and DB Logs"
      >
        <Bell size={18} className="text-slate-300 group-hover:text-white transition-colors" />

        {/* Unread Badge — Plain White Text (Zero glowing neon) */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 text-white font-bold text-[10px] leading-none pointer-events-none select-none tracking-tight">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* ── Notification & DB Activity Popover ── */}
      {isOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute right-[-32px] sm:right-0 mt-2.5 w-[calc(92vw-32px)] sm:w-[380px] max-w-[380px] bg-[#070b14] border border-white/25 rounded-2xl shadow-[0_25px_80px_rgba(0,0,0,0.98)] z-[70] overflow-hidden animate-[fadeIn_0.15s_ease]"
          style={{ maxHeight: 'calc(100vh - 120px)' }}
        >
          {/* Header */}
          <div className="p-3.5 border-b border-white/15 bg-[#0f172a] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                <Database className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                  <span>DB Activity Logs</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping inline-block" />
                </h3>
                <p className="text-[10px] text-slate-400 font-medium">
                  {notifications.length} logged operations
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Mark all as read"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-300 hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Clear all logs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer ml-1"
                title="Close"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Logs List */}
          <div className="overflow-y-auto max-h-[360px] p-2 space-y-1.5 custom-scrollbar divide-y divide-white/5">
            {notifications.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs space-y-1">
                <Database className="w-6 h-6 text-slate-600 mx-auto" />
                <p className="font-semibold text-slate-300">No database events logged yet</p>
                <p className="text-[10px] text-slate-500">
                  Database updates, roll actions, and syncs appear here in real time.
                </p>
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`p-2.5 rounded-xl transition-all flex items-start gap-2.5 pt-2 ${
                    notif.read ? 'bg-slate-900/40 hover:bg-slate-900/70' : 'bg-cyan-950/20 hover:bg-cyan-950/30 border border-cyan-500/20'
                  }`}
                >
                  <div className="p-1.5 rounded-lg bg-slate-900 border border-white/10 shrink-0 mt-0.5">
                    {getCategoryIcon(notif.category)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-xs font-bold text-white truncate">
                        {notif.title}
                      </p>
                      <span className="text-[9.5px] font-mono text-slate-400 shrink-0">
                        {formatRelativeTime(notif.timestamp)}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-300 mt-0.5 line-clamp-2 leading-relaxed">
                      {notif.description}
                    </p>
                  </div>

                  {!notif.read && (
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,1)] shrink-0 mt-1.5" />
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-2.5 border-t border-white/10 bg-slate-900/70 flex items-center justify-between text-[10px] text-slate-400 font-mono">
            <span className="flex items-center gap-1 text-emerald-400 font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
              <span>Real-time DB Active</span>
            </span>
            <span>GapAnchor Ops</span>
          </div>
        </div>
      )}
    </div>
  );
}
