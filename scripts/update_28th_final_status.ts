import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
dotenv.config();

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

const FAILED_TXN = {
  id: "79896b91-2ce8-404f-a894-885179176fbe", // OM RAMESHBHAI JOSHI 06:36 PM IST
  userId: "usepay_021",
  amount: 49999
};

const SUCCESS_TXNS = [
  { id: "bb91b106-2616-41ce-b265-e9a5e0278a53", description: "OM RAMESHBHAI JOSHI (05:54 PM IST)" },
  { id: "46205b55-346c-4f2d-871b-f596eaec8757", description: "OM RAMESHBHAI JOSHI (04:23 PM IST)" },
  { id: "34dfa967-75c3-4e13-8193-91095d44004d", description: "BALDHA RAKSHIT NARESHBHAI (05:36 PM IST)" },
  { id: "78ba1bd4-724e-43dc-8249-22da7e971caf", description: "SABINA IMTYAJ MALEK (05:02 PM IST)" }
];

async function updateFinalStatus() {
  console.log("=== Updating 28th August Transactions Status ===");

  // 1. Process Failed Txn & Refund
  console.log(`\n1. Processing Failed Txn ${FAILED_TXN.id} (06:36 PM IST) for User ${FAILED_TXN.userId}...`);
  
  const { data: user, error: userErr } = await supabaseAdmin
    .from("users_profiles")
    .select("id, name, wallet_balance")
    .eq("id", FAILED_TXN.userId)
    .single();

  if (userErr || !user) {
    console.error("Error fetching user:", userErr);
  } else {
    const currentBalance = Number(user.wallet_balance || 0);
    const refundedBalance = currentBalance + FAILED_TXN.amount;

    // Refund to wallet
    const { error: walletErr } = await supabaseAdmin
      .from("users_profiles")
      .update({ wallet_balance: refundedBalance })
      .eq("id", FAILED_TXN.userId);

    if (walletErr) {
      console.error("Failed to refund wallet:", walletErr);
    } else {
      // Set status to rejected
      await supabaseAdmin
        .from("bbps_submissions")
        .update({ status: "rejected" })
        .eq("id", FAILED_TXN.id);

      console.log(`SUCCESS: Marked Txn ${FAILED_TXN.id} as 'rejected' & Refunded ₹${FAILED_TXN.amount} to ${user.name} (Old Bal: ₹${currentBalance.toFixed(2)} -> New Bal: ₹${refundedBalance.toFixed(2)})`);
    }
  }

  // 2. Process Remaining 4 Successful Txns
  console.log("\n2. Processing 4 Successful Transactions...");
  for (const item of SUCCESS_TXNS) {
    const { error: updateErr } = await supabaseAdmin
      .from("bbps_submissions")
      .update({ status: "approved" })
      .eq("id", item.id);

    if (updateErr) {
      console.error(`Error marking Txn ${item.id} as approved:`, updateErr);
    } else {
      console.log(`SUCCESS: Marked Txn ${item.id} (${item.description}) as 'approved' (SUCCESS).`);
    }
  }

  console.log("\n=== Final Status Update Completed Successfully ===");
}

updateFinalStatus();
