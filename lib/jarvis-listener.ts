/**
 * GapAnchor Ops Dashboard - J.A.R.V.I.S. Clean & Robust Voice Listener
 * Engineered for instant human speech capture, zero false-triggers,
 * full barge-in interruptibility, and echo filtering.
 */

export interface JarvisListeningCallbacks {
  onInterim?: (text: string) => void;
  onFinal: (text: string) => void;
  onError?: (error: string) => void;
  onStart?: () => void;
  onEnd?: () => void;
}

let activePromptRecognition: any = null;
let wakeWordRecognition: any = null;
let isWakeWordActive = false;
let autoSubmitTimeout: any = null;
let isListeningSessionOpen = false;

let activePromptCallbacks: JarvisListeningCallbacks | null = null;
let activePromptAccumulated = '';
let activePromptInterim = '';
let activePromptDelivered = false;
let activePromptRestartTimer: any = null;

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
}

function getSpeechRecognitionClass(): any {
  if (typeof window === 'undefined') return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

// Stricter wake-word pattern: requires intentional invocation
const STRICT_WAKE_WORD_REGEX = /^\s*(?:hey|hi|hello|ok|okay)?\s*(?:jarvis|javis|jar\s*vis|travis)\b/i;
const INLINE_WAKE_WORD_REGEX = /\b(?:hey|hi|ok|okay)\s+(?:jarvis|javis)\b/i;

// Common Jarvis self-echoes or speaker bleeds to ignore
const ECHO_PHRASES = [
  /^sir$/i,
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
  // Strip wake word prefix if user included it in prompt
  cleaned = cleaned.replace(/^(?:hey|hi|hello|ok|okay)?\s*(?:jarvis|javis)\s*/i, '').trim();

  if (!cleaned) return false;
  if (cleaned.length < 2) return false;
  if (isJarvisSelfEchoOrFiller(cleaned)) return false;
  return true;
}

/**
 * Spawns a fresh SpeechRecognition instance for active prompt listening.
 * In Chromium, SpeechRecognition cannot be restarted once stopped; a fresh instance avoids InvalidStateError.
 */
function spawnActivePromptRecognition(): any {
  if (!isListeningSessionOpen || activePromptDelivered) return null;
  const SpeechRecognitionClass = getSpeechRecognitionClass();
  if (!SpeechRecognitionClass) return null;

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
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    const deliverResult = (text: string) => {
      if (activePromptDelivered) return;
      const clean = text.trim();
      if (!isActionablePrompt(clean)) {
        return;
      }

      activePromptDelivered = true;
      isListeningSessionOpen = false;

      if (autoSubmitTimeout) {
        clearTimeout(autoSubmitTimeout);
        autoSubmitTimeout = null;
      }
      clearTimeout(activePromptRestartTimer);

      stopActivePromptListening();

      if (activePromptCallbacks?.onFinal) {
        activePromptCallbacks.onFinal(clean);
      }
    };

    recognition.onstart = () => {
      if (activePromptCallbacks?.onStart) activePromptCallbacks.onStart();
    };

    recognition.onresult = (event: any) => {
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
            deliverResult(combined);
          }
        }, debounceMs);
      }
    };

    recognition.onerror = (event: any) => {
      const err = event.error;
      if (err === 'no-speech' || err === 'aborted') {
        return;
      }
      if (err === 'not-allowed' || err === 'service-not-allowed') {
        isListeningSessionOpen = false;
        if (activePromptCallbacks?.onError) {
          activePromptCallbacks.onError('Microphone access denied. Please click the camera/mic icon in your browser address bar.');
        }
        return;
      }
      console.warn('Speech recognition notice:', err);
    };

    recognition.onend = () => {
      activePromptRecognition = null;
      const fullText = (activePromptAccumulated + ' ' + activePromptInterim).trim();

      if (isActionablePrompt(fullText) && !activePromptDelivered) {
        deliverResult(fullText);
      } else if (isListeningSessionOpen && !activePromptDelivered) {
        clearTimeout(activePromptRestartTimer);
        activePromptRestartTimer = setTimeout(() => {
          if (isListeningSessionOpen && !activePromptDelivered && !activePromptRecognition) {
            spawnActivePromptRecognition();
          }
        }, 150);
      } else if (activePromptCallbacks?.onEnd) {
        activePromptCallbacks.onEnd();
      }
    };

    recognition.start();
    activePromptRecognition = recognition;
    return recognition;
  } catch (err: any) {
    console.error('Failed to initialize speech recognition:', err);
    isListeningSessionOpen = false;
    if (activePromptCallbacks?.onError) {
      activePromptCallbacks.onError('Could not start microphone. Click Resume Mic to try again.');
    }
    return null;
  }
}

/**
 * Starts active prompt listening session with real-time word accumulation.
 * Features low-latency debounce, manual submission compatibility, and fresh-instance auto-restart.
 */
