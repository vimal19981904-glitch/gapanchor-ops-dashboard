'use client';

import React, { useState } from 'react';
import {
  X,
  FileText,
  UploadCloud,
  Sparkles,
  PhoneCall,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  MessageCircle,
  Copy,
  Check,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';

interface TranscriptUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  enquiryId?: string;
  defaultCandidateName?: string;
  defaultCandidateEmail?: string;
  defaultCandidatePhone?: string;
  onSuccess?: () => void;
}

const SAMPLE_TRANSCRIPT = `IT support _ Training - Shorya Garg-20261018_065728-Meeting Transcript
18 October 2026, 01:27am
24m 10s

GapAnchor Ownership started transcription

GapAnchor Ownership   0:15
Hi Shorya, thanks for joining! Let's discuss your background and what you are looking to learn in Manhattan Active WMS.

Shorya Garg   0:35
Thanks Arul. I've been working on SAP WM for 3 years, but our client is migrating everything to Manhattan Active WMS in North America. My manager said I need to lead the configuration before our November cutover.

GapAnchor Ownership   1:10
That makes sense. We cover the entire end-to-end architecture, ASN inbound, waving, and putaway logic. Do you have employer budget approval for the training?

Shorya Garg   1:45
Yes, our company has approved up to ₹50,000 for my training and certification, so fee is not an issue at all. My only concern is whether I get actual live cloud sandbox access to practice configurations, because recorded videos aren't enough for me.

GapAnchor Ownership   2:20
Every student receives their own 24/7 dedicated Manhattan sandbox instance with live configuration data, not shared demo recordings.

Shorya Garg   3:00
That's exactly what I need. Can I join the upcoming weekend batch starting this Saturday?

GapAnchor Ownership stopped transcription`;

