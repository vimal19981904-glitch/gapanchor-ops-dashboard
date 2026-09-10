'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Calendar as CalendarIcon,
  Video,
  Clock,
  ExternalLink,
  ChevronRight,
  RefreshCw,
  Sparkles,
  Layers,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Plus
} from 'lucide-react';
import { toast } from 'sonner';
import CreateEventModal from '@/components/CreateEventModal';
import ConnectCalendarModal from '@/components/ConnectCalendarModal';

interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  location: string;
  start: string;
  end: string;
  isAllDay: boolean;
  durationText: string;
  platform: 'google_meet' | 'teams' | 'zoom' | 'in_person' | 'other';
  platformName: string;
  joinUrl: string | null;
  attendees: { email: string; name?: string }[];
  isDemo?: boolean;
}

interface CalendarStatusData {
  connected: boolean;
  configured: boolean;
  email?: string | null;
}

export default function CalendarWidget() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [status, setStatus] = useState<CalendarStatusData>({ connected: false, configured: false });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);

  const fetchCalendarData = useCallback(async (isSilent = false) => {
    if (!isSilent) setRefreshing(true);
    try {
      const [statusRes, eventsRes] = await Promise.all([
        fetch('/api/calendar/status'),
        fetch('/api/calendar/events?maxResults=4'),
      ]);

      const [statusJson, eventsJson] = await Promise.all([
        statusRes.json(),
        eventsRes.json(),
      ]);

      if (statusJson.success) {
        setStatus({
          connected: statusJson.connected,
          configured: statusJson.configured,
          email: statusJson.email,
        });
      }

      if (eventsJson.success && Array.isArray(eventsJson.events)) {
        setEvents(eventsJson.events.slice(0, 4));
      }
    } catch (err: any) {
      console.error('Error fetching calendar widget data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchCalendarData();

    // 5-minute auto-refresh interval
    const interval = setInterval(() => {
      fetchCalendarData(true);
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [fetchCalendarData]);

  const handleManualRefresh = () => {
    fetchCalendarData();
    toast.success('Upcoming events refreshed');
  };

  const handleEventCreated = (newEvent: any) => {
    setEvents((prev) => [newEvent, ...prev].slice(0, 4));
  };

  const handleConnectGoogle = () => {
    setIsConnectModalOpen(true);
  };

  // Helper for human-friendly date string
  const formatEventDate = (dateIso: string) => {
    const d = new Date(dateIso);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const eventDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());

    if (eventDay.getTime() === today.getTime()) {
      return 'Today';
    } else if (eventDay.getTime() === tomorrow.getTime()) {
      return 'Tomorrow';
    } else {
      return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
    }
  };

  // Helper for human-friendly time string (e.g. 2:00 PM - 3:00 PM)
  const formatTimeRange = (startIso: string, endIso: string, isAllDay: boolean) => {
    if (isAllDay) return 'All Day';
    const s = new Date(startIso);
    const e = new Date(endIso);

    const formatTime = (date: Date) =>
      date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });

    return `${formatTime(s)} - ${formatTime(e)}`;
  };

  // Platform badges
  const getPlatformBadge = (platform: CalendarEvent['platform']) => {
    switch (platform) {
      case 'teams':
        return {
          label: 'Teams',
          iconColor: '#3b82f6',
          badgeClass: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
        };
      case 'zoom':
        return {
          label: 'Zoom',
          iconColor: '#0ea5e9',
          badgeClass: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
        };
      case 'google_meet':
        return {
          label: 'Google Meet',
          iconColor: '#10b981',
          badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
        };
      case 'in_person':
      default:
        return {
          label: 'In-Person',
          iconColor: '#a855f7',
          badgeClass: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
        };
    }
  };

  return (
    <div className="glass-card animate-slide-up w-full mt-6 p-4 sm:p-6 transition-all duration-300">
      {/* Widget Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-4 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 flex items-center justify-center shadow-lg shadow-cyan-500/20 shrink-0">
            <CalendarIcon size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                Upcoming Events
              </h2>
              {status.connected ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Google Calendar ({status.email || 'Synced'})
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border border-cyan-500/30 bg-cyan-500/10 text-cyan-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                  Scheduled Feed (4 Upcoming)
                </span>
              )}
            </div>
            <p className="text-[10px] sm:text-xs" style={{ color: 'var(--text-tertiary)' }}>
              Next schedule batches, client syncs & corporate training sessions
            </p>
          </div>
        </div>

        {/* Top Header Actions */}
        <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
          {!status.connected && (
            <button
              onClick={handleConnectGoogle}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 transition-all cursor-pointer"
              title="Connect real Google Calendar via OAuth2"
            >
              <Sparkles size={13} />
              <span>Connect Google</span>
            </button>
          )}

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold border border-border/80 bg-surface-2 hover:bg-surface-3 transition-colors cursor-pointer"
            style={{ color: 'var(--text-primary)' }}
          >
            <Plus size={13} className="text-cyan-400" />
            <span>New Event</span>
          </button>

          <button
            onClick={handleManualRefresh}
            disabled={refreshing}
            className="p-1.5 rounded-xl border border-border/80 hover:bg-surface-2 transition-colors cursor-pointer"
            style={{ color: 'var(--text-tertiary)' }}
            title="Refresh events"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin text-cyan-400' : ''} />
          </button>

          <Link
            href="/calendar"
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-[11px] font-bold bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white shadow-md shadow-cyan-500/20 transition-all no-underline"
          >
            <span>View All Events</span>
            <ChevronRight size={13} />
          </Link>
        </div>
      </div>

      {/* Widget Content */}
      {loading ? (
        /* Loading Skeleton */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className="rounded-2xl border border-border p-4 animate-pulse flex flex-col justify-between h-24"
              style={{ background: 'var(--surface-2)' }}
            >
              <div className="h-4 bg-surface-3 rounded w-3/4 mb-2" />
              <div className="h-3 bg-surface-3 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : events.length === 0 ? (
        /* Empty State */
        <div className="text-center py-8 rounded-2xl border border-dashed border-border" style={{ background: 'var(--surface-2)' }}>
          <CalendarIcon size={32} className="mx-auto mb-2 text-cyan-400 opacity-60" />
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            No upcoming events scheduled
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
            Your calendar is clear for the next 30 days. Click "New Event" to add a session.
          </p>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/25 transition-all"
          >
            <Plus size={13} /> Add an Event
          </button>
        </div>
      ) : (
        /* 4 Events Compact Cards Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {events.map((event) => {
            const dateBadge = formatEventDate(event.start);
            const timeRange = formatTimeRange(event.start, event.end, event.isAllDay);
            const platformBadge = getPlatformBadge(event.platform);

            return (
              <div
                key={event.id}
                className="group relative rounded-2xl border border-border/80 p-3.5 sm:p-4 transition-all duration-200 hover:border-cyan-500/40 hover:shadow-lg hover:shadow-cyan-500/5 flex flex-col justify-between gap-2.5"
                style={{ background: 'var(--surface-2)' }}
              >
                {/* Event Title & Time (Line 1) */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border"
                      style={{
                        backgroundColor: `${platformBadge.iconColor}15`,
                        borderColor: `${platformBadge.iconColor}35`,
                        color: platformBadge.iconColor,
                      }}
                    >
                      <Video size={16} />
                    </div>
                    <div className="min-w-0">
                      <h4
                        className="text-xs sm:text-sm font-bold truncate group-hover:text-cyan-400 transition-colors"
                        style={{ color: 'var(--text-primary)' }}
                        title={event.title}
                      >
                        {event.title}
                      </h4>
                      <div className="flex items-center gap-1.5 mt-0.5 text-[11px] font-medium" style={{ color: 'var(--text-tertiary)' }}>
                        <Clock size={12} className="shrink-0" />
                        <span>{timeRange}</span>
                        {event.durationText && (
                          <>
                            <span>•</span>
                            <span>{event.durationText}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sub-row: Date | Platform Badge | Join Button */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/40">
                  <div className="flex items-center gap-2 flex-wrap text-[10px] font-semibold">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-surface-3 border border-border" style={{ color: 'var(--text-secondary)' }}>
                      📅 {dateBadge}
                    </span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border font-bold ${platformBadge.badgeClass}`}>
                      🔗 {platformBadge.label}
                    </span>
                  </div>

                  {event.joinUrl ? (
                    <a
                      href={event.joinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] sm:text-xs font-black bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 text-cyan-300 hover:text-white shadow-sm transition-all no-underline shrink-0"
                      title={`Join ${platformBadge.label} Meeting`}
                    >
                      <span>JOIN</span>
                      <ExternalLink size={11} />
                    </a>
                  ) : (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-lg text-slate-500 bg-slate-800/40 border border-slate-700/50 shrink-0">
                      In-Person
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Expand / View All Footer Bar */}
      <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between text-xs">
        <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
          Showing 4 upcoming sessions • Auto-refreshes every 5 mins
        </span>
        <Link
          href="/calendar"
          className="inline-flex items-center gap-1 font-bold text-cyan-400 hover:text-cyan-300 transition-colors no-underline text-xs"
        >
          <span>Expand Full Calendar View</span>
          <ChevronRight size={14} />
        </Link>
      </div>

      {/* Create Event Modal */}
      <CreateEventModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onEventCreated={handleEventCreated}
      />

      {/* Connect Real-Time Calendar Modal */}
      <ConnectCalendarModal
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
        onConnected={(email) => {
          fetchCalendarData();
        }}
        defaultEmail={status.email || 'xavierarul40@gmail.com'}
      />
    </div>
  );
}
