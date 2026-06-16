import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

const BILL_APPROVED_EMAIL_TEMPLATE = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Bill Payment Successful</title>
  <style>
    @keyframes pulse {
      0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); }
      70% { transform: scale(1.05); box-shadow: 0 0 0 10px rgba(16, 185, 129, 0); }
      100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
    }
    .animate-pulse-infinite {
      animation: pulse 2s infinite ease-in-out;
      display: inline-block !important;
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" border="0" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
          <tr>
            <td align="left" style="background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%); padding: 25px 30px; text-align: left; vertical-align: middle;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="left" valign="middle">
                    <img src="{{logoUrl}}" height="32" style="height: 32px; display: block; border: none; outline: none; text-decoration: none;" alt="UsePay" />
                  </td>
                  <td align="right" valign="middle">
                    <span style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #a5b4fc; background-color: rgba(99, 102, 241, 0.2); padding: 4px 10px; border-radius: 12px; letter-spacing: 1.5px;">Utility Bill Notice</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <tr>
            <td style="padding: 40px 40px 20px 40px; text-align: center;">
              <div class="animate-pulse-infinite" style="width: 56px; height: 56px; background-color: #ecfdf5; border-radius: 50%; display: inline-block; line-height: 56px; text-align: center; border: 1px solid #a7f3d0; margin: 0 auto 20px auto; vertical-align: middle;">
                <span style="font-size: 28px; color: #10b981; font-weight: bold; line-height: 56px; vertical-align: middle; display: block; text-align: center; margin: 0;">✓</span>
              </div>
              <h2 style="margin: 0; font-size: 20px; font-weight: 800; color: #0f172a; tracking: -0.5px;">Bill Payment Success!</h2>
              <p style="margin: 10px 0 0 0; font-size: 13px; color: #64748b; font-weight: 500; line-height: 1.5;">Your utility bill payment request was approved and processed successfully at the operator end.</p>
            </td>
          </tr>

          <!-- Amount Highlight Card -->
          <tr>
            <td style="padding: 0 40px 20px 40px;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; border-radius: 16px; padding: 20px; text-align: center;">
                <tr>
                  <td>
                    <span style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #64748b; letter-spacing: 1px;">Amount Debited</span>
                    <h1 style="margin: 5px 0; font-size: 36px; font-weight: 900; color: #0f172a;">₹{{amount}}</h1>
                    <span style="font-size: 11px; font-weight: 700; color: #6366f1;">Transaction Charge: +₹{{charges}}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Request Details Table -->
          <tr>
            <td style="padding: 0 40px 30px 40px;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="border-collapse: collapse;">
                <tr>
                  <td colspan="2" style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #94a3b8; letter-spacing: 1px; padding-bottom: 12px; border-bottom: 1px solid #f1f5f9;">Payment Details</td>
                </tr>
                <tr>
                  <td style="font-size: 12px; font-weight: 600; color: #64748b; padding: 12px 0; border-bottom: 1px solid #f8fafc;">Retailer ID / Firm</td>
                  <td align="right" style="font-size: 12px; font-weight: 700; color: #0f172a; padding: 12px 0; border-bottom: 1px solid #f8fafc;">{{userId}} ({{firmName}})</td>
                </tr>
                <tr>
                  <td style="font-size: 12px; font-weight: 600; color: #64748b; padding: 12px 0; border-bottom: 1px solid #f8fafc;">Biller Category / Operator</td>
                  <td align="right" style="font-size: 12px; font-weight: 700; color: #0f172a; padding: 12px 0; border-bottom: 1px solid #f8fafc;">{{serviceType}} ({{provider}})</td>
                </tr>
                <tr>
                  <td style="font-size: 12px; font-weight: 600; color: #64748b; padding: 12px 0; border-bottom: 1px solid #f8fafc;">Account / Consumer No.</td>
                  <td align="right" style="font-size: 12px; font-weight: 700; color: #0f172a; padding: 12px 0; border-bottom: 1px solid #f8fafc; font-family: monospace;">{{consumerNumber}}</td>
                </tr>
                <tr>
                  <td style="font-size: 12px; font-weight: 600; color: #64748b; padding: 12px 0; border-bottom: 1px solid #f8fafc;">BBPS Reference ID</td>
                  <td align="right" style="font-size: 12px; font-weight: 700; color: #10b981; padding: 12px 0; border-bottom: 1px solid #f8fafc; font-family: monospace;">{{txnRefId}}</td>
                </tr>
                <tr>
                  <td style="font-size: 12px; font-weight: 600; color: #64748b; padding: 12px 0;">Transaction Date</td>
                  <td align="right" style="font-size: 12px; font-weight: 700; color: #0f172a; padding: 12px 0;">{{date}}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Help / Support Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 24px 40px; border-top: 1px solid #f1f5f9; text-align: center; border-radius: 0 0 24px 24px;">
              <p style="margin: 0; font-size: 11px; color: #94a3b8; font-weight: 500; line-height: 1.5;">The receipt will be available in your account's Bill History tab for download or print.</p>
              <p style="margin: 5px 0 0 0; font-size: 11px; color: #6366f1; font-weight: 700;">UsePay Support Desk &bull; www.usepay.in</p>
              <p style="margin: 5px 0 0 0; font-size: 11px; color: #64748b; font-weight: 600;">Contact Our Support Team: <a href="mailto:usepay.in@gmail.com" style="color: #6366f1; text-decoration: none;">usepay.in@gmail.com</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

const BILL_REJECTED_EMAIL_TEMPLATE = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Bill Payment Failed & Refunded</title>
  <style>
    @keyframes pulse-amber {
      0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(217, 119, 6, 0.4); }
      70% { transform: scale(1.05); box-shadow: 0 0 0 10px rgba(217, 119, 6, 0); }
      100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(217, 119, 6, 0); }
    }
    .animate-pulse-infinite {
      animation: pulse-amber 2s infinite ease-in-out;
      display: inline-block !important;
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" border="0" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
          <tr>
            <td align="left" style="background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%); padding: 25px 30px; text-align: left; vertical-align: middle;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="left" valign="middle">
                    <img src="{{logoUrl}}" height="32" style="height: 32px; display: block; border: none; outline: none; text-decoration: none;" alt="UsePay" />
                  </td>
                  <td align="right" valign="middle">
                    <span style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #fca5a5; background-color: rgba(239, 68, 68, 0.2); padding: 4px 10px; border-radius: 12px; letter-spacing: 1.5px;">Transaction Refund</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <tr>
            <td style="padding: 40px 40px 20px 40px; text-align: center;">
              <div class="animate-pulse-infinite" style="width: 56px; height: 56px; background-color: #fffbeb; border-radius: 50%; display: inline-block; line-height: 56px; text-align: center; border: 1px solid #fde68a; margin: 0 auto 20px auto; vertical-align: middle;">
                <span style="font-size: 28px; color: #d97706; font-weight: bold; line-height: 56px; vertical-align: middle; display: block; text-align: center; margin: 0;">↩</span>
              </div>
              <h2 style="margin: 0; font-size: 20px; font-weight: 800; color: #0f172a; tracking: -0.5px;">Bill Payment Failed & Refunded</h2>
              <p style="margin: 10px 0 0 0; font-size: 13px; color: #64748b; font-weight: 500; line-height: 1.5;">Your bill payment request has been rejected. The full debited amount (including charges) has been successfully refunded back to your wallet.</p>
            </td>
          </tr>

          <!-- Amount Highlight Card -->
          <tr>
            <td style="padding: 0 40px 20px 40px;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #fffdf5; border-radius: 16px; padding: 20px; text-align: center; border: 1px dashed #fcd34d;">
                <tr>
                  <td>
                    <span style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #b45309; letter-spacing: 1px;">Refund Credited</span>
                    <h1 style="margin: 5px 0; font-size: 36px; font-weight: 900; color: #d97706;">₹{{totalDeduction}}</h1>
                    <span style="font-size: 12px; font-weight: 700; color: #b45309; display: block; margin-top: 10px;">Rejection Reason: "{{rejectionReason}}"</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Request Details Table -->
          <tr>
            <td style="padding: 0 40px 30px 40px;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="border-collapse: collapse;">
                <tr>
                  <td colspan="2" style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #94a3b8; letter-spacing: 1px; padding-bottom: 12px; border-bottom: 1px solid #f1f5f9;">Request Details</td>
                </tr>
                <tr>
                  <td style="font-size: 12px; font-weight: 600; color: #64748b; padding: 12px 0; border-bottom: 1px solid #f8fafc;">Retailer ID / Firm</td>
                  <td align="right" style="font-size: 12px; font-weight: 700; color: #0f172a; padding: 12px 0; border-bottom: 1px solid #f8fafc;">{{userId}} ({{firmName}})</td>
                </tr>
                <tr>
                  <td style="font-size: 12px; font-weight: 600; color: #64748b; padding: 12px 0; border-bottom: 1px solid #f8fafc;">Biller / Operator</td>
                  <td align="right" style="font-size: 12px; font-weight: 700; color: #0f172a; padding: 12px 0; border-bottom: 1px solid #f8fafc;">{{provider}}</td>
                </tr>
                <tr>
                  <td style="font-size: 12px; font-weight: 600; color: #64748b; padding: 12px 0; border-bottom: 1px solid #f8fafc;">Account / Consumer No.</td>
                  <td align="right" style="font-size: 12px; font-weight: 700; color: #0f172a; padding: 12px 0; border-bottom: 1px solid #f8fafc; font-family: monospace;">{{consumerNumber}}</td>
                </tr>
                <tr>
                  <td style="font-size: 12px; font-weight: 600; color: #64748b; padding: 12px 0; border-bottom: 1px solid #f8fafc;">Bill Amount + Charges</td>
                  <td align="right" style="font-size: 12px; font-weight: 700; color: #0f172a; padding: 12px 0; border-bottom: 1px solid #f8fafc;">₹{{amount}} + ₹{{charges}}</td>
                </tr>
                <tr>
                  <td style="font-size: 12px; font-weight: 600; color: #64748b; padding: 12px 0;">New Wallet Balance</td>
                  <td align="right" style="font-size: 12px; font-weight: 800; color: #0f172a; padding: 12px 0;">₹{{newBalance}}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Help / Support Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 24px 40px; border-top: 1px solid #f1f5f9; text-align: center; border-radius: 0 0 24px 24px;">
              <p style="margin: 0; font-size: 11px; color: #94a3b8; font-weight: 500; line-height: 1.5;">If the refund has not reflected, please contact our support team immediately.</p>
              <p style="margin: 5px 0 0 0; font-size: 11px; color: #6366f1; font-weight: 700;">UsePay Support Desk &bull; www.usepay.in</p>
              <p style="margin: 5px 0 0 0; font-size: 11px; color: #64748b; font-weight: 600;">Contact Our Support Team: <a href="mailto:usepay.in@gmail.com" style="color: #6366f1; text-decoration: none;">usepay.in@gmail.com</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

async function sendResendEmail(to: string, subject: string, text: string, html: string) {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 465);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const fromEmail = process.env.SMTP_FROM;
  const fromName = process.env.SMTP_FROM_NAME || "UsePay";

  // 1. Try Nodemailer SMTP as primary
  if (host && user && pass) {
    console.log(`[SMTP] Sending email to ${to} (Subject: ${subject}) via ${host}...`);
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

      console.log(`[SMTP] Email sent successfully to ${to}, MessageID: ${info.messageId}`);
      return info;
    } catch (smtpErr: any) {
      console.error(`[SMTP] Failed to send email via ${host}:`, smtpErr.message);
      console.warn("[SMTP] Falling back to Resend API...");
    }
  }

  // 2. Fallback to Resend API
  const apiKey = process.env.RESEND_API_KEY || "re_G9Ldd9PN_FUesjTAdNB2Y6gzSvtV3SoQQ";
  const resendFromEmail = process.env.SMTP_FROM || "onboarding@resend.dev";
  const resendFromName = process.env.SMTP_FROM_NAME || "UsePay";

  console.log(`[Resend] Sending email to ${to} (Subject: ${subject})...`);

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
      console.log(`[Resend] Email sent successfully to ${to}, ID: ${data.id}`);
      return data;
    }

    const errMsg = data?.message || "";
    if (response.status === 403 || errMsg.toLowerCase().includes("verify") || errMsg.toLowerCase().includes("domain") || errMsg.toLowerCase().includes("sender")) {
      console.warn(`[Resend] First attempt failed (${errMsg}). Falling back to onboarding@resend.dev...`);
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
        console.log(`[Resend] Fallback email sent successfully to ${to}, ID: ${fallbackData.id}`);
        return fallbackData;
      }
      throw new Error(fallbackData?.message || `Fallback failed with status ${fallbackResponse.status}`);
    }

    throw new Error(errMsg || `HTTP error! status: ${response.status}`);
  } catch (err: any) {
    console.error("[Resend] Critical error sending email:", err.message);
    throw err;
  }
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { requestId, status, rejectionReason } = req.body;
  console.log(`[Bill Email Vercel Route] Triggered for ID: ${requestId}, status: ${status}`);

  if (!process.env.VITE_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: "Supabase key missing" });
  }

  const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    if (!requestId || !status) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    // Fetch bill submission
    const { data: bill, error: billErr } = await supabaseAdmin
      .from('bill_submissions')
      .select('*')
      .eq('id', requestId)
      .single();

    if (billErr || !bill) {
      throw new Error("Bill submission not found");
    }

    // Fetch user profile
    const { data: user, error: userErr } = await supabaseAdmin
      .from('users_profiles')
      .select('*')
      .eq('id', bill.user_id)
      .single();

    if (userErr || !user) {
      throw new Error("User profile not found");
    }

    if (!user.email || !user.email.includes("@")) {
      console.warn(`[Bill Email Vercel Route] Skipping email. User ${user.id} does not have a valid email: ${user.email}`);
      return res.json({ success: true, skipped: true, reason: "No valid email" });
    }

    // Fetch settings logo
    const { data: settings } = await supabaseAdmin.from('qr_settings').select('logo_url').eq('id', 1).single();
    let logoUrl = settings?.logo_url || "https://usepay.in/logo.png";
    if (logoUrl.startsWith('/')) {
      logoUrl = 'https://usepay.in' + logoUrl;
    }

    const formattedDate = new Date(bill.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST';
    const amountVal = Number(bill.amount);
    const chargesVal = Number(bill.charges || 0);
    const maskedCard = bill.card_number ? bill.card_number.replace(/\d(?=\d{4})/g, "*") : "N/A";

    let subject = "";
    let html = "";

    if (status === 'approved') {
      subject = `🟢 [UsePay] Bill Payment Successful - ₹${amountVal.toLocaleString('en-IN')}`;
      
      html = BILL_APPROVED_EMAIL_TEMPLATE
        .replace(/\{\{logoUrl\}\}/g, logoUrl)
        .replace(/\{\{amount\}\}/g, amountVal.toLocaleString('en-IN', { minimumFractionDigits: 2 }))
        .replace(/\{\{charges\}\}/g, chargesVal.toLocaleString('en-IN', { minimumFractionDigits: 2 }))
        .replace(/\{\{userId\}\}/g, user.id)
        .replace(/\{\{firmName\}\}/g, user.firm_name || user.name || 'N/A')
        .replace(/\{\{serviceType\}\}/g, "Credit Card Bill")
        .replace(/\{\{provider\}\}/g, bill.card_bank)
        .replace(/\{\{consumerNumber\}\}/g, maskedCard)
        .replace(/\{\{txnRefId\}\}/g, bill.transaction_id || 'N/A')
        .replace(/\{\{date\}\}/g, formattedDate);
    } else if (status === 'rejected' || status === 'refunded') {
      subject = `🔴 [UsePay] Bill Payment Failed & Refunded - ₹${(amountVal + chargesVal).toLocaleString('en-IN')}`;
      const reasonText = rejectionReason || bill.rejection_reason || "Transaction failed or declined by admin.";
      const totalDeduction = (amountVal + chargesVal).toFixed(2);

      html = BILL_REJECTED_EMAIL_TEMPLATE
        .replace(/\{\{logoUrl\}\}/g, logoUrl)
        .replace(/\{\{totalDeduction\}\}/g, Number(totalDeduction).toLocaleString('en-IN', { minimumFractionDigits: 2 }))
        .replace(/\{\{rejectionReason\}\}/g, reasonText)
        .replace(/\{\{userId\}\}/g, user.id)
        .replace(/\{\{firmName\}\}/g, user.firm_name || user.name || 'N/A')
        .replace(/\{\{provider\}\}/g, bill.card_bank)
        .replace(/\{\{consumerNumber\}\}/g, maskedCard)
        .replace(/\{\{amount\}\}/g, amountVal.toLocaleString('en-IN', { minimumFractionDigits: 2 }))
        .replace(/\{\{charges\}\}/g, chargesVal.toLocaleString('en-IN', { minimumFractionDigits: 2 }))
        .replace(/\{\{newBalance\}\}/g, Number(user.wallet_balance).toLocaleString('en-IN', { minimumFractionDigits: 2 }));
    } else {
      throw new Error(`Unsupported status: ${status}`);
    }

    await sendResendEmail(user.email, subject, subject, html);
    return res.status(200).json({ success: true });
  } catch (err: any) {
    console.error("[Bill Email Vercel Route] Failed:", err);
    return res.status(500).json({ error: err.message });
  }
}
