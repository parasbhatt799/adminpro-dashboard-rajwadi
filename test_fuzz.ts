import fetch from 'node-fetch';

const BASE_URL = 'https://cspl.camlenio.com';
const API_KEY = 'fjf0f2xy3W01NTtSDTUS62rdKyVqPSY7';
const SECRET_KEY = '7eSVhG7xf8sP5sLYAwFvQFZD7ksrb21BGmslzEolFkkbBxZLr8b9XrmxMCr3m16p';
const USER_ID = 'CU260707KTT';

async function testEndpoint(url: string, headers: any) {
  console.log(`\nTesting: ${url}`);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        accountNumber: "100058651466",
        ifsc: "INDX0000265",
        transactionId: "TXN123456789012"
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
  const customHeaders = {
    'Content-Type': 'application/json',
    'ApiKey': API_KEY,
    'SecretKey': SECRET_KEY,
    'UserId': USER_ID
  };

  const impsHeaders = {
    'Content-Type': 'application/json',
    'X-TIMESTAMP': new Date().toISOString(),
    'X-REQUEST-ID': 'test-12345',
    'X-API-KEY': API_KEY,
  };

  const pathsToTest = [
    '/api/vfc/pennydrop',
    '/api/payout/pennydrop',
    '/vfc/pennydrop',
    '/payout/pennydrop',
    '/pennydrop',
    '/api/v1/pennydrop',
    '/v1/vfc/pennydrop'
  ];

  for (const path of pathsToTest) {
    await testEndpoint(`${BASE_URL}${path}`, customHeaders);
    await testEndpoint(`${BASE_URL}${path}`, impsHeaders);
  }
}

runTests();
