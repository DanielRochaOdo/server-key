import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key';
const projectRef = (() => {
  try {
    return new URL(supabaseUrl).hostname.split('.')[0] || 'local';
  } catch {
    return 'local';
  }
})();
const storageKey = `sb-${projectRef}-auth-token`;

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
    storageKey,
    flowType: 'pkce'
  }
});

// Debug function to check auth state
export const debugAuthState = async () => {
  const { data: { session }, error } = await supabase.auth.getSession();
  return { session, error };
};
