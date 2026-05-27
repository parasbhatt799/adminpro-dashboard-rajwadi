const https = require('https');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not defined in env");
  process.exit(1);
}

const url = new URL(`${supabaseUrl}/rest/v1/`);

const options = {
  hostname: url.hostname,
  path: url.pathname,
  method: 'GET',
  headers: {
    'apikey': serviceKey,
    'Authorization': `Bearer ${serviceKey}`
  }
};

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    try {
      const data = JSON.parse(body);
      if (data.paths) {
        console.log('--- RPC PARAMETERS ---');
        for (const path in data.paths) {
          if (path.startsWith('/rpc/')) {
            console.log(`Path: ${path}`);
            const postOp = data.paths[path].post;
            if (postOp && postOp.parameters) {
              console.log('Parameters:');
              postOp.parameters.forEach(p => {
                if (p.schema) {
                  console.log(JSON.stringify(p.schema, null, 2));
                } else {
                  console.log(p);
                }
              });
            }
            console.log('--------------------');
          }
        }
      } else {
        console.log('No paths found. Response:', body);
      }
    } catch(e) {
      console.error('Parse error:', e, '\nBody was:', body);
    }
  });
});

req.on('error', (e) => {
  console.error('Request error:', e);
});

req.end();
