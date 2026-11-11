/**
 * GapAnchor Ops Dashboard - J.A.R.V.I.S. Neural Humanized Audio Engine
 * Powered by High-Fidelity 96kbps Neural Speech & Conversational Prosody.
 * Produces ultra-natural human voice (ChatGPT / Claude Advanced Voice style & Aristocratic Jarvis British).
 */

export interface JarvisVoiceProfile {
  id: string;
  name: string;
  label: string;
  tagline: string;
  accent: string;
  gender: 'Male' | 'Female';
  recommended?: boolean;
}

export const JARVIS_VOICE_PROFILES: JarvisVoiceProfile[] = [
  {
    id: 'en-GB-RyanNeural',
    name: 'Ryan (Jarvis British)',
    label: 'Ryan • Classic Jarvis British',
    tagline: 'Aristocratic British cadence (Paul Bettany persona)',
    accent: 'UK Aristocratic',
    gender: 'Male',
    recommended: true,
  },
  {
    id: 'en-US-BrianMultilingualNeural',
    name: 'Brian (ChatGPT Human)',
    label: 'Brian • ChatGPT Conversational',
    tagline: 'Ultra-expressive, natural human pacing & vocal fry',
    accent: 'US Conversational',
    gender: 'Male',
  },
  {
    id: 'en-US-GuyNeural',
    name: 'Guy (US Executive)',
    label: 'Guy • Natural Conversational',
    tagline: 'Warm, clear, executive briefing tone',
    accent: 'US Executive',
    gender: 'Male',
  },
  {
    id: 'en-GB-ThomasNeural',
    name: 'Thomas (Studio Oxford)',
    label: 'Thomas • BBC / Oxford English',
    tagline: 'Crisp, articulate British diction',
    accent: 'UK Formal',
    gender: 'Male',
  },
];

const DEFAULT_VOICE_ID = 'en-GB-RyanNeural';
const STORAGE_KEY = 'jarvis_active_voice_id';

export interface JarvisSpeechOptions {
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: any) => void;
  includeIntro?: boolean;
  voiceId?: string;
  rate?: string;
  pitch?: string;
}

export interface JarvisSpeechProgress {
  isPlaying: boolean;
  sessionId: number;
  chunkText: string;
  chunkIndex: number;
  totalChunks: number;
  progress: number;
  spokenWordIndex: number;
}

// In-memory Blob URL cache for instant zero-latency playback of common phrases
const audioCache = new Map<string, string>();
// In-flight fetches to deduplicate concurrent requests
const inFlightClientFetches = new Map<string, Promise<string>>();
let currentAudio: HTMLAudioElement | null = null;
let isAudioPlaying = false;
let activePlaybackSessionId = 0;
const voiceChangeListeners = new Set<(voice: JarvisVoiceProfile) => void>();

const liveSpeechState = {
  chunkText: '',
  chunkIndex: 0,
  totalChunks: 0,
  chunkStartMs: 0,
  estimatedDurationMs: 1200,
  fallbackCharIndex: -1,
};

let audioCtx: AudioContext | null = null;
let analyserNode: AnalyserNode | null = null;
let audioSourceNode: MediaElementAudioSourceNode | null = null;
let lastSourceAudio: HTMLAudioElement | null = null;

/**
 * Returns real-time word/chunk playback progress for 60fps canvas word-dust synchronization
 */
