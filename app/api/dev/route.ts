import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const updates = await prisma.devLog.findMany({ orderBy: { date: 'desc' } });
    return NextResponse.json({ success: true, updates });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title, type, description, shippedBy, quarter } = body;

    if (!title || !description) {
      return NextResponse.json({ success: false, error: 'Title and description required' }, { status: 400 });
    }

    const log = await prisma.devLog.create({
      data: {
        quarter: quarter || 'Q3 2026',
        title,
        type: type || 'feature',
        description,
        date: new Date(),
        shippedBy: shippedBy || 'Dev Team',
      },
    });

    return NextResponse.json({ success: true, log });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
