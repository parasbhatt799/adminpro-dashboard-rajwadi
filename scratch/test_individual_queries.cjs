const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { subDays, startOfDay, endOfDay, startOfYesterday, endOfYesterday } = require('date-fns');

async function run() {
  const now = new Date();
  const startDate = startOfDay(now).toISOString();
  const endDate = endOfDay(now).toISOString();

  let prevStartDate = null;
  let prevEndDate = null;
  const diff = new Date(endDate).getTime() - new Date(startDate).getTime();
  prevStartDate = new Date(new Date(startDate).getTime() - diff - 1000).toISOString();
  prevEndDate = new Date(new Date(startDate).getTime() - 1000).toISOString();

  const sevenDaysAgo = subDays(new Date(), 7).toISOString();

  console.log('=== Running Individual Dashboard Queries ===\n');

  const runQuery = async (name, promise) => {
    const start = Date.now();
    try {
      const result = await promise;
      const duration = Date.now() - start;
      const rowCount = result.data ? (Array.isArray(result.data) ? result.data.length : '1 object') : (result.count !== undefined ? `${result.count} count` : 'no data');
      console.log(`✓ ${name}: Success - took ${duration}ms (returned ${rowCount})`);
      if (result.error) {
        console.log(`  └─ Error details: ${result.error.message}`);
      }
      return duration;
    } catch (err) {
      const duration = Date.now() - start;
      console.log(`✗ ${name}: Failed - took ${duration}ms (Error: ${err.message})`);
      return duration;
    }
  };

  let bbpsStatsQuery = supabase
    .from('bbps_submissions')
    .select('amount, charges')
    .in('status', ['approved', 'pending'])
    .gte('created_at', startDate)
    .lte('created_at', endDate);

  let currentUsersQuery = supabase
    .from('users_profiles')
    .select('*', { count: 'exact', head: true })
    .eq('role', 'user')
    .gte('created_at', startDate)
    .lte('created_at', endDate);

  const startAll = Date.now();
  await Promise.all([
    runQuery('1. get_dashboard_stats', supabase.rpc('get_dashboard_stats', { p_start_date: startDate, p_end_date: endDate })),
    runQuery('2. bbpsStatsQuery', bbpsStatsQuery),
    runQuery('3. pendingBbpsCount', supabase.from('bbps_submissions').select('*', { count: 'exact', head: true }).eq('status', 'pending')),
    runQuery('4. prevRpcStats', supabase.rpc('get_dashboard_stats', { p_start_date: prevStartDate, p_end_date: prevEndDate })),
    runQuery('5. prevBbpsData', supabase.from('bbps_submissions').select('amount, charges').in('status', ['approved', 'pending']).gte('created_at', prevStartDate).lte('created_at', prevEndDate)),
    runQuery('6. currentUsersCount', currentUsersQuery),
    runQuery('7. prevUsersCount', supabase.from('users_profiles').select('*', { count: 'exact', head: true }).eq('role', 'user').gte('created_at', prevStartDate).lte('created_at', prevEndDate)),
    runQuery('8. qrRecent', supabase.from('payment_submissions').select('amount, admin_share, distributor_share, super_distributor_share, created_at').eq('status', 'approved').gte('created_at', sevenDaysAgo)),
    runQuery('9. billRecent', supabase.from('bill_submissions').select('amount, admin_share, distributor_share, created_at').eq('status', 'approved').gte('created_at', sevenDaysAgo)),
    runQuery('10. bbpsRecent', supabase.from('bbps_submissions').select('amount, charges, created_at').in('status', ['approved', 'pending']).gte('created_at', sevenDaysAgo)),
    runQuery('11. payoutRecent', supabase.from('payout_submissions').select('charge_amount, created_at').eq('status', 'approved').gte('created_at', sevenDaysAgo)),
    runQuery('12. usersRecent', supabase.from('users_profiles').select('created_at').eq('role', 'user').gte('created_at', sevenDaysAgo))
  ]);

  console.log(`\n=== All queries completed in parallel in ${Date.now() - startAll}ms ===`);
}

run();
