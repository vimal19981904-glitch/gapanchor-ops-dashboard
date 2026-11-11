'use client';

import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  PhoneCall,
  Calendar,
  Star,
  AlertTriangle,
  Flame,
  CheckCircle2,
  X,
  Search,
  Filter,
  ArrowRight,
  TrendingUp,
  MessageSquare,
  HelpCircle,
  Brain,
  Key,
  Copy,
  Check,
  ExternalLink,
  Loader2,
  Lightbulb,
  ShieldCheck,
  Zap,
  Radio,
  Mic,
  MicOff,
  RotateCcw,
  ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { analyzeEnquiryFollowUp, FollowUpAnalysis } from '@/lib/followup-intelligence';
import {
  speakJarvis,
  prepareJarvisSpeech,
  stopJarvis,
  unlockJarvisAudio,
  getLiveAudioFrequency,
  getJarvisGreeting,
  getJarvisThinkingPhrase,
  getJarvisFollowUpPhrase,
  getJarvisSignOffPhrase,
  isDismissalOrThankYou,
  formatHumanizedJarvisBriefing,
  isJarvisSpeaking,
  getJarvisVoiceProfiles,
  getActiveVoice,
  setActiveVoice,
  subscribeJarvisVoiceChange,
  JarvisVoiceProfile,
} from '@/lib/jarvis-speech';
import {
  startWakeWordMonitor,
  pauseWakeWordMonitor,
  stopWakeWordMonitor,
  startActivePromptListening,
  stopActivePromptListening,
  submitActiveRecorderNow,
  stopAllListening,
  isSpeechRecognitionSupported,
  isAnyVoiceInputSupported,
  isActionablePrompt,
  isJarvisSelfEchoOrFiller,
  JarvisListeningMode,
} from '@/lib/jarvis-listener';
import { JarvisOrb } from '@/components/call-intelligence/JarvisOrb';
import { JarvisArcReactor } from '@/components/call-intelligence/JarvisArcReactor';

export interface FollowUpFilterOption {
  id: 'all' | 'due_today' | 'high_intent' | 'demo_followup' | 'email_pending' | 'red_flags' | 'has_notes';
  label: string;
  count: number;
  icon: React.ElementType;
  color: string;
  bg: string;
  border: string;
}

export interface AiResponseData {
  answer: string;
  actionAdvice?: string | null;
  matchedIds: string[];
  recommendedFilter?: string | null;
  isRealAi: boolean;
  missingApiKey?: boolean;
  apiError?: string;
  model?: string;
  prompt: string;
}

interface FollowUpAssistantBarProps {
  enquiries: any[];
  activeFilter: string;
  onFilterChange: (filterId: string) => void;
  onSearchChange?: (term: string) => void;
  aiMatchedIds?: string[] | null;
  onAiMatchedIdsChange?: (ids: string[] | null) => void;
  className?: string;
}

