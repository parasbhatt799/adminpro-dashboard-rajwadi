import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://malrqshegrrovyrhflup.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1hbHJxc2hlZ3Jyb3Z5cmhmbHVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNjI4MzYsImV4cCI6MjA5MTgzODgzNn0.6oenVFgz-d8jXgoRzhDY3y6Cmz5N6JK7YdxXxDbQe8Y';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials missing. Please check your environment variables.');
}

const customFetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const urlStr = typeof input === 'string' ? input : (input as any).url || String(input);

  // Intercept queries on the bbps_submissions table and route them via our secure proxy
  if (urlStr.includes('/rest/v1/bbps_submissions')) {
    try {
      const urlObj = new URL(urlStr);
      const proxyUrl = `/api/bbps-proxy${urlObj.search}`;
      return fetch(proxyUrl, init);
    } catch (e) {
      console.error('Failed to parse Supabase URL in proxy interceptor:', e);
    }
  }

  return fetch(input, init);
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: window.sessionStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  },
  global: {
    fetch: customFetch
  }
});

export async function addDevicePushId(userId: string, userType: 'admin' | 'user', pushId: string) {
  if (!userId || !pushId) return;
  
  const table = userType === 'admin' ? 'admin_profiles' : 'users_profiles';
  const keyField = userType === 'admin' ? 'mobile_number' : 'id';
  
  try {
    const { data: profile } = await supabase
      .from(table)
      .select('onesignal_id')
      .eq(keyField, userId)
      .single();
      
    let currentIds: string[] = [];
    if (profile?.onesignal_id) {
      currentIds = profile.onesignal_id.split(',').map((id: string) => id.trim()).filter(Boolean);
    }
    
    if (currentIds.includes(pushId)) {
      return;
    }
    
    currentIds.push(pushId);
    if (currentIds.length > 5) {
      currentIds.shift();
    }
    
    const newString = currentIds.join(',');
    
    // Clean up this pushId from other profiles
    const { data: adminMatches } = await supabase
      .from('admin_profiles')
      .select('mobile_number, onesignal_id')
      .like('onesignal_id', `%${pushId}%`);
      
    if (adminMatches) {
      for (const match of adminMatches) {
        if (match.mobile_number !== userId || userType !== 'admin') {
          const cleaned = (match.onesignal_id || '')
            .split(',')
            .map((id: string) => id.trim())
            .filter(id => id && id !== pushId)
            .join(',');
          await supabase
            .from('admin_profiles')
            .update({ onesignal_id: cleaned || null })
            .eq('mobile_number', match.mobile_number);
        }
      }
    }

    const { data: userMatches } = await supabase
      .from('users_profiles')
      .select('id, onesignal_id')
      .like('onesignal_id', `%${pushId}%`);
      
    if (userMatches) {
      for (const match of userMatches) {
        if (match.id !== userId || userType !== 'user') {
          const cleaned = (match.onesignal_id || '')
            .split(',')
            .map((id: string) => id.trim())
            .filter(id => id && id !== pushId)
            .join(',');
          await supabase
            .from('users_profiles')
            .update({ onesignal_id: cleaned || null })
            .eq('id', match.id);
        }
      }
    }
    
    await supabase
      .from(table)
      .update({ onesignal_id: newString })
      .eq(keyField, userId);
  } catch (err) {
    console.error('Error adding device push ID:', err);
  }
}

export async function removeDevicePushId(userId: string, userType: 'admin' | 'user', pushId: string) {
  if (!userId || !pushId) return;
  
  const table = userType === 'admin' ? 'admin_profiles' : 'users_profiles';
  const keyField = userType === 'admin' ? 'mobile_number' : 'id';
  
  try {
    const { data: profile } = await supabase
      .from(table)
      .select('onesignal_id')
      .eq(keyField, userId)
      .single();
      
    if (profile?.onesignal_id) {
      const cleaned = profile.onesignal_id
        .split(',')
        .map((id: string) => id.trim())
        .filter(id => id && id !== pushId)
        .join(',');
      await supabase
        .from(table)
        .update({ onesignal_id: cleaned || null })
        .eq(keyField, userId);
    }
  } catch (err) {
    console.error('Error removing device push ID:', err);
  }
}
