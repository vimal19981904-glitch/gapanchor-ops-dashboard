import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get('gapanchor_session');

  // Allow static files, _next, and /login page without session
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/_next') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Intercept Admin APIs specifically
  if (pathname.startsWith('/api/admin/')) {
    if (!sessionCookie || !sessionCookie.value) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    try {
      const user = JSON.parse(sessionCookie.value);
      if (user.role !== 'admin' && user.email?.toLowerCase() !== 'admin@gapanchor.com') {
        return NextResponse.json({ success: false, error: 'Unauthorized: Master Admin access required.' }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid session' }, { status: 401 });
    }
    return NextResponse.next();
  }

  // Allow all other API routes to handle their own auth
  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // If no session cookie exists, redirect user to /login
  if (!sessionCookie || !sessionCookie.value) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // RBAC Permission Check (Bypassed if ENABLE_RBAC === 'false')
  if (process.env.ENABLE_RBAC !== 'false') {
    try {
      const user = JSON.parse(sessionCookie.value);

      // Check if account has been disabled
      if (user.isActive === false) {
        const loginUrl = new URL('/login?error=deactivated', request.url);
        return NextResponse.redirect(loginUrl);
      }

      // Master Admin has unrestricted access to all routes
      if (user.role === 'admin' || user.email?.toLowerCase() === 'admin@gapanchor.com') {
        return NextResponse.next();
      }

      // Credentials management is strictly for Master Admin
      if (pathname.startsWith('/credentials')) {
        const fallbackUrl = new URL('/enquiries?unauthorized=credentials', request.url);
        return NextResponse.redirect(fallbackUrl);
      }

      // Demo users have showcase access to all demo pages, but not credentials
      if (user.role === 'DEMO' || user.isDemo) {
        return NextResponse.next();
      }

      // Check Employee granular module permissions
      const allowed = Array.isArray(user.allowedUIs) ? user.allowedUIs : ['enquiries'];
      if (allowed.includes('*')) {
        return NextResponse.next();
      }

      const routeModuleMap: Record<string, string> = {
        '/calendar': 'calendar',
        '/training': 'training',
        '/trainers': 'training',
        '/finance': 'finance',
        '/ops-analytics': 'ops',
        '/job-support': 'job-support',
      };

      for (const [routePrefix, moduleId] of Object.entries(routeModuleMap)) {
        if (pathname.startsWith(routePrefix)) {
          if (!allowed.includes(moduleId)) {
            const fallbackUrl = new URL(`/enquiries?unauthorized=${moduleId}`, request.url);
            return NextResponse.redirect(fallbackUrl);
          }
        }
      }
    } catch (e) {
      // If parsing fails, fall back to /login
      const loginUrl = new URL('/login', request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
