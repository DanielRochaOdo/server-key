import { createClient } from 'npm:@supabase/supabase-js@2.39.3'



const corsHeaders = {

  'Access-Control-Allow-Origin': '*',

  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',

  'Access-Control-Allow-Methods': 'POST, OPTIONS',

}



const normalizeRole = (role: string) => {

  const value = (role || '')

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



const getModulesByRole = (role: string): string[] => {

  switch (role) {

    case 'owner':

      return ['usuarios', 'acessos', 'pessoal', 'teams', 'win_users', 'rateio_claro', 'rateio_google', 'contas_a_pagar', 'rateio_mkm', 'controle_empresas', 'controle_uber', 'visitas_clinicas', 'pedidos_de_compra']

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



const getBestName = (existingName?: string | null, fallbackName?: string | null, email?: string | null) => {

  if (existingName && existingName.trim()) return existingName.trim()

  if (fallbackName && fallbackName.trim()) return fallbackName.trim()

  if (email && email.includes('@')) return email.split('@')[0]

  return ''

}



const normalizeEmail = (email?: string | null) => (email || '').trim().toLowerCase()



Deno.serve(async (req) => {

  if (req.method === 'OPTIONS') {

    return new Response('ok', { headers: corsHeaders })

  }



  try {

    if (req.method !== 'POST') {

      return new Response(

        JSON.stringify({ error: 'Method not allowed' }),

        {

          status: 405,

          headers: { ...corsHeaders, 'Content-Type': 'application/json' }

        }

      )

    }



    const supabaseUrl = Deno.env.get('SUPABASE_URL')

    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')



    if (!supabaseUrl || !supabaseServiceKey) {

      return new Response(

        JSON.stringify({ error: 'Server configuration error: Missing required environment variables' }),

        {

          status: 500,

          headers: { ...corsHeaders, 'Content-Type': 'application/json' }

        }

      )

    }



    const supabaseAdmin = createClient(

      supabaseUrl,

      supabaseServiceKey,

      {

        auth: {

          autoRefreshToken: false,

          persistSession: false

        }

      }

    )



    let requestedEmail: string | null = null

    try {

      const body = await req.json()

      if (body?.email) {

        requestedEmail = normalizeEmail(body.email)

      }

    } catch {

      requestedEmail = null

    }



    const stats = {

      scanned: 0,

      linked: 0,

      created: 0,

      updated: 0,

      skipped: 0,

      errors: 0,

      messages: [] as string[]

    }



    const upsertPublicUser = async (authUser: { id: string; email?: string | null; user_metadata?: Record<string, unknown> }) => {

      stats.scanned += 1



      const authEmail = normalizeEmail(authUser.email)

      if (!authEmail) {

        stats.skipped += 1

        stats.messages.push(`Skipped auth user ${authUser.id}: missing email`)

        return

      }



      const metadata = authUser.user_metadata || {}

      const metadataRole = typeof metadata.role === 'string' ? metadata.role : ''

      const metadataName = typeof metadata.name === 'string' ? metadata.name : ''



      const { data: publicByAuth, error: publicByAuthError } = await supabaseAdmin

        .from('users')

        .select('id, email, name, role, modules, is_active, auth_uid')

        .eq('auth_uid', authUser.id)

        .maybeSingle()



      if (publicByAuthError) {

        stats.errors += 1

        stats.messages.push(`Error reading public user by auth_uid ${authUser.id}: ${publicByAuthError.message}`)

        return

      }



      const resolveRole = (roleValue?: string | null) => {

        return normalizeRole(roleValue || '') || normalizeRole(metadataRole) || 'usuario'

      }



      if (publicByAuth) {

        const desiredRole = resolveRole(publicByAuth.role)

        const desiredModules = publicByAuth.modules && publicByAuth.modules.length
          ? publicByAuth.modules
          : getModulesByRole(desiredRole)

        const desiredName = getBestName(publicByAuth.name, metadataName, authEmail)

        const desiredEmail = publicByAuth.email || authEmail

        const desiredIsActive = publicByAuth.is_active ?? true



        const needsUpdate =

          publicByAuth.email !== desiredEmail ||

          publicByAuth.name !== desiredName ||

          publicByAuth.role !== desiredRole ||

          JSON.stringify(publicByAuth.modules || []) !== JSON.stringify(desiredModules) ||

          publicByAuth.is_active !== desiredIsActive



        if (!needsUpdate) {

          stats.skipped += 1

          return

        }



        const { error: updateError } = await supabaseAdmin

          .from('users')

          .update({

            email: desiredEmail,

            name: desiredName,

            role: desiredRole,

            modules: desiredModules,

            is_active: desiredIsActive,

            updated_at: new Date().toISOString()

          })

          .eq('id', publicByAuth.id)



        if (updateError) {

          stats.errors += 1

          stats.messages.push(`Error updating public user ${publicByAuth.id}: ${updateError.message}`)

          return

        }



        stats.updated += 1

        return

      }



      const { data: publicByEmail, error: publicByEmailError } = await supabaseAdmin

        .from('users')

        .select('id, email, name, role, modules, is_active, auth_uid')

        .eq('email', authEmail)

        .maybeSingle()



      if (publicByEmailError) {

        stats.errors += 1

        stats.messages.push(`Error reading public user by email ${authEmail}: ${publicByEmailError.message}`)

        return

      }



      if (publicByEmail) {

        const desiredRole = resolveRole(publicByEmail.role)

        const desiredModules = publicByEmail.modules && publicByEmail.modules.length
          ? publicByEmail.modules
          : getModulesByRole(desiredRole)

        const desiredName = getBestName(publicByEmail.name, metadataName, authEmail)

        const desiredIsActive = publicByEmail.is_active ?? true



        const { error: updateError } = await supabaseAdmin

          .from('users')

          .update({

            email: authEmail,

            name: desiredName,

            role: desiredRole,

            modules: desiredModules,

            is_active: desiredIsActive,

            auth_uid: authUser.id,

            updated_at: new Date().toISOString()

          })

          .eq('id', publicByEmail.id)



        if (updateError) {

          stats.errors += 1

          stats.messages.push(`Error linking public user ${publicByEmail.id}: ${updateError.message}`)

          return

        }



        stats.linked += 1

        return

      }



      const desiredRole = resolveRole(metadataRole)

      const desiredModules = getModulesByRole(desiredRole)

      const desiredName = getBestName(null, metadataName, authEmail)



      const { error: insertError } = await supabaseAdmin

        .from('users')

        .insert({

          email: authEmail,

          name: desiredName,

          role: desiredRole,

          modules: desiredModules,

          is_active: true,

          auth_uid: authUser.id,

          created_at: new Date().toISOString(),

          updated_at: new Date().toISOString()

        })



      if (insertError) {

        stats.errors += 1

        stats.messages.push(`Error creating public user for auth ${authUser.id}: ${insertError.message}`)

        return

      }



      stats.created += 1

    }



    if (requestedEmail) {

      const { data: authResponse, error: authLookupError } = await supabaseAdmin.auth.admin.getUserByEmail(requestedEmail)

      if (authLookupError) {

        return new Response(

          JSON.stringify({ error: `Auth lookup error: ${authLookupError.message}` }),

          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }

        )

      }



      if (!authResponse?.user) {

        return new Response(

          JSON.stringify({ error: 'Auth user not found', email: requestedEmail }),

          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }

        )

      }



      await upsertPublicUser(authResponse.user)

    } else {

      let page = 1

      const perPage = 1000



      while (true) {

        const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers({

          page,

          perPage

        })



        if (listError) {

          return new Response(

            JSON.stringify({ error: `Auth list error: ${listError.message}` }),

            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }

          )

        }



        const users = listData?.users || []

        for (const authUser of users) {

          await upsertPublicUser(authUser)

        }



        if (users.length < perPage) {

          break

        }



        page += 1

      }

    }



    return new Response(

      JSON.stringify({

        success: true,

        stats

      }),

      {

        status: 200,

        headers: { ...corsHeaders, 'Content-Type': 'application/json' }

      }

    )

  } catch (error) {

    const message = error instanceof Error ? error.message : 'Unknown error'

    return new Response(

      JSON.stringify({ error: 'Internal server error', details: message }),

      {

        status: 500,

        headers: { ...corsHeaders, 'Content-Type': 'application/json' }

      }

    )

  }

})

