'use client';

import React, { useState, useEffect } from 'react';
import { X, Calendar, Video, Clock, MapPin, Users, FileText, CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onEventCreated: (event: any) => void;
  initialDate?: Date;
}

export default function CreateEventModal({ isOpen, onClose, onEventCreated, initialDate }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('11:00');
  const [conferenceType, setConferenceType] = useState<'google_meet' | 'teams' | 'zoom' | 'none'>('google_meet');
  const [attendeeInput, setAttendeeInput] = useState('');
  const [attendees, setAttendees] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const d = initialDate || new Date();
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      setDate(`${year}-${month}-${day}`);
    }
  }, [isOpen, initialDate]);

  if (!isOpen) return null;

  const handleAddAttendee = () => {
    const trimmed = attendeeInput.trim();
    if (!trimmed) return;
    if (trimmed.includes('@') && !attendees.includes(trimmed)) {
      setAttendees([...attendees, trimmed]);
      setAttendeeInput('');
    } else {
      toast.error('Please enter a valid email address');
    }
  };

  const handleKeyDownAttendee = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAddAttendee();
    }
  };

  const removeAttendee = (email: string) => {
    setAttendees(attendees.filter((a) => a !== email));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Event title is required');
      return;
    }
    if (!date) {
      toast.error('Event date is required');
      return;
    }

    setSubmitting(true);
    try {
      const startDateTime = new Date(`${date}T${startTime}:00`).toISOString();
      const endDateTime = new Date(`${date}T${endTime}:00`).toISOString();

      if (new Date(endDateTime) <= new Date(startDateTime)) {
        toast.error('End time must be after start time');
        setSubmitting(false);
        return;
      }

      const res = await fetch('/api/calendar/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary: title,
          description,
          location,
          startTime: startDateTime,
          endTime: endDateTime,
          conferenceType,
          attendees,
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success('Calendar event created successfully!', {
          description: conferenceType === 'google_meet' ? 'Google Meet link attached' : undefined,
        });
        onEventCreated(data.event);
        onClose();
        // Reset form
        setTitle('');
        setDescription('');
        setLocation('');
        setAttendees([]);
      } else {
        toast.error(data.error || 'Failed to create calendar event');
      }
    } catch (err: any) {
      toast.error(err.message || 'Network error creating event');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-5 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl border border-border/80 p-5 sm:p-7 shadow-2xl animate-slide-up"
        style={{ background: 'var(--surface-1)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5 pb-3 border-b border-border/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-cyan-500 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Calendar size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                Create New Event
              </h3>
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                Syncs with Google Calendar and Ops Schedule
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-white/10 transition-colors"
            style={{ color: 'var(--text-tertiary)' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div>
            <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
              Event Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Manhattan WMS Architecture & Wave Planning"
              className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm outline-none focus:border-cyan-500 transition-colors"
              style={{ background: 'var(--surface-2)', color: 'var(--text-primary)' }}
            />
          </div>

          {/* Date & Time Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
                Date *
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-cyan-500"
                style={{ background: 'var(--surface-2)', color: 'var(--text-primary)' }}
              />
            </div>
            <div>
              <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
                Start Time
              </label>
              <input
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-cyan-500"
                style={{ background: 'var(--surface-2)', color: 'var(--text-primary)' }}
              />
            </div>
            <div>
              <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
                End Time
              </label>
              <input
                type="time"
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-cyan-500"
                style={{ background: 'var(--surface-2)', color: 'var(--text-primary)' }}
              />
            </div>
          </div>

          {/* Meeting Platform Selector */}
          <div>
            <label className="text-xs font-semibold mb-2 block" style={{ color: 'var(--text-secondary)' }}>
              Conferencing & Platform
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { type: 'google_meet', label: 'Google Meet', color: 'emerald', border: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400' },
                { type: 'teams', label: 'Teams', color: 'blue', border: 'border-blue-500/40 bg-blue-500/10 text-blue-400' },
                { type: 'zoom', label: 'Zoom', color: 'sky', border: 'border-sky-500/40 bg-sky-500/10 text-sky-400' },
                { type: 'none', label: 'In-Person / None', color: 'purple', border: 'border-purple-500/40 bg-purple-500/10 text-purple-400' },
              ].map((p) => {
                const isSelected = conferenceType === p.type;
                return (
                  <button
                    key={p.type}
                    type="button"
                    onClick={() => setConferenceType(p.type as any)}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold border text-center transition-all ${
                      isSelected
                        ? `${p.border} ring-2 ring-cyan-500/40 font-bold shadow-md`
                        : 'border-border opacity-70 hover:opacity-100'
                    }`}
                    style={!isSelected ? { background: 'var(--surface-2)', color: 'var(--text-secondary)' } : {}}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Attendees */}
          <div>
            <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
              Attendees (Optional)
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="email"
                value={attendeeInput}
                onChange={(e) => setAttendeeInput(e.target.value)}
                onKeyDown={handleKeyDownAttendee}
                placeholder="colleague@gapanchor.com"
                className="flex-1 rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-cyan-500"
                style={{ background: 'var(--surface-2)', color: 'var(--text-primary)' }}
              />
              <button
                type="button"
                onClick={handleAddAttendee}
                className="px-3.5 py-2 text-xs font-bold rounded-xl bg-surface-3 hover:bg-surface-2 border border-border text-cyan-400 transition-colors"
              >
                Add
              </button>
            </div>
            {attendees.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {attendees.map((email) => (
                  <span
                    key={email}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono bg-cyan-500/10 border border-cyan-500/30 text-cyan-300"
                  >
                    {email}
                    <button
                      type="button"
                      onClick={() => removeAttendee(email)}
                      className="text-cyan-400 hover:text-rose-400"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Location */}
          <div>
            <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
              Location / Room (Optional)
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Training Lab 2 or Hyderabad Partner Hub"
              className="w-full rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-cyan-500"
              style={{ background: 'var(--surface-2)', color: 'var(--text-primary)' }}
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
              Agenda / Description (Optional)
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Meeting agenda, sandbox prerequisites, and session objectives..."
              className="w-full rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-cyan-500 resize-none"
              style={{ background: 'var(--surface-2)', color: 'var(--text-primary)' }}
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/50">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold rounded-xl hover:bg-white/5 transition-colors"
              style={{ color: 'var(--text-secondary)' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold rounded-xl bg-gradient-to-r from-cyan-500 via-indigo-600 to-cyan-500 hover:opacity-95 text-white shadow-lg shadow-cyan-500/20 disabled:opacity-50 transition-all cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Creating Event...</span>
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  <span>Create Calendar Event</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
