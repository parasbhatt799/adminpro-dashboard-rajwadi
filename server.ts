import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import https from "https";

dotenv.config();

// Global Error Handlers to prevent silent crashes
process.on('unhandledRejection', (reason, promise) => {
  console.error('[CRITICAL] Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[CRITICAL] Uncaught Exception:', err);
});

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
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

    if (!whatsapp_number || !proof_url || !credentials || !credentials.access_token || !credentials.phone_number_id) {
      return res.status(400).json({ error: "Missing WhatsApp credentials or data." });
    }

    try {
      const { access_token, phone_number_id, sender_number } = credentials;
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
            res.status(metaRes.statusCode || 500).json({ 
              error: parsed.error?.message || "Failed to send WhatsApp message",
              details: parsed.error
            });
          }
        });
      });

      metaRequest.on('error', (e) => { throw e; });
      metaRequest.write(data);
      metaRequest.end();

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

      // Server-side discovery of Admin Player IDs
      if (target === 'admins') {
        const { data: admins, error } = await supabaseAdmin
          .from('users_profiles')
          .select('onesignal_id')
          .eq('role', 'admin')
          .not('onesignal_id', 'is', null);

        if (!error && admins) {
          const discoveredIds = admins.map(a => a.onesignal_id).filter(Boolean);
          targetPlayerIds = [...new Set([...targetPlayerIds, ...discoveredIds])];
        }
      }

      const data: any = {
        app_id: app_id.trim(),
        headings: { en: title },
        contents: { en: message },
        isAnyWeb: true,
        web_url: link ? `https://www.usepay.in${link}` : "https://www.usepay.in/admin",
      };

      // Target specific players if provided, otherwise fallback to segments
      if (targetPlayerIds && targetPlayerIds.length > 0) {
        data.include_player_ids = targetPlayerIds;
      } else {
        data.included_segments = ["Subscribed Users", "All"];
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


  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
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
