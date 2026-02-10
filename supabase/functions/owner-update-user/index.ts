import { createClient } from 'npm:@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const normalizeRole = (role: string) => {
  const value = (role || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  if (value === 'administrador') return 'admin'
  if (value === 'admin') return 'admin'
  if (value === 'owner') return 'owner'
  if (value === 'financeiro') return 'financeiro'
  if (value === 'usuario') return 'usuario'
  return ''
}

const ALLOWED_MODULES = [
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
]

const getModulesByRole = (role: string) => {
  switch (normalizeRole(role)) {
    case 'owner':
      return ALLOWED_MODULES
    case 'admin':
      return ['usuarios', 'acessos', 'pessoal', 'teams', 'win_users', 'rateio_claro', 'rateio_google', 'contas_a_pagar', 'rateio_mkm', 'controle_empresas', 'controle_uber', 'visitas_clinicas']
    case 'financeiro':
      return ['rateio_claro', 'rateio_google', 'rateio_mkm', 'controle_empresas', 'visitas_clinicas']
    case 'usuario':
      return ['acessos', 'pessoal', 'teams', 'win_users']
    default:
      return []
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error: Missing required environment variables' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const authHeader = req.headers.get('Authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''

    if (!token) {
      return new Response(JSON.stringify({ error: 'Missing authorization token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !authData?.user) {
      return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: ownerProfile, error: ownerError } = await supabaseAdmin
      .from('users')
      .select('id, role, is_active')
      .eq('auth_uid', authData.user.id)
      .maybeSingle()

    if (ownerError) {
      return new Response(JSON.stringify({ error: ownerError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!ownerProfile || ownerProfile.role !== 'owner' || ownerProfile.is_active !== true) {
      return new Response(JSON.stringify({ error: 'Acesso negado. Somente owner.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json()
    const targetUserId = String(body?.user_id || '').trim()

    if (!targetUserId) {
      return new Response(JSON.stringify({ error: 'user_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: targetUser, error: targetError } = await supabaseAdmin
      .from('users')
      .select('id, auth_uid, email, name, role, modules, is_active')
      .eq('id', targetUserId)
      .maybeSingle()

    if (targetError) {
      return new Response(JSON.stringify({ error: targetError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!targetUser) {
      return new Response(JSON.stringify({ error: 'Usuario nao encontrado' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const nextEmail = typeof body?.email === 'string' ? body.email.trim() : undefined
    const nextName = typeof body?.name === 'string' ? body.name.trim() : undefined
    const nextRole = typeof body?.role === 'string' ? normalizeRole(body.role) : undefined
    const nextIsActive = typeof body?.is_active === 'boolean' ? body.is_active : undefined
    const nextPassword = typeof body?.password === 'string' ? body.password : undefined
    const nextModulesRaw = Array.isArray(body?.modules) ? body.modules : undefined

    const targetRole = normalizeRole(targetUser.role)

    if (nextRole && nextRole === 'owner' && targetRole !== 'owner') {
      return new Response(JSON.stringify({ error: 'Role owner deve ser definido apenas via banco.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (nextRole && targetRole === 'owner' && nextRole !== 'owner') {
      return new Response(JSON.stringify({ error: 'Role owner deve ser definido apenas via banco.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (nextRole && !['admin', 'owner', 'financeiro', 'usuario'].includes(nextRole)) {
      return new Response(JSON.stringify({ error: 'Role invalida' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (nextPassword && nextPassword.length < 6) {
      return new Response(JSON.stringify({ error: 'Senha deve ter pelo menos 6 caracteres' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const nextModules = nextModulesRaw
      ? Array.from(new Set(nextModulesRaw.filter((item: unknown) => typeof item === 'string')))
          .filter((module: string) => ALLOWED_MODULES.includes(module))
      : undefined

    const authUpdatePayload: Record<string, unknown> = {}
    const metadataRole = nextRole || targetUser.role
    const metadataName = nextName || targetUser.name

    if (nextEmail && nextEmail !== targetUser.email) {
      authUpdatePayload.email = nextEmail
      authUpdatePayload.email_confirm = true
    }

    if (nextPassword) {
      authUpdatePayload.password = nextPassword
    }

    if (metadataRole || metadataName) {
      authUpdatePayload.user_metadata = {
        role: metadataRole,
        name: metadataName,
      }
    }

    if (Object.keys(authUpdatePayload).length > 0) {
      if (!targetUser.auth_uid) {
        return new Response(JSON.stringify({ error: 'Usuario nao possui auth_uid' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(
        targetUser.auth_uid,
        authUpdatePayload
      )

      if (authUpdateError) {
        return new Response(JSON.stringify({ error: authUpdateError.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (nextEmail) updatePayload.email = nextEmail
    if (nextName) updatePayload.name = nextName
    if (nextRole) updatePayload.role = nextRole
    if (nextIsActive !== undefined) updatePayload.is_active = nextIsActive
    if (nextModules) updatePayload.modules = nextModules

    if (!nextModules && nextRole) {
      updatePayload.modules = getModulesByRole(nextRole)
    }

    const { data: updatedUser, error: updateError } = await supabaseAdmin
      .from('users')
      .update(updatePayload)
      .eq('id', targetUserId)
      .select('id, email, name, role, modules, is_active, auth_uid')
      .single()

    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(
      JSON.stringify({ success: true, user: updatedUser }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
