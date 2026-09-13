'use client';

import React, { useState } from 'react';
import { X, Calendar, Link2, CheckCircle2, Loader2, Sparkles, HelpCircle, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConnected: (email: string) => void;
  defaultEmail?: string;
}

export default function ConnectCalendarModal({ isOpen, onClose, onConnected, defaultEmail }: Props) {
  const [feedUrl, setFeedUrl] = useState('');
  const [email, setEmail] = useState(defaultEmail || 'admin@gapanchor.com');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedUrl.trim()) {
      toast.error('Please paste your Secret iCal Address');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/calendar/connect-feed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedUrl, email }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(data.message || 'Google Calendar connected successfully!');
        onConnected(email);
        onClose();
      } else {
        toast.error(data.error || 'Failed to connect feed');
      }
    } catch (err: any) {
      toast.error(err.message || 'Network error connecting calendar');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-md z-[9999] flex items-center justify-center p-3 sm:p-5 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-3xl border border-cyan-500/40 bg-[#0b1329] p-5 sm:p-7 shadow-2xl shadow-cyan-950/80 animate-slide-up text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-700/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 flex items-center justify-center shadow-lg shadow-cyan-500/20 shrink-0">
              <Calendar size={20} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white">
                Connect Live Google Calendar
              </h3>
              <p className="text-xs text-slate-400">
                Sync real-time meetings directly into your dashboard
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        {/* Instructions */}
        <div className="p-3.5 rounded-2xl border border-cyan-500/30 bg-cyan-500/10 mb-4 space-y-2 text-xs">
          <p className="font-bold text-cyan-300 flex items-center gap-1.5">
            <Sparkles size={14} /> How to get your Secret iCal URL (Takes 20 seconds):
          </p>
          <ol className="list-decimal list-inside space-y-1 text-slate-300 text-[11px] leading-relaxed pl-1">
            <li>Open Google Calendar (<a href="https://calendar.google.com" target="_blank" rel="noreferrer" className="text-cyan-400 underline font-semibold">calendar.google.com</a>)</li>
            <li>Click <strong>Settings (gear icon) → Settings</strong></li>
            <li>On the left under <strong>&ldquo;Settings for my calendars&rdquo;</strong>, click your calendar</li>
            <li>Scroll down to <strong>&ldquo;Secret address in iCal format&rdquo;</strong></li>
            <li>Copy that private link and paste it below:</li>
          </ol>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-300 mb-1.5 block">
              Calendar Account Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-900/90 px-3.5 py-2.5 text-xs text-white outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-300 mb-1.5 block">
              Secret Address in iCal format *
            </label>
            <input
              type="text"
              required
              placeholder="https://calendar.google.com/calendar/ical/.../basic.ics"
              value={feedUrl}
              onChange={(e) => setFeedUrl(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-900/90 px-3.5 py-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 font-mono"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Works seamlessly in both local development and production.
            </p>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-700/60">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-bold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold rounded-xl bg-gradient-to-r from-cyan-600 via-indigo-600 to-cyan-600 hover:opacity-95 text-white shadow-lg shadow-cyan-500/25 disabled:opacity-50 transition-all cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Connecting & Verifying Feed...</span>
                </>
              ) : (
                <>
                  <Link2 size={14} />
                  <span>Connect Real-Time Calendar</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
