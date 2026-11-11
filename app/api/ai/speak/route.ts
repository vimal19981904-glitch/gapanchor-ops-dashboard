import { NextRequest, NextResponse } from 'next/server';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

export const dynamic = 'force-dynamic';

// Server-side LRU cache for generated audio buffers to maximize speed and minimize edge calls
const serverAudioCache = new Map<string, Buffer>();
const MAX_CACHE_ENTRIES = 250;

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
    .replace(/[•●▪■◆★\-\—_]/g, ', '); // bullet points to natural brief pause

  // 2. Strip emojis cleanly so TTS doesn't attempt to narrate them
  text = text.replace(/[\uD83C-\uDBFF\uDC00-\uDFFF]+/g, '').replace(/[\u2600-\u27BF]/g, '');

  // 3. Brand Names & Enterprise Terminology (Casual, natural speech without halting acronym pauses)
  text = text
    .replace(/\bGapAnchor\b/gi, 'Gap Anchor')
    .replace(/\bGapOps\b/gi, 'Gap Ops')
    .replace(/\bManhattan Active WMS\b/gi, 'Manhattan Active WMS')
    .replace(/\bActive WMS\b/gi, 'Active WMS')
    .replace(/\bManhattan ProActive\b/gi, 'Manhattan Pro-Active')
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
    .replace(/\bUK\b/g, 'the UK');

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

  // 6. Natural Human Cadence & Breath Pauses:
  // Add conversational pauses at major clause boundaries if missing
  text = text
    .replace(/([.!?])\s*([A-Z])/g, '$1 $2') // clean spacing after sentences
    .replace(/\s*:\s*/g, ', ') // colons to comma pauses
    .replace(/\s*;\s*/g, ', ') // semicolons to comma pauses
    .replace(/\s+/g, ' ')
    .trim();

  return text;
}

// In-flight synthesis promise map to prevent duplicate work if multiple clients or pre-fetches ask simultaneously
const inFlightSynthesis = new Map<string, Promise<Buffer>>();

async function synthesizeText(cleanText: string, voice: string, rate: string, pitch: string): Promise<Buffer> {
  const cacheKey = `${voice}_${rate}_${pitch}_${cleanText}`;
  if (serverAudioCache.has(cacheKey)) {
    return serverAudioCache.get(cacheKey)!;
  }

  if (inFlightSynthesis.has(cacheKey)) {
    return inFlightSynthesis.get(cacheKey)!;
  }

  const runSingleSynthesis = async (selectedVoice: string): Promise<Buffer> => {
    const tts = new MsEdgeTTS({ connectionTimeoutMs: 5000, synthesisTimeoutMs: 15000 });
    try {
      await tts.setMetadata(selectedVoice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
      const { audioStream } = tts.toStream(cleanText, { rate, pitch });
      const chunks: Buffer[] = [];
      audioStream.on('data', (chunk: Buffer) => chunks.push(chunk));
      return await new Promise<Buffer>((resolve, reject) => {
        audioStream.on('end', () => resolve(Buffer.concat(chunks)));
        audioStream.on('error', (err: any) => reject(err));
      });
    } finally {
      try { tts.close(); } catch {}
    }
  };

  const promise = (async () => {
    let audioBuffer: Buffer | null = null;
    let lastErr: any = null;

    // Retry the EXACT same voice once on transient Edge-TTS failure; never silently swap to a different voice
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        audioBuffer = await runSingleSynthesis(voice);
        if (audioBuffer && audioBuffer.length > 0) {
          break;
        }
        throw new Error('Neural TTS produced empty audio buffer.');
      } catch (err) {
        lastErr = err;
        console.warn(`Neural voice (${voice}) attempt ${attempt + 1} failed:`, err);
        if (attempt === 0) {
          await new Promise((r) => setTimeout(r, 250));
        }
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
  voice = 'en-GB-RyanNeural',
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
    const voice = searchParams.get('voice') || 'en-GB-RyanNeural';
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
      voice = 'en-GB-RyanNeural',
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
