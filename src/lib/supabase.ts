import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key';

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
    storageKey: 'supabase.auth.token',
    flowType: 'pkce'
  }
});

// Debug function to check auth state
export const debugAuthState = async () => {
  const { data: { session }, error } = await supabase.auth.getSession();
  console.log('🔍 Debug Auth State:', {
    session: session ? {
      user: session.user?.email,
      access_token: session.access_token ? 'present' : 'missing',
      refresh_token: session.refresh_token ? 'present' : 'missing',
      expires_at: session.expires_at,
      expires_in: session.expires_in
    } : null,
    error,
    localStorage: {
      authToken: localStorage.getItem('supabase.auth.token') ? 'present' : 'missing',
      keys: Object.keys(localStorage).filter(key => key.includes('supabase'))
    }
  });
  return { session, error };
};