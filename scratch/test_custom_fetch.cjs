const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Ensure fetch is available in environment
const customFetch = async (input, init) => {
  const urlStr = typeof input === 'string' ? input : (input && input.url) || String(input);
  console.log('Intercepted URL:', urlStr);
  
  if (urlStr.includes('/rest/v1/bbps_submissions')) {
    const urlObj = new URL(urlStr);
    // Replace transaction_id with rejection_reason in target query params
    const targetUrlObj = new URL(`${process.env.VITE_SUPABASE_URL}/rest/v1/bbps_submissions`);
    for (const [key, val] of urlObj.searchParams.entries()) {
      let mappedKey = key;
      let mappedVal = val;
      if (key === 'transaction_id') {
        mappedKey = 'rejection_reason';
      }
      mappedVal = mappedVal.replace(/transaction_id/g, 'rejection_reason');
      targetUrlObj.searchParams.set(mappedKey, mappedVal);
    }
    
    console.log('Routing to target:', targetUrlObj.toString());
    
    const headers = {
      ...init?.headers,
      'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
    };
    
    const res = await fetch(targetUrlObj.toString(), {
      ...init,
      headers
    });
    
    const text = await res.text();
    try {
      const json = JSON.parse(text);
      const mapRow = (row) => {
        if (row && typeof row === 'object') {
          if ('rejection_reason' in row) {
            row.transaction_id = row.rejection_reason;
          }
        }
      };
      if (Array.isArray(json)) {
        json.forEach(mapRow);
      } else {
        mapRow(json);
      }
      return new Response(JSON.stringify(json), {
        status: res.status,
        headers: res.headers
      });
    } catch(e) {
      return new Response(text, {
        status: res.status,
        headers: res.headers
      });
    }
  }
  
  return fetch(input, init);
};

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, {
  global: {
    fetch: customFetch
  }
});

async function run() {
  console.log('Querying bbps_submissions with anonymous client (mocking the proxy behavior)...');
  const { data, error } = await supabase
    .from('bbps_submissions')
    .select('*')
    .order('created_at', { ascending: false });
    
  if (error) {
    console.error('Query failed:', error);
  } else {
    console.log('Query succeeded! Count of rows received:', data.length);
    console.log('Rows:', data);
  }
}

run();
