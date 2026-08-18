import cron from 'node-cron';
import { supabaseAdmin } from '../server.js';
import * as camlenioPayout from '../services/camlenio_payout.js';

console.log('[PAYOUT CRON] Initializing Payout automatic status check job...');

export async function processPendingPayoutsCron() {
  console.log('[PAYOUT CRON] Checking status for pending and processing payouts...');
  const results = {
    processed: 0,
    approved: 0,
    rejected: 0,
    unchanged: 0,
    errors: 0,
    details: [] as string[]
  };

  try {
    // 1. Fetch all pending or processing payout submissions from database
    const { data: pendingPayouts, error } = await supabaseAdmin
      .from('payout_submissions')
      .select('*')
      .in('status', ['pending', 'processing']);

    if (error) {
      console.error('[PAYOUT CRON] Error fetching pending payouts:', error);
      results.details.push(`Error fetching pending payouts: ${error.message}`);
      return results;
    }

    if (!pendingPayouts || pendingPayouts.length === 0) {
      console.log('[PAYOUT CRON] No pending or processing payouts found.');
      results.details.push('No pending/processing payouts found.');
      return results;
    }

    results.processed = pendingPayouts.length;
    console.log(`[PAYOUT CRON] Found ${pendingPayouts.length} pending/processing payout(s). Checking status with provider...`);

    for (const payout of pendingPayouts) {
      // Prefer bank_ref or txn_id over raw internal id
      const targetTxnId = payout.bank_ref || payout.txn_id || payout.id;

      if (!targetTxnId) {
        console.log(`[PAYOUT CRON] Skipping payout ID ${payout.id} - missing reference transaction ID.`);
        results.details.push(`Skipped payout ID ${payout.id} (missing ref ID)`);
        continue;
      }

      try {
        // Query Camlenio Payout Status API
        const apiResponse = await camlenioPayout.checkPayoutStatus(targetTxnId);
        const statusData = apiResponse?.data || {};
        
        // Extract status string from various potential response locations
        const statusStr = (
          statusData.status || 
          (apiResponse as any).status || 
          statusData.status_message || 
          apiResponse?.message || 
          ''
        ).toString().toLowerCase();

        const utr = statusData.utr || (apiResponse as any).utr || statusData.bankRef || payout.bank_ref;

        console.log(`[PAYOUT CRON] Payout ID ${payout.id} (Ref: ${targetTxnId}) API Status: '${statusStr}'`);

        // 2. Handle APPROVED / SUCCESS status
        if (
          statusStr === 'success' || 
          statusStr === 'approved' || 
          statusStr === 'successful' || 
          statusStr.includes('success')
        ) {
          if (payout.status !== 'approved') {
            await supabaseAdmin
              .from('payout_submissions')
              .update({
                status: 'approved',
                utr_number: utr || payout.utr_number,
                remark: JSON.stringify(apiResponse)
              })
              .eq('id', payout.id);

            results.approved++;
            results.details.push(`Payout ID ${payout.id} marked APPROVED (UTR: ${utr})`);
            console.log(`[PAYOUT CRON] Payout ID ${payout.id} marked as APPROVED.`);
          }
        } 
        // 3. Handle REJECTED / FAILED status
        else if (
          statusStr === 'failed' || 
          statusStr === 'failure' || 
          statusStr === 'rejected' || 
          statusStr.includes('fail') || 
          statusStr.includes('reject')
        ) {
          if (payout.status !== 'rejected' && payout.status !== 'refunded') {
            await supabaseAdmin
              .from('payout_submissions')
              .update({
                status: 'rejected',
                remark: JSON.stringify(apiResponse)
              })
              .eq('id', payout.id);

            // Refund User Balance if applicable
            const totalRefund = parseFloat(payout.amount || 0) + parseFloat(payout.charge_amount || 0);
            if (totalRefund > 0 && payout.user_id) {
              const { data: user } = await supabaseAdmin
                .from('users_profiles')
                .select('wallet_balance')
                .eq('id', payout.user_id)
                .single();

              if (user) {
                const newBalance = Number(user.wallet_balance || 0) + totalRefund;
                await supabaseAdmin
                  .from('users_profiles')
                  .update({ wallet_balance: newBalance })
                  .eq('id', payout.user_id);

                console.log(`[PAYOUT CRON] Payout ID ${payout.id} REJECTED. Refunded ₹${totalRefund} to user ${payout.user_id}.`);
              }
            }

            results.rejected++;
            results.details.push(`Payout ID ${payout.id} marked REJECTED (Refunded ₹${totalRefund})`);
          }
        } else {
          results.unchanged++;
          results.details.push(`Payout ID ${payout.id} status remains '${statusStr || 'pending'}'`);
          console.log(`[PAYOUT CRON] Payout ID ${payout.id} status remains '${statusStr || 'pending'}'.`);
        }
      } catch (err: any) {
        results.errors++;
        results.details.push(`Error checking payout ID ${payout.id}: ${err.message}`);
        console.error(`[PAYOUT CRON] Exception while checking status for payout ID ${payout.id}:`, err);
      }
    }
  } catch (globalErr: any) {
    results.details.push(`Global cron error: ${globalErr.message}`);
    console.error('[PAYOUT CRON] Uncaught error in payout status cron job:', globalErr);
  }

  return results;
}

// Schedule cron job to run every 5 minutes: '*/5 * * * *'
cron.schedule('*/5 * * * *', async () => {
  await processPendingPayoutsCron();
});
