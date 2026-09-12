import cron from 'node-cron';
import { supabaseAdmin } from '../server.js';
import * as indiatekPayout from '../services/indiatek_payout.js';

console.log('[IndiaTek CRON] Initializing IndiaTek (KingWallet) automatic payout status check job...');

/**
 * Process all pending IndiaTek payouts
 * Checks KingWallet API and updates status to SUCCESS / FAILED
 * If a payout has FAILED, automatically refunds the user's wallet
 */
export async function processPendingIndiaTekPayouts() {
  console.log('[IndiaTek CRON] Running 10-minute check for pending payouts...');
  const results = {
    processed: 0,
    success: 0,
    failed: 0,
    pending: 0,
    errors: 0,
    details: [] as string[]
  };

  try {
    // 1. Fetch all pending / processing submissions
    const { data: pendingPayouts, error } = await supabaseAdmin
      .from('indiatek_payout_submissions')
      .select('*')
      .in('status', ['PENDING', 'PROCESSING', 'pending', 'processing']);

    if (error) {
      console.error('[IndiaTek CRON] Error fetching pending payouts:', error);
      results.details.push(`DB Error: ${error.message}`);
      return results;
    }

    if (!pendingPayouts || pendingPayouts.length === 0) {
      console.log('[IndiaTek CRON] No pending IndiaTek payouts found.');
      results.details.push('No pending payouts found.');
      return results;
    }

    results.processed = pendingPayouts.length;
    console.log(`[IndiaTek CRON] Found ${pendingPayouts.length} pending payout(s). Checking status with KingWallet API...`);

    // 2. Fetch API Credentials from DB or local settings
    const { data: dbSettings } = await supabaseAdmin
      .from('indiatek_payout_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle();

    const localSettings = indiatekPayout.getLocalSettings();
    const username = (dbSettings?.username || localSettings.username || '').trim();
    const apiSecret = (dbSettings?.api_secret || localSettings.api_secret || '').trim();

    if (!username || !apiSecret) {
      console.warn('[IndiaTek CRON] Missing KingWallet API credentials. Skipping status check.');
      results.details.push('Missing API credentials');
      return results;
    }

    for (const payout of pendingPayouts) {
      const partnerRef = payout.partner_reference;

      if (!partnerRef) {
        console.warn(`[IndiaTek CRON] Skipping payout ID ${payout.id} due to missing partner_reference.`);
        results.details.push(`Skipped ID ${payout.id} (missing ref)`);
        continue;
      }

      // Check transaction age: skip if created less than 60 seconds ago
      const createdAt = new Date(payout.created_at).getTime();
      if (Date.now() - createdAt < 60 * 1000) {
        console.log(`[IndiaTek CRON] Payout ${partnerRef} is too new (< 60s). Skipping until next cycle.`);
        results.details.push(`${partnerRef} too new`);
        continue;
      }

      try {
        const statusResult = await indiatekPayout.checkIndiaTekStatus(
          partnerRef,
          username,
          apiSecret,
          payout.transaction_id || undefined
        );
        const rawStatus = (
          statusResult?.data?.status || 
          statusResult?.status || 
          statusResult?.transaction_status || 
          ''
        ).toString().toUpperCase();

        const txnId = statusResult?.operator_ref || statusResult?.data?.transaction_id || statusResult?.txn_id || statusResult?.data?.utr || payout.transaction_id || null;
        const resolvedClientRef = statusResult?.client_ref_id || statusResult?.data?.client_ref_id || partnerRef;
        const resolvedUtr = statusResult?.operator_ref || statusResult?.data?.operator_ref || statusResult?.data?.utr || txnId || resolvedClientRef;

        console.log(`[IndiaTek CRON] Payout Ref: ${partnerRef} (Txn: ${payout.transaction_id || 'N/A'}) -> API Status: '${rawStatus}', Resolved Txn ID: '${txnId}'`);

        // All match conditions for master payout_submissions
        const allMatchRefs = Array.from(new Set([
          partnerRef,
          payout.transaction_id,
          resolvedClientRef,
          txnId,
          resolvedUtr
        ].filter(Boolean) as string[]));

        const orConditions = allMatchRefs.map(r => `bank_ref.eq.${r},txn_id.eq.${r},transaction_id.eq.${r},utr_number.eq.${r}`).join(',');

        // A. SUCCESS Status
        if (rawStatus === 'SUCCESS' || rawStatus === 'APPROVED' || rawStatus === 'COMPLETED') {
          await supabaseAdmin
            .from('indiatek_payout_submissions')
            .update({
              status: 'SUCCESS',
              transaction_id: txnId || payout.transaction_id,
              partner_reference: resolvedClientRef || partnerRef,
              response_payload: statusResult,
              updated_at: new Date().toISOString()
            })
            .eq('id', payout.id);

          // Update master payout_submissions for statements
          await supabaseAdmin
            .from('payout_submissions')
            .update({
              status: 'approved',
              transaction_id: txnId || resolvedClientRef,
              txn_id: txnId || resolvedClientRef,
              utr_number: resolvedUtr || txnId || resolvedClientRef,
              bank_ref: resolvedClientRef,
              remark: 'UsePayout Success'
            })
            .or(orConditions);

          results.success++;
          results.details.push(`${partnerRef} -> SUCCESS (Txn: ${txnId})`);
          console.log(`[IndiaTek CRON] Payout ${partnerRef} marked SUCCESS.`);
        } 
        // B. FAILED / REJECTED Status -> Auto Refund
        else if (rawStatus === 'FAILED' || rawStatus === 'FAILURE' || rawStatus === 'REJECTED') {
          await supabaseAdmin
            .from('indiatek_payout_submissions')
            .update({
              status: 'FAILED',
              transaction_id: txnId || payout.transaction_id,
              partner_reference: resolvedClientRef || partnerRef,
              response_payload: statusResult,
              updated_at: new Date().toISOString()
            })
            .eq('id', payout.id);

          // Update master payout_submissions for statements
          await supabaseAdmin
            .from('payout_submissions')
            .update({
              status: 'rejected',
              transaction_id: txnId || resolvedClientRef,
              txn_id: txnId || resolvedClientRef,
              utr_number: resolvedUtr || txnId || resolvedClientRef,
              bank_ref: resolvedClientRef,
              remark: 'UsePayout Failed'
            })
            .or(orConditions);

          // Refund user balance
          const refundAmount = Number(payout.amount || 0) + Number(payout.charges || 0);
          if (refundAmount > 0 && payout.user_id && payout.user_id !== 'admin') {
            try {
              const { data: userProfile } = await supabaseAdmin
                .from('users_profiles')
                .select('wallet_balance')
                .eq('id', payout.user_id)
                .single();

              if (userProfile) {
                const currentBal = Number(userProfile.wallet_balance || 0);
                const newBal = currentBal + refundAmount;
                await supabaseAdmin
                  .from('users_profiles')
                  .update({ wallet_balance: newBal })
                  .eq('id', payout.user_id);

                console.log(`[IndiaTek CRON] Payout ${partnerRef} FAILED. Refunded ₹${refundAmount.toFixed(2)} to user ${payout.user_id}.`);
              }
            } catch (refundErr) {
              console.error(`[IndiaTek CRON] Failed to refund user ${payout.user_id}:`, refundErr);
            }
          }

          results.failed++;
          results.details.push(`${partnerRef} -> FAILED (Refunded ₹${refundAmount.toFixed(2)})`);
        } 
        // C. Still PENDING
        else {
          results.pending++;
          results.details.push(`${partnerRef} -> Still ${rawStatus || 'PENDING'}`);
        }
      } catch (err: any) {
        results.errors++;
        results.details.push(`Error checking ${partnerRef}: ${err.message}`);
        console.error(`[IndiaTek CRON] Exception checking status for ${partnerRef}:`, err);
      }
    }
  } catch (globalErr: any) {
    results.details.push(`Global cron error: ${globalErr.message}`);
    console.error('[IndiaTek CRON] Uncaught error in cron runner:', globalErr);
  }

  return results;
}

// Schedule cron job to run every 10 minutes: '*/10 * * * *'
cron.schedule('*/10 * * * *', async () => {
  await processPendingIndiaTekPayouts();
});
