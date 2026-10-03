import { prisma } from '@/lib/prisma';
import { createGraphClient } from '@/lib/graph-client';

export const TARGET_OUTLOOK_EMAIL = 'contact@gapanchor.com';
export const TARGET_FOLDER_NAME = 'Demo enquiry!';
export const TARGET_FOLDER_NAMES = ['Demo enquiry!', 'Job Support'];

export function normalizeCountry(phoneStr: string, geocoderCountry: string = ''): string {
  const cleaned = (phoneStr || '').replace(/[^\d+]/g, '');
  
  if (cleaned.startsWith('+91') || (cleaned.length === 10 && /^[6789]/.test(cleaned)) || (cleaned.length === 12 && cleaned.startsWith('91'))) {
    return 'India';
  }
  if (cleaned.startsWith('+1') || (cleaned.length === 11 && cleaned.startsWith('1'))) {
    return 'USA';
  }
  if (cleaned.startsWith('+44')) {
    return 'United Kingdom';
  }
  if (cleaned.startsWith('+971')) {
    return 'United Arab Emirates';
  }
  if (cleaned.startsWith('+966')) {
    return 'Saudi Arabia';
  }

  const geo = (geocoderCountry || '').trim().toLowerCase();
  if (!geo || geo === 'unknown' || geo === 'n/a') {
    return 'India';
  }

  if (['india', 'karnataka', 'gujarat', 'madhya pradesh', 'maharashtra', 'uttar pradesh', 'bangalore', 'mumbai'].some(kw => geo.includes(kw))) {
    return 'India';
  }
  if (['united states', 'usa', 'us', 'kansas', 'missouri', 'california', 'texas', 'new york'].some(kw => geo.includes(kw))) {
    return 'USA';
  }
  if (['canada', 'ontario', 'toronto'].some(kw => geo.includes(kw))) {
    return 'Canada';
  }

  return geocoderCountry.trim() || 'India';
}

export function parseEmailContent(body: string, subject: string, senderName: string, senderEmail: string, receivedDateTime: string, folderName?: string) {
  const cleanBody = (body || '').replace(/<[^>]*>/g, ' ');

  const nameMatch = cleanBody.match(/Name:\s*(.+?)(?:\r?\n|<|Email:|$)/i);
  const emailMatch = cleanBody.match(/Email:\s*(.+?)(?:\r?\n|<|Phone:|$)/i);
  const phoneMatch = cleanBody.match(/Phone(?:\s*Number)?:\s*(.+?)(?:\r?\n|<|Service|Time\s*Zone:|$)/i);
  const serviceMatch = cleanBody.match(/Service\s*(?:name|Type):\s*(.+?)(?:\r?\n|<|Custom|Training|Message:|$)/i);
  const answerMatch = cleanBody.match(/Answer\s*-\s*(.+?)(?:\r?\n|<|Internal|Additional|Learn\s*more:|$)/i);
  const trainingMatch = cleanBody.match(/Training\s*Type:\s*(.+?)(?:\r?\n|<|Message:|$)/i);
  const messageMatch = cleanBody.match(/Message:\s*(.+?)(?:\s*---|\r?\n|<|Submitted\s*at:|$)/i);
  const countryMatch = cleanBody.match(/Country:\s*(.+?)(?:\r?\n|<|$)/i);
  const submittedMatch = cleanBody.match(/Submitted\s*at:\s*(.+?)(?:\r?\n|<|$)/i);

  const name = nameMatch ? nameMatch[1].trim() : (senderName || 'Unknown');
  const emailAddr = emailMatch ? emailMatch[1].trim() : (senderEmail && senderEmail.includes('@') ? senderEmail : '');
  const phone = phoneMatch ? phoneMatch[1].trim() : '';
  const rawService = serviceMatch ? serviceMatch[1].trim() : '';
  const isJobSupport = (folderName && folderName.toLowerCase() === 'job support') ||
                       (subject && subject.toLowerCase().includes('job support')) ||
                       (rawService && rawService.toLowerCase().includes('job support'));
  const serviceType = isJobSupport ? 'Job Support' : (rawService || 'IT support & Training');
  const scmAnswer = answerMatch ? answerMatch[1].trim() : '';
  const trainingTypeRaw = scmAnswer || (trainingMatch ? trainingMatch[1].trim() : '');
  let messageRaw = messageMatch ? messageMatch[1].trim() : scmAnswer;
  const rawCountry = countryMatch ? countryMatch[1].trim() : 'India';
  const country = normalizeCountry(phone, rawCountry);

  if (messageRaw && messageRaw.includes('---')) {
    messageRaw = messageRaw.split('---')[0].trim();
  }

  let trainingType = trainingTypeRaw;
  const combinedText = `${trainingTypeRaw} ${messageRaw} ${subject}`.toLowerCase();

  if (combinedText.includes('active transportation') || combinedText.includes('transportation')) {
    trainingType = 'Manhattan Active Transportation';
  } else if (combinedText.includes('proactive')) {
    trainingType = 'Manhattan ProActive';
  } else if (combinedText.includes('manhattan active') || combinedText.includes('active wms')) {
    trainingType = 'Manhattan Active WMS';
  } else if (combinedText.includes('manhattan wms') || (combinedText.includes('manhattan') && combinedText.includes('wms'))) {
    trainingType = 'Manhattan WMS';
  } else if (combinedText.includes('blue yonder') || combinedText.includes('jda')) {
    trainingType = 'Blue Yonder WMS (JDA)';
  } else if (combinedText.includes('kinaxis')) {
    trainingType = 'Kinaxis';
  } else if (combinedText.includes('sap')) {
    trainingType = 'SAP S/4HANA';
  } else if (trainingTypeRaw && !['training', 'n/a', 'none', 'job support'].includes(trainingTypeRaw.toLowerCase())) {
    trainingType = trainingTypeRaw;
  } else if (messageRaw && !['n/a', 'none', 'job support'].includes(messageRaw.toLowerCase())) {
    trainingType = messageRaw;
  } else if (isJobSupport) {
    trainingType = 'Job Support';
  } else {
    trainingType = 'General Training';
  }

  const message = messageRaw || trainingType;
  const receivedDate = receivedDateTime ? new Date(receivedDateTime) : new Date();

  return {
    name,
    email: emailAddr,
    phone,
    serviceType,
    trainingType,
    topic: trainingType,
    message,
    country,
    dateSubmitted: submittedMatch ? submittedMatch[1].trim() : receivedDate.toISOString(),
    receivedDate,
  };
}

