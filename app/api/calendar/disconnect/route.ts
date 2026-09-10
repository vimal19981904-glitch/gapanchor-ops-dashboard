import { NextResponse } from 'next/server';
import { disconnectGoogleCalendar } from '@/lib/googleCalendar';

export async function POST() {
  try {
    await disconnectGoogleCalendar();
    return NextResponse.json({ success: true, message: 'Google Calendar disconnected successfully' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
