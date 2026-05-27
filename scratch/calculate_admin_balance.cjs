const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceKey);

async function run() {
  try {
    const fetchAll = async (query) => {
      let allData = [];
      let from = 0;
      const step = 1000;
      while (true) {
        const { data, error } = await query.range(from, from + step - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        allData = [...allData, ...data];
        if (data.length < step) break;
        from += step;
      }
      return allData;
    };

    const qrQuery = supabase.from('payment_submissions')
      .select(`
        charges, 
        amount, 
        admin_share,
        distributor_share,
        super_distributor_share,
        user:user_id(
          distributor_id,
          admin_base_qr_charge,
          distributor:distributor_id(admin_base_qr_charge, role)
        )
      `)
      .eq('status', 'approved');

    const billQuery = supabase.from('bill_submissions')
      .select(`charges, admin_share, distributor_share`)
      .eq('status', 'approved');

    const payoutQuery = supabase.from('payout_submissions').select('charge_amount').eq('status', 'approved');
    const withdrawalQuery = supabase.from('admin_withdrawals').select('*').order('created_at', { ascending: false });

    const [qrData, billData, payoutData, withdrawalData] = await Promise.all([
      fetchAll(qrQuery),
      fetchAll(billQuery),
      fetchAll(payoutQuery),
      fetchAll(withdrawalQuery)
    ]);

    const totalQrCharges = (qrData || []).reduce((acc, curr) => {
      if (curr.admin_share !== null && curr.admin_share !== undefined) {
        return acc + Number(curr.admin_share);
      }
      let adminShare = Number(curr.charges) || 0;
      const user = curr.user;
      if (user?.distributor_id && user?.distributor && user.distributor.role === 'distributor') {
        const adminBasePercentage = Number(user.distributor.admin_base_qr_charge) || 0;
        adminShare = (Number(curr.amount) * adminBasePercentage) / 100;
      }
      return acc + adminShare;
    }, 0);

    const totalBillCharges = (billData || []).reduce((acc, curr) => acc + (Number(curr.charges) || 0), 0);
    const totalPayoutCharges = (payoutData || []).reduce((acc, r) => acc + (Number(r.charge_amount) || 0), 0);
    const totalWithdrawals = (withdrawalData || []).reduce((acc, r) => acc + (Number(r.amount) || 0), 0);

    const totalDistributorShare = [...(qrData || []), ...(billData || [])].reduce((acc, curr) => acc + (Number(curr.distributor_share) || 0), 0);
    const totalSuperDistributorShare = (qrData || []).reduce((acc, curr) => acc + (Number(curr.super_distributor_share) || 0), 0);

    console.log('--- INDIVIDUAL CHARGES ---');
    console.log('totalQrCharges (admin_share):', totalQrCharges);
    console.log('totalBillCharges (total charges):', totalBillCharges);
    console.log('totalPayoutCharges:', totalPayoutCharges);
    console.log('totalDistributorShare:', totalDistributorShare);
    console.log('totalSuperDistributorShare:', totalSuperDistributorShare);
    console.log('totalWithdrawals:', totalWithdrawals);
    console.log('Calculated Admin Balance:', (totalQrCharges + totalBillCharges + totalPayoutCharges + totalDistributorShare + totalSuperDistributorShare) - totalWithdrawals);

  } catch(e) {
    console.error(e);
  }
}

run();