export function TranscriptUploadModal({
  isOpen,
  onClose,
  enquiryId,
  defaultCandidateName = '',
  defaultCandidateEmail = '',
  defaultCandidatePhone = '',
  onSuccess,
}: TranscriptUploadModalProps) {
  const [tab, setTab] = useState<'paste' | 'upload'>('paste');
  const [transcriptText, setTranscriptText] = useState('');
  const [candidateName, setCandidateName] = useState(defaultCandidateName);
  const [candidateEmail, setCandidateEmail] = useState(defaultCandidateEmail);
  const [candidatePhone, setCandidatePhone] = useState(defaultCandidatePhone);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any | null>(null);
  const [copiedDraft, setCopiedDraft] = useState(false);

  if (!isOpen) return null;

  const handleUseSample = () => {
    setTranscriptText(SAMPLE_TRANSCRIPT);
    if (!candidateName) setCandidateName('Shorya Garg');
    if (!candidateEmail) setCandidateEmail('shorya.garg@gmail.com');
    if (!candidatePhone) setCandidatePhone('+91 98765 43210');
    toast.info('Sample transcript loaded.');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        setTranscriptText(text);
        toast.success(`Loaded file: ${file.name}`);
      }
    };
    reader.onerror = () => {
      toast.error('Failed to read file.');
    };
    reader.readAsText(file);
  };

  const handleProcess = async () => {
    if (!transcriptText.trim()) {
      toast.error('Please paste or upload a transcript first.');
      return;
    }

    try {
      setAnalyzing(true);
      setAnalysisResult(null);

      const res = await fetch('/api/leads/process-transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcriptText,
          enquiryId,
          candidateName: candidateName.trim() || undefined,
          candidateEmail: candidateEmail.trim() || undefined,
          candidatePhone: candidatePhone.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to process transcript');
      }

      setAnalysisResult(data.analysis);
      toast.success(`Score: ${data.analysis.score}/10! Lead updated in CRM.`);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Error analyzing transcript');
    } finally {
      setAnalyzing(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedDraft(true);
    setTimeout(() => setCopiedDraft(false), 2000);
    toast.success('WhatsApp message copied!');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-cyan-500/20 border border-indigo-500/30 flex items-center justify-center text-cyan-400">
              <PhoneCall className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>AI Call Intelligence & Transcript Parser</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  GAP AI Neural Engine
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Paste Teams meeting transcript to extract rubric score, battlecards & WhatsApp follow-up
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          
          {/* Tabs */}
          <div className="flex items-center justify-between">
            <div className="flex rounded-xl bg-slate-950/80 p-1 border border-slate-800">
              <button
                type="button"
                onClick={() => setTab('paste')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  tab === 'paste'
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileText className="w-3.5 h-3.5 text-cyan-400" />
                <span>Paste Text</span>
              </button>
              <button
                type="button"
                onClick={() => setTab('upload')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  tab === 'upload'
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <UploadCloud className="w-3.5 h-3.5 text-indigo-400" />
                <span>Upload File (.vtt / .txt)</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleUseSample}
              className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 font-semibold cursor-pointer underline underline-offset-4"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Insert Sample Transcript</span>
            </button>
          </div>

          {/* Input Area */}
          {tab === 'paste' ? (
            <textarea
              value={transcriptText}
              onChange={(e) => setTranscriptText(e.target.value)}
              placeholder="Paste raw Microsoft Teams transcript here (e.g. IT support _ Training - Candidate Name...)"
              rows={8}
              className="w-full p-4 rounded-xl bg-slate-950/80 border border-slate-800 focus:border-cyan-500/50 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none resize-none leading-relaxed"
            />
          ) : (
            <div className="border-2 border-dashed border-slate-800 hover:border-slate-700 rounded-xl p-8 flex flex-col items-center justify-center text-center bg-slate-950/40">
              <UploadCloud className="w-10 h-10 text-slate-500 mb-2" />
              <p className="text-xs font-semibold text-slate-300 mb-1">
                Select Microsoft Teams Transcript file
              </p>
              <p className="text-[11px] text-slate-500 mb-4">
                Supports .vtt, .txt, or plain text export
              </p>
              <label className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white cursor-pointer border border-slate-700 transition-colors shadow-sm">
                Browse File
                <input
                  type="file"
                  accept=".vtt,.txt,.docx,.text"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
              {transcriptText && (
                <p className="text-xs text-emerald-400 mt-3 font-semibold">
                  ✓ File loaded ({transcriptText.length} characters)
                </p>
              )}
            </div>
          )}

          {/* Candidate Override Controls */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-950/40 p-3 rounded-xl border border-slate-800/80">
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Candidate Name (Optional)</label>
              <input
                type="text"
                value={candidateName}
                onChange={(e) => setCandidateName(e.target.value)}
                placeholder="Auto-detected from transcript"
                className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Email (For CRM Linking)</label>
              <input
                type="email"
                value={candidateEmail}
                onChange={(e) => setCandidateEmail(e.target.value)}
                placeholder="candidate@company.com"
                className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Phone Number</label>
              <input
                type="text"
                value={candidatePhone}
                onChange={(e) => setCandidatePhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50"
              />
            </div>
          </div>

          {/* Analysis Results Display */}
          {analysisResult && (
            <div className="bg-gradient-to-br from-slate-950 to-slate-900 border border-cyan-500/30 rounded-2xl p-5 space-y-4 shadow-xl animate-in fade-in slide-in-from-bottom-2 duration-300">
              
              {/* Score & Talk-Time Hero */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/40 flex items-center justify-center">
                    <span className="text-xl font-black text-emerald-400">{analysisResult.score}</span>
                    <span className="text-[10px] text-emerald-400/60 font-bold">/10</span>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <span>{analysisResult.candidateName}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                        {analysisResult.score >= 8 ? 'High Priority' : analysisResult.score >= 5 ? 'Warm Lead' : 'Follow Up'}
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">{analysisResult.clientNeed}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-right">
                  <div>
                    <div className="text-[10px] text-slate-400">Duration</div>
                    <div className="text-xs font-bold text-white font-mono">{analysisResult.durationMinutes} mins</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">Candidate Talk-Time</div>
                    <div className="text-xs font-bold text-teal-400 font-mono">{analysisResult.candidateTalkPct}%</div>
                  </div>
                </div>
              </div>

              {/* Summary */}
              <div>
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Executive Summary</div>
                <p className="text-xs text-slate-200 leading-relaxed bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                  {analysisResult.summary}
                </p>
              </div>

              {/* Rubric Breakdown Grid */}
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-800">
                  <div className="text-[10px] text-slate-400">Need</div>
                  <div className="text-xs font-bold text-cyan-400">{analysisResult.rubricBreakdown.need} / 3</div>
                </div>
                <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-800">
                  <div className="text-[10px] text-slate-400">Budget</div>
                  <div className="text-xs font-bold text-emerald-400">{analysisResult.rubricBreakdown.budget} / 3</div>
                </div>
                <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-800">
                  <div className="text-[10px] text-slate-400">Timeline</div>
                  <div className="text-xs font-bold text-indigo-400">{analysisResult.rubricBreakdown.timeline} / 2</div>
                </div>
                <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-800">
                  <div className="text-[10px] text-slate-400">Authority</div>
                  <div className="text-xs font-bold text-purple-400">{analysisResult.rubricBreakdown.decisionMaker} / 2</div>
                </div>
              </div>

              {/* Sales Battlecard (Counter-Pitch) */}
              <div className="bg-indigo-950/30 border border-indigo-500/30 rounded-xl p-3.5 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-300">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Objection Counter-Pitch (Sales Battlecard)</span>
                </div>
                <div className="text-[11px] text-slate-300">
                  <span className="font-semibold text-indigo-200">Objection: </span>
                  {analysisResult.objections}
                </div>
                <div className="text-xs text-indigo-100 bg-indigo-900/30 p-2 rounded-lg border border-indigo-500/20 leading-relaxed">
                  💡 {analysisResult.counterPitch}
                </div>
              </div>

              {/* WhatsApp Draft Preview */}
              <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-300">
                    <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                    <span>WhatsApp Follow-up Message</span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(analysisResult.whatsappDraft)}
                    className="flex items-center gap-1 text-[11px] text-emerald-300 hover:text-white font-semibold cursor-pointer"
                  >
                    {copiedDraft ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedDraft ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <p className="text-xs text-emerald-100/90 bg-emerald-900/20 p-2.5 rounded-lg border border-emerald-500/20 font-mono text-[11px]">
                  {analysisResult.whatsappDraft}
                </p>
                {candidatePhone && (
                  <a
                    href={`https://wa.me/${candidatePhone.replace(/[^\d]/g, '')}?text=${encodeURIComponent(analysisResult.whatsappDraft)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white transition-all shadow-md cursor-pointer"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>Send via WhatsApp</span>
                  </a>
                )}
              </div>

            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-950/70">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-700 transition-colors cursor-pointer"
          >
            {analysisResult ? 'Done' : 'Cancel'}
          </button>

          <button
            onClick={handleProcess}
            disabled={analyzing || !transcriptText.trim()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-xs font-bold text-white shadow-lg cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {analyzing ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Analyzing & Scoring...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>{analysisResult ? 'Re-Analyze Transcript' : 'Analyze & Sync to CRM'}</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
