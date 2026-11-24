/**
 * GapAnchor Ops Dashboard - Gemini AI Client
 * Provides unified integration for Google Gemini 1.5 Flash / 2.0 Flash REST API
 * (100% Free Tier via Google AI Studio).
 */

export interface GeminiStatus {
  configured: boolean;
  model: string;
}

export const HARDCODED_GEMINI_KEY = 'AIzaSyAldjFJ1NwNGe_sgl8n2dfKumv4lX6Nx0A';

let circuitBreakerUntil = 0;

export function isGeminiCircuitOpen(): boolean {
  return Date.now() < circuitBreakerUntil;
}

export function getGeminiConfig(): { apiKey: string | null; model: string } {
  const apiKey =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_AI_KEY ||
    process.env.GOOGLE_API_KEY ||
    HARDCODED_GEMINI_KEY;
  const model = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';
  return { apiKey, model };
}

let cachedWorkingModel = 'gemini-3.1-flash-lite';

async function runGeminiGenerateContent(
  contents: any[],
  options?: {
    apiKey?: string;
    model?: string;
    jsonMode?: boolean;
    temperature?: number;
    maxOutputTokens?: number;
  }
): Promise<{ text: string; model: string }> {
  // Fast 5-minute circuit breaker check to eliminate 8s waiting delays when quota is tripped
  if (isGeminiCircuitOpen()) {
    const remainingSec = Math.ceil((circuitBreakerUntil - Date.now()) / 1000);
    throw new Error(`Gemini API 429 Circuit Breaker active (${remainingSec}s remaining). Instant local heuristics engaged.`);
  }

  const { apiKey: envKey, model: defaultModel } = getGeminiConfig();
  const apiKey = options?.apiKey || envKey || HARDCODED_GEMINI_KEY;
  const requestedModel = options?.model || defaultModel;

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in environment or provided in request.');
  }

  // Prioritize verified active high-speed production models on Google AI Studio
  const modelCandidates = [
    'gemini-3.1-flash-lite',
    'gemini-3.5-flash',
    'gemini-flash-latest',
    requestedModel,
    cachedWorkingModel,
  ].filter((v, i, a) => Boolean(v) && a.indexOf(v) === i);

  let lastErrorText = '';

  for (const m of modelCandidates) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`;

      const body: any = {
        contents,
        generationConfig: {
          temperature: options?.temperature ?? 0.2,
          candidateCount: 1,
          ...(options?.maxOutputTokens ? { maxOutputTokens: options.maxOutputTokens } : {}),
        },
      };

      if (options?.jsonMode) {
        body.generationConfig.responseMimeType = 'application/json';
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        lastErrorText = await response.text();
        // If 429 quota exhaustion is detected, trip circuit breaker for 5 minutes
        if (response.status === 429 || lastErrorText.includes('RESOURCE_EXHAUSTED')) {
          circuitBreakerUntil = Date.now() + 5 * 60 * 1000;
        }
        continue;
      }

      const data = await response.json();
      const parts = data.candidates?.[0]?.content?.parts || [];
      const textPart = parts.find((p: any) => p.text && !p.thought);
      const text = textPart?.text || parts[0]?.text;
      if (!text) {
        continue;
      }

      cachedWorkingModel = m;
      return { text, model: m };
    } catch (err: any) {
      lastErrorText = err.message;
    }
  }

  throw new Error(`Gemini API error across candidate models: ${lastErrorText}`);
}

export async function callGemini(
  prompt: string,
  options?: {
    apiKey?: string;
    model?: string;
    jsonMode?: boolean;
    temperature?: number;
    maxOutputTokens?: number;
  }
): Promise<{ text: string; model: string }> {
  return runGeminiGenerateContent([{ parts: [{ text: prompt }] }], options);
}

/**
 * Transcribes spoken audio captured by MediaRecorder when native Web Speech API
 * is unavailable, blocked on HTTPS/mobile, or returns empty frames.
 */
export async function transcribeAudioWithGemini(
  base64Audio: string,
  mimeType: string
): Promise<{ transcript: string; model: string }> {
  const cleanMime = (mimeType || 'audio/webm').split(';')[0].trim() || 'audio/webm';
  const result = await runGeminiGenerateContent(
    [
      {
        parts: [
          {
            text: 'Transcribe the exact English words spoken in this audio recording. Output ONLY the verbatim spoken text with normal punctuation and no extra commentary. If there is only silence, breathing, or background noise with no clear speech, respond with exactly: [SILENCE]',
          },
          {
            inlineData: {
              mimeType: cleanMime,
              data: base64Audio,
            },
          },
        ],
      },
    ],
    {
      temperature: 0.0,
      maxOutputTokens: 256,
    }
  );

  const cleaned = result.text
    .replace(/\[SILENCE\]/gi, '')
    .replace(/^["']|["']$/g, '')
    .trim();

  return { transcript: cleaned, model: result.model };
}
