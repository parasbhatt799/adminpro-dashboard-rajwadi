import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

// Create a local supabase client specifically for this util
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

/**
 * Finds the correct Bank Profile ID for a given IFSC code from the database.
 */
export async function getBankProfileId(ifsc: string): Promise<string | null> {
  if (!ifsc || !supabase) return null;
  const upperIfsc = ifsc.toUpperCase();
  
  try {
    const { data, error } = await supabase.rpc('get_camlenio_bank_profile_id', {
      p_ifsc: upperIfsc
    });

    if (error) {
      console.error('Error fetching bank profile id from db:', error);
      return null;
    }

    return data as string | null;
  } catch (err) {
    console.error('Exception fetching bank profile id:', err);
    return null;
  }
}
