import { NextRequest, NextResponse } from 'next/server';
import { getGeminiConfig, transcribeAudioWithGemini } from '@/lib/gemini-client';

export const dynamic = 'force-dynamic';
export const maxDuration = 10;

const MAX_AUDIO_BYTES = 5 * 1024 * 1024; // 5 MB safety cap

export async function POST(req: NextRequest) {
  try {
    const { apiKey } = getGeminiConfig();
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'GEMINI_API_KEY is not configured on this server.' },
        { status: 503 }
      );
    }

    const formData = await req.formData();
    const audioField = formData.get('audio');

    if (!audioField || !(audioField instanceof Blob)) {
      return NextResponse.json(
        { success: false, error: 'No audio recording found in request.' },
        { status: 400 }
      );
    }

    if (audioField.size < 256) {
      return NextResponse.json({ success: true, transcript: '' });
    }

    if (audioField.size > MAX_AUDIO_BYTES) {
      return NextResponse.json(
        { success: false, error: 'Audio recording exceeds 5 MB limit.' },
        { status: 413 }
      );
    }

    const arrayBuffer = await audioField.arrayBuffer();
    const base64Audio = Buffer.from(arrayBuffer).toString('base64');
    const { transcript, model } = await transcribeAudioWithGemini(base64Audio, audioField.type || 'audio/webm');

    return NextResponse.json({
      success: true,
      transcript,
      model,
    });
  } catch (err: any) {
    console.error('Audio transcription error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to transcribe audio.' },
      { status: 500 }
    );
  }
}

