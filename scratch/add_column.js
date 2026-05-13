const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY; // Or service role if needed

const supabase = createClient(supabaseUrl, supabaseKey);

async function addColumn() {
  const { data, error } = await supabase.rpc('execute_sql', {
    sql: 'ALTER TABLE qr_settings ADD COLUMN IF NOT EXISTS is_animation_enabled BOOLEAN DEFAULT true;'
  });

  if (error) {
    console.error('Error adding column:', error);
  } else {
    console.log('Column added successfully!');
  }
}

// Alternatively, since I might not have 'execute_sql' RPC, 
// I'll try to just update a record if it doesn't exist, but that won't add a column.
// Most Supabase projects have a way to run SQL in the dashboard.
// I will assume the column needs to be added.

addColumn();
