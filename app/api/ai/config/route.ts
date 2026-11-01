import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { callGemini, getGeminiConfig } from '@/lib/gemini-client';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { apiKey, model } = getGeminiConfig();
  if (!apiKey) {
    return NextResponse.json({
      configured: false,
      model,
      message: 'GEMINI_API_KEY is not configured in .env',
    });
  }

  // Quick live test
  try {
    const testRes = await callGemini('Respond with "OK" in JSON format: {"status":"OK"}', {
      apiKey,
      model,
      jsonMode: true,
    });
    return NextResponse.json({
      configured: true,
      valid: true,
      model: testRes.model,
      maskedKey: `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`,
    });
  } catch (err: any) {
    return NextResponse.json({
      configured: true,
      valid: false,
      error: err.message,
      maskedKey: `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`,
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { apiKey } = body;

    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length < 10) {
      return NextResponse.json(
        { success: false, error: 'A valid Gemini API key is required.' },
        { status: 400 }
      );
    }

    const trimmedKey = apiKey.trim();

    // Verify key with Gemini
    try {
      await callGemini('Respond with "OK" in JSON format: {"status":"OK"}', {
        apiKey: trimmedKey,
        jsonMode: true,
      });
    } catch (testErr: any) {
      return NextResponse.json(
        { success: false, error: `Invalid Gemini API Key: ${testErr.message}` },
        { status: 400 }
      );
    }

    // Key is verified! Persist to .env and process.env
    process.env.GEMINI_API_KEY = trimmedKey;

    try {
      const envPath = path.join(process.cwd(), '.env');
      let envContent = '';
      if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf8');
      }

      if (envContent.includes('GEMINI_API_KEY=')) {
        envContent = envContent.replace(/GEMINI_API_KEY=.*(\r?\n|$)/g, `GEMINI_API_KEY=${trimmedKey}$1`);
      } else {
        envContent += `\nGEMINI_API_KEY=${trimmedKey}\n`;
      }

      fs.writeFileSync(envPath, envContent, 'utf8');
    } catch (fsErr) {
      console.warn('Failed to write .env file directly, key kept in memory:', fsErr);
    }

    return NextResponse.json({
      success: true,
      message: 'Gemini API key successfully verified and saved!',
      maskedKey: `${trimmedKey.slice(0, 4)}...${trimmedKey.slice(-4)}`,
    });
  } catch (err: any) {
    console.error('Error saving Gemini key:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to save Gemini key' },
      { status: 500 }
    );
  }
}
