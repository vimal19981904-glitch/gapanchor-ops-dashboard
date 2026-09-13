import nodemailer from 'nodemailer';
import path from 'path';
import { spawn } from 'child_process';

export interface LeadEmailPayload {
  leadId: string;
  leadName: string;
  leadEmail?: string | null;
  leadPhone: string;
  country?: string | null;
  courseOrService?: string | null;
  leadQuality?: string | null;
  leadArrivalTime: string;
  slaBreachTime: string;
  alertTriggeredTime: string;
  timeInPendingFormatted: string;
  dateSubmittedOrCreated?: string;
  isFirstAlert: boolean;
  alertCount: number;
}

export function createSmtpTransporter() {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER || 'xavierarul40@gmail.com';
  const pass = process.env.SMTP_PASS || 'itsxavier7';

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass,
    },
    tls: {
      rejectUnauthorized: false,
    },
    connectionTimeout: 5000,
    socketTimeout: 5000,
  });
}

export function buildLeadAlertEmailHtml(payload: LeadEmailPayload): { subject: string; html: string; text: string } {
  const dashboardLink = process.env.NEXTAUTH_URL
    ? `${process.env.NEXTAUTH_URL}/enquiries`
    : 'http://localhost:3000/enquiries';

  const subject = payload.isFirstAlert
    ? `[URGENT] Lead Follow-up Required - ${payload.leadName} - 4h SLA Breached`
    : `[URGENT ALERT #${payload.alertCount}] Lead Follow-up Required - ${payload.leadName} - Still Pending (${payload.timeInPendingFormatted})`;

  // Plain clean layout: white background, crisp standard dark text, zero color except the button
  const html = `
<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    body { margin: 0 !important; padding: 0 !important; background-color: #ffffff !important; color: #111827 !important; font-family: Calibri, Arial, Helvetica, sans-serif !important; }
    table, td { border-collapse: collapse !important; mso-table-lspace: 0pt !important; mso-table-rspace: 0pt !important; }
  </style>
</head>
<body style="margin: 0; padding: 16px 20px; background-color: #ffffff; font-family: Calibri, Arial, Helvetica, sans-serif; color: #111827; font-size: 14px; line-height: 1.5;">

  <div style="max-width: 600px; margin: 0; background-color: #ffffff; color: #111827;">

    <!-- Heading -->
    <h2 style="margin: 0 0 12px 0; font-size: 18px; font-weight: bold; color: #111827; font-family: Calibri, Arial, Helvetica, sans-serif;">
      GapAnchor CRM Lead Inactivity Alert
    </h2>

    <!-- Lead Context -->
    <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #111827;">
      Hi Team,<br>
      A lead assigned to your queue requires immediate attention: <strong>${payload.leadName}</strong> has remained in <strong>Pending</strong> status for over 4 hours.
    </p>

    <!-- Details Section (Clean plain text table, no decorative background colors) -->
    <div style="margin: 16px 0; border-top: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; padding: 14px 0;">
      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 540px; font-size: 14px; font-family: Calibri, Arial, Helvetica, sans-serif;">
        <tr>
          <td style="padding: 4px 0; width: 170px; font-weight: bold; color: #374151;">Lead Name:</td>
          <td style="padding: 4px 0; color: #111827; font-weight: bold;">${payload.leadName}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; font-weight: bold; color: #374151;">Mobile Number:</td>
          <td style="padding: 4px 0; color: #111827;">${payload.leadPhone}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; font-weight: bold; color: #374151;">Email Address:</td>
          <td style="padding: 4px 0; color: #111827;">${payload.leadEmail || 'Not Provided'}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; font-weight: bold; color: #374151;">Course / Service:</td>
          <td style="padding: 4px 0; color: #111827;">${payload.courseOrService || 'Manhattan ProActive Training'}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; font-weight: bold; color: #374151;">Country / Territory:</td>
          <td style="padding: 4px 0; color: #111827;">${payload.country || 'India'}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; font-weight: bold; color: #374151;">Lead Quality:</td>
          <td style="padding: 4px 0; color: #111827;">${payload.leadQuality || 'High Quality'}</td>
        </tr>
        <tr>
          <td colspan="2" style="padding: 8px 0;">
            <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 0;">
          </td>
        </tr>
        <tr>
          <td style="padding: 4px 0; font-weight: bold; color: #374151;">Lead Arrival Time:</td>
          <td style="padding: 4px 0; color: #111827;">${payload.leadArrivalTime}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; font-weight: bold; color: #374151;">4-Hour SLA Breach:</td>
          <td style="padding: 4px 0; color: #111827;">${payload.slaBreachTime}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; font-weight: bold; color: #374151;">Alert Dispatched At:</td>
          <td style="padding: 4px 0; color: #111827;">${payload.alertTriggeredTime}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; font-weight: bold; color: #374151;">Total Inactivity:</td>
          <td style="padding: 4px 0; color: #111827; font-weight: bold;">${payload.timeInPendingFormatted}</td>
        </tr>
      </table>
    </div>

    <!-- THE SINGLE COLORED ELEMENT: The Button -->
    <div style="margin: 24px 0 16px 0;">
      <!--[if mso]>
      <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${dashboardLink}" style="height:46px;v-text-anchor:middle;width:350px;" arcsize="12%" strokecolor="#059669" fillcolor="#10b981">
        <w:anchorlock/>
        <center style="color:#ffffff;font-family:Calibri,Arial,sans-serif;font-size:14px;font-weight:bold;">
          OPEN CRM DASHBOARD & UPDATE STATUS
        </center>
      </v:roundrect>
      <![endif]-->
      <!--[if !mso]><!-->
      <a href="${dashboardLink}" target="_blank" style="display: inline-block; padding: 13px 26px; background-color: #10b981; color: #ffffff; text-decoration: none; font-family: Calibri, Arial, sans-serif; font-size: 14px; font-weight: bold; border-radius: 6px; text-transform: uppercase; letter-spacing: 0.5px;">
        OPEN CRM DASHBOARD &amp; UPDATE STATUS
      </a>
      <!--<![endif]-->
    </div>

    <!-- Plain direct link fallback -->
    <p style="margin: 16px 0 0 0; font-size: 12px; color: #6b7280; font-family: Calibri, Arial, sans-serif;">
      Direct CRM link: <a href="${dashboardLink}" style="color: #2563eb;">${dashboardLink}</a>
    </p>

    <!-- Footer -->
    <p style="margin: 20px 0 0 0; font-size: 11px; color: #9ca3af; font-family: Calibri, Arial, sans-serif; border-top: 1px solid #f3f4f6; padding-top: 12px;">
      GapAnchor CRM • Automated Lead Monitoring System • High Importance Notification
    </p>

  </div>

</body>
</html>
  `;

  const text = `
GapAnchor CRM Lead Inactivity Alert (High Importance)

Hi Team,
A lead assigned to your queue requires immediate attention: ${payload.leadName} has remained in Pending status for over 4 hours.

LEAD DETAILS:
- Lead Name: ${payload.leadName}
- Mobile Number: ${payload.leadPhone}
- Email Address: ${payload.leadEmail || 'Not Provided'}
- Course / Service: ${payload.courseOrService || 'Manhattan ProActive Training'}
- Country / Territory: ${payload.country || 'India'}
- Lead Quality: ${payload.leadQuality || 'High Quality'}

SLA & TIMING METRICS:
- Lead Arrival Time: ${payload.leadArrivalTime}
- 4-Hour SLA Breach: ${payload.slaBreachTime}
- Alert Dispatched At: ${payload.alertTriggeredTime}
- Total Inactivity: ${payload.timeInPendingFormatted}

ACTION REQUIRED:
Open the CRM Dashboard to update this lead's status:
${dashboardLink}
  `;

  return { subject, html, text };
}

