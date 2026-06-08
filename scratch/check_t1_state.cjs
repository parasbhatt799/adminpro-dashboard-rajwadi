const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  try {
    // 1. Fetch QR Settings
    const { data: qrData, error: qrError } = await supabase
      .from('qr_settings')
      .select('*')
      .eq('id', 1)
      .single();

    if (qrError) {
      console.error('Error fetching qr_settings:', qrError.message);
      return;
    }

    const tPlusOneLimit = Number(qrData.t_plus_one_limit) || 0;
    console.log('--- QR Settings ---');
    console.log('T+1 Daily Limit:', tPlusOneLimit);

    // 2. Fetch today's T+1 sum
    const tzOffset = 5.5 * 60 * 60 * 1000;
    const now = new Date();
    const istTime = new Date(now.getTime() + tzOffset);
    const istTodayStart = new Date(Date.UTC(
      istTime.getUTCFullYear(),
      istTime.getUTCMonth(),
      istTime.getUTCDate(),
      0, 0, 0, 0
    ));
    const utcTodayStart = new Date(istTodayStart.getTime() - tzOffset);

    console.log('\n--- Date Info ---');
    console.log('Current UTC time:', now.toISOString());
    console.log('Current IST time (calculated):', istTime.toISOString());
    console.log('IST Start of Day (UTC timestamp):', utcTodayStart.toISOString());

    const { data: subs, error: subsError } = await supabase
      .from('payment_submissions')
      .select('id, amount, status, created_at, user_id')
      .eq('t_plus_one', true)
      .neq('status', 'rejected')
      .gte('created_at', utcTodayStart.toISOString());

    if (subsError) {
      console.error('Error fetching submissions:', subsError.message);
      return;
    }

    console.log('\n--- Today\'s T+1 Submissions ---');
    console.log('Count:', subs.length);
    let totalSum = 0;
    subs.forEach(s => {
      console.log(`- ID: ${s.id}, User: ${s.user_id}, Amount: ${s.amount}, Status: ${s.status}, CreatedAt: ${s.created_at}`);
      totalSum += Number(s.amount);
    });

    console.log('\nTotal T+1 Amount Submitted Today:', totalSum);
    console.log('Remaining Limit:', tPlusOneLimit - totalSum);

  } catch (err) {
    console.error('Error:', err);
  }
}

main();
