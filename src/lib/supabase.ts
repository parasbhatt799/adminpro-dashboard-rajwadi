import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://rvpjusitsoxjxvmgtkxl.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2cGp1c2l0c294anh2bWd0a3hsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MTIxNjQsImV4cCI6MjA5MTM4ODE2NH0._MOxzAQ8_2_OXleIvvN94Con_k7UHT_2JWnCg306XZI';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials missing. Please check your environment variables.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