export function getLiveSpeechProgress(): JarvisSpeechProgress {
  if (!isAudioPlaying || !liveSpeechState.chunkText) {
    return {
      isPlaying: false,
      sessionId: activePlaybackSessionId,
      chunkText: '',
      chunkIndex: 0,
      totalChunks: 0,
      progress: 0,
      spokenWordIndex: -1,
    };
  }

  const words = liveSpeechState.chunkText.trim().split(/\s+/).filter(Boolean);
  let progress = 0;

  if (currentAudio && Number.isFinite(currentAudio.duration) && currentAudio.duration > 0.1) {
    progress = Math.min(1, Math.max(0, currentAudio.currentTime / currentAudio.duration));
  } else if (liveSpeechState.fallbackCharIndex >= 0 && liveSpeechState.chunkText.length > 0) {
    progress = Math.min(1, Math.max(0, liveSpeechState.fallbackCharIndex / liveSpeechState.chunkText.length));
  } else {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    progress = Math.min(
      0.98,
      Math.max(0, (now - liveSpeechState.chunkStartMs) / Math.max(400, liveSpeechState.estimatedDurationMs))
    );
  }

  const spokenWordIndex =
    words.length > 0 ? Math.min(words.length - 1, Math.floor(progress * words.length)) : -1;

  return {
    isPlaying: true,
    sessionId: activePlaybackSessionId,
    chunkText: liveSpeechState.chunkText,
    chunkIndex: liveSpeechState.chunkIndex,
    totalChunks: liveSpeechState.totalChunks,
    progress,
    spokenWordIndex,
  };
}

/**
 * Returns real-time speech frequency energy (0.0 to 1.0) for particle sphere undulation
 */
export function getLiveAudioFrequency(): number {
  if (!isAudioPlaying) return 0;

  if (analyserNode) {
    try {
      const data = new Uint8Array(analyserNode.frequencyBinCount);
      analyserNode.getByteFrequencyData(data);
      let sum = 0;
      const count = Math.min(32, data.length);
      for (let i = 2; i < count; i++) {
        sum += data[i];
      }
      const avg = sum / Math.max(1, count - 2);
      const level = Math.min(1.0, avg / 110.0);
      if (level > 0.05) return level;
    } catch {}
  }

  // Organic vocal frequency synthesizer:
  // Produces dynamic water-droplet / bubble undulating frequencies (speech rhythm)
  const now = (typeof performance !== 'undefined' ? performance.now() : Date.now()) * 0.001;
  const f1 = Math.sin(now * 9.5);
  const f2 = Math.cos(now * 16.2);
  const f3 = Math.sin(now * 24.0);
  const breath = Math.sin(now * 3.8) * 0.4 + 0.6;
  const energy = Math.max(0.15, (f1 * 0.4 + f2 * 0.35 + f3 * 0.25 + 0.5) * breath);
  return Math.min(1.0, energy);
}

function attachAudioAnalyser(audio: HTMLAudioElement) {
  if (typeof window === 'undefined') return;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    if (!audioCtx) {
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    if (!analyserNode) {
      analyserNode = audioCtx.createAnalyser();
      analyserNode.fftSize = 128;
      analyserNode.smoothingTimeConstant = 0.65;
    }
    if (audio !== lastSourceAudio) {
      lastSourceAudio = audio;
      try {
        audioSourceNode = audioCtx.createMediaElementSource(audio);
        audioSourceNode.connect(analyserNode);
        analyserNode.connect(audioCtx.destination);
      } catch {}
    }
  } catch {}
}

/**
 * Returns all available curated human voice profiles
 */
export function getJarvisVoiceProfiles(): JarvisVoiceProfile[] {
  return JARVIS_VOICE_PROFILES;
}

/**
 * Gets currently active voice profile (persisted in localStorage)
 */
export function getActiveVoice(): JarvisVoiceProfile {
  if (typeof window !== 'undefined') {
    try {
      const savedId = localStorage.getItem(STORAGE_KEY);
      if (savedId) {
        const found = JARVIS_VOICE_PROFILES.find((v) => v.id === savedId);
        if (found) return found;
      }
    } catch {}
  }
  return JARVIS_VOICE_PROFILES[0];
}

/**
 * Sets active voice profile and notifies all subscribed UI components
 */
export function setActiveVoice(voiceId: string): JarvisVoiceProfile {
  const profile = JARVIS_VOICE_PROFILES.find((v) => v.id === voiceId) || JARVIS_VOICE_PROFILES[0];
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, profile.id);
    } catch {}
    // Clear audio blob cache so newly spoken phrases use the newly selected voice
    audioCache.clear();
  }
  voiceChangeListeners.forEach((listener) => {
    try {
      listener(profile);
    } catch (e) {
      console.warn('Voice change listener error:', e);
    }
  });
  return profile;
}

/**
 * Subscribes a UI component to active voice changes
 */
