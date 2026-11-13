'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  X,
  Sparkles,
  Brain,
  Radio,
  Send,
  Loader2,
  ShieldCheck,
  Zap,
  ChevronDown,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  speakJarvis,
  prepareJarvisSpeech,
  stopJarvis,
  getJarvisVoice,
  getJarvisGreeting,
  getJarvisThinkingPhrase,
  formatHumanizedJarvisBriefing,
  getJarvisVoiceProfiles,
  getActiveVoice,
  setActiveVoice,
  subscribeJarvisVoiceChange,
  JarvisVoiceProfile,
} from '@/lib/jarvis-speech';
import {
  startActivePromptListening,
  pauseWakeWordMonitor,
  stopAllListening,
  isSpeechRecognitionSupported,
  isActionablePrompt,
} from '@/lib/jarvis-listener';
import { JarvisArcReactor } from '@/components/call-intelligence/JarvisArcReactor';

export type JarvisStage =
  | 'idle'
  | 'greeting'
  | 'listening'
  | 'acknowledging'
  | 'thinking'
  | 'speaking_output';

interface JarvisVoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPromptExecute: (prompt: string) => Promise<{ answer: string; actionAdvice?: string | null; matchedIds?: string[] } | null>;
  wakeWordEnabled: boolean;
  onToggleWakeWord: () => void;
  initialPrompt?: string | null;
  onClearInitialPrompt?: () => void;
}