export async function getValidAccessToken(): Promise<{ accessToken: string; accountEmail: string; isAppToken?: boolean } | null> {
  // 1. Try DB integrationConfig delegated user token first
  const config = await prisma.integrationConfig.findUnique({
    where: { service: 'microsoft_graph' },
  });

  if (config && config.metadata) {
    try {
      const meta = JSON.parse(config.metadata);
      const { refreshToken, accessToken, expiresAt, accountEmail } = meta;

      // Check if token is still valid (with 5 min buffer)
      if (accessToken && expiresAt && Date.now() < expiresAt - 5 * 60 * 1000) {
        return { accessToken, accountEmail: accountEmail || TARGET_OUTLOOK_EMAIL, isAppToken: false };
      }

      if (refreshToken) {
        const clientId = process.env.MICROSOFT_CLIENT_ID;
        const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
        const tenantId = process.env.MICROSOFT_TENANT_ID || 'common';

        if (clientId && clientSecret) {
          const params = new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
            scope: 'openid profile email Mail.Read offline_access',
          });

          const tokenRes = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString(),
          });

          if (tokenRes.ok) {
            const tokenData = await tokenRes.json();
            const newAccessToken = tokenData.access_token;
            const newRefreshToken = tokenData.refresh_token || refreshToken;
            const newExpiresAt = Date.now() + (tokenData.expires_in || 3600) * 1000;

            const updatedMeta = {
              ...meta,
              accessToken: newAccessToken,
              refreshToken: newRefreshToken,
              expiresAt: newExpiresAt,
            };

            await prisma.integrationConfig.update({
              where: { service: 'microsoft_graph' },
              data: {
                connected: true,
                metadata: JSON.stringify(updatedMeta),
              },
            });

            return { accessToken: newAccessToken, accountEmail: accountEmail || TARGET_OUTLOOK_EMAIL, isAppToken: false };
          } else {
            const errText = await tokenRes.text();
            console.warn('Refresh token attempt failed:', errText);
          }
        }
      }
    } catch (err: any) {
      console.error('Error fetching/refreshing delegated user access token:', err.message);
    }
  }

  // 2. Azure AD Client Credentials fallback (App-only access with Mail.Read app permission for contact@gapanchor.com)
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  const tenantId = process.env.MICROSOFT_TENANT_ID;

  if (clientId && clientSecret && tenantId) {
    try {
      const params = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'client_credentials',
        scope: 'https://graph.microsoft.com/.default',
      });

      const appTokenRes = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });

      if (appTokenRes.ok) {
        const appTokenData = await appTokenRes.json();
        return { accessToken: appTokenData.access_token, accountEmail: TARGET_OUTLOOK_EMAIL, isAppToken: true };
      }
    } catch (appErr: any) {
      console.error('Azure AD Client Credentials token fetch error:', appErr.message);
    }
  }

  return null;
}

