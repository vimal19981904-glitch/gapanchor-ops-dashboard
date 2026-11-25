import { NextRequest, NextResponse } from 'next/server';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

export const dynamic = 'force-dynamic';
export const maxDuration = 25;

// Default curated voice profile
const DEFAULT_NEURAL_VOICE = 'en-US-BrianMultilingualNeural';

// Server-side LRU cache for generated audio buffers to maximize speed and minimize edge calls
const serverAudioCache = new Map<string, Buffer>();
const MAX_CACHE_ENTRIES = 250;

/**
 * Phonetic digit converter for natural human phone number pronunciation.
 * E.g., '22' -> 'double two', '984' -> 'nine eight four'.
 */
function digitToWord(d: string): string {
  const map: Record<string, string> = {
    '0': 'zero',
    '1': 'one',
    '2': 'two',
    '3': 'three',
    '4': 'four',
    '5': 'five',
    '6': 'six',
    '7': 'seven',
    '8': 'eight',
    '9': 'nine',
  };
  return map[d] || d;
}

function speakChunk(chunk: string): string {
  const words: string[] = [];
  let i = 0;
  while (i < chunk.length) {
    if (i + 1 < chunk.length && chunk[i] === chunk[i + 1]) {
      words.push(`double ${digitToWord(chunk[i])}`);
      i += 2;
    } else {
      words.push(digitToWord(chunk[i]));
      i++;
    }
  }
  return words.join(' ');
}

/**
 * Converts a 10-digit mobile number into rhythmic, human conversational cadence.
 * Breaks into 3-2-3-2 chunks with double-digit detection:
 * E.g. '9842231585' -> 'nine eight four, double two, three one five, eight five'.
 */
function formatPhoneNumberForSpeech(digitsOnly: string): string {
  if (digitsOnly.length === 10) {
    const c1 = digitsOnly.slice(0, 3);
    const c2 = digitsOnly.slice(3, 5);
    const c3 = digitsOnly.slice(5, 8);
    const c4 = digitsOnly.slice(8, 10);
    return `${speakChunk(c1)}, ${speakChunk(c2)}, ${speakChunk(c3)}, ${speakChunk(c4)}`;
  }
  // Generic grouping for other lengths
  const chunks: string[] = [];
  for (let i = 0; i < digitsOnly.length; i += 3) {
    chunks.push(speakChunk(digitsOnly.slice(i, Math.min(i + 3, digitsOnly.length))));
  }
  return chunks.join(', ');
}

/**
 * Phonetic pronunciation dictionary and text-to-speech sanitizer.
 * Converts corporate acronyms, symbols, numbers, and tech jargon into natural,
 * human-sounding spoken English with authentic breath pauses (ChatGPT/Claude style).
 */
