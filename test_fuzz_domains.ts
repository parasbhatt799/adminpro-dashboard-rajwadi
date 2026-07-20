import fetch from 'node-fetch';

const SUBDOMAINS = [
  'cspl',
  'api',
  'pay',
  'payout',
  'merchant'
];

async function testEndpoint(url: string) {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    console.log(`[${response.status}] ${url}`);
  } catch (err: any) {
    console.log(`[ERR] ${url}: ${err.message}`);
  }
}

async function runTests() {
  for (const sub of SUBDOMAINS) {
    await testEndpoint(`https://${sub}.camlenio.com/api/v1/vfc/pennydrop`);
    await testEndpoint(`https://${sub}.camlenio.com/api/v1/payout/pennydrop`);
    await testEndpoint(`https://${sub}.camlenio.com/api/v1/payout/transaction`);
  }
}

runTests();