export async function syncOutlookGraphEnquiries() {
  const tokenInfo = await getValidAccessToken();
  if (!tokenInfo) {
    return {
      success: false,
      error: 'Microsoft Graph integration not connected. Please click "Setup APIs" -> "Connect Outlook" in the dashboard to authorize Azure AD for contact@gapanchor.com.',
      totalParsed: 0,
      insertedCount: 0,
      updatedCount: 0,
    };
  }

  const { accessToken, isAppToken, accountEmail } = tokenInfo;
  const client = createGraphClient(accessToken);
  const basePath = isAppToken ? `/users/${accountEmail}` : '/me';

  try {
    // 1. Fetch mail folders from contact@gapanchor.com mailbox
    let allMailFolders: any[] = [];
    try {
      const foldersRes = await client.api(`${basePath}/mailFolders`).top(100).get();
      allMailFolders = foldersRes.value || [];
    } catch (e) {
      console.warn('Could not list mail folders directly:', e);
    }

    let totalParsedCount = 0;
    let insertedCount = 0;
    let updatedCount = 0;

    const existingEnquiries = await prisma.enquiry.findMany();

    for (const targetFolderName of TARGET_FOLDER_NAMES) {
      let folder = allMailFolders.find(
        (f: any) => (f.displayName || '').toLowerCase() === targetFolderName.toLowerCase()
      );

      if (!folder) {
        try {
          const filterRes = await client
            .api(`${basePath}/mailFolders`)
            .filter(`displayName eq '${targetFolderName}'`)
            .get();
          folder = filterRes.value?.[0];
        } catch (e) {}
      }

      if (!folder) {
        console.warn(`Mail folder '${targetFolderName}' not found in ${accountEmail} mailbox.`);
        continue;
      }

      // Fetch messages in folder via Graph API (top 500)
      let rawMessages: any[] = [];
      try {
        const messagesRes = await client
          .api(`${basePath}/mailFolders/${folder.id}/messages`)
          .select('id,subject,from,receivedDateTime,bodyPreview,body')
          .orderby('receivedDateTime desc')
          .top(500)
          .get();

        rawMessages = messagesRes.value || [];
      } catch (msgErr: any) {
        console.warn(`Failed to fetch messages for folder ${targetFolderName}:`, msgErr.message);
      }

      totalParsedCount += rawMessages.length;

      for (const msg of rawMessages) {
        const bodyContent = msg.body?.content || msg.bodyPreview || '';
        const senderName = msg.from?.emailAddress?.name || '';
        const senderEmail = msg.from?.emailAddress?.address || '';

        const parsed = parseEmailContent(bodyContent, msg.subject || '', senderName, senderEmail, msg.receivedDateTime, targetFolderName);

        if (parsed.name === 'Unknown' && !parsed.email && !parsed.phone) {
          continue;
        }

        // Unique Message Deduplication check: match by Graph Message ID
        const existing = existingEnquiries.find(e => e.whatsappMessageId === msg.id);

        if (existing) {
          await prisma.enquiry.update({
            where: { id: existing.id },
            data: {
              participantName: parsed.name || existing.participantName,
              phone: parsed.phone || existing.phone,
              country: parsed.country || existing.country,
              serviceType: parsed.serviceType || existing.serviceType,
              trainingType: parsed.trainingType || existing.trainingType,
              topic: parsed.trainingType || existing.topic,
              lastMessage: parsed.message || existing.lastMessage,
              receivedDate: parsed.receivedDate,
              messageTimestamp: parsed.receivedDate,
              whatsappMessageId: msg.id,
              source: 'outlook',
            },
          });
          updatedCount++;
        } else {
          await prisma.enquiry.create({
            data: {
              participantName: parsed.name,
              email: parsed.email || null,
              phone: parsed.phone || '',
              country: parsed.country || 'India',
              serviceType: parsed.serviceType || (targetFolderName === 'Job Support' ? 'Job Support' : 'Training'),
              trainingType: parsed.trainingType || (targetFolderName === 'Job Support' ? 'Job Support' : 'General Training'),
              topic: parsed.trainingType || (targetFolderName === 'Job Support' ? 'Job Support' : 'General Training'),
              lastMessage: parsed.message,
              receivedDate: parsed.receivedDate,
              messageTimestamp: parsed.receivedDate,
              whatsappMessageId: msg.id,
              source: 'outlook',
              status: 'Open',
              leadQuality: parsed.trainingType.toLowerCase().includes('proactive') || targetFolderName === 'Job Support' ? 'High' : 'Unrated',
              contactStatus: 'Pending',
            },
          });
          insertedCount++;
        }
      }
    }

    // Update integration config while preserving existing OAuth tokens
    const existingConfig = await prisma.integrationConfig.findUnique({ where: { service: 'microsoft_graph' } });
    const existingMeta = existingConfig?.metadata ? JSON.parse(existingConfig.metadata) : {};

    const updatedMeta = {
      ...existingMeta,
      accountEmail: tokenInfo.accountEmail,
      totalParsed: totalParsedCount,
      insertedCount,
      updatedCount,
      lastSyncedAt: new Date().toISOString(),
    };

    await prisma.integrationConfig.upsert({
      where: { service: 'microsoft_graph' },
      create: {
        service: 'microsoft_graph',
        connected: true,
        lastSynced: new Date(),
        metadata: JSON.stringify(updatedMeta),
      },
      update: {
        connected: true,
        lastSynced: new Date(),
        metadata: JSON.stringify(updatedMeta),
      },
    });

    return {
      success: true,
      message: `Cloud Graph Sync completed for ${tokenInfo.accountEmail}: ${totalParsedCount} fetched (${insertedCount} new, ${updatedCount} updated)`,
      totalParsed: totalParsedCount,
      insertedCount,
      updatedCount,
    };
  } catch (err: any) {
    console.error('Error during Graph API sync:', err);
    return {
      success: false,
      error: err.message,
      totalParsed: 0,
      insertedCount: 0,
      updatedCount: 0,
    };
  }
}
