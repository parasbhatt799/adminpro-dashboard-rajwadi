import cron from 'node-cron';
import { supabaseAdmin } from '../server.js';
import * as camlenioPayout from '../services/camlenio_payout.js';

console.log('[PAYOUT CRON] Initializing Payout automatic status check job...');

// Schedule cron job to run every 5 minutes: '*/5 * * * *'
cron.schedule('*/5 * * * *', async () => {
  console.log('[PAYOUT CRON] Checking status for pending payouts...');
  try {
    // 1. Fetch all pending payout submissions from database
    const { data: pendingPayouts, error } = await supabaseAdmin
      .from('payout_submissions')
      .select('*')
      .eq('status', 'pending');

    if (error) {
      console.error('[PAYOUT CRON] Error fetching pending payouts:', error);
      return;
    }

    if (!pendingPayouts || pendingPayouts.length === 0) {
      console.log('[PAYOUT CRON] No pending payouts found.');
      return;
    }

    console.log(`[PAYOUT CRON] Found ${pendingPayouts.length} pending payout(s). Checking status with provider...`);

    for (const payout of pendingPayouts) {
      const targetTxnId = payout.bank_ref || payout.txn_id || payout.id;

      if (!targetTxnId) {
        console.log(`[PAYOUT CRON] Skipping payout ID ${payout.id} - missing reference transaction ID.`);
        continue;
      }

      try {
        // Query Camlenio Payout Status API
        const result = await camlenioPayout.checkPayoutStatus(targetTxnId);
        const statusData = result?.data || {};
        const statusStr = (statusData.status || (result as any).status || '').toString().toLowerCase();
        const utr = statusData.utr || (result as any).utr;

        // 2. Handle APPROVED / SUCCESS status
        if (statusStr === 'success' || statusStr === 'approved' || statusStr === 'successful') {
          if (payout.status !== 'approved') {
            await supabaseAdmin
              .from('payout_submissions')
              .update({
                status: 'approved',
                utr_number: utr || payout.utr_number,
                remark: JSON.stringify(result)
              })
              .eq('id', payout.id);

            console.log(`[PAYOUT CRON] Payout ID ${payout.id} (txn: ${targetTxnId}) marked as APPROVED.`);
          }
        } 
        // 3. Handle REJECTED / FAILED status
        else if (statusStr === 'failed' || statusStr === 'failure' || statusStr === 'rejected') {
          if (payout.status !== 'rejected' && payout.status !== 'refunded') {
            await supabaseAdmin
              .from('payout_submissions')
              .update({
                status: 'rejected',
                remark: JSON.stringify(result)
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
          }
        } else {
          console.log(`[PAYOUT CRON] Payout ID ${payout.id} (txn: ${targetTxnId}) status remains '${statusStr || 'pending'}'.`);
        }
      } catch (err) {
        console.error(`[PAYOUT CRON] Exception while checking status for payout ID ${payout.id}:`, err);
      }
    }
  } catch (globalErr) {
    console.error('[PAYOUT CRON] Uncaught error in payout status cron job:', globalErr);
  }
});
