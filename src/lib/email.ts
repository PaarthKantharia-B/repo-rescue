import nodemailer from 'nodemailer';

export interface FounderFeedbackPayload {
  category?: string;
  message: string;
  email?: string;
  githubUsername?: string;
  timestamp: string;
}

export async function sendFounderFeedbackEmail(
  payload: FounderFeedbackPayload
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  // Destination address is strictly maintained server-side and never exposed to the client
  const destinationEmail = process.env.FOUNDER_EMAIL || 'themidnightcompanion@gmail.com';

  const categoryText = payload.category && payload.category.trim() ? payload.category.trim() : 'Something else';
  const subject = payload.category && payload.category.trim()
    ? `[Repo Rescue] Founder Feedback — ${payload.category.trim()}`
    : `[Repo Rescue] Message for the Founder`;

  const userEmailText = payload.email && payload.email.trim() ? payload.email.trim() : 'Not provided (Anonymous)';
  const githubUserText = payload.githubUsername && payload.githubUsername.trim() ? `@${payload.githubUsername.trim()}` : 'Not authenticated';

  const plainText = `
New Founder Feedback Received via Repo Rescue

Category: ${categoryText}
Sender Email: ${userEmailText}
GitHub User: ${githubUserText}
Submitted At: ${payload.timestamp}

--------------------------------------------------
MESSAGE:
--------------------------------------------------
${payload.message}
--------------------------------------------------
`;

  const htmlText = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b; background-color: #f8fafc; padding: 20px; }
    .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    .header { background: #0f172a; color: #f8fafc; padding: 24px; text-align: left; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 700; font-family: monospace; letter-spacing: -0.5px; }
    .header span { color: #3b82f6; }
    .meta { padding: 20px 24px; background: #f1f5f9; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
    .meta-item { margin-bottom: 8px; }
    .meta-item:last-child { margin-bottom: 0; }
    .meta-label { font-weight: 600; color: #64748b; width: 120px; display: inline-block; }
    .content { padding: 24px; font-size: 15px; white-space: pre-wrap; word-break: break-word; color: #0f172a; }
    .footer { padding: 16px 24px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>REPO<span>RESCUE</span> — Founder Message</h1>
    </div>
    <div class="meta">
      <div class="meta-item"><span class="meta-label">Category:</span> <strong>${escapeHtml(categoryText)}</strong></div>
      <div class="meta-item"><span class="meta-label">Sender Email:</span> <strong>${escapeHtml(userEmailText)}</strong></div>
      <div class="meta-item"><span class="meta-label">GitHub User:</span> <strong>${escapeHtml(githubUserText)}</strong></div>
      <div class="meta-item"><span class="meta-label">Submitted At:</span> ${escapeHtml(payload.timestamp)}</div>
    </div>
    <div class="content">${escapeHtml(payload.message)}</div>
    <div class="footer">
      Sent securely via Repo Rescue Server
    </div>
  </div>
</body>
</html>
`;

  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS || process.env.SMTP_PASSWORD;
  const resendApiKey = process.env.RESEND_API_KEY;

  const replyTo = payload.email && payload.email.trim() ? payload.email.trim() : undefined;
  const fromAddress = process.env.SMTP_FROM || `"Repo Rescue Feedback" <noreply@reporescue.com>`;

  if (smtpHost && smtpUser && smtpPass) {
    console.log(`[Founder Feedback Email] Provider Selected: SMTP (${smtpHost}:${smtpPort}) | To: ${destinationEmail}`);
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: process.env.SMTP_SECURE === 'true' || smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      const info = await transporter.sendMail({
        from: fromAddress,
        to: destinationEmail,
        replyTo,
        subject,
        text: plainText,
        html: htmlText,
      });

      console.log(`[Founder Feedback Email] SMTP Dispatch SUCCESS | MessageID: ${info.messageId} | Response: ${info.response || 'OK'}`);
      return { success: true, messageId: info.messageId };
    } catch (err: any) {
      console.error(`[Founder Feedback Email] SMTP Dispatch FAILED | Code: ${err.code || 'UNKNOWN'} | Error: ${err.message}`);
      return { success: false, error: err.message || 'SMTP Email delivery failed' };
    }
  } else if (resendApiKey) {
    console.log(`[Founder Feedback Email] Provider Selected: RESEND API | To: ${destinationEmail}`);
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromAddress,
          to: [destinationEmail],
          reply_to: replyTo,
          subject,
          text: plainText,
          html: htmlText,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const statusMsg = errData.message || `HTTP ${res.status} ${res.statusText}`;
        console.error(`[Founder Feedback Email] Resend API FAILED | Status: ${res.status} | Details: ${statusMsg}`);
        throw new Error(statusMsg);
      }

      const data = await res.json();
      console.log(`[Founder Feedback Email] Resend Dispatch SUCCESS | MessageID: ${data.id}`);
      return { success: true, messageId: data.id };
    } catch (err: any) {
      console.error(`[Founder Feedback Email] Resend Dispatch FAILED | Error: ${err.message}`);
      return { success: false, error: err.message || 'Resend Email delivery failed' };
    }
  } else {
    // Development fallback when no live SMTP or Resend credentials are set in environment
    console.warn(`[Founder Feedback Email] Provider Selected: DEV_SIMULATED (⚠️  NO LIVE SMTP OR RESEND CREDENTIALS FOUND IN .ENV)`);
    console.log('==================================================');
    console.log('✉️  FOUNDER FEEDBACK RECEIVED (DEV / NO SMTP CONFIG)');
    console.log(`Destination : ${destinationEmail}`);
    console.log(`Subject     : ${subject}`);
    console.log(`Reply-To    : ${replyTo || 'None (Anonymous)'}`);
    console.log(`Category    : ${categoryText}`);
    console.log(`GitHub      : ${githubUserText}`);
    console.log(`Email       : ${userEmailText}`);
    console.log('Message     :');
    console.log(payload.message);
    console.log('==================================================\n');

    return { success: true, messageId: `dev-simulated-${Date.now()}` };
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
