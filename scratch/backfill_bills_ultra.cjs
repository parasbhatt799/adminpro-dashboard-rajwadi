const http = require('https');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('Missing environment variables');
  process.exit(1);
}

// Helper to make custom HTTP requests with timeouts and retries
function request(url, method, headers, body, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: method,
      headers: headers,
      timeout: timeoutMs
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data ? JSON.parse(data) : {});
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request Timeout'));
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function run() {
  console.log('Fetching remaining approved bills with null admin_share...');
  
  const headers = {
    'apikey': serviceKey,
    'Authorization': `Bearer ${serviceKey}`,
    'Content-Type': 'application/json'
  };

  let allBills = [];
  try {
    const url = `${supabaseUrl}/rest/v1/bill_submissions?status=eq.approved&admin_share=is.null&select=id,charges`;
    const resData = await request(url, 'GET', headers);
    allBills = resData || [];
  } catch (err) {
    console.error('Error fetching bills:', err.message);
    return;
  }

  console.log(`Found ${allBills.length} bills to update.`);
  if (allBills.length === 0) {
    console.log('No bills need updating.');
    return;
  }

  const CONCURRENCY = 8;
  let completed = 0;
  let failed = 0;
  const startTime = Date.now();

  // Simple async queue for concurrency control
  async function worker(bill) {
    let retries = 3;
    while (retries > 0) {
      try {
        const patchUrl = `${supabaseUrl}/rest/v1/bill_submissions?id=eq.${bill.id}`;
        await request(patchUrl, 'PATCH', headers, {
          admin_share: bill.charges,
          distributor_share: 0
        });
        completed++;
        return;
      } catch (err) {
        retries--;
        if (retries === 0) {
          failed++;
          console.error(`Failed to update ${bill.id}: ${err.message}`);
        } else {
          await sleep(500); // Backoff before retry
        }
      }
    }
  }

  // Process in batches
  for (let i = 0; i < allBills.length; i += CONCURRENCY) {
    const batch = allBills.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(worker));
    
    const totalProcessed = completed + failed;
    if (totalProcessed % 40 === 0 || totalProcessed === allBills.length) {
      const pct = (totalProcessed / allBills.length * 100).toFixed(1);
      console.log(`Progress: ${totalProcessed}/${allBills.length} (${pct}%)`);
    }
    
    await sleep(50); // Small interval sleep to avoid slamming the REST gateway
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\nUltra update finished in ${duration}s.`);
  console.log(`Successfully updated: ${completed}`);
  console.log(`Failed: ${failed}`);
}

run();
