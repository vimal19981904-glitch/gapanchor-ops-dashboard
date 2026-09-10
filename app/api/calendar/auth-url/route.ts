import { NextResponse } from 'next/server';
import { getAuthorizationUrl, isGoogleConfigured } from '@/lib/googleCalendar';

export async function GET() {
  try {
    if (!isGoogleConfigured()) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Google OAuth credentials are not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your environment.',
        },
        { status: 400 }
      );
    }

    const url = getAuthorizationUrl();
    return NextResponse.json({ success: true, url });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