export function startActivePromptListening(callbacks: JarvisListeningCallbacks): any {
  const SpeechRecognitionClass = getSpeechRecognitionClass();
  if (!SpeechRecognitionClass) {
    if (callbacks.onError) {
      callbacks.onError('Speech Recognition requires Google Chrome or Microsoft Edge.');
    }
    return null;
  }

  // 1. Completely suspend background wake-word so mic is 100% dedicated to prompt
  stopWakeWordMonitor();

  // 2. Clear any lingering timers
  if (autoSubmitTimeout) {
    clearTimeout(autoSubmitTimeout);
    autoSubmitTimeout = null;
  }
  clearTimeout(activePromptRestartTimer);

  activePromptCallbacks = callbacks;
  activePromptAccumulated = '';
  activePromptInterim = '';
  activePromptDelivered = false;
  isListeningSessionOpen = true;

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
  if (activePromptRecognition) {
    try {
      activePromptRecognition.onstart = null;
      activePromptRecognition.onresult = null;
      activePromptRecognition.onerror = null;
      activePromptRecognition.onend = null;
      activePromptRecognition.stop();
    } catch {}
    activePromptRecognition = null;
  }
}

let wakeWordCallback: ((trailingPrompt?: string) => void) | null = null;
let wakeWordErrorCallback: ((err: any) => void) | null = null;
let wakeWordRestartTimer: any = null;

function spawnWakeWordRecognition(): any {
  if (!isWakeWordActive || activePromptRecognition || isListeningSessionOpen) return null;
  const SpeechRecognitionClass = getSpeechRecognitionClass();
  if (!SpeechRecognitionClass) return null;

  try {
    if (wakeWordRecognition) {
      try {
        wakeWordRecognition.onend = null;
        wakeWordRecognition.onerror = null;
        wakeWordRecognition.stop();
      } catch {}
      wakeWordRecognition = null;
    }

    const recognition = new SpeechRecognitionClass();
    recognition.lang = 'en-US';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const rawText = (event.results[i][0]?.transcript || '').trim();

        // Check for intentional wake word
        const isStrictMatch = STRICT_WAKE_WORD_REGEX.test(rawText);
        const isInlineMatch = INLINE_WAKE_WORD_REGEX.test(rawText);

        if (isStrictMatch || isInlineMatch) {
          const match = rawText.match(/(?:hey\s+|hi\s+|ok\s+|okay\s+)?jarvis\b/i);
          let trailing = '';
          if (match && typeof match.index === 'number') {
            trailing = rawText.slice(match.index + match[0].length).trim();
          }

          stopWakeWordMonitor();

          // Only pass trailing prompt if it's an actionable question, otherwise just wake up into listening mode
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
      if (e.error !== 'no-speech' && e.error !== 'aborted' && wakeWordErrorCallback) {
        wakeWordErrorCallback(e);
      }
    };

    recognition.onend = () => {
      wakeWordRecognition = null;
      // Spawn a fresh SpeechRecognition instance so browser never encounters InvalidStateError
      if (isWakeWordActive && !activePromptRecognition && !isListeningSessionOpen) {
        clearTimeout(wakeWordRestartTimer);
        wakeWordRestartTimer = setTimeout(() => {
          if (isWakeWordActive && !activePromptRecognition && !isListeningSessionOpen) {
            spawnWakeWordRecognition();
          }
        }, 200);
      }
    };

    recognition.start();
    wakeWordRecognition = recognition;
    return recognition;
  } catch (err) {
    console.debug('Wake word init notice:', err);
    if (isWakeWordActive && !activePromptRecognition && !isListeningSessionOpen) {
      clearTimeout(wakeWordRestartTimer);
      wakeWordRestartTimer = setTimeout(() => {
        if (isWakeWordActive) spawnWakeWordRecognition();
      }, 1000);
    }
    return null;
  }
}

/**
 * Continuous Background Wake-Word ("Hey Jarvis") Monitor.
 * Automatically stops when user is speaking a prompt.
 */
export function startWakeWordMonitor(
  onWakeWord: (trailingPrompt?: string) => void,
  onError?: (err: any) => void
): any {
  wakeWordCallback = onWakeWord;
  wakeWordErrorCallback = onError || null;
  clearTimeout(wakeWordRestartTimer);
  stopWakeWordMonitor();
  isWakeWordActive = true;
  return spawnWakeWordRecognition();
}

export function pauseWakeWordMonitor(): void {
  isWakeWordActive = false;
  clearTimeout(wakeWordRestartTimer);
  if (wakeWordRecognition) {
    try {
      wakeWordRecognition.onend = null;
      wakeWordRecognition.onerror = null;
      wakeWordRecognition.stop();
    } catch {}
    wakeWordRecognition = null;
  }
}

export function resumeWakeWordMonitor(
  onWakeWord: (trailingPrompt?: string) => void
): void {
  startWakeWordMonitor(onWakeWord);
}

export function stopWakeWordMonitor(): void {
  isWakeWordActive = false;
  clearTimeout(wakeWordRestartTimer);
  if (wakeWordRecognition) {
    try {
      wakeWordRecognition.onend = null;
      wakeWordRecognition.onerror = null;
      wakeWordRecognition.stop();
    } catch {}
    wakeWordRecognition = null;
  }
}

export function stopAllListening(): void {
  stopActivePromptListening();
  stopWakeWordMonitor();
}