export function subscribeJarvisVoiceChange(cb: (voice: JarvisVoiceProfile) => void): () => void {
  voiceChangeListeners.add(cb);
  return () => {
    voiceChangeListeners.delete(cb);
  };
}

/**
 * Backwards compatible helper
 */
export function getJarvisVoiceName(): string {
  return getActiveVoice().name;
}

/**
 * Backwards compatible helper
 */
export function getJarvisVoice(): { name: string; id: string } {
  const active = getActiveVoice();
  return { name: active.name, id: active.id };
}

/**
 * Fetches and caches audio blob for a specific text fragment.
 * Uses in-flight deduplication to avoid redundant HTTP requests.
 */
async function fetchAudioBlobUrl(
  text: string,
  voiceId: string,
  rate = '+0%',
  pitch = '+0%'
): Promise<string> {
  const cacheKey = `${voiceId}__${text}`;
  const existing = audioCache.get(cacheKey);
  if (existing) return existing;

  const inFlight = inFlightClientFetches.get(cacheKey);
  if (inFlight) return inFlight;

  const promise = (async () => {
    let lastError: any = null;

    // Retry once on the exact same voiceId with generous 14s timeout so slow chunks never swap voices
    for (let attempt = 0; attempt < 2; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(
        () => controller.abort(new DOMException('Speech synthesis timed out', 'TimeoutError')),
        14000
      );

      try {
        const res = await fetch('/api/ai/speak', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text,
            voice: voiceId,
            rate,
            pitch,
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new Error(`Neural speech service returned status: ${res.status}`);
        }

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        audioCache.set(cacheKey, url);
        return url;
      } catch (err) {
        lastError = err;
        if (attempt === 0) {
          await new Promise((r) => setTimeout(r, 250));
        }
      } finally {
        clearTimeout(timer);
      }
    }

    throw lastError || new Error('Neural speech fetch failed');
  })().finally(() => {
    inFlightClientFetches.delete(cacheKey);
  });

  inFlightClientFetches.set(cacheKey, promise);
  return promise;
}

/**
 * Proactively pre-warms audio for an AI answer in the background as soon
 * as text arrives on screen. Sequential chunk warming avoids flooding Edge-TTS sockets.
 */
export async function prepareJarvisSpeech(text: string, voiceId?: string): Promise<void> {
  if (typeof window === 'undefined' || !text) return;
  const cleanBody = sanitizeForSpeech(text);
  if (!cleanBody) return;

  const activeVoice = voiceId || getActiveVoice().id;
  const chunks = chunkTextForPipelinedSpeech(cleanBody);
  if (chunks.length === 0) return;

  try {
    // Await ONLY chunk 0 so speaking starts right away, then warm remaining chunks sequentially
    // in the background without flooding Edge-TTS WebSockets
    await fetchAudioBlobUrl(chunks[0], activeVoice);
    if (chunks.length > 1) {
      void (async () => {
        for (let i = 1; i < chunks.length; i++) {
          try {
            await fetchAudioBlobUrl(chunks[i], activeVoice);
          } catch {
            // Best-effort sequential prewarm; speakJarvis handles chunk playback retries
          }
        }
      })();
    }
  } catch (err) {
    console.debug('Background speech prewarm notice:', err);
  }
}

/**
 * Splits text into natural spoken chunks for streaming pipeline:
 * Chunk 0: Short introductory sentence (40-95 chars) -> produces first audio in ~250-350ms!
 * Subsequent chunks: 120-220 chars -> processed seamlessly while preceding chunk plays.
 */
