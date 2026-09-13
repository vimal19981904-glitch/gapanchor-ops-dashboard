import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  try {
    const origin = request.nextUrl.origin || process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const syncUrl = `${origin}/api/enquiries/sync-excel`;

    const res = await fetch(syncUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    const data = await res.json();
    const durationMs = Date.now() - startTime;

    return NextResponse.json({
      success: data.success ?? true,
      job: 'sync-outlook-30m-cron',
      timestamp: new Date().toISOString(),
      durationMs,
      result: data,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        job: 'sync-outlook-30m-cron',
        timestamp: new Date().toISOString(),
        error: error.message || 'Error triggering Outlook sync cron job',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
