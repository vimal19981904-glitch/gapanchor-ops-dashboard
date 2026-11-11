/**
 * GapAnchor Ops Dashboard - J.A.R.V.I.S. Clean & Robust Voice Listener
 * Engineered for instant human speech capture across localhost & HTTPS production
 * (Desktop Chrome/Edge/Safari, Android Chrome, and iOS), with zero mic lock collisions
 * and automatic MediaRecorder + Gemini transcription fallback when Web Speech stalls.
 */

export type JarvisListeningMode = 'speech_api' | 'recorder';

export interface JarvisListeningCallbacks {
  onInterim?: (text: string) => void;
  onFinal: (text: string) => void;
  onError?: (error: string) => void;
  onStart?: () => void;
  onEnd?: () => void;
  onAudioLevel?: (level: number) => void;
  onModeChange?: (mode: JarvisListeningMode) => void;
  onProcessingAudio?: () => void;
}

let activePromptRecognition: any = null;
let wakeWordRecognition: any = null;
let isWakeWordActive = false;
let autoSubmitTimeout: any = null;
let isListeningSessionOpen = false;
let lastWakeAbortTimestamp = 0;

let activePromptCallbacks: JarvisListeningCallbacks | null = null;
let activePromptAccumulated = '';
let activePromptInterim = '';
let activePromptDelivered = false;
let activePromptRestartTimer: any = null;
let consecutiveQuickFailures = 0;

// Recorder fallback state
let activeMediaRecorder: MediaRecorder | null = null;
let activeMediaStream: MediaStream | null = null;
let activeRecorderAudioCtx: AudioContext | null = null;
let activeVadTimer: any = null;
let activeRecorderMaxTimer: any = null;
let abortRecorderDiscard = false;
let recorderSilentRetries = 0;

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
}

