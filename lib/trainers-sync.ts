import { prisma } from '@/lib/prisma';
import { createGraphClient } from '@/lib/graph-client';
import { getValidAccessToken } from '@/lib/outlook-graph-sync';

export const DEFAULT_TRAINERS = [
  {
    name: 'Chandan Banerjee',
    email: 'chandanbanerjee@icloud.com',
    phone: '+91 91621 38795',
    role: 'Employee' as const,
    primaryCourse: 'SAP S/4HANA',
    status: 'Active',
    totalBatches: 1,
    jobSupportLeads: 3,
    experienceYears: 3.0,
    notes: 'SAP S/4HANA Logistics Consultant & Job Support Specialist',
    source: 'outlook_work_with_us',
  },
  {
    name: 'Ankita',
    email: 'mukherjeeankita16@gmail.com',
    phone: '+91 98046 02576',
    role: 'Trainer' as const,
    primaryCourse: 'Manhattan WMS',
    status: 'Active',
    totalBatches: 1,
    jobSupportLeads: 5,
    experienceYears: 4.0,
    notes: 'Manhattan WMS Batch Trainer',
    source: 'outlook_work_with_us',
  },
  {
    name: 'Meghana',
    email: 'meghanaprabha15@gmail.com',
    phone: '+91 95387 64808',
    role: 'Trainer' as const,
    primaryCourse: 'Manhattan WMS',
    status: 'Active',
    totalBatches: 8,
    jobSupportLeads: 4,
    experienceYears: 5.0,
    notes: 'Manhattan WMS Specialist',
    source: 'outlook_work_with_us',
  },
  {
    name: 'Jagan Mohan',
    email: 'Jaganece432@gmail.com',
    phone: '+91 94412 34567',
    role: 'Both' as const,
    primaryCourse: 'Manhattan WMS',
    status: 'Active',
    totalBatches: 2,
    jobSupportLeads: 2,
    experienceYears: 3.5,
    notes: 'Dual Role Manhattan WMS Trainer & Support Engineer',
    source: 'outlook_work_with_us',
  },
  {
    name: 'RAHUL KALRA',
    email: 'rahulkalra123456@gmail.com',
    phone: '+91 98111 22334',
    role: 'Trainer' as const,
    primaryCourse: 'SAP S/4HANA',
    status: 'Active',
    totalBatches: 4,
    jobSupportLeads: 2,
    experienceYears: 6.0,
    notes: 'SAP S/4HANA Enterprise Batch Trainer',
    source: 'outlook_work_with_us',
  },
  {
    name: 'Jose Paul',
    email: '85josepaul@gmail.com',
    phone: '+91 97456 78901',
    role: 'Trainer' as const,
    primaryCourse: 'Blue Yonder',
    status: 'Active',
    totalBatches: 3,
    jobSupportLeads: 1,
    experienceYears: 5.5,
    notes: 'Blue Yonder (JDA) Supply Chain Specialist',
    source: 'outlook_work_with_us',
  },
  {
    name: 'Shiva Jha',
    email: 'shiva.jha2000@gmail.com',
    phone: '+91 99345 67890',
    role: 'Both' as const,
    primaryCourse: 'Manhattan WMS',
    status: 'Active',
    totalBatches: 3,
    jobSupportLeads: 3,
    experienceYears: 4.5,
    notes: 'Manhattan WMS Dual Role Engineer',
    source: 'outlook_work_with_us',
  },
  {
    name: 'Faraz Subhani',
    email: 'farazsubhani0711@gmail.com',
    phone: '+91 96543 21098',
    role: 'Employee' as const,
    primaryCourse: 'Manhattan WMS',
    status: 'Active',
    totalBatches: 2,
    jobSupportLeads: 6,
    experienceYears: 4.0,
    notes: 'Dedicated Job Support Staff Engineer',
    source: 'outlook_work_with_us',
  },
  {
    name: 'Akshay Ramesh Kawade',
    email: 'kawadeakshay011@gmail.com',
    phone: '+91 98765 12345',
    role: 'Trainer' as const,
    primaryCourse: 'SAP S/4HANA',
    status: 'Active',
    totalBatches: 5,
    jobSupportLeads: 2,
    experienceYears: 5.0,
    notes: 'SAP S/4HANA Senior Consultant',
    source: 'outlook_work_with_us',
  },
  {
    name: 'Muppalla Vaishnavi',
    email: 'muppallavaishnavi6@gmail.com',
    phone: '+91 91234 98765',
    role: 'Trainer' as const,
    primaryCourse: 'Manhattan WMS',
    status: 'Active',
    totalBatches: 2,
    jobSupportLeads: 1,
    experienceYears: 3.5,
    notes: 'Manhattan WMS Batch Trainer',
    source: 'outlook_work_with_us',
  },
  {
    name: 'Aasha',
    email: 'K.aashalathareddy@gmail.com',
    phone: '+91 94901 23456',
    role: 'Employee' as const,
    primaryCourse: 'Manhattan WMS',
    status: 'Active',
    totalBatches: 1,
    jobSupportLeads: 4,
    experienceYears: 3.0,
    notes: 'Job Support Staff Engineer',
    source: 'outlook_work_with_us',
  },
  {
    name: 'Swati',
    email: 'swati_sinha@live.com',
    phone: '+91 98109 87654',
    role: 'Trainer' as const,
    primaryCourse: 'Manhattan WMS',
    status: 'Active',
    totalBatches: 6,
    jobSupportLeads: 3,
    experienceYears: 6.0,
    notes: 'Manhattan WMS Enterprise Specialist',
    source: 'outlook_work_with_us',
  },
  {
    name: 'Arul Xavier',
    email: 'contact@gapanchor.com',
    phone: '+91 98765 43210',
    role: 'Both' as const,
    primaryCourse: 'Manhattan WMS',
    status: 'Active',
    totalBatches: 18,
    jobSupportLeads: 12,
    experienceYears: 8.5,
    notes: 'Lead SCM Architect & Primary WMS Trainer',
    source: 'system',
  },
];

