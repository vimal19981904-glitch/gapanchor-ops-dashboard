import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const cookieStore = cookies();
    const sessionCookie = cookieStore.get('gapanchor_session');

    if (sessionCookie && sessionCookie.value) {
      try {
        const sessionUser = JSON.parse(sessionCookie.value);

        // 100% DB-Free Demo Account Interceptor
        if (sessionUser.isDemo || sessionUser.email?.toLowerCase() === 'demo@gapanchor.com') {
          return NextResponse.json({ success: true, user: sessionUser });
        }

        // Live synchronisation against PostgreSQL to reflect latest Master Admin permission changes
        if (sessionUser.id) {
          const dbUser = await prisma.user.findUnique({
            where: { id: sessionUser.id },
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              isActive: true,
              assignedCourse: true,
              allowedUIs: true,
            },
          });

          if (dbUser) {
            return NextResponse.json({
              success: true,
              user: {
                ...sessionUser,
                ...dbUser,
              },
            });
          }
        }

        return NextResponse.json({ success: true, user: sessionUser });
      } catch (e) {
        // Invalid session cookie
      }
    }

    return NextResponse.json({ success: false, user: null }, { status: 401 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