export function isMediaRecorderSupported(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  return Boolean(navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined');
}

export function isAnyVoiceInputSupported(): boolean {
  return isSpeechRecognitionSupported() || isMediaRecorderSupported();
}

function getSpeechRecognitionClass(): any {
  if (typeof window === 'undefined') return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

function isMobileOrSafariBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isMobile = /iPhone|iPad|iPod|Android/i.test(ua);
  const isSafari = /Safari/i.test(ua) && !/Chrome|Chromium|Edg/i.test(ua);
  return isMobile || isSafari;
}

// Stricter wake-word pattern: requires intentional invocation
const STRICT_WAKE_WORD_REGEX = /^\s*(?:hey|hi|hello|ok|okay)?\s*(?:jarvis|javis|jar\s*vis|travis)\b/i;
const INLINE_WAKE_WORD_REGEX = /\b(?:hey|hi|ok|okay)\s+(?:jarvis|javis)\b/i;

// Common Jarvis self-echoes or speaker bleeds to ignore
const ECHO_PHRASES = [
  /^sir$/i,
  /^ready$/i,
  /^jarvis$/i,
  /^hey jarvis$/i,
  /what can i do for you/i,
  /checking the details/i,
  /good morning/i,
  /good afternoon/i,
  /good evening/i,
  /anything else i can assist/i,
  /standing by whenever/i,
  /briefing executive/i,
  /online sir/i,
];

/**
 * Checks if the speech is just speaker reverberation or an accidental filler sound
 */
export function isJarvisSelfEchoOrFiller(text: string): boolean {
  const t = text.trim().toLowerCase().replace(/[.,!?;:'"]/g, '');
  if (!t || t.length < 2) return true;
  if (['uh', 'um', 'ah', 'er', 'mm'].includes(t)) return true;
  return ECHO_PHRASES.some((rx) => rx.test(t));
}

/**
 * Determines whether a transcript represents a genuine, actionable user command.
 * Strips any accidental wake-word prefix (e.g. "Hey Jarvis, who should I call?")
 */
export function isActionablePrompt(text: string): boolean {
  if (!text) return false;
  let cleaned = text.trim().replace(/[.,!?;:'"]/g, '').toLowerCase();
  cleaned = cleaned.replace(/^(?:hey|hi|hello|ok|okay)?\s*(?:jarvis|javis)\s*/i, '').trim();

  if (!cleaned) return false;
  if (cleaned.length < 2) return false;
  if (isJarvisSelfEchoOrFiller(cleaned)) return false;
  return true;
}

function cleanupRecorderResources(): void {
  if (activeVadTimer) {
    clearInterval(activeVadTimer);
    activeVadTimer = null;
  }
  if (activeRecorderMaxTimer) {
    clearTimeout(activeRecorderMaxTimer);
    activeRecorderMaxTimer = null;
  }
  if (activeRecorderAudioCtx) {
    try {
      activeRecorderAudioCtx.close().catch(() => {});
    } catch {}
    activeRecorderAudioCtx = null;
  }
  if (activeMediaStream) {
    try {
      activeMediaStream.getTracks().forEach((track) => track.stop());
    } catch {}
    activeMediaStream = null;
  }
  activeMediaRecorder = null;
  activePromptCallbacks?.onAudioLevel?.(0);
}

function deliverFinalPrompt(text: string): void {
  if (activePromptDelivered) return;
  const clean = text.trim();
  if (!isActionablePrompt(clean)) return;

  activePromptDelivered = true;
  isListeningSessionOpen = false;
  const cb = activePromptCallbacks;

  if (autoSubmitTimeout) {
    clearTimeout(autoSubmitTimeout);
    autoSubmitTimeout = null;
  }
  clearTimeout(activePromptRestartTimer);

  stopActivePromptListening();

  if (cb?.onFinal) {
    cb.onFinal(clean);
  }
}

/**
 * Fallback voice capture via getUserMedia + MediaRecorder + Gemini /api/ai/transcribe.
 * Works reliably on iOS WebKit, Firefox, Brave, restricted HTTPS networks, and whenever Web Speech stalls.
 */
async function startRecorderFallbackListening(): Promise<void> {
  if (!isListeningSessionOpen || activePromptDelivered) return;

  if (!isMediaRecorderSupported()) {
    isListeningSessionOpen = false;
    activePromptCallbacks?.onError?.('Voice input is not supported in this browser.');
    return;
  }

  cleanupRecorderResources();
  abortRecorderDiscard = false;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    if (!isListeningSessionOpen || activePromptDelivered) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }

    activeMediaStream = stream;

    const mimeCandidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
    const selectedMime = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m));
    const recorder = selectedMime ? new MediaRecorder(stream, { mimeType: selectedMime }) : new MediaRecorder(stream);
    activeMediaRecorder = recorder;

    const chunks: BlobPart[] = [];
    let hasDetectedSpeech = false;
    let forceSubmitRequested = false;
    let speechStartedAt = 0;
    let lastSpeechAt = 0;
    let activeSpeechFrames = 0;

    recorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) {
        chunks.push(ev.data);
      }
    };

    // Live Web Audio volume meter & silence VAD
    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        const ctx = new AudioCtxClass();
        activeRecorderAudioCtx = ctx;
        if (ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        src.connect(analyser);
        const timeData = new Uint8Array(analyser.fftSize);

        activeVadTimer = setInterval(() => {
          if (!activeMediaRecorder || activeMediaRecorder.state !== 'recording') return;
          analyser.getByteTimeDomainData(timeData);
          let sumSq = 0;
          for (let i = 0; i < timeData.length; i++) {
            const norm = (timeData[i] - 128) / 128;
            sumSq += norm * norm;
          }
          const rms = Math.sqrt(sumSq / timeData.length);
          const level = Math.min(1, rms * 5.5);
          activePromptCallbacks?.onAudioLevel?.(level);

          const now = Date.now();
          if (level > 0.085) {
            activeSpeechFrames++;
            lastSpeechAt = now;
            if (!hasDetectedSpeech && activeSpeechFrames >= 2) {
              hasDetectedSpeech = true;
              speechStartedAt = now;
            }
          } else {
            activeSpeechFrames = 0;
          }

          if (
            hasDetectedSpeech &&
            now - speechStartedAt > 450 &&
            now - lastSpeechAt > 1250 &&
            activeMediaRecorder.state === 'recording'
          ) {
            activeMediaRecorder.stop();
          }
        }, 65);
      }
    } catch {
      // Recorder still runs with manual submit / 12s max duration if AudioContext isn't available
    }

    recorder.onstop = async () => {
      const recordedMime = recorder.mimeType || selectedMime || 'audio/webm';
      cleanupRecorderResources();

      if (abortRecorderDiscard || !isListeningSessionOpen || activePromptDelivered) {
        return;
      }

      const audioBlob = new Blob(chunks, { type: recordedMime });
      if (audioBlob.size < 600 || (!hasDetectedSpeech && !forceSubmitRequested)) {
        if (recorderSilentRetries < 1 && isListeningSessionOpen && !activePromptDelivered) {
          recorderSilentRetries++;
          void startRecorderFallbackListening();
          return;
        }
        isListeningSessionOpen = false;
        activePromptCallbacks?.onError?.('No speech detected. Tap "Tap to Speak" and try again.');
        return;
      }

      activePromptCallbacks?.onProcessingAudio?.();

      try {
        const formData = new FormData();
        formData.append('audio', audioBlob, recordedMime.includes('mp4') ? 'voice.mp4' : 'voice.webm');

        const res = await fetch('/api/ai/transcribe', {
          method: 'POST',
          body: formData,
        });

        const data = await res.json();
        if (!isListeningSessionOpen || activePromptDelivered) return;

        if (!res.ok || !data?.success) {
          throw new Error(data?.error || 'Could not transcribe voice input.');
        }

        const transcript = (data.transcript || '').trim();
        if (isActionablePrompt(transcript)) {
          deliverFinalPrompt(transcript);
        } else {
          isListeningSessionOpen = false;
          activePromptCallbacks?.onError?.('Could not hear clear speech. Tap "Tap to Speak" and try again.');
        }
      } catch (err: any) {
        if (!isListeningSessionOpen || activePromptDelivered) return;
        isListeningSessionOpen = false;
        activePromptCallbacks?.onError?.(err?.message || 'Voice transcription failed.');
      }
    };

    // Expose manual stop-and-send hook via flag on recorder instance
    (recorder as any).__markForceSubmit = () => {
      forceSubmitRequested = true;
    };

    recorder.start(250);
    activePromptCallbacks?.onModeChange?.('recorder');
    activePromptCallbacks?.onStart?.();

    activeRecorderMaxTimer = setTimeout(() => {
      if (activeMediaRecorder && activeMediaRecorder.state === 'recording') {
        (activeMediaRecorder as any).__markForceSubmit?.();
        activeMediaRecorder.stop();
      }
    }, 15000);
  } catch (err: any) {
    cleanupRecorderResources();
    isListeningSessionOpen = false;
    const msg =
      err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError'
        ? 'Microphone access denied. Please click the lock/mic icon in your browser address bar to allow.'
        : 'Could not access microphone. Please check your device microphone settings.';
    activePromptCallbacks?.onError?.(msg);
  }
}

