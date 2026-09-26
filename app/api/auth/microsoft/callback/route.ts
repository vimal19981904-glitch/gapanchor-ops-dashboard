import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { syncOutlookGraphEnquiries } from '@/lib/outlook-graph-sync';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  const host = request.headers.get('host') || 'localhost:3000';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const redirectUri = `${protocol}://${host}/api/auth/microsoft/callback`;

  if (error || !code) {
    return NextResponse.json(
      {
        success: false,
        error: errorDescription || error || 'Authorization code not provided',
      },
      { status: 400 }
    );
  }

  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      {
        success: false,
        error: 'MICROSOFT_CLIENT_ID or MICROSOFT_CLIENT_SECRET missing in environment.',
      },
      { status: 400 }
    );
  }

  try {
    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    });

    const tokenRes = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      return NextResponse.json({ success: false, error: `Token exchange failed: ${errText}` }, { status: 400 });
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;
    const expiresAt = Date.now() + (tokenData.expires_in || 3600) * 1000;

    // Fetch user profile from Graph to confirm email
    let accountEmail = 'contact@gapanchor.com';
    try {
      const meRes = await fetch('https://graph.microsoft.com/v1.0/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (meRes.ok) {
        const meData = await meRes.json();
        accountEmail = meData.mail || meData.userPrincipalName || accountEmail;
      }
    } catch (e) {}

    // Save tokens in IntegrationConfig
    const metadata = {
      accountEmail,
      accessToken,
      refreshToken,
      expiresAt,
      connectedAt: new Date().toISOString(),
    };

    await prisma.integrationConfig.upsert({
      where: { service: 'microsoft_graph' },
      create: {
        service: 'microsoft_graph',
        connected: true,
        lastSynced: new Date(),
        metadata: JSON.stringify(metadata),
      },
      update: {
        connected: true,
        lastSynced: new Date(),
        metadata: JSON.stringify(metadata),
      },
    });

    // Run immediate sync after connecting
    const syncResult = await syncOutlookGraphEnquiries();

    return NextResponse.redirect(`${protocol}://${host}/?graph_connected=true&synced=${syncResult.insertedCount || 0}`);
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
