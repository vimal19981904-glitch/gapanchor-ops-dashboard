import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const { searchParams } = new URL(request.url);
  const host = request.headers.get('host') || 'localhost:3000';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const redirectUri = `${protocol}://${host}/api/auth/microsoft/callback`;

  if (!clientId) {
    return NextResponse.json(
      {
        success: false,
        error: 'MICROSOFT_CLIENT_ID is not configured in environment variables.',
      },
      { status: 400 }
    );
  }

  const emailHint = searchParams.get('email') || 'contact@gapanchor.com';
  const scope = 'openid profile email Mail.Read offline_access';
  const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${encodeURIComponent(
    clientId
  )}&response_type=code&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&response_mode=query&scope=${encodeURIComponent(
    scope
  )}&login_hint=${encodeURIComponent(emailHint)}`;

  return NextResponse.redirect(authUrl);
}
