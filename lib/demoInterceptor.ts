import { cookies } from 'next/headers';

export interface DemoUser {
  id: string;
  name: string;
  email: string;
  role: string;
  accountType: 'demo';
  isDemo: boolean;
  assignedCourse: string;
}

export const DEMO_USER_PROFILE: DemoUser = {
  id: 'demo-account-001',
  name: 'Demo Account (Showcase)',
  email: 'demo@gapanchor.com',
  role: 'DEMO',
  accountType: 'demo',
  isDemo: true,
  assignedCourse: 'Full Enterprise Showcase',
};

export function isDemoSession(): boolean {
  try {
    const cookieStore = cookies();
    const sessionCookie = cookieStore.get('gapanchor_session');
    if (sessionCookie?.value) {
      const user = JSON.parse(sessionCookie.value);
      return (
        user?.email?.toLowerCase() === 'demo@gapanchor.com' ||
        user?.accountType === 'demo' ||
        user?.isDemo === true ||
        user?.role === 'DEMO'
      );
    }
  } catch {
    // ignore
  }
  return false;
}
