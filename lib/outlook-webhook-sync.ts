import { prisma } from '@/lib/prisma';
import { createGraphClient } from '@/lib/graph-client';
import {
  TARGET_OUTLOOK_EMAIL,
  TARGET_FOLDER_NAMES,
  parseEmailContent,
} from '@/lib/outlook-graph-sync';

/**
 * Fast Webhook Sync: Optimized specifically for real-time triggers (e.g. Power Automate).
 * Only checks the top N most recent emails in the target folder, avoids redundant sequential DB updates,
 * and completes in 1-2 seconds instead of timing out at 2+ minutes.
 */
export async function syncRecentOutlookEnquiries(maxCount = 15) {
  const startTime = Date.now();

  try {
    // 1. Get Access Token from DB or Client Credentials
    let accessToken: string | null = null;
    let isAppToken = false;
    let accountEmail = TARGET_OUTLOOK_EMAIL;

    const config = await prisma.integrationConfig.findUnique({
      where: { service: 'microsoft_graph' },
    });

    if (config?.metadata) {
      try {
        const meta = JSON.parse(config.metadata);
        if (meta.accessToken && meta.expiresAt && Date.now() < meta.expiresAt - 300000) {
          accessToken = meta.accessToken;
          accountEmail = meta.accountEmail || TARGET_OUTLOOK_EMAIL;
        } else if (meta.refreshToken) {
          const clientId = process.env.MICROSOFT_CLIENT_ID;
          const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
          const tenantId = process.env.MICROSOFT_TENANT_ID || 'common';

          if (clientId && clientSecret) {
            const params = new URLSearchParams({
              client_id: clientId,
              client_secret: clientSecret,
              grant_type: 'refresh_token',
              refresh_token: meta.refreshToken,
              scope: 'openid profile email Mail.Read offline_access',
            });

            const tokenRes = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: params.toString(),
            });

            if (tokenRes.ok) {
              const tokenData = await tokenRes.json();
              accessToken = tokenData.access_token;
              const newRefreshToken = tokenData.refresh_token || meta.refreshToken;
              const newExpiresAt = Date.now() + (tokenData.expires_in || 3600) * 1000;

              await prisma.integrationConfig.update({
                where: { service: 'microsoft_graph' },
                data: {
                  connected: true,
                  metadata: JSON.stringify({
                    ...meta,
                    accessToken,
                    refreshToken: newRefreshToken,
                    expiresAt: newExpiresAt,
                  }),
                },
              });
            }
          }
        }
      } catch (err: any) {
        console.warn('Error reading stored token in fast sync:', err.message);
      }
    }

    // Client Credentials fallback
    if (!accessToken) {
      const clientId = process.env.MICROSOFT_CLIENT_ID;
      const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
      const tenantId = process.env.MICROSOFT_TENANT_ID;

      if (clientId && clientSecret && tenantId) {
        const params = new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: 'client_credentials',
          scope: 'https://graph.microsoft.com/.default',
        });

        const appRes = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: params.toString(),
        });

        if (appRes.ok) {
          const data = await appRes.json();
          accessToken = data.access_token;
          isAppToken = true;
        }
      }
    }

    if (!accessToken) {
      throw new Error('Unable to acquire Microsoft Graph access token.');
    }

    const client = createGraphClient(accessToken);
    const basePath = isAppToken ? `/users/${accountEmail}` : '/me';

    // 2. Locate Target Folder ('Demo enquiry!' or 'Job Support')
    let folderId: string | null = null;
    let targetFolderName = 'Demo enquiry!';

    try {
      const filterRes = await client
        .api(`${basePath}/mailFolders`)
        .filter("displayName eq 'Demo enquiry!'")
        .get();
      folderId = filterRes.value?.[0]?.id || null;
    } catch {}

    if (!folderId) {
      const foldersRes = await client.api(`${basePath}/mailFolders`).top(30).get();
      const match = (foldersRes.value || []).find(
        (f: any) => (f.displayName || '').toLowerCase() === 'demo enquiry!'
      );
      folderId = match?.id || null;
    }

    if (!folderId) {
      throw new Error('Demo enquiry! folder not found in mailbox.');
    }

    // 3. Fetch ONLY the top N most recent messages (Order by receivedDateTime desc)
    const messagesRes = await client
      .api(`${basePath}/mailFolders/${folderId}/messages`)
      .select('id,subject,from,receivedDateTime,bodyPreview,body')
      .orderby('receivedDateTime desc')
      .top(maxCount)
      .get();

    const recentMessages = messagesRes.value || [];

    // 4. Fetch existing IDs for fast in-memory deduplication
    const messageIds = recentMessages.map((m: any) => m.id);
    const existingMatches = await prisma.enquiry.findMany({
      where: { whatsappMessageId: { in: messageIds } },
      select: { id: true, whatsappMessageId: true },
    });
    const existingIdSet = new Set(existingMatches.map((e) => e.whatsappMessageId));

    let insertedCount = 0;
    const newLeads: any[] = [];

    for (const msg of recentMessages) {
      // If already in database, skip it immediately! No slow sequential SQL updates needed.
      if (existingIdSet.has(msg.id)) {
        continue;
      }

      const bodyContent = msg.body?.content || msg.bodyPreview || '';
      const senderName = msg.from?.emailAddress?.name || '';
      const senderEmail = msg.from?.emailAddress?.address || '';

      const parsed = parseEmailContent(
        bodyContent,
        msg.subject || '',
        senderName,
        senderEmail,
        msg.receivedDateTime,
        targetFolderName
      );

      if (parsed.name === 'Unknown' && !parsed.email && !parsed.phone) {
        continue;
      }

      const created = await prisma.enquiry.create({
        data: {
          participantName: parsed.name,
          email: parsed.email || null,
          phone: parsed.phone,
          country: parsed.country,
          serviceType: parsed.serviceType,
          trainingType: parsed.trainingType,
          topic: parsed.trainingType || parsed.serviceType,
          lastMessage: parsed.message,
          receivedDate: parsed.receivedDate,
          messageTimestamp: parsed.receivedDate,
          leadQuality: 'Unrated',
          contactStatus: 'Pending',
          status: 'Open',
          whatsappMessageId: msg.id,
          source: 'outlook',
        },
      });

      insertedCount++;
      newLeads.push(created);
    }

    const durationMs = Date.now() - startTime;

    return {
      success: true,
      durationMs,
      checkedCount: recentMessages.length,
      insertedCount,
      newLeads,
    };
  } catch (err: any) {
    console.error('[Fast Webhook Sync] Error:', err);
    return {
      success: false,
      durationMs: Date.now() - startTime,
      error: err.message,
      checkedCount: 0,
      insertedCount: 0,
      newLeads: [],
    };
  }
}