/**
 * Stops active recorder capture and immediately submits the audio for transcription.
 */
export function submitActiveRecorderNow(): boolean {
  if (activeMediaRecorder && activeMediaRecorder.state === 'recording') {
    (activeMediaRecorder as any).__markForceSubmit?.();
    activeMediaRecorder.stop();
    return true;
  }
  return false;
}

/**
 * Spawns a fresh SpeechRecognition instance for active prompt listening.
 * In Chromium, SpeechRecognition cannot be restarted once stopped; a fresh instance avoids InvalidStateError.
 */
function spawnActivePromptRecognition(): any {
  if (!isListeningSessionOpen || activePromptDelivered) return null;
  const SpeechRecognitionClass = getSpeechRecognitionClass();
  if (!SpeechRecognitionClass) {
    void startRecorderFallbackListening();
    return null;
  }

  try {
    if (activePromptRecognition) {
      try {
        activePromptRecognition.onstart = null;
        activePromptRecognition.onresult = null;
        activePromptRecognition.onerror = null;
        activePromptRecognition.onend = null;
        activePromptRecognition.abort();
      } catch {}
      activePromptRecognition = null;
    }

    const recognition = new SpeechRecognitionClass();
    recognition.lang = 'en-US';
    recognition.continuous = !isMobileOrSafariBrowser();
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    const cycleStartedAt = Date.now();
    let cycleGotResult = false;

    recognition.onstart = () => {
      activePromptCallbacks?.onModeChange?.('speech_api');
      activePromptCallbacks?.onStart?.();
    };

    recognition.onresult = (event: any) => {
      consecutiveQuickFailures = 0;
      cycleGotResult = true;
      activePromptInterim = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const item = event.results[i];
        const piece = item[0]?.transcript || '';
        if (item.isFinal) {
          activePromptAccumulated = (activePromptAccumulated + ' ' + piece).trim();
        } else {
          activePromptInterim += piece;
        }
      }

      const combined = (activePromptAccumulated + ' ' + activePromptInterim).trim();

      if (activePromptCallbacks?.onInterim) {
        activePromptCallbacks.onInterim(combined);
      }

      if (autoSubmitTimeout) {
        clearTimeout(autoSubmitTimeout);
        autoSubmitTimeout = null;
      }

      if (isActionablePrompt(combined)) {
        const wordCount = combined.trim().split(/\s+/).length;
        const debounceMs = wordCount >= 3 ? 650 : 850;

        autoSubmitTimeout = setTimeout(() => {
          if (isListeningSessionOpen && !activePromptDelivered) {
            deliverFinalPrompt(combined);
          }
        }, debounceMs);
      }
    };

    recognition.onerror = (event: any) => {
      const err = event.error;
      if (err === 'no-speech' || err === 'aborted') {
        return;
      }

      if (err === 'not-allowed') {
        isListeningSessionOpen = false;
        activePromptCallbacks?.onError?.(
          'Microphone access denied. Please click the camera/mic icon in your browser address bar.'
        );
        return;
      }

      // On network/audio-capture/service-not-allowed (common on Brave, iOS Chrome, or strict HTTPS networks),
      // tear down broken SpeechRecognition cleanly and fall back to MediaRecorder + Gemini transcription.
      if (
        (err === 'service-not-allowed' ||
          err === 'network' ||
          err === 'audio-capture' ||
          err === 'language-not-supported') &&
        isMediaRecorderSupported()
      ) {
        console.warn(`Speech API error (${err}); switching seamlessly to MediaRecorder fallback.`);
        try {
          recognition.onstart = null;
          recognition.onresult = null;
          recognition.onerror = null;
          recognition.onend = null;
          recognition.abort();
        } catch {}
        activePromptRecognition = null;
        void startRecorderFallbackListening();
        return;
      }

      isListeningSessionOpen = false;
      activePromptCallbacks?.onError?.(`Microphone error (${err || 'unavailable'}). Tap "Tap to Speak" to retry.`);
    };

    recognition.onend = () => {
      activePromptRecognition = null;
      const fullText = (activePromptAccumulated + ' ' + activePromptInterim).trim();

      if (isActionablePrompt(fullText) && !activePromptDelivered) {
        deliverFinalPrompt(fullText);
        return;
      }

      if (!isListeningSessionOpen || activePromptDelivered) {
        activePromptCallbacks?.onEnd?.();
        return;
      }

      if (!cycleGotResult && Date.now() - cycleStartedAt < 1800) {
        consecutiveQuickFailures++;
        if (consecutiveQuickFailures >= 2 && isMediaRecorderSupported()) {
          console.warn('Speech API closed rapidly with zero audio frames; switching to MediaRecorder fallback.');
          void startRecorderFallbackListening();
          return;
        }
      }

      clearTimeout(activePromptRestartTimer);
      activePromptRestartTimer = setTimeout(() => {
        if (isListeningSessionOpen && !activePromptDelivered && !activePromptRecognition && !activeMediaRecorder) {
          spawnActivePromptRecognition();
        }
      }, 160);
    };

    recognition.start();
    activePromptRecognition = recognition;
    return recognition;
  } catch (err: any) {
    console.warn('SpeechRecognition start failed, attempting MediaRecorder fallback:', err);
    if (isMediaRecorderSupported()) {
      void startRecorderFallbackListening();
      return null;
    }
    isListeningSessionOpen = false;
    activePromptCallbacks?.onError?.('Could not start microphone. Tap "Tap to Speak" to try again.');
    return null;
  }
}

