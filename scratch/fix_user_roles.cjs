const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://malrqshegrrovyrhflup.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  try {
    // 1. Fetch all users
    const { data: users, error } = await supabase
      .from('users_profiles')
      .select('id, name, role, distributor_id, super_distributor_id');
    
    if (error) throw error;

    console.log(`Analyzing ${users.length} user profiles...`);

    const updates = [];

    // Collect parent relationships
    const superDistributorsSet = new Set();
    const distributorsSet = new Set();

    for (const u of users) {
      if (u.super_distributor_id) {
        superDistributorsSet.add(u.super_distributor_id);
      }
      if (u.distributor_id) {
        distributorsSet.add(u.distributor_id);
      }
    }

    for (const u of users) {
      let expectedRole = 'user';

      if (superDistributorsSet.has(u.id)) {
        expectedRole = 'super_distributor';
      } else if (distributorsSet.has(u.id) || u.super_distributor_id) {
        expectedRole = 'distributor';
      }

      if (u.role !== expectedRole) {
        console.log(`Fixing role for ${u.name} (ID: ${u.id}): '${u.role}' -> '${expectedRole}'`);
        updates.push({
          id: u.id,
          name: u.name,
          oldRole: u.role,
          newRole: expectedRole
        });
      }
    }

    if (updates.length === 0) {
      console.log('No corrupted user roles found.');
      return;
    }

    console.log(`Applying updates for ${updates.length} users...`);
    for (const item of updates) {
      const { error: updateError } = await supabase
        .from('users_profiles')
        .update({ role: item.newRole })
        .eq('id', item.id);
      
      if (updateError) {
        console.error(`Failed to update ${item.name}:`, updateError.message);
      } else {
        console.log(`Successfully updated ${item.name} to '${item.newRole}'`);
      }
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

run();
