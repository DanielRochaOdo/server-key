import { createClient } from '@supabase/supabase-js';

export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,                 // URL do seu projeto Supabase
  process.env.SUPABASE_SERVICE_ROLE_KEY!     // Chave secreta service_role do Supabase
);
