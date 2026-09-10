import { NextRequest, NextResponse } from 'next/server';
import { listCalendarEvents, createCalendarEvent } from '@/lib/googleCalendar';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const timeMin = searchParams.get('timeMin') || undefined;
    const timeMax = searchParams.get('timeMax') || undefined;
    const maxResultsStr = searchParams.get('maxResults');
    const maxResults = maxResultsStr ? parseInt(maxResultsStr, 10) : undefined;
    const search = searchParams.get('search') || searchParams.get('q') || undefined;

    const result = await listCalendarEvents({
      timeMin,
      timeMax,
      maxResults,
      search,
    });

    return NextResponse.json({
      success: true,
      events: result.events,
      connected: result.connected,
      isDemo: result.isDemo,
    });
  } catch (error: any) {
    console.error('Error in /api/calendar/events GET:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch calendar events' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { summary, description, location, startTime, endTime, conferenceType, attendees } = body;

    if (!summary || !startTime || !endTime) {
      return NextResponse.json(
        { success: false, error: 'Event summary, start time, and end time are required' },
        { status: 400 }
      );
    }

    const result = await createCalendarEvent({
      summary,
      description,
      location,
      startTime,
      endTime,
      conferenceType,
      attendees,
    });

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true, event: result.event });
  } catch (error: any) {
    console.error('Error in /api/calendar/events POST:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create event' },
      { status: 500 }
    );
  }
}
