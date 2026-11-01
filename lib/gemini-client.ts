/**
 * GapAnchor Ops Dashboard - Gemini AI Client
 * Provides unified integration for Google Gemini 1.5 Flash / 2.0 Flash REST API
 * (100% Free Tier via Google AI Studio).
 */

export interface GeminiStatus {
  configured: boolean;
  model: string;
}

export function getGeminiConfig(): { apiKey: string | null; model: string } {
  const apiKey =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_AI_KEY ||
    process.env.GOOGLE_API_KEY ||
    null;
  const model = process.env.GEMINI_MODEL || 'gemini-flash-latest';
  return { apiKey, model };
}

let cachedWorkingModel = 'gemini-3.5-flash-lite';

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
  const { apiKey: envKey, model: defaultModel } = getGeminiConfig();
  const apiKey = options?.apiKey || envKey;
  const requestedModel = options?.model || defaultModel;

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in environment or provided in request.');
  }

  // Prioritize previously verified working model for zero trial latency
  const modelCandidates = [
    cachedWorkingModel,
    'gemini-3.5-flash-lite',
    requestedModel,
    'gemini-3.1-flash-lite',
    'gemini-flash-latest',
  ].filter((v, i, a) => Boolean(v) && a.indexOf(v) === i);

  let lastErrorText = '';

  for (const m of modelCandidates) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`;

      const body: any = {
        contents: [{ parts: [{ text: prompt }] }],
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
        continue;
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
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