export function chunkTextForPipelinedSpeech(
  text: string,
  maxInitialLen = 95,
  maxChunkLen = 220
): string[] {
  if (!text || !text.trim()) return [];

  // Protect acronyms with dots like W.M.S., U.S., A.I.
  let safe = text.replace(/([A-Za-z]\.){2,}[A-Za-z]?/g, (m) => m.replace(/\./g, '___DOT___'));
  // Protect decimal numbers like 3.5, 4.0
  safe = safe.replace(/(\d+)\.(\d+)/g, (_m, p1, p2) => `${p1}___DOT___${p2}`);

  // Split on sentence boundaries (. ! ?)
  const rawSentences = safe
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.replace(/___DOT___/g, '.').trim())
    .filter((s) => s.length > 0);

  if (rawSentences.length <= 1) {
    return [text.trim()];
  }

  const chunks: string[] = [];
  let current = '';

  for (let i = 0; i < rawSentences.length; i++) {
    const s = rawSentences[i];
    const limit = chunks.length === 0 ? maxInitialLen : maxChunkLen;

    if (!current) {
      current = s;
    } else if (current.length + s.length + 1 <= limit) {
      current += ' ' + s;
    } else {
      chunks.push(current);
      current = s;
    }
  }

  if (current) {
    chunks.push(current);
  }

  return chunks;
}

/**
 * Pre-warms and caches common fixed phrases (Greetings, Thinking, and Intro phrases)
 * into memory so they play with 0ms delay.
 */
export async function prewarmJarvisVoiceCache(): Promise<void> {
  if (typeof window === 'undefined') return;

  const activeVoice = getActiveVoice();
  const phrases = [
    'Right away, sir.',
    'Right away, sir. Checking the pipeline now.',
    'Certainly, sir.',
    'Understood, sir.',
    getJarvisGreeting(),
    'Good morning, sir. What can I do for you?',
    'Good afternoon, sir. What can I do for you?',
    'Good evening, sir. What can I do for you?',
    getJarvisThinkingPhrase(),
    'One minute, sir. Checking the details now.',
    'One moment, sir. Checking the pipeline now.',
    'Checking details now, sir.',
    getJarvisFollowUpPhrase(),
    'Anything else I can assist you with, sir?',
    getJarvisSignOffPhrase(),
    'Very good, sir. Standing by whenever you need me.',
  ];

  for (const phrase of phrases) {
    const cacheKey = `${activeVoice.id}__${phrase}`;
    if (!audioCache.has(cacheKey)) {
      try {
        await fetchAudioBlobUrl(phrase, activeVoice.id);
      } catch (err) {
        console.debug('Voice prewarm notice for phrase:', phrase, err);
      }
    }
  }
}

// Automatically prewarm once on client-side idle
if (typeof window !== 'undefined') {
  if ('requestIdleCallback' in window) {
    (window as any).requestIdleCallback(() => prewarmJarvisVoiceCache());
  } else {
    setTimeout(() => prewarmJarvisVoiceCache(), 800);
  }
}

/**
 * Clean text for natural speech (remove markdown symbols, URLs, asterisks, citations)
 */
