import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    const cookieStore = cookies();
    const sessionCookie = cookieStore.get('gapanchor_session');

    if (sessionCookie && sessionCookie.value) {
      try {
        const user = JSON.parse(sessionCookie.value);
        return NextResponse.json({ success: true, user });
      } catch (e) {
        // Invalid session cookie
      }
    }

    return NextResponse.json({ success: false, user: null }, { status: 401 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
