import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ success: false, error: 'Email and password are required' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();

    // 100% DB-Free Demo Account Interceptor
    if (cleanEmail === 'demo@gapanchor.com') {
      const demoUserData = {
        id: 'demo-account-001',
        name: 'Demo Account (Showcase)',
        email: 'demo@gapanchor.com',
        role: 'DEMO',
        accountType: 'demo',
        isDemo: true,
        assignedCourse: 'Full Enterprise Showcase',
      };

      const res = NextResponse.json({ success: true, user: demoUserData });
      res.cookies.set({
        name: 'gapanchor_session',
        value: JSON.stringify(demoUserData),
        httpOnly: true,
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
        sameSite: 'lax',
      });
      return res;
    }

    const user = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (!user || user.password !== password) {
      return NextResponse.json({ success: false, error: 'Invalid email or password' }, { status: 401 });
    }

    const userData = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      assignedCourse: user.assignedCourse,
    };

    const res = NextResponse.json({ success: true, user: userData });
    
    // Set HTTP-only session cookie
    res.cookies.set({
      name: 'gapanchor_session',
      value: JSON.stringify(userData),
      httpOnly: true,
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      sameSite: 'lax',
    });

    return res;
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
