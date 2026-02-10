import { createClient } from 'npm:@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const normalizeRole = (role: string) => {
  const value = (role || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (value === 'administrador') return 'admin';
  if (value === 'admin') return 'admin';
  if (value === 'owner') return 'owner';
  if (value === 'financeiro') return 'financeiro';
  if (value === 'usuario') return 'usuario';
  return '';
};

interface CreateUserRequest {
  email: string;
  password: string;
  name: string;
  role: string;
  is_active: boolean;
}

const getModulesByRole = (role: string): string[] => {
  switch (role) {
    case 'owner':
      return [
        'usuarios',
        'acessos',
        'pessoal',
        'teams',
        'win_users',
        'rateio_claro',
        'rateio_google',
        'contas_a_pagar',
        'rateio_mkm',
        'controle_empresas',
        'controle_uber',
        'visitas_clinicas',
        'pedidos_de_compra',
      ];
    case 'admin':
      return [
        'usuarios',
        'acessos',
        'pessoal',
        'teams',
        'win_users',
        'rateio_claro',
        'rateio_google',
        'contas_a_pagar',
        'rateio_mkm',
        'controle_empresas',
        'controle_uber',
        'visitas_clinicas',
      ];
    case 'financeiro':
      return ['rateio_claro', 'rateio_google', 'rateio_mkm', 'controle_empresas', 'visitas_clinicas'];
    case 'usuario':
      return ['acessos', 'pessoal', 'teams', 'win_users'];
    default:
      return [];
  }
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({
          error: 'Server configuration error: Missing required environment variables',
          details: {
            hasUrl: !!supabaseUrl,
            hasServiceKey: !!supabaseServiceKey,
          },
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { email, password, name, role, is_active }: CreateUserRequest = await req.json();
    const normalizedRole = normalizeRole(role);
    const normalizedEmail = (email || '').trim();
    const normalizedName = (name || '').trim();

    if (!normalizedEmail || !normalizedName || !role) {
      return new Response(JSON.stringify({ error: 'Missing required fields: email, name, role' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (normalizedRole === 'owner') {
      return new Response(JSON.stringify({ error: 'Role owner deve ser definido apenas via banco.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!['admin', 'financeiro', 'usuario'].includes(normalizedRole)) {
      return new Response(JSON.stringify({ error: 'Invalid role. Must be admin, financeiro, or usuario' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: existingPublicUser, error: publicCheckError } = await supabaseAdmin
      .from('users')
      .select('id, email, auth_uid')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (publicCheckError) {
      return new Response(JSON.stringify({ error: `Database error: ${publicCheckError.message}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: existingAuthResponse, error: authLookupError } =
      await supabaseAdmin.auth.admin.getUserByEmail(normalizedEmail);

    if (authLookupError) {
      return new Response(JSON.stringify({ error: `Auth lookup error: ${authLookupError.message}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const existingAuthUser = existingAuthResponse?.user ?? null;

    if (existingPublicUser?.auth_uid) {
      return new Response(JSON.stringify({ error: 'User with this email already exists' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!password && !existingAuthUser) {
      return new Response(JSON.stringify({ error: 'Password is required for new users' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const modules = getModulesByRole(normalizedRole);

    const ensureAuthUser = async () => {
      if (existingAuthUser) {
        const updatePayload: Record<string, unknown> = {
          email_confirm: true,
          user_metadata: {
            name: normalizedName,
            role: normalizedRole,
          },
        };

        if (password) {
          updatePayload.password = password;
        }

        const { data: updatedAuth, error: updateAuthError } =
          await supabaseAdmin.auth.admin.updateUserById(existingAuthUser.id, updatePayload);

        if (updateAuthError) {
          return { user: null, error: updateAuthError };
        }

        return { user: updatedAuth.user ?? existingAuthUser, error: null };
      }

      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: normalizedEmail,
        password: password || '',
        email_confirm: true,
        user_metadata: {
          name: normalizedName,
          role: normalizedRole,
        },
      });

      if (authError) {
        return { user: null, error: authError };
      }

      if (!authUser.user) {
        return { user: null, error: new Error('Failed to create auth user: no user returned') };
      }

      return { user: authUser.user, error: null };
    };

    const { user: authUser, error: authError } = await ensureAuthUser();

    if (authError || !authUser) {
      const message = authError instanceof Error ? authError.message : 'Failed to ensure auth user';
      const lowered = message.toLowerCase();
      return new Response(JSON.stringify({ error: message }), {
        status: lowered.includes('already') || lowered.includes('exists') ? 409 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let publicUserResult;

    if (existingPublicUser) {
      const { data: updatedPublicUser, error: publicUpdateError } = await supabaseAdmin
        .from('users')
        .update({
          email: normalizedEmail,
          name: normalizedName,
          role: normalizedRole,
          modules,
          is_active: is_active ?? true,
          auth_uid: authUser.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingPublicUser.id)
        .select()
        .single();

      if (publicUpdateError) {
        if (publicUpdateError.code === '23505') {
          return new Response(JSON.stringify({ error: 'User with this email already exists' }), {
            status: 409,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        return new Response(
          JSON.stringify({ error: `Failed to link user profile: ${publicUpdateError.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      publicUserResult = updatedPublicUser;
    } else {
      const { data: publicUser, error: publicError } = await supabaseAdmin
        .from('users')
        .insert({
          email: normalizedEmail,
          name: normalizedName,
          role: normalizedRole,
          modules,
          is_active: is_active ?? true,
          auth_uid: authUser.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (publicError) {
        if (!existingAuthUser) {
          try {
            await supabaseAdmin.auth.admin.deleteUser(authUser.id);
          } catch {
            // ignore cleanup errors
          }
        }

        if (publicError.code === '23505') {
          return new Response(JSON.stringify({ error: 'User with this email already exists' }), {
            status: 409,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        return new Response(
          JSON.stringify({ error: `Failed to create user profile: ${publicError.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      publicUserResult = publicUser;
    }

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: publicUserResult.id,
          email: publicUserResult.email,
          name: publicUserResult.name,
          role: publicUserResult.role,
          modules: publicUserResult.modules,
          is_active: publicUserResult.is_active,
          auth_uid: publicUserResult.auth_uid,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: errorMessage,
        timestamp: new Date().toISOString(),
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});