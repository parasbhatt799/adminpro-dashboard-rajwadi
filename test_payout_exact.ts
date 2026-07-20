import fetch from 'node-fetch';

const BASE_URL = 'https://cspl.camlenio.com/';
const API_KEY = 'fjf0f2xy3W01NTtSDTUS62rdKyVqPSY7';

async function testEndpoint(url: string, headers: any, name: string) {
  console.log(`\nTesting ${name}: ${url}`);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
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
    console.log(`Status: ${response.status}`);
    const text = await response.text();
    console.log(`Response: ${text.substring(0, 200)}`);
  } catch (err: any) {
    console.error(`Error: ${err.message}`);
  }
}

async function runTests() {
  const impsHeaders = {
    'Content-Type': 'application/json',
    'X-TIMESTAMP': new Date().toISOString(),
    'X-REQUEST-ID': 'test-12345',
    'X-API-KEY': API_KEY,
  };

  await testEndpoint(BASE_URL, impsHeaders, 'IMPS Exact URL');
}

runTests();