function humanizeTextForSpeech(input: string): string {
  if (!input) return '';

  let text = input;

  // 1. Strip markdown, citations, URLs, code blocks, and JSON remnants
  text = text
    .replace(/```[\s\S]*?```/g, '') // remove multi-line code blocks
    .replace(/`([^`]+)`/g, '$1') // inline code to raw text
    .replace(/\*\*(.*?)\*\*/g, '$1') // bold to plain
    .replace(/\*(.*?)\*/g, '$1') // italic to plain
    .replace(/#{1,6}\s/g, '') // headers
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // markdown link [text](url) -> text
    .replace(/https?:\/\/\S+/g, '') // remove urls
    .replace(/\{[^{}]*\}/g, '') // json objects
    .replace(/<[^>]*>/g, '') // raw html tags
    .replace(/[•●▪■◆★]/g, ', ') // bullet points to natural brief pause
    .replace(/\s+[\-\—]\s+/g, ', '); // standalone em-dashes and spaced hyphens to comma pause (preserves word hyphens)

  // 2. Strip emojis cleanly so TTS doesn't attempt to narrate them
  text = text.replace(/[\uD83C-\uDBFF\uDC00-\uDFFF]+/g, '').replace(/[\u2600-\u27BF]/g, '');

  // 3. Conversational Fluency & Tech Terminology (Zero hyphens, human conversational expressions)
  text = text
    // Replace hyphenated expressions with natural spoken alternatives
    .replace(/\bfollow[\s-]?ups\b/gi, 'follow up activities')
    .replace(/\bfollow[\s-]?up\b/gi, 'follow up')
    .replace(/\bhigh[\s-]?priority\b/gi, 'high priority')
    .replace(/\bone[\s-]+on[\s-]+one\b/gi, 'one on one')
    .replace(/\b1[\s-]*(?:on|to)[\s-]*1\b/gi, 'one on one')
    .replace(/\b1:1\b/g, 'one on one')
    .replace(/\bup[\s-]?to[\s-]?date\b/gi, 'current information')
    .replace(/\baction[\s-]?items\b/gi, 'action items')
    .replace(/\baction[\s-]?item\b/gi, 'action item')
    .replace(/\bclient[\s-]?specific\b/gi, 'specific client')
    .replace(/\bend[\s-]?to[\s-]?end\b/gi, 'complete process')
    .replace(/\bnext[\s-]?steps\b/gi, 'next steps')
    .replace(/\bnext[\s-]?step\b/gi, 'next step')
    .replace(/\btwo[\s-]?day\b/gi, 'two day')
    .replace(/\bthree[\s-]?day\b/gi, 'three day')
    // Remove em dashes and en dashes
    .replace(/[\—\–]/g, ', ')
    // Convert remaining word-to-word hyphens into clean spaces
    .replace(/([a-zA-Z]{2,})-([a-zA-Z]{2,})/g, '$1 $2')
    // Fix "proactive" fluency (never read with halting hyphen pause)
    .replace(/\bManhattan ProActive\b/gi, 'Manhattan Proactive')
    .replace(/\bpro-active\b/gi, 'proactive')
    .replace(/\bProActive\b/g, 'Proactive')
    .replace(/\bGapAnchor\b/gi, 'Gap Anchor')
    .replace(/\bGapOps\b/gi, 'Gap Ops')
    .replace(/\bManhattan Active WMS\b/gi, 'Manhattan Active WMS')
    .replace(/\bActive WMS\b/gi, 'Active WMS')
    .replace(/\bBlue Yonder\b/gi, 'Blue Yonder')
    .replace(/\bSAP S\/4HANA\b/gi, 'SAP S-4 HANA')
    .replace(/\bSaaS\b/gi, 'Sass')
    .replace(/\bSQL\b/g, 'Sequel')
    .replace(/\bNoSQL\b/gi, 'No-Sequel')
    .replace(/\bPostgreSQL\b/gi, 'Postgres')
    .replace(/\bOAuth2?\b/gi, 'Oh-Auth')
    .replace(/\bAzure AD\b/gi, 'Azure Entra ID')
    .replace(/\bEntra ID\b/gi, 'Entra ID')
    .replace(/\bGenAI\b/gi, 'Generative AI');

  // 4. Timezones & Locations
  text = text
    .replace(/\bUSA\b/g, 'the United States')
    .replace(/\bUS\b/g, 'the U S')
    .replace(/\bUK\b/g, 'the UK')
    .replace(/\bIST\b/g, 'I S T')
    .replace(/\bUTC\b/g, 'U T C')
    .replace(/\bPST\b/g, 'P S T')
    .replace(/\bEST\b/g, 'E S T');

  // 5. Units, Currency, and Quantities
  text = text
    .replace(/\$(\d+(?:\.\d+)?)\s*k\b/gi, '$$$1 thousand dollars')
    .replace(/\$(\d+(?:,\d{3})*(?:\.\d+)?)\b/g, '$1 dollars')
    .replace(/€(\d+(?:,\d{3})*(?:\.\d+)?)\b/g, '$1 euros')
    .replace(/£(\d+(?:,\d{3})*(?:\.\d+)?)\b/g, '$1 pounds')
    .replace(/₹(\d+(?:,\d{3})*(?:\.\d+)?)\b/g, '$1 rupees')
    .replace(/\b(\d+)\/10\b/g, '$1 out of 10')
    .replace(/\b(\d+)%/g, '$1 percent')
    .replace(/\b24\/7\b/g, 'twenty-four seven')
    .replace(/\b(\d+)\+(\s+leads|\s+candidates|\s+enquiries)?\b/gi, 'over $1$2')
    .replace(/\b1st\b/gi, 'first')
    .replace(/\b2nd\b/gi, 'second')
    .replace(/\b3rd\b/gi, 'third')
    .replace(/\b4th\b/gi, 'fourth')
    .replace(/\b5th\b/gi, 'fifth');

  // 6. Conversational Time Pronunciation (e.g., '6:00 PM' -> '6 PM', '6:48 PM' -> '6:48 PM')
  // Strip ':00' from round hours so Edge-TTS says '6 PM' instead of 'six oh zero PM'
  text = text
    .replace(/\b(\d{1,2}):00\s*(am|pm)\b/gi, '$1 $2')
    .replace(/\b0([1-9])\s*(am|pm)\b/gi, '$1 $2') // '05 AM' -> '5 AM'
    .replace(/\b(\d{1,2}):(\d{2})\s*(am|pm)\b/gi, '$1:$2 $3'); // Ensure clean spacing for non-zero minutes like '6:48 PM'

  // 7. Humanized Phone Number Recitation with Cadence and 'double' Digits
  // Matches e.g. '+91 9701767807', '+91-9842231585', '9842231585', '98422 31585'
  text = text.replace(/(?:\+91[\s-]*)?([6-9](?:[\s-]?\d){9})\b/g, (match, tenDigitsRaw) => {
    const cleanDigits = tenDigitsRaw.replace(/\D/g, '');
    if (cleanDigits.length !== 10) return match;
    const spokenDigits = formatPhoneNumberForSpeech(cleanDigits);
    const hasPlus91 = match.trim().startsWith('+91') || match.trim().startsWith('91 ');
    return hasPlus91 ? `plus nine one, ${spokenDigits}` : spokenDigits;
  });

  // 8. Natural Human Cadence & Breath Pauses:
  // Add conversational pauses at major clause boundaries if missing.
  // CRITICAL: Only convert colons that are NOT between digits, preserving timestamps like '6:48'
  text = text
    .replace(/([.!?])\s*([A-Z])/g, '$1 $2') // clean spacing after sentences
    .replace(/(?<!\d):(?!\d)/g, ', ') // colons to comma pauses (excluding timestamps)
    .replace(/\s*;\s*/g, ', ') // semicolons to comma pauses
    .replace(/\s+/g, ' ')
    .trim();

  return text;
}

// In-flight synthesis promise map to prevent duplicate work if multiple clients or pre-fetches ask simultaneously
const inFlightSynthesis = new Map<string, Promise<Buffer>>();

// Warm MsEdgeTTS WebSocket pool keyed by voice so chunks 1..N reuse the open Edge-TTS socket (eliminating 3-10s handshake pauses)
const pooledTtsClients = new Map<string, { tts: MsEdgeTTS; initPromise: Promise<void> | null }>();

function resetPooledTts(voice: string) {
  const existing = pooledTtsClients.get(voice);
  if (existing) {
    try {
      existing.tts.close();
    } catch {}
    pooledTtsClients.delete(voice);
  }
}

async function getReadyPooledTts(voice: string): Promise<MsEdgeTTS> {
  let entry = pooledTtsClients.get(voice);
  if (!entry) {
    const tts = new MsEdgeTTS({ connectionTimeoutMs: 3500, synthesisTimeoutMs: 9000 });
    entry = { tts, initPromise: null };
    pooledTtsClients.set(voice, entry);
  }

  if (!entry.initPromise) {
    entry.initPromise = entry.tts
      .setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3)
      .catch((err) => {
        resetPooledTts(voice);
        throw err;
      })
      .finally(() => {
        if (entry) entry.initPromise = null;
      });
  }

  await entry.initPromise;
  return entry.tts;
}

async function synthesizeText(cleanText: string, voice: string, rate: string, pitch: string): Promise<Buffer> {
  const cacheKey = `${voice}_${rate}_${pitch}_${cleanText}`;
  if (serverAudioCache.has(cacheKey)) {
    return serverAudioCache.get(cacheKey)!;
  }

  if (inFlightSynthesis.has(cacheKey)) {
    return inFlightSynthesis.get(cacheKey)!;
  }

  const runPooledSynthesis = async (selectedVoice: string, forceFresh = false): Promise<Buffer> => {
    if (forceFresh) {
      resetPooledTts(selectedVoice);
    }
    const tts = await getReadyPooledTts(selectedVoice);
    const { audioStream } = tts.toStream(cleanText, { rate, pitch });
    const chunks: Buffer[] = [];
    audioStream.on('data', (chunk: Buffer) => chunks.push(chunk));
    return await new Promise<Buffer>((resolve, reject) => {
      audioStream.on('end', () => resolve(Buffer.concat(chunks)));
      audioStream.on('error', (err: any) => {
        resetPooledTts(selectedVoice);
        reject(err);
      });
    });
  };

  const promise = (async () => {
    let audioBuffer: Buffer | null = null;
    let lastErr: any = null;
    const startMs = Date.now();

    // Attempt 1 uses warm pooled socket; if socket dropped/stalled, reset and retry once immediately
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        audioBuffer = await runPooledSynthesis(voice, attempt > 0);
        if (audioBuffer && audioBuffer.length > 0) {
          break;
        }
        throw new Error('Neural TTS produced empty audio buffer.');
      } catch (err) {
        lastErr = err;
        console.warn(`Neural voice (${voice}) attempt ${attempt + 1} failed:`, err);
        if (attempt === 0 && Date.now() - startMs < 6000) {
          await new Promise((r) => setTimeout(r, 100));
          continue;
        }
        break;
      }
    }

    if (!audioBuffer || audioBuffer.length === 0) {
      throw lastErr || new Error('Neural TTS produced empty audio buffer.');
    }

    // Save in server cache
    if (serverAudioCache.size >= MAX_CACHE_ENTRIES) {
      const firstKey = serverAudioCache.keys().next().value;
      if (firstKey) serverAudioCache.delete(firstKey);
    }
    serverAudioCache.set(cacheKey, audioBuffer);
    return audioBuffer;
  })().finally(() => {
    inFlightSynthesis.delete(cacheKey);
  });

  inFlightSynthesis.set(cacheKey, promise);
  return promise;
}

// Handler logic for both GET and POST
async function handleSpeakRequest(
  text: string | null,
  voice = DEFAULT_NEURAL_VOICE,
  rate = '+0%',
  pitch = '+0%'
) {
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return NextResponse.json({ error: 'Text parameter is required.' }, { status: 400 });
  }

  const cleanText = humanizeTextForSpeech(text);
  if (!cleanText) {
    return NextResponse.json({ error: 'Valid text is required.' }, { status: 400 });
  }

  const cacheKey = `${voice}_${rate}_${pitch}_${cleanText}`;
  const isHit = serverAudioCache.has(cacheKey);
  const audioBuffer = await synthesizeText(cleanText, voice, rate, pitch);

  return new NextResponse(new Uint8Array(audioBuffer), {
    status: 200,
    headers: {
      'Content-Type': 'audio/mpeg',
      'Content-Length': audioBuffer.length.toString(),
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=43200',
      'X-Cache': isHit ? 'HIT' : 'MISS',
    },
  });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const text = searchParams.get('text');
    const voice = searchParams.get('voice') || DEFAULT_NEURAL_VOICE;
    const rate = searchParams.get('rate') || '+0%';
    const pitch = searchParams.get('pitch') || '+0%';
    return await handleSpeakRequest(text, voice, rate, pitch);
  } catch (error: any) {
    console.error('Edge-TTS GET Audio Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate neural audio' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      text,
      voice = DEFAULT_NEURAL_VOICE,
      rate = '+0%',
      pitch = '+0%',
    } = body;
    return await handleSpeakRequest(text, voice, rate, pitch);
  } catch (error: any) {
    console.error('Edge-TTS POST Audio Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate neural audio' },
      { status: 500 }
    );
  }
}
