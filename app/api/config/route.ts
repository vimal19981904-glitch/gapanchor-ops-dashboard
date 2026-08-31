import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const configs = await prisma.integrationConfig.findMany();
    const result: Record<string, any> = {};

    configs.forEach((c) => {
      result[c.service] = {
        connected: c.connected,
        lastSynced: c.lastSynced,
        ...(c.metadata ? JSON.parse(c.metadata) : {}),
      };
    });

    return NextResponse.json({ success: true, configs: result });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { service, connected, metadata } = body;

    if (!service) {
      return NextResponse.json({ success: false, error: 'Service name required' }, { status: 400 });
    }

    const updated = await prisma.integrationConfig.upsert({
      where: { service },
      update: {
        connected: connected ?? true,
        metadata: JSON.stringify(metadata || {}),
        lastSynced: new Date(),
      },
      create: {
        service,
        connected: connected ?? true,
        metadata: JSON.stringify(metadata || {}),
        lastSynced: new Date(),
      },
    });

    return NextResponse.json({ success: true, config: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
