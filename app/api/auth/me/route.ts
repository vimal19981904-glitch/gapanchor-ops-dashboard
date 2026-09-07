import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    const cookieStore = cookies();
    const sessionCookie = cookieStore.get('gapanchor_session');

    if (sessionCookie && sessionCookie.value) {
      const user = JSON.parse(sessionCookie.value);
      return NextResponse.json({ success: true, user });
    }

    // Default Master Admin session when running locally without explicit login cookie
    const isVercel = process.env.VERCEL === '1';
    if (!isVercel) {
      return NextResponse.json({
        success: true,
        user: {
          id: 'admin_local',
          name: 'Arul Xavier (Master Admin)',
          email: 'admin@gapanchor.com',
          role: 'admin',
          assignedCourse: 'All Platforms',
        },
      });
    }

    return NextResponse.json({ success: false, user: null }, { status: 401 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
