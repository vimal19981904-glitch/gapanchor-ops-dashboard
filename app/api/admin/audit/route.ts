import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth/rbac';

/**
 * GET /api/admin/audit
 * Returns administrative audit activity log.
 */
export async function GET(req: Request) {
  try {
    const session = getSessionUser(req);
    if (!session || (session.role !== 'admin' && session.email.toLowerCase() !== 'admin@gapanchor.com')) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Master Admin access required.' }, { status: 403 });
    }

    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return NextResponse.json({ success: true, logs });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
