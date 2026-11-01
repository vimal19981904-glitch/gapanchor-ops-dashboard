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
    id: 'en-US-BrianMultilingualNeural',
    name: 'Brian (ChatGPT Human)',
    label: 'Brian • ChatGPT Conversational',
    tagline: 'Ultra-expressive, natural human pacing & vocal fry',
    accent: 'US Conversational',
    gender: 'Male',
    recommended: true,
  },
  {
    id: 'en-GB-RyanNeural',
    name: 'Ryan (Jarvis British)',
    label: 'Ryan • Classic Jarvis British',
    tagline: 'Aristocratic British cadence (Paul Bettany persona)',
    accent: 'UK Aristocratic',
    gender: 'Male',
  },
  {
    id: 'en-US-AndrewMultilingualNeural',
    name: 'Andrew (Modern AI)',
    label: 'Andrew • Modern Conversational',
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

const DEFAULT_VOICE_ID = 'en-US-BrianMultilingualNeural';
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

// In-memory Blob URL cache for instant zero-latency playback of common phrases
const audioCache = new Map<string, string>();
// In-flight fetches to deduplicate concurrent requests
const inFlightClientFetches = new Map<string, Promise<string>>();
let currentAudio: HTMLAudioElement | null = null;
let isAudioPlaying = false;
let activePlaybackSessionId = 0;
const voiceChangeListeners = new Set<(voice: JarvisVoiceProfile) => void>();

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
    const res = await fetch('/api/ai/speak', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        voice: voiceId,
        rate,
        pitch,
      }),
    });

    if (!res.ok) {
      throw new Error(`Neural speech service returned status: ${res.status}`);
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    audioCache.set(cacheKey, url);
    return url;
  })().finally(() => {
    inFlightClientFetches.delete(cacheKey);
  });

  inFlightClientFetches.set(cacheKey, promise);
  return promise;
}

/**
 * Proactively pre-warms audio for an AI answer in the background as soon
 * as text arrives on screen. When user clicks "Read" or auto-voice triggers,
 * latency is near 0ms because audio is already synthesized and cached in memory.
 */
export async function prepareJarvisSpeech(text: string, voiceId?: string): Promise<void> {
  if (typeof window === 'undefined' || !text) return;
  const cleanBody = sanitizeForSpeech(text);
  if (!cleanBody) return;

  const activeVoice = voiceId || getActiveVoice().id;
  const chunks = chunkTextForPipelinedSpeech(cleanBody);
  if (chunks.length === 0) return;

  try {
    // Pre-fetch the first chunk immediately for instantaneous playback
    await fetchAudioBlobUrl(chunks[0], activeVoice);
    // Pre-fetch remaining chunks concurrently in background
    if (chunks.length > 1) {
      chunks.slice(1).forEach((chunk) => {
        fetchAudioBlobUrl(chunk, activeVoice).catch(() => {});
      });
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
function playAudioChunk(audioUrl: string, sessionId: number): Promise<void> {
  return new Promise((resolve, reject) => {
    if (sessionId !== activePlaybackSessionId) {
      resolve();
      return;
    }

    const audio = new Audio(audioUrl);
    currentAudio = audio;

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
      resolve();
      return;
    }

    const activeVoice = options.voiceId || getActiveVoice().id;
    const rate = options.rate || '+0%';
    const pitch = options.pitch || '+0%';
    const includeIntro = options.includeIntro !== false;

    isAudioPlaying = true;
    if (options.onStart) options.onStart();

    try {
      // Chunk the body into natural sentences
      const bodyChunks = chunkTextForPipelinedSpeech(cleanBody);
      const playlist: string[] = [];

      if (includeIntro) {
        playlist.push('Right away, sir.');
      }
      playlist.push(...bodyChunks);

      // Pre-dispatch all chunks so subsequent sentences are synthesized concurrently
      const chunkPromises = playlist.map((chunk) =>
        fetchAudioBlobUrl(chunk, activeVoice, rate, pitch)
      );

      // Sequentially play each chunk seamlessly as it becomes ready
      for (let i = 0; i < playlist.length; i++) {
        if (sessionId !== activePlaybackSessionId) break;

        const audioUrl = await chunkPromises[i];
        if (sessionId !== activePlaybackSessionId) break;

        await playAudioChunk(audioUrl, sessionId);
      }

      if (sessionId === activePlaybackSessionId) {
        isAudioPlaying = false;
        currentAudio = null;
        if (options.onEnd) options.onEnd();
      }
      resolve();
    } catch (err: any) {
      console.warn('Neural speech streaming error, attempting local fallback:', err);
      if (sessionId === activePlaybackSessionId) {
        speakJarvisLocalFallback(cleanBody, {
          ...options,
          onEnd: () => {
            isAudioPlaying = false;
            currentAudio = null;
            if (options.onEnd) options.onEnd();
            resolve();
          },
          onError: (fallbackErr) => {
            isAudioPlaying = false;
            currentAudio = null;
            if (options.onError) options.onError(fallbackErr);
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

  utterance.onstart = () => {
    isAudioPlaying = true;
    if (options.onStart) options.onStart();
  };
  utterance.onend = () => {
    isAudioPlaying = false;
    if (options.onEnd) options.onEnd();
  };
  utterance.onerror = (e) => {
    isAudioPlaying = false;
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

  // 2. Smooth Enterprise Acronyms into Natural Spoken English
  clean = clean
    .replace(/\bGapAnchor\b/gi, 'Gap Anchor')
    .replace(/\bGapOps\b/gi, 'Gap Ops')
    .replace(/\bManhattan Active WMS\b/gi, 'Manhattan Active W.M.S.')
    .replace(/\bActive WMS\b/gi, 'Active W.M.S.')
    .replace(/\bManhattan ProActive\b/gi, 'Manhattan Pro-Active')
    .replace(/\bWMS\b/g, 'W.M.S.')
    .replace(/\bCRM\b/g, 'C.R.M.')
    .replace(/\bERP\b/g, 'E.R.P.')
    .replace(/\bJDA\b/g, 'J.D.A.')
    .replace(/\bBlue Yonder\b/gi, 'Blue Yonder')
    .replace(/\bSAP S\/4HANA\b/gi, 'S.A.P. S-4 HANA')
    .replace(/\bSAP\b/g, 'S.A.P.')
    .replace(/\bUSA\b/g, 'North America')
    .replace(/\bUS\b/g, 'U.S.')
    .replace(/\bIST\b/g, 'I.S.T.')
    .replace(/\bEST\b/g, 'E.S.T.')
    .replace(/\bPST\b/g, 'P.S.T.')
    .replace(/\bAI\b/g, 'A.I.')
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
