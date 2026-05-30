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

  app.post("/api/send-email", async (req, res) => {
    const { to, subject, text, html } = req.body;
    console.log("Incoming email request to:", to);

    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.error("SMTP configuration missing in process.env");
      return res.status(500).json({
        error: "SMTP configuration missing. Please ensure your .env file is correct and you have RESTARTED the server."
      });
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: process.env.SMTP_PORT === "465",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    try {
      const fromEmail = process.env.SMTP_FROM || process.env.SMTP_USER;
      const fromName = process.env.SMTP_FROM_NAME || 'UsePay';

      await transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to,
        subject,
        text,
        html,
      });
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error sending email:", error);
      res.status(500).json({ error: error.message });
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

    if (!title || !message || !credentials?.app_id || !credentials?.rest_api_key) {
      return res.status(400).json({ error: "Title, message, and OneSignal credentials are required." });
    }

    try {
      const { app_id, rest_api_key } = credentials;
      let targetPlayerIds = player_ids || [];
      let externalUserIds = req.body.external_user_ids || [];

      // 1. Server-side discovery of Admin IDs if targeted
      if (target === 'admins') {
        const { data: admins, error } = await supabaseAdmin
          .from('users_profiles')
          .select('id')
          .eq('role', 'admin');

        if (!error && admins) {
          const discoveredExternalIds = admins.map(a => a.id).filter(Boolean);
          externalUserIds = [...new Set([...externalUserIds, ...discoveredExternalIds])];
        }
      }

      // 2. Resolve current onesignal_ids from DB for all externalUserIds
      // This ensures we always target the device currently associated with the user
      if (externalUserIds.length > 0) {
        const { data: profiles } = await supabaseAdmin
          .from('users_profiles')
          .select('onesignal_id')
          .in('id', externalUserIds.map((id: any) => String(id)));

        if (profiles) {
          const freshPlayerIds = profiles.map(p => p.onesignal_id).filter(Boolean);
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
      const cleanPlayerIds = targetPlayerIds.filter((id: any) => id && typeof id === 'string');
      const cleanExternalIds = externalUserIds.filter((id: any) => id && (typeof id === 'string' || typeof id === 'number'));

      const hasValidTarget = cleanPlayerIds.length > 0 || cleanExternalIds.length > 0;

      if (hasValidTarget) {
        if (cleanPlayerIds.length > 0) {
          data.include_subscription_ids = cleanPlayerIds;
        }
        if (cleanExternalIds.length > 0) {
          data.include_external_user_ids = cleanExternalIds.map((id: any) => String(id));
        }
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
      const { biller_id, customerParams } = req.body;
      if (!biller_id || !customerParams) {
        return res.status(400).json({ status: "ERROR", message: "Biller ID and customer parameters are required." });
      }

      // Map raw customerParams to PayPrime param array format
      const paramArray = Object.entries(customerParams || {}).map(([paramName, paramValue]) => ({
        paramName,
        paramValue: String(paramValue)
      }));

      const response = await fetch("https://b2b.payprime.in/api/v1/bbps/fetch-bill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: PAYPRIME_TOKEN,
          biller_id,
          param: paramArray
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
        .select("wallet_balance, service_charge_enabled, custom_service_charge")
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
        // If the payment amount in paisa does not match the fetched billAmount,
        // it is a custom/partial payment on a fetched bill. We set quickPay = "Y" and billerAdhoc = true.
        if (amountInPaisa !== fetchedRawAmount) {
          console.log(`[BBPS Proxy] Custom amount specified (${amountInPaisa} vs fetched ${fetchedRawAmount}). Setting quickPay = "Y" (Adhoc/Partial).`);
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

      const payPrimePayload: any = {
        token: PAYPRIME_TOKEN,
        biller_id,
        amount: amountInPaisa.toString(),
        quickPay,
        payment_mode: "Cash",
        paymentInfo: {
          info: [
            { "infoName": "Cash Payment", "infoValue": "Cash Payment" }
          ]
        },
        mobile: userMobile,
        billerAdhoc,
        inputParams: {
          input: paramArray
        }
      };

      // Always pass request_id, billerResponse, and additionalInfo if a fetch was performed first,
      // regardless of whether we are paying custom amount (quickPay = "Y") or exact amount (quickPay = "N").
      if (fetchResponse && fetchResponse.data?.billerResponse) {
        payPrimePayload.request_id = fetchResponse.request_id;
        payPrimePayload.billerResponse = fetchResponse.data.billerResponse;
        if (fetchResponse.data.additionalInfo) {
          payPrimePayload.additionalInfo = fetchResponse.data.additionalInfo;
        }
      }

      console.log("[BBPS Proxy] Outgoing PayPrime Payload:", JSON.stringify(payPrimePayload, null, 2));

      const response = await fetch("https://b2b.payprime.in/api/v1/bbps/pay-bill", {
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
              consumerDetails: customerParams
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
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