/**
 * Starts active prompt listening session with real-time word accumulation.
 * Preserves synchronous click-gesture activation whenever wake-word mic isn't closing,
 * and falls back seamlessly to MediaRecorder + Gemini transcription on unsupported/blocked engines.
 */
export function startActivePromptListening(callbacks: JarvisListeningCallbacks): any {
  if (!isAnyVoiceInputSupported()) {
    callbacks.onError?.('Microphone capture requires Chrome, Edge, Safari, or a modern HTTPS browser.');
    return null;
  }

  // 1. Abort background wake-word so mic is dedicated to prompt
  const hadLiveWakeInstance = Boolean(wakeWordRecognition) || Date.now() - lastWakeAbortTimestamp < 220;
  stopWakeWordMonitor();

  // 2. Clean up any lingering active recorder or timers
  abortRecorderDiscard = true;
  if (activeMediaRecorder && activeMediaRecorder.state === 'recording') {
    try { activeMediaRecorder.stop(); } catch {}
  }
  cleanupRecorderResources();

  if (autoSubmitTimeout) {
    clearTimeout(autoSubmitTimeout);
    autoSubmitTimeout = null;
  }
  clearTimeout(activePromptRestartTimer);

  activePromptCallbacks = callbacks;
  activePromptAccumulated = '';
  activePromptInterim = '';
  activePromptDelivered = false;
  consecutiveQuickFailures = 0;
  recorderSilentRetries = 0;
  isListeningSessionOpen = true;

  // If wake-word just released hardware audio, yield 180ms so Chrome/Safari frees the mic session cleanly
  if (hadLiveWakeInstance) {
    activePromptRestartTimer = setTimeout(() => {
      if (isListeningSessionOpen && !activePromptDelivered) {
        spawnActivePromptRecognition();
      }
    }, 180);
    return null;
  }

  // Otherwise start 0ms synchronously inside the user gesture!
  return spawnActivePromptRecognition();
}

