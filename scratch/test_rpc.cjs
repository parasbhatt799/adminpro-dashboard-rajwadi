const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, serviceKey);

async function run() {
  try {
    const startDate = '2026-05-30T00:00:00';
    console.log('Testing RPC for date:', startDate);

    // Call the RPC get_opening_balance
    const { data: rpcVal, error: rpcErr } = await supabase.rpc('get_opening_balance', {
      p_user_id: null,
      p_start_date: startDate
    });

    if (rpcErr) {
      console.error('RPC Error:', rpcErr);
    } else {
      console.log('RPC get_opening_balance returned:', rpcVal);
    }

    // Now calculate it manually
    // Sum of QRs before startDate
    const { data: qrPre, error: qrErr } = await supabase.from('payment_submissions')
      .select('amount, charges')
      .eq('status', 'approved')
      .lt('created_at', startDate);
    if (qrErr) console.error('QR error:', qrErr);

    const { data: billPre, error: billErr } = await supabase.from('bill_submissions')
      .select('amount, charges, status')
      .in('status', ['approved', 'pending'])
      .lt('created_at', startDate);
    if (billErr) console.error('Bill error:', billErr);

    const { data: bbpsPre, error: bbpsErr } = await supabase.from('bbps_submissions')
      .select('amount, charges, status')
      .in('status', ['approved', 'pending'])
      .lt('created_at', startDate);
    if (bbpsErr) console.error('BBPS error:', bbpsErr);

    const { data: payoutPre, error: payoutErr } = await supabase.from('payout_submissions')
      .select('amount, charge_amount, status')
      .in('status', ['approved', 'pending', 'processing'])
      .lt('created_at', startDate);
    if (payoutErr) console.error('Payout error:', payoutErr);

    const qrTotal = (qrPre || []).reduce((acc, r) => acc + (Number(r.amount) - Number(r.charges || 0)), 0);
    const billTotal = (billPre || []).reduce((acc, r) => acc + (Number(r.amount) + Number(r.charges || 0)), 0);
    const bbpsTotal = (bbpsPre || []).reduce((acc, r) => acc + (Number(r.amount) + Number(r.charges || 0)), 0);
    const payoutTotal = (payoutPre || []).reduce((acc, r) => acc + (Number(r.amount) + Number(r.charge_amount || 0)), 0);

    console.log('Manual breakdown:');
    console.log('  QR Approved Credit total:', qrTotal);
    console.log('  Bill Debit total:', billTotal);
    console.log('  BBPS Debit total:', bbpsTotal);
    console.log('  Payout Debit total:', payoutTotal);

    const manualWithoutBBPS = qrTotal - billTotal - payoutTotal;
    const manualWithBBPS = qrTotal - billTotal - bbpsTotal - payoutTotal;

    console.log('Manual calculated (without BBPS):', manualWithoutBBPS);
    console.log('Manual calculated (with BBPS):', manualWithBBPS);

  } catch (err) {
    console.error(err);
  }
}

run();
