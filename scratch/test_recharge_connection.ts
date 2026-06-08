import { getDepositBalance, getRechargePlans } from '../services/recharge.js';
import dotenv from 'dotenv';

dotenv.config();

async function runTest() {
  console.log("=========================================================");
  console.log("  BILLAVENUE PREPAID RECHARGE CONFIGURATION & CONNECTIVITY TEST");
  console.log("=========================================================");
  console.log("Credentials:");
  console.log("  BILLAVENUE_ENV         :", process.env.BILLAVENUE_ENV || "staging (default)");
  console.log("  BILLAVENUE_AGENT_ID    :", process.env.BILLAVENUE_AGENT_ID || "Not Set");
  console.log("  BILLAVENUE_INSTITUTE_ID:", process.env.BILLAVENUE_INSTITUTE_ID || "Not Set");
  console.log("  BILLAVENUE_ACCESS_CODE :", process.env.BILLAVENUE_ACCESS_CODE ? "••••••••••••••••" : "Not Set");
  console.log("  BILLAVENUE_WORKING_KEY :", process.env.BILLAVENUE_WORKING_KEY ? "••••••••••••••••" : "Not Set");

  console.log("\nStep 1: Fetching Agent Deposit Wallet Balance...");
  try {
    const balanceRes = await getDepositBalance();
    
    if (balanceRes?.depositEnquiryResponse) {
      console.log("✅ SUCCESS: Connected to BillAvenue API!");
      console.log("   Agent Wallet Balance : ₹" + balanceRes.depositEnquiryResponse.balance);
      console.log("   Response Message     : " + balanceRes.depositEnquiryResponse.responseReason);
    } else {
      console.log("❌ FAILED: Unexpected response format from BillAvenue.");
      console.log(JSON.stringify(balanceRes, null, 2));
    }
  } catch (err: any) {
    console.log("❌ ERROR connecting to BillAvenue API:", err.message);
    
    // Auto-diagnostic suggestions
    if (err.message.includes("IP") || err.message.includes("whitelist") || err.message.includes("forbidden") || err.message.includes("403")) {
      console.log("\n💡 DIAGNOSTIC: IP Whitelisting issue detected! Verify that the IP of your machine/server is whitelisted in your BillAvenue dashboard.");
    } else if (err.message.includes("ENOTFOUND") || err.message.includes("ETIMEDOUT") || err.message.includes("connect")) {
      console.log("\n💡 DIAGNOSTIC: Network timeout/DNS lookup failure. Check your server's outbound internet connection.");
    } else {
      console.log("\n💡 DIAGNOSTIC: Encryption keys (BILLAVENUE_WORKING_KEY) or credentials (BILLAVENUE_ACCESS_CODE) might be incorrect.");
    }
  }

  console.log("\nStep 2: Fetching Recharge Plans (Airtel Prepaid test)...");
  try {
    const plansRes = await getRechargePlans("AIRT00000PRE");
    const planMdm = plansRes?.planMdmResponse;
    
    if (planMdm && planMdm.responseCode === '0000') {
      const list = planMdm.planList?.plan;
      const count = Array.isArray(list) ? list.length : (list ? 1 : 0);
      console.log(`✅ SUCCESS: Plans fetched successfully! Total plans loaded: ${count}`);
      if (count > 0) {
        const sample = Array.isArray(list) ? list[0] : list;
        console.log("   Sample plan details: ₹" + sample.amount + " - " + (sample.planName || sample.talktime || sample.description));
      }
    } else {
      console.log("❌ FAILED: Plans fetch returned error code: " + (planMdm?.responseCode || "N/A"));
      console.log(JSON.stringify(plansRes, null, 2));
    }
  } catch (err: any) {
    console.log("❌ ERROR fetching plans:", err.message);
  }
  console.log("=========================================================");
}

runTest();
