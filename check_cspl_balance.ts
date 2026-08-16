import fetch from 'node-fetch';

async function runBalanceCheck() {
  console.log('====================================================');
  console.log('  🔍 CAMLENIO LIVE CSPL API BALANCE CHECKER');
  console.log('====================================================\n');

  // 1. Fetch via Production Server API (Whitelisted IP: 103.186.20.126)
  try {
    console.log('[1] Fetching live balance via Production Server (usepay.in)...');
    const prodRes = await fetch('https://usepay.in/api/cspl-balance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const prodData = await prodRes.json();

    console.log('\n--- LIVE PRODUCTION SERVER API RESPONSE ---');
    console.log(JSON.stringify(prodData, null, 2));
    console.log('-------------------------------------------\n');
  } catch (err: any) {
    console.log('[1] Server Fetch Error:', err.message);
  }

  // 2. Direct Camlenio API Check
  try {
    console.log('[2] Fetching directly from cspl.camlenio.com...');
    const directRes = await fetch('https://cspl.camlenio.com/api/v1/wallet/balance', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-TIMESTAMP': new Date().toISOString(),
        'X-REQUEST-ID': 'req-' + Date.now(),
        'X-API-KEY': 'fjf0f2xy3W01NTtSDTUS62rdKyVqPSY7'
      },
      body: JSON.stringify({})
    });
    const directText = await directRes.text();

    console.log('\n--- DIRECT CAMLENIO SERVER RESPONSE ---');
    console.log(`HTTP Status: ${directRes.status}`);
    console.log(directText);
    console.log('----------------------------------------\n');
  } catch (err: any) {
    console.log('[2] Direct Fetch Error:', err.message);
  }
}

runBalanceCheck();
