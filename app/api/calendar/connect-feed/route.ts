import { NextRequest, NextResponse } from 'next/server';
import { saveIcalFeed, fetchIcalEvents } from '@/lib/googleCalendar';

export async function POST(request: NextRequest) {
  try {
    const { feedUrl, email } = await request.json();
    if (!feedUrl || typeof feedUrl !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Please provide a valid Google Calendar Secret iCal URL.' },
        { status: 400 }
      );
    }

    const cleanUrl = feedUrl.trim().replace(/^webcal:\/\//i, 'https://');
    if (!cleanUrl.includes('google.com') && !cleanUrl.includes('.ics')) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Invalid URL format. Please paste your Google Calendar Secret address in iCal format (ends in basic.ics).',
        },
        { status: 400 }
      );
    }

    // Verify feed can be fetched and parsed
    const events = await fetchIcalEvents(cleanUrl);
    const userEmail = email || 'xavierarul40@gmail.com';

    await saveIcalFeed(cleanUrl, userEmail);

    return NextResponse.json({
      success: true,
      message: `Successfully connected Google Calendar (${userEmail})! Loaded ${events.length} real-time meetings.`,
      eventsCount: events.length,
      email: userEmail,
    });
  } catch (error: any) {
    console.error('Error connecting iCal feed:', error);
    return NextResponse.json(
      { success: false, error: `Could not fetch calendar from that address: ${error.message}` },
      { status: 500 }
    );
  }
}
