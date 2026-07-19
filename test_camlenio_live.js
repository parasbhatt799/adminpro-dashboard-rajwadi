const https = require('https');

// Make sure these match your LIVE credentials
const BASE_HOSTNAME = 'cspl.camlenio.com';
const API_KEY = 'fjf0f2xy3W01NTtSDTUS62rdKyVqPSY7';
const SECRET_KEY = '7eSVhG7xf8sP5sLYAwFvQFZD7ksrb21BGmslzEolFkkbBxZLr8b9XrmxMCr3m16p';
const USER_ID = 'CU260707KTT';

function makeRequest(path, headers, payload, name) {
  return new Promise((resolve, reject) => {
    console.log(`\n======================================`);
    console.log(`Testing ${name} on LIVE Server`);
    console.log(`URL: https://${BASE_HOSTNAME}${path}`);
    
    const dataString = JSON.stringify(payload);
    headers['Content-Length'] = Buffer.byteLength(dataString);

    const options = {
      hostname: BASE_HOSTNAME,
      port: 443,
      path: path,
      method: 'POST',
      headers: headers
    };

    const req = https.request(options, (res) => {
      console.log(`Status Code: ${res.statusCode}`);
      
      let responseBody = '';
      res.on('data', (chunk) => {
        responseBody += chunk;
      });
      
      res.on('end', () => {
        console.log(`Response Body: \n${responseBody}\n`);
        resolve();
      });
    });

    req.on('error', (error) => {
      console.error(`Error: ${error.message}`);
      reject(error);
    });

    req.write(dataString);
    req.end();
  });
}

async function runTests() {
  console.log(`Starting Camlenio API Tests (No dependencies required)...`);

  // 1. Test Pennydrop
  await makeRequest(
    '/api/v1/vfc/pennydrop',
    {
      'Content-Type': 'application/json',
      'ApiKey': API_KEY,
      'SecretKey': SECRET_KEY,
      'UserId': USER_ID
    },
    {
      accountNumber: "100058651466",
      ifsc: "INDX0000265",
      transactionId: "TXN" + Date.now()
    },
    'Pennydrop API'
  );

  // 2. Test IMPS Payout
  await makeRequest(
    '/api/v1/payout/transaction',
    {
      'Content-Type': 'application/json',
      'X-TIMESTAMP': new Date().toISOString(),
      'X-REQUEST-ID': 'REQ' + Date.now(),
      'X-API-KEY': API_KEY
    },
    {
      amount: 10,
      reference: "REF" + Date.now(),
      bankProfileId: "BP1001",
      bankAccount: "100058651466",
      ifsc: "INDX0000265",
      latitude: "23.0225",
      longitude: "72.5714",
      name: "Test User",
      phone: "9999999999"
    },
    'IMPS Payout API'
  );

  console.log(`Tests Finished!`);
}

runTests();
