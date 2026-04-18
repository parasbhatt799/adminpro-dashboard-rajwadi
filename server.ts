import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

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
    console.log("Incoming WhatsApp proof request for:", whatsapp_number);

    if (!whatsapp_number || !proof_url) {
      return res.status(400).json({ error: "WhatsApp number and proof URL are required." });
    }

    if (!credentials || !credentials.access_token || !credentials.phone_number_id) {
      return res.status(400).json({ error: "WhatsApp API credentials missing." });
    }

    try {
      const { access_token, phone_number_id, sender_number } = credentials;
      const url = `https://graph.facebook.com/v18.0/${phone_number_id}/messages`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: whatsapp_number,
          type: "image",
          image: {
            link: proof_url,
            caption: `Payment Approved! Here is the proof of your submission. (Sent from ${sender_number || "Admin Portal"})`,
          },
        }),
      });

      const data: any = await response.json();

      if (!response.ok) {
        console.error("Meta WhatsApp API Error:", data);
        return res.status(response.status).json({ 
          error: data.error?.message || "Failed to send WhatsApp message" 
        });
      }

      res.json({ success: true, message_id: data.messages?.[0]?.id });
    } catch (error: any) {
      console.error("Error sending WhatsApp message:", error);
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
