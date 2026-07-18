import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import https from "https";
import archiver from "archiver";
import fs from "fs-extra";
import os from "os";
import ws from "ws";
import dns from "dns";
import * as billAvenue from "./services/billavenue.js";
import * as recharge from "./services/recharge.js";
import * as camlenioAeps from "./services/camlenio_aeps.js";
import * as camlenioBbps from "./services/camlenio_bbps.js";

// Force IPv4 resolution for fetch/http requests to fix Camlenio "Only IPv4 allowed" restriction
dns.setDefaultResultOrder("ipv4first");

dotenv.config();

export const PAYPRIME_TOKEN = process.env.PAYPRIME_TOKEN || "RP54BwilcHzw0zWEB7IBx3g9C5P2IK";

// Global Error Handlers to prevent silent crashes
process.on('unhandledRejection', (reason, promise) => {
  console.error('[CRITICAL] Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[CRITICAL] Uncaught Exception:', err);
});

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  {
    realtime: {
      transport: ws as any,
    },
  }
);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Global Request Logger
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });

  async function sendResendEmail(to: string, subject: string, text: string, html: string) {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 465);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const fromEmail = process.env.SMTP_FROM;
    const fromName = process.env.SMTP_FROM_NAME || "UsePay";

    // If SMTP credentials are configured, use Nodemailer SMTP as primary
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

    // Fallback to Resend API
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

  app.post("/api/send-email", async (req, res) => {
    const { to, subject, text, html } = req.body;
    console.log("Incoming Resend email request to:", to);

    try {
      await sendResendEmail(to, subject, text, html);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error sending email via Resend:", error);
      res.status(500).json({ error: error.message });
    }
  });

  const QR_APPROVED_EMAIL_TEMPLATE = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>QR Payment Approved</title>
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
        <!-- Main Card Container -->
        <table width="600" border="0" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
          <!-- Top Header Brand Section -->
          <tr>
            <td align="left" style="background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%); padding: 25px 30px; text-align: left; vertical-align: middle;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="left" valign="middle">
                    <img src="{{logoUrl}}" height="32" style="height: 32px; display: block; border: none; outline: none; text-decoration: none;" alt="UsePay" />
                  </td>
                  <td align="right" valign="middle">
                    <span style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #a5b4fc; background-color: rgba(99, 102, 241, 0.2); padding: 4px 10px; border-radius: 12px; letter-spacing: 1.5px;">Transaction Notice</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Status Announcement Banner -->
          <tr>
            <td style="padding: 40px 40px 20px 40px; text-align: center;">
              <div class="animate-pulse-infinite" style="width: 56px; height: 56px; background-color: #ecfdf5; border-radius: 50%; display: inline-block; line-height: 56px; text-align: center; border: 1px solid #a7f3d0; margin: 0 auto 20px auto; vertical-align: middle;">
                <span style="font-size: 28px; color: #10b981; font-weight: bold; line-height: 56px; vertical-align: middle; display: block; text-align: center; margin: 0;">✓</span>
              </div>
              <h2 style="margin: 0; font-size: 20px; font-weight: 800; color: #0f172a; tracking: -0.5px;">QR Payment Success!</h2>
              <p style="margin: 10px 0 0 0; font-size: 13px; color: #64748b; font-weight: 500; line-height: 1.5;">Your deposit request has been successfully approved and credited to your wallet balance.</p>
            </td>
          </tr>

          <!-- Amount Highlight Card -->
          <tr>
            <td style="padding: 0 40px 20px 40px;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; border-radius: 16px; padding: 20px; text-align: center;">
                <tr>
                  <td>
                    <span style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #64748b; letter-spacing: 1px;">Amount Credited</span>
                    <h1 style="margin: 5px 0; font-size: 36px; font-weight: 900; color: #10b981;">₹{{amount}}</h1>
                    <span style="font-size: 11px; font-weight: 700; color: #475569;">Charge: {{charge_pct}}% | Credit Wallet Balance: ₹{{final_profit}}</span>
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
                  <td style="font-size: 12px; font-weight: 600; color: #64748b; padding: 12px 0; border-bottom: 1px solid #f8fafc;">Transaction UTR</td>
                  <td align="right" style="font-size: 12px; font-weight: 700; color: #6366f1; padding: 12px 0; border-bottom: 1px solid #f8fafc; font-family: monospace;">{{utr}}</td>
                </tr>
                <tr>
                  <td style="font-size: 12px; font-weight: 600; color: #64748b; padding: 12px 0; border-bottom: 1px solid #f8fafc;">QR Account Name</td>
                  <td align="right" style="font-size: 12px; font-weight: 700; color: #0f172a; padding: 12px 0; border-bottom: 1px solid #f8fafc;">{{qrName}}</td>
                </tr>
                <tr>
                  <td style="font-size: 12px; font-weight: 600; color: #64748b; padding: 12px 0; border-bottom: 1px solid #f8fafc;">Request Date</td>
                  <td align="right" style="font-size: 12px; font-weight: 700; color: #0f172a; padding: 12px 0; border-bottom: 1px solid #f8fafc;">{{date}}</td>
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
              <p style="margin: 0; font-size: 11px; color: #94a3b8; font-weight: 500; line-height: 1.5;">If you have any questions regarding this transaction, please contact our support desk.</p>
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

  const QR_REJECTED_EMAIL_TEMPLATE = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>QR Payment Rejected</title>
  <style>
    @keyframes pulse-red {
      0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
      70% { transform: scale(1.05); box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
      100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
    }
    .animate-pulse-infinite {
      animation: pulse-red 2s infinite ease-in-out;
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
                    <span style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #fca5a5; background-color: rgba(239, 68, 68, 0.2); padding: 4px 10px; border-radius: 12px; letter-spacing: 1.5px;">Transaction Alert</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <tr>
            <td style="padding: 40px 40px 20px 40px; text-align: center;">
              <div class="animate-pulse-infinite" style="width: 56px; height: 56px; background-color: #fef2f2; border-radius: 50%; display: inline-block; line-height: 56px; text-align: center; border: 1px solid #fecaca; margin: 0 auto 20px auto; vertical-align: middle;">
                <span style="font-size: 28px; color: #ef4444; font-weight: bold; line-height: 56px; vertical-align: middle; display: block; text-align: center; margin: 0;">✕</span>
              </div>
              <h2 style="margin: 0; font-size: 20px; font-weight: 800; color: #0f172a; tracking: -0.5px;">QR Payment Rejected</h2>
              <p style="margin: 10px 0 0 0; font-size: 13px; color: #64748b; font-weight: 500; line-height: 1.5;">Your deposit request has been declined. The funds were not credited to your wallet.</p>
            </td>
          </tr>

          <!-- Amount Highlight Card -->
          <tr>
            <td style="padding: 0 40px 20px 40px;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #fdf2f2; border-radius: 16px; padding: 20px; text-align: center; border: 1px dashed #fca5a5;">
                <tr>
                  <td>
                    <span style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #b91c1c; letter-spacing: 1px;">Requested Amount</span>
                    <h1 style="margin: 5px 0; font-size: 36px; font-weight: 900; color: #b91c1c;">₹{{amount}}</h1>
                    <span style="font-size: 12px; font-weight: 700; color: #991b1b; display: block; margin-top: 10px;">Reason: "{{rejectionReason}}"</span>
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
                  <td style="font-size: 12px; font-weight: 600; color: #64748b; padding: 12px 0; border-bottom: 1px solid #f8fafc;">Transaction UTR</td>
                  <td align="right" style="font-size: 12px; font-weight: 700; color: #64748b; padding: 12px 0; border-bottom: 1px solid #f8fafc; font-family: monospace;">{{utr}}</td>
                </tr>
                <tr>
                  <td style="font-size: 12px; font-weight: 600; color: #64748b; padding: 12px 0; border-bottom: 1px solid #f8fafc;">QR Account Name</td>
                  <td align="right" style="font-size: 12px; font-weight: 700; color: #0f172a; padding: 12px 0; border-bottom: 1px solid #f8fafc;">{{qrName}}</td>
                </tr>
                <tr>
                  <td style="font-size: 12px; font-weight: 600; color: #64748b; padding: 12px 0;">Request Date</td>
                  <td align="right" style="font-size: 12px; font-weight: 700; color: #0f172a; padding: 12px 0;">{{date}}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Help / Support Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 24px 40px; border-top: 1px solid #f1f5f9; text-align: center; border-radius: 0 0 24px 24px;">
              <p style="margin: 0; font-size: 11px; color: #94a3b8; font-weight: 500; line-height: 1.5;">Please upload a valid payment proof with a correct UTR to get approval on subsequent attempts.</p>
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
                  <td colspan="2" style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #94a3b8; letter-spacing: 1px; padding-bottom: 12px; border-bottom: 1px solid #f1f5f9;">Payment Details</td>
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

  app.post("/api/notify-qr-email", async (req, res) => {
    const { requestId, status, rejectionReason } = req.body;
    console.log(`[QR Email Notification] Triggered for ID: ${requestId}, status: ${status}`);

    try {
      if (!requestId || !status) {
        return res.status(400).json({ error: "Missing required parameters" });
      }

      // Fetch payment submission
      const { data: payment, error: paymentErr } = await supabaseAdmin
        .from('payment_submissions')
        .select('*')
        .eq('id', requestId)
        .single();

      if (paymentErr || !payment) {
        throw new Error("Payment submission not found");
      }

      // Fetch user profile
      const { data: user, error: userErr } = await supabaseAdmin
        .from('users_profiles')
        .select('*')
        .eq('id', payment.user_id)
        .single();

      if (userErr || !user) {
        throw new Error("User profile not found");
      }

      if (!user.email || !user.email.includes("@")) {
        console.warn(`[QR Email Notification] Skipping email. User ${user.id} does not have a valid email: ${user.email}`);
        return res.json({ success: true, skipped: true, reason: "No valid email" });
      }

      // Fetch QR name if exists
      let qrName = 'Legacy QR';
      if (payment.qr_id) {
        const { data: qr } = await supabaseAdmin
          .from('qr_history')
          .select('qr_name')
          .eq('id', payment.qr_id)
          .single();
        if (qr && qr.qr_name) {
          qrName = qr.qr_name;
        }
      }

      // Fetch settings logo
      const { data: settings } = await supabaseAdmin.from('qr_settings').select('logo_url').eq('id', 1).single();
      let logoUrl = settings?.logo_url || "https://usepay.in/logo.png";
      if (logoUrl.startsWith('/')) {
        logoUrl = 'https://usepay.in' + logoUrl;
      }

      const formattedDate = new Date(payment.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST';
      const amountVal = Number(payment.amount);
      const chargesVal = Number(payment.charges || 0);

      let subject = "";
      let html = "";

      if (status === 'approved') {
        subject = `🟢 [UsePay] QR Payment Success - ₹${amountVal.toLocaleString('en-IN')}`;
        const chargePct = amountVal > 0 ? ((chargesVal / amountVal) * 100).toFixed(2) : "0.00";
        const finalProfit = (amountVal - chargesVal).toFixed(2);

        html = QR_APPROVED_EMAIL_TEMPLATE
          .replace(/\{\{logoUrl\}\}/g, logoUrl)
          .replace(/\{\{amount\}\}/g, amountVal.toLocaleString('en-IN', { minimumFractionDigits: 2 }))
          .replace(/\{\{charge_pct\}\}/g, chargePct)
          .replace(/\{\{final_profit\}\}/g, Number(finalProfit).toLocaleString('en-IN', { minimumFractionDigits: 2 }))
          .replace(/\{\{userId\}\}/g, user.id)
          .replace(/\{\{firmName\}\}/g, user.firm_name || user.name || 'N/A')
          .replace(/\{\{utr\}\}/g, payment.utr_id)
          .replace(/\{\{qrName\}\}/g, qrName)
          .replace(/\{\{date\}\}/g, formattedDate)
          .replace(/\{\{newBalance\}\}/g, Number(user.wallet_balance).toLocaleString('en-IN', { minimumFractionDigits: 2 }));
      } else if (status === 'rejected') {
        subject = `🔴 [UsePay] QR Payment Rejected - ₹${amountVal.toLocaleString('en-IN')}`;
        const reasonText = rejectionReason || payment.rejection_reason || "Invalid transaction proof or UTR ID.";

        html = QR_REJECTED_EMAIL_TEMPLATE
          .replace(/\{\{logoUrl\}\}/g, logoUrl)
          .replace(/\{\{amount\}\}/g, amountVal.toLocaleString('en-IN', { minimumFractionDigits: 2 }))
          .replace(/\{\{rejectionReason\}\}/g, reasonText)
          .replace(/\{\{userId\}\}/g, user.id)
          .replace(/\{\{firmName\}\}/g, user.firm_name || user.name || 'N/A')
          .replace(/\{\{utr\}\}/g, payment.utr_id)
          .replace(/\{\{qrName\}\}/g, qrName)
          .replace(/\{\{date\}\}/g, formattedDate);
      } else {
        throw new Error(`Unsupported status: ${status}`);
      }

      await sendResendEmail(user.email, subject, subject, html);
      res.json({ success: true });
    } catch (err: any) {
      console.error("[QR Email Notification] Failed:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/notify-bill-email", async (req, res) => {
    const { requestId, status, rejectionReason } = req.body;
    console.log(`[Bill Email Notification] Triggered for ID: ${requestId}, status: ${status}`);

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
        console.warn(`[Bill Email Notification] Skipping email. User ${user.id} does not have a valid email: ${user.email}`);
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
        // Both rejected and refunded statuses trigger the refund notification template
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
      res.json({ success: true });
    } catch (err: any) {
      console.error("[Bill Email Notification] Failed:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/test-complaint-email", async (req, res) => {
    try {
      const { to = "jigs.vanani@gmail.com" } = req.query;
      console.log("[Test Email Endpoint] Sending to:", to);

      const info = await sendResendEmail(
        to as string,
        "BBPS Complaint Live Test Email",
        "This is a live test email from the server endpoint.",
        "<b>This is a live test email from the server endpoint.</b>"
      );

      res.json({
        success: true,
        message: "Email sent successfully!",
        response: info
      });
    } catch (error: any) {
      console.error("[Test Email Endpoint] Error:", error);
      res.json({
        success: false,
        error: error.message,
        stack: error.stack
      });
    }
  });

  app.post("/api/manage-admin", async (req, res) => {
    const { action, password, mobileNumber } = req.body;

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY === "Paste_your_service_role_key_here") {
      return res.status(500).json({ error: "Service Role Key is missing. Please add it to your .env file." });
    }

    try {
      if (action === "create") {
        const { data, error } = await supabaseAdmin.auth.admin.createUser({
          phone: mobileNumber,
          password: password,
          phone_confirm: true
        });
        if (error) throw error;
        return res.json({ success: true, user: data.user });
      }

      if (action === "delete") {
        const { data: usersData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
        if (listError) throw listError;

        const user = usersData.users.find((u: any) => u.phone?.replace('+', '') === mobileNumber.replace('+', ''));
        if (!user) {
          // If not found in Auth, just return success as we probably just need to clean up the table
          return res.json({ success: true, message: "User not found in Auth, but proceeding." });
        }

        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
        if (deleteError) throw deleteError;

        return res.json({ success: true });
      }

      res.status(400).json({ error: "Invalid action" });
    } catch (error: any) {
      console.error("Admin management error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/send-whatsapp-proof", async (req, res) => {
    const { whatsapp_number, proof_url, credentials } = req.body;
    console.log("[WhatsApp] Request for:", whatsapp_number);

    if (!whatsapp_number || !proof_url || !credentials) {
      return res.status(400).json({ error: "Missing WhatsApp credentials or data." });
    }

    try {
      const { provider = 'meta', access_token, phone_number_id, sender_number, aisensy_api_key, aisensy_campaign_name } = credentials;

      if (provider === 'meta') {
        if (!access_token || !phone_number_id) {
          return res.status(400).json({ error: "Meta API credentials missing (Access Token or Phone ID)." });
        }

        const data = JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: whatsapp_number.trim(),
          type: "image",
          image: {
            link: proof_url,
            caption: `Payment Approved! (Sent from ${sender_number || "Admin Portal"})`,
          },
        });

        const options = {
          hostname: 'graph.facebook.com',
          path: `/v18.0/${phone_number_id.trim()}/messages`,
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${access_token.trim()}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(data)
          }
        };

        const metaRequest = https.request(options, (metaRes) => {
          let responseBody = '';
          metaRes.on('data', (chunk) => responseBody += chunk);
          metaRes.on('end', () => {
            const parsed = JSON.parse(responseBody);
            if (metaRes.statusCode && metaRes.statusCode >= 200 && metaRes.statusCode < 300) {
              res.json({ success: true, message_id: parsed.messages?.[0]?.id });
            } else {
              res.status(metaRes.statusCode || 500).json({ error: parsed.error?.message || "Meta API Error" });
            }
          });
        });

        metaRequest.on('error', (e) => { throw e; });
        metaRequest.write(data);
        metaRequest.end();

      } else if (provider === 'aisensy') {
        if (!aisensy_api_key || !aisensy_campaign_name) {
          return res.status(400).json({ error: "AiSensy API credentials missing (API Key or Campaign Name)." });
        }

        const data = JSON.stringify({
          apiKey: aisensy_api_key.trim(),
          campaignName: aisensy_campaign_name.trim(),
          destination: whatsapp_number.trim(),
          userName: "User",
          templateParams: [],
          source: "UsePay App",
          media: {
            url: proof_url,
            filename: "payment_proof.png"
          },
          buttons: [],
          carouselCards: [],
          location: {},
          attributes: {},
          paramsFallbackValue: {}
        });

        const options = {
          hostname: 'backend.aisensy.com',
          path: '/campaign/t1/api/v2',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(data)
          }
        };

        const aiRequest = https.request(options, (aiRes) => {
          let responseBody = '';
          aiRes.on('data', (chunk) => responseBody += chunk);
          aiRes.on('end', () => {
            const parsed = JSON.parse(responseBody);
            if (aiRes.statusCode && aiRes.statusCode >= 200 && aiRes.statusCode < 300) {
              res.json({ success: true, response: parsed });
            } else {
              res.status(aiRes.statusCode || 500).json({ error: parsed.message || "AiSensy API Error" });
            }
          });
        });

        aiRequest.on('error', (e) => { throw e; });
        aiRequest.write(data);
        aiRequest.end();
      }

    } catch (error: any) {
      console.error("[WhatsApp] Critical Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/send-push-notification", async (req, res) => {
    const { title, message, player_ids, target, link, credentials } = req.body;

    let app_id = credentials?.app_id;
    let rest_api_key = credentials?.rest_api_key;

    if (!app_id || !rest_api_key) {
      try {
        const { data: settings } = await supabaseAdmin
          .from('onesignal_settings')
          .select('app_id, rest_api_key, is_enabled')
          .eq('id', 1)
          .single();

        if (settings) {
          if (!settings.is_enabled) {
            console.log('[Push] Notification skipped: Push notifications disabled in settings.');
            return res.json({ success: true, skipped: true, message: "Push notifications are disabled in settings." });
          }
          app_id = settings.app_id;
          rest_api_key = settings.rest_api_key;
        }
      } catch (dbErr) {
        console.error("[Push] Failed to fetch OneSignal settings from DB:", dbErr);
      }
    }

    if (!title || !message || !app_id || !rest_api_key) {
      return res.status(400).json({ error: "Title, message, and OneSignal credentials are required." });
    }

    try {
      let targetPlayerIds = player_ids || [];
      let externalUserIds = req.body.external_user_ids || [];

      // 1. Server-side discovery of Admin IDs if targeted
      if (target === 'admins') {
        try {
          await supabaseAdmin
            .from('notifications')
            .insert([{
              target_role: 'admin',
              title,
              message,
              link: link || null
            }]);
          console.log('[Push] Admin database notification inserted successfully.');
        } catch (dbErr) {
          console.error('[Push] Failed to insert admin database notification:', dbErr);
        }

        const { data: admins, error } = await supabaseAdmin
          .from('admin_profiles')
          .select('mobile_number, onesignal_id');

        if (!error && admins) {
          const freshPlayerIds = admins
            .flatMap(a => (a.onesignal_id ? a.onesignal_id.split(',') : []))
            .map(id => id.trim())
            .filter(Boolean);
          targetPlayerIds = [...new Set([...targetPlayerIds, ...freshPlayerIds])];

          const discoveredExternalIds = admins.map(a => a.mobile_number).filter(Boolean);
          externalUserIds = [...new Set([...externalUserIds, ...discoveredExternalIds])];
        }
      }

      // 2. Resolve current onesignal_ids from DB for all externalUserIds
      // This ensures we always target the device currently associated with the user
      if (externalUserIds.length > 0) {
        // Query users_profiles for regular users
        const { data: userProfiles } = await supabaseAdmin
          .from('users_profiles')
          .select('onesignal_id')
          .in('id', externalUserIds.map((id: any) => String(id)));

        // Query admin_profiles for admins (using mobile_number)
        const { data: adminProfiles } = await supabaseAdmin
          .from('admin_profiles')
          .select('onesignal_id')
          .in('mobile_number', externalUserIds.map((id: any) => String(id)));

        const freshPlayerIds: string[] = [];
        if (userProfiles) {
          const ids = userProfiles
            .flatMap(p => (p.onesignal_id ? p.onesignal_id.split(',') : []))
            .map(id => id.trim())
            .filter(Boolean);
          freshPlayerIds.push(...ids);
        }
        if (adminProfiles) {
          const ids = adminProfiles
            .flatMap(p => (p.onesignal_id ? p.onesignal_id.split(',') : []))
            .map(id => id.trim())
            .filter(Boolean);
          freshPlayerIds.push(...ids);
        }

        if (freshPlayerIds.length > 0) {
          targetPlayerIds = [...new Set([...targetPlayerIds, ...freshPlayerIds])];
        }
      }

      const data: any = {
        app_id: app_id.trim(),
        headings: { en: title },
        contents: { en: message },
        web_url: link ? `https://www.usepay.in/${link.replace(/^\//, '')}` : "https://www.usepay.in/dashboard",
        // NEVER broadcast by default
        included_segments: [],
      };

      // 3. Target specific players if provided
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const cleanPlayerIds = targetPlayerIds.filter((id: any) => id && typeof id === 'string' && uuidRegex.test(id.trim()));

      const hasValidTarget = cleanPlayerIds.length > 0;

      if (hasValidTarget) {
        data.include_subscription_ids = cleanPlayerIds;
      } else if (target === 'all' || target === 'broadcast') {
        // Only broadcast if explicitly requested via 'target' parameter
        data.included_segments = ["Subscribed Users", "All"];
      } else {
        // Strict Fail: Do not send anything if no target is found
        console.warn('[Push] Target resolution failed for:', title);
        return res.status(400).json({ error: "No valid target found. Notification blocked for privacy." });
      }

      const bodyData = JSON.stringify(data);

      const options = {
        hostname: 'onesignal.com',
        path: '/api/v1/notifications',
        method: 'POST',
        headers: {
          'Authorization': `Basic ${rest_api_key.trim()}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(bodyData)
        }
      };

      const osRequest = https.request(options, (osRes) => {
        let responseBody = '';
        osRes.on('data', (chunk) => responseBody += chunk);
        osRes.on('end', () => {
          try {
            const parsed = JSON.parse(responseBody);
            if (osRes.statusCode && osRes.statusCode >= 200 && osRes.statusCode < 300) {
              res.json({ success: true, id: parsed.id });
            } else {
              res.status(osRes.statusCode || 500).json({
                error: parsed.errors?.[0] || "OneSignal API Error",
                details: parsed.errors
              });
            }
          } catch (e: any) {
            res.status(500).json({ error: "Invalid response from OneSignal" });
          }
        });
      });

      osRequest.on('error', (err) => {
        res.status(500).json({ error: err.message });
      });

      osRequest.write(bodyData);
      osRequest.end();

    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });



  // ==========================================
  // BBPS API PROXY ROUTES (PayPrime Integration)
  // ==========================================

  app.get("/api/check-ip", async (req, res) => {
    try {
      const response = await fetch("https://api.ipify.org?format=json");
      const data = await response.json();
      res.json({ outgoingIp: data.ip });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });


  app.post("/api/bbps/category", async (req, res) => {
    try {
      const response = await fetch("https://b2b.payprime.in/api/v1/bbps/category", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: PAYPRIME_TOKEN })
      });
      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("[BBPS Proxy] Category Error:", error);
      res.status(500).json({ status: "ERROR", message: error.message });
    }
  });

  app.post("/api/bbps/card/get-biller", async (req, res) => {
    try {
      const response = await fetch("https://b2b.payprime.in/api/v1/card/get-biller", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: PAYPRIME_TOKEN })
      });
      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("[BBPS Proxy] Card Get Biller Error:", error);
      res.status(500).json({ status: "ERROR", message: error.message });
    }
  });

  app.get("/api/bbps/card/list-all-billers", async (req, res) => {
    try {
      const response = await fetch("https://b2b.payprime.in/api/v1/card/get-biller", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: PAYPRIME_TOKEN })
      });
      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("[BBPS Proxy] Card Get Biller GET Error:", error);
      res.status(500).json({ status: "ERROR", message: error.message });
    }
  });

  app.post("/api/bbps/biller", async (req, res) => {
    try {
      const { cat_id } = req.body;
      if (!cat_id) {
        return res.status(400).json({ status: "ERROR", message: "Category ID (cat_id) is required." });
      }

      const response = await fetch("https://b2b.payprime.in/api/v1/bbps/biller", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: PAYPRIME_TOKEN, cat_id })
      });
      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("[BBPS Proxy] Biller Error:", error);
      res.status(500).json({ status: "ERROR", message: error.message });
    }
  });

  app.post("/api/bbps/fetch-biller-info", async (req, res) => {
    try {
      const { biller_id } = req.body;
      if (!biller_id) {
        return res.status(400).json({ status: "ERROR", message: "Biller ID (biller_id) is required." });
      }

      const response = await fetch("https://b2b.payprime.in/api/v1/bbps/fetch-biller-info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: PAYPRIME_TOKEN, biller_id })
      });
      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("[BBPS Proxy] Fetch Biller Info Error:", error);
      res.status(500).json({ status: "ERROR", message: error.message });
    }
  });

  app.post("/api/bbps/fetch-bill", async (req, res) => {
    try {
      const { biller_id, customerParams, service_type } = req.body;
      if (!biller_id || !customerParams) {
        return res.status(400).json({ status: "ERROR", message: "Biller ID and customer parameters are required." });
      }

      // Map raw customerParams to PayPrime param array format
      const paramArray = Object.entries(customerParams || {}).map(([paramName, paramValue]) => ({
        paramName,
        paramValue: String(paramValue)
      }));

      const isCreditCard = (service_type && typeof service_type === 'string' && service_type.toLowerCase().includes("credit card")) ||
        (biller_id && typeof biller_id === 'string' && (biller_id.toLowerCase().includes("card") || biller_id.toLowerCase().endsWith("cc")));

      const targetUrl = isCreditCard
        ? "https://b2b.payprime.in/api/v1/card/fetch-bill"
        : "https://b2b.payprime.in/api/v1/bbps/fetch-bill";

      console.log(`[BBPS Proxy] Fetching bill from ${targetUrl} for biller: ${biller_id}`);

      const response = await fetch(targetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: PAYPRIME_TOKEN,
          biller_id,
          param: paramArray,
          init_channel: "INT",
          initChannel: "INT"
        })
      });
      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("[BBPS Proxy] Fetch Bill Error:", error);
      res.status(500).json({ status: "ERROR", message: error.message });
    }
  });

  app.post("/api/bbps/pay-bill", async (req, res) => {
    try {
      const { userId, biller_id, amount, customerParams, fetchResponse, service_type, provider, consumer_number } = req.body;

      if (!userId || !biller_id || !amount) {
        return res.status(400).json({ status: "ERROR", message: "Missing required parameters." });
      }

      const paymentAmount = Number(amount);
      if (isNaN(paymentAmount) || paymentAmount <= 0) {
        return res.status(400).json({ status: "ERROR", message: "Invalid amount specified." });
      }

      // 1. Fetch user's current wallet balance and service charge settings
      const { data: user, error: userError } = await supabaseAdmin
        .from("users_profiles")
        .select("wallet_balance, service_charge_enabled, custom_service_charge, custom_daily_live_bbps_limit")
        .eq("id", userId)
        .single();

      if (userError || !user) {
        return res.status(400).json({ status: "ERROR", message: "User profile not found." });
      }

      // 1.1 Fetch global daily limit
      const { data: globalSettings } = await supabaseAdmin
        .from("qr_settings")
        .select("daily_live_bbps_limit")
        .eq("id", 1)
        .single();

      const liveLimit = Number(user.custom_daily_live_bbps_limit) > 0
        ? Number(user.custom_daily_live_bbps_limit)
        : (Number(globalSettings?.daily_live_bbps_limit) || 500000);

      // 1.2 Calculate today's sum in IST (Indian Standard Time, UTC +5:30)
      const now = new Date();
      const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
      const ist = new Date(utc + (3600000 * 5.5));
      ist.setHours(0, 0, 0, 0);
      const startOfToday = new Date(ist.getTime() - (3600000 * 5.5)).toISOString();

      const { data: bbpsToday } = await supabaseAdmin
        .from("bbps_submissions")
        .select("amount")
        .eq("user_id", userId)
        .gte("created_at", startOfToday)
        .in("status", ["pending", "approved"]);

      const todaySum = (bbpsToday || []).reduce((sum, b) => sum + Number(b.amount), 0);

      if (todaySum + paymentAmount > liveLimit) {
        return res.status(400).json({
          status: "ERROR",
          message: `Daily Live BBPS limit exceeded. You can only submit up to ₹${liveLimit.toLocaleString()} of Live BBPS payments daily. Remaining limit for today is ₹${Math.max(0, liveLimit - todaySum).toLocaleString()}.`
        });
      }

      const currentBalance = Number(user.wallet_balance) || 0;

      // 1.5 Fetch active service charge slabs to compute commission fee
      const { data: slabs, error: slabsError } = await supabaseAdmin
        .from("service_charge_slabs")
        .select("*")
        .eq("is_active", true)
        .order("min_amount", { ascending: true });

      if (slabsError) {
        console.error("[BBPS Proxy] Error fetching slabs:", slabsError);
      }

      let serviceCharge = 0;
      if (user.service_charge_enabled) {
        serviceCharge = Number(user.custom_service_charge) || 0;
      } else if (slabs && slabs.length > 0) {
        const slab = slabs.find(s => paymentAmount >= Number(s.min_amount) && paymentAmount <= Number(s.max_amount));
        if (slab) {
          if (slab.is_percentage) {
            serviceCharge = (paymentAmount * Number(slab.charge_amount)) / 100;
          } else {
            serviceCharge = Number(slab.charge_amount);
          }
        }
      }

      const totalDeduction = paymentAmount + serviceCharge;

      // 2. Enforce minimum ₹250 wallet balance rule taking calculated charges into account
      if (currentBalance - totalDeduction < 250) {
        return res.status(400).json({
          status: "ERROR",
          message: `Insufficient balance. You must maintain at least ₹250 in your wallet after payment (Bill Amount: ₹${paymentAmount} + Charges: ₹${serviceCharge}).`
        });
      }

      // Enforce maximum ₹50,000 per transaction cash payment limit for BBPS
      if (paymentAmount >= 50000) {
        return res.status(400).json({
          status: "ERROR",
          message: "Transaction amount must be less than ₹50,000 per transaction for BBPS Cash payment channel. Please split your payment."
        });
      }

      // 3. Prepare parameters and call PayPrime API
      // PayPrime requires amount in Paisa, so multiply Rupees by 100
      const amountInPaisa = Math.round(paymentAmount * 100);

      let isAdhoc = !fetchResponse || !fetchResponse.data?.billerResponse;
      let quickPay = "N";
      let billerAdhoc = false;

      if (isAdhoc) {
        quickPay = "Y";
        billerAdhoc = true;
      } else {
        const fetchedRawAmount = Number(fetchResponse.data.billerResponse.billAmount) || 0;
        // Heuristic to detect if fetchedRawAmount is in Rupees or Paise:
        let fetchedAmountInPaisa = fetchedRawAmount;
        if (Math.abs(fetchedRawAmount - paymentAmount) < Math.abs(fetchedRawAmount - amountInPaisa)) {
          fetchedAmountInPaisa = fetchedRawAmount * 100;
        }
        // If the payment amount in paisa does not match the fetched billAmount,
        // it is a custom/partial payment on a fetched bill. We set quickPay = "Y" and billerAdhoc = true.
        if (amountInPaisa !== Math.round(fetchedAmountInPaisa)) {
          console.log(`[BBPS Proxy] Custom amount specified (${amountInPaisa} vs fetched ${fetchedAmountInPaisa}). Setting quickPay = "Y" (Adhoc/Partial).`);
          quickPay = "Y";
          billerAdhoc = true;
        }
      }

      const paramArray = Object.entries(customerParams || {}).map(([paramName, paramValue]) => ({
        paramName,
        paramValue: String(paramValue)
      }));

      // Extract user mobile number for validation, or fall back to default
      const userMobile = customerParams["Registered Mobile Number"] ||
        customerParams["Mobile Number"] ||
        customerParams["Mobile"] ||
        "9999999999";

      // Fetch biller info to dynamically detect supported payment modes for AGT channel
      let allowedModes: string[] = [];
      try {
        const infoRes = await fetch("https://b2b.payprime.in/api/v1/bbps/fetch-biller-info", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: PAYPRIME_TOKEN, biller_id })
        });
        const infoData = await infoRes.json();
        if (infoData.status === 'SUCCESS' && infoData.data?.billerPaymentModes) {
          let modesObj = infoData.data.billerPaymentModes;
          if (typeof modesObj === 'string') {
            try {
              modesObj = JSON.parse(modesObj);
            } catch (e) {
              console.error("Error parsing billerPaymentModes string:", e);
            }
          }
          if (modesObj && Array.isArray(modesObj.paymentModeList)) {
            allowedModes = modesObj.paymentModeList.map((m: any) => String(m.paymentModeName).toUpperCase());
          }
        }
      } catch (err) {
        console.error("[BBPS Proxy] Error fetching biller info in pay-bill:", err);
      }

      const isCreditCard = (service_type && typeof service_type === 'string' && service_type.toLowerCase().includes("credit card")) ||
        (biller_id && typeof biller_id === 'string' && biller_id.toLowerCase().includes("card")) ||
        (provider && typeof provider === 'string' && provider.toLowerCase().includes("credit card"));

      // Determine the best payment mode supported by the biller
      let mode = "Cash";
      if (isCreditCard) {
        mode = "Cash";
      } else if (allowedModes.length > 0) {
        if (allowedModes.includes("CASH")) {
          mode = "Cash";
        } else if (allowedModes.includes("UPI")) {
          mode = "UPI";
        } else if (allowedModes.includes("DEBIT CARD") || allowedModes.includes("DEBITCARD")) {
          mode = "Debit Card";
        } else if (allowedModes.includes("INTERNET BANKING") || allowedModes.includes("INTERNETBANKING") || allowedModes.includes("NETBANKING") || allowedModes.includes("NET BANKING")) {
          mode = "Internet Banking";
        } else if (allowedModes.includes("IMPS")) {
          mode = "IMPS";
        } else if (allowedModes.includes("NEFT")) {
          mode = "NEFT";
        } else if (allowedModes.includes("CREDIT CARD") || allowedModes.includes("CREDITCARD")) {
          mode = "Credit Card";
        } else if (allowedModes.includes("WALLET")) {
          mode = "Wallet";
        } else {
          // Fallback to the first allowed mode in proper casing
          const firstMode = allowedModes[0];
          mode = firstMode.charAt(0).toUpperCase() + firstMode.slice(1).toLowerCase();
        }
      }

      // Map paymentInfo dynamically based on the selected mode
      let paymentInfoList: any[] = [];
      const modeLower = mode.toLowerCase();
      if (modeLower === "upi") {
        paymentInfoList = [{ "infoName": "VPA", "infoValue": `${userMobile}@upi` }];
      } else if (modeLower === "debit card") {
        const lastDigits = customerParams["Last 4 digits of Primary Credit Card Number"] ||
          customerParams["Last 4 Digits of Credit Card"] ||
          customerParams["Last 4 digits of Credit Card Number"] ||
          "9999";
        paymentInfoList = [{ "infoName": "Card Ending digits", "infoValue": lastDigits }];
      } else if (modeLower === "internet banking") {
        paymentInfoList = [{ "infoName": "Bank Name", "infoValue": provider || "Internet Banking" }];
      } else {
        // Default (Cash / IMPS / NEFT / others)
        paymentInfoList = [{ "infoName": "Cash Payment", "infoValue": "Cash Payment" }];
      }

      const payPrimePayload: any = {
        token: PAYPRIME_TOKEN,
        biller_id,
        amount: amountInPaisa.toString(),
        quickPay,
        payment_mode: mode,
        paymentInfo: {
          info: paymentInfoList
        },
        mobile: userMobile,
        billerAdhoc,
        inputParams: {
          input: paramArray
        },
        init_channel: "INT",
        initChannel: "INT"
      };

      // Always pass request_id, billerResponse, and additionalInfo if a fetch was performed first,
      // regardless of whether we are paying custom amount (quickPay = "Y") or exact amount (quickPay = "N").
      if (fetchResponse && fetchResponse.data?.billerResponse) {
        payPrimePayload.request_id = fetchResponse.request_id || fetchResponse.data?.request_id;
        payPrimePayload.billerResponse = fetchResponse.data.billerResponse;
        if (fetchResponse.data.additionalInfo) {
          payPrimePayload.additionalInfo = fetchResponse.data.additionalInfo;
        }
      }

      const targetUrl = isCreditCard
        ? "https://b2b.payprime.in/api/v1/card/pay-bill"
        : "https://b2b.payprime.in/api/v1/bbps/pay-bill";

      console.log(`[BBPS Proxy] Outgoing PayPrime Payload to ${targetUrl}:`, JSON.stringify(payPrimePayload, null, 2));

      const response = await fetch(targetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payPrimePayload)
      });

      const responseText = await response.text();
      console.log("[BBPS Proxy] Raw Response from PayPrime Gateway:", responseText);

      let data: any;
      try {
        data = JSON.parse(responseText);
      } catch (err: any) {
        console.error("[BBPS Proxy] Failed to parse PayPrime response as JSON. Raw response was:", responseText);
        // Clean and strip HTML tags from response to get a readable message
        const responseSnippet = responseText.substring(0, 300).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
        return res.status(400).json({
          status: "FAILED",
          message: `PayPrime Gateway Error: The gateway returned an unexpected response. Raw snippet: "${responseSnippet || "Empty Response"}"`
        });
      }

      if (data.status === "SUCCESS") {
        const newBalance = currentBalance - totalDeduction;

        // 4. Deduct wallet balance in Supabase
        const { error: updateError } = await supabaseAdmin
          .from("users_profiles")
          .update({ wallet_balance: newBalance })
          .eq("id", userId);

        if (updateError) {
          console.error("[CRITICAL] Wallet deduction failed for completed BBPS transaction:", updateError);
        }

        // 5. Log transaction into bbps_submissions with approved status and dynamic charges
        const { error: insertError } = await supabaseAdmin
          .from("bbps_submissions")
          .insert({
            user_id: userId,
            service_type: service_type || "BBPS Bill Pay",
            provider: provider || biller_id,
            consumer_number: consumer_number || "BBPS Account",
            amount: paymentAmount,
            charges: serviceCharge,
            status: "approved",
            rejection_reason: data.data?.bbpsrecent?.[0]?.txnid || data.data?.txnid || `TXN${Math.floor(100000 + Math.random() * 900000)}`,
            metadata: {
              billerName: provider || biller_id,
              date: new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
              consumerDetails: customerParams,
              paymentMode: mode
            }
          });

        if (insertError) {
          console.error("[BBPS Proxy] Failed to log transaction in bbps_submissions:", insertError);
        }

        return res.json({
          status: "SUCCESS",
          message: "Transaction SUCCESS",
          new_balance: newBalance,
          charges: serviceCharge,
          data: data.data
        });
      } else {
        // Return structured transaction failure message from operator/PayPrime
        return res.json({
          status: "FAILED",
          message: data.message || "Transaction failed at BBPS Gateway.",
          data: data
        });
      }

    } catch (error: any) {
      console.error("[BBPS Proxy] Pay Bill Error:", error);
      res.status(500).json({ status: "ERROR", message: error.message });
    }
  });

  app.post("/api/payprime-balance", async (req, res) => {
    try {
      const response = await fetch("https://b2b.payprime.in/api/get-balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: PAYPRIME_TOKEN })
      });
      const data: any = await response.json();
      if (data.status === true) {
        res.json({ balance: Number(data.balance) || 0, username: data.username });
      } else {
        res.json({ balance: 0, error: data.message || "Failed to fetch balance" });
      }
    } catch (err: any) {
      console.error("[PayPrime] Fetch Balance Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/cspl-balance", async (req, res) => {
    try {
      const data = await camlenioAeps.getWalletBalance();
      console.log("[CSPL] Balance API Full Response:", JSON.stringify(data));
      
      const isSuccess = data.status === 'SUCCESS' || data.status === 'success' || data.status_code === 200 || data.responseCode === '000' || data.status === true;
      
      if (isSuccess) {
        // Handle out_wallet and wallet fields from CSPL, safely removing commas
        const parseAmount = (val: any) => {
          if (val === undefined || val === null) return undefined;
          const parsed = parseFloat(String(val).replace(/,/g, ''));
          return isNaN(parsed) ? undefined : parsed;
        };

        let balance = 0;
        
        // CSPL API returns {"wallet": {"in_wallet": "0.00", "out_wallet": "10,000.00"}}
        let outW;
        if (data.wallet && data.wallet.out_wallet !== undefined) {
           outW = parseAmount(data.wallet.out_wallet);
        } else if (data.out_wallet !== undefined) {
           outW = parseAmount(data.out_wallet);
        }
        
        const w = parseAmount(typeof data.wallet === 'string' || typeof data.wallet === 'number' ? data.wallet : undefined);
        const wB = parseAmount(data.walletBalance);
        const b = parseAmount(data.balance);
        const a = parseAmount(data.amount);

        if (outW !== undefined) balance = outW;
        else if (w !== undefined) balance = w;
        else if (wB !== undefined) balance = wB;
        else if (b !== undefined) balance = b;
        else if (a !== undefined) balance = a;
        
        res.json({ balance, raw_cspl: data, username: data.username || "CSPL Wallet" });
      } else {
        res.json({ balance: 0, error: data.message || "Failed to fetch CSPL balance", debug: data });
      }
    } catch (err: any) {
      console.error("[CSPL] Fetch Balance Error:", err);
      if (err.message && err.message.includes("IPv4")) {
        return res.json({ balance: 0, error: "API IP whitelist error (Only IPv4 allowed)" });
      }
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // CAMLENIO BBPS API ROUTES
  // ==========================================

  app.post("/api/cspl/billerinfo", async (req, res) => {
    try {
      const { billerId } = req.body;
      if (!billerId) return res.status(400).json({ error: "billerId is required" });
      const data = await camlenioBbps.getBillerInfo(billerId);
      res.json(data);
    } catch (err: any) {
      console.error("[CSPL BBPS] Biller Info Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/cspl/billfetch", async (req, res) => {
    try {
      const { billerId, customerParams, customerMobile, customerEmail } = req.body;
      const inputParams = Object.keys(customerParams || {}).map((key) => ({
        paramName: key,
        paramValue: customerParams[key]
      }));
      
      const payload = {
        billerId,
        customerMobile,
        customerEmail,
        inputParams
      };
      
      const data = await camlenioBbps.fetchBill(payload);
      res.json(data);
    } catch (err: any) {
      console.error("[CSPL BBPS] Bill Fetch Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/cspl/logs", (req, res) => {
    try {
      const logs = fs.readFileSync('cspl_payload_logs.txt', 'utf-8');
      res.type('text/plain').send(logs);
    } catch (err) {
      res.status(404).send("Logs not found or not created yet.");
    }
  });

  app.post("/api/cspl/billpay", async (req, res) => {
    try {
      const { userId, billerId, billerName, customerParams, customerMobile, amount, paymentMode, billDetails, serviceCharge, ccf1Fee } = req.body;
      

      
      const requestId = "CSPL" + Date.now().toString() + Math.floor(Math.random() * 1000).toString();
      
      let additionalInfo: any[] = [];
      if (billDetails && billDetails.additionalInfo) {
         additionalInfo = billDetails.additionalInfo;
      }
      
      const totalDeduction = Number(amount) + Number(serviceCharge || 0) + Number(ccf1Fee || 0);

      // Verify balance first
      const { data: user, error: userError } = await supabaseAdmin
        .from("users_profiles")
        .select("wallet_balance")
        .eq("id", userId)
        .single();
        
      if (userError || !user || user.wallet_balance < totalDeduction) {
        return res.json({ status: "ERROR", message: "Insufficient balance or user not found." });
      }





      const paramKeys = Object.keys(customerParams || {});
      const firstParamName = paramKeys[0] || "Consumer Number";
      const paramValue = customerParams[firstParamName] || "";

      const safeBillPeriod = (billDetails?.billPeriod || "NA").replace(/[^a-zA-Z0-9\-_ ]/g, "");
      const safeBillNumber = (billDetails?.billNumber || "NA").replace(/[^a-zA-Z0-9\-_ ]/g, "");



      const payload: any = {
        requestId,
        billerId,
        customerName: billDetails?.customerName || "BBPS Customer",
        customerMobile: customerMobile || "9999999999",
        billamount: Number(amount),
        client_referenceId: "REF-" + requestId,
        paymentMode: "Wallet",
        paymentChannel: "AGT"
      };

      payload.placeholderValue = firstParamName;
      payload.paramValue = paramValue;

      if (safeBillPeriod && safeBillPeriod !== "NA") payload.billPeriod = safeBillPeriod;
      if (safeBillNumber && safeBillNumber !== "NA") payload.billNumber = safeBillNumber;

      if (additionalInfo && additionalInfo.length > 0) {
        payload.additionalInfo = additionalInfo;
      }

      console.log("[CSPL BBPS] Bill Pay Payload:", JSON.stringify(payload));
      fs.appendFileSync('cspl_payload_logs.txt', new Date().toISOString() + " - " + JSON.stringify(payload) + "\n");
      
      const data = await camlenioBbps.payBill(payload);
      
      if (data.responseCode === '000' || data.status === 'SUCCESS') {
        const newBalance = user.wallet_balance - totalDeduction;
        await supabaseAdmin.from("users_profiles").update({ wallet_balance: newBalance }).eq("id", userId);
        data.new_balance = newBalance;
        
        const txnRefId = data.txnRefId || data.refid || requestId;
        
        const { error: insertError } = await supabaseAdmin.from("bbps_submissions").insert({
          user_id: userId,
          service_type: "BBPS Bill Pay",
          provider: billerId,
          consumer_number: Object.values(customerParams || {})[0] || "BBPS Account",
          amount: Number(amount),
          charges: Number(serviceCharge || 0) + Number(ccf1Fee || 0),
          status: "approved",
          rejection_reason: txnRefId,
          metadata: {
            billerName: billerName || billDetails?.billerName || billDetails?.customerName || billerId,
            date: new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
            consumerDetails: customerParams,
            paymentMode: paymentMode || "WALLET",
            csplResponse: data
          }
        });

        if (insertError) {
          console.error("[CSPL BBPS] Failed to log transaction in bbps_submissions:", insertError);
        }
        
        data.status = 'SUCCESS'; // Ensure frontend gets SUCCESS
      } else {
         data.status = 'ERROR';
      }
      
      res.json(data);
    } catch (err: any) {
      console.error("[CSPL BBPS] Bill Pay Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // CAMLENIO AEPS API ROUTES
  // ==========================================

  // Check agent onboarding & KYC/Login status
  app.get("/api/aeps/agent-status", async (req, res) => {
    try {
      const { userId } = req.query;
      if (!userId) {
        return res.status(400).json({ error: "User ID is required" });
      }

      const { data: agent, error } = await supabaseAdmin
        .from("aeps_agents")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (!agent) {
        return res.json({ status: "not_registered" });
      }

      const todayDate = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
      const dailyLoginDone = agent.daily_login_date === todayDate;

      res.json({
        status: "registered",
        referenceKey: agent.reference_key,
        kycStatus: agent.kyc_status,
        dailyLoginDone,
        registrationData: agent.registration_data
      });
    } catch (err: any) {
      console.error("[AEPS Server] Fetch Agent Status Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Onboard outlet/agent
  app.post("/api/aeps/register", async (req, res) => {
    try {
      const { userId, name, email, mobile, aadhaar, pan, dateOfBirth, gender, latitude, longitude, address } = req.body;

      if (!userId || !name || !email || !mobile || !aadhaar || !pan || !dateOfBirth || !gender || !address) {
        return res.status(400).json({ error: "Missing required onboarding fields" });
      }

      const referenceKey = "AEPS" + Math.floor(1000000000 + Math.random() * 9000000000);

      const payload = {
        name,
        email,
        mobile,
        aadhaar,
        pan,
        dateOfBirth,
        gender,
        latitude: Number(latitude) || 26.9124,
        longitude: Number(longitude) || 75.7873,
        address
      };

      const apiResponse = await camlenioAeps.registerOutlet(payload);

      const { error: dbError } = await supabaseAdmin
        .from("aeps_agents")
        .upsert({
          user_id: userId,
          reference_key: referenceKey,
          kyc_status: "pending",
          registration_data: payload,
          kyc_response: apiResponse,
          updated_at: new Date().toISOString()
        });

      if (dbError) {
        console.error("[AEPS Server] Database save error:", dbError);
      }

      res.json({
        success: true,
        referenceKey,
        apiResponse
      });
    } catch (err: any) {
      console.error("[AEPS Server] Outlet Register Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Query Biometric KYC Status
  app.post("/api/aeps/kyc-status", async (req, res) => {
    try {
      const { userId, referenceKey, spkey, txnRef } = req.body;
      if (!userId || !spkey || !txnRef) {
        return res.status(400).json({ error: "Missing fields to check KYC status" });
      }

      const apiResponse = await camlenioAeps.getKycStatus(spkey, txnRef);

      const isVerified = apiResponse.status === "success" || apiResponse.kycStatus === "verified" || apiResponse.data?.kycStatus === "verified" || apiResponse.success === true;
      
      if (isVerified) {
        const { error: dbError } = await supabaseAdmin
          .from("aeps_agents")
          .update({
            kyc_status: "verified",
            kyc_response: apiResponse,
            updated_at: new Date().toISOString()
          })
          .eq("user_id", userId);

        if (dbError) {
          console.error("[AEPS Server] Database update error:", dbError);
        }
      }

      res.json(apiResponse);
    } catch (err: any) {
      console.error("[AEPS Server] KYC Status Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Submit Biometric KYC Data
  app.post("/api/aeps/biometric-kyc", async (req, res) => {
    try {
      const { userId, referenceKey, latitude, longitude, externalRef, captureType, biometricData } = req.body;

      if (!userId || !referenceKey || !biometricData) {
        return res.status(400).json({ error: "Missing biometric KYC parameters" });
      }

      const payload = {
        referenceKey,
        latitude: latitude || "26.9124",
        longitude: longitude || "75.7873",
        externalRef: externalRef || ("KYC" + Date.now()),
        captureType: captureType || "finger",
        biometricData
      };

      const apiResponse = await camlenioAeps.submitKyc(payload);

      await supabaseAdmin
        .from("aeps_agents")
        .update({
          kyc_status: "submitted",
          kyc_response: apiResponse,
          updated_at: new Date().toISOString()
        })
        .eq("user_id", userId);

      res.json(apiResponse);
    } catch (err: any) {
      console.error("[AEPS Server] Biometric KYC Submission Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Daily Login (Biometric Agent Authentication)
  app.post("/api/aeps/daily-login", async (req, res) => {
    try {
      const { userId, referenceKey, latitude, longitude, externalRef, captureType, biometricData } = req.body;

      if (!userId || !referenceKey || !biometricData) {
        return res.status(400).json({ error: "Missing daily login parameters" });
      }

      const payload = {
        referenceKey,
        latitude: latitude || "26.9124",
        longitude: longitude || "75.7873",
        externalRef: externalRef || ("LGN" + Date.now()),
        captureType: captureType || "finger",
        biometricData
      };

      const apiResponse = await camlenioAeps.dailyLogin(payload);
      
      const isSuccess = apiResponse.status === "success" || apiResponse.responseCode === "0000" || apiResponse.responseCode === "00" || apiResponse.success === true;

      if (isSuccess) {
        const todayDate = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
        await supabaseAdmin
          .from("aeps_agents")
          .update({
            daily_login_date: todayDate,
            updated_at: new Date().toISOString()
          })
          .eq("user_id", userId);
      }

      res.json(apiResponse);
    } catch (err: any) {
      console.error("[AEPS Server] Daily Login Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Balance Enquiry
  app.post("/api/aeps/balance-enquiry", async (req, res) => {
    try {
      const { userId, mobile, bankiin, externalRef, latitude, longitude, captureType, biometricData } = req.body;

      if (!userId || !mobile || !bankiin || !biometricData) {
        return res.status(400).json({ error: "Missing balance enquiry parameters" });
      }

      const extRef = externalRef || ("BAL" + Date.now());
      const payload = {
        mobile,
        bankiin,
        externalRef: extRef,
        latitude: latitude || "26.9124",
        longitude: longitude || "75.7873",
        captureType: captureType || "finger",
        biometricData
      };

      const apiResponse = await camlenioAeps.balanceEnquiry(payload);
      const isSuccess = apiResponse.status === "success" || apiResponse.responseCode === "0000" || apiResponse.responseCode === "00" || apiResponse.success === true;

      await supabaseAdmin
        .from("aeps_transactions")
        .insert({
          user_id: userId,
          transaction_type: "balance_enquiry",
          customer_mobile: mobile,
          bank_iin: bankiin,
          amount: 0,
          status: isSuccess ? "success" : "failed",
          external_ref: extRef,
          api_response: apiResponse
        });

      res.json(apiResponse);
    } catch (err: any) {
      console.error("[AEPS Server] Balance Enquiry Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Mini Statement
  app.post("/api/aeps/mini-statement", async (req, res) => {
    try {
      const { userId, mobile, bankiin, externalRef, latitude, longitude, captureType, biometricData } = req.body;

      if (!userId || !mobile || !bankiin || !biometricData) {
        return res.status(400).json({ error: "Missing mini statement parameters" });
      }

      const extRef = externalRef || ("MIN" + Date.now());
      const payload = {
        mobile,
        bankiin,
        externalRef: extRef,
        latitude: latitude || "26.9124",
        longitude: longitude || "75.7873",
        captureType: captureType || "finger",
        biometricData
      };

      const apiResponse = await camlenioAeps.miniStatement(payload);
      const isSuccess = apiResponse.status === "success" || apiResponse.responseCode === "0000" || apiResponse.responseCode === "00" || apiResponse.success === true;

      await supabaseAdmin
        .from("aeps_transactions")
        .insert({
          user_id: userId,
          transaction_type: "mini_statement",
          customer_mobile: mobile,
          bank_iin: bankiin,
          amount: 0,
          status: isSuccess ? "success" : "failed",
          external_ref: extRef,
          api_response: apiResponse
        });

      res.json(apiResponse);
    } catch (err: any) {
      console.error("[AEPS Server] Mini Statement Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Cash Withdrawal (Credits the Agent's Wallet)
  app.post("/api/aeps/cash-withdrawal", async (req, res) => {
    try {
      const { userId, mobile, bankiin, externalRef, latitude, longitude, captureType, amount, biometricData } = req.body;

      if (!userId || !mobile || !bankiin || !amount || !biometricData) {
        return res.status(400).json({ error: "Missing cash withdrawal parameters" });
      }

      const parsedAmount = Number(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ error: "Invalid withdrawal amount" });
      }

      const extRef = externalRef || ("WTH" + Date.now());
      const payload = {
        mobile,
        bankiin,
        externalRef: extRef,
        latitude: latitude || "26.9124",
        longitude: longitude || "75.7873",
        captureType: captureType || "finger",
        amount: String(parsedAmount),
        biometricData
      };

      const apiResponse = await camlenioAeps.cashWithdrawal(payload);
      const isSuccess = apiResponse.status === "success" || apiResponse.responseCode === "0000" || apiResponse.responseCode === "00" || apiResponse.success === true;

      if (isSuccess) {
        const { data: user, error: userError } = await supabaseAdmin
          .from("users_profiles")
          .select("wallet_balance")
          .eq("id", userId)
          .single();

        if (userError || !user) {
          throw new Error("User profile not found for credit");
        }

        const currentBalance = Number(user.wallet_balance) || 0;
        const newBalance = currentBalance + parsedAmount;

        const { error: updateError } = await supabaseAdmin
          .from("users_profiles")
          .update({ wallet_balance: newBalance })
          .eq("id", userId);

        if (updateError) {
          console.error("[AEPS Server] WALLET UPDATE ERROR FOR AEPS WITHDRAWAL:", updateError);
        }

        await supabaseAdmin
          .from("aeps_transactions")
          .insert({
            user_id: userId,
            transaction_type: "cash_withdrawal",
            customer_mobile: mobile,
            bank_iin: bankiin,
            amount: parsedAmount,
            status: "success",
            external_ref: extRef,
            api_response: apiResponse
          });

        await supabaseAdmin
          .from("payment_submissions")
          .insert({
            user_id: userId,
            utr_id: extRef,
            amount: parsedAmount,
            proof_url: "AEPS_CASH_WITHDRAWAL",
            status: "approved",
            charges: 0
          });
      } else {
        await supabaseAdmin
          .from("aeps_transactions")
          .insert({
            user_id: userId,
            transaction_type: "cash_withdrawal",
            customer_mobile: mobile,
            bank_iin: bankiin,
            amount: parsedAmount,
            status: "failed",
            external_ref: extRef,
            api_response: apiResponse
          });
      }

      res.json(apiResponse);
    } catch (err: any) {
      console.error("[AEPS Server] Cash Withdrawal Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // BILLAVENUE BBPS API ROUTES
  // ==========================================


  app.get("/api/bbps/billers", async (req, res) => {
    try {
      const { billerId } = req.query;
      let response;
      try {
        response = await billAvenue.getBillers(billerId as string);
      } catch (apiErr: any) {
        console.warn("[BillAvenue Server] API Fetch Failed, trying local database fallback:", apiErr.message);
      }

      if (response && response.json?.billerInfoResponse?.biller) {
        // Cache billers dynamically to supabase if we fetched all
        if (!billerId) {
          const billerList = Array.isArray(response.json.billerInfoResponse.biller)
            ? response.json.billerInfoResponse.biller
            : [response.json.billerInfoResponse.biller];

          const mapped = billerList.map((b: any) => ({
            biller_id: b.billerId,
            biller_name: b.billerName,
            category: b.category,
            metadata: b
          }));

          // Upsert into Supabase in batches of 100 to avoid request overload
          for (let i = 0; i < mapped.length; i += 100) {
            const chunk = mapped.slice(i, i + 100);
            await supabaseAdmin.from('billavenue_billers').upsert(chunk);
          }
        } else {
          // Single biller: Inject interchangeFeeCCF1 metadata if missing
          const b = response.json.billerInfoResponse.biller;
          if (b) {
            if (!b.interchangeFeeCCF1) {
              b.interchangeFeeCCF1 = {
                feeCode: 'CCF1',
                feeDirection: 'C2B',
                flatFee: '100', // 100 paise = ₹1.00
                percentFee: '1.2', // 1.2%
                feeMinAmt: '1',
                feeMaxAmt: '2147483647'
              };
            }
            // Save/Cache the details back to Supabase database so subsequent fallbacks contain parameters!
            try {
              await supabaseAdmin.from('billavenue_billers').upsert({
                biller_id: b.billerId,
                biller_name: b.billerName,
                category: b.category || b.billerCategoryName || 'Credit Card',
                metadata: b
              });
              console.log(`[BillAvenue Server] Dynamically cached single biller metadata for ${b.billerId}`);
            } catch (cacheErr: any) {
              console.warn(`[BillAvenue Server] Failed to cache single biller ${b.billerId}:`, cacheErr.message);
            }
          }
        }
        return res.json(response.json);
      }

      // Fallback to Supabase database
      console.log("[BillAvenue Server] Loading from database fallback...");
      if (billerId) {
        const { data: dbBiller, error: dbError } = await supabaseAdmin
          .from('billavenue_billers')
          .select('*')
          .eq('biller_id', billerId)
          .maybeSingle();

        if (dbError) throw dbError;
        if (!dbBiller) {
          return res.status(404).json({ status: "ERROR", message: "Biller not found in API or database." });
        }

        const metadata = { ...dbBiller.metadata };
        if (!metadata.interchangeFeeCCF1) {
          metadata.interchangeFeeCCF1 = {
            feeCode: 'CCF1',
            feeDirection: 'C2B',
            flatFee: '100', // 100 paise = ₹1.00
            percentFee: '1.2', // 1.2%
            feeMinAmt: '1',
            feeMaxAmt: '2147483647'
          };
        }

        return res.json({
          billerInfoResponse: {
            responseCode: '0000',
            biller: metadata
          }
        });
      } else {
        let dbBillers: any[] = [];
        let from = 0;
        const limit = 1000;
        while (true) {
          const { data, error: dbError } = await supabaseAdmin
            .from('billavenue_billers')
            .select('*')
            .range(from, from + limit - 1);
          
          if (dbError) throw dbError;
          if (!data || data.length === 0) break;
          
          dbBillers.push(...data);
          if (data.length < limit) break;
          from += limit;
        }
        return res.json({
          billerInfoResponse: {
            responseCode: '0000',
            biller: dbBillers ? dbBillers.map((b: any) => b.metadata) : []
          }
        });
      }
    } catch (error: any) {
      console.error("[BillAvenue Server] Fetch Billers Error:", error);
      res.status(500).json({ status: "ERROR", message: error.message });
    }
  });

  app.get("/api/bbps/test-connection", async (req, res) => {
    const results: any = {
      timestamp: new Date().toISOString(),
      testStaging: null,
      testProduction: null,
      gitLog: 'unknown',
      serverTsModified: 'unknown'
    };

    try {
      const { execSync } = await import('child_process');
      results.gitLog = execSync('git log -n 1 --oneline').toString().trim();
    } catch (e: any) {
      results.gitLog = 'Error: ' + e.message;
    }

    try {
      const fs = await import('fs');
      const stats = fs.statSync('server.ts');
      results.serverTsModified = stats.mtime.toISOString();
    } catch (e: any) {
      results.serverTsModified = 'Error: ' + e.message;
    }

    // Staging test
    try {
      const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?><billerInfoRequest></billerInfoRequest>`;
      const requestId = billAvenue.generateRequestId();
      const encRequest = billAvenue.encryptRequest(xmlPayload);
      const postParams = new URLSearchParams();
      const accessCode = (process.env.BILLAVENUE_ACCESS_CODE || 'AVVA15FZ56VG89FFEB').replace(/['"]/g, '').trim();
      const instituteId = (process.env.BILLAVENUE_INSTITUTE_ID || 'UF01').replace(/['"]/g, '').trim();
      postParams.append('accessCode', accessCode);
      postParams.append('requestId', requestId);
      postParams.append('encRequest', encRequest);
      postParams.append('ver', '1.0');
      postParams.append('instituteId', instituteId);

      const stgResponse = await fetch('https://stgapi.billavenue.com/billpay/extMdmCntrl/mdmRequestNew/xml', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: postParams.toString()
      });

      const stgText = await stgResponse.text();
      results.testStaging = {
        status: stgResponse.status,
        contentType: stgResponse.headers.get('content-type'),
        isHtmlAccessDenied: stgText.includes('Unauthorized Access Detected') || stgText.includes('Access Denied'),
        snippet: stgText.substring(0, 500)
      };
    } catch (err: any) {
      results.testStaging = { error: err.message };
    }

    // Production test
    try {
      const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?><billerInfoRequest></billerInfoRequest>`;
      const requestId = billAvenue.generateRequestId();
      const encRequest = billAvenue.encryptRequest(xmlPayload);
      const postParams = new URLSearchParams();
      const accessCode = (process.env.BILLAVENUE_ACCESS_CODE || 'AVVA15FZ56VG89FFEB').replace(/['"]/g, '').trim();
      const instituteId = (process.env.BILLAVENUE_INSTITUTE_ID || 'UF01').replace(/['"]/g, '').trim();
      postParams.append('accessCode', accessCode);
      postParams.append('requestId', requestId);
      postParams.append('encRequest', encRequest);
      postParams.append('ver', '1.0');
      postParams.append('instituteId', instituteId);

      const prodResponse = await fetch('https://api.billavenue.com/billpay/extMdmCntrl/mdmRequestNew/xml', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: postParams.toString()
      });

      const prodText = await prodResponse.text();
      results.testProduction = {
        status: prodResponse.status,
        contentType: prodResponse.headers.get('content-type'),
        isHtmlAccessDenied: prodText.includes('Unauthorized Access Detected') || prodText.includes('Access Denied'),
        snippet: prodText.substring(0, 500)
      };
    } catch (err: any) {
      results.testProduction = { error: err.message };
    }

    res.json(results);
  });

  app.get("/api/bbps/test-fetch", async (req, res) => {
    try {
      const { id, param, val, mobile } = req.query;
      const billerId = String(id || "TORR00000NATLX");
      const key = String(param || "Service Number");
      const value = String(val || "100000001");
      const mob = String(mobile || "9998120909");
      const response = await billAvenue.fetchBill(billerId, { [key]: value }, mob);
      res.json({
        rawXml: response.rawXml,
        json: response.json,
        sentBillerId: billerId,
        sentParams: { [key]: value }
      });
    } catch (error: any) {
      console.error("[BillAvenue Server] Test Fetch Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/bbps/test-sbi", async (req, res) => {
    try {
      const { ca, mobile, ca_key, mobile_key } = req.query;
      if (!ca || !mobile) {
         return res.json({ error: "Missing ?ca= or ?mobile=" });
      }
      const params = {
         [String(ca_key || "Last 4 Digits of Credit Card")]: String(ca),
         [String(mobile_key || "Registered Mobile No")]: String(mobile)
      };
      const response = await billAvenue.fetchBill("SBIC00000NATDN", params, String(mobile));
      res.json({
        rawXml: response.rawXml,
        json: response.json,
        sentParams: params
      });
    } catch (error: any) {
      console.error("[BillAvenue Server] Test SBI Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/bbps/test-mdm", async (req, res) => {
    try {
      const { id } = req.query;
      const billerId = String(id || "SBIC00000NATDN");
      const response = await billAvenue.getBillers(billerId);
      res.json({
        rawXml: response.rawXml,
        json: response.json
      });
    } catch (error: any) {
      console.error("[BillAvenue Server] Test MDM Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/bbps/test-multiple-fetches", async (req, res) => {
    const billersToTest = [
      { id: 'TORR00000ELE', params: { 'Service Number': '100000001' }, mobile: '9998120909' },
      { id: 'ADAN00000GAS', params: { 'Customer ID': '100000001' }, mobile: '9998120909' },
      { id: 'AMCW00000WAT', params: { 'Tenement Number': '100000001' }, mobile: '9998120909' },
      { id: 'AIRT00000PRE', params: { 'Mobile Number': '9998120909' }, mobile: '9998120909' },
      { id: 'SBIC000000CC', params: { 'Card Number': '1234567890123456', 'Mobile Number': '9998120909' }, mobile: '9998120909' }
    ];

    const results: any[] = [];

    for (const b of billersToTest) {
      try {
        const response = await billAvenue.fetchBill(b.id, b.params, b.mobile);
        results.push({
          billerId: b.id,
          responseCode: response.json?.billFetchResponse?.responseCode || billAvenue.parseXmlValue(response.rawXml, 'responseCode'),
          reason: response.json?.billFetchResponse?.errorInfo?.error?.errorMessage || billAvenue.parseXmlValue(response.rawXml, 'errorMessage') || 'Biller Valid / Success',
          json: response.json
        });
      } catch (err: any) {
        results.push({
          billerId: b.id,
          error: err.message
        });
      }
    }

    res.json(results);
  });

  app.get("/api/bbps/test-billers", async (req, res) => {
    try {
      const response = await billAvenue.getBillers();
      const rawXml = response.rawXml;
      const json = response.json;

      const billerRegex = /<biller>([\s\S]*?)<\/biller>/g;
      const billersList: any[] = [];
      let match;
      while ((match = billerRegex.exec(rawXml)) !== null) {
        const content = match[1];
        const billerId = billAvenue.parseXmlValue(content, 'billerId');
        const billerName = billAvenue.parseXmlValue(content, 'billerName');
        const categoryName = billAvenue.parseXmlValue(content, 'categoryName');
        billersList.push({ billerId, billerName, categoryName });
      }

      const torrents = billersList.filter(b => b.billerName.toLowerCase().includes('torrent') || b.billerId.toLowerCase().includes('torr'));
      const sampleElec = billersList.filter(b => b.categoryName.toLowerCase().includes('elect')).slice(0, 20);

      res.json({
        totalBillers: billersList.length,
        rawXml,
        json,
        torrents,
        sampleElectricity: sampleElec,
        sampleBillers: billersList.slice(0, 20)
      });
    } catch (error: any) {
      console.error("[BillAvenue Server] Test Billers Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/bbps/fetch", async (req, res) => {
    try {
      const { billerId, customerParams, customerMobile } = req.body;
      if (!billerId || !customerParams || !customerMobile) {
        return res.status(400).json({ status: "ERROR", message: "Missing required parameters." });
      }

      const isStaging = process.env.BILLAVENUE_ENV !== 'production';

      // Attempt to load category/name from DB to make mock realistic
      let billerCategory = 'Utility';
      let billerName = 'UAT Test Biller';
      try {
        const { data: dbBiller } = await supabaseAdmin
          .from('billavenue_billers')
          .select('category, biller_name')
          .eq('biller_id', billerId)
          .maybeSingle();
        if (dbBiller) {
          billerCategory = dbBiller.category || 'Utility';
          billerName = dbBiller.biller_name || 'UAT Test Biller';
        }
      } catch (dbErr) {
        console.warn('Failed to load biller info for mock:', dbErr);
      }

      const getMockResponse = () => ({
        billFetchResponse: {
          responseCode: '0000',
          responseReason: 'Successful',
          customerName: 'Sumit C Patel',
          billAmount: '10000', // ₹100.00 (in paise)
          dueDate: '2026-06-30',
          billNumber: 'BILL998811',
          billDate: '2026-06-01',
          billPeriod: 'Monthly',
          additionalInfo: {
            info: [
              { infoName: 'Consumer ID', infoValue: customerParams[Object.keys(customerParams)[0]] || '123456' },
              { infoName: 'Biller Name', infoValue: billerName },
              { infoName: 'Category', infoValue: billerCategory }
            ]
          }
        }
      });

      const isCreditCard = billerCategory === 'Credit Card' || billerCategory?.toLowerCase()?.includes('card');
      const initChannel = isCreditCard ? 'INT' : 'AGT';

      try {
        const response = await billAvenue.fetchBill(billerId, customerParams, customerMobile, initChannel);
        const responseCode = response.json?.billFetchResponse?.responseCode;
        if (isStaging && responseCode !== '0000') {
          console.log(`[BillAvenue Proxy] Staging: Biller ${billerId} returned API error ${responseCode}. Returning Mock Staging Bill.`);
          return res.json(getMockResponse());
        }
        return res.json(response.json);
      } catch (apiError: any) {
        console.warn(`[BillAvenue Proxy] Fetch failed, checking if staging mock is possible for ${billerId}:`, apiError.message);
        if (isStaging) {
          console.log(`[BillAvenue Proxy] Returning Mock Staging Bill for biller: ${billerId}`);
          return res.json(getMockResponse());
        }
        throw apiError;
      }
    } catch (error: any) {
      console.error("[BillAvenue Server] Fetch Bill Error:", error);
      res.status(500).json({ status: "ERROR", message: error.message });
    }
  });

  app.post("/api/bbps/validate", async (req, res) => {
    try {
      const { billerId, customerParams, customerMobile } = req.body;
      if (!billerId || !customerParams || !customerMobile) {
        return res.status(400).json({ status: "ERROR", message: "Missing required parameters." });
      }
      const response = await billAvenue.validateBill(billerId, customerParams, customerMobile);
      res.json(response.json);
    } catch (error: any) {
      console.error("[BillAvenue Server] Validate Bill Error:", error);
      res.status(500).json({ status: "ERROR", message: error.message });
    }
  });

  app.post("/api/bbps/pay", async (req, res) => {
    try {
      const { userId, billerId, customerParams, customerMobile, amount, paymentMode, quickPay, ccf1, billDetails } = req.body;

      if (!userId || !billerId || !customerMobile || !amount) {
        return res.status(400).json({ status: "ERROR", message: "Missing required parameters." });
      }

      const paymentAmount = Number(amount);
      if (isNaN(paymentAmount) || paymentAmount <= 0) {
        return res.status(400).json({ status: "ERROR", message: "Invalid amount specified." });
      }

      // 1. Fetch user's current wallet balance and service charge settings
      const { data: user, error: userError } = await supabaseAdmin
        .from("users_profiles")
        .select("wallet_balance, service_charge_enabled, custom_service_charge, email, name")
        .eq("id", userId)
        .single();

      if (userError || !user) {
        return res.status(400).json({ status: "ERROR", message: "User profile not found." });
      }

      const currentBalance = Number(user.wallet_balance) || 0;

      // 1.5 Fetch active service charge slabs to compute commission fee
      const { data: slabs, error: slabsError } = await supabaseAdmin
        .from("service_charge_slabs")
        .select("*")
        .eq("is_active", true)
        .order("min_amount", { ascending: true });

      if (slabsError) {
        console.error("[BillAvenue Proxy] Error fetching slabs:", slabsError);
      }

      let serviceCharge = 0;
      if (user.service_charge_enabled) {
        serviceCharge = Number(user.custom_service_charge) || 0;
      } else if (slabs && slabs.length > 0) {
        const slab = slabs.find(s => paymentAmount >= Number(s.min_amount) && paymentAmount <= Number(s.max_amount));
        if (slab) {
          if (slab.is_percentage) {
            serviceCharge = (paymentAmount * Number(slab.charge_amount)) / 100;
          } else {
            serviceCharge = Number(slab.charge_amount);
          }
        }
      }

      // Convert ccf1 from paisa to Rupees and add to wallet deduction
      const ccf1InRupees = ccf1 !== undefined ? Number(ccf1) / 100 : 0;
      const totalDeduction = paymentAmount + serviceCharge + ccf1InRupees;

      // 2. Enforce minimum ₹250 wallet balance rule taking calculated charges into account
      if (currentBalance - totalDeduction < 250) {
        return res.status(400).json({
          status: "ERROR",
          message: `Insufficient balance. You must maintain at least ₹250 in your wallet after payment (Bill Amount: ₹${paymentAmount} + Service Charge: ₹${serviceCharge} + Convenience Fee: ₹${ccf1InRupees}).`
        });
      }

      // Look up biller category to determine channel (Credit Card uses INT, others use AGT)
      let initChannel = 'AGT';
      try {
        const { data: dbBiller } = await supabaseAdmin
          .from('billavenue_billers')
          .select('category')
          .eq('biller_id', billerId)
          .maybeSingle();
        if (dbBiller && (dbBiller.category === 'Credit Card' || dbBiller.category?.toLowerCase()?.includes('card'))) {
          initChannel = 'INT';
        }
      } catch (dbErr) {
        console.warn('Failed to load biller info for pay channel mapping, defaulting to AGT:', dbErr);
      }

      // 3. Call BillAvenue pay API
      let apiResponse;
      try {
        apiResponse = await billAvenue.payBill(
          billerId,
          customerParams,
          customerMobile,
          paymentAmount,
          paymentMode || 'UPI',
          quickPay || 'N',
          ccf1 !== undefined ? Number(ccf1) : undefined,
          billDetails,
          user.name || 'Valued Customer',
          initChannel
        );
      } catch (payApiError: any) {
        console.warn(`[BillAvenue Proxy] Pay failed, checking if staging mock is possible for ${billerId}:`, payApiError.message);
        const isStaging = process.env.BILLAVENUE_ENV !== 'production';
        if (isStaging) {
          console.log(`[BillAvenue Proxy] Returning Mock Staging Pay response for biller: ${billerId}`);
          apiResponse = {
            requestId: 'MOCK' + Math.random().toString(36).substring(2, 9).toUpperCase(),
            json: {
              billPayResponse: {
                responseCode: '0000',
                responseReason: 'Successful',
                txnRefId: 'CC01' + Math.floor(100000000000 + Math.random() * 900000000000),
                status: 'success',
                CustConvFee: ccf1 !== undefined ? String(ccf1) : '0'
              }
            }
          };
        } else {
          throw payApiError;
        }
      }

      const isStaging = process.env.BILLAVENUE_ENV !== 'production';

      const responseJson = apiResponse.json;
      let payResponse = responseJson?.ExtBillPayResponse || responseJson?.extBillPayResponse || responseJson?.billPayResponse;
      let responseCode = payResponse?.responseCode;
      let txnRefId = payResponse?.txnRefId;

      let isSuccess = responseCode === '0000' || responseCode === '000' || responseCode?.toString().toLowerCase() === 'success' || payResponse?.status?.toString().toLowerCase() === 'success';

      if (!isSuccess && isStaging) {
        console.log(`[BillAvenue Proxy] Staging: Biller ${billerId} payment failed with ${responseCode}. Mocking success.`);
        payResponse = {
          responseCode: '0000',
          responseReason: 'Successful',
          txnRefId: 'CC01' + Math.floor(100000000000 + Math.random() * 900000000000),
          status: 'success',
          CustConvFee: ccf1 !== undefined ? String(ccf1) : '0'
        };
        responseCode = '0000';
        txnRefId = payResponse.txnRefId;
        isSuccess = true;
      }

      if (isSuccess || responseCode === '0000' || responseCode === '000') {
        const newBalance = currentBalance - totalDeduction;

        // 4. Deduct wallet balance in Supabase
        const { error: updateError } = await supabaseAdmin
          .from("users_profiles")
          .update({ wallet_balance: newBalance })
          .eq("id", userId);

        if (updateError) {
          console.error("[CRITICAL] Wallet deduction failed for completed BillAvenue transaction:", updateError);
        }

        // 5. Log transaction into billavenue_transactions
        await supabaseAdmin
          .from("billavenue_transactions")
          .insert({
            request_id: apiResponse.requestId,
            txn_ref_id: txnRefId || `TXN${Math.floor(100000 + Math.random() * 900000)}`,
            customer_mobile: customerMobile,
            amount: paymentAmount,
            status: "success",
            response: responseJson
          });

        // 6. Also log into bbps_submissions for unified reporting / analytics
        await supabaseAdmin
          .from("bbps_submissions")
          .insert({
            user_id: userId,
            service_type: "BillAvenue BBPS",
            provider: billerId,
            consumer_number: customerParams[Object.keys(customerParams)[0]] || "BA Account",
            amount: paymentAmount,
            charges: serviceCharge,
            status: "approved",
            rejection_reason: txnRefId || apiResponse.requestId,
            metadata: {
              gateway: "BillAvenue",
              requestId: apiResponse.requestId,
              customerParams,
              paymentMode: paymentMode || 'UPI'
            }
          });

        // Send email alert (Obs 8)
        try {
          if (user?.email) {
            let billerName = "Bharat Connect Biller";
            try {
              const { data: dbBiller } = await supabaseAdmin
                .from('billavenue_billers')
                .select('biller_name')
                .eq('biller_id', billerId)
                .maybeSingle();
              if (dbBiller?.biller_name) {
                billerName = dbBiller.biller_name;
              }
            } catch (dbErr) {
              console.warn('Failed to load biller name for email:', dbErr);
            }

            const consumerNo = customerParams ? (customerParams[Object.keys(customerParams)[0]] || "N/A") : "N/A";
            const dateTime = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) + " IST";
            const paymentChannel = "Internet (WEB)";

            const subject = `Payment Successful - B-Connect Txn Ref ID: ${txnRefId || apiResponse.requestId}`;
            const text = `Thank you for payment of ₹${paymentAmount} against ${billerName}, Consumer no ${consumerNo}, B-connect Txn Ref ID ${txnRefId || apiResponse.requestId} on ${dateTime} vide ${paymentChannel}.`;

            const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Payment Successful</title>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background-color: #f3f4f6;
      color: #1f2937;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 600px;
      margin: 40px auto;
      background-color: #ffffff;
      border-radius: 12px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
      overflow: hidden;
      border: 1px solid #e5e7eb;
    }
    .header {
      background-color: #0f172a;
      padding: 24px;
      text-align: center;
    }
    .header h1 {
      color: #ffffff;
      margin: 0;
      font-size: 24px;
      font-weight: 600;
      letter-spacing: 0.5px;
    }
    .header .subtitle {
      color: #10b981;
      font-size: 14px;
      margin-top: 4px;
      text-transform: uppercase;
      font-weight: 700;
      letter-spacing: 1px;
    }
    .content {
      padding: 32px 24px;
    }
    .greeting {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 16px;
      color: #111827;
    }
    .message {
      font-size: 16px;
      line-height: 1.6;
      color: #4b5563;
      margin-bottom: 24px;
    }
    .payment-card {
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 24px;
    }
    .payment-title {
      font-size: 14px;
      text-transform: uppercase;
      color: #64748b;
      font-weight: 600;
      margin-bottom: 12px;
      letter-spacing: 0.5px;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #e2e8f0;
    }
    .info-row:last-child {
      border-bottom: none;
      padding-bottom: 0;
    }
    .info-label {
      font-weight: 500;
      color: #64748b;
    }
    .info-value {
      font-weight: 600;
      color: #0f172a;
      text-align: right;
    }
    .bbps-badge {
      display: inline-block;
      background-color: #ecfdf5;
      border: 1px solid #a7f3d0;
      color: #047857;
      padding: 6px 12px;
      border-radius: 9999px;
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 24px;
    }
    .footer {
      background-color: #f8fafc;
      padding: 24px;
      text-align: center;
      font-size: 12px;
      color: #64748b;
      border-top: 1px solid #e2e8f0;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>UsePay</h1>
      <div class="subtitle">Bharat Connect (B-Connect)</div>
    </div>
    <div class="content">
      <div class="greeting">Hello, ${user.name || "Customer"}</div>
      <div class="bbps-badge">✓ Payment Successful</div>
      <div class="message">
        Thank you for payment of ₹${paymentAmount} against ${billerName}, Consumer no ${consumerNo}, B-connect Txn Ref ID ${txnRefId || apiResponse.requestId} on ${dateTime} vide ${paymentChannel}.
      </div>
      <div class="payment-card">
        <div class="payment-title">Payment Transaction Details</div>
        <div class="info-row">
          <span class="info-label">B-Connect Txn Ref ID</span>
          <span class="info-value" style="color: #059669;">${txnRefId || apiResponse.requestId}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Biller Name</span>
          <span class="info-value">${billerName}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Consumer Number</span>
          <span class="info-value">${consumerNo}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Amount Paid</span>
          <span class="info-value">₹${paymentAmount.toFixed(2)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Transaction Date & Time</span>
          <span class="info-value">${dateTime}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Payment Channel</span>
          <span class="info-value">${paymentChannel}</span>
        </div>
      </div>
    </div>
    <div class="footer">
      This is an automated email notification from UsePay. Please do not reply directly to this message.<br>
      &copy; 2026 UsePay. All rights reserved.
    </div>
  </div>
</body>
</html>`;

            sendResendEmail(user.email, subject, text, html)
              .then(() => {
                console.log(`[BillAvenue Server] Payment confirmation email sent successfully to ${user.email} via Resend`);
              })
              .catch((emailErr) => {
                console.error("[BillAvenue Server] Error sending payment confirmation email:", emailErr.message);
              });
          }
        } catch (emailErr) {
          console.error("[BillAvenue Server] Error triggering payment confirmation email:", emailErr);
        }

        return res.json({
          status: "SUCCESS",
          message: "Transaction SUCCESS",
          new_balance: newBalance,
          charges: serviceCharge,
          data: payResponse
        });
      } else {
        // Log failed transaction
        await supabaseAdmin
          .from("billavenue_transactions")
          .insert({
            request_id: apiResponse.requestId,
            txn_ref_id: txnRefId || 'N/A',
            customer_mobile: customerMobile,
            amount: paymentAmount,
            status: "failed",
            response: responseJson
          });

        return res.json({
          status: "FAILED",
          message: payResponse?.responseReason || "Transaction failed at BillAvenue Gateway.",
          data: payResponse
        });
      }

    } catch (error: any) {
      console.error("[BillAvenue Server] Pay Bill Error:", error);
      res.status(500).json({ status: "ERROR", message: error.message });
    }
  });

  app.get("/api/bbps/status", async (req, res) => {
    try {
      const { requestId, trackType } = req.query;
      if (!requestId) {
        return res.status(400).json({ status: "ERROR", message: "requestId parameter is required." });
      }
      const response = await billAvenue.getTransactionStatus(requestId as string, trackType as string);

      const statusResponse = response.json?.transactionStatusResp || response.json?.transactionStatusResponse;
      if (statusResponse) {
        const txnStatus = statusResponse.status?.toLowerCase();
        let mappedStatus: 'success' | 'failed' | 'pending' = 'pending';
        if (txnStatus === 'success' || txnStatus === 'approved') mappedStatus = 'success';
        else if (txnStatus === 'failed' || txnStatus === 'rejected') mappedStatus = 'failed';

        await supabaseAdmin
          .from("billavenue_transactions")
          .update({
            txn_ref_id: statusResponse.txnRefId,
            status: mappedStatus,
            response: response.json
          })
          .eq("request_id", requestId);
      }

      res.json(response.json);
    } catch (error: any) {
      console.error("[BillAvenue Server] Check Status Error:", error);
      res.status(500).json({ status: "ERROR", message: error.message });
    }
  });

  app.get("/api/bbps/plans", async (req, res) => {
    try {
      const { billerId } = req.query;
      if (!billerId) {
        return res.status(400).json({ status: "ERROR", message: "billerId parameter is required." });
      }
      const response = await billAvenue.getPlans(billerId as string);

      const plansResponse = response.json?.planMdmResponse;
      if (plansResponse?.planList?.plan) {
        const planList = Array.isArray(plansResponse.planList.plan)
          ? plansResponse.planList.plan
          : [plansResponse.planList.plan];

        const mapped = planList.map((p: any) => ({
          biller_id: billerId as string,
          plan_name: p.planName || p.talktime || 'Recharge Plan',
          amount: Number(p.amount) || 0,
          validity: p.validity,
          description: p.description,
          metadata: p
        }));

        await supabaseAdmin.from('billavenue_plans').delete().eq('biller_id', billerId);
        for (let i = 0; i < mapped.length; i += 100) {
          const chunk = mapped.slice(i, i + 100);
          await supabaseAdmin.from('billavenue_plans').insert(chunk);
        }
      }

      res.json(response.json);
    } catch (error: any) {
      console.error("[BillAvenue Server] Fetch Plans Error:", error);
      res.status(500).json({ status: "ERROR", message: error.message });
    }
  });

  app.post("/api/bbps/complaint/register", async (req, res) => {
    try {
      const { complaintType, txnRefId, complaintDesc, mobile, dateRange } = req.body;
      if ((!txnRefId && !dateRange) || !complaintDesc || !mobile) {
        return res.status(400).json({ status: "ERROR", message: "Missing required parameters." });
      }

      const isStaging = process.env.BILLAVENUE_ENV !== "production";
      let finalTxnRefId = txnRefId;

      if (!finalTxnRefId && dateRange?.startDate && dateRange?.endDate) {
        try {
          const { data: txns } = await supabaseAdmin
            .from("billavenue_transactions")
            .select("txn_ref_id")
            .eq("customer_mobile", mobile)
            .gte("created_at", new Date(dateRange.startDate).toISOString())
            .lte("created_at", new Date(dateRange.endDate).toISOString())
            .order("created_at", { ascending: false });

          if (txns && txns.length > 0) {
            finalTxnRefId = txns[0].txn_ref_id;
          }
        } catch (dbErr) {
          console.error("[BillAvenue Server] Error searching transaction:", dbErr);
        }

        if (!finalTxnRefId) {
          if (isStaging) {
            finalTxnRefId = `CC01${Math.floor(1000000000000000 + Math.random() * 9000000000000000)}`;
          } else {
            return res.status(400).json({ status: "ERROR", message: "No transaction found matching the mobile number and date range." });
          }
        }
      }

      let responseJson: any = null;
      let requestId = `REQ${Math.floor(100000 + Math.random() * 900000)}`;

      try {
        const response = await billAvenue.registerComplaint(complaintType, finalTxnRefId, complaintDesc, mobile);
        responseJson = response.json;
        requestId = response.requestId;
      } catch (apiError: any) {
        console.warn("[BillAvenue Server] Register Complaint failed, checking if staging mock is possible:", apiError.message);
        if (isStaging) {
          console.log("[BillAvenue Server] Returning Mock Staging Complaint registration");
          const mockComplaintId = `COM${Math.floor(100000000000 + Math.random() * 900000000000)}`;
          responseJson = {
            complaintResponse: {
              responseCode: "0000",
              complaintId: mockComplaintId,
              status: "SUCCESS",
              desc: "Complaint Registered Successfully (Mock)"
            }
          };
        } else {
          throw apiError;
        }
      }

      // Fallback if live response succeeded but did not return a complaint ID (in staging)
      const registerResponse = responseJson?.complaintRegistrationResp || responseJson?.complaintResponse;
      if (!registerResponse?.complaintId && isStaging) {
        console.log("[BillAvenue Server] Live response has no complaintId in staging. Injecting mock staging response.");
        const mockComplaintId = `COM${Math.floor(100000000000 + Math.random() * 900000000000)}`;
        responseJson = {
          complaintResponse: {
            responseCode: "0000",
            complaintId: mockComplaintId,
            status: "SUCCESS",
            desc: "Complaint Registered Successfully (Mock)"
          }
        };
      }

      const finalRegisterResponse = responseJson?.complaintRegistrationResp || responseJson?.complaintResponse;
      if (finalRegisterResponse?.complaintId) {
        try {
          await supabaseAdmin
            .from("billavenue_complaints")
            .insert({
              complaint_id: finalRegisterResponse.complaintId,
              request_id: requestId,
              customer_mobile: mobile,
              status: "pending",
              response: responseJson
            });
        } catch (dbError) {
          console.error("[BillAvenue Server] DB Insert Complaint Error:", dbError);
        }

        // Email Notification Logic
        try {
          const { data: profile } = await supabaseAdmin
            .from("users_profiles")
            .select("email, name")
            .eq("mobile_number", mobile)
            .single();

          if (profile?.email) {
            const userEmail = profile.email;
            const userName = profile.name || "Customer";
            const complaintId = finalRegisterResponse.complaintId;

            const subject = `Bharat Connect Complaint Registered - ${complaintId}`;
            const text = `Your Complaint has been registered successfully for B-connect Txn Ref ID ${finalTxnRefId}. Your Complaint ID is ${complaintId}. You can track status of your complaint using your Complaint ID.`;
            const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>BBPS Complaint Registered</title>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background-color: #f3f4f6;
      color: #1f2937;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 600px;
      margin: 40px auto;
      background-color: #ffffff;
      border-radius: 12px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
      overflow: hidden;
      border: 1px solid #e5e7eb;
    }
    .header {
      background-color: #0f172a;
      padding: 24px;
      text-align: center;
    }
    .header h1 {
      color: #ffffff;
      margin: 0;
      font-size: 24px;
      font-weight: 600;
      letter-spacing: 0.5px;
    }
    .header .subtitle {
      color: #38bdf8;
      font-size: 14px;
      margin-top: 4px;
      text-transform: uppercase;
      font-weight: 700;
      letter-spacing: 1px;
    }
    .content {
      padding: 32px 24px;
    }
    .greeting {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 16px;
      color: #111827;
    }
    .message {
      font-size: 16px;
      line-height: 1.6;
      color: #4b5563;
      margin-bottom: 24px;
    }
    .complaint-card {
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 24px;
    }
    .complaint-title {
      font-size: 14px;
      text-transform: uppercase;
      color: #64748b;
      font-weight: 600;
      margin-bottom: 12px;
      letter-spacing: 0.5px;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #e2e8f0;
    }
    .info-row:last-child {
      border-bottom: none;
      padding-bottom: 0;
    }
    .info-label {
      font-weight: 500;
      color: #64748b;
    }
    .info-value {
      font-weight: 600;
      color: #0f172a;
      text-align: right;
    }
    .bbps-badge {
      display: inline-block;
      background-color: #f0fdf4;
      border: 1px solid #bbf7d0;
      color: #166534;
      padding: 6px 12px;
      border-radius: 9999px;
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 24px;
    }
    .footer {
      background-color: #f8fafc;
      padding: 24px;
      text-align: center;
      font-size: 12px;
      color: #64748b;
      border-top: 1px solid #e2e8f0;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>UsePay</h1>
      <div class="subtitle">Bharat Connect (B-Connect)</div>
    </div>
    <div class="content">
      <div class="greeting">Hello, ${userName}</div>
      <div class="bbps-badge">✓ Bharat Connect Registered</div>
      <div class="message">
        Your Complaint has been registered successfully for B-connect Txn Ref ID <strong>${finalTxnRefId}</strong>. Your Complaint ID is <strong>${complaintId}</strong>. You can track status of your complaint using your Complaint ID.
      </div>
      <div class="complaint-card">
        <div class="complaint-title">Complaint Details</div>
        <div class="info-row">
          <span class="info-label">Complaint ID</span>
          <span class="info-value" style="color: #2563eb;">${complaintId}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Complaint Type</span>
          <span class="info-value">${complaintType || 'N/A'}</span>
        </div>
        ${finalTxnRefId ? `
        <div class="info-row">
          <span class="info-label">Transaction Ref ID</span>
          <span class="info-value">${finalTxnRefId}</span>
        </div>
        ` : ''}
        <div class="info-row">
          <span class="info-label">Mobile Number</span>
          <span class="info-value">${mobile}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Registration Date</span>
          <span class="info-value">${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</span>
        </div>
      </div>
      <div class="message" style="font-size: 14px; color: #64748b;">
        Our support team and Bharat BillPay will review your concern. You can track your complaint status anytime using the Complaint ID in your UsePay dashboard.
      </div>
    </div>
    <div class="footer">
      This is an automated email notification from UsePay. Please do not reply directly to this message.<br>
      &copy; 2026 UsePay. All rights reserved.
    </div>
  </div>
</body>
</html>`;

            sendResendEmail(userEmail, subject, text, html)
              .then(() => {
                console.log(`[BillAvenue Server] Confirmation email sent successfully to ${userEmail} for complaint ${complaintId} via Resend`);
              })
              .catch((emailErr) => {
                console.error("[BillAvenue Server] Error sending confirmation email (async via Resend):", emailErr.message);
              });
          } else {
            console.warn(`[BillAvenue Server] No email found for mobile: ${mobile}. Skipping email dispatch.`);
          }
        } catch (emailErr) {
          console.error("[BillAvenue Server] Error sending confirmation email:", emailErr);
        }
      }

      res.json(responseJson);
    } catch (error: any) {
      console.error("[BillAvenue Server] Register Complaint Error:", error);
      res.status(500).json({ status: "ERROR", message: error.message });
    }
  });

  app.post("/api/bbps/complaint/track", async (req, res) => {
    try {
      const { complaintId, mobile } = req.body;
      if (!complaintId || !mobile) {
        return res.status(400).json({ status: "ERROR", message: "Missing required parameters." });
      }

      const isStaging = process.env.BILLAVENUE_ENV !== "production";
      let responseJson: any = null;

      try {
        const response = await billAvenue.trackComplaint(complaintId, mobile);
        responseJson = response.json;
      } catch (apiError: any) {
        console.warn("[BillAvenue Server] Track Complaint failed, checking if staging mock is possible:", apiError.message);
        if (isStaging) {
          console.log("[BillAvenue Server] Returning Mock Staging Complaint tracking status");
          responseJson = {
            complaintTrackResponse: {
              responseCode: "0000",
              complaintId: complaintId,
              status: "RESOLVED",
              desc: "Complaint has been resolved (Mock)"
            }
          };
        } else {
          throw apiError;
        }
      }

      const trackResponse = responseJson?.complaintTrackingResp || responseJson?.complaintTrackResponse;
      if (!trackResponse && isStaging) {
        responseJson = {
          complaintTrackResponse: {
            responseCode: "0000",
            complaintId: complaintId,
            status: "RESOLVED",
            desc: "Complaint has been resolved (Mock)"
          }
        };
      }

      const finalTrackResponse = responseJson?.complaintTrackingResp || responseJson?.complaintTrackResponse;
      if (finalTrackResponse) {
        const cStatus = finalTrackResponse.status?.toLowerCase();
        let mappedStatus: 'pending' | 'resolved' | 'failed' = 'pending';
        if (cStatus === 'resolved' || cStatus === 'success') mappedStatus = 'resolved';
        else if (cStatus === 'failed' || cStatus === 'rejected') mappedStatus = 'failed';

        try {
          await supabaseAdmin
            .from("billavenue_complaints")
            .update({
              status: mappedStatus,
              response: responseJson
            })
            .eq("complaint_id", complaintId);
        } catch (dbError) {
          console.error("[BillAvenue Server] DB Update Complaint Error:", dbError);
        }
      }

      res.json(responseJson);
    } catch (error: any) {
      console.error("[BillAvenue Server] Track Complaint Error:", error);
      res.status(500).json({ status: "ERROR", message: error.message });
    }
  });

  // ==========================================
  // BILLAVENUE PREPAID RECHARGE API ROUTES
  // ==========================================

  app.get("/api/recharge/operators", async (req, res) => {
    try {
      const response = await recharge.getRechargeOperators();
      res.json(response);
    } catch (error: any) {
      console.error("[Recharge API] Get Operators Error:", error);
      res.status(500).json({ status: "ERROR", message: error.message });
    }
  });

  app.post("/api/recharge/mnp", async (req, res) => {
    try {
      const { mobile } = req.body;
      if (!mobile) {
        return res.status(400).json({ status: "ERROR", message: "Mobile number is required." });
      }

      const isStaging = process.env.BILLAVENUE_ENV !== 'production';
      let response;
      try {
        response = await recharge.detectOperatorMNP(mobile);
      } catch (apiErr: any) {
        console.warn("[Recharge API] MNP API call failed:", apiErr.message);
      }

      if (response && response.operator) {
        return res.json(response);
      }

      if (isStaging) {
        // Mock fallback logic based on prefix or last digit
        const prefix = mobile.slice(0, 4);
        const PREFIX_MOCKS: Record<string, { operator: string; circle: string; billerId: string }> = {
          '9999': { operator: 'Airtel Prepaid', circle: 'Delhi', billerId: 'AIRT00000PRE' },
          '9876': { operator: 'Jio Prepaid', circle: 'Punjab', billerId: 'JIO000000PRE' },
          '9000': { operator: 'Vi Prepaid', circle: 'Andhra Pradesh', billerId: 'VODA00000PRE' },
          '9444': { operator: 'BSNL Prepaid', circle: 'Tamil Nadu', billerId: 'BSNL00000PRE' }
        };

        if (PREFIX_MOCKS[prefix]) {
          return res.json(PREFIX_MOCKS[prefix]);
        }

        const lastDigit = Number(mobile.slice(-1)) || 0;
        if (lastDigit === 0 || lastDigit === 5) {
          return res.json({ operator: 'Vi Prepaid', circle: 'Mumbai', billerId: 'VODA00000PRE' });
        } else if (lastDigit % 2 === 1) {
          return res.json({ operator: 'Jio Prepaid', circle: 'Gujarat', billerId: 'JIO000000PRE' });
        } else {
          return res.json({ operator: 'Airtel Prepaid', circle: 'Maharashtra', billerId: 'AIRT00000PRE' });
        }
      }

      return res.status(400).json({ status: "ERROR", message: "MNP detection failed." });
    } catch (error: any) {
      console.error("[Recharge API] MNP Error:", error);
      res.status(500).json({ status: "ERROR", message: error.message });
    }
  });

  app.get("/api/recharge/plans", async (req, res) => {
    try {
      const { billerId, operator, circle, mobile } = req.query;
      if (!billerId) {
        return res.status(400).json({ status: "ERROR", message: "billerId is required." });
      }

      const isStaging = process.env.BILLAVENUE_ENV !== 'production';
      let response;
      try {
        response = await recharge.getRechargePlans(billerId as string, (circle as string) || 'Gujarat', mobile as string);
      } catch (apiErr: any) {
        console.warn("[Recharge API] Plan Fetch Failed:", apiErr.message);
      }

      // Helper function to return UAT/staging mock plans
      const getMockPlans = (bId: string, circ: string) => {
        const opLower = (operator as string || bId).toLowerCase();
        let planList = [];
        if (opLower.includes('airt')) {
          planList = [
            { planName: 'Data Pack', amount: 19, validity: '1 Day', description: '1 GB Data Pack' },
            { planName: 'Smart Recharge', amount: 155, validity: '24 Days', description: '1 GB, Unlimited Calls, 300 SMS' },
            { planName: 'Daily Data', amount: 239, validity: '28 Days', description: '1.5 GB/Day, Unlimited Calls, 100 SMS/Day' },
            { planName: 'Unlimited Data', amount: 299, validity: '28 Days', description: '2 GB/Day, Unlimited Calls, 100 SMS/Day' },
            { planName: 'Super Value', amount: 719, validity: '84 Days', description: '1.5 GB/Day, Unlimited Calls, 100 SMS/Day' },
            { planName: 'Annual Pack', amount: 2999, validity: '365 Days', description: '2 GB/Day, Unlimited Calls, 100 SMS/Day' }
          ];
        } else if (opLower.includes('jio')) {
          planList = [
            { planName: 'Data Booster', amount: 15, validity: 'Active Plan', description: '1 GB Data Booster' },
            { planName: 'Value Pack', amount: 149, validity: '20 Days', description: '1 GB/Day, Unlimited Calls, 100 SMS/Day' },
            { planName: 'Popular Pack', amount: 239, validity: '28 Days', description: '1.5 GB/Day, Unlimited Calls, 100 SMS/Day' },
            { planName: 'Hero Pack', amount: 299, validity: '28 Days', description: '2 GB/Day, Unlimited Calls, 100 SMS/Day' },
            { planName: 'Super Value', amount: 666, validity: '84 Days', description: '1.5 GB/Day, Unlimited Calls, 100 SMS/Day' },
            { planName: 'Annual Plan', amount: 2999, validity: '365 Days', description: '2.5 GB/Day, Unlimited Calls, 100 SMS/Day' }
          ];
        } else if (opLower.includes('voda') || opLower.includes('vi') || opLower.includes('idea')) {
          planList = [
            { planName: 'Data Pack', amount: 22, validity: '1 Day', description: 'Get 1 GB Data. No Service Validity.' },
            { planName: 'Data Pack Plus', amount: 33, validity: '2 Days', description: 'Get 2 GB Data. No Service Validity.' },
            { planName: 'Combo Pack', amount: 98, validity: '15 Days', description: 'Unlimited Calls, 200 MB Data' },
            { planName: 'Hero Unlimited', amount: 269, validity: '28 Days', description: '1 GB/Day, Unlimited Calls, 100 SMS/Day' },
            { planName: 'Daily Pack', amount: 299, validity: '28 Days', description: '1.5 GB/Day, Unlimited Calls, 100 SMS/Day' },
            { planName: 'Super Pack', amount: 479, validity: '56 Days', description: '1.5 GB/Day, Unlimited Calls, 100 SMS/Day' },
            { planName: 'Value Pack', amount: 719, validity: '84 Days', description: '1.5 GB/Day, Unlimited Calls, 100 SMS/Day' }
          ];
        } else {
          // BSNL
          planList = [
            { planName: 'STV 18', amount: 18, validity: '2 Days', description: 'Unlimited Calls, 1 GB/Day' },
            { planName: 'STV 97', amount: 97, validity: '15 Days', description: 'Unlimited Calls, 2 GB/Day, Lokdhun' },
            { planName: 'STV 153', amount: 153, validity: '26 Days', description: 'Unlimited Calls, 1 GB/Day, PRBT' },
            { planName: 'Plan 197', amount: 197, validity: '70 Days', description: 'Unlimited Calls (first 18 days), 2 GB/Day' },
            { planName: 'Plan 397', amount: 397, validity: '150 Days', description: 'Unlimited Calls (first 30 days), 2 GB/Day' }
          ];
        }
        return planList;
      };

      let plansResponse = response?.json?.rechargePlanResponse || response?.json?.planMdmResponse;
      let planListRaw = plansResponse?.rechargePlan?.rechargePlansDetails || plansResponse?.planList?.plan;

      if (isStaging && (!planListRaw || (Array.isArray(planListRaw) && planListRaw.length === 0))) {
        console.log(`[Recharge API] Staging: Biller ${billerId} circle ${circle} returned no plans. Using simulated UAT plans.`);
        planListRaw = getMockPlans(billerId as string, (circle as string) || 'Gujarat');
      }

      if (planListRaw) {
        const planList = Array.isArray(planListRaw) ? planListRaw : [planListRaw];

        const mapped = planList.map((p: any) => ({
          operator: (operator as string) || billerId as string,
          circle: (circle as string) || 'All Circles',
          plan_name: p.planName || p.PlanName || p.talktime || p.Talktime || 'Recharge Plan',
          amount: Number(p.amount || p.Amount) || 0,
          validity: p.validity || p.Validity || 'N/A',
          description: p.description || p.Description || ''
        }));

        // Seed to recharge_plans table in database
        if (operator && circle) {
          try {
            await supabaseAdmin
              .from('recharge_plans')
              .delete()
              .eq('operator', operator)
              .eq('circle', circle);

            for (let i = 0; i < mapped.length; i += 100) {
              const chunk = mapped.slice(i, i + 100).map(m => ({
                operator: m.operator,
                circle: m.circle,
                plan_name: m.plan_name,
                amount: m.amount,
                validity: m.validity,
                description: m.description
              }));
              await supabaseAdmin.from('recharge_plans').insert(chunk);
            }
          } catch (dbErr) {
            console.error("[Recharge API] DB Seeding failed:", dbErr);
          }
        }

        return res.json({
          planMdmResponse: {
            responseCode: '0000',
            planList: {
              plan: mapped.map(m => ({
                planName: m.plan_name,
                amount: m.amount,
                validity: m.validity,
                description: m.description
              }))
            }
          }
        });
      }

      // Database fallback
      console.log("[Recharge API] Loading from database fallback...");
      const { data: dbPlans, error: dbError } = await supabaseAdmin
        .from('recharge_plans')
        .select('*')
        .eq('operator', operator || '')
        .eq('circle', circle || '');

      if (dbError) throw dbError;
      return res.json({
        planMdmResponse: {
          responseCode: '0000',
          planList: {
            plan: dbPlans ? dbPlans.map((p: any) => ({
              planName: p.plan_name,
              amount: p.amount,
              validity: p.validity,
              description: p.description
            })) : []
          }
        }
      });
    } catch (error: any) {
      console.error("[Recharge API] Fetch Plans Error:", error);
      res.status(500).json({ status: "ERROR", message: error.message });
    }
  });

  app.post("/api/recharge/validate", async (req, res) => {
    try {
      const { mobile, billerId, amount } = req.body;
      if (!mobile || !billerId || !amount) {
        return res.status(400).json({ status: "ERROR", message: "Missing required parameters." });
      }
      const response = await recharge.validateRecharge(mobile, billerId, Number(amount));
      res.json(response.json);
    } catch (error: any) {
      console.error("[Recharge API] Validate Error:", error);
      res.status(500).json({ status: "ERROR", message: error.message });
    }
  });

  app.post("/api/recharge/pay", async (req, res) => {
    try {
      const { userId, mobile, billerId, amount, planId, operator, circle } = req.body;

      if (!userId || !mobile || !billerId || !amount) {
        return res.status(400).json({ status: "ERROR", message: "Missing required parameters." });
      }

      const rechargeAmount = Number(amount);
      if (isNaN(rechargeAmount) || rechargeAmount <= 0) {
        return res.status(400).json({ status: "ERROR", message: "Invalid amount specified." });
      }

      // 1. Fetch user's current wallet balance and service charge settings
      const { data: user, error: userError } = await supabaseAdmin
        .from("users_profiles")
        .select("wallet_balance, service_charge_enabled, custom_service_charge, name")
        .eq("id", userId)
        .single();

      if (userError || !user) {
        return res.status(400).json({ status: "ERROR", message: "User profile not found." });
      }

      const currentBalance = Number(user.wallet_balance) || 0;

      // 2. Fetch active service charge slabs to compute commission fee
      const { data: slabs, error: slabsError } = await supabaseAdmin
        .from("service_charge_slabs")
        .select("*")
        .eq("is_active", true)
        .order("min_amount", { ascending: true });

      if (slabsError) {
        console.error("[Recharge API] Error fetching slabs:", slabsError);
      }

      let serviceCharge = 0;
      if (user.service_charge_enabled) {
        serviceCharge = Number(user.custom_service_charge) || 0;
      } else if (slabs && slabs.length > 0) {
        const slab = slabs.find(s => rechargeAmount >= Number(s.min_amount) && rechargeAmount <= Number(s.max_amount));
        if (slab) {
          if (slab.is_percentage) {
            serviceCharge = (rechargeAmount * Number(slab.charge_amount)) / 100;
          } else {
            serviceCharge = Number(slab.charge_amount);
          }
        }
      }

      const totalDeduction = rechargeAmount + serviceCharge;
      // 3. Enforce minimum ₹250 wallet balance rule
      if (currentBalance - totalDeduction < 250) {
        return res.status(400).json({
          status: "ERROR",
          message: `Insufficient balance. You must maintain at least ₹250 in your wallet after payment (Recharge Amount: ₹${rechargeAmount} + Charges: ₹${serviceCharge}).`
        });
      }

      // 4. Call BillAvenue recharge payment API
      const isStaging = process.env.BILLAVENUE_ENV !== "production";
      let apiResponse: any = null;
      let responseJson: any = null;
      let payResponse: any = null;
      let responseCode: string | null = null;
      let txnRefId: string | null = null;

      try {
        apiResponse = await recharge.rechargeMobile(mobile, billerId, rechargeAmount, planId, user.name || 'Valued Customer');
        responseJson = apiResponse.json;
        payResponse = responseJson?.billPayResponse;
        responseCode = payResponse?.responseCode;
        txnRefId = payResponse?.txnRefId;
      } catch (apiErr: any) {
        console.warn("[Recharge API] Live call failed, checking staging fallback:", apiErr.message);
        if (!isStaging) {
          throw apiErr;
        }
      }

      let isSuccess = responseCode === '0000' || responseCode?.toString().toLowerCase() === 'success' || payResponse?.status?.toString().toLowerCase() === 'success';

      if (!isSuccess && isStaging) {
        console.log("[Recharge API] UAT Staging Fallback: Simulating successful recharge response.");
        const mockTxnRefId = `TXN${Math.floor(100000000000000 + Math.random() * 900000000000000)}`;
        const mockRequestId = `REQ${Math.floor(100000 + Math.random() * 900000)}`;

        responseJson = {
          billPayResponse: {
            responseCode: "0000",
            status: "SUCCESS",
            txnRefId: mockTxnRefId,
            responseReason: "Recharge Successful (Mock Staging)"
          }
        };
        apiResponse = {
          json: responseJson,
          requestId: mockRequestId
        };
        payResponse = responseJson.billPayResponse;
        responseCode = "0000";
        txnRefId = mockTxnRefId;
        isSuccess = true;
      }

      if (isSuccess || responseCode === '0000') {
        const newBalance = currentBalance - totalDeduction;

        // 5. Deduct wallet balance in Supabase
        const { error: updateError } = await supabaseAdmin
          .from("users_profiles")
          .update({ wallet_balance: newBalance })
          .eq("id", userId);

        if (updateError) {
          console.error("[CRITICAL] Wallet deduction failed for completed Recharge transaction:", updateError);
        }

        // 6. Log transaction into recharge_transactions
        await supabaseAdmin
          .from("recharge_transactions")
          .insert({
            user_id: userId,
            mobile,
            operator: operator || billerId,
            circle: circle || 'All Circles',
            amount: rechargeAmount,
            plan_id: planId || 'Manual',
            txn_ref_id: txnRefId || `TXN${Math.floor(100000 + Math.random() * 900000)}`,
            request_id: apiResponse.requestId,
            status: "success",
            response: responseJson
          });

        // 7. Also log into bbps_submissions for unified reporting
        await supabaseAdmin
          .from("bbps_submissions")
          .insert({
            user_id: userId,
            service_type: "Mobile Recharge",
            provider: operator || billerId,
            consumer_number: mobile,
            amount: rechargeAmount,
            charges: serviceCharge,
            status: "approved",
            rejection_reason: txnRefId || apiResponse.requestId,
            metadata: {
              gateway: "BillAvenue",
              requestId: apiResponse.requestId,
              planId,
              circle
            }
          });

        return res.json({
          status: "SUCCESS",
          message: "Recharge SUCCESS",
          new_balance: newBalance,
          charges: serviceCharge,
          data: payResponse
        });
      } else {
        // Log failed transaction
        await supabaseAdmin
          .from("recharge_transactions")
          .insert({
            user_id: userId,
            mobile,
            operator: operator || billerId,
            circle: circle || 'All Circles',
            amount: rechargeAmount,
            plan_id: planId || 'Manual',
            txn_ref_id: txnRefId || 'N/A',
            request_id: apiResponse.requestId,
            status: "failed",
            response: responseJson
          });

        return res.json({
          status: "FAILED",
          message: payResponse?.responseReason || "Recharge failed at BillAvenue Gateway.",
          data: payResponse
        });
      }
    } catch (error: any) {
      console.error("[Recharge API] Pay Error:", error);
      res.status(500).json({ status: "ERROR", message: error.message });
    }
  });

  app.get("/api/recharge/status", async (req, res) => {
    try {
      const { requestId } = req.query;
      if (!requestId) {
        return res.status(400).json({ status: "ERROR", message: "requestId parameter is required." });
      }
      const response = await recharge.getRechargeStatus(requestId as string);
      const statusResponse = response.json?.transactionStatusResponse;

      if (statusResponse) {
        const txnStatus = statusResponse.status?.toLowerCase();
        let mappedStatus: 'success' | 'failed' | 'pending' = 'pending';
        if (txnStatus === 'success' || txnStatus === 'approved') mappedStatus = 'success';
        else if (txnStatus === 'failed' || txnStatus === 'rejected') mappedStatus = 'failed';

        await supabaseAdmin
          .from("recharge_transactions")
          .update({
            txn_ref_id: statusResponse.txnRefId,
            status: mappedStatus,
            response: response.json
          })
          .eq("request_id", requestId);
      }

      res.json(response.json);
    } catch (error: any) {
      console.error("[Recharge API] Status Error:", error);
      res.status(500).json({ status: "ERROR", message: error.message });
    }
  });

  app.get("/api/recharge/deposit", async (req, res) => {
    try {
      const response = await recharge.getDepositBalance();
      res.json(response.json);
    } catch (error: any) {
      console.error("[Recharge API] Deposit Enquiry Error:", error);
      res.status(500).json({ status: "ERROR", message: error.message });
    }
  });


  app.all("/api/bbps-proxy", async (req, res) => {
    try {
      const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

      if (!supabaseUrl || !serviceKey) {
        return res.status(500).json({ error: "Supabase configuration missing on server" });
      }

      // Build the remote target URL
      const urlObj = new URL(`${supabaseUrl}/rest/v1/bbps_submissions`);
      // Append the query params from the client, mapping transaction_id to rejection_reason
      for (const [key, val] of Object.entries(req.query)) {
        let mappedKey = key;
        if (key === "transaction_id") {
          mappedKey = "rejection_reason";
        }

        const values = Array.isArray(val) ? val : [val];
        for (const rawVal of values) {
          let mappedVal = String(rawVal);
          mappedVal = mappedVal.replace(/transaction_id/g, "rejection_reason");

          // Fix lowercase t and z in ISO timestamps (e.g. from Nginx case-lowercased URLs)
          // to prevent PostgREST parsing failures where it rejects "lte.2026-05-31t18:29:59.999z"
          mappedVal = mappedVal.replace(
            /(\d{4}-\d{2}-\d{2})t(\d{2}:\d{2}:\d{2}(?:\.\d+)?)z/gi,
            (match, p1, p2) => `${p1}T${p2}Z`
          );

          urlObj.searchParams.append(mappedKey, mappedVal);
        }
      }

      // Build the headers, replacing the key with service role key to bypass RLS
      const headers: Record<string, string> = {
        "apikey": serviceKey,
        "Authorization": `Bearer ${serviceKey}`,
        "Content-Type": "application/json"
      };

      // Forward relevant client request headers
      if (req.headers["prefer"]) {
        headers["Prefer"] = req.headers["prefer"] as string;
      }
      if (req.headers["range"]) {
        headers["Range"] = req.headers["range"] as string;
      }

      const fetchOptions: RequestInit = {
        method: req.method,
        headers,
      };

      if (req.method !== "GET" && req.method !== "HEAD") {
        let body = req.body;
        if (body && typeof body === 'object') {
          if ('transaction_id' in body) {
            body.rejection_reason = body.transaction_id;
            delete body.transaction_id;
          }
        }
        fetchOptions.body = JSON.stringify(body || {});
      }

      const response = await fetch(urlObj.toString(), fetchOptions);

      // Set response status
      res.status(response.status);

      // Copy response headers back to client
      const contentRange = response.headers.get("content-range");
      if (contentRange) {
        res.setHeader("Content-Range", contentRange);
      }
      const preferenceApplied = response.headers.get("preference-applied");
      if (preferenceApplied) {
        res.setHeader("Preference-Applied", preferenceApplied);
      }
      const contentType = response.headers.get("content-type");
      if (contentType) {
        res.setHeader("Content-Type", contentType);
      }

      let responseText = await response.text();
      try {
        const json = JSON.parse(responseText);
        const mapRow = (row: any) => {
          if (row && typeof row === 'object') {
            if ('rejection_reason' in row) {
              row.transaction_id = row.rejection_reason;
            }
          }
        };

        if (Array.isArray(json)) {
          json.forEach(mapRow);
        } else {
          mapRow(json);
        }
        responseText = JSON.stringify(json);
      } catch (e) {
        // Fall back if not JSON
      }

      res.send(responseText);
    } catch (err: any) {
      console.error("[BBPS Proxy Error]:", err);
      res.status(500).json({ error: err.message });
    }
  });


  app.get("/api/full-backup", async (req, res) => {
    const debugLog = (msg: string) => {
      const entry = `[${new Date().toISOString()}] ${msg}\n`;
      fs.appendFileSync(path.join(process.cwd(), 'server_debug.log'), entry);
      console.log(msg);
    };

    debugLog("--- BACKUP REQUEST RECEIVED ---");
    const quickMode = req.query.mode === 'quick';
    const backupId = `backup-${Date.now()}`;
    const tempDir = path.join(os.tmpdir(), backupId);
    let logContent = `Backup ID: ${backupId}\nMode: ${quickMode ? 'Quick' : 'Full'}\nStarted at: ${new Date().toISOString()}\n\n`;

    try {
      if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error("Missing Supabase Environment Variables!");
      }

      await fs.ensureDir(tempDir);
      debugLog(`Temp dir created at ${tempDir}`);

      // 1. DATABASE EXPORT
      const tables = [
        'users_profiles', 'qr_history', 'rejection_categories', 'rejection_reasons',
        'admin_profiles', 'admin_withdrawals', 'app_policies', 'bank_details',
        'bill_submissions', 'complaint_messages', 'complaints', 'distributor_withdrawals',
        'headlines', 'kyc_submissions', 'notifications', 'onesignal_settings',
        'payment_submissions', 'payout_settings', 'payout_submissions', 'qr_settings',
        'service_charge_slabs', 'system_status', 'whatsapp_api_settings'
      ];

      let sqlDump = `-- UsePay Full Database Backup\n-- Generated on: ${new Date().toLocaleString()}\n\n`;
      let successTables = 0;

      for (const table of tables) {
        debugLog(`Fetching table: ${table}`);
        const { data, error } = await supabaseAdmin.from(table).select('*');
        if (error) {
          debugLog(`Error in ${table}: ${error.message}`);
          logContent += `[DB ERROR] Table ${table}: ${error.message}\n`;
          continue;
        }
        if (data && data.length > 0) {
          successTables++;
          debugLog(`Found ${data.length} rows in ${table}`);
          sqlDump += `-- Data for table ${table} (${data.length} rows)\n`;
          data.forEach(row => {
            const columns = Object.keys(row).join(', ');
            const values = Object.values(row).map(v => {
              if (v === null) return 'NULL';
              if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
              if (typeof v === 'number') return v;
              if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'`;
              return `'${String(v).replace(/'/g, "''")}'`;
            }).join(', ');
            sqlDump += `INSERT INTO public.${table} (${columns}) VALUES (${values}) ON CONFLICT DO NOTHING;\n`;
          });
          sqlDump += `\n`;
        } else {
          debugLog(`Table ${table} is empty.`);
        }
      }
      await fs.writeFile(path.join(tempDir, 'database_data.sql'), sqlDump);
      debugLog(`SQL Dump written. Success tables: ${successTables}`);

      // 2. STORAGE EXPORT
      if (!quickMode) {
        debugLog("Starting Storage Export...");
        const { data: buckets } = await supabaseAdmin.storage.listBuckets();
        if (buckets) {
          const storageDir = path.join(tempDir, 'storage');
          await fs.ensureDir(storageDir);

          for (const bucket of buckets) {
            debugLog(`Processing bucket: ${bucket.name}`);
            const bucketPath = path.join(storageDir, bucket.name);
            await fs.ensureDir(bucketPath);

            const syncFolder = async (folderPath: string = '') => {
              const { data: items } = await supabaseAdmin.storage.from(bucket.name).list(folderPath);
              if (!items) return;

              const CONCURRENCY = 5;
              for (let i = 0; i < items.length; i += CONCURRENCY) {
                const batch = items.slice(i, i + CONCURRENCY);
                await Promise.all(batch.map(async (item) => {
                  const fullPath = folderPath ? `${folderPath}/${item.name}` : item.name;
                  if (!item.id && !item.metadata) {
                    await syncFolder(fullPath);
                  } else {
                    try {
                      const { data: blob } = await supabaseAdmin.storage.from(bucket.name).download(fullPath);
                      if (blob) {
                        const filePath = path.join(bucketPath, fullPath);
                        await fs.ensureDir(path.dirname(filePath));
                        const buffer = Buffer.from(await blob.arrayBuffer());
                        await fs.writeFile(filePath, buffer);
                      }
                    } catch (e: any) {
                      debugLog(`Failed file ${fullPath}: ${e.message}`);
                    }
                  }
                }));
              }
            };
            await syncFolder();
          }
        }
      }

      await fs.writeFile(path.join(tempDir, 'backup_log.txt'), logContent);

      // 3. SEND ZIP
      debugLog("Finalizing ZIP and sending response...");
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename=UsePay_Backup_${backupId}.zip`);

      const archive = archiver('zip', { zlib: { level: 9 } });
      archive.pipe(res);
      archive.directory(tempDir, false);

      archive.on('end', async () => {
        debugLog("--- BACKUP COMPLETED AND SENT ---");
        try { await fs.remove(tempDir); } catch { }
      });

      await archive.finalize();

    } catch (error: any) {
      debugLog(`GLOBAL CRITICAL FAILURE: ${error.message}`);
      if (!res.headersSent) res.status(500).send(`Backup failed: ${error.message}`);
      try { await fs.remove(tempDir); } catch { }
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV === "development") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath, {
      maxAge: "1y",
      setHeaders: (res, filePath) => {
        if (filePath.endsWith(".html")) {
          res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        } else {
          // Cache hashed assets for 1 year
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        }
      }
    }));
    app.get("*", (req, res) => {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // API 404 Handler
  app.use('/api/*', (req, res) => {
    res.status(404).json({ error: "API Route not found" });
  });

  // Global Error Handler
  app.use((err: any, req: any, res: any, next: any) => {
    console.error("[CRITICAL SERVER ERROR]", err);
    res.status(500).json({ error: "Internal Server Error", message: err.message });
  });

  // Daily T+1 settlement checker
  let lastSettleDate: string = "";
  setInterval(async () => {
    try {
      const tzOffset = 5.5 * 60 * 60 * 1000;
      const istTime = new Date(Date.now() + tzOffset);
      const hours = istTime.getUTCHours();
      const minutes = istTime.getUTCMinutes();
      const todayStr = istTime.toISOString().split("T")[0]; // YYYY-MM-DD

      if (hours === 11 && minutes === 0) {
        if (lastSettleDate !== todayStr) {
          console.log(`[T+1 Settlement] Starting automated next-day settlement for ${todayStr}...`);
          const { data, error } = await supabaseAdmin.rpc("settle_t_plus_one_payments");
          if (error) {
            console.error("[T+1 Settlement] RPC error:", error);
          } else {
            console.log("[T+1 Settlement] RPC response:", data);
            lastSettleDate = todayStr;
          }
        }
      }
    } catch (err) {
      console.error("[T+1 Settlement] Scheduler error:", err);
    }
  }, 30000); // Check every 30 seconds

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
