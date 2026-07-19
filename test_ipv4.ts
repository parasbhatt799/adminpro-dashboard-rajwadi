import dns from 'dns';
import fetch from 'node-fetch';

// Force Node.js to use IPv4 instead of IPv6
dns.setDefaultResultOrder('ipv4first');

// Make sure these match your LIVE credentials
const BASE_URL = 'https://cspl.camlenio.com';
const API_KEY = 'fjf0f2xy3W01NTtSDTUS62rdKyVqPSY7';
const SECRET_KEY = '7eSVhG7xf8sP5sLYAwFvQFZD7ksrb21BGmslzEolFkkbBxZLr8b9XrmxMCr3m16p';
const USER_ID = 'CU260707KTT';

async function testPennydrop() {
  const url = `${BASE_URL}/api/v1/vfc/pennydrop`;
  console.log(`\n======================================`);
  console.log(`Testing Pennydrop API (Forced IPv4)`);
  console.log(`URL: ${url}`);
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ApiKey': API_KEY,
        'SecretKey': SECRET_KEY,
        'UserId': USER_ID
      },
      body: JSON.stringify({
        accountNumber: "100058651466",
        ifsc: "INDX0000265",
        transactionId: "TXN" + Date.now()
      })
    });
    
    console.log(`Status Code: ${response.status}`);
    const text = await response.text();
    console.log(`Response Body: \n${text}\n`);
  } catch (err: any) {
    console.error(`Error: ${err.message}`);
  }
}

async function testImpsPayout() {
  const url = `${BASE_URL}/api/v1/payout/transaction`;
  console.log(`\n======================================`);
  console.log(`Testing IMPS Payout API (Forced IPv4)`);
  console.log(`URL: ${url}`);
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-TIMESTAMP': new Date().toISOString(),
        'X-REQUEST-ID': 'REQ' + Date.now(),
        'X-API-KEY': API_KEY
      },
      body: JSON.stringify({
        amount: 10,
        reference: "REF" + Date.now(),
        bankProfileId: "BP1001", 
        bankAccount: "100058651466",
        ifsc: "INDX0000265",
        latitude: "23.0225",
        longitude: "72.5714",
        name: "Test User",
        phone: "9999999999"
      })
    });
    
    console.log(`Status Code: ${response.status}`);
    const text = await response.text();
    console.log(`Response Body: \n${text}\n`);
  } catch (err: any) {
    console.error(`Error: ${err.message}`);
  }
}

async function runTests() {
  console.log(`Starting Camlenio API Tests...`);
  await testPennydrop();
  await testImpsPayout();
  console.log(`Tests Finished!`);
}

runTests();
