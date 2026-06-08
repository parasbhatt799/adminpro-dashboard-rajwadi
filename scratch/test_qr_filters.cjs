const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  try {
    const searchQuery = 'RM'; // An example search term
    console.log('Testing query with user ID resolution for search term:', searchQuery);

    // 1. Fetch matching users
    const { data: users, error: userError } = await supabase
      .from('users_profiles')
      .select('id')
      .or(`name.ilike.%${searchQuery}%,firm_name.ilike.%${searchQuery}%`);

    if (userError) throw userError;

    const userIds = (users || []).map(u => u.id);
    console.log('Found matching user IDs:', userIds);

    // 2. Build payment submissions query
    let query = supabase
      .from('payment_submissions')
      .select('*, users_profiles!payment_submissions_user_id_fkey!inner(name, firm_name, profile_photo_url, distributor_id, charge_percentage, admin_base_qr_charge), qr_history(qr_name, whatsapp_number)', { count: 'exact' });

    // Build the OR logic tree dynamically
    if (userIds.length > 0) {
      query = query.or(`utr_id.ilike.%${searchQuery}%,user_id.in.(${userIds.map(id => `"${id}"`).join(',')})`);
    } else {
      query = query.or(`utr_id.ilike.%${searchQuery}%`);
    }

    const { data, error, count } = await query.limit(5);

    if (error) {
      console.error('QUERY ERROR:', error);
    } else {
      console.log('QUERY SUCCESS! Rows found:', data.length, 'Total count:', count);
      if (data.length > 0) {
        console.log('Sample Row UTR:', data[0].utr_id, 'Firm Name:', data[0].users_profiles?.firm_name);
      }
    }
  } catch (err) {
    console.error('CATCH ERROR:', err);
  }
}

run();
