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
  Volume2,
  VolumeX,
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
  getJarvisVoice,
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
  stopAllListening,
  isSpeechRecognitionSupported,
  isActionablePrompt,
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
  const [wakeWordEnabled, setWakeWordEnabled] = useState(true);

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

  // Subscribe to voice changes across components
  useEffect(() => {
    setActiveVoiceState(getActiveVoice());
    const unsub = subscribeJarvisVoiceChange((v) => setActiveVoiceState(v));
    return unsub;
  }, []);

  // Always initialize wakeWordEnabled to true on mount so background listening is active upon refresh
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setWakeWordEnabled(true);
      localStorage.setItem('jarvis_wake_word_enabled', 'true');
    }
  }, []);

  // Stop voice and all listeners on component unmount
  useEffect(() => {
    return () => {
      stopJarvis();
      stopAllListening();
      stopWakeWordMonitor();
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
  const startListeningInline = () => {
    stopJarvis();
    setIsSpeakingJarvis(false);
    if (!isSpeechRecognitionSupported()) {
      toast.error('Voice input requires Google Chrome or Microsoft Edge.');
      setVoiceStage('idle');
      setVoiceStatusMessage('Speech recognition is not supported in this browser.');
      return;
    }

    setVoiceStage('listening');
    setVoiceTranscript('');
    setVoiceStatusMessage('Listening to you... Speak your command now.');

    startActivePromptListening({
      onStart: () => {
        setVoiceStage('listening');
      },
      onInterim: (text) => {
        // Instant Barge-In: if user speaks any word, immediately stop Jarvis from talking!
        if (text && text.trim().length > 0) {
          stopJarvis();
          setIsSpeakingJarvis(false);
        }
        setVoiceTranscript(text);
      },
      onFinal: (finalText) => {
        handleExecuteVoicePrompt(finalText);
      },
      onError: (errText) => {
        if (errText.includes('Microphone access denied')) {
          toast.error(errText);
          setVoiceStage('idle');
          setVoiceStatusMessage('Microphone access denied. Please click mic icon in address bar to allow.');
        } else {
          console.warn('Speech notice:', errText);
        }
      },
      onEnd: () => {
        // Handled via onFinal
      },
    });
  };

  const startGreetingSequence = () => {
    setVoiceStage('greeting');
    setVoiceStatusMessage('Online, sir. Ready.');
    speakJarvis('Online, sir. Ready.', {
      includeIntro: false,
      onStart: () => setIsSpeakingJarvis(true),
      onEnd: () => {
        setIsSpeakingJarvis(false);
        startListeningInline();
      },
      onError: () => {
        setIsSpeakingJarvis(false);
        startListeningInline();
      },
    });
  };

  const handleOpenVoiceMode = () => {
    setIsVoiceModeActive(true);
    startGreetingSequence();
  };

  const handleCloseVoiceMode = () => {
    stopJarvis();
    stopAllListening();
    setIsSpeakingJarvis(false);
    setIsVoiceModeActive(false);
    setVoiceStage('idle');
    setVoiceTranscript('');
    setVoiceStatusMessage('');
  };

  const handlePauseListening = () => {
    stopAllListening();
    setVoiceStage('idle');
    setVoiceStatusMessage('Microphone paused. Tap Resume Mic or choose a quick prompt.');
  };

  const handleResumeListening = () => {
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
      setVoiceStage('listening');
      setVoiceStatusMessage('Listening to you... Speak your command now.');
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
      setVoiceTranscript(cleanPrompt);
      setNlpQuery(cleanPrompt);

      // Check if the user is saying thank you or concluding (e.g. "Nothing Jarvis, thank you for your help")
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
      const ackPhrase = getJarvisThinkingPhrase();
      setVoiceStatusMessage(ackPhrase);

      // 2. Play subtle acknowledgment in background without blocking the AI pipeline
      speakJarvis(ackPhrase, {
        includeIntro: false,
        rate: '+5%',
        onStart: () => setIsSpeakingJarvis(true),
        onEnd: () => setIsSpeakingJarvis(false),
        onError: () => setIsSpeakingJarvis(false),
      });

      // 3. Launch real GAP AI (Gemini) query in parallel
      setVoiceStatusMessage('Analyzing live CRM records with GAP Intelligence...');
      const result = await handleJarvisVoicePrompt(cleanPrompt);

      // Stop acknowledgment audio immediately the instant AI answer is ready
      stopJarvis();
      setIsSpeakingJarvis(false);

      if (result && result.answer) {
        setVoiceStage('speaking_output');
        setVoiceStatusMessage('Briefing executive team...');

        // Combine briefing and conversational follow-up into a single fluid speech request
        const humanizedBriefing = formatHumanizedJarvisBriefing(result.answer, result.actionAdvice);
        const followUpPhrase = getJarvisFollowUpPhrase();
        const fullSpeech = `${humanizedBriefing} ${followUpPhrase}`;

        await speakJarvis(fullSpeech, {
          includeIntro: false,
          onStart: () => {
            setVoiceStage('speaking_output');
            setIsSpeakingJarvis(true);
          },
          onEnd: () => {
            setIsSpeakingJarvis(false);
          },
          onError: () => {
            setIsSpeakingJarvis(false);
          },
        });

        // Automatically turn microphone back ON to listen for next command or dismissal
        startListeningInline();
        setVoiceStatusMessage('Listening... Speak your next command or say "Nothing, thank you" to conclude.');
      } else {
        setIsSpeakingJarvis(false);
        setVoiceStage('idle');
        setVoiceStatusMessage('Ready.');
      }
    } catch (err: any) {
      console.error('Error in handleExecuteVoicePrompt:', err);
      setIsSpeakingJarvis(false);
      setVoiceStage('idle');
      setVoiceStatusMessage('Request encountered an issue.');
    } finally {
      isExecutingPromptRef.current = false;
    }
  };

  // Background Always-On Wake Word Monitor ("Hey Jarvis")
  useEffect(() => {
    if (wakeWordEnabled && !isVoiceModeActive) {
      startWakeWordMonitor((trailingPrompt?: string) => {
        setIsVoiceModeActive(true);
        if (trailingPrompt && trailingPrompt.trim().length > 0) {
          handleExecuteVoicePrompt(trailingPrompt.trim());
        } else {
          startGreetingSequence();
        }
      });
    } else {
      pauseWakeWordMonitor();
    }
  }, [wakeWordEnabled, isVoiceModeActive]);

  const handleToggleWakeWord = () => {
    setWakeWordEnabled((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('jarvis_wake_word_enabled', String(next));
      }
      if (next) {
        toast.success('J.A.R.V.I.S. always-listening active. Say "Hey Jarvis" to speak hands-free.');
      } else {
        toast.info('J.A.R.V.I.S. background listening paused.');
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

    const query = nlpQuery.trim();
    setIsAskingAi(true);

    if (onSearchChange) onSearchChange('');

    try {
      const res = await fetch('/api/enquiries/ask-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: query }),
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
      }

      if (data.answer) {
        const fullSpeech = `${data.answer}. Tactical Directive: ${data.actionAdvice || ''}`;
        // Proactively prewarm audio the instant text arrives so manual click or auto-voice is instantaneous!
        prepareJarvisSpeech(fullSpeech);

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

  const handleToggleJarvisVoice = () => {
    if (isSpeakingJarvis) {
      stopJarvis();
      setIsSpeakingJarvis(false);
      toast.info('Jarvis voice stopped.');
    } else {
      if (!aiResponse) return;
      const fullSpeech = `${aiResponse.answer}. Tactical Directive: ${aiResponse.actionAdvice || 'None at this time.'}`;
      setIsSpeakingJarvis(true);
      const voice = getJarvisVoice();
      const voiceLabel = voice ? voice.name : 'British Natural';
      toast.info(`Speaking via Jarvis persona (${voiceLabel})`, { duration: 2500 });
      speakJarvis(fullSpeech, {
        includeIntro: true,
        onStart: () => setIsSpeakingJarvis(true),
        onEnd: () => setIsSpeakingJarvis(false),
        onError: () => setIsSpeakingJarvis(false),
      });
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
      {/* ─── A. Executive Call Intelligence Metric Strip (Desktop Only; Hidden on Mobile per User Spec) ─── */}
      <div className="hidden md:grid md:grid-cols-4 gap-2.5 sm:gap-3">
        {/* Metric 1: Avg Call Quality Score */}
        <div className="p-3 sm:p-3.5 bg-slate-900/70 backdrop-blur-xl border border-slate-700/60 rounded-2xl shadow-lg relative overflow-hidden group hover:border-cyan-500/40 transition-all">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Avg Call Quality Score
            </span>
            <div className="p-1 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/25">
              <Star className="w-3.5 h-3.5 fill-cyan-400/20" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-black text-white group-hover:text-cyan-300 transition-colors">
              {metrics.avgScore}
            </span>
            <span className="text-[11px] text-slate-500 font-semibold">
              /10 ({metrics.scoredCount} evaluated)
            </span>
          </div>
          <div className="mt-2 w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-gradient-to-r from-cyan-500 to-indigo-500 h-full rounded-full transition-all duration-700"
              style={{
                width: `${metrics.avgScore !== '—' ? Math.min(100, Math.max(10, parseFloat(metrics.avgScore) * 10)) : 0}%`,
              }}
            />
          </div>
        </div>

        {/* Metric 2: Follow-ups Due Today */}
        <div
          onClick={() => onFilterChange(activeFilter === 'due_today' ? 'all' : 'due_today')}
          className={`p-3 sm:p-3.5 bg-slate-900/70 backdrop-blur-xl border rounded-2xl shadow-lg relative overflow-hidden group cursor-pointer transition-all ${
            activeFilter === 'due_today'
              ? 'border-amber-500/70 ring-1 ring-amber-500/30 bg-amber-950/20'
              : 'border-slate-700/60 hover:border-amber-500/40'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Follow-ups Due Today
            </span>
            <div className="p-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/25">
              <Calendar className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-black text-white group-hover:text-amber-300 transition-colors">
              {metrics.dueTodayCount}
            </span>
            <span className="text-[10px] text-amber-400/90 font-bold">
              {metrics.dueTodayCount > 0 ? 'Action Required' : 'All Clear'}
            </span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1 truncate">
            Scheduled callbacks & urgent check-ins
          </p>
        </div>

        {/* Metric 3: High Intent Pipeline */}
        <div
          onClick={() => onFilterChange(activeFilter === 'high_intent' ? 'all' : 'high_intent')}
          className={`p-3 sm:p-3.5 bg-slate-900/70 backdrop-blur-xl border rounded-2xl shadow-lg relative overflow-hidden group cursor-pointer transition-all ${
            activeFilter === 'high_intent'
              ? 'border-emerald-500/70 ring-1 ring-emerald-500/30 bg-emerald-950/20'
              : 'border-slate-700/60 hover:border-emerald-500/40'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              High Intent (8-10 Score)
            </span>
            <div className="p-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
              <Flame className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-black text-white group-hover:text-emerald-300 transition-colors">
              {metrics.highIntentCount}
            </span>
            <span className="text-[10px] text-emerald-400/90 font-bold">Hot Pipeline</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1 truncate">
            Ready for batch seat closing & syllabus
          </p>
        </div>

        {/* Metric 4: Active Red Flags */}
        <div
          onClick={() => onFilterChange(activeFilter === 'red_flags' ? 'all' : 'red_flags')}
          className={`p-3 sm:p-3.5 bg-slate-900/70 backdrop-blur-xl border rounded-2xl shadow-lg relative overflow-hidden group cursor-pointer transition-all ${
            activeFilter === 'red_flags'
              ? 'border-rose-500/70 ring-1 ring-rose-500/30 bg-rose-950/20'
              : 'border-slate-700/60 hover:border-rose-500/40'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Active Red Flags
            </span>
            <div className="p-1 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/25">
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-black text-white group-hover:text-rose-300 transition-colors">
              {metrics.redFlagCount}
            </span>
            <span className="text-[10px] text-rose-400/80 font-bold">
              {metrics.redFlagCount > 0 ? 'Risk Alerts' : 'No Flags'}
            </span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1 truncate">
            Budget / availability conflicts
          </p>
        </div>
      </div>

      {/* ─── B. Real-Time GAP AI Copilot Command Bar ─── */}
      <div className="p-2.5 sm:p-4 bg-slate-900/70 backdrop-blur-xl border border-slate-700/60 rounded-2xl shadow-xl transition-all">
        {isVoiceModeActive ? (
          /* ─── B1. 100% INLINE Jarvis Voice Interface (Zero Popup Windows) ─── */
          <div className="p-3 sm:p-4 rounded-xl bg-gradient-to-r from-slate-950 via-slate-900 to-cyan-950/40 border border-cyan-500/50 shadow-xl transition-all animate-[fadeIn_0.2s_ease]">
            {/* Top row: Voice status & controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-slate-800/80">
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
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-black uppercase tracking-wider text-white shrink-0">
                      J.A.R.V.I.S. Voice Mode
                    </span>
                    <span
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-extrabold max-w-full truncate ${
                        voiceStage === 'listening'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse'
                          : voiceStage === 'speaking_output' || voiceStage === 'greeting'
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                          : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          voiceStage === 'listening' ? 'bg-rose-500 animate-ping' : 'bg-cyan-400 animate-pulse'
                        }`}
                      />
                      <span className="truncate">
                        {voiceStage === 'greeting'
                          ? 'Jarvis Ready'
                          : voiceStage === 'listening'
                          ? '🔴 LIVE MIC: Listening...'
                          : voiceStage === 'acknowledging'
                          ? 'Acknowledging...'
                          : voiceStage === 'thinking'
                          ? 'GAP AI Reasoning...'
                          : voiceStage === 'speaking_output'
                          ? 'Jarvis Speaking'
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
            <div className="my-3 flex flex-col items-center justify-center">
              <JarvisArcReactor
                size={200}
                state={
                  isSpeakingJarvis
                    ? 'speaking'
                    : isAskingAi
                    ? 'thinking'
                    : voiceStage === 'listening'
                    ? 'listening'
                    : 'idle'
                }
                userTranscript={voiceTranscript}
                replyText={aiResponse?.answer || ''}
                audioLevel={isSpeakingJarvis ? 0.7 : voiceStage === 'listening' ? 0.45 : 0.08}
              />
            </div>

            {/* Middle row: Live Transcript / Spoken input display */}
            <div className="mt-2.5">
              <div
                onClick={() => {
                  if (isSpeakingJarvis) {
                    stopJarvis();
                    setIsSpeakingJarvis(false);
                    startListeningInline();
                  }
                }}
                className={`w-full min-h-[44px] p-2.5 sm:px-3.5 sm:py-2.5 rounded-xl border text-xs text-white flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition-all ${
                  voiceStage === 'listening'
                    ? 'bg-slate-950 border-rose-500/50 ring-2 ring-rose-500/20 shadow-lg shadow-rose-500/10'
                    : 'bg-slate-950/90 border-slate-700/80'
                }`}
              >
                <div className="flex items-start sm:items-center gap-2 min-w-0 flex-1">
                  {voiceStage === 'listening' ? (
                    <span className="flex items-center gap-1.5 text-rose-400 shrink-0 font-bold mt-0.5 sm:mt-0">
                      <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                      <Mic className="w-4 h-4" />
                    </span>
                  ) : (
                    <MessageSquare className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5 sm:mt-0" />
                  )}

                  {voiceTranscript ? (
                    <span className="font-semibold text-white flex-1 text-xs sm:text-sm tracking-wide break-words">
                      &ldquo;{voiceTranscript}&rdquo;
                    </span>
                  ) : (
                    <span className="text-slate-400 italic flex-1 text-[11px] sm:text-xs">
                      {voiceStage === 'listening'
                        ? 'Listening to your voice... Speak anytime (e.g. "Find high intent candidates")'
                        : isSpeakingJarvis
                        ? 'Jarvis is speaking... Tap here to interrupt and speak.'
                        : 'Microphone paused. Click Tap to Speak.'}
                    </span>
                  )}
                </div>

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
            <form onSubmit={handleNlpSearch} className="relative flex-1">
              <div className="absolute left-2.5 top-1/2 -translate-y-1/2 flex items-center pointer-events-none">
                <JarvisOrb size="xs" state={isAskingAi ? 'thinking' : 'idle'} />
              </div>
              <input
                type="text"
                value={nlpQuery}
                onChange={(e) => setNlpQuery(e.target.value)}
                disabled={isAskingAi}
                placeholder="Ask GAP AI: 'Who should I follow up with first today?', 'Find high intent Manhattan WMS leads'…"
                className="w-full pl-10 pr-28 py-2 bg-slate-950/90 border border-slate-700/60 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/20 transition-all shadow-inner disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={isAskingAi || !nlpQuery.trim()}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-1 rounded-lg bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-[11px] font-bold text-white shadow-sm transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
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
            <div className="flex items-center gap-2 shrink-0">
              {/* Interactive Voice Mode Button */}
              <button
                type="button"
                onClick={handleOpenVoiceMode}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold bg-gradient-to-r from-cyan-600/30 via-indigo-600/30 to-purple-600/30 border border-cyan-500/50 text-cyan-300 hover:text-white hover:border-cyan-400 hover:shadow-lg hover:shadow-cyan-500/25 transition-all cursor-pointer animate-pulse shrink-0"
                title="Talk to J.A.R.V.I.S. with real-time voice recognition"
              >
                <Mic className="w-3.5 h-3.5 text-cyan-400" />
                <span>Hey Jarvis</span>
              </button>

              {/* Ambient Background Wake-Word Status */}
              <button
                type="button"
                onClick={handleToggleWakeWord}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[10px] sm:text-xs font-semibold cursor-pointer transition-all shadow-inner shrink-0 ${
                  wakeWordEnabled
                    ? 'bg-cyan-950/60 border-cyan-500/50 text-cyan-300 hover:border-cyan-400 hover:bg-cyan-900/50'
                    : 'bg-slate-800/80 border-slate-700/70 text-slate-400 hover:text-slate-200 hover:bg-slate-700/80'
                }`}
                title={
                  wakeWordEnabled
                    ? 'Jarvis is continuously listening in the background. Click to pause.'
                    : 'Click to enable always-on background wake word ("Hey Jarvis")'
                }
              >
                <Radio className={`w-3.5 h-3.5 ${wakeWordEnabled ? 'text-cyan-400 animate-pulse' : 'text-slate-500'}`} />
                <span>
                  {wakeWordEnabled ? 'Always Listening (Say "Hey Jarvis")' : 'Always Listening: OFF'}
                </span>
              </button>

              {!keyStatus?.configured && (
                <button
                  type="button"
                  onClick={() => setShowKeyModal(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] font-semibold text-amber-400 hover:bg-amber-500/20 transition-all cursor-pointer"
                  title="Click to configure GAP AI Engine Key"
                >
                  <Key className="w-3.5 h-3.5 text-amber-400" />
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
                  className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 text-xs font-semibold text-rose-300 border border-rose-500/30 hover:bg-rose-500/10 cursor-pointer transition-colors shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Reset View</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* ─── C. Real-Time GAP AI Response Card ─── */}
        {aiResponse && (
          <div className="mt-3 p-3.5 sm:p-4 rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900/90 to-cyan-950/40 border border-cyan-500/40 shadow-2xl relative animate-[fadeIn_0.2s_ease]">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-800">
              <div className="min-w-0">
                <span className="text-xs font-bold text-white">GAP Intelligence Copilot</span>
                <p className="text-[10px] text-slate-400 italic truncate max-w-full sm:max-w-md">
                  Prompt: &ldquo;{aiResponse.prompt}&rdquo;
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
                {/* JARVIS Voice Reader Button */}
                <button
                  type="button"
                  onClick={handleToggleJarvisVoice}
                  className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl text-[10px] sm:text-xs font-bold transition-all cursor-pointer shadow-sm ${
                    isSpeakingJarvis
                      ? 'bg-gradient-to-r from-cyan-500 to-indigo-600 text-white ring-2 ring-cyan-400/50 shadow-cyan-500/30 animate-pulse'
                      : 'bg-slate-800/90 text-cyan-300 hover:text-white hover:bg-slate-700 border border-cyan-500/40'
                  }`}
                  title={isSpeakingJarvis ? 'Stop Jarvis Voice' : 'Read aloud in British JARVIS Voice'}
                >
                  {isSpeakingJarvis ? (
                    <>
                      <span className="flex items-end gap-0.5 h-3.5 mr-1">
                        <span className="w-0.5 bg-white rounded-full animate-[bounce_0.6s_ease-in-out_infinite] h-2" />
                        <span className="w-0.5 bg-white rounded-full animate-[bounce_0.6s_ease-in-out_infinite_0.15s] h-3.5" />
                        <span className="w-0.5 bg-white rounded-full animate-[bounce_0.6s_ease-in-out_infinite_0.3s] h-2" />
                        <span className="w-0.5 bg-white rounded-full animate-[bounce_0.6s_ease-in-out_infinite_0.45s] h-3" />
                      </span>
                      <VolumeX className="w-3.5 h-3.5" />
                      <span>Stop Jarvis</span>
                    </>
                  ) : (
                    <>
                      <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Read (Jarvis)</span>
                    </>
                  )}
                </button>

                {/* Auto-read Toggle */}
                <button
                  type="button"
                  onClick={() => {
                    const next = !autoSpeakJarvis;
                    setAutoSpeakJarvis(next);
                    toast.info(next ? 'Jarvis Auto-Read activated: Every response will be read aloud.' : 'Jarvis Auto-Read turned off.');
                  }}
                  className={`flex items-center gap-1 px-2 py-1 rounded-xl text-[9px] sm:text-[11px] font-semibold transition-all cursor-pointer border ${
                    autoSpeakJarvis
                      ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40 shadow-sm'
                      : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 border-slate-700/60'
                  }`}
                  title="Toggle automatic voice playback for AI answers"
                >
                  <Radio className={`w-3 h-3 ${autoSpeakJarvis ? 'text-cyan-400 animate-pulse' : 'text-slate-500'}`} />
                  <span>Auto-Voice {autoSpeakJarvis ? 'ON' : 'OFF'}</span>
                </button>

                {/* Copy Button */}
                <button
                  type="button"
                  onClick={handleCopyAnswer}
                  className="flex items-center gap-1 px-2 py-1 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-[10px] sm:text-[11px] text-slate-300 hover:text-white transition-colors cursor-pointer border border-slate-700/60"
                  title="Copy AI response"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>

                {/* Dismiss Button */}
                <button
                  type="button"
                  onClick={handleClearAiView}
                  className="p-1 sm:p-1.5 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer border border-transparent hover:border-rose-500/30 ml-auto sm:ml-0"
                  title="Dismiss AI Answer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
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

              {/* Right Column: Pure Floating Live Hologram Animation (Zero Black Box) - Hidden on mobile */}
              <div className="hidden sm:flex shrink-0 items-center justify-center self-center pr-2">
                <JarvisArcReactor
                  size={190}
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
                  replyText={aiResponse.answer}
                  audioLevel={isSpeakingJarvis ? 0.65 : isAskingAi ? 0.35 : 0.08}
                />
              </div>
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
