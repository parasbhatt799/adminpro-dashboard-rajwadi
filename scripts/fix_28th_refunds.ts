import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
dotenv.config();

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

const TARGET_TRANSACTIONS = [
  { id: "46205b55-346c-4f2d-871b-f596eaec8757", userId: "usepay_021", refundAmount: 49999 },
  { id: "bb91b106-2616-41ce-b265-e9a5e0278a53", userId: "usepay_021", refundAmount: 49999 },
  { id: "79896b91-2ce8-404f-a894-885179176fbe", userId: "usepay_021", refundAmount: 49999 },
  { id: "34dfa967-75c3-4e13-8193-91095d44004d", userId: "usepay_113", refundAmount: 30020 },
  { id: "78ba1bd4-724e-43dc-8249-22da7e971caf", userId: "usepay_398", refundAmount: 49020 }
];

async function fix28thRefunds() {
  console.log("=== Starting 28th August Refund Reversal Script ===");

  for (const item of TARGET_TRANSACTIONS) {
    console.log(`\nProcessing Transaction ${item.id} for User ${item.userId}...`);

    // 1. Get current transaction status
    const { data: txn, error: txnErr } = await supabaseAdmin
      .from("bbps_submissions")
      .select("id, status, user_id, amount")
      .eq("id", item.id)
      .single();

    if (txnErr || !txn) {
      console.error(`Error finding transaction ${item.id}:`, txnErr);
      continue;
    }

    if (txn.status !== "rejected") {
      console.log(`Transaction ${item.id} is already status '${txn.status}'. Skipping.`);
      continue;
    }

    // 2. Get user current wallet balance
    const { data: user, error: userErr } = await supabaseAdmin
      .from("users_profiles")
      .select("id, name, wallet_balance")
      .eq("id", item.userId)
      .single();

    if (userErr || !user) {
      console.error(`Error finding user ${item.userId}:`, userErr);
      continue;
    }

    const currentBalance = Number(user.wallet_balance || 0);
    const newBalance = currentBalance - item.refundAmount;

    if (newBalance < 0) {
      console.warn(`WARNING: Deducting ₹${item.refundAmount} from User ${user.name} (${user.id}) will result in negative balance (Current: ₹${currentBalance}, New: ₹${newBalance}).`);
    }

    // 3. Deduct wallet balance
    const { error: updateWalletErr } = await supabaseAdmin
      .from("users_profiles")
      .update({ wallet_balance: newBalance })
      .eq("id", item.userId);

    if (updateWalletErr) {
      console.error(`Failed to update wallet balance for user ${item.userId}:`, updateWalletErr);
      continue;
    }

    // 4. Update transaction status back to pending
    const { error: updateTxnErr } = await supabaseAdmin
      .from("bbps_submissions")
      .update({ status: "pending" })
      .eq("id", item.id);

    if (updateTxnErr) {
      console.error(`Failed to revert status for transaction ${item.id}:`, updateTxnErr);
    } else {
      console.log(`SUCCESS: Reverted Txn ${item.id} to 'pending' & Deducted ₹${item.refundAmount} from ${user.name} (Old Bal: ₹${currentBalance.toFixed(2)} -> New Bal: ₹${newBalance.toFixed(2)})`);
    }
  }

  console.log("\n=== Reversal Completed Successfully ===");
}

fix28thRefunds();
