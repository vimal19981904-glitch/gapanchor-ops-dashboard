import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { syncWorkWithUsTrainers } from '@/lib/trainers-sync';

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    const accessToken = (session as any)?.accessToken;

    const result = await syncWorkWithUsTrainers(accessToken);

    const resAny = result as any;
    if (resAny.success === false) {
      return NextResponse.json(
        {
          success: false,
          requiresAuth: resAny.requiresAuth,
          authUrl: resAny.authUrl,
          error: resAny.error,
        },
        { status: 400 }
      );
    }

    const message = result.purgedCount > 0
      ? `Outlook Work With Us sync complete! Purged ${result.purgedCount} deleted candidate(s). Total active staff: ${result.totalCount}`
      : result.syncedCount > 0
      ? `Outlook Work With Us sync complete! Added ${result.syncedCount} new candidate(s). Total active staff: ${result.totalCount}`
      : `Outlook Work With Us sync complete! Checked ${resAny.fetchedMessagesCount || 0} Outlook emails (${result.totalCount} active staff)`;

    return NextResponse.json({
      success: true,
      message,
      summary: result,
    });
  } catch (error: any) {
    console.error('Work With Us sync API error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
