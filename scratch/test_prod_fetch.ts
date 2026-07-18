import dotenv from 'dotenv';
dotenv.config();

import * as billAvenue from '../services/billavenue.js';

async function run() {
  // CONFIGURATION: Enter details here
  const billerId = "SBIC00000NATDN"; 
  const cardLast4Digits = "0730"; 
  const registeredMobile = "8140428671"; 

  console.log(`[Test Fetch] Initiating Fetch for: ${billerId}`);
  console.log(`[Test Fetch] Last 4 Digits: ${cardLast4Digits}`);
  console.log(`[Test Fetch] Mobile Number: ${registeredMobile}`);

  const params = {
    "Last 4 Digits of Credit Card": cardLast4Digits,
    "Registered Mobile No": registeredMobile
  };

  try {
    const response = await billAvenue.fetchBill(billerId, params, registeredMobile);
    
    console.log("\n==================================================");
    console.log("1. RAW XML RESPONSE FROM BILLAVENUE:");
    console.log("==================================================");
    console.log(response.rawXml);
    
    console.log("\n==================================================");
    console.log("2. PARSED JSON RESPONSE:");
    console.log("==================================================");
    console.log(JSON.stringify(response.json, null, 2));
  } catch (err: any) {
    console.error("API Call Failed:", err.message);
  }
}

run();
