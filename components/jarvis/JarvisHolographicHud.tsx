'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Radio,
  Sparkles,
  Zap,
  Activity,
  Shield,
  ShieldAlert,
  Server,
  Cpu,
  RefreshCw,
  Send,
  ArrowRight,
  Maximize2,
  Minimize2,
  Sliders,
  CheckCircle2,
  Flame,
  AlertTriangle,
  RotateCcw,
  Compass,
} from 'lucide-react';
import { toast } from 'sonner';
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
} from '@/lib/jarvis-speech';
import {
  startActivePromptListening,
  stopActivePromptListening,
  stopAllListening,
  isSpeechRecognitionSupported,
} from '@/lib/jarvis-listener';
import { jarvisAudioFx } from '@/lib/jarvis-audio-fx';

export type JarvisUiState = 'idle' | 'listening' | 'processing' | 'briefing' | 'alert';

interface JarvisHolographicHudProps {
  initialPrompt?: string;
  onExecutePrompt?: (prompt: string) => Promise<{ answer: string; actionAdvice?: string | null; matchedIds?: string[] } | null>;
  onClose?: () => void;
  fullScreen?: boolean;
}

export function JarvisHolographicHud({
  initialPrompt = '',
  onExecutePrompt,
  onClose,
  fullScreen = true,
}: JarvisHolographicHudProps) {
  // System State
  const [uiState, setUiState] = useState<JarvisUiState>('idle');
  const [promptInput, setPromptInput] = useState(initialPrompt);
  const [transcript, setTranscript] = useState('');
  const [responseLog, setResponseLog] = useState<{ role: 'user' | 'jarvis'; text: string; action?: string }[]>([
    {
      role: 'jarvis',
      text: 'Good day, sir. J.A.R.V.I.S. core online. All neural systems operating within nominal parameters. How may I be of assistance?',
    },
  ]);

  // Audio & Acoustics
  const [soundFxEnabled, setSoundFxEnabled] = useState(true);
  const [ambientHumEnabled, setAmbientHumEnabled] = useState(false);
  const [voiceName, setVoiceName] = useState<string>('UK English Natural');
  const [speechEnergy, setSpeechEnergy] = useState<number[]>(new Array(18).fill(12));

  // Kinetic "Puff" Trigger
  const [puffActive, setPuffActive] = useState(false);
  const [ripples, setRipples] = useState<{ id: number }[]>([]);

  // 3D Parallax Tilt Coordinates
  const [mouseTilt, setMouseTilt] = useState({ x: 0, y: 0 });

  // Radar Ping Coordinates
  const [radarPings, setRadarPings] = useState<{ id: number; angle: number; dist: number; label: string }[]>([
    { id: 1, angle: 45, dist: 135, label: 'Manhattan WMS' },
    { id: 2, angle: 160, dist: 145, label: 'Azure Sync 200' },
    { id: 3, angle: 290, dist: 130, label: 'High Priority Lead' },
  ]);

  // System Telemetry Metrics (Dynamic)
  const [metrics, setMetrics] = useState({
    cpuLoad: 24,
    quantumEntropy: 99.4,
    neuralThroughput: 1420,
    networkLatency: 14,
    activeThreads: 64,
  });

  const animFrameRef = useRef<number | null>(null);

  // Initialize Speech Recognition & Voice Profile
  useEffect(() => {
    const v = getJarvisVoice();
    if (v) setVoiceName(v.name);
  }, []);

  // Ambient Hum Toggle
  useEffect(() => {
    if (ambientHumEnabled && soundFxEnabled) {
      jarvisAudioFx.startAmbientHum();
    } else {
      jarvisAudioFx.stopAmbientHum();
    }
    return () => {
      jarvisAudioFx.stopAmbientHum();
    };
  }, [ambientHumEnabled, soundFxEnabled]);

  // Dynamic Telemetry Stream
  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics((prev) => ({
        cpuLoad: uiState === 'processing' ? 84 + Math.floor(Math.random() * 12) : 22 + Math.floor(Math.random() * 8),
        quantumEntropy: +(99.1 + Math.random() * 0.7).toFixed(1),
        neuralThroughput: uiState === 'processing' ? 4850 : 1380 + Math.floor(Math.random() * 80),
        networkLatency: 12 + Math.floor(Math.random() * 6),
        activeThreads: uiState === 'processing' ? 128 : 64,
      }));
    }, 2000);
    return () => clearInterval(interval);
  }, [uiState]);

  // Simulated Audio Waveform Visualizer
  useEffect(() => {
    if (uiState === 'listening' || uiState === 'briefing') {
      const interval = setInterval(() => {
        setSpeechEnergy(
          new Array(18).fill(0).map(() => {
            return Math.floor(Math.random() * (uiState === 'briefing' ? 36 : 28)) + 6;
          })
        );
      }, 70);
      return () => clearInterval(interval);
    } else {
      setSpeechEnergy(new Array(18).fill(4));
    }
  }, [uiState]);

  // 3D Mouse Parallax Tracking
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setMouseTilt({ x: +(x * 16).toFixed(2), y: +(y * -16).toFixed(2) });
  };

  const handleMouseLeave = () => {
    setMouseTilt({ x: 0, y: 0 });
  };

  // Trigger Puff Expansion
  const triggerPuffEffect = () => {
    setPuffActive(true);
    if (soundFxEnabled) jarvisAudioFx.playPuffImpact();

    const newRippleId = Date.now();
    setRipples((prev) => [...prev.slice(-3), { id: newRippleId }]);

    setTimeout(() => {
      setPuffActive(false);
    }, 450);

    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== newRippleId));
    }, 1800);
  };

  // Microphone Activation
  const handleToggleMic = () => {
    if (uiState === 'listening') {
      stopAllListening();
      setUiState('idle');
      return;
    }

    if (!isSpeechRecognitionSupported()) {
      toast.error('Voice recognition is best supported in Google Chrome or Microsoft Edge.');
      return;
    }

    stopJarvis();
    if (soundFxEnabled) jarvisAudioFx.playWakeTone();
    setUiState('listening');
    setTranscript('');

    startActivePromptListening({
      onStart: () => setUiState('listening'),
      onInterim: (text) => setTranscript(text),
      onFinal: (finalText) => {
        if (finalText && finalText.trim()) {
          executeCommand(finalText.trim());
        }
      },
      onError: (err) => {
        console.warn('Speech recognition notice:', err);
        if (err.includes('denied')) {
          toast.error(err);
          setUiState('idle');
        }
      },
      onEnd: () => {
        // Automatically handled
      },
    });
  };

  // Command Execution Pipeline
  const executeCommand = async (command: string) => {
    if (!command.trim()) return;

    // Check for conversational dismissal
    if (isDismissalOrThankYou(command)) {
      const signOff = getJarvisSignOffPhrase();
      setResponseLog((prev) => [
        ...prev,
        { role: 'user', text: command },
        { role: 'jarvis', text: signOff },
      ]);
      setUiState('briefing');
      speakJarvis(signOff, {
        onStart: () => setUiState('briefing'),
        onEnd: () => {
          setUiState('idle');
          if (soundFxEnabled) jarvisAudioFx.playSuccessChime();
        },
      });
      return;
    }

    // Standard Query Flow
    setPromptInput('');
    setTranscript('');
    triggerPuffEffect();
    setUiState('processing');

    setResponseLog((prev) => [...prev, { role: 'user', text: command }]);

    try {
      let resultText = '';
      let tacticalAdvice = '';

      if (onExecutePrompt) {
        const res = await onExecutePrompt(command);
        if (res) {
          resultText = res.answer;
          tacticalAdvice = res.actionAdvice || '';
        }
      } else {
        // Direct Query to AI Pipeline
        const res = await fetch('/api/enquiries/ask-ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: command }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to communicate with AI core');
        resultText = data.answer;
        tacticalAdvice = data.actionAdvice || '';

        // Broadcast pipeline action to pipeline board
        if (data.pipelineAction && typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('gapanchor:pipeline-action', { detail: data.pipelineAction })
          );
          setRadarPings((prev) => [
            {
              id: Date.now(),
              angle: Math.floor(Math.random() * 360),
              dist: 140,
              label: `Pipeline: +${data.pipelineAction.count} Staged`,
            },
            ...prev.slice(0, 3),
          ]);
        }
      }

      if (!resultText) {
        resultText = "I have analyzed our operational database, sir. No anomalies or matching queries were detected.";
      }

      setResponseLog((prev) => [
        ...prev,
        { role: 'jarvis', text: resultText, action: tacticalAdvice },
      ]);

      if (soundFxEnabled) jarvisAudioFx.playSuccessChime();

      // Read Output in British Voice with ultra-low latency pipelining
      setUiState('briefing');
      const spokenScript = formatHumanizedJarvisBriefing(resultText, tacticalAdvice);
      prepareJarvisSpeech(spokenScript);
      speakJarvis(spokenScript, {
        onStart: () => setUiState('briefing'),
        onEnd: () => {
          // Continuous follow-up prompt
          const followUp = getJarvisFollowUpPhrase();
          setTimeout(() => {
            speakJarvis(followUp, {
              onStart: () => setUiState('briefing'),
              onEnd: () => {
                setUiState('idle');
              },
            });
          }, 350);
        },
        onError: () => setUiState('idle'),
      });
    } catch (err: any) {
      console.error(err);
      if (soundFxEnabled) jarvisAudioFx.playErrorBuzz();
      setUiState('alert');
      setResponseLog((prev) => [
        ...prev,
        {
          role: 'jarvis',
          text: `Apologies, sir. An internal synchronization fault occurred: ${err.message || 'Unknown exception'}.`,
        },
      ]);
      toast.error(err.message || 'Error processing command');
      setTimeout(() => setUiState('idle'), 4000);
    }
  };

  // State Color Palette Mapping
  const stateTheme = useMemo(() => {
    switch (uiState) {
      case 'listening':
        return {
          coreGradient: 'from-cyan-300 via-sky-400 to-indigo-500',
          ringOuter: 'border-cyan-400',
          ringMiddle: 'border-sky-400/80',
          ringInner: 'border-cyan-300/60',
          glowColor: 'rgba(0, 242, 254, 0.55)',
          label: 'VOICE CAPTURE ACTIVE',
          badgeBg: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
        };
      case 'processing':
        return {
          coreGradient: 'from-violet-400 via-purple-600 to-amber-400',
          ringOuter: 'border-amber-400',
          ringMiddle: 'border-violet-500/90',
          ringInner: 'border-fuchsia-400/70',
          glowColor: 'rgba(127, 0, 255, 0.65)',
          label: 'QUANTUM COMPUTE REASONING',
          badgeBg: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
        };
      case 'briefing':
        return {
          coreGradient: 'from-cyan-400 via-teal-300 to-emerald-400',
          ringOuter: 'border-teal-400',
          ringMiddle: 'border-cyan-400/80',
          ringInner: 'border-emerald-300/60',
          glowColor: 'rgba(20, 241, 149, 0.5)',
          label: 'VOCAL BRIEFING IN PROGRESS',
          badgeBg: 'bg-teal-500/20 text-teal-300 border-teal-500/40',
        };
      case 'alert':
        return {
          coreGradient: 'from-red-500 via-rose-600 to-amber-600',
          ringOuter: 'border-red-500',
          ringMiddle: 'border-rose-400/90',
          ringInner: 'border-amber-500/70',
          glowColor: 'rgba(239, 68, 68, 0.75)',
          label: 'SYSTEM ANOMALY DETECTED',
          badgeBg: 'bg-red-500/20 text-red-300 border-red-500/40',
        };
      case 'idle':
      default:
        return {
          coreGradient: 'from-cyan-400 via-sky-500 to-blue-600',
          ringOuter: 'border-cyan-500/40',
          ringMiddle: 'border-cyan-400/30',
          ringInner: 'border-cyan-300/20',
          glowColor: 'rgba(0, 242, 254, 0.3)',
          label: 'SYSTEM STANDBY // READY',
          badgeBg: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20',
        };
    }
  }, [uiState]);

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`relative w-full ${
        fullScreen ? 'min-h-screen' : 'h-[640px]'
      } bg-[#030712] text-slate-100 flex flex-col justify-between overflow-hidden select-none font-sans`}
      style={{
        perspective: '1200px',
        backgroundImage: `radial-gradient(circle at 50% 50%, rgba(8, 20, 48, 0.7) 0%, rgba(3, 7, 18, 0.98) 100%)`,
      }}
    >
      {/* ─── Optical Background Caustic Grid ─── */}
      <div
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(0, 242, 254, 0.08) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(0, 242, 254, 0.08) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }}
      />

      {/* ─── Top Executive Command Header ─── */}
      <header className="relative z-20 w-full px-6 py-4 flex items-center justify-between border-b border-cyan-500/20 backdrop-blur-md bg-slate-950/40">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-400/30 flex items-center justify-center shadow-[0_0_15px_rgba(0,242,254,0.3)]">
            <Sparkles className="w-4 h-4 text-cyan-300 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-black tracking-widest uppercase text-white font-mono">
                J.A.R.V.I.S. // HOLOGRAPHIC CORE
              </h1>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${stateTheme.badgeBg}`}>
                {stateTheme.label}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono">
              Mark VII Neural Architecture • Voice: <span className="text-cyan-300">{voiceName}</span>
            </p>
          </div>
        </div>

        {/* Acoustic Controls & State Simulators */}
        <div className="flex items-center gap-2">
          {/* Sound FX Toggle */}
          <button
            type="button"
            onClick={() => {
              setSoundFxEnabled(!soundFxEnabled);
              if (soundFxEnabled) jarvisAudioFx.stopAmbientHum();
            }}
            className={`p-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
              soundFxEnabled
                ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                : 'bg-slate-900 border-slate-800 text-slate-500'
            }`}
            title="Toggle Synthesizer Sound FX"
          >
            {soundFxEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">SFX: {soundFxEnabled ? 'ON' : 'OFF'}</span>
          </button>

          {/* 432Hz Ambient Hum */}
          <button
            type="button"
            onClick={() => setAmbientHumEnabled(!ambientHumEnabled)}
            className={`p-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
              ambientHumEnabled
                ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300 shadow-[0_0_12px_rgba(99,102,241,0.3)]'
                : 'bg-slate-900 border-slate-800 text-slate-500'
            }`}
            title="Toggle 432Hz Ambient Breathing Hum"
          >
            <Radio className={`w-3.5 h-3.5 ${ambientHumEnabled ? 'animate-pulse text-indigo-400' : ''}`} />
            <span className="hidden sm:inline">432Hz Hum</span>
          </button>

          {/* Manual State Simulators (For Demonstration) */}
          <div className="hidden lg:flex items-center gap-1 px-2 py-1 bg-slate-900/80 rounded-xl border border-slate-800">
            {(['idle', 'listening', 'processing', 'briefing', 'alert'] as JarvisUiState[]).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => {
                  setUiState(st);
                  if (st === 'processing') triggerPuffEffect();
                  if (st === 'alert' && soundFxEnabled) jarvisAudioFx.playErrorBuzz();
                  if (st === 'briefing' && soundFxEnabled) jarvisAudioFx.playSuccessChime();
                }}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold capitalize transition-all cursor-pointer ${
                  uiState === st
                    ? 'bg-cyan-500 text-slate-950 shadow-[0_0_8px_rgba(0,242,254,0.5)]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-all cursor-pointer"
              title="Close Holographic Interface"
            >
              <Minimize2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      {/* ─── MAIN 3D HOLOGRAPHIC STAGE (50% CENTRAL ORB & SURROUNDING LAYERS) ─── */}
      <main className="relative flex-1 flex items-center justify-center p-4">
        {/* Shockwave Ripples Container */}
        {ripples.map((ripple) => (
          <div
            key={ripple.id}
            className="absolute rounded-full pointer-events-none animate-[ping_1.6s_cubic-bezier(0,0,0.2,1)_forwards] border border-cyan-400/80"
            style={{
              width: '420px',
              height: '420px',
              boxShadow: '0 0 45px rgba(0, 242, 254, 0.4), inset 0 0 35px rgba(0, 242, 254, 0.3)',
            }}
          />
        ))}

        {/* 3D Dynamic Gimbal Stage (Reacts to Mouse Movement) */}
        <div
          className="relative flex items-center justify-center transition-transform duration-300 ease-out"
          style={{
            transform: `rotateX(${mouseTilt.y}deg) rotateY(${mouseTilt.x}deg)`,
            transformStyle: 'preserve-3d',
          }}
        >
          {/* ════ COMPONENT 2: HOLOGRAPHIC DATA RINGS ════ */}
          {/* Ring 3: Outer Ring (Fast ~6s, Critical Alerts & Radar) */}
          <div
            className={`absolute rounded-full border-2 border-dashed ${stateTheme.ringOuter} transition-all duration-700 pointer-events-none`}
            style={{
              width: '540px',
              height: '540px',
              animation: `spin ${uiState === 'alert' ? '2s' : uiState === 'processing' ? '4s' : '8s'} linear infinite`,
              boxShadow: `0 0 25px ${stateTheme.glowColor}`,
              opacity: 0.7,
            }}
          >
            {/* Caliper Tick Marks & Reticles */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 px-2 py-0.5 bg-slate-950 border border-cyan-500/50 rounded text-[9px] font-mono text-cyan-300">
              RADAR // 360°
            </div>
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 px-2 py-0.5 bg-slate-950 border border-cyan-500/50 rounded text-[9px] font-mono text-cyan-300">
              DEFENSE PERIMETER
            </div>
          </div>

          {/* Sweeping Radar Polar Line */}
          <div
            className="absolute rounded-full pointer-events-none"
            style={{
              width: '540px',
              height: '540px',
              background: `conic-gradient(from 0deg, transparent 75%, rgba(0, 242, 254, 0.15) 98%, rgba(0, 242, 254, 0.4) 100%)`,
              animation: 'spin 5s linear infinite',
            }}
          />

          {/* Radar Detected Blip Pings */}
          {radarPings.map((ping) => (
            <div
              key={ping.id}
              className="absolute pointer-events-none flex items-center gap-1 text-[9px] font-mono text-cyan-300 animate-pulse"
              style={{
                transform: `rotate(${ping.angle}deg) translate(${ping.dist}px) rotate(-${ping.angle}deg)`,
              }}
            >
              <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(0,242,254,0.9)]" />
              <span className="bg-slate-950/90 px-1 rounded border border-cyan-500/30">{ping.label}</span>
            </div>
          ))}

          {/* Ring 2: Middle Ring (Medium ~14s Counter-Clockwise, Data Flow) */}
          <div
            className={`absolute rounded-full border border-dotted ${stateTheme.ringMiddle} transition-all duration-700 pointer-events-none`}
            style={{
              width: '430px',
              height: '430px',
              animation: `spin-reverse ${uiState === 'processing' ? '6s' : '14s'} linear infinite`,
              boxShadow: `0 0 15px ${stateTheme.glowColor}`,
              opacity: 0.8,
            }}
          >
            {/* Centrifugal Particle Spoke Indicator */}
            <div className="absolute top-1/2 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent" />
            <div className="absolute top-0 left-1/2 w-[1px] h-full bg-gradient-to-b from-transparent via-cyan-400/40 to-transparent" />
          </div>

          {/* Ring 1: Inner Ring (Slow ~28s, Low-Level System Telemetry) */}
          <div
            className={`absolute rounded-full border-2 border-dashed ${stateTheme.ringInner} transition-all duration-700 pointer-events-none`}
            style={{
              width: '320px',
              height: '320px',
              animation: 'spin 28s linear infinite',
              opacity: 0.85,
            }}
          />

          {/* ════ COMPONENT 1: CENTRAL CORE (ORB) – THE BRAIN OF J.A.R.V.I.S. ════ */}
          <div
            onClick={handleToggleMic}
            className={`relative rounded-full flex items-center justify-center cursor-pointer transition-all duration-500 ${
              puffActive ? 'scale-110' : 'scale-100 hover:scale-105'
            }`}
            style={{
              width: '240px',
              height: '240px',
              transform: 'translateZ(30px)',
            }}
            title="Click to speak with J.A.R.V.I.S."
          >
            {/* Outer Fresnel Caustic Glow */}
            <div
              className="absolute inset-0 rounded-full transition-all duration-700"
              style={{
                background: `radial-gradient(circle, ${stateTheme.glowColor} 0%, transparent 70%)`,
                filter: 'blur(28px)',
                transform: puffActive ? 'scale(1.4)' : 'scale(1.15)',
              }}
            />

            {/* Glowing Crystal Quartz Outer Shell */}
            <div
              className={`absolute inset-0 rounded-full bg-gradient-to-tr ${stateTheme.coreGradient} opacity-85 transition-all duration-500`}
              style={{
                boxShadow: `
                  inset 0 0 35px rgba(255, 255, 255, 0.6),
                  inset 0 0 75px ${stateTheme.glowColor},
                  0 0 50px ${stateTheme.glowColor}
                `,
                animation: uiState === 'idle' ? 'jarvisBreathe 1.5s ease-in-out infinite' : undefined,
              }}
            />

            {/* Inward-Focusing Neon Filaments (Gravitational Flux Lines) */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none animate-[spin_18s_linear_infinite]" viewBox="0 0 100 100">
              <defs>
                <linearGradient id="filamentGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#00F2FE" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.1" />
                </linearGradient>
              </defs>
              {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => (
                <line
                  key={deg}
                  x1="50"
                  y1="50"
                  x2={50 + 44 * Math.cos((deg * Math.PI) / 180)}
                  y2={50 + 44 * Math.sin((deg * Math.PI) / 180)}
                  stroke="url(#filamentGrad)"
                  strokeWidth="0.8"
                  strokeDasharray="4 6"
                />
              ))}
            </svg>

            {/* Inner Metallic Core & State Glyph */}
            <div className="relative z-10 w-24 h-24 rounded-full bg-slate-950/80 border border-white/40 backdrop-blur-md flex flex-col items-center justify-center shadow-[0_0_25px_rgba(0,0,0,0.8)]">
              {uiState === 'listening' ? (
                <Mic className="w-10 h-10 text-cyan-300 animate-pulse" />
              ) : uiState === 'processing' ? (
                <RotateCcw className="w-10 h-10 text-amber-300 animate-spin" />
              ) : uiState === 'briefing' ? (
                <Volume2 className="w-10 h-10 text-teal-300 animate-pulse" />
              ) : uiState === 'alert' ? (
                <ShieldAlert className="w-10 h-10 text-red-400 animate-bounce" />
              ) : (
                <Sparkles className="w-10 h-10 text-cyan-300" />
              )}
              <span className="text-[9px] font-mono font-black text-cyan-200 mt-1 uppercase tracking-wider">
                {uiState === 'idle' ? 'TAP TO TALK' : uiState}
              </span>
            </div>
          </div>
        </div>

        {/* ════ COMPONENT 3: FLOATING TEXT PANELS & DATA BLOCKS (3D HUD GRID) ════ */}
        {/* Panel Top-Left: System Telemetry */}
        <div
          className="absolute top-6 left-6 w-72 p-4 rounded-2xl bg-slate-950/60 backdrop-blur-xl border border-cyan-500/25 shadow-[0_8px_32px_rgba(0,0,0,0.5)] transition-all duration-300 hover:border-cyan-400/60 hover:translate-y-[-4px] group"
          style={{ transform: `translateZ(20px)` }}
        >
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <span className="text-[10px] font-mono font-bold tracking-wider text-cyan-400 uppercase flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-cyan-300" />
              KERNEL METRICS
            </span>
            <span className="text-[10px] font-mono text-emerald-400 font-bold">ONLINE</span>
          </div>
          <div className="mt-3 space-y-2 text-xs font-mono">
            <div className="flex justify-between items-center text-slate-300">
              <span className="text-slate-400">Compute Load:</span>
              <span className="font-bold text-white">{metrics.cpuLoad}%</span>
            </div>
            <div className="w-full bg-slate-900 h-1 rounded-full overflow-hidden">
              <div
                className="bg-cyan-400 h-full transition-all duration-500"
                style={{ width: `${metrics.cpuLoad}%` }}
              />
            </div>
            <div className="flex justify-between text-slate-300">
              <span className="text-slate-400">Throughput:</span>
              <span className="text-cyan-300 font-bold">{metrics.neuralThroughput} t/s</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span className="text-slate-400">Latency:</span>
              <span className="text-white font-bold">{metrics.networkLatency} ms</span>
            </div>
          </div>
        </div>

        {/* Panel Top-Right: Enterprise CRM Intelligence */}
        <div
          className="absolute top-6 right-6 w-80 p-4 rounded-2xl bg-slate-950/60 backdrop-blur-xl border border-cyan-500/25 shadow-[0_8px_32px_rgba(0,0,0,0.5)] transition-all duration-300 hover:border-cyan-400/60 hover:translate-y-[-4px] group"
          style={{ transform: `translateZ(20px)` }}
        >
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <span className="text-[10px] font-mono font-bold tracking-wider text-cyan-400 uppercase flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-cyan-300" />
              CRM RADAR RECON
            </span>
            <span className="text-[10px] font-mono text-cyan-300 font-bold">449 LEADS</span>
          </div>
          <div className="mt-3 space-y-2 text-xs font-mono">
            <div className="flex justify-between text-slate-300">
              <span className="text-slate-400">Top Target:</span>
              <span className="text-cyan-300 font-bold">Manhattan WMS</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span className="text-slate-400">Follow-ups Due:</span>
              <span className="text-amber-400 font-bold">Active Today</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span className="text-slate-400">Outlook Sync:</span>
              <span className="text-emerald-400 font-bold">Azure Entra 200 OK</span>
            </div>
          </div>
        </div>

        {/* Panel Bottom-Left: Live Bilateral Audio Waveform */}
        <div
          className="absolute bottom-28 left-6 w-72 p-3.5 rounded-2xl bg-slate-950/60 backdrop-blur-xl border border-cyan-500/25 shadow-[0_8px_32px_rgba(0,0,0,0.5)] transition-all duration-300"
          style={{ transform: `translateZ(20px)` }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono font-bold tracking-wider text-cyan-400 uppercase flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-cyan-300" />
              ACOUSTIC FREQUENCY (FFT)
            </span>
            <span className="text-[9px] font-mono text-slate-400">44.1 kHz</span>
          </div>
          {/* ════ COMPONENT 5: REAL-TIME DATA VISUALIZATION (AUDIO WAVEFORM) ════ */}
          <div className="h-10 flex items-center justify-between gap-1 px-1">
            {speechEnergy.map((h, i) => (
              <span
                key={i}
                className="w-1.5 rounded-full bg-gradient-to-t from-cyan-500 to-indigo-400 transition-all duration-75"
                style={{
                  height: `${h}px`,
                  opacity: uiState === 'listening' || uiState === 'briefing' ? 0.9 : 0.35,
                }}
              />
            ))}
          </div>
        </div>

        {/* Panel Bottom-Right: Live Dialogue Feed */}
        <div
          className="absolute bottom-28 right-6 w-80 max-h-48 overflow-y-auto p-3.5 rounded-2xl bg-slate-950/60 backdrop-blur-xl border border-cyan-500/25 shadow-[0_8px_32px_rgba(0,0,0,0.5)] transition-all duration-300 space-y-2 text-xs font-mono"
          style={{ transform: `translateZ(20px)` }}
        >
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
            <span className="text-[10px] font-mono font-bold tracking-wider text-cyan-400 uppercase">
              EXECUTIVE DIALOGUE LOG
            </span>
          </div>
          {responseLog.slice(-3).map((msg, idx) => (
            <div key={idx} className="space-y-1">
              <span className={`text-[10px] font-bold ${msg.role === 'user' ? 'text-indigo-400' : 'text-cyan-300'}`}>
                {msg.role === 'user' ? '// OPERATOR:' : '// J.A.R.V.I.S.:'}
              </span>
              <p className="text-slate-200 text-[11px] leading-relaxed pl-2 border-l border-cyan-500/30">
                {msg.text}
              </p>
            </div>
          ))}
          {transcript && (
            <div className="space-y-1 animate-pulse">
              <span className="text-[10px] font-bold text-rose-400">// LISTENING LIVE:</span>
              <p className="text-cyan-200 text-[11px] italic pl-2 border-l border-rose-500/50">
                &ldquo;{transcript}&rdquo;
              </p>
            </div>
          )}
        </div>
      </main>

      {/* ─── BOTTOM COMMAND DOCK & QUICK PROMPTS ─── */}
      <footer className="relative z-20 w-full px-6 py-4 border-t border-cyan-500/20 backdrop-blur-md bg-slate-950/60 flex flex-col gap-2.5">
        {/* Quick Suggestion Chips */}
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">COMMAND PROMPTS:</span>
          {[
            'Interested candidates from transcripts',
            'Who should I call first today?',
            'High intent Manhattan WMS leads',
            'Show active red flags',
          ].map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => executeCommand(prompt)}
              className="px-3 py-1 rounded-full text-xs font-mono bg-slate-900/90 hover:bg-cyan-950/60 border border-slate-800 hover:border-cyan-500/50 text-slate-300 hover:text-cyan-200 transition-all cursor-pointer"
            >
              &ldquo;{prompt}&rdquo;
            </button>
          ))}
        </div>

        {/* Input Bar & Mic Trigger */}
        <div className="max-w-3xl w-full mx-auto flex items-center gap-2">
          <button
            type="button"
            onClick={handleToggleMic}
            className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-center ${
              uiState === 'listening'
                ? 'bg-rose-500 text-white border-rose-400 shadow-[0_0_20px_rgba(244,63,94,0.6)] animate-pulse'
                : 'bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
            }`}
            title={uiState === 'listening' ? 'Click to stop listening' : 'Click to speak'}
          >
            {uiState === 'listening' ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (promptInput.trim()) executeCommand(promptInput.trim());
            }}
            className="flex-1 relative flex items-center"
          >
            <input
              type="text"
              value={promptInput}
              onChange={(e) => setPromptInput(e.target.value)}
              placeholder='Direct J.A.R.V.I.S. (e.g. "Find high intent Manhattan WMS leads")...'
              className="w-full px-4 py-3 rounded-2xl bg-slate-900/90 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-cyan-400 shadow-inner font-mono"
            />
            <button
              type="submit"
              disabled={!promptInput.trim() || uiState === 'processing'}
              className="absolute right-2 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-slate-950 font-bold text-xs flex items-center gap-1 shadow-md transition-all disabled:opacity-30 cursor-pointer"
            >
              <span>DISPATCH</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </footer>

      {/* Global Embedded Styles for Custom Hologram Animations */}
      <style jsx global>{`
        @keyframes jarvisBreathe {
          0%, 100% {
            transform: scale(1);
            filter: drop-shadow(0 0 25px rgba(0, 242, 254, 0.4));
          }
          50% {
            transform: scale(1.028);
            filter: drop-shadow(0 0 45px rgba(0, 242, 254, 0.7));
          }
        }
        @keyframes spin-reverse {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }
      `}</style>
    </div>
  );
}