export async function sendLeadAlertEmail(
  payload: LeadEmailPayload,
  maxRetries = 3
): Promise<{ success: boolean; error?: string; attempts: number; previewUrl?: string; note?: string }> {
  const defaultTarget = process.env.ALERT_EMAIL_RECIPIENT || 'avpartners.consultants@outlook.com';
  const recipients = [defaultTarget];
  const { subject, html, text } = buildLeadAlertEmailHtml(payload);

  // Strategy 1: Local Outlook Desktop MAPI Client (Direct Real Mailbox Dispatch with High Importance)
  try {
    const scriptPath = path.resolve(process.cwd(), 'scripts', 'send_outlook_alert.py');

    for (const recipient of recipients) {
      await new Promise<void>((resolve, reject) => {
        const proc = spawn('python', [scriptPath], {
          stdio: ['pipe', 'pipe', 'pipe'],
        });

        let stdoutData = '';
        let stderrData = '';

        proc.stdout.on('data', (d) => {
          stdoutData += d.toString();
        });

        proc.stderr.on('data', (d) => {
          stderrData += d.toString();
        });

        proc.on('close', (code) => {
          if (code !== 0) {
            console.warn(`Outlook Desktop warning (exit code ${code}):`, stderrData);
          }
          try {
            const parsed = JSON.parse(stdoutData.trim());
            if (parsed.success) {
              console.log(`✅ [Outlook Desktop] High-importance alert email sent to ${recipient}`);
              return resolve();
            } else {
              return reject(new Error(parsed.error || 'Outlook dispatch failed'));
            }
          } catch {
            if (code === 0) return resolve();
            return reject(new Error(stderrData || stdoutData || 'Outlook dispatch failed'));
          }
        });

        // Send JSON payload via stdin
        const inputJson = JSON.stringify({
          to: recipient,
          subject,
          html,
        });

        proc.stdin.write(inputJson);
        proc.stdin.end();
      });
    }

    return { success: true, attempts: 1, note: 'Dispatched via Microsoft Outlook Desktop client (High Importance)' };
  } catch (outlookErr: any) {
    console.warn('Outlook Desktop dispatch fell back:', outlookErr.message);
  }

  // Strategy 2: Standard SMTP Transporter (with High Importance Headers)
  const transporter = createSmtpTransporter();
  const senderUser = process.env.SMTP_USER || 'xavierarul40@gmail.com';
  let attempts = 0;
  let lastError = '';

  while (attempts < maxRetries) {
    attempts++;
    try {
      await transporter.sendMail({
        from: `"GapAnchor Lead Monitor" <${senderUser}>`,
        to: recipients.join(', '),
        subject,
        html,
        text,
        priority: 'high',
        headers: {
          'X-Priority': '1 (Highest)',
          'X-MSMail-Priority': 'High',
          'Importance': 'High',
        },
      });

      console.log(`✅ High-importance lead alert email sent via SMTP to [${recipients.join(', ')}] on attempt ${attempts}`);
      return { success: true, attempts, note: 'Dispatched via SMTP (High Importance)' };
    } catch (err: any) {
      lastError = err.message || String(err);
      console.warn(`SMTP send attempt ${attempts} failed: ${lastError}`);
      if (attempts < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, attempts * 1000));
      }
    }
  }

  // Strategy 3: Ethereal fallback for dev/test preview
  try {
    const testAccount = await nodemailer.createTestAccount();
    const etherealTransporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });

    const info = await etherealTransporter.sendMail({
      from: `"GapAnchor Lead Monitor" <${testAccount.user}>`,
      to: recipients.join(', '),
      subject,
      html,
      text,
      priority: 'high',
      headers: {
        'X-Priority': '1 (Highest)',
        'X-MSMail-Priority': 'High',
        'Importance': 'High',
      },
    });

    const previewUrl = nodemailer.getTestMessageUrl(info) || undefined;
    return {
      success: true,
      attempts: attempts + 1,
      previewUrl,
      note: `Dispatched via Ethereal Email Preview: ${previewUrl}`,
    };
  } catch (etherealErr: any) {
    console.warn('Ethereal fallback failed:', etherealErr.message);
  }

  return { success: false, error: lastError, attempts };
}
