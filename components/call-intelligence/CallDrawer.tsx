'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Phone,
  Mail,
  Calendar,
  Clock,
  Mic,
  ShieldCheck,
  CheckCircle2,
  Copy,
  Check,
  Flame,
  AlertCircle,
  Award,
  GraduationCap,
} from 'lucide-react';
import { CallVolumeMeter } from './CallVolumeMeter';
import { WhatsAppFollowupButton } from './WhatsAppFollowupButton';
import { RedFlagBadge } from './RedFlagBadge';

interface LeadCallRecord {
  id: string;
  callDate: string;
  durationMinutes: number;
  candidateTalkPct: number;
  score: number;
  summary: string;
  clientNeed?: string | null;
  budget?: string | null;
  timeline?: string | null;
  decisionMaker?: string | null;
  objections?: string | null;
  counterPitch?: string | null;
  verbatimQuotes?: string | null;
  whatsappDraft?: string | null;
  nextAction?: string | null;
}

interface CallDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  enquiry: any;
  onEnrollClick?: (enquiry: any) => void;
}

export function CallDrawer({
  isOpen,
  onClose,
  enquiry,
  onEnrollClick,
}: CallDrawerProps) {
  const [callHistory, setCallHistory] = useState<LeadCallRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedPitch, setCopiedPitch] = useState(false);

  useEffect(() => {
    if (isOpen && enquiry?.id) {
      setIsLoading(true);
      fetch(`/api/enquiries/call-intelligence?enquiryId=${enquiry.id}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.callTimeline) {
            setCallHistory(data.callTimeline);
          }
        })
        .catch((err) => console.error('Error fetching call timeline:', err))
        .finally(() => setIsLoading(false));
    }
  }, [isOpen, enquiry?.id]);

  if (!isOpen || !enquiry) return null;

  const latestCall = callHistory[0];
  const parsedQuotes = latestCall?.verbatimQuotes
    ? (typeof latestCall.verbatimQuotes === 'string'
        ? JSON.parse(latestCall.verbatimQuotes)
        : latestCall.verbatimQuotes)
    : null;

  const handleCopyPitch = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPitch(true);
    setTimeout(() => setCopiedPitch(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl h-full bg-slate-900/95 border-l border-slate-700/80 shadow-2xl flex flex-col overflow-hidden text-slate-100"
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-800 bg-slate-800/40 backdrop-blur-md flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                Call Intelligence
              </span>
              <RedFlagBadge
                enquiryId={enquiry.id}
                hasRedFlag={enquiry.hasRedFlag}
                redFlagReason={enquiry.redFlagReason}
                redFlagDismissed={enquiry.redFlagDismissed}
              />
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">{enquiry.participantName}</h2>
            <p className="text-xs text-slate-400 flex items-center gap-3 mt-1">
              <span>{enquiry.topic || enquiry.trainingType || 'Enterprise Training'}</span>
              <span>•</span>
              <span>{enquiry.country || 'Global'}</span>
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Toolbar */}
        <div className="px-6 py-3 bg-slate-800/20 border-b border-slate-800 flex items-center justify-between">
          <CallVolumeMeter
            enquiryId={enquiry.id}
            initialScore={enquiry.callScore || latestCall?.score || 0}
          />
          <div className="flex items-center gap-2">
            <WhatsAppFollowupButton
              phone={enquiry.phone}
              candidateName={enquiry.participantName}
              courseOrNeed={enquiry.topic}
              customDraft={latestCall?.whatsappDraft}
              compact
            />
            {onEnrollClick && (
              <button
                onClick={() => onEnrollClick(enquiry)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-sm"
              >
                <GraduationCap className="w-3.5 h-3.5" />
                <span>Enroll in Batch</span>
              </button>
            )}
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-slate-400 text-sm">
              Loading call intelligence...
            </div>
          ) : !latestCall ? (
            <div className="text-center py-12 px-4 rounded-xl border border-dashed border-slate-800">
              <Phone className="w-8 h-8 text-slate-500 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-300">No Call Intelligence Recorded Yet</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Once a Microsoft Teams call transcript is processed or webhook is triggered, the AI summary, rubric score, and objection battlecards will appear here.
              </p>
            </div>
          ) : (
            <>
              {/* Call Overview Metrics */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/50 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">Call Duration</div>
                    <div className="text-sm font-bold text-white">{latestCall.durationMinutes} mins</div>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/50 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-teal-500/10 text-teal-400 border border-teal-500/20">
                    <Mic className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">Candidate Talk-Time</div>
                    <div className="text-sm font-bold text-teal-300">{latestCall.candidateTalkPct}% of call</div>
                  </div>
                </div>
              </div>

              {/* Call Summary */}
              <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-700/40">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  AI Call Summary
                </div>
                <p className="text-sm text-slate-200 leading-relaxed">{latestCall.summary}</p>
              </div>

              {/* Discovery Matrix Grid */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-slate-800/20 border border-slate-800">
                  <span className="text-slate-400 font-medium block mb-1">Core Need:</span>
                  <span className="text-white font-semibold">{latestCall.clientNeed || 'Not specified'}</span>
                </div>
                <div className="p-3 rounded-lg bg-slate-800/20 border border-slate-800">
                  <span className="text-slate-400 font-medium block mb-1">Budget Readiness:</span>
                  <span className="text-emerald-400 font-semibold">{latestCall.budget || 'In evaluation'}</span>
                </div>
                <div className="p-3 rounded-lg bg-slate-800/20 border border-slate-800">
                  <span className="text-slate-400 font-medium block mb-1">Timeline Urgency:</span>
                  <span className="text-cyan-400 font-semibold">{latestCall.timeline || 'Flexible'}</span>
                </div>
                <div className="p-3 rounded-lg bg-slate-800/20 border border-slate-800">
                  <span className="text-slate-400 font-medium block mb-1">Decision Authority:</span>
                  <span className="text-indigo-300 font-semibold">{latestCall.decisionMaker || 'Self / Direct'}</span>
                </div>
              </div>

              {/* Objection Battlecard (Counter-Pitch) */}
              {latestCall.counterPitch && (
                <div className="p-4 rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-500/5 border border-amber-500/20">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300 uppercase tracking-wide">
                      <Flame className="w-3.5 h-3.5 text-amber-400" />
                      Sales Battlecard (Objection Pitch)
                    </div>
                    <button
                      onClick={() => handleCopyPitch(latestCall.counterPitch!)}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400 hover:text-white transition-colors"
                    >
                      {copiedPitch ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-400">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy Pitch</span>
                        </>
                      )}
                    </button>
                  </div>
                  {latestCall.objections && (
                    <div className="text-xs text-amber-200/80 mb-2 italic">
                      Objection: "{latestCall.objections}"
                    </div>
                  )}
                  <p className="text-xs text-slate-200 leading-relaxed bg-slate-900/40 p-3 rounded-lg border border-amber-500/10">
                    {latestCall.counterPitch}
                  </p>
                </div>
              )}

              {/* Verbatim Candidate Quotes */}
              {parsedQuotes && (
                <div className="p-4 rounded-xl bg-slate-800/20 border border-slate-800">
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Verbatim Candidate Quotes
                  </div>
                  <div className="space-y-2 text-xs">
                    {Object.entries(parsedQuotes).map(([key, val]) => (
                      <div key={key} className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80">
                        <span className="text-cyan-400 font-semibold uppercase text-[10px] block mb-0.5">
                          {key}
                        </span>
                        <span className="text-slate-300 italic">{String(val)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Multi-Call Timeline History */}
              {callHistory.length > 1 && (
                <div className="pt-2">
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                    Multi-Call History ({callHistory.length} calls)
                  </div>
                  <div className="space-y-2.5">
                    {callHistory.map((call, idx) => (
                      <div
                        key={call.id}
                        className="p-3 rounded-xl bg-slate-800/30 border border-slate-800 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center font-bold text-slate-400 text-[10px]">
                            #{callHistory.length - idx}
                          </span>
                          <div>
                            <span className="font-semibold text-white">
                              {new Date(call.callDate).toLocaleDateString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </span>
                            <span className="text-slate-400 text-[11px] block">{call.durationMinutes} min call</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-cyan-400">{call.score}/10</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