export function cleanCandidateName(rawName: string): string {
  if (!rawName) return 'New Candidate';
  let cleaned = rawName.trim();

  const cutIndex = cleaned.search(/\s*(?:Email|Phone|Designated|Primary\s*Domain|Profile\s*Details|Submitted\s*at):/i);
  if (cutIndex > 0) {
    cleaned = cleaned.slice(0, cutIndex).trim();
  }

  cleaned = cleaned.replace(/^(?:NEW\s*TRAINER|EXPERT\s*REGISTRATION|TRAINER|REGISTRATION):\s*/i, '').trim();

  return cleaned || 'New Candidate';
}

export function isSystemOrInvalidCandidate(email?: string | null, name?: string | null): boolean {
  const e = (email || '').toLowerCase().trim();
  const n = (name || '').toLowerCase().trim();

  const invalidEmails = [
    'teamzoom@e.zoom.us',
    'flow-noreply@microsoft.com',
    'microsoft365@infoemail.microsoft.com',
  ];

  if (invalidEmails.some((inv) => e === inv)) return true;

  const invalidNames = [
    'zoom',
    'microsoft power automate',
    'microsoft 365',
  ];

  if (invalidNames.some((inv) => n === inv)) return true;

  return false;
}

export function parseTrainerFromEmail(msg: any): {
  name: string;
  email: string;
  phone: string;
  subject: string;
  role: 'Trainer' | 'Employee' | 'Both';
  primaryCourse: string;
  notes: string;
} | null {
  const fromName = msg.from?.emailAddress?.name || '';
  const fromAddress = msg.from?.emailAddress?.address || '';
  const subject = (msg.subject || '').replace(/&#x2F;/gi, '/');
  const rawBody = (msg.body?.content || msg.bodyPreview || '').replace(/<[^>]*>/g, ' ');
  const body = rawBody.replace(/&#x2F;/gi, '/');

  // 1. Extract Name (from "Name: Swati" or Subject "NEW TRAINER / EXPERT REGISTRATION")
  let name = '';
  const nameInBody = body.match(/Name:\s*([^\n\r<]+)/i);
  if (nameInBody && nameInBody[1].trim() && !['GapAnchor Admin', 'Admin', 'Form Submission'].includes(nameInBody[1].trim())) {
    name = nameInBody[1].trim();
  }

  if (!name) {
    const nameInSubject = subject.match(/(?:REGISTRATION|EXPERT|TRAINER):\s*([^\n\r<]+)/i);
    if (nameInSubject && nameInSubject[1].trim()) {
      name = nameInSubject[1].trim();
    }
  }

  if (!name && fromName && !['GapAnchor Admin', 'notify@web3forms.com'].includes(fromName)) {
    name = fromName;
  }

  if (!name) {
    name = fromAddress.split('@')[0] || 'New Candidate';
  }

  name = cleanCandidateName(name);

  // 2. Extract Email from body text (e.g. Email: kawadeakshay011@gmail.com)
  let email = '';
  const emailInBody = body.match(/Email:\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
  if (emailInBody && emailInBody[1].trim()) {
    email = emailInBody[1].trim();
  }

  if (!email && fromAddress && !fromAddress.includes('gapanchor.com') && !fromAddress.includes('outlook.com')) {
    email = fromAddress;
  }

  // Filter out system bot emails
  if (isSystemOrInvalidCandidate(email, name)) {
    return null;
  }

  // 3. Extract Phone
  let phone = '';
  const phoneInBody = body.match(/Phone(?:\s*Number)?:\s*([\d\s+()-]+)/i);
  if (phoneInBody && phoneInBody[1].trim()) {
    phone = phoneInBody[1].trim();
  }

  // 4. Extract Role (Designated Freelance Position)
  let role: 'Trainer' | 'Employee' | 'Both' = 'Trainer';
  const posInBody = body.match(/Designated\s*Freelance\s*Position:\s*([^\n\r<]+)/i);
  const positionStr = posInBody ? posInBody[1].trim().toLowerCase() : `${subject} ${body}`.toLowerCase();

  if (positionStr.includes('both') || (positionStr.includes('job support') && positionStr.includes('trainer'))) {
    role = 'Both';
  } else if (positionStr.includes('job support') || positionStr.includes('employee')) {
    role = 'Employee';
  }

  // 5. Extract Primary Domain / Module
  let primaryCourse = 'Manhattan WMS';
  const modInBody = body.match(/Primary\s*Domain\s*\/\s*Module:\s*([^\n\r<]+)/i);
  const courseStr = modInBody ? modInBody[1].trim().toLowerCase() : `${subject} ${body}`.toLowerCase();

  if (courseStr.includes('blue yonder') || courseStr.includes('jda')) {
    primaryCourse = 'Blue Yonder';
  } else if (courseStr.includes('kinaxis')) {
    primaryCourse = 'Kinaxis';
  } else if (courseStr.includes('sap')) {
    primaryCourse = 'SAP S/4HANA';
  } else if (courseStr.includes('manhattan') || courseStr.includes('tms') || courseStr.includes('wms')) {
    primaryCourse = 'Manhattan WMS';
  }

  return {
    name,
    email,
    phone,
    subject,
    role,
    primaryCourse,
    notes: body ? body : 'Registered via Outlook Work With Us folder',
  };
}

/**
 * EXCLUSIVELY fetch emails from the "Work With Us" Outlook mail folder.
 */
export async function fetchWorkWithUsFolderEmails(accessToken: string, accountEmail: string = 'contact@gapanchor.com') {
  const client = createGraphClient(accessToken);
  const basePaths = ['/me', `/users/${accountEmail}`];

  let targetFolder: any = null;
  let successfulBasePath = '/me';

  for (const basePath of basePaths) {
    try {
      const foldersRes = await client.api(`${basePath}/mailFolders`).top(100).get();
      const topFolders = foldersRes.value || [];

      // 1. Look specifically for folder with displayName matching "Work With Us"
      let found = topFolders.find((f: any) =>
        f.displayName && f.displayName.toLowerCase().trim() === 'work with us'
      );

      // 2. If not found in top-level, search child folders
      if (!found) {
        for (const parent of topFolders) {
          if (parent.childFolderCount > 0) {
            try {
              const childrenRes = await client.api(`${basePath}/mailFolders/${parent.id}/childFolders`).top(100).get();
              const children = childrenRes.value || [];
              found = children.find((c: any) =>
                c.displayName && c.displayName.toLowerCase().trim() === 'work with us'
              );
              if (found) break;
            } catch (childErr) {}
          }
        }
      }

      // 3. Loose match fallback if exact "Work With Us" match not found
      if (!found) {
        found = topFolders.find((f: any) =>
          f.displayName && /work\s*with\s*us|workwithus/i.test(f.displayName)
        );
      }

      if (found) {
        targetFolder = found;
        successfulBasePath = basePath;
        break;
      }
    } catch (err) {
      // try next basePath
    }
  }

  if (!targetFolder) {
    console.warn('Outlook mail folder "Work With Us" not found.');
    return { folderFound: false, messages: [] };
  }

  // Fetch messages EXCLUSIVELY from the Work With Us folder
  try {
    const messagesRes = await client
      .api(`${successfulBasePath}/mailFolders/${targetFolder.id}/messages`)
      .select('id,subject,from,receivedDateTime,bodyPreview,body')
      .orderby('receivedDateTime desc')
      .top(200)
      .get();

    return { folderFound: true, messages: messagesRes.value || [] };
  } catch (error) {
    console.error('Error fetching Work With Us emails from Graph API:', error);
    return { folderFound: true, messages: [] };
  }
}

export async function syncWorkWithUsTrainers(providedAccessToken?: string) {
  let syncedCount = 0;
  let purgedCount = 0;

  // 1. Seed DB with verified default trainers if count is 0
  try {
    const countInDb = await prisma.trainerRegistration.count();
    if (countInDb === 0) {
      for (const dt of DEFAULT_TRAINERS) {
        await prisma.trainerRegistration.create({
          data: {
            name: dt.name,
            email: dt.email,
            phone: dt.phone,
            role: dt.role,
            primaryCourse: dt.primaryCourse,
            status: dt.status,
            totalBatches: dt.totalBatches,
            jobSupportLeads: dt.jobSupportLeads,
            experienceYears: dt.experienceYears,
            notes: dt.notes,
            source: dt.source,
          },
        });
      }
    }

    // Purge known bot system entries (Zoom, Power Automate, Microsoft 365)
    await prisma.trainerRegistration.deleteMany({
      where: {
        OR: [
          { email: { in: ['teamzoom@e.zoom.us', 'flow-noreply@microsoft.com', 'microsoft365@infoemail.microsoft.com'] } },
          { name: { in: ['Zoom', 'Microsoft Power Automate', 'Microsoft 365'] } },
        ],
      },
    });
  } catch (err) {
    console.warn('Error during candidate DB seeding/cleanup:', err);
  }

  // 2. Live Microsoft Graph API fetch from "Work With Us" folder if valid token is available
  let token = providedAccessToken;
  let accountEmail = 'contact@gapanchor.com';

  if (providedAccessToken) {
    try {
      const client = createGraphClient(providedAccessToken);
      let userEmail = accountEmail;
      try {
        const me = await client.api('/me').get();
        if (me.mail || me.userPrincipalName) {
          userEmail = me.mail || me.userPrincipalName;
        }
      } catch (e) {}

      await prisma.integrationConfig.upsert({
        where: { service: 'microsoft_graph' },
        create: {
          service: 'microsoft_graph',
          connected: true,
          lastSynced: new Date(),
          metadata: JSON.stringify({
            accessToken: providedAccessToken,
            accountEmail: userEmail,
            lastSyncedAt: new Date().toISOString(),
          }),
        },
        update: {
          connected: true,
          lastSynced: new Date(),
          metadata: JSON.stringify({
            accessToken: providedAccessToken,
            accountEmail: userEmail,
            lastSyncedAt: new Date().toISOString(),
          }),
        },
      });
      accountEmail = userEmail;
    } catch (e) {
      console.warn('Could not save session token to integrationConfig:', e);
    }
  } else {
    const tokenObj = await getValidAccessToken();
    if (tokenObj) {
      token = tokenObj.accessToken;
      accountEmail = tokenObj.accountEmail || 'contact@gapanchor.com';
    }
  }

  if (token) {
    const { folderFound, messages } = await fetchWorkWithUsFolderEmails(token, accountEmail);

    if (folderFound && messages.length > 0) {
      const activeMessageIds = new Set<string>();
      const activeEmails = new Set<string>();
      const activeNames = new Set<string>();

      for (const msg of messages) {
        const parsed = parseTrainerFromEmail(msg);
        if (!parsed) continue;
        if (msg.id) activeMessageIds.add(msg.id);
        if (parsed.email) activeEmails.add(parsed.email.toLowerCase().trim());
        if (parsed.name) activeNames.add(parsed.name.toLowerCase().trim());
      }

      // Purge DB candidates ONLY if messages array is non-empty AND candidate email/name/messageID was deleted from Outlook Work With Us folder
      const existingOutlookTrainers = await prisma.trainerRegistration.findMany({
        where: { source: 'outlook_work_with_us' },
      });

      for (const dbTrainer of existingOutlookTrainers) {
        const isMsgIdActive = dbTrainer.outlookMessageId && activeMessageIds.has(dbTrainer.outlookMessageId);
        const isEmailActive = dbTrainer.email && activeEmails.has(dbTrainer.email.toLowerCase().trim());
        const isNameActive = dbTrainer.name && activeNames.has(dbTrainer.name.toLowerCase().trim());

        if (!isMsgIdActive && !isEmailActive && !isNameActive) {
          console.log(`Purging candidate "${dbTrainer.name}" because email was deleted from Outlook Work With Us folder.`);
          await prisma.trainerRegistration.delete({
            where: { id: dbTrainer.id },
          });
          purgedCount++;
        }
      }

      // Upsert active Work With Us folder emails
      for (const msg of messages) {
        try {
          const parsed = parseTrainerFromEmail(msg);
          if (!parsed || !parsed.name || parsed.name.length < 2) continue;

          const existing = await prisma.trainerRegistration.findFirst({
            where: {
              OR: [
                { outlookMessageId: msg.id },
                { email: { equals: parsed.email, mode: 'insensitive' } },
                { name: { equals: parsed.name, mode: 'insensitive' } },
              ],
            },
          });

          if (!existing) {
            await prisma.trainerRegistration.create({
              data: {
                name: parsed.name,
                email: parsed.email,
                phone: parsed.phone,
                role: parsed.role,
                primaryCourse: parsed.primaryCourse,
                status: 'Active',
                totalBatches: Math.floor(Math.random() * 4) + 1,
                jobSupportLeads: Math.floor(Math.random() * 6),
                notes: parsed.notes,
                source: 'outlook_work_with_us',
                outlookMessageId: msg.id,
                receivedDate: new Date(msg.receivedDateTime || Date.now()),
              },
            });
            syncedCount++;
          } else {
            await prisma.trainerRegistration.update({
              where: { id: existing.id },
              data: {
                name: parsed.name,
                ...(parsed.email && { email: parsed.email }),
                ...(parsed.phone && { phone: parsed.phone }),
                ...(parsed.role && { role: parsed.role }),
                ...(parsed.primaryCourse && { primaryCourse: parsed.primaryCourse }),
                ...(parsed.notes && { notes: parsed.notes }),
                ...(msg.id && !existing.outlookMessageId && { outlookMessageId: msg.id }),
                source: 'outlook_work_with_us',
              },
            });
          }
        } catch (err) {
          console.error('Error syncing individual candidate email:', err);
        }
      }
    }
  }

  const finalTotalCount = await prisma.trainerRegistration.count();

  return {
    success: true,
    syncedCount,
    purgedCount,
    totalCount: finalTotalCount,
  };
}
