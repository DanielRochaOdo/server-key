import { supabaseAdmin } from './supabaseAdminClient';

export async function createUser(email: string, password: string) {
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) throw error;
  return data;
}
