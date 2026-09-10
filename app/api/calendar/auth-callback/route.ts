import { NextRequest, NextResponse } from 'next/server';
import { getOAuth2Client, saveTokens } from '@/lib/googleCalendar';
import { google } from 'googleapis';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  const baseUrl = request.nextUrl.origin;

  if (error) {
    console.error('Google OAuth callback error:', error);
    return NextResponse.redirect(`${baseUrl}/calendar?error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    return NextResponse.redirect(`${baseUrl}/calendar?error=missing_code`);
  }

  try {
    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Fetch user profile email
    let email: string | undefined;
    try {
      const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
      const userInfo = await oauth2.userinfo.get();
      email = userInfo.data.email || undefined;
    } catch (err) {
      console.warn('Could not fetch user profile email from Google:', err);
    }

    await saveTokens(tokens, email);

    return NextResponse.redirect(`${baseUrl}/calendar?connected=true`);
  } catch (err: any) {
    console.error('Failed to exchange Google OAuth code:', err);
    return NextResponse.redirect(
      `${baseUrl}/calendar?error=${encodeURIComponent(err.message || 'token_exchange_failed')}`
    );
  }
}
