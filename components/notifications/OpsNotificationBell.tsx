'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Bell,
  CheckCircle2,
  Sparkles,
  RefreshCw,
  DollarSign,
  User,
  Trash2,
  X,
  Clock,
} from 'lucide-react';
import {
  OpsNotification,
  getOpsNotifications,
  clearOpsNotifications,
  markAllNotificationsRead,
} from '../../lib/notifications-store';

function formatRelativeTime(isoString: string): string {
  try {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 45) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHour < 24) return `${diffHour}h ago`;
    return `${diffDay}d ago`;
  } catch {
    return 'Recently';
  }
}

export function OpsNotificationBell({ className = '' }: { className?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<OpsNotification[]>([]);
  const popoverRef = useRef<HTMLDivElement | null>(null);

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

    const handleLeadUpdated = (e: any) => {
      const detail = e.detail;
      if (!detail) return;
      // Notifications store will auto-update or refresh
      setNotifications(getOpsNotifications());
    };

    window.addEventListener('gapanchor:notification-updated', handleUpdate);
    window.addEventListener('gapanchor:lead-updated', handleLeadUpdated);

    return () => {
      window.removeEventListener('gapanchor:notification-updated', handleUpdate);
      window.removeEventListener('gapanchor:lead-updated', handleLeadUpdated);
    };
  }, []);

  // Close when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isOpen) {
      markAllNotificationsRead();
    }
    setIsOpen((prev) => !prev);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    clearOpsNotifications();
  };

  const getCategoryIcon = (category: OpsNotification['category']) => {
    switch (category) {
      case 'pipeline':
      case 'lead':
        return <User className="w-3.5 h-3.5 text-cyan-400" />;
      case 'sync':
        return <RefreshCw className="w-3.5 h-3.5 text-blue-400" />;
      case 'finance':
        return <DollarSign className="w-3.5 h-3.5 text-emerald-400" />;
      case 'system':
      default:
        return <Sparkles className="w-3.5 h-3.5 text-purple-400" />;
    }
  };

  return (
    <div className={`relative inline-flex items-center ${className}`} ref={popoverRef}>
      {/* Bell Icon Trigger Button */}
      <button
        type="button"
        onClick={handleToggle}
        className="relative p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 active:scale-95 transition-all cursor-pointer flex items-center justify-center group"
        title="Recent Activity & Notifications"
        aria-label="Recent Activity Notifications"
      >
        <Bell className="w-4 h-4 text-slate-200 group-hover:text-cyan-300 transition-colors" />

        {/* Unread Glow Ping Badge */}
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,1)]" />
          </span>
        )}
      </button>

      {/* Floating Dropdown Popover */}
      {isOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute left-0 sm:left-auto sm:right-0 top-full mt-2 w-[320px] sm:w-[350px] bg-slate-950/98 backdrop-blur-2xl border border-white/20 rounded-2xl shadow-[-10px_20px_50px_rgba(0,0,0,0.85),0_0_25px_rgba(34,211,238,0.15)] z-50 overflow-hidden animate-[fadeIn_0.15s_ease-out]"
        >
          {/* Popover Header */}
          <div className="p-3 border-b border-white/10 bg-slate-900/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-300">
                <Bell className="w-3.5 h-3.5" />
              </div>
              <h3 className="text-xs font-bold text-white tracking-tight flex items-center gap-1.5">
                <span>Recent Changes</span>
                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  Top 5
                </span>
              </h3>
            </div>

            <div className="flex items-center gap-1">
              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="px-2 py-1 rounded-md text-[10px] font-semibold text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors flex items-center gap-1 cursor-pointer"
                  title="Clear notification history"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Clear</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Notifications List (Top 5) */}
          <div className="max-h-[340px] overflow-y-auto divide-y divide-white/5 scrollbar-thin">
            {notifications.length === 0 ? (
              <div className="py-8 px-4 text-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-400/60 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-300">All caught up</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  No recent changes or notifications
                </p>
              </div>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.id}
                  className="p-3 hover:bg-white/[0.04] transition-colors flex items-start gap-2.5 group"
                >
                  <div className="w-6 h-6 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0 mt-0.5 group-hover:border-cyan-500/40 transition-colors">
                    {getCategoryIcon(item.category)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-xs font-bold text-white truncate group-hover:text-cyan-200 transition-colors">
                        {item.title}
                      </h4>
                      <span className="text-[10px] text-slate-500 flex items-center gap-0.5 shrink-0 whitespace-nowrap">
                        <Clock className="w-2.5 h-2.5" />
                        {formatRelativeTime(item.timestamp)}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-snug mt-0.5 line-clamp-2">
                      {item.description}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Popover Footer */}
          <div className="p-2 border-t border-white/10 bg-slate-950/80 text-center">
            <span className="text-[10px] text-slate-500 font-medium">
              Real-time activity log • Top 5 most recent actions
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default OpsNotificationBell;
