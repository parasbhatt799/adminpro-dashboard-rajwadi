const https = require('https');

const BASE_HOSTNAME = 'cspl.camlenio.com';
const API_KEY = 'fjf0f2xy3W01NTtSDTUS62rdKyVqPSY7';
const SECRET_KEY = '7eSVhG7xf8sP5sLYAwFvQFZD7ksrb21BGmslzEolFkkbBxZLr8b9XrmxMCr3m16p';
const USER_ID = 'CU260707KTT';

function makeRequest(path, headers, payload, name) {
  return new Promise((resolve) => {
    const dataString = JSON.stringify(payload);
    headers['Content-Length'] = Buffer.byteLength(dataString);

    const options = {
      hostname: BASE_HOSTNAME,
      port: 443,
      path: path,
      method: 'POST',
      headers: headers,
      family: 4 // Force IPv4
    };

    const req = https.request(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => { responseBody += chunk; });
      res.on('end', () => {
        if (res.statusCode !== 404 && res.statusCode !== 405) {
            console.log(`[FOUND!] ${path} -> Status: ${res.statusCode}`);
            console.log(responseBody.substring(0, 100));
        } else {
            console.log(`[404] ${path}`);
        }
        resolve();
      });
    });

    req.on('error', () => { resolve(); });
    req.write(dataString);
    req.end();
  });
}

async function runTests() {
  const impsHeaders = {
    'Content-Type': 'application/json',
    'X-TIMESTAMP': new Date().toISOString(),
    'X-REQUEST-ID': 'REQ' + Date.now(),
    'X-API-KEY': API_KEY
  };
  
  const payload = { test: 1 };

  console.log("Fuzzing paths...");
  const paths = [
    '/api/v1/aeps/BalanceEnq', // We know this one exists
    '/api/v1/transaction',
    '/api/v1/payout',
    '/api/v1/imps',
    '/api/v1/imps/payout',
    '/api/payout/transaction',
    '/transaction',
    '/payout',
    '/v1/payout/transaction',
    '/api/vfc/pennydrop',
    '/vfc/pennydrop',
    '/api/pennydrop',
    '/api/v1/vfc/pennydrop',
    '/api/v1/payout/transaction',
    '/api/v1/payout/pennydrop'
  ];

  for (const p of paths) {
    await makeRequest(p, impsHeaders, payload, 'IMPS');
  }
  console.log("Done fuzzing");
}

runTests();
