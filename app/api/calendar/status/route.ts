import { NextResponse } from 'next/server';
import { getCalendarStatus } from '@/lib/googleCalendar';
import { isDemoSession } from '@/lib/demoInterceptor';

export async function GET() {
  try {
    if (isDemoSession()) {
      return NextResponse.json({
        success: true,
        connected: false,
        configured: false,
        email: null,
        isDemo: true,
      });
    }

    const status = await getCalendarStatus();
    return NextResponse.json({ success: true, ...status });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, connected: false, configured: false, error: error.message },
      { status: 500 }
    );
  }
}
