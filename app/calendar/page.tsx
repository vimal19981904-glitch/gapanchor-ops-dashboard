'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  isToday,
  parseISO,
  isWithinInterval,
} from 'date-fns';
import {
  Calendar as CalendarIcon,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  Filter,
  Video,
  ExternalLink,
  Clock,
  Users,
  MapPin,
  FileText,
  Copy,
  Check,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  CalendarDays,
  CalendarRange,
  ListFilter,
  X,
  Radio,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import CreateEventModal from '@/components/CreateEventModal';
import ConnectCalendarModal from '@/components/ConnectCalendarModal';
import { useTheme } from '@/components/ui/ThemeProvider';

interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  cleanDescription?: string;
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
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  scmProgram?: string;
  meetingId?: string;
  passcode?: string;
}

interface CalendarStatusData {
  connected: boolean;
  configured: boolean;
  email?: string | null;
}

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'list'>('month');
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [status, setStatus] = useState<CalendarStatusData>({ connected: false, configured: false });

  // Filtering & Search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [platformFilter, setPlatformFilter] = useState<'all' | 'google_meet' | 'teams' | 'zoom' | 'in_person'>('all');

  // Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState<boolean>(false);
  const [createInitialDate, setCreateInitialDate] = useState<Date>(new Date());
  const [copiedUrl, setCopiedUrl] = useState<boolean>(false);

  // Fetch events & connection status
  const fetchCalendarData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      const [statusRes, eventsRes] = await Promise.all([
        fetch('/api/calendar/status'),
        fetch('/api/calendar/events'),
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
        setEvents(eventsJson.events);
        if (eventsJson.events.length > 0 && !selectedEvent) {
          setSelectedEvent(eventsJson.events[0]);
        }
      }
    } catch (err) {
      console.error('Failed to load calendar events:', err);
      toast.error('Could not fetch calendar events');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedEvent]);

  useEffect(() => {
    fetchCalendarData();
  }, []);

  // Connect Google
  const handleConnectGoogle = () => {
    setIsConnectModalOpen(true);
  };

  // Disconnect Google
  const handleDisconnect = async () => {
    try {
      const res = await fetch('/api/calendar/disconnect', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        toast.success('Google Calendar disconnected');
        setStatus((prev) => ({ ...prev, connected: false, email: null }));
        fetchCalendarData();
      }
    } catch {
      toast.error('Failed to disconnect Google Calendar');
    }
  };

  // Date navigation handlers
  const handlePrev = () => {
    if (viewMode === 'month') {
      setCurrentDate((prev) => subMonths(prev, 1));
    } else {
      setCurrentDate((prev) => subWeeks(prev, 1));
    }
  };

  const handleNext = () => {
    if (viewMode === 'month') {
      setCurrentDate((prev) => addMonths(prev, 1));
    } else {
      setCurrentDate((prev) => addWeeks(prev, 1));
    }
  };

  const handleToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today);
  };

  // Open Create Modal for specific date
  const handleOpenCreateForDate = (date: Date) => {
    setCreateInitialDate(date);
    setIsCreateModalOpen(true);
  };

  const handleEventCreated = (newEvent: CalendarEvent) => {
    setEvents((prev) => [newEvent, ...prev]);
    setSelectedEvent(newEvent);
  };

  // Copy Join URL
  const handleCopyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(true);
    toast.success('Meeting join link copied to clipboard');
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  // Filtered Events
  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      // Platform filter
      if (platformFilter !== 'all') {
        if (platformFilter === 'in_person') {
          if (e.platform !== 'in_person') return false;
        } else if (e.platform !== platformFilter) {
          return false;
        }
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = e.title.toLowerCase().includes(q);
        const matchesDesc = e.description.toLowerCase().includes(q);
        const matchesLocation = e.location.toLowerCase().includes(q);
        const matchesAttendee = e.attendees.some(
          (a) => a.email.toLowerCase().includes(q) || (a.name && a.name.toLowerCase().includes(q))
        );
        if (!matchesTitle && !matchesDesc && !matchesLocation && !matchesAttendee) {
          return false;
        }
      }

      return true;
    });
  }, [events, platformFilter, searchQuery]);

  // Counts by platform
  const platformCounts = useMemo(() => {
    const counts = { all: events.length, google_meet: 0, teams: 0, zoom: 0, in_person: 0 };
    events.forEach((e) => {
      if (e.platform === 'google_meet') counts.google_meet++;
      else if (e.platform === 'teams') counts.teams++;
      else if (e.platform === 'zoom') counts.zoom++;
      else counts.in_person++;
    });
    return counts;
  }, [events]);

  // Month Grid Days calculation
  const monthDays = useMemo(() => {
    const startMonth = startOfMonth(currentDate);
    const endMonth = endOfMonth(startMonth);
    const startDate = startOfWeek(startMonth, { weekStartsOn: 0 }); // Sunday
    const endDate = endOfWeek(endMonth, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: startDate, end: endDate });
  }, [currentDate]);

  // Week Grid Days calculation
  const weekDays = useMemo(() => {
    const startW = startOfWeek(currentDate, { weekStartsOn: 0 });
    const endW = endOfWeek(currentDate, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: startW, end: endW });
  }, [currentDate]);

  // Helper: Events for a specific day
  const getEventsForDay = (day: Date) => {
    return filteredEvents.filter((e) => {
      try {
        const eventDate = parseISO(e.start);
        return isSameDay(eventDate, day);
      } catch {
        return false;
      }
    });
  };

  // Helper: Platform styling
  const getPlatformStyle = (platform: CalendarEvent['platform']) => {
    switch (platform) {
      case 'teams':
        return {
          name: 'Teams',
          badge: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
          dot: 'bg-blue-400',
          hoverBorder: 'hover:border-blue-500/50',
          btnClass: 'from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-500/20',
        };
      case 'zoom':
        return {
          name: 'Zoom',
          badge: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
          dot: 'bg-sky-400',
          hoverBorder: 'hover:border-sky-500/50',
          btnClass: 'from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white shadow-sky-500/20',
        };
      case 'google_meet':
        return {
          name: 'Google Meet',
          badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
          dot: 'bg-emerald-400',
          hoverBorder: 'hover:border-emerald-500/50',
          btnClass: 'from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-500/20',
        };
      case 'in_person':
      default:
        return {
          name: 'In-Person',
          badge: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
          dot: 'bg-purple-400',
          hoverBorder: 'hover:border-purple-500/50',
          btnClass: 'from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-purple-500/20',
        };
    }
  };

  // Time format
  const formatTimeSlot = (iso: string) => {
    try {
      return format(parseISO(iso), 'h:mm a');
    } catch {
      return '';
    }
  };

  return (
    <div className="min-h-screen w-full px-1 sm:px-4 md:px-8 py-2 sm:py-6 max-w-full space-y-3 sm:space-y-6 overflow-x-hidden">
      {/* ──── TOP HEADER & TOOLBAR ────────────────────────────────────── */}
      <header className="glass-card animate-fade-in p-2.5 sm:p-6 rounded-2xl sm:rounded-3xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4">
          {/* Brand & Back Navigation */}
          <div className="flex items-center gap-3 sm:gap-4">
            <Link
              href="/"
              className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-surface-2 hover:bg-surface-3 border border-border flex items-center justify-center transition-colors shrink-0 text-slate-300 hover:text-white"
              title="Return to Dashboard"
            >
              <ArrowLeft size={16} className="sm:w-4 sm:h-4" />
            </Link>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-2xl font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>
                  <span className="sm:hidden">Calendar Hub</span>
                  <span className="hidden sm:inline">Calendar & Events Hub</span>
                </h1>
                {status.connected ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full text-[10px] sm:text-xs font-semibold border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 max-w-[180px] sm:max-w-none truncate">
                    <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399] shrink-0" />
                    <span className="truncate">Google Calendar</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 sm:px-3 sm:py-1 rounded-full text-[9px] sm:text-xs font-semibold border border-amber-500/30 bg-amber-500/10 text-amber-400">
                    <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-amber-400 shrink-0" />
                    Sandbox
                  </span>
                )}
              </div>
              <p className="text-[10px] sm:text-xs font-medium truncate hidden sm:block" style={{ color: 'var(--text-tertiary)' }}>
                Training batches, client consultations, mock interviews & operational reviews
              </p>
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex items-center gap-2 flex-wrap justify-between sm:justify-end w-full sm:w-auto">
            {/* View Switcher */}
            <div className="flex items-center rounded-xl p-0.5 sm:p-1 border border-border" style={{ background: 'var(--surface-2)' }}>
              <button
                onClick={() => setViewMode('month')}
                className={`flex items-center gap-1 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all ${
                  viewMode === 'month'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <CalendarDays size={13} />
                <span>Month</span>
              </button>
              <button
                onClick={() => setViewMode('week')}
                className={`flex items-center gap-1 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all ${
                  viewMode === 'week'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <CalendarRange size={13} />
                <span>Week</span>
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`flex items-center gap-1 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all ${
                  viewMode === 'list'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <ListFilter size={13} />
                <span>Agenda</span>
              </button>
            </div>

            {/* Refresh */}
            <button
              onClick={() => fetchCalendarData(true)}
              disabled={refreshing}
              className="p-1.5 sm:p-2 rounded-xl border border-border bg-surface-2 hover:bg-surface-3 transition-colors text-slate-300 hover:text-white cursor-pointer"
              title="Refresh Calendar"
            >
              <RefreshCw size={15} className={refreshing ? 'animate-spin text-cyan-400' : ''} />
            </button>

            {/* Create Event Button */}
            <button
              onClick={() => handleOpenCreateForDate(new Date())}
              className="flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-[11px] sm:text-xs font-bold bg-gradient-to-r from-cyan-600 via-indigo-600 to-cyan-600 hover:opacity-95 text-white shadow-lg shadow-cyan-500/20 transition-all cursor-pointer"
            >
              <Plus size={14} />
              <span className="sm:hidden">New Event</span>
              <span className="hidden sm:inline">Create New Event</span>
            </button>
          </div>
        </div>

        {/* Search & Navigation Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 mt-3 sm:mt-5 pt-3 sm:pt-4 border-t border-border/50">
          {/* Navigation Month Controls */}
          <div className="flex items-center justify-between sm:justify-start gap-3 w-full sm:w-auto">
            <div className="flex items-center gap-1">
              <button
                onClick={handlePrev}
                className="p-1.5 rounded-xl border border-border bg-surface-2 hover:bg-surface-3 transition-colors text-slate-300 hover:text-white"
                title="Previous"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={handleNext}
                className="p-1.5 rounded-xl border border-border bg-surface-2 hover:bg-surface-3 transition-colors text-slate-300 hover:text-white"
                title="Next"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            <h2 className="text-base sm:text-xl font-black min-w-[140px] sm:min-w-[180px]" style={{ color: 'var(--text-primary)' }}>
              {format(currentDate, viewMode === 'week' ? 'MMMM yyyy' : 'MMMM yyyy')}
            </h2>

            <button
              onClick={handleToday}
              className="px-2.5 py-1 text-[11px] sm:text-xs font-bold rounded-lg border border-border hover:border-cyan-500/40 bg-surface-2 text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              Today
            </button>
          </div>

          {/* Search & Filters */}
          <div className="flex items-center gap-2.5 flex-1 max-w-md w-full">
            <div className="relative flex-1 w-full">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search events, topics, attendees..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-1.5 rounded-xl border border-border text-[11px] sm:text-xs outline-none focus:border-cyan-500 transition-colors"
                style={{ background: 'var(--surface-2)', color: 'var(--text-primary)' }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ──── MAIN 2-COLUMN LAYOUT ───────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-6 w-full max-w-full">
        {/* ──── MAIN CALENDAR GRID AREA (Col 1-9) ────────────── */}
        <main className="lg:col-span-8 xl:col-span-9 space-y-3 sm:space-y-4 w-full max-w-full">
          {/* Month View Grid (Apple iOS Calendar Design - Matching Image 2) */}
          {viewMode === 'month' && (
            <div className="glass-card p-1 sm:p-5 rounded-2xl sm:rounded-3xl w-full max-w-full">
              {/* Day Headers (S M T W T F S) */}
              <div className="grid grid-cols-7 gap-0.5 sm:gap-2 mb-2 text-center border-b border-border/40 pb-2">
                {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day, idx) => (
                  <div key={idx} className="text-[11px] sm:text-sm font-bold text-slate-400 uppercase tracking-wider">
                    <span className="hidden sm:inline">{day.slice(0, 3)}</span>
                    <span className="sm:hidden text-slate-300 font-extrabold">{day.slice(0, 1)}</span>
                  </div>
                ))}
              </div>

              {/* Day Cells Grid (Apple iOS Calendar Seamless Design) */}
              <div className="grid grid-cols-7 gap-0.5 sm:gap-2 w-full">
                {monthDays.map((day, i) => {
                  const dayEvents = getEventsForDay(day);
                  const isCurrentMonth = isSameMonth(day, currentDate);
                  const isSelected = isSameDay(day, selectedDate);
                  const isTodayDate = isToday(day);

                  return (
                    <div
                      key={i}
                      onClick={() => setSelectedDate(day)}
                      onDoubleClick={() => handleOpenCreateForDate(day)}
                      className={`min-h-[64px] sm:min-h-[140px] p-1 sm:p-1.5 rounded-xl transition-all cursor-pointer flex flex-col justify-start gap-0.5 sm:gap-1 ${
                        isSelected
                          ? 'bg-cyan-500/10 ring-1 ring-cyan-400/50 shadow-md'
                          : isCurrentMonth
                          ? 'hover:bg-surface-2/60'
                          : 'opacity-30 hover:opacity-60'
                      }`}
                    >
                      {/* Day Number Header (Apple Calendar style: Solid Red circle for Today, clean number for others) */}
                      <div className="flex items-center justify-center sm:justify-start w-full mb-0.5 sm:mb-1">
                        <span
                          className={`text-xs sm:text-sm font-bold inline-flex items-center justify-center ${
                            isTodayDate
                              ? 'w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-red-500 text-white font-black shadow-lg shadow-red-500/50 text-[11px] sm:text-sm'
                              : isSelected
                              ? 'w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-cyan-500 text-white font-bold text-[11px] sm:text-sm shadow-md shadow-cyan-500/30'
                              : isCurrentMonth
                              ? 'text-slate-200 px-0.5 sm:px-1'
                              : 'text-slate-500 px-0.5 sm:px-1'
                          }`}
                        >
                          {format(day, 'd')}
                        </span>
                      </div>

                      {/* Mobile Event Dots (Apple iOS Calendar style) */}
                      <div className="flex sm:hidden items-center justify-center gap-0.5 mt-0.5 flex-wrap">
                        {dayEvents.slice(0, 3).map((ev) => (
                          <span key={ev.id} className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_3px_#22d3ee]" />
                        ))}
                        {dayEvents.length > 3 && (
                          <span className="text-[7px] font-bold text-slate-400">+{dayEvents.length - 3}</span>
                        )}
                      </div>

                      {/* Event Chips (Apple iOS Calendar Stacked Blue Pill Style - Desktop & Tablet) */}
                      <div className="hidden sm:block space-y-1.5 w-full flex-1 overflow-y-auto max-h-[140px] pr-0.5 custom-scrollbar">
                        {dayEvents.map((ev) => {
                          const isCurrentSelected = selectedEvent?.id === ev.id;
                          const timeFormatted = formatTimeSlot(ev.start);

                          return (
                            <div
                              key={ev.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedEvent(ev);
                                setSelectedDate(day);
                              }}
                              className={`w-full px-1.5 py-1 rounded-md sm:rounded-lg text-left transition-all cursor-pointer border ${
                                isCurrentSelected
                                  ? 'bg-sky-500 text-white font-bold border-sky-300 shadow-md ring-1 ring-sky-300'
                                  : 'bg-sky-500/25 hover:bg-sky-500/40 border-sky-400/30 text-sky-100'
                              }`}
                              title={`${ev.title} (${ev.durationText})`}
                            >
                              <div className="text-[10px] sm:text-xs font-bold text-sky-100 truncate leading-snug">
                                {ev.title}
                              </div>
                              <div className="text-[9px] sm:text-[10px] font-semibold text-sky-300 truncate mt-0.5">
                                {timeFormatted || 'All Day'}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Selected Day Agenda (Visible beneath Month Grid for Instant Access) */}
              <div className="mt-4 pt-4 border-t border-border/60">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 flex items-center justify-center font-black text-xs shrink-0">
                      {format(selectedDate, 'd')}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5 truncate">
                        <span className="truncate">{format(selectedDate, 'EEEE, MMMM d, yyyy')}</span>
                        {isToday(selectedDate) && (
                          <span className="px-1.5 py-0.2 text-[9px] font-bold rounded-full bg-red-500/20 text-red-400 border border-red-500/30 shrink-0">
                            Today
                          </span>
                        )}
                      </h4>
                      <p className="text-[10px] sm:text-xs text-slate-400 truncate">
                        {getEventsForDay(selectedDate).length === 0
                          ? 'No meetings scheduled'
                          : `${getEventsForDay(selectedDate).length} session${getEventsForDay(selectedDate).length > 1 ? 's' : ''} on this day`}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleOpenCreateForDate(selectedDate)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-bold bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 transition-all shrink-0 cursor-pointer"
                  >
                    <Plus size={13} />
                    <span>Add Event</span>
                  </button>
                </div>

                {getEventsForDay(selectedDate).length === 0 ? (
                  <div className="p-4 rounded-2xl border border-dashed border-border/80 bg-surface-1/40 text-center">
                    <p className="text-xs text-slate-400 font-medium">
                      No meetings on {format(selectedDate, 'MMMM d')}.
                    </p>
                    <button
                      onClick={() => handleOpenCreateForDate(selectedDate)}
                      className="mt-1.5 text-xs font-bold text-cyan-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Plus size={12} /> Schedule New Event
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {getEventsForDay(selectedDate).map((ev) => {
                      const style = getPlatformStyle(ev.platform);
                      const isCurrentSelected = selectedEvent?.id === ev.id;
                      const timeFormatted = formatTimeSlot(ev.start);

                      return (
                        <div
                          key={ev.id}
                          onClick={() => setSelectedEvent(ev)}
                          className={`p-3 rounded-2xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
                            isCurrentSelected
                              ? 'border-cyan-500/60 bg-cyan-500/15 shadow-md ring-1 ring-cyan-400/40'
                              : 'border-border/80 bg-surface-2 hover:border-cyan-500/30'
                          }`}
                        >
                          <div className="flex items-start gap-2.5 min-w-0">
                            <div className="p-2 rounded-xl bg-surface-3 border border-border text-cyan-400 shrink-0 mt-0.5">
                              <Video size={14} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-bold text-white truncate">
                                  {ev.title}
                                </span>
                                <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold border shrink-0 ${style.badge}`}>
                                  {style.name}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400">
                                <Clock size={11} className="shrink-0" />
                                <span>{timeFormatted || 'All Day'}</span>
                                <span>•</span>
                                <span>{ev.durationText}</span>
                                {ev.location && (
                                  <>
                                    <span>•</span>
                                    <span className="truncate max-w-[150px]">{ev.location}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                            {ev.joinUrl && (
                              <a
                                href={ev.joinUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className={`inline-flex items-center gap-1 px-3 py-1 rounded-xl text-[11px] font-bold bg-gradient-to-r ${style.btnClass} transition-all no-underline shadow-sm`}
                              >
                                <span>JOIN</span>
                                <ExternalLink size={11} />
                              </a>
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedEvent(ev);
                              }}
                              className="px-2.5 py-1 rounded-xl text-[11px] font-semibold border border-border bg-surface-3 hover:bg-surface-2 text-slate-300 transition-colors"
                            >
                              Details
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Week View Grid */}
          {viewMode === 'week' && (
            <div className="glass-card p-3 sm:p-5 overflow-x-auto">
              <div className="grid grid-cols-7 gap-2 min-w-[650px]">
                {weekDays.map((day, i) => {
                  const dayEvents = getEventsForDay(day);
                  const isTodayDate = isToday(day);
                  const isSelected = isSameDay(day, selectedDate);

                  return (
                    <div
                      key={i}
                      onClick={() => setSelectedDate(day)}
                      className={`min-h-[400px] p-2 rounded-2xl border flex flex-col justify-between ${
                        isSelected
                          ? 'border-cyan-500/60 bg-cyan-500/5'
                          : 'border-border/80 bg-surface-1 hover:border-border'
                      }`}
                    >
                      {/* Day Header */}
                      <div className="text-center pb-2 border-b border-border/50">
                        <p className="text-[11px] font-bold text-slate-400">{format(day, 'EEE')}</p>
                        <p
                          className={`text-sm font-black mx-auto w-7 h-7 rounded-full flex items-center justify-center mt-1 ${
                            isTodayDate ? 'bg-red-500 text-white' : 'text-slate-200'
                          }`}
                        >
                          {format(day, 'd')}
                        </p>
                      </div>

                      {/* Events List */}
                      <div className="space-y-2 mt-2 flex-1 overflow-y-auto">
                        {dayEvents.map((ev) => {
                          const isCurrentSelected = selectedEvent?.id === ev.id;

                          return (
                            <div
                              key={ev.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedEvent(ev);
                              }}
                              className={`p-2 rounded-xl text-xs border cursor-pointer transition-all ${
                                isCurrentSelected
                                  ? 'bg-sky-500/40 border-sky-400 text-white font-bold shadow-md ring-1 ring-sky-300'
                                  : 'bg-sky-500/20 hover:bg-sky-500/35 border-sky-500/40 text-sky-200'
                              }`}
                            >
                              <p className="font-bold truncate">{ev.title}</p>
                              <p className="text-[10px] opacity-80 mt-0.5">
                                {formatTimeSlot(ev.start)} • {ev.durationText}
                              </p>
                            </div>
                          );
                        })}
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenCreateForDate(day);
                        }}
                        className="mt-2 w-full py-1 text-[11px] font-bold rounded-lg border border-dashed border-border hover:border-cyan-500/40 text-slate-400 hover:text-cyan-400 transition-colors text-center"
                      >
                        + Add
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Agenda / List View */}
          {viewMode === 'list' && (
            <div className="glass-card p-4 sm:p-6 space-y-3">
              <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
                Upcoming Sessions Schedule ({filteredEvents.length})
              </h3>
              {filteredEvents.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <CalendarIcon size={32} className="mx-auto mb-2 opacity-50 text-cyan-400" />
                  <p className="text-sm font-semibold">No events matching your search or filters</p>
                </div>
              ) : (
                filteredEvents.map((ev) => {
                  const style = getPlatformStyle(ev.platform);
                  const isCurrentSelected = selectedEvent?.id === ev.id;
                  const dayObj = parseISO(ev.start);

                  return (
                    <div
                      key={ev.id}
                      onClick={() => setSelectedEvent(ev)}
                      className={`p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        isCurrentSelected
                          ? 'border-cyan-500/60 bg-cyan-500/10 shadow-lg'
                          : 'border-border/80 bg-surface-2 hover:border-cyan-500/30'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 rounded-xl bg-surface-3 border border-border flex flex-col items-center justify-center shrink-0">
                          <span className="text-[10px] uppercase font-bold text-cyan-400">
                            {format(dayObj, 'MMM')}
                          </span>
                          <span className="text-base font-black text-white">{format(dayObj, 'd')}</span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                              {ev.title}
                            </h4>
                            <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${style.badge}`}>
                              {style.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                            <Clock size={12} />
                            <span>
                              {formatTimeSlot(ev.start)} ({ev.durationText})
                            </span>
                            {ev.location && (
                              <>
                                <span>•</span>
                                <span className="truncate">{ev.location}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {ev.joinUrl && (
                        <a
                          href={ev.joinUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r ${style.btnClass} transition-all no-underline shrink-0 justify-center`}
                        >
                          <span>JOIN</span>
                          <ExternalLink size={12} />
                        </a>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </main>

        {/* ──── RIGHT SIDEBAR: CONTROLS & SELECTED EVENT DETAILS (Col 10-12) ─── */}
        <aside className="lg:col-span-4 xl:col-span-3 space-y-5">
          {/* Selected Event Details Panel (When selected) */}
          {selectedEvent ? (
            <div className="glass-card p-5 sm:p-6 space-y-5 animate-slide-up sticky top-6">
              {/* Header: Platform & Close */}
              <div className="flex items-center justify-between pb-3 border-b border-border/50">
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border ${
                    getPlatformStyle(selectedEvent.platform).badge
                  }`}
                >
                  <Video size={13} />
                  <span>{selectedEvent.platformName}</span>
                </span>

                <div className="flex items-center gap-1">
                  <span className="text-[11px] font-medium text-slate-400">
                    Event Details
                  </span>
                </div>
              </div>

              {/* Title */}
              <div>
                <h3 className="text-base sm:text-lg font-black leading-snug" style={{ color: 'var(--text-primary)' }}>
                  {selectedEvent.title}
                </h3>
              </div>

              {/* One-Click Join Action (Primary CTA) */}
              {selectedEvent.joinUrl ? (
                <div className="p-4 rounded-2xl border border-cyan-500/40 bg-gradient-to-br from-cyan-500/15 via-indigo-500/10 to-transparent space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-cyan-300">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                      Live One-Click Join Available
                    </span>
                  </div>

                  <a
                    href={selectedEvent.joinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-black bg-gradient-to-r ${
                      getPlatformStyle(selectedEvent.platform).btnClass
                    } shadow-lg shadow-cyan-500/25 transition-all no-underline cursor-pointer`}
                  >
                    <span>JOIN {selectedEvent.platformName.toUpperCase()}</span>
                    <ExternalLink size={16} />
                  </a>

                  <button
                    onClick={() => handleCopyLink(selectedEvent.joinUrl!)}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-semibold border border-border hover:bg-surface-3 text-slate-300 transition-colors"
                  >
                    {copiedUrl ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                    <span>{copiedUrl ? 'Copied to Clipboard!' : 'Copy Meeting Link'}</span>
                  </button>
                </div>
              ) : (
                <div className="p-3.5 rounded-2xl border border-purple-500/30 bg-purple-500/10">
                  <p className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                    <MapPin size={14} />
                    <span>In-Person / Physical Location</span>
                  </p>
                  <p className="text-xs text-slate-300 mt-1">
                    {selectedEvent.location || 'GapAnchor Partner Training Center'}
                  </p>
                </div>
              )}

              {/* Date & Time info */}
              <div className="space-y-2.5 pt-2">
                <div className="flex items-center gap-2.5 text-xs text-slate-300">
                  <CalendarIcon size={15} className="text-cyan-400 shrink-0" />
                  <div>
                    <p className="font-bold" style={{ color: 'var(--text-primary)' }}>
                      {format(parseISO(selectedEvent.start), 'EEEE, MMMM d, yyyy')}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {formatTimeSlot(selectedEvent.start)} - {formatTimeSlot(selectedEvent.end)} ({selectedEvent.durationText})
                    </p>
                  </div>
                </div>

                {selectedEvent.location && (
                  <div className="flex items-center gap-2.5 text-xs text-slate-300">
                    <MapPin size={15} className="text-purple-400 shrink-0" />
                    <span className="truncate">{selectedEvent.location}</span>
                  </div>
                )}
              </div>

              {/* Description / Agenda & Extracted Booking Info */}
              {(selectedEvent.cleanDescription || selectedEvent.description) && (
                <div className="pt-3 border-t border-border/50">
                  <label className="text-[11px] font-bold uppercase tracking-wider block mb-1.5 text-slate-400">
                    Agenda & Customer Details
                  </label>
                  <div className="text-xs leading-relaxed text-slate-300 p-3 rounded-xl bg-surface-2 border border-border space-y-2">
                    {selectedEvent.scmProgram && (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-xs font-bold">
                        <span>📦 Program: {selectedEvent.scmProgram}</span>
                      </div>
                    )}
                    <p className="whitespace-pre-line text-xs font-medium">
                      {selectedEvent.cleanDescription || selectedEvent.description}
                    </p>
                  </div>
                </div>
              )}

              {/* Attendees */}
              {selectedEvent.attendees && selectedEvent.attendees.length > 0 && (
                <div className="pt-3 border-t border-border/50">
                  <label className="text-[11px] font-bold uppercase tracking-wider block mb-1.5 text-slate-400">
                    Attendees ({selectedEvent.attendees.length})
                  </label>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {selectedEvent.attendees.map((att, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-surface-2 border border-border/60 text-xs"
                      >
                        <div className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-300 flex items-center justify-center text-[10px] font-bold">
                          {(att.name || att.email).charAt(0).toUpperCase()}
                        </div>
                        <span className="text-xs truncate font-mono text-slate-300">
                          {att.name || att.email}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {/* Platform Filters Card */}
          <div className="glass-card p-4 sm:p-5">
            <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-tertiary)' }}>
              Filter By Platform
            </h3>
            <div className="space-y-1.5">
              {[
                { id: 'all', label: 'All Sessions', count: platformCounts.all, color: 'text-slate-300' },
                { id: 'google_meet', label: 'Google Meet', count: platformCounts.google_meet, color: 'text-emerald-400' },
                { id: 'teams', label: 'Microsoft Teams', count: platformCounts.teams, color: 'text-blue-400' },
                { id: 'zoom', label: 'Zoom', count: platformCounts.zoom, color: 'text-sky-400' },
                { id: 'in_person', label: 'In-Person', count: platformCounts.in_person, color: 'text-purple-400' },
              ].map((p) => {
                const active = platformFilter === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setPlatformFilter(p.id as any)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                      active
                        ? 'bg-cyan-500/15 border border-cyan-500/30 text-cyan-300'
                        : 'border border-transparent hover:bg-surface-2 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${p.color.replace('text-', 'bg-')}`} />
                      <span>{p.label}</span>
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-surface-3 border border-border/50 text-slate-300">
                      {p.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Account Status / Connect Card */}
          <div className="glass-card p-4 sm:p-5">
            <h3 className="text-xs font-bold uppercase tracking-wider mb-2.5" style={{ color: 'var(--text-tertiary)' }}>
              Google Calendar Account
            </h3>
            {status.connected ? (
              <div className="space-y-3">
                <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10">
                  <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold mb-1">
                    <CheckCircle2 size={14} />
                    <span>Connected & Synced</span>
                  </div>
                  <p className="text-[11px] font-mono text-slate-300 truncate">{status.email}</p>
                </div>
                <button
                  onClick={handleDisconnect}
                  className="w-full py-1.5 text-xs font-bold rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors"
                >
                  Disconnect Account
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-3 rounded-xl border border-border" style={{ background: 'var(--surface-2)' }}>
                  <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                    Sandbox Active
                  </p>
                  <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                    Connect your Google account to sync real personal/work calendar events.
                  </p>
                </div>
                <button
                  onClick={handleConnectGoogle}
                  className="w-full flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-xl bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/25 transition-all cursor-pointer shadow-md shadow-cyan-500/10"
                >
                  <Sparkles size={14} />
                  <span>Connect Google Calendar</span>
                </button>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Create Event Modal */}
      <CreateEventModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onEventCreated={handleEventCreated}
        initialDate={createInitialDate}
      />

      {/* Connect Calendar Modal */}
      <ConnectCalendarModal
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
        onConnected={() => fetchCalendarData()}
        defaultEmail="admin@gapanchor.com"
      />
    </div>
  );
}
