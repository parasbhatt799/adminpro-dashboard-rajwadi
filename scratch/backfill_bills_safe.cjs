const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
  
  let completed = 0;
  let failed = 0;
  
  const startTime = Date.now();
  
  for (let i = 0; i < allBills.length; i++) {
    const bill = allBills[i];
    
    let retries = 3;
    let success = false;
    
    while (retries > 0 && !success) {
      try {
        const { error } = await supabase
          .from('bill_submissions')
          .update({ 
            admin_share: bill.charges,
            distributor_share: 0 
          })
          .eq('id', bill.id);
          
        if (error) {
          retries--;
          if (retries === 0) {
            failed++;
            console.error(`Failed to update bill ${bill.id}:`, error.message);
          } else {
            await sleep(100); // Wait longer on error retry
          }
        } else {
          completed++;
          success = true;
        }
      } catch (err) {
        retries--;
        if (retries === 0) {
          failed++;
          console.error(`Error updating bill ${bill.id}:`, err);
        } else {
          await sleep(100);
        }
      }
    }
    
    // Print progress every 50 records
    if (completed % 50 === 0 || completed === allBills.length) {
      const pct = ((completed + failed) / allBills.length * 100).toFixed(1);
      console.log(`Progress: ${completed + failed}/${allBills.length} (${pct}%)`);
    }
    
    // Tiny sleep between updates to respect rate limits
    await sleep(20);
  }
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\nSafe update finished in ${duration}s.`);
  console.log(`Successfully updated: ${completed}`);
  console.log(`Failed: ${failed}`);
}

run();