export function FollowUpAssistantBar({
  enquiries,
  activeFilter,
  onFilterChange,
  onSearchChange,
  aiMatchedIds,
  onAiMatchedIdsChange,
  className = '',
}: FollowUpAssistantBarProps) {
  const [nlpQuery, setNlpQuery] = useState('');
  const [isAskingAi, setIsAskingAi] = useState(false);
  const [aiResponse, setAiResponse] = useState<AiResponseData | null>(null);
  const [copied, setCopied] = useState(false);

  // JARVIS Voice State
  const [isSpeakingJarvis, setIsSpeakingJarvis] = useState(false);
  const [autoSpeakJarvis, setAutoSpeakJarvis] = useState(false);
  const [wakeWordEnabled, setWakeWordEnabled] = useState(false);
  const [listeningMode, setListeningMode] = useState<JarvisListeningMode>('speech_api');
  const [liveAudioLevel, setLiveAudioLevel] = useState(0);

  // Inline JARVIS Voice Interface State (100% Inline — Zero Popup Windows)
  const [isVoiceModeActive, setIsVoiceModeActive] = useState(false);
  const [voiceStage, setVoiceStage] = useState<'idle' | 'greeting' | 'listening' | 'acknowledging' | 'thinking' | 'speaking_output'>('idle');
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [voiceStatusMessage, setVoiceStatusMessage] = useState('');

  // GAP AI Engine Key Configuration Modal
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [aiKeyInput, setAiKeyInput] = useState('');
  const [isSavingKey, setIsSavingKey] = useState(false);
  const [keyStatus, setKeyStatus] = useState<{ configured: boolean; model?: string; maskedKey?: string } | null>(null);

  const [activeVoice, setActiveVoiceState] = useState<JarvisVoiceProfile>(getActiveVoice());
  const [showVoiceMenu, setShowVoiceMenu] = useState(false);
  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null);
  const hasSpokenInCurrentTurnRef = useRef(false);

  // Subscribe to voice changes across components
  useEffect(() => {
    setActiveVoiceState(getActiveVoice());
    const unsub = subscribeJarvisVoiceChange((v) => setActiveVoiceState(v));
    return unsub;
  }, []);

  // Only enable background wake-word on mount when mic permission is ALREADY granted,
  // preventing unprompted HTTPS load failures or mic lock collisions on fresh visits.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const savedPref = localStorage.getItem('jarvis_wake_word_enabled');
    if (savedPref === 'false') {
      setWakeWordEnabled(false);
      return;
    }

    let cancelled = false;
    if (navigator.permissions?.query) {
      navigator.permissions
        .query({ name: 'microphone' as PermissionName })
        .then((perm) => {
          if (!cancelled && perm.state === 'granted') {
            setWakeWordEnabled(true);
          }
        })
        .catch(() => {});
    }
    return () => {
      cancelled = true;
    };
  }, []);

  // Stop voice and all listeners on component unmount
  useEffect(() => {
    return () => {
      stopJarvis();
      stopAllListening();
      stopWakeWordMonitor();
    };
  }, []);

  // User spec: 100% remove fire emoji '🔥' from High Quality Leads card
  useEffect(() => {
    const stripFireEmoji = () => {
      const allSpans = document.querySelectorAll('span');
      allSpans.forEach((el) => {
        if (el.textContent && el.textContent.includes('🔥')) {
          el.remove();
        }
      });
    };
    stripFireEmoji();
    const observer = new MutationObserver(stripFireEmoji);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, []);

  // Expose test hook for verification scripts
  useEffect(() => {
    (window as any).__testExecuteVoicePrompt = (prompt: string) => {
      setIsVoiceModeActive(true);
      handleExecuteVoicePrompt(prompt);
    };
  }, []);

  // Check GAP AI Engine status on mount
  useEffect(() => {
    fetch('/api/ai/config')
      .then((res) => res.json())
      .then((data) => {
        if (data.configured) {
          setKeyStatus({ configured: true, model: data.model, maskedKey: data.maskedKey });
        } else {
          setKeyStatus({ configured: false, model: data.model });
        }
      })
      .catch((err) => console.warn('Could not check AI engine key status:', err));
  }, []);

  // ─── Inline Voice Mode Core Handlers ───
  const stripJarvisGreetingPrefix = (raw: string) =>
    raw
      .replace(/^(?:online\s*,?\s*sir\.?\s*,?\s*ready\.?\s*)/i, '')
      .replace(/^(?:right\s+away\s*,?\s*sir\.?\s*)/i, '')
      .trim();

  const startListeningInline = () => {
    stopJarvis();
    setIsSpeakingJarvis(false);
    setLiveAudioLevel(0);

    if (!isAnyVoiceInputSupported()) {
      toast.error('Voice input requires Chrome, Edge, Safari, or a modern HTTPS browser.');
      setVoiceStage('idle');
      setVoiceStatusMessage('Voice capture is not supported in this browser.');
      return;
    }

    hasSpokenInCurrentTurnRef.current = false;
    setVoiceStage('listening');
    setVoiceTranscript('');
    setVoiceStatusMessage('Connecting microphone...');

    startActivePromptListening({
      onStart: () => {
        setVoiceStage('listening');
        setVoiceStatusMessage('Listening to you... Speak your command now.');
      },
      onModeChange: (mode) => {
        setListeningMode(mode);
      },
      onAudioLevel: (lvl) => {
        setLiveAudioLevel(lvl);
      },
      onProcessingAudio: () => {
        setLiveAudioLevel(0);
        setVoiceStage('thinking');
        setVoiceStatusMessage('Transcribing your voice...');
      },
      onInterim: (text) => {
        const cleaned = stripJarvisGreetingPrefix(text);
        if (!cleaned || isJarvisSelfEchoOrFiller(cleaned)) {
          return;
        }
        hasSpokenInCurrentTurnRef.current = true;
        // Instant Barge-In: if user speaks genuine words, immediately stop Jarvis!
        stopJarvis();
        setIsSpeakingJarvis(false);
        setVoiceTranscript(cleaned);
      },
      onFinal: (finalText) => {
        const cleaned = stripJarvisGreetingPrefix(finalText) || finalText.trim();
        hasSpokenInCurrentTurnRef.current = true;
        setLiveAudioLevel(0);
        handleExecuteVoicePrompt(cleaned);
      },
      onError: (errText) => {
        setLiveAudioLevel(0);
        setVoiceStage('idle');
        setVoiceStatusMessage(errText);
        toast.error(errText);
      },
      onEnd: () => {
        setLiveAudioLevel(0);
      },
    });
  };

  const handleOpenVoiceMode = () => {
    // Synchronously unlock Web Audio / SpeechSynthesis AND activate microphone inside the user click gesture!
    unlockJarvisAudio();
    pauseWakeWordMonitor();
    setIsVoiceModeActive(true);
    startListeningInline();

    // Non-blocking spoken greeting only if the user hasn't started speaking yet
    if (!hasSpokenInCurrentTurnRef.current) {
      speakJarvis('Online, sir. Ready.', {
        includeIntro: false,
        onStart: () => {
          if (!hasSpokenInCurrentTurnRef.current) {
            setIsSpeakingJarvis(true);
          } else {
            stopJarvis();
          }
        },
        onEnd: () => {
          setIsSpeakingJarvis(false);
        },
        onError: () => {
          setIsSpeakingJarvis(false);
        },
      });
    }
  };

  const handleCloseVoiceMode = () => {
    stopJarvis();
    stopAllListening();
    setIsSpeakingJarvis(false);
    setLiveAudioLevel(0);
    setIsVoiceModeActive(false);
    setVoiceStage('idle');
    setVoiceTranscript('');
    setVoiceStatusMessage('');
  };

  const handlePauseListening = () => {
    stopAllListening();
    setLiveAudioLevel(0);
    setVoiceStage('idle');
    setVoiceStatusMessage('Microphone paused. Tap Tap to Speak or choose a quick prompt.');
  };

  const handleResumeListening = () => {
    unlockJarvisAudio();
    startListeningInline();
  };

  const handleStopJarvisAudio = () => {
    stopJarvis();
    setIsSpeakingJarvis(false);
    if (voiceStage === 'speaking_output' || voiceStage === 'greeting' || voiceStage === 'acknowledging') {
      setVoiceStage('idle');
      setVoiceStatusMessage('Audio playback muted.');
    }
  };

  const isExecutingPromptRef = useRef(false);

  const handleExecuteVoicePrompt = async (promptText: string) => {
    if (!promptText || !promptText.trim()) {
      setVoiceStage('idle');
      return;
    }

    // Clean prompt: strip optional "Hey Jarvis" prefix so search engine gets clean inquiry
    let cleanPrompt = promptText.trim().replace(/^(?:hey|hi|hello|ok|okay)?\s*jarvis[,.]?\s*/i, '').trim();
    if (!cleanPrompt) {
      cleanPrompt = promptText.trim();
    }

    // Prevent executing accidental single-syllable noises, coughs, or self-echoes
    if (!isActionablePrompt(cleanPrompt)) {
      console.log('Filtered non-actionable voice fragment:', cleanPrompt);
      startListeningInline();
      return;
    }

    if (isExecutingPromptRef.current) {
      console.log('Voice prompt already running, skipping duplicate invocation.');
      return;
    }
    isExecutingPromptRef.current = true;

    try {
      stopAllListening();
      setLiveAudioLevel(0);
      setVoiceTranscript(cleanPrompt);
      setNlpQuery(cleanPrompt);

      // Check if the user is saying thank you or concluding
      if (isDismissalOrThankYou(cleanPrompt)) {
        setVoiceStage('speaking_output');
        const signOff = getJarvisSignOffPhrase();
        setVoiceStatusMessage(signOff);

        await speakJarvis(signOff, {
          includeIntro: false,
          onStart: () => setIsSpeakingJarvis(true),
          onEnd: () => setIsSpeakingJarvis(false),
          onError: () => setIsSpeakingJarvis(false),
        });

        handleCloseVoiceMode();
        return;
      }

      // 1. Immediately transition UI into active thinking state & launch Gemini query in parallel
      setVoiceStage('thinking');
      setIsAskingAi(true);
      setVoiceStatusMessage('Reasoning with GAP Gemini Neural Engine...');

      const thinkingStartTime = Date.now();

      const res = await fetch('/api/enquiries/ask-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: cleanPrompt }),
      });

      const data = await res.json();
      if (!res.ok || !data.success || !data.answer) {
        throw new Error(data?.error || 'Failed to process AI query');
      }

      const humanizedBriefing = formatHumanizedJarvisBriefing(data.answer, data.actionAdvice);
      const followUpPhrase = getJarvisFollowUpPhrase();
      const fullSpeech = `${humanizedBriefing} ${followUpPhrase}`;
      const prewarmPromise = prepareJarvisSpeech(fullSpeech);

      const elapsed = Date.now() - thinkingStartTime;
      if (elapsed < 2000) {
        await new Promise((r) => setTimeout(r, 2000 - elapsed));
      }
      try {
        await prewarmPromise;
      } catch {}

      let revealed = false;
      const revealBriefing = (audioStarted: boolean) => {
        if (revealed) return;
        revealed = true;
        setVoiceStage(audioStarted ? 'speaking_output' : 'idle');
        setVoiceStatusMessage(audioStarted ? 'Briefing executive team...' : 'Executive briefing ready.');
        setIsAskingAi(false);

        setAiResponse({
          answer: data.answer,
          actionAdvice: data.actionAdvice,
          matchedIds: data.matchedIds || [],
          recommendedFilter: data.recommendedFilter,
          isRealAi: Boolean(data.isRealGemini),
          missingApiKey: Boolean(data.missingApiKey),
          apiError: data.apiError,
          model: data.model,
          prompt: cleanPrompt,
        });

        onFilterChange('all');
        if (data.matchedIds && data.matchedIds.length > 0 && onAiMatchedIdsChange) {
          onAiMatchedIdsChange(data.matchedIds);
        }
        if (data.pipelineAction && typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('gapanchor:pipeline-action', { detail: data.pipelineAction })
          );
        }
      };

      setVoiceStatusMessage('Synthesizing neural voice...');

      await speakJarvis(fullSpeech, {
        includeIntro: false,
        onStart: () => {
          setIsSpeakingJarvis(true);
          revealBriefing(true);
        },
        onEnd: () => {
          setIsSpeakingJarvis(false);
          revealBriefing(false);
          startListeningInline();
        },
        onError: () => {
          setIsSpeakingJarvis(false);
          revealBriefing(false);
          startListeningInline();
        },
      });
    } catch (err: any) {
      console.error('Error in handleExecuteVoicePrompt:', err);
      setIsSpeakingJarvis(false);
      setIsAskingAi(false);
      setVoiceStage('idle');
      const errMsg = err?.message || 'Request encountered an issue.';
      setVoiceStatusMessage(errMsg);
      toast.error(errMsg);
    } finally {
      setIsAskingAi(false);
      isExecutingPromptRef.current = false;
    }
  };

  // Always-fresh refs so wake-word listener never fires stale closures
  const latestVoiceHandlersRef = useRef({
    openVoiceMode: handleOpenVoiceMode,
    executeVoicePrompt: handleExecuteVoicePrompt,
  });
  latestVoiceHandlersRef.current = {
    openVoiceMode: handleOpenVoiceMode,
    executeVoicePrompt: handleExecuteVoicePrompt,
  };

  // Background Always-On Wake Word Monitor ("Hey Jarvis")
  useEffect(() => {
    if (wakeWordEnabled && !isVoiceModeActive) {
      startWakeWordMonitor(
        (trailingPrompt?: string) => {
          if (trailingPrompt && trailingPrompt.trim().length > 0) {
            pauseWakeWordMonitor();
            setIsVoiceModeActive(true);
            latestVoiceHandlersRef.current.executeVoicePrompt(trailingPrompt.trim());
          } else {
            latestVoiceHandlersRef.current.openVoiceMode();
          }
        },
        (err: any) => {
          const code = err?.error;
          if (code === 'not-allowed' || code === 'service-not-allowed' || code === 'service-unavailable') {
            setWakeWordEnabled(false);
            if (typeof window !== 'undefined') {
              localStorage.setItem('jarvis_wake_word_enabled', 'false');
            }
          }
        }
      );
    } else {
      pauseWakeWordMonitor();
    }
  }, [wakeWordEnabled, isVoiceModeActive]);

  const handleToggleWakeWord = () => {
    unlockJarvisAudio();
    setWakeWordEnabled((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('jarvis_wake_word_enabled', String(next));
      }
      if (next) {
        toast.success('Jarvis always-listening active. Say "Hey Jarvis" to speak hands-free.');
      } else {
        toast.info('Jarvis background listening paused.');
      }
      return next;
    });
  };

  // ─── 1. Calculate Executive Metrics ───
  const metrics = useMemo(() => {
    let totalScore = 0;
    let scoredCount = 0;
    let dueTodayCount = 0;
    let highIntentCount = 0;
    let redFlagCount = 0;
    let demoFollowupCount = 0;
    let emailPendingCount = 0;
    let withNotesCount = 0;

    for (const e of enquiries) {
      if (typeof e.callScore === 'number' && e.callScore > 0) {
        totalScore += e.callScore;
        scoredCount++;
      }

      if (e.hasRedFlag && !e.redFlagDismissed) {
        redFlagCount++;
      }

      if (e.processedNotes && e.processedNotes.trim().length > 0) {
        withNotesCount++;
      }

      const analysis = analyzeEnquiryFollowUp(e);
      if (analysis.isDueTodayOrOverdue) {
        dueTodayCount++;
      }
      if (analysis.category === 'high_intent') {
        highIntentCount++;
      } else if (analysis.category === 'demo_followup') {
        demoFollowupCount++;
      } else if (analysis.category === 'whatsapp_missing' || analysis.category === 'email_pending') {
        emailPendingCount++;
      }
    }

    const avgScore = scoredCount > 0 ? (totalScore / scoredCount).toFixed(1) : '—';

    return {
      avgScore,
      scoredCount,
      dueTodayCount,
      highIntentCount,
      redFlagCount,
      demoFollowupCount,
      emailPendingCount,
      withNotesCount,
    };
  }, [enquiries]);

  // ─── 2. Filter Pills Definition ───
  const filterPills: FollowUpFilterOption[] = [
    {
      id: 'due_today',
      label: 'Due Today / Overdue',
      count: metrics.dueTodayCount,
      icon: Calendar,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/30',
    },
    {
      id: 'high_intent',
      label: 'High Intent (8-10 Score)',
      count: metrics.highIntentCount,
      icon: Flame,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/30',
    },
    {
      id: 'demo_followup',
      label: 'Attended Demo',
      count: metrics.demoFollowupCount,
      icon: PhoneCall,
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/10',
      border: 'border-cyan-500/30',
    },
    {
      id: 'email_pending',
      label: 'Email Sent / Awaiting Reply',
      count: metrics.emailPendingCount,
      icon: MessageSquare,
      color: 'text-indigo-400',
      bg: 'bg-indigo-500/10',
      border: 'border-indigo-500/30',
    },
    {
      id: 'red_flags',
      label: 'Active Red Flags',
      count: metrics.redFlagCount,
      icon: AlertTriangle,
      color: 'text-rose-400',
      bg: 'bg-rose-500/10',
      border: 'border-rose-500/30',
    },
    {
      id: 'has_notes',
      label: 'Has Call Notes',
      count: metrics.withNotesCount,
      icon: Sparkles,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10',
      border: 'border-purple-500/30',
    },
  ];

  // ─── 3. Real-Time GAP AI Prompt Execution ───
  const handleNlpSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nlpQuery.trim() || isAskingAi) return;

    unlockJarvisAudio();
    const query = nlpQuery.trim();
    setIsAskingAi(true);

    if (onSearchChange) onSearchChange('');

    try {
      const thinkingStartTime = Date.now();
      const res = await fetch('/api/enquiries/ask-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: query }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to process AI query');
      }

      // Pre-warm audio in parallel during remaining thinking time
      if (data.answer) {
        const fullSpeech = `${data.answer}. Tactical Directive: ${data.actionAdvice || ''}`;
        prepareJarvisSpeech(fullSpeech);
      }

      // Ensure minimum 2000ms thinking duration
      const elapsed = Date.now() - thinkingStartTime;
      if (elapsed < 2000) {
        await new Promise((r) => setTimeout(r, 2000 - elapsed));
      }

      setAiResponse({
        answer: data.answer,
        actionAdvice: data.actionAdvice,
        matchedIds: data.matchedIds || [],
        recommendedFilter: data.recommendedFilter,
        isRealAi: Boolean(data.isRealGemini),
        missingApiKey: Boolean(data.missingApiKey),
        apiError: data.apiError,
        model: data.model,
        prompt: query,
      });

      onFilterChange('all');

      if (data.matchedIds && data.matchedIds.length > 0 && onAiMatchedIdsChange) {
        onAiMatchedIdsChange(data.matchedIds);
      }

      // Broadcast pipeline action to DailyPipelineBoard if Jarvis staged/pushed leads
      if (data.pipelineAction && typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('gapanchor:pipeline-action', { detail: data.pipelineAction })
        );
      }

      if (data.isRealGemini) {
        toast.success(`GAP AI Engine analyzed ${enquiries.length} leads in real time.`);
      } else if (data.missingApiKey) {
        toast.info('Answer generated via local heuristics. Configure GAP AI Key for live neural reasoning.');
      } else if (data.apiError) {
        toast.info(`Using local heuristics (Gemini unavailable: ${data.apiError}).`);
      }

      if (data.answer) {
        const fullSpeech = `${data.answer}. Tactical Directive: ${data.actionAdvice || ''}`;
        if (autoSpeakJarvis) {
          setIsSpeakingJarvis(true);
          speakJarvis(fullSpeech, {
            includeIntro: true,
            onStart: () => setIsSpeakingJarvis(true),
            onEnd: () => setIsSpeakingJarvis(false),
            onError: () => setIsSpeakingJarvis(false),
          });
        }
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Error communicating with GAP AI Engine.');
    } finally {
      setIsAskingAi(false);
    }
  };

  const handleCopyAnswer = () => {
    if (!aiResponse) return;
    const textToCopy = `${aiResponse.answer}\n\nTactical Directive: ${aiResponse.actionAdvice || ''}`;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    toast.success('AI insight copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClearAiView = () => {
    stopJarvis();
    setIsSpeakingJarvis(false);
    setAiResponse(null);
    if (onAiMatchedIdsChange) onAiMatchedIdsChange(null);
    if (onSearchChange) onSearchChange('');
    onFilterChange('all');
  };

  const handleJarvisVoicePrompt = async (promptText: string) => {
    setNlpQuery(promptText);
    setIsAskingAi(true);
    if (onSearchChange) onSearchChange('');

    try {
      const res = await fetch('/api/enquiries/ask-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: promptText }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to process AI query');
      }

      setAiResponse({
        answer: data.answer,
        actionAdvice: data.actionAdvice,
        matchedIds: data.matchedIds || [],
        recommendedFilter: data.recommendedFilter,
        isRealAi: Boolean(data.isRealGemini),
        missingApiKey: Boolean(data.missingApiKey),
        apiError: data.apiError,
        model: data.model,
        prompt: promptText,
      });

      onFilterChange('all');

      if (data.matchedIds && data.matchedIds.length > 0 && onAiMatchedIdsChange) {
        onAiMatchedIdsChange(data.matchedIds);
      }

      // Broadcast pipeline action to DailyPipelineBoard if Jarvis staged/pushed leads
      if (data.pipelineAction && typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('gapanchor:pipeline-action', { detail: data.pipelineAction })
        );
      }

      if (data.answer) {
        const fullSpeech = `${data.answer}. Tactical Directive: ${data.actionAdvice || ''}`;
        prepareJarvisSpeech(fullSpeech);
      }

      return {
        answer: data.answer,
        actionAdvice: data.actionAdvice,
        matchedIds: data.matchedIds || [],
      };
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Error processing AI query');
      return null;
    } finally {
      setIsAskingAi(false);
    }
  };

  const handleSaveAiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiKeyInput.trim()) return;

    setIsSavingKey(true);
    try {
      const res = await fetch('/api/ai/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: aiKeyInput.trim() }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to verify AI Engine key');
      }

      toast.success('GAP AI Key successfully verified and saved!');
      setKeyStatus({ configured: true, model: 'GAP Neural v2', maskedKey: data.maskedKey });
      setShowKeyModal(false);
      setAiKeyInput('');

      if (nlpQuery.trim()) {
        setTimeout(() => {
          handleNlpSearch({ preventDefault: () => {} } as any);
        }, 300);
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Invalid AI Engine key');
    } finally {
      setIsSavingKey(false);
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {/* ─── Real-Time GAP AI Copilot Command Bar ─── */}
      <div className="p-2.5 sm:p-4 bg-slate-900/70 backdrop-blur-xl border border-slate-700/60 rounded-2xl shadow-xl transition-all">
        {isVoiceModeActive ? (
          /* ─── B1. 100% INLINE Jarvis Voice Interface (Zero Popup Windows) ─── */
          <div className="p-2.5 sm:p-3.5 rounded-xl bg-slate-950/35 border border-slate-800/60 transition-all animate-[fadeIn_0.2s_ease]">
            {/* Top row: Voice status & controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-slate-800/50">
              <div className="flex items-center gap-2.5 min-w-0">
                {/* J.A.R.V.I.S. Concentric Holographic Core Orb */}
                <div
                  onClick={() => {
                    if (isSpeakingJarvis) {
                      stopJarvis();
                      setIsSpeakingJarvis(false);
                      startListeningInline();
                    } else if (voiceStage === 'listening') {
                      handlePauseListening();
                    } else {
                      startListeningInline();
                    }
                  }}
                  className="cursor-pointer shrink-0"
                  title={isSpeakingJarvis ? 'Tap to interrupt Jarvis and speak' : 'Tap to toggle microphone'}
                >
                  <JarvisOrb
                    size="sm"
                    state={
                      voiceStage === 'listening'
                        ? 'listening'
                        : voiceStage === 'thinking'
                        ? 'thinking'
                        : voiceStage === 'speaking_output' || voiceStage === 'greeting' || voiceStage === 'acknowledging'
                        ? 'speaking'
                        : 'idle'
                    }
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold tracking-tight bg-gradient-to-r from-white via-slate-100 to-cyan-200 bg-clip-text text-transparent shrink-0">
                      Jarvis Voice
                    </span>
                    <span
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium max-w-full truncate border transition-colors ${
                        voiceStage === 'listening'
                          ? 'bg-cyan-500/10 text-cyan-200 border-cyan-500/25'
                          : voiceStage === 'speaking_output' || voiceStage === 'greeting'
                          ? 'bg-slate-800/70 text-cyan-200 border-slate-700/60'
                          : 'bg-slate-800/60 text-slate-300 border-slate-700/50'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          voiceStage === 'listening' || voiceStage === 'speaking_output' || voiceStage === 'thinking'
                            ? 'bg-cyan-400 animate-pulse'
                            : 'bg-slate-400'
                        }`}
                      />
                      <span className="truncate">
                        {voiceStage === 'greeting'
                          ? 'Ready'
                          : voiceStage === 'listening'
                          ? 'Listening'
                          : voiceStage === 'acknowledging'
                          ? 'Acknowledging'
                          : voiceStage === 'thinking'
                          ? 'Thinking'
                          : voiceStage === 'speaking_output'
                          ? 'Speaking'
                          : 'Ready'}
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-[10px] sm:text-[11px] text-slate-400 truncate max-w-[200px] sm:max-w-md">
                      {voiceStage === 'listening' ? 'Speak clearly into your mic...' : voiceStatusMessage}
                    </p>
                  </div>
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                {isSpeakingJarvis ? (
                  <button
                    type="button"
                    onClick={() => {
                      stopJarvis();
                      setIsSpeakingJarvis(false);
                      startListeningInline();
                    }}
                    className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:text-white hover:bg-amber-500/30 text-[10px] sm:text-[11px] font-bold cursor-pointer transition-all animate-pulse shadow-md shadow-amber-500/10"
                    title="Stop Jarvis speaking and speak now"
                  >
                    <Mic className="w-3.5 h-3.5" />
                    <span>Interrupt</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={voiceStage === 'listening' ? handlePauseListening : handleResumeListening}
                    className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-[10px] sm:text-[11px] font-bold cursor-pointer transition-all border ${
                      voiceStage === 'listening'
                        ? 'bg-rose-500/20 border-rose-500/50 text-rose-300 hover:bg-rose-500/30'
                        : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30'
                    }`}
                  >
                    {voiceStage === 'listening' ? (
                      <>
                        <MicOff className="w-3.5 h-3.5" />
                        <span>Mute</span>
                      </>
                    ) : (
                      <>
                        <Mic className="w-3.5 h-3.5" />
                        <span>Tap to Speak</span>
                      </>
                    )}
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleCloseVoiceMode}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white text-[10px] sm:text-[11px] font-bold cursor-pointer transition-all"
                  title="Exit voice mode"
                >
                  <X className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Exit Voice</span>
                </button>
              </div>
            </div>

            {/* ─── Center Stage: J.A.R.V.I.S. Living Particle Visual System ─── */}
            <div className="my-2 flex w-full flex-col items-center justify-center">
              <JarvisArcReactor
                size={190}
                className="w-full"
                state={
                  voiceStage === 'thinking' ||
                  (isAskingAi &&
                    voiceStage !== 'greeting' &&
                    voiceStage !== 'speaking_output' &&
                    voiceStage !== 'acknowledging')
                    ? 'thinking'
                    : isSpeakingJarvis || voiceStage === 'greeting' || voiceStage === 'speaking_output' || voiceStage === 'acknowledging'
                    ? 'speaking'
                    : voiceStage === 'listening'
                    ? 'listening'
                    : 'idle'
                }
                userTranscript={voiceTranscript}
                replyText={
                  voiceStage === 'greeting'
                    ? 'Online, sir. Ready.'
                    : voiceStage === 'speaking_output' &&
                      voiceStatusMessage &&
                      voiceStatusMessage !== 'Briefing executive team...'
                    ? voiceStatusMessage
                    : [aiResponse?.answer, aiResponse?.actionAdvice].filter(Boolean).join(' ')
                }
                audioLevel={isSpeakingJarvis ? 0.72 : voiceStage === 'listening' ? Math.max(0.32, liveAudioLevel) : 0.08}
              />
            </div>

            {/* Unified Voice Briefing Sheet (Integrated Directly Below Center Orb) */}
            {aiResponse && (
              <div className="my-3 p-3.5 sm:p-4 rounded-xl bg-slate-950/60 border border-slate-800/70 shadow-lg animate-[fadeIn_0.25s_ease] text-xs text-slate-200">
                <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-slate-800/60">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                    <span className="font-semibold text-white text-xs tracking-tight">Jarvis Executive Briefing</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleCopyAnswer}
                      className="px-2.5 py-1 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-[10px] text-slate-300 hover:text-white border border-slate-700/60 transition-colors cursor-pointer"
                    >
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                    <button
                      type="button"
                      onClick={handleClearAiView}
                      className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/30 transition-colors cursor-pointer"
                      title="Clear briefing"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Answer Content */}
                <p className="whitespace-pre-line leading-relaxed">{aiResponse.answer}</p>

                {/* Tactical Advice Box */}
                {aiResponse.actionAdvice && (
                  <div className="mt-2.5 p-2.5 rounded-xl bg-cyan-950/60 border border-cyan-500/30 flex items-start gap-2">
                    <Lightbulb className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div className="text-[11px] text-cyan-200">
                      <span className="font-bold text-amber-300">Tactical Directive: </span>
                      {aiResponse.actionAdvice}
                    </div>
                  </div>
                )}

                {/* Filter table footer */}
                <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                  <span>
                    {aiResponse.matchedIds.length > 0 ? (
                      <>Filtered table to <strong className="text-white">{aiResponse.matchedIds.length}</strong> matching candidate(s).</>
                    ) : (
                      <>Analyzed CRM records. No specific single-lead filter applied.</>
                    )}
                  </span>
                  {aiResponse.matchedIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        if (onAiMatchedIdsChange) onAiMatchedIdsChange(null);
                      }}
                      className="text-cyan-400 hover:text-cyan-200 underline font-semibold cursor-pointer"
                    >
                      Show All ({enquiries.length})
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Middle row: Live Transcript / Spoken input display */}
            <div className="mt-2.5">
              <div
                onClick={() => {
                  if (isSpeakingJarvis) {
                    unlockJarvisAudio();
                    stopJarvis();
                    setIsSpeakingJarvis(false);
                    startListeningInline();
                  } else if (voiceStage === 'idle') {
                    handleResumeListening();
                  }
                }}
                className={`w-full min-h-[44px] p-2.5 sm:px-3.5 sm:py-2.5 rounded-xl border text-xs text-white flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition-all ${
                  voiceStage === 'listening'
                    ? 'bg-slate-950/45 border-cyan-500/25'
                    : 'bg-slate-950/35 border-slate-800/60 cursor-pointer'
                }`}
              >
                <div className="flex items-start sm:items-center gap-2 min-w-0 flex-1">
                  {voiceStage === 'listening' ? (
                    <span className="flex items-center gap-1.5 text-cyan-400 shrink-0 font-medium mt-0.5 sm:mt-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                      <Mic className="w-4 h-4" />
                    </span>
                  ) : (
                    <MessageSquare className="w-4 h-4 text-cyan-400/80 shrink-0 mt-0.5 sm:mt-0" />
                  )}

                  {voiceTranscript ? (
                    <span className="font-semibold text-white flex-1 text-xs sm:text-sm tracking-wide break-words">
                      &ldquo;{voiceTranscript}&rdquo;
                    </span>
                  ) : (
                    <span className="text-slate-400 italic flex-1 text-[11px] sm:text-xs">
                      {voiceStage === 'listening'
                        ? listeningMode === 'recorder'
                          ? 'Listening via Audio Capture... Speak your question, then pause or tap Send Voice.'
                          : voiceStatusMessage || 'Listening to your voice... Speak anytime (e.g. "Find high intent candidates")'
                        : voiceStage === 'thinking'
                        ? voiceStatusMessage || 'Processing your request...'
                        : isSpeakingJarvis
                        ? 'Jarvis is speaking... Tap here to interrupt and speak.'
                        : voiceStatusMessage || 'Microphone paused. Click Tap to Speak.'}
                    </span>
                  )}
                </div>

                {voiceStage === 'listening' && listeningMode === 'recorder' && !voiceTranscript && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      submitActiveRecorderNow();
                    }}
                    className="w-full sm:w-auto px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-cyan-500/40 text-cyan-200 hover:text-white text-xs font-semibold shrink-0 flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <span>Send Voice</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}

                {voiceTranscript && voiceTranscript.trim().length > 3 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleExecuteVoicePrompt(voiceTranscript);
                    }}
                    disabled={isAskingAi}
                    className="w-full sm:w-auto px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white text-xs font-bold shrink-0 flex items-center justify-center gap-1.5 shadow-md shadow-cyan-500/20 cursor-pointer transition-transform active:scale-95"
                  >
                    <span>Ask AI Now</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* ─── B2. Standard Text Command Bar ─── */
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
            {/* Natural Language Ask AI Bar with J.A.R.V.I.S. Core Animation */}
            <form onSubmit={handleNlpSearch} className="relative flex-1 min-w-0 w-full">
              <div className="absolute left-2.5 top-1/2 -translate-y-1/2 flex items-center pointer-events-none">
                <JarvisOrb size="xs" state={isAskingAi ? 'thinking' : 'idle'} />
              </div>
              <input
                type="text"
                value={nlpQuery}
                onChange={(e) => setNlpQuery(e.target.value)}
                disabled={isAskingAi}
                placeholder="Ask GAP AI: 'Who to follow up with first?'…"
                className="w-full pl-9 pr-24 sm:pr-28 py-2 bg-slate-950/90 border border-slate-700/60 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/20 transition-all shadow-inner disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={isAskingAi || !nlpQuery.trim()}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2.5 sm:px-3 py-1 rounded-lg bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-[11px] font-bold text-white shadow-sm transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isAskingAi ? (
                  <>
                    <JarvisOrb size="xs" state="thinking" />
                    <span>Reasoning…</span>
                  </>
                ) : (
                  <>
                    <span>Ask AI</span>
                    <ArrowRight className="w-3 h-3" />
                  </>
                )}
              </button>
            </form>

            {/* GAP AI Status Indicator & Config Button */}
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 w-full lg:w-auto">
              {/* Interactive Voice Mode Button */}
              <button
                type="button"
                onClick={handleOpenVoiceMode}
                className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl text-[10.5px] sm:text-xs font-semibold bg-slate-800/85 hover:bg-slate-700/85 border border-cyan-500/35 hover:border-cyan-400/60 text-slate-100 hover:text-white shadow-sm transition-all cursor-pointer shrink-0"
                title="Talk to Jarvis with real-time voice recognition"
              >
                <Mic className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-cyan-400" />
                <span>Hey Jarvis</span>
              </button>

              {/* Compact Ambient Background Wake-Word Toggle */}
              <button
                type="button"
                onClick={handleToggleWakeWord}
                aria-label={
                  wakeWordEnabled
                    ? 'Always Listening active (Say "Hey Jarvis") — click to pause'
                    : 'Always Listening off — click to enable "Hey Jarvis" wake word'
                }
                className={`relative flex items-center justify-center p-1.5 sm:p-2 rounded-lg sm:rounded-xl border cursor-pointer transition-all shadow-sm shrink-0 ${
                  wakeWordEnabled
                    ? 'bg-slate-800/90 border-cyan-500/45 text-cyan-300 hover:border-cyan-400/70 hover:bg-slate-700/80'
                    : 'bg-slate-800/80 border-slate-700/80 text-slate-400 hover:text-slate-200 hover:bg-slate-700/80'
                }`}
                title={
                  wakeWordEnabled
                    ? 'Always Listening ON (Say "Hey Jarvis"). Click to pause.'
                    : 'Always Listening OFF. Click to enable background wake word ("Hey Jarvis").'
                }
              >
                <Radio className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${wakeWordEnabled ? 'text-cyan-400 animate-pulse' : 'text-slate-400'}`} />
                {wakeWordEnabled && (
                  <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-cyan-400 ring-2 ring-slate-950" />
                )}
              </button>

              {!keyStatus?.configured && (
                <button
                  type="button"
                  onClick={() => setShowKeyModal(true)}
                  className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg sm:rounded-xl bg-slate-800/80 border border-cyan-500/30 text-[10px] sm:text-[11px] font-semibold text-cyan-300 hover:bg-slate-700/80 hover:border-cyan-400/50 transition-all cursor-pointer shrink-0"
                  title="Click to configure GAP AI Engine Key"
                >
                  <Key className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-cyan-400" />
                  <span>Configure AI</span>
                </button>
              )}

              {/* Clear Filter button if any active */}
              {(activeFilter !== 'all' || aiMatchedIds) && (
                <button
                  type="button"
                  onClick={() => {
                    onFilterChange('all');
                    if (onAiMatchedIdsChange) onAiMatchedIdsChange(null);
                    if (onSearchChange) onSearchChange('');
                  }}
                  className="flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-[10.5px] sm:text-xs font-semibold text-slate-200 hover:text-white border border-slate-700/80 hover:border-cyan-500/40 shadow-sm cursor-pointer transition-all shrink-0"
                >
                  <X className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-cyan-400" />
                  <span>Reset View</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* ─── C. Real-Time GAP AI Response Card (Standard Text Command Bar Mode Only) ─── */}
        {!isVoiceModeActive && aiResponse && (
          <div className="mt-3 p-3.5 sm:p-4 rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900/90 to-cyan-950/40 border border-cyan-500/40 shadow-2xl relative animate-[fadeIn_0.2s_ease]">
            {/* Header */}
            <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-800">
              <div className="min-w-0">
                <span className="text-xs font-bold text-white">GAP Intelligence Copilot</span>
                <p className="text-[10px] text-slate-400 italic truncate max-w-full sm:max-w-md">
                  Prompt: &ldquo;{aiResponse.prompt}&rdquo;
                </p>
              </div>

              {/* Clean Dismiss Action */}
              <button
                type="button"
                onClick={handleClearAiView}
                className="p-1.5 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer border border-transparent hover:border-rose-500/30 shrink-0"
                title="Dismiss AI Answer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Split Layout: Left Content & Right J.A.R.V.I.S. Arc Reactor HUD */}
            <div className="flex flex-col lg:flex-row items-center lg:items-start justify-between gap-4 mt-3">
              {/* Left Column: Answer, Advice, and Lead Matches */}
              <div className="flex-1 min-w-0 space-y-3 w-full">
                {/* Answer Content */}
                <div className="text-xs leading-relaxed text-slate-200">
                  <p className="whitespace-pre-line">{aiResponse.answer}</p>
                </div>

                {/* Tactical Advice Box */}
                {aiResponse.actionAdvice && (
                  <div className="p-2.5 rounded-xl bg-cyan-950/50 border border-cyan-500/30 flex items-start gap-2">
                    <Lightbulb className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div className="text-[11px] text-cyan-200">
                      <span className="font-bold text-amber-300">Tactical Directive: </span>
                      {aiResponse.actionAdvice}
                    </div>
                  </div>
                )}

                {/* Leads Matched Summary */}
                <div className="pt-2.5 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-cyan-400" />
                    <span>
                      {aiResponse.matchedIds.length > 0 ? (
                        <>
                          Filtered table below to <strong className="text-white">{aiResponse.matchedIds.length}</strong> matching candidate(s).
                        </>
                      ) : (
                        <>Analyzed CRM records. No specific single-lead filter applied.</>
                      )}
                    </span>
                  </div>
                  {aiResponse.matchedIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        if (onAiMatchedIdsChange) onAiMatchedIdsChange(null);
                      }}
                      className="text-cyan-400 hover:text-cyan-200 underline font-semibold cursor-pointer text-left"
                    >
                      Show All Enquiries ({enquiries.length})
                    </button>
                  )}
                </div>
              </div>

              {/* Right Column: Pure Floating Live Hologram Animation - Only in standard mode (NO DUPLICATE in voice mode) */}
              {!isVoiceModeActive && (
                <div className="hidden sm:flex shrink-0 w-[260px] md:w-[300px] items-center justify-center self-center pr-2">
                  <JarvisArcReactor
                    size={175}
                    className="w-full"
                    state={
                      isSpeakingJarvis
                        ? 'speaking'
                        : isAskingAi
                        ? 'thinking'
                        : voiceStage === 'listening'
                        ? 'listening'
                        : 'idle'
                    }
                    userTranscript={voiceTranscript || nlpQuery}
                    replyText={[aiResponse.answer, aiResponse.actionAdvice].filter(Boolean).join(' ')}
                    audioLevel={isSpeakingJarvis ? 0.68 : isAskingAi ? 0.35 : 0.08}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── D. Single Clear All Filters Action ─── */}
        <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-800/80">
          <button
            type="button"
            onClick={() => {
              onFilterChange('all');
              if (onAiMatchedIdsChange) onAiMatchedIdsChange(null);
              if (onSearchChange) onSearchChange('');
              setNlpQuery('');
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/50 text-xs font-bold text-slate-300 hover:text-white transition-all cursor-pointer shadow-sm group"
            title="Clear all active filters and reset view"
          >
            <RotateCcw className="w-3.5 h-3.5 text-cyan-400 group-hover:rotate-[-90deg] transition-transform duration-300" />
            <span>Clear All Filters</span>
          </button>

          {aiMatchedIds && (
            <span className="text-[11px] text-cyan-400/90 font-mono font-medium">
              Filtered to {aiMatchedIds.length} candidate(s)
            </span>
          )}
        </div>
      </div>

      {/* ─── E. GAP AI Engine Key Configuration Modal ─── */}
      {showKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-[fadeIn_0.15s_ease]">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-2xl p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">GAP AI Engine Configuration</h3>
                  <p className="text-[11px] text-slate-400">Power real-time AI prompt reasoning & CRM intelligence</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowKeyModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs text-slate-300">
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white">Current Status:</span>
                  <span
                    className={`font-mono font-bold text-[11px] ${
                      keyStatus?.configured ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                  >
                    {keyStatus?.configured ? `Connected (${keyStatus.maskedKey})` : 'Not Configured'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  GAP AI Neural Engine provides real-time intelligent CRM analysis with a 1,000,000 token context window.
                </p>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 font-semibold underline mt-1"
                >
                  <span>Get Free Neural Engine Key</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <form onSubmit={handleSaveAiKey} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Enter Neural Engine API Key
                  </label>
                  <input
                    type="password"
                    placeholder="AIzaSy..."
                    value={aiKeyInput}
                    onChange={(e) => setAiKeyInput(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 font-mono"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Key is verified live and saved to your project configuration.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowKeyModal(false)}
                    className="px-3 py-1.5 rounded-xl text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingKey || !aiKeyInput.trim()}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white text-xs font-bold shadow-md shadow-cyan-500/20 disabled:opacity-50 cursor-pointer"
                  >
                    {isSavingKey ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Verifying Engine Key...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Verify & Save Key</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
