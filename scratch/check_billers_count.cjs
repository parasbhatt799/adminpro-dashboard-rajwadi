const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing supabase URL or Service Role Key in environment!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("Connecting to Supabase at:", supabaseUrl);
  
  const { data, error } = await supabase
    .from('billavenue_billers')
    .select('biller_id, biller_name, category');

  if (error) {
    console.error("Error fetching billers:", error);
    return;
  }

  console.log(`Total billers found in database: ${data.length}`);
  
  if (data.length === 0) {
    console.log("No billers cached in database.");
    return;
  }

  const categoryCounts = {};
  data.forEach(b => {
    const cat = b.category || 'No Category';
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
  });

  console.log("\nBillers count per category:");
  Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]).forEach(([cat, count]) => {
    console.log(`- ${cat}: ${count}`);
  });

  console.log("\nSample of 5 billers:");
  console.log(data.slice(0, 5));
}

main().catch(console.error);