export function stopActivePromptListening(): void {
  isListeningSessionOpen = false;
  activePromptDelivered = true;
  clearTimeout(activePromptRestartTimer);
  if (autoSubmitTimeout) {
    clearTimeout(autoSubmitTimeout);
    autoSubmitTimeout = null;
  }
  abortRecorderDiscard = true;
  if (activeMediaRecorder && activeMediaRecorder.state === 'recording') {
    try { activeMediaRecorder.stop(); } catch {}
  }
  cleanupRecorderResources();

  if (activePromptRecognition) {
    try {
      activePromptRecognition.onstart = null;
      activePromptRecognition.onresult = null;
      activePromptRecognition.onerror = null;
      activePromptRecognition.onend = null;
      activePromptRecognition.abort();
    } catch {}
    activePromptRecognition = null;
  }
}

let wakeWordCallback: ((trailingPrompt?: string) => void) | null = null;
let wakeWordErrorCallback: ((err: any) => void) | null = null;
let wakeWordRestartTimer: any = null;
let wakeConsecutiveErrors = 0;

function spawnWakeWordRecognition(): any {
  if (!isWakeWordActive || activePromptRecognition || activeMediaRecorder || isListeningSessionOpen) return null;
  const SpeechRecognitionClass = getSpeechRecognitionClass();
  if (!SpeechRecognitionClass) return null;

  try {
    if (wakeWordRecognition) {
      try {
        wakeWordRecognition.onend = null;
        wakeWordRecognition.onerror = null;
        wakeWordRecognition.abort();
      } catch {}
      wakeWordRecognition = null;
    }

    const recognition = new SpeechRecognitionClass();
    recognition.lang = 'en-US';
    recognition.continuous = !isMobileOrSafariBrowser();
    recognition.interimResults = true;

    const wakeStartedAt = Date.now();
    let wakeGotResult = false;

    recognition.onresult = (event: any) => {
      wakeConsecutiveErrors = 0;
      wakeGotResult = true;

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const rawText = (event.results[i][0]?.transcript || '').trim();

        const isStrictMatch = STRICT_WAKE_WORD_REGEX.test(rawText);
        const isInlineMatch = INLINE_WAKE_WORD_REGEX.test(rawText);

        if (isStrictMatch || isInlineMatch) {
          const match = rawText.match(/(?:hey\s+|hi\s+|ok\s+|okay\s+)?jarvis\b/i);
          let trailing = '';
          if (match && typeof match.index === 'number') {
            trailing = rawText.slice(match.index + match[0].length).trim();
          }

          stopWakeWordMonitor();

          if (wakeWordCallback) {
            if (isActionablePrompt(trailing)) {
              wakeWordCallback(trailing);
            } else {
              wakeWordCallback(undefined);
            }
          }
          return;
        }
      }
    };

    recognition.onerror = (e: any) => {
      const err = e?.error;
      if (err === 'no-speech' || err === 'aborted') {
        return;
      }
      // Fatal background errors: do NOT respawn 5x/sec without permission or network
      if (err === 'not-allowed' || err === 'service-not-allowed' || err === 'audio-capture' || err === 'network') {
        isWakeWordActive = false;
        clearTimeout(wakeWordRestartTimer);
      }
      if (wakeWordErrorCallback) {
        wakeWordErrorCallback(e);
      }
    };

    recognition.onend = () => {
      wakeWordRecognition = null;
      if (!isWakeWordActive || activePromptRecognition || activeMediaRecorder || isListeningSessionOpen) {
        return;
      }

      if (!wakeGotResult && Date.now() - wakeStartedAt < 1500) {
        wakeConsecutiveErrors++;
        if (wakeConsecutiveErrors >= 3) {
          isWakeWordActive = false;
          if (wakeWordErrorCallback) {
            wakeWordErrorCallback({ error: 'service-unavailable' });
          }
          return;
        }
      }

      clearTimeout(wakeWordRestartTimer);
      wakeWordRestartTimer = setTimeout(() => {
        if (isWakeWordActive && !activePromptRecognition && !activeMediaRecorder && !isListeningSessionOpen) {
          spawnWakeWordRecognition();
        }
      }, 250);
    };

    recognition.start();
    wakeWordRecognition = recognition;
    return recognition;
  } catch (err) {
    console.debug('Wake word init notice:', err);
    isWakeWordActive = false;
    if (wakeWordErrorCallback) wakeWordErrorCallback(err);
    return null;
  }
}

