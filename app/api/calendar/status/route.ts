import { NextResponse } from 'next/server';
import { getCalendarStatus } from '@/lib/googleCalendar';

export async function GET() {
  try {
    const status = await getCalendarStatus();
    return NextResponse.json({ success: true, ...status });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, connected: false, configured: false, error: error.message },
      { status: 500 }
    );
  }
}
