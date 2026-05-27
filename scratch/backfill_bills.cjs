const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  console.log('Fetching all approved bills with null admin_share...');
  
  let allBills = [];
  let from = 0;
  const limit = 1000;
  
  while (true) {
    const { data, error } = await supabase
      .from('bill_submissions')
      .select('id, charges')
      .eq('status', 'approved')
      .is('admin_share', null)
      .range(from, from + limit - 1);
      
    if (error) {
      console.error('Error fetching bills:', error);
      return;
    }
    
    if (!data || data.length === 0) break;
    allBills = [...allBills, ...data];
    if (data.length < limit) break;
    from += limit;
  }
  
  console.log(`Found ${allBills.length} bills to update.`);
  
  if (allBills.length === 0) {
    console.log('No bills need updating.');
    return;
  }
  
  // Safe concurrency limit
  const CONCURRENCY = 15;
  let completed = 0;
  let failed = 0;
  
  const chunks = [];
  for (let i = 0; i < allBills.length; i += CONCURRENCY) {
    chunks.push(allBills.slice(i, i + CONCURRENCY));
  }
  
  console.log(`Updating in ${chunks.length} batches of ${CONCURRENCY}...`);
  
  const startTime = Date.now();
  
  for (let b = 0; b < chunks.length; b++) {
    const chunk = chunks[b];
    await Promise.all(chunk.map(async (bill) => {
      try {
        const { error } = await supabase
          .from('bill_submissions')
          .update({ 
            admin_share: bill.charges,
            distributor_share: 0 
          })
          .eq('id', bill.id);
          
        if (error) {
          failed++;
          console.error(`Failed to update bill ${bill.id}:`, error.message);
        } else {
          completed++;
        }
      } catch (err) {
        failed++;
        console.error(`Error updating bill ${bill.id}:`, err);
      }
    }));
    
    // Simple interval print to reduce logging overhead
    if ((b + 1) % 10 === 0 || b + 1 === chunks.length) {
      const pct = ((completed + failed) / allBills.length * 100).toFixed(1);
      console.log(`Batch ${b + 1}/${chunks.length} complete. Progress: ${completed + failed}/${allBills.length} (${pct}%)`);
    }
  }
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\nUpdate finished in ${duration}s.`);
  console.log(`Successfully updated: ${completed}`);
  console.log(`Failed: ${failed}`);
}

run();