/**
 * Continuous Background Wake-Word ("Hey Jarvis") Monitor.
 * Automatically aborts when user speaks a prompt or opens active Voice Mode.
 */
export function startWakeWordMonitor(
  onWakeWord: (trailingPrompt?: string) => void,
  onError?: (err: any) => void
): any {
  wakeWordCallback = onWakeWord;
  wakeWordErrorCallback = onError || null;
  wakeConsecutiveErrors = 0;
  clearTimeout(wakeWordRestartTimer);
  stopWakeWordMonitor();
  isWakeWordActive = true;
  return spawnWakeWordRecognition();
}

export function pauseWakeWordMonitor(): void {
  isWakeWordActive = false;
  clearTimeout(wakeWordRestartTimer);
  if (wakeWordRecognition) {
    lastWakeAbortTimestamp = Date.now();
    try {
      wakeWordRecognition.onend = null;
      wakeWordRecognition.onerror = null;
      wakeWordRecognition.abort();
    } catch {}
    wakeWordRecognition = null;
  }
}

export function resumeWakeWordMonitor(
  onWakeWord: (trailingPrompt?: string) => void,
  onError?: (err: any) => void
): void {
  startWakeWordMonitor(onWakeWord, onError);
}

export function stopWakeWordMonitor(): void {
  isWakeWordActive = false;
  clearTimeout(wakeWordRestartTimer);
  if (wakeWordRecognition) {
    lastWakeAbortTimestamp = Date.now();
    try {
      wakeWordRecognition.onend = null;
      wakeWordRecognition.onerror = null;
      wakeWordRecognition.abort();
    } catch {}
    wakeWordRecognition = null;
  }
}

export function stopAllListening(): void {
  stopActivePromptListening();
  stopWakeWordMonitor();
}