export function JarvisVoiceModal({
  isOpen,
  onClose,
  onPromptExecute,
  wakeWordEnabled,
  onToggleWakeWord,
  initialPrompt,
  onClearInitialPrompt,
}: JarvisVoiceModalProps) {
  const [stage, setStage] = useState<JarvisStage>('idle');
  const [transcript, setTranscript] = useState('');
  const [history, setHistory] = useState<{ sender: 'jarvis' | 'user'; text: string }[]>([]);
  const [micSupported, setMicSupported] = useState(true);
  const [voiceName, setVoiceName] = useState<string>('Brian (ChatGPT Human)');
  const [activeVoice, setActiveVoiceState] = useState<JarvisVoiceProfile>(getActiveVoice());
  const [showVoiceMenu, setShowVoiceMenu] = useState(false);
  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null);

  // Check speech recognition support and voice name
  useEffect(() => {
    setMicSupported(isSpeechRecognitionSupported());
    const voice = getActiveVoice();
    setActiveVoiceState(voice);
    setVoiceName(voice.name);

    const unsubscribe = subscribeJarvisVoiceChange((v) => {
      setActiveVoiceState(v);
      setVoiceName(v.name);
    });
    return unsubscribe;
  }, []);

  // When modal opens, handle either initialPrompt or greeting sequence
  useEffect(() => {
    if (isOpen) {
      const voice = getJarvisVoice();
      if (voice) setVoiceName(voice.name);

      if (initialPrompt && initialPrompt.trim()) {
        const promptToRun = initialPrompt.trim();
        if (onClearInitialPrompt) onClearInitialPrompt();
        handleUserSpeechCompleted(promptToRun);
      } else {
        startGreetingSequence();
      }
    } else {
      pauseWakeWordMonitor();
      stopJarvis();
      setStage('idle');
      setTranscript('');
    }
  }, [isOpen]);

  const stripJarvisGreetingPrefix = (raw: string) =>
    raw
      .replace(
        /^(?:(?:hey|hi|hello|ok|okay)?\s*(?:jarvis|javis)[,.]?\s*)?(?:online\s*,?\s*sir\.?\s*,?\s*ready\.?\s*|online\s*,?\s*sir\.?\s*|online\s*,?\s*ready\.?\s*|online\s*,?\s*so\.?\s*|right\s+away\s*,?\s*sir\.?\s*|ready\s*,?\s*sir\.?\s*|online\.?\s*)/i,
        ''
      )
      .trim();

  const startGreetingSequence = () => {
    // Stage is greeting while Jarvis announces ready; mic is only opened on greeting completion to prevent self-echo capture
    setStage('greeting');
    setTranscript('');

    speakJarvis('Online, sir. Ready.', {
      includeIntro: false,
      onStart: () => setStage('greeting'),
      onEnd: () => {
        setStage('listening');
        startListeningForUserPrompt();
      },
      onError: () => {
        setStage('listening');
        startListeningForUserPrompt();
      },
    });
  };

  const startListeningForUserPrompt = () => {
    stopJarvis();
    if (!isSpeechRecognitionSupported()) {
      toast.error('Microphone voice recognition requires Google Chrome or Microsoft Edge.');
      setStage('idle');
      return;
    }

    setStage('listening');
    setTranscript('');

    startActivePromptListening({
      onStart: () => {
        setStage('listening');
      },
      onInterim: (text) => {
        // Instant Barge-In: if user speaks any word, immediately stop Jarvis!
        if (text && text.trim().length > 0) {
          stopJarvis();
          setStage('listening');
        }
        setTranscript(text);
      },
      onFinal: (finalText) => {
        handleUserSpeechCompleted(finalText);
      },
      onError: (errText) => {
        if (errText.includes('Microphone access denied')) {
          toast.error(errText);
          setStage('idle');
        } else {
          console.warn('Speech notice:', errText);
        }
      },
      onEnd: () => {
        // Recognition cycle ends; handled by onFinal
      },
    });
  };

  const handleUserSpeechCompleted = async (finalText: string) => {
    if (!finalText || !finalText.trim()) {
      setStage('listening');
      return;
    }

    const clean = stripJarvisGreetingPrefix(finalText.trim());
    if (!clean || !isActionablePrompt(clean)) {
      console.log('Ignored greeting echo or non-actionable speech fragment in modal:', finalText);
      startListeningForUserPrompt();
      return;
    }

    pauseWakeWordMonitor();
    setTranscript(clean);
    setHistory((prev) => [...prev, { sender: 'user', text: clean }]);

    // Acknowledge user: "One minute, sir. Checking the details now."
    const ack = getJarvisThinkingPhrase();
    setStage('acknowledging');

    // Launch Gemini analysis in parallel while Jarvis speaks acknowledgment
    const promptPromise = onPromptExecute(finalText);

    speakJarvis(ack, {
      includeIntro: false,
      onStart: () => setStage('acknowledging'),
      onEnd: async () => {
        setStage('thinking');
        try {
          const result = await promptPromise;
          if (result && result.answer) {
            setHistory((prev) => [...prev, { sender: 'jarvis', text: result.answer }]);
            setStage('speaking_output');

            // Read aloud with calibrated humanized Jarvis briefing
            const humanizedBriefing = formatHumanizedJarvisBriefing(result.answer, result.actionAdvice);
            prepareJarvisSpeech(humanizedBriefing);
            speakJarvis(humanizedBriefing, {
              includeIntro: false,
              onStart: () => setStage('speaking_output'),
              onEnd: () => {
                setStage('idle');
              },
              onError: () => {
                setStage('idle');
              },
            });
          } else {
            setStage('idle');
          }
        } catch (err: any) {
          console.error(err);
          setStage('idle');
          toast.error(err.message || 'Error processing request');
        }
      },
      onError: async () => {
        setStage('thinking');
        try {
          const result = await promptPromise;
          if (result && result.answer) {
            setHistory((prev) => [...prev, { sender: 'jarvis', text: result.answer }]);
            setStage('speaking_output');
            const humanizedBriefing = formatHumanizedJarvisBriefing(result.answer, result.actionAdvice);
            speakJarvis(humanizedBriefing, {
              includeIntro: false,
              onStart: () => setStage('speaking_output'),
              onEnd: () => setStage('idle'),
              onError: () => setStage('idle'),
            });
          } else {
            setStage('idle');
          }
        } catch (err: any) {
          console.error(err);
          setStage('idle');
          toast.error(err.message || 'Error processing request');
        }
      },
    });
  };

  const handleManualSendPrompt = () => {
    if (transcript.trim()) {
      handleUserSpeechCompleted(transcript.trim());
    }
  };

  const handleStopSpeech = () => {
    stopJarvis();
    stopAllListening();
    setStage('idle');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl animate-[fadeIn_0.2s_ease]">
      <div className="relative w-full max-w-lg bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 border border-cyan-500/40 rounded-3xl p-6 shadow-[0_0_50px_rgba(6,182,212,0.25)] flex flex-col items-center">
        {/* Top Header */}
        <div className="w-full flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 shadow-md shadow-cyan-500/20">
              <Brain className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-extrabold text-white tracking-wide uppercase">
                  J.A.R.V.I.S. Voice Interface
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                  96kbps Neural
                </span>
              </div>
              <div className="relative mt-1">
                <button
                  type="button"
                  onClick={() => setShowVoiceMenu(!showVoiceMenu)}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700 text-left cursor-pointer transition-all text-[11px] group"
                >
                  <Volume2 className="w-3.5 h-3.5 text-cyan-400 group-hover:scale-110 transition-transform" />
                  <span className="font-semibold text-slate-200 group-hover:text-white">
                    {activeVoice.name}
                  </span>
                  <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${showVoiceMenu ? 'rotate-180' : ''}`} />
                </button>

                {showVoiceMenu && (
                  <div className="absolute left-0 top-full mt-2 w-72 rounded-2xl bg-slate-900/95 backdrop-blur-xl border border-cyan-500/40 p-2 shadow-2xl z-50 animate-[fadeIn_0.15s_ease]">
                    <div className="px-2 py-1.5 border-b border-slate-800 mb-1 flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Select Neural Voice Persona
                      </span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300">
                        HD Studio
                      </span>
                    </div>

                    <div className="space-y-1">
                      {getJarvisVoiceProfiles().map((profile) => {
                        const isSelected = profile.id === activeVoice.id;
                        const isPreviewing = previewingVoiceId === profile.id;
                        return (
                          <div
                            key={profile.id}
                            onClick={() => {
                              setActiveVoice(profile.id);
                              setShowVoiceMenu(false);
                              toast.success(`Voice changed to ${profile.name}`);
                            }}
                            className={`p-2 rounded-xl flex items-center justify-between cursor-pointer transition-all border ${
                              isSelected
                                ? 'bg-cyan-950/40 border-cyan-500/50 text-white'
                                : 'bg-slate-800/40 border-transparent text-slate-300 hover:bg-slate-800 hover:text-white'
                            }`}
                          >
                            <div className="min-w-0 flex-1 pr-2">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold truncate">
                                  {profile.name}
                                </span>
                                {profile.recommended && (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                    ChatGPT
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-slate-400 truncate">
                                {profile.tagline}
                              </p>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  stopJarvis();
                                  setPreviewingVoiceId(profile.id);
                                  speakJarvis('Good day, sir. All neural speech systems are fully synchronized.', {
                                    voiceId: profile.id,
                                    includeIntro: false,
                                    onEnd: () => setPreviewingVoiceId(null),
                                    onError: () => setPreviewingVoiceId(null),
                                  });
                                }}
                                className={`p-1.5 rounded-lg border transition-all ${
                                  isPreviewing
                                    ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-cyan-300 border-slate-700'
                                }`}
                                title="Listen to voice preview"
                              >
                                <Volume2 className={`w-3.5 h-3.5 ${isPreviewing ? 'animate-bounce' : ''}`} />
                              </button>

                              {isSelected && (
                                <div className="p-1 text-cyan-400">
                                  <Check className="w-3.5 h-3.5" />
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ─── Living Particle Sphere Hologram Core ─── */}
        <div className="my-2 relative flex flex-col items-center justify-center">
          <JarvisArcReactor
            size={220}
            state={
              stage === 'greeting' || stage === 'speaking_output'
                ? 'speaking'
                : stage === 'thinking' || stage === 'acknowledging'
                ? 'thinking'
                : stage === 'listening'
                ? 'listening'
                : 'idle'
            }
            userTranscript={transcript}
            replyText={history.slice().reverse().find((h) => h.sender === 'jarvis')?.text || ''}
            audioLevel={stage === 'speaking_output' ? 0.7 : stage === 'listening' ? 0.45 : 0.05}
          />

          {/* Interactive Mic / Control Button */}
          <button
            type="button"
            onClick={() => {
              if (stage === 'idle') {
                startListeningForUserPrompt();
              } else if (stage === 'listening') {
                if (transcript.trim()) {
                  handleUserSpeechCompleted(transcript.trim());
                } else {
                  startListeningForUserPrompt();
                }
              } else if (stage === 'greeting') {
                stopJarvis();
                startListeningForUserPrompt();
              } else if (stage === 'speaking_output' || stage === 'acknowledging') {
                handleStopSpeech();
              }
            }}
            className={`mt-2 px-3 py-1.5 rounded-full flex items-center gap-2 text-xs font-bold transition-all cursor-pointer border ${
              stage === 'listening'
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 shadow-md shadow-rose-500/25 animate-pulse'
                : stage === 'speaking_output' || stage === 'greeting'
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-md shadow-cyan-500/25'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:border-cyan-400 hover:text-white'
            }`}
          >
            {stage === 'listening' ? (
              <>
                <Mic className="w-3.5 h-3.5 animate-pulse text-rose-400" />
                <span>Tap to Send Speech</span>
              </>
            ) : stage === 'speaking_output' || stage === 'greeting' ? (
              <>
                <Volume2 className="w-3.5 h-3.5 text-cyan-300" />
                <span>Tap to Interrupt</span>
              </>
            ) : stage === 'thinking' || stage === 'acknowledging' ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                <span>Thinking…</span>
              </>
            ) : (
              <>
                <Brain className="w-3.5 h-3.5 text-cyan-400" />
                <span>Tap to Speak</span>
              </>
            )}
          </button>
        </div>

        {/* ─── Real-Time Status Subtitle ─── */}
        <div className="text-center mb-3 space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 shadow-inner">
            {stage === 'greeting' && (
              <>
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                <span>Jarvis is greeting you…</span>
              </>
            )}
            {stage === 'listening' && (
              <>
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                <span className="text-rose-300 font-bold">Listening to your command… (Speak now)</span>
              </>
            )}
            {stage === 'acknowledging' && (
              <>
                <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
                <span>Jarvis: &ldquo;One minute, sir. Checking the details now…&rdquo;</span>
              </>
            )}
            {stage === 'thinking' && (
              <>
                <Loader2 className="w-3 h-3 text-cyan-400 animate-spin" />
                <span>Consulting GAP AI Engine…</span>
              </>
            )}
            {stage === 'speaking_output' && (
              <>
                <span className="flex items-end gap-0.5 h-3">
                  <span className="w-0.5 bg-cyan-400 rounded-full animate-[bounce_0.6s_ease-in-out_infinite] h-2" />
                  <span className="w-0.5 bg-cyan-400 rounded-full animate-[bounce_0.6s_ease-in-out_infinite_0.15s] h-3" />
                  <span className="w-0.5 bg-cyan-400 rounded-full animate-[bounce_0.6s_ease-in-out_infinite_0.3s] h-2" />
                </span>
                <span className="text-cyan-300 font-bold">Jarvis is reading executive briefing…</span>
              </>
            )}
            {stage === 'idle' && (
              <>
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                <span>Ready for next question</span>
              </>
            )}
          </div>
        </div>

        {/* ─── Quick Prompt Suggestions ─── */}
        <div className="w-full flex items-center justify-center gap-1.5 flex-wrap mb-3">
          {[
            'Interested candidates from transcripts',
            'Who should I call first today?',
            'High intent Manhattan WMS leads',
            'Show active red flags',
          ].map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => handleUserSpeechCompleted(chip)}
              className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-slate-900/90 hover:bg-cyan-950/60 border border-slate-800 hover:border-cyan-500/40 text-slate-300 hover:text-cyan-200 transition-all cursor-pointer"
            >
              &ldquo;{chip}&rdquo;
            </button>
          ))}
        </div>

        {/* ─── Real-Time Transcript & Dialogue Bubble ─── */}
        <div className="w-full min-h-[90px] max-h-44 overflow-y-auto p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2 text-xs">
          {history.map((msg, i) => (
            <div
              key={i}
              className={`flex flex-col ${
                msg.sender === 'user' ? 'items-end' : 'items-start'
              }`}
            >
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
                {msg.sender === 'user' ? 'You' : 'J.A.R.V.I.S.'}
              </span>
              <div
                className={`px-3 py-2 rounded-2xl max-w-[85%] leading-relaxed ${
                  msg.sender === 'user'
                    ? 'bg-gradient-to-r from-cyan-600 to-indigo-600 text-white rounded-tr-none'
                    : 'bg-slate-900 border border-slate-700/60 text-slate-200 rounded-tl-none'
                }`}
              >
                {msg.text}
              </div>
            </div>
          ))}

          {/* Live speaking preview */}
          {stage === 'listening' && (
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider mb-0.5">
                Speaking Live…
              </span>
              <div className="px-3 py-2 rounded-2xl bg-slate-800 border border-rose-500/40 text-white italic rounded-tr-none animate-pulse">
                {transcript ? (
                  <span className="text-cyan-300 font-medium not-italic">{transcript}</span>
                ) : (
                  <span className="text-slate-400 italic">Listening for your voice… (Speak your prompt or question)</span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ─── Bottom Interactive Control Bar ─── */}
        <div className="w-full mt-4 pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2.5">
          {/* Wake-Word Toggle */}
          <button
            type="button"
            onClick={onToggleWakeWord}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all cursor-pointer border ${
              wakeWordEnabled
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-sm'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
            }`}
            title="Auto-trigger when you say 'Hey Jarvis'"
          >
            <Radio className={`w-3.5 h-3.5 ${wakeWordEnabled ? 'text-cyan-400 animate-pulse' : 'text-slate-500'}`} />
            <span>Wake-Word &ldquo;Hey Jarvis&rdquo;: {wakeWordEnabled ? 'Active' : 'Off'}</span>
          </button>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {stage === 'listening' && (
              <button
                type="button"
                onClick={handleManualSendPrompt}
                disabled={!transcript.trim()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white text-xs font-bold shadow-md shadow-cyan-500/20 disabled:opacity-40 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send Prompt</span>
              </button>
            )}

            {(stage === 'speaking_output' || stage === 'greeting' || stage === 'acknowledging') && (
              <button
                type="button"
                onClick={handleStopSpeech}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md shadow-rose-500/20 cursor-pointer"
              >
                <VolumeX className="w-3.5 h-3.5" />
                <span>Stop Voice</span>
              </button>
            )}

            {stage === 'idle' && (
              <button
                type="button"
                onClick={startListeningForUserPrompt}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white text-xs font-bold shadow-md shadow-cyan-500/20 cursor-pointer"
              >
                <Mic className="w-3.5 h-3.5" />
                <span>Ask Another Question</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
