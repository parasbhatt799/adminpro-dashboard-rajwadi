import nodemailer from 'nodemailer';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { to, subject, text, html } = req.body;

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 465);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const fromEmail = process.env.SMTP_FROM;
  const fromName = process.env.SMTP_FROM_NAME || "UsePay";

  // 1. Try Nodemailer SMTP as primary
  if (host && user && pass) {
    console.log(`[Vercel SMTP] Sending email to ${to} (Subject: ${subject}) via ${host}...`);
    try {
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: {
          user,
          pass
        },
        tls: {
          rejectUnauthorized: false
        },
        connectionTimeout: 8000,
        greetingTimeout: 8000,
        socketTimeout: 10000
      });

      const info = await transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to,
        subject,
        text,
        html
      });

      console.log(`[Vercel SMTP] Email sent successfully to ${to}, MessageID: ${info.messageId}`);
      return res.status(200).json({ success: true });
    } catch (smtpErr: any) {
      console.error(`[Vercel SMTP] Failed to send email via ${host}:`, smtpErr.message);
      console.warn("[Vercel SMTP] Falling back to Resend API...");
    }
  }

  // 2. Fallback to Resend API
  const apiKey = process.env.RESEND_API_KEY || "re_G9Ldd9PN_FUesjTAdNB2Y6gzSvtV3SoQQ";
  const resendFromEmail = process.env.SMTP_FROM || "onboarding@resend.dev";
  const resendFromName = process.env.SMTP_FROM_NAME || "UsePay";

  console.log(`[Vercel Resend] Sending email to ${to} (Subject: ${subject})...`);

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: `"${resendFromName}" <${resendFromEmail}>`,
        to,
        subject,
        text,
        html
      })
    });

    const data: any = await response.json();
    if (response.ok) {
      console.log(`[Vercel Resend] Email sent successfully to ${to}, ID: ${data.id}`);
      return res.status(200).json({ success: true, id: data.id });
    }
    
    const errMsg = data?.message || "";
    if (response.status === 403 || errMsg.toLowerCase().includes("verify") || errMsg.toLowerCase().includes("domain") || errMsg.toLowerCase().includes("sender")) {
      console.warn(`[Vercel Resend] First attempt failed (${errMsg}). Falling back to onboarding@resend.dev...`);
      const fallbackResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from: `"${resendFromName}" <onboarding@resend.dev>`,
          to,
          subject,
          text,
          html
        })
      });
      const fallbackData: any = await fallbackResponse.json();
      if (fallbackResponse.ok) {
        console.log(`[Vercel Resend] Fallback email sent successfully to ${to}, ID: ${fallbackData.id}`);
        return res.status(200).json({ success: true, id: fallbackData.id });
      }
      throw new Error(fallbackData?.message || `Fallback failed with status ${fallbackResponse.status}`);
    }
    
    throw new Error(errMsg || `HTTP error! status: ${response.status}`);
  } catch (err: any) {
    console.error("[Vercel Resend] Critical error sending email:", err.message);
    return res.status(500).json({ error: err.message });
  }
}

