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

  // 3. Brand Names & Enterprise Terminology
  text = text
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
    .replace(/\bSaaS\b/gi, 'Sass')
    .replace(/\bAPI\b/g, 'A.P.I.')
    .replace(/\bAPIs\b/g, 'A.P.I.s')
    .replace(/\bUI\b/g, 'U.I.')
    .replace(/\bUX\b/g, 'U.X.')
    .replace(/\bSQL\b/g, 'Sequel')
    .replace(/\bNoSQL\b/gi, 'No-Sequel')
    .replace(/\bPostgreSQL\b/gi, 'Postgres')
    .replace(/\bOAuth2?\b/gi, 'Oh-Auth')
    .replace(/\bAzure AD\b/gi, 'Azure Entra I.D.')
    .replace(/\bEntra ID\b/gi, 'Entra I.D.')
    .replace(/\bKPIs?\b/gi, 'K.P.I.')
    .replace(/\bSLAs?\b/gi, 'S.L.A.')
    .replace(/\bROI\b/g, 'R.O.I.')
    .replace(/\bAI\b/g, 'A.I.')
    .replace(/\bGenAI\b/gi, 'Generative A.I.')
    .replace(/\bCEO\b/g, 'C.E.O.')
    .replace(/\bCTO\b/g, 'C.T.O.')
    .replace(/\bCOO\b/g, 'C.O.O.');

  // 4. Timezones & Locations
  text = text
    .replace(/\bUSA\b/g, 'the United States')
    .replace(/\bUS\b/g, 'U.S.')
    .replace(/\bUK\b/g, 'U.K.')
    .replace(/\bUAE\b/g, 'U.A.E.')
    .replace(/\bIST\b/g, 'I.S.T.')
    .replace(/\bEST\b/g, 'E.S.T.')
    .replace(/\bCST\b/g, 'C.S.T.')
    .replace(/\bPST\b/g, 'P.S.T.')
    .replace(/\bGMT\b/g, 'G.M.T.')
    .replace(/\bUTC\b/g, 'U.T.C.');

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

// Warm client pool per voice to avoid 500-1500ms WebSocket handshake penalty on each utterance
interface WarmClientEntry {
  tts: MsEdgeTTS;
  voice: string;
  lastUsed: number;
}
const clientPool = new Map<string, WarmClientEntry>();

async function getWarmTTSClient(selectedVoice: string): Promise<MsEdgeTTS> {
  const existing = clientPool.get(selectedVoice);
  // Verify WebSocket is open (readyState === 1)
  const isAlive = existing && (existing.tts as any)._ws && (existing.tts as any)._ws.readyState === 1;

  if (isAlive) {
    existing.lastUsed = Date.now();
    return existing.tts;
  }

  // Clean up any stale client
  if (existing) {
    try {
      existing.tts.close();
    } catch {}
    clientPool.delete(selectedVoice);
  }

  // Initialize new warm client
  const tts = new MsEdgeTTS({ connectionTimeoutMs: 10000, synthesisTimeoutMs: 25000 });
  await tts.setMetadata(selectedVoice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
  clientPool.set(selectedVoice, { tts, voice: selectedVoice, lastUsed: Date.now() });
  return tts;
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

  const runSynthesis = async (selectedVoice: string): Promise<Buffer> => {
    let tts = await getWarmTTSClient(selectedVoice);

    const executeStream = (client: MsEdgeTTS) =>
      new Promise<Buffer>((resolve, reject) => {
        try {
          const { audioStream } = client.toStream(cleanText, { rate, pitch });
          const chunks: Buffer[] = [];
          audioStream.on('data', (chunk: Buffer) => chunks.push(chunk));
          audioStream.on('end', () => resolve(Buffer.concat(chunks)));
          audioStream.on('error', (err: any) => reject(err));
        } catch (streamErr) {
          reject(streamErr);
        }
      });

    try {
      return await executeStream(tts);
    } catch (firstErr) {
      console.warn(`Warm client for voice (${selectedVoice}) had socket reset. Retrying with fresh client:`, firstErr);
      // Evict stale client and retry once with fresh connection
      try { tts.close(); } catch {}
      clientPool.delete(selectedVoice);

      const freshTts = new MsEdgeTTS({ connectionTimeoutMs: 10000, synthesisTimeoutMs: 25000 });
      await freshTts.setMetadata(selectedVoice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
      clientPool.set(selectedVoice, { tts: freshTts, voice: selectedVoice, lastUsed: Date.now() });
      return await executeStream(freshTts);
    }
  };

  const promise = (async () => {
    let audioBuffer: Buffer;
    try {
      audioBuffer = await runSynthesis(voice);
    } catch (primaryErr) {
      console.warn(`Primary neural voice (${voice}) failed, trying fallback:`, primaryErr);
      const fallbackVoice = voice === 'en-US-BrianMultilingualNeural' ? 'en-GB-RyanNeural' : 'en-US-BrianMultilingualNeural';
      audioBuffer = await runSynthesis(fallbackVoice);
    }

    if (!audioBuffer || audioBuffer.length === 0) {
      throw new Error('Neural TTS produced empty audio buffer.');
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
  voice = 'en-US-BrianMultilingualNeural',
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
    const voice = searchParams.get('voice') || 'en-US-BrianMultilingualNeural';
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
      voice = 'en-US-BrianMultilingualNeural',
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