function sanitizeForSpeech(text: string): string {
  return text
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/`/g, '')
    .replace(/#{1,6}\s/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // [link](url) -> link
    .replace(/https?:\/\/\S+/g, '') // remove urls
    .replace(/\{[^{}]*\}/g, '') // remove accidental JSON remnants
    .replace(/[•●▪■◆★\-\—_]/g, ', ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Plays a single audio url and resolves when completed.
 */
function playAudioChunk(
  audioUrl: string,
  sessionId: number,
  chunkText: string,
  chunkIndex: number,
  totalChunks: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (sessionId !== activePlaybackSessionId) {
      resolve();
      return;
    }

    const wordCount = Math.max(1, chunkText.trim().split(/\s+/).length);
    liveSpeechState.chunkText = chunkText;
    liveSpeechState.chunkIndex = chunkIndex;
    liveSpeechState.totalChunks = totalChunks;
    liveSpeechState.chunkStartMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
    liveSpeechState.estimatedDurationMs = Math.max(750, (wordCount / 2.65) * 1000);
    liveSpeechState.fallbackCharIndex = -1;

    const audio = new Audio(audioUrl);
    currentAudio = audio;
    attachAudioAnalyser(audio);

    audio.onplaying = () => {
      liveSpeechState.chunkStartMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
    };

    audio.onended = () => {
      if (currentAudio === audio) currentAudio = null;
      resolve();
    };

    audio.onerror = (e) => {
      if (currentAudio === audio) currentAudio = null;
      reject(e);
    };

    audio.play().catch((err) => {
      if (currentAudio === audio) currentAudio = null;
      reject(err);
    });
  });
}

/**
 * Speaks text using High-Fidelity 96kbps Neural Voice with ultra-low latency pipelining.
 * - If includeIntro is true, instantly plays the pre-warmed 'Right away, sir.' (0ms latency!)
 *   while fetching and buffering the rest of the text in parallel.
 * - Automatically splits multi-sentence answers into short chunks so playback begins
 *   within ~250-350ms instead of waiting seconds for full synthesis.
 */
export function speakJarvis(
  text: string,
  options: JarvisSpeechOptions = {}
): Promise<void> {
  return new Promise<void>(async (resolve) => {
    if (typeof window === 'undefined') {
      resolve();
      return;
    }

    // Stop any currently playing audio & bump session ID
    stopJarvis();
    const sessionId = ++activePlaybackSessionId;

    const cleanBody = sanitizeForSpeech(text);
    if (!cleanBody) {
      if (options.onEnd) options.onEnd();
      resolve();
      return;
    }

    const activeVoice = options.voiceId || getActiveVoice().id;
    const rate = options.rate || '+0%';
    const pitch = options.pitch || '+0%';
    const includeIntro = options.includeIntro !== false;

    isAudioPlaying = true;
    let hasFiredStart = false;

    try {
      // Chunk the body into natural sentences
      const bodyChunks = chunkTextForPipelinedSpeech(cleanBody);
      const playlist: string[] = [];

      if (includeIntro) {
        playlist.push('Right away, sir.');
      }
      playlist.push(...bodyChunks);

      // Seed initial text immediately so animations align from frame 0
      if (playlist.length > 0) {
        liveSpeechState.chunkText = playlist[0];
        liveSpeechState.chunkIndex = 0;
        liveSpeechState.totalChunks = playlist.length;
        liveSpeechState.chunkStartMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
      }

      // Pipeline lookahead cleanly (max 1 chunk ahead) so we don't flood Edge-TTS or cause mid-reply timeouts
      const chunkPromises: (Promise<string> | null)[] = new Array(playlist.length).fill(null);
      const getChunkAudio = (idx: number): Promise<string> => {
        if (!chunkPromises[idx]) {
          const p = fetchAudioBlobUrl(playlist[idx], activeVoice, rate, pitch);
          p.catch(() => {});
          chunkPromises[idx] = p;
        }
        return chunkPromises[idx]!;
      };

      // Sequentially play each chunk cleanly using ONLY activeVoice
      for (let i = 0; i < playlist.length; i++) {
        if (sessionId !== activePlaybackSessionId) break;

        let audioUrl: string;
        try {
          audioUrl = await getChunkAudio(i);
        } catch (chunkErr) {
          // If neural voice already started speaking, NEVER fall back to a second browser voice mid-reply
          if (hasFiredStart) {
            console.warn(`Skipping chunk ${i} on active neural voice (${activeVoice}) to avoid voice switch:`, chunkErr);
            continue;
          }
          throw chunkErr;
        }

        if (sessionId !== activePlaybackSessionId) break;

        // Prefetch ONLY the immediate next chunk while the current one starts playing
        if (i + 1 < playlist.length) {
          getChunkAudio(i + 1);
        }

        // Fire onStart at the EXACT millisecond the first sound chunk actually starts playing!
        if (!hasFiredStart && options.onStart) {
          hasFiredStart = true;
          options.onStart();
        }

        await playAudioChunk(audioUrl, sessionId, playlist[i], i, playlist.length);
      }

      if (sessionId === activePlaybackSessionId) {
        isAudioPlaying = false;
        currentAudio = null;
        liveSpeechState.chunkText = '';
        if (options.onEnd) options.onEnd();
      }
      resolve();
    } catch (err: any) {
      if (hasFiredStart) {
        // Already spoke in the active neural voice; conclude cleanly without switching voices
        console.warn('Neural speech ended cleanly after mid-stream interruption/error:', err);
        if (sessionId === activePlaybackSessionId) {
          isAudioPlaying = false;
          currentAudio = null;
          liveSpeechState.chunkText = '';
          if (options.onEnd) options.onEnd();
        }
        resolve();
        return;
      }

      console.warn('Neural speech unavailable before start, attempting single local fallback:', err);
      if (sessionId === activePlaybackSessionId) {
        speakJarvisLocalFallback(cleanBody, {
          ...options,
          onStart: () => {
            if (sessionId !== activePlaybackSessionId) return;
            isAudioPlaying = true;
            if (options.onStart) options.onStart();
          },
          onEnd: () => {
            if (sessionId === activePlaybackSessionId) {
              isAudioPlaying = false;
              currentAudio = null;
              liveSpeechState.chunkText = '';
              if (options.onEnd) options.onEnd();
            }
            resolve();
          },
          onError: (fallbackErr) => {
            if (sessionId === activePlaybackSessionId) {
              isAudioPlaying = false;
              currentAudio = null;
              liveSpeechState.chunkText = '';
              if (options.onError) options.onError(fallbackErr);
            }
            resolve();
          },
        });
      } else {
        resolve();
      }
    }
  });
}

/**
 * Fallback to browser SpeechSynthesis in the rare event of offline network
 */
function speakJarvisLocalFallback(text: string, options: JarvisSpeechOptions): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    if (options.onError) options.onError('Audio playback unsupported');
    return;
  }

  const utterance = new SpeechSynthesisUtterance(text);
  const voices = window.speechSynthesis.getVoices();

  // Prefer modern natural / online voices if available in Chrome/Edge
  const naturalVoice =
    voices.find((v) => (v.name.includes('Natural') || v.name.includes('Online')) && v.lang.startsWith('en')) ||
    voices.find((v) => v.lang.toLowerCase().startsWith('en-gb')) ||
    voices.find((v) => v.lang.toLowerCase().startsWith('en-us')) ||
    voices[0];

  if (naturalVoice) utterance.voice = naturalVoice;
  utterance.rate = 1.0;
  utterance.pitch = 1.0;

  const wordsCount = Math.max(1, text.trim().split(/\s+/).length);
  liveSpeechState.chunkText = text;
  liveSpeechState.chunkIndex = 0;
  liveSpeechState.totalChunks = 1;
  liveSpeechState.chunkStartMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
  liveSpeechState.estimatedDurationMs = Math.max(850, (wordsCount / 2.65) * 1000);
  liveSpeechState.fallbackCharIndex = 0;

  utterance.onboundary = (event) => {
    if (event.name === 'word') {
      liveSpeechState.fallbackCharIndex = event.charIndex;
    }
  };

  utterance.onstart = () => {
    isAudioPlaying = true;
    liveSpeechState.chunkStartMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (options.onStart) options.onStart();
  };
  utterance.onend = () => {
    isAudioPlaying = false;
    liveSpeechState.chunkText = '';
    if (options.onEnd) options.onEnd();
  };
  utterance.onerror = (e) => {
    isAudioPlaying = false;
    liveSpeechState.chunkText = '';
    if (options.onError) options.onError(e);
  };

  try {
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }
  } catch {}

  window.speechSynthesis.speak(utterance);
}

export function stopJarvis(): void {
  activePlaybackSessionId++;
  isAudioPlaying = false;
  liveSpeechState.chunkText = '';
  liveSpeechState.fallbackCharIndex = -1;
  if (currentAudio) {
    try {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    } catch {}
    currentAudio = null;
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

export function isJarvisSpeaking(): boolean {
  if (currentAudio) {
    return !currentAudio.paused && !currentAudio.ended;
  }
  return isAudioPlaying;
}

/**
 * Returns authentic time-of-day greeting for J.A.R.V.I.S.
 * "Good morning, sir. What can I do for you?"
 */
export function getJarvisGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning, sir. What can I do for you?';
  if (hour < 17) return 'Good afternoon, sir. What can I do for you?';
  return 'Good evening, sir. What can I do for you?';
}

/**
 * Returns conversational acknowledgment when the user's prompt is captured.
 * "One minute, sir. Checking the details now."
 */
export function getJarvisThinkingPhrase(): string {
  return 'One minute, sir. Checking the details now.';
}

/**
 * The J.A.R.V.I.S. Humanizer Algorithm:
 * Formats Gemini AI answer into humanized, conversational speech with British styling,
 * natural slang/idioms, smooth acronym pronunciations, and elegant pauses.
 */
export function formatHumanizedJarvisBriefing(answer: string, actionAdvice?: string | null): string {
  let clean = sanitizeForSpeech(answer);

  // 1. Diction & Politeness Conversions
  clean = clean
    .replace(/\bhello\b/gi, 'Good day, sir.')
    .replace(/\bgood morning\b/gi, 'Good morning, sir.')
    .replace(/\bI have found\b/gi, 'I have isolated')
    .replace(/\bHere are\b/gi, 'Allow me to present')
    .replace(/\bleads\b/gi, 'candidates')
    .replace(/\blead\b/gi, 'candidate');

  // 2. Smooth Enterprise Acronyms into Natural, Fluid Spoken English (No choppy dot pauses)
  clean = clean
    .replace(/\bGapAnchor\b/gi, 'Gap Anchor')
    .replace(/\bGapOps\b/gi, 'Gap Ops')
    .replace(/\bManhattan Active WMS\b/gi, 'Manhattan Active WMS')
    .replace(/\bActive WMS\b/gi, 'Active WMS')
    .replace(/\bManhattan ProActive\b/gi, 'Manhattan Pro-Active')
    .replace(/\bBlue Yonder\b/gi, 'Blue Yonder')
    .replace(/\bSAP S\/4HANA\b/gi, 'SAP S-4 HANA')
    .replace(/\bUSA\b/g, 'the United States')
    .replace(/\bUS\b/g, 'the U S')
    .replace(/\bUK\b/g, 'the UK')
    .replace(/\b(\d+)\/10\b/g, '$1 out of 10')
    .replace(/\b1st\b/gi, 'first')
    .replace(/\b2nd\b/gi, 'second')
    .replace(/\b3rd\b/gi, 'third');

  let speech = clean;

  // 3. Elegant Tactical Directive Wrap-up
  if (actionAdvice) {
    const cleanAdvice = sanitizeForSpeech(actionAdvice);
    speech += `. As for our immediate tactical directive: ${cleanAdvice}. I have also isolated their files on your dashboard, sir.`;
  } else {
    speech += `. I have highlighted the relevant candidates on your screen, sir.`;
  }

  return speech;
}

/**
 * Follow-up conversational question asked by J.A.R.V.I.S. after delivering briefing:
 * "Anything else I can assist you with, sir?"
 */
export function getJarvisFollowUpPhrase(): string {
  return 'Anything else I can assist you with, sir?';
}

/**
 * Polite sign-off when user concludes ("Nothing Jarvis, thank you"):
 * "Very good, sir. Standing by whenever you need me."
 */
export function getJarvisSignOffPhrase(): string {
  return 'Very good, sir. Standing by whenever you need me.';
}

/**
 * Checks whether user voice input signals that they are finished or saying thank you.
 * E.g. "Nothing Jarvis, thank you", "No that's all", "Thank you for your help", etc.
 */
export function isDismissalOrThankYou(text: string): boolean {
  if (!text || !text.trim()) return false;
  const t = text.toLowerCase().trim().replace(/[.,!?;:'"]/g, '');

  const dismissalPatterns = [
    /\b(?:nothing|no\s*more|nothing\s*else)\b/,
    /\b(?:that(?:s|\s*is|\s*will\s*be|\s*ll\s*be)?\s*(?:all|it))\b/,
    /\b(?:no\s*(?:thanks|thank\s*you))\b/,
    /\b(?:thank\s*you\s*(?:for\s*(?:your\s*)?help|so\s*much|jarvis)?)\b/,
    /\b(?:thanks\s*(?:for\s*(?:your\s*)?help|jarvis|a\s*lot)?)\b/,
    /\b(?:all\s*(?:good|set|clear|done))\b/,
    /\b(?:goodbye|bye\s*jarvis|im\s*good|i\s*am\s*good)\b/,
    /\b(?:stop|exit|quit|close|dismiss)\b/,
  ];

  return dismissalPatterns.some((pattern) => pattern.test(t));
}
