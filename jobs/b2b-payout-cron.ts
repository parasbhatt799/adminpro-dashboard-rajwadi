import { supabaseAdmin } from '../server.js';
import { checkNixasoftStatus } from '../services/nixasoft_payout.js';
import { firePayoutWebhook } from '../api/b2b/controller.js';

let isReconciling = false;

/**
 * Automatically reconciles pending B2B Payout transactions
 * Queries Nixasoft upstream status, updates DB, refunds if failed,
 * and fires Webhook to partner/agent automatically.
 */
export async function reconcilePendingB2BPayouts() {
  if (isReconciling) return;
  isReconciling = true;

  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    // Do not check transactions created less than 15 seconds ago (let initial request settle)
    const fifteenSecondsAgo = new Date(Date.now() - 15 * 1000).toISOString();

    const { data: pendingTxs, error } = await supabaseAdmin
      .from('b2b_payout_transactions')
      .select('*')
      .eq('status', 'pending')
      .gte('created_at', twentyFourHoursAgo)
      .lte('created_at', fifteenSecondsAgo)
      .order('created_at', { ascending: true })
      .limit(20);

    if (error) {
      console.error('[B2B Payout Cron] Error fetching pending payouts:', error.message);
      return;
    }

    if (!pendingTxs || pendingTxs.length === 0) {
      return;
    }

    console.log(`[B2B Payout Cron] Found ${pendingTxs.length} pending B2B payout(s). Checking upstream status...`);

    for (const tx of pendingTxs) {
      try {
        const liveStatus = await checkNixasoftStatus(tx.order_id);
        console.log(`[B2B Payout Cron] Checked ${tx.order_id}: statusCode=${liveStatus.statuscode}, message=${liveStatus.message}`);

        if (liveStatus.statuscode === 'TXN') {
          const utr = liveStatus.data?.utr || tx.utr || null;
          const apiTxnId = liveStatus.data?.apiTxnId || tx.api_txn_id || null;

          await supabaseAdmin
            .from('b2b_payout_transactions')
            .update({
              status: 'success',
              utr,
              api_txn_id: apiTxnId,
              response_payload: liveStatus,
              updated_at: new Date().toISOString()
            })
            .eq('id', tx.id);

          // Find agent's webhook URL
          let targetWebhook = tx.request_payload?.webhook_url || tx.request_payload?.callback_url;
          if (!targetWebhook) {
            const { data: cred } = await supabaseAdmin
              .from('b2b_api_credentials')
              .select('webhook_url')
              .eq('id', tx.agent_id)
              .single();
            targetWebhook = cred?.webhook_url;
          }

          firePayoutWebhook(targetWebhook, tx.agent_id, {
            event: 'PAYOUT_STATUS_UPDATE',
            order_id: tx.order_id,
            client_order_id: tx.client_order_id || null,
            utr,
            status: 'success',
            amount: Number(tx.amount),
            base_fee: Number(tx.request_payload?.base_fee || tx.base_charge || Math.round((Number(tx.fee || 0) / 1.18) * 100) / 100),
            gst: Number(tx.request_payload?.gst_amount || tx.gst_amount || Math.round((Number(tx.fee || 0) - (Number(tx.fee || 0) / 1.18)) * 100) / 100),
            fee: Number(tx.fee || 0),
            total_deducted: Number(tx.total_deducted),
            beneficiary_name: tx.beneficiary_name,
            account_number: tx.account_number,
            ifsc_code: tx.ifsc_code,
            timestamp: new Date().toISOString()
          });

          console.log(`[B2B Payout Cron] ✅ Order ${tx.order_id} resolved to SUCCESS! UTR: ${utr}. Webhook dispatched.`);
        } else if (liveStatus.statuscode === 'TXF') {
          // Refund wallet
          await supabaseAdmin.rpc('add_b2b_payout_wallet', {
            p_agent_id: tx.agent_id,
            p_amount: tx.total_deducted
          });

          const failReason = liveStatus.message || 'Bank transaction declined';
          await supabaseAdmin
            .from('b2b_payout_transactions')
            .update({
              status: 'failed',
              error_message: failReason,
              response_payload: liveStatus,
              updated_at: new Date().toISOString()
            })
            .eq('id', tx.id);

          let targetWebhook = tx.request_payload?.webhook_url || tx.request_payload?.callback_url;
          if (!targetWebhook) {
            const { data: cred } = await supabaseAdmin
              .from('b2b_api_credentials')
              .select('webhook_url')
              .eq('id', tx.agent_id)
              .single();
            targetWebhook = cred?.webhook_url;
          }

          firePayoutWebhook(targetWebhook, tx.agent_id, {
            event: 'PAYOUT_STATUS_UPDATE',
            order_id: tx.order_id,
            client_order_id: tx.client_order_id || null,
            utr: null,
            status: 'failed',
            amount: Number(tx.amount),
            base_fee: Number(tx.request_payload?.base_fee || tx.base_charge || Math.round((Number(tx.fee || 0) / 1.18) * 100) / 100),
            gst: Number(tx.request_payload?.gst_amount || tx.gst_amount || Math.round((Number(tx.fee || 0) - (Number(tx.fee || 0) / 1.18)) * 100) / 100),
            fee: Number(tx.fee || 0),
            total_deducted: Number(tx.total_deducted),
            beneficiary_name: tx.beneficiary_name,
            account_number: tx.account_number,
            ifsc_code: tx.ifsc_code,
            failure_reason: failReason,
            timestamp: new Date().toISOString()
          });

          console.log(`[B2B Payout Cron] ❌ Order ${tx.order_id} resolved to FAILED. Wallet refunded and webhook dispatched.`);
        }
      } catch (singleErr: any) {
        console.error(`[B2B Payout Cron] Failed checking status for ${tx.order_id}:`, singleErr.message);
      }
    }
  } catch (err: any) {
    console.error('[B2B Payout Cron] Unexpected error in reconcile loop:', err.message);
  } finally {
    isReconciling = false;
  }
}

// Background poller running every 25 seconds
console.log('[B2B Payout Cron] Automated 24x7 Status Poller registered (interval: 25 seconds).');
setInterval(reconcilePendingB2BPayouts, 25000);

// Initial check 5s after startup
setTimeout(reconcilePendingB2BPayouts, 5000);
