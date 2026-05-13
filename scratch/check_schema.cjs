
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

let envFile;
if (fs.existsSync('.env')) {
  envFile = fs.readFileSync('.env', 'utf8');
} else if (fs.existsSync('.env.local')) {
  envFile = fs.readFileSync('.env.local', 'utf8');
}

if (!envFile) {
  console.error('Env file not found');
  process.exit(1);
}

function getEnvVar(name) {
  const regex = new RegExp(`${name}\\s*=\\s*["']?([^"']*)["']?`);
  const match = envFile.match(regex);
  return match ? match[1].trim() : null;
}

const supabaseUrl = getEnvVar('VITE_SUPABASE_URL') || getEnvVar('NEXT_PUBLIC_SUPABASE_URL');
const supabaseKey = getEnvVar('VITE_SUPABASE_ANON_KEY') || getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY');

if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase credentials not found');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  const { data, error } = await supabase
    .from('qr_history')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error fetching qr_history:', error);
  } else {
    console.log('Columns in qr_history:', Object.keys(data[0] || {}));
  }
}

checkSchema();
