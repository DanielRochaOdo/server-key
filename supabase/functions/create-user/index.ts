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



interface CreateUserRequest {

  email: string

  password: string

  name: string

  role: string

  is_active: boolean

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



Deno.serve(async (req) => {

  // Handle CORS preflight requests

  if (req.method === 'OPTIONS') {

    return new Response('ok', { headers: corsHeaders })

  }



  try {

    // Only allow POST requests

    if (req.method !== 'POST') {

      return new Response(

        JSON.stringify({ error: 'Method not allowed' }),

        { 

          status: 405, 

          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 

        }

      )

    }



    // Get environment variables

    const supabaseUrl = Deno.env.get('SUPABASE_URL')

    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')



    console.log('🔍 Environment check:', {

      hasUrl: !!supabaseUrl,

      hasServiceKey: !!supabaseServiceKey,

      url: supabaseUrl ? `${supabaseUrl.substring(0, 20)}...` : 'missing'

    })



    if (!supabaseUrl || !supabaseServiceKey) {

      console.error('❌ Missing environment variables')

      return new Response(

        JSON.stringify({ 

          error: 'Server configuration error: Missing required environment variables',

          details: {

            hasUrl: !!supabaseUrl,

            hasServiceKey: !!supabaseServiceKey

          }

        }),

        { 

          status: 500, 

          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 

        }

      )

    }



    // Get request body

    const { email, password, name, role, is_active }: CreateUserRequest = await req.json()

    const normalizedRole = normalizeRole(role)

    const normalizedEmail = (email || '').trim()

    const normalizedName = (name || '').trim()



    console.log('📝 Request received:', { email: normalizedEmail, name: normalizedName, role: normalizedRole || role, is_active })



    // Validate required fields

    if (!normalizedEmail || !normalizedName || !role) {

      console.log('❌ Missing required fields')

      return new Response(

        JSON.stringify({ error: 'Missing required fields: email, name, role' }),

        { 

          status: 400, 

          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 

        }

      )

    }



    // Validate role

    if (normalizedRole === 'owner') {

      return new Response(

        JSON.stringify({ error: 'Role owner deve ser definido apenas via banco.' }),

        { 

          status: 400, 

          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 

        }

      )

    }

    if (!['admin', 'financeiro', 'usuario'].includes(normalizedRole)) {

      console.log('❌ Invalid role:', role)

      return new Response(

        JSON.stringify({ error: 'Invalid role. Must be admin, financeiro, or usuario' }),

        { 

          status: 400, 

          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 

        }

      )

    }



    // Create Supabase admin client

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



    console.log('🔍 Checking for existing users with email:', normalizedEmail)

    // Check if user already exists in public.users

    const { data: existingPublicUser, error: publicCheckError } = await supabaseAdmin

      .from('users')

      .select('id, email, auth_uid')

      .eq('email', normalizedEmail)

      .maybeSingle()



    if (publicCheckError) {

      console.error('❌ Error checking existing public user:', publicCheckError)

      return new Response(

        JSON.stringify({ error: `Database error: ${publicCheckError.message}` }),

        { 

          status: 500, 

          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 

        }

      )

    }



    console.log('🔍 Checking for existing auth user with email:', normalizedEmail)

    const { data: existingAuthResponse, error: authLookupError } = await supabaseAdmin.auth.admin.getUserByEmail(normalizedEmail)



    if (authLookupError) {

      console.error('❌ Error checking existing auth user:', authLookupError)

      return new Response(

        JSON.stringify({ error: `Auth lookup error: ${authLookupError.message}` }),

        { 

          status: 500, 

          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 

        }

      )

    }



    const existingAuthUser = existingAuthResponse?.user ?? null



    if (existingPublicUser?.auth_uid) {

      console.log('❌ User already exists in public.users with auth_uid')

      return new Response(

        JSON.stringify({ error: 'User with this email already exists' }),

        { 

          status: 409, 

          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 

        }

      )

    }



    if (!password && !existingAuthUser) {

      return new Response(

        JSON.stringify({ error: 'Password is required for new users' }),

        { 

          status: 400, 

          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 

        }

      )

    }



    const modules = getModulesByRole(normalizedRole)



    const ensureAuthUser = async () => {

      if (existingAuthUser) {

        console.log('ℹ️ Auth user already exists, updating metadata')

        const updatePayload: Record<string, unknown> = {

          email_confirm: true,

          user_metadata: {

            name: normalizedName,

            role: normalizedRole

          }

        }



        if (password) {

          updatePayload.password = password

        }



        const { data: updatedAuth, error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(

          existingAuthUser.id,

          updatePayload

        )



        if (updateAuthError) {

          console.error('❌ Failed to update existing auth user:', updateAuthError)

          return { user: null, error: updateAuthError }

        }



        return { user: updatedAuth.user ?? existingAuthUser, error: null }

      }



      console.log('📝 Creating auth user with role:', normalizedRole, 'and modules:', modules)

      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({

        email: normalizedEmail,

        password: password || '',

        email_confirm: true, // Auto-confirm email

        user_metadata: {

          name: normalizedName,

          role: normalizedRole

        }

      })



      if (authError) {

        console.error('??O Auth error:', authError)

        return { user: null, error: authError }

      }



      if (!authUser.user) {

        console.error('❌ No auth user returned')

        return { user: null, error: new Error('Failed to create auth user: no user returned') }

      }



      console.log('✅ Auth user created successfully:', authUser.user.id)

      return { user: authUser.user, error: null }

    }



    console.log('✅ Proceeding with user creation/linking')



    const { user: authUser, error: authError } = await ensureAuthUser()



    if (authError || !authUser) {

      const message = authError instanceof Error ? authError.message : 'Failed to ensure auth user'

      const lowered = message.toLowerCase()

      return new Response(

        JSON.stringify({ error: message }),

        { 

          status: lowered.includes('already') || lowered.includes('exists') ? 409 : 500, 

          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 

        }

      )

    }



    let publicUserResult



    if (existingPublicUser) {

      console.log('🔗 Linking existing public user with auth_uid')

      const { data: updatedPublicUser, error: publicUpdateError } = await supabaseAdmin

        .from('users')

        .update({

          email: normalizedEmail,

          name: normalizedName,

          role: normalizedRole,

          modules,

          is_active: is_active ?? true,

          auth_uid: authUser.id,

          updated_at: new Date().toISOString()

        })

        .eq('id', existingPublicUser.id)

        .select()

        .single()



      if (publicUpdateError) {

        console.error('❌ Public user update failed:', publicUpdateError)

        if (publicUpdateError.code === '23505') {

          return new Response(

            JSON.stringify({ error: 'User with this email already exists' }),

            { 

              status: 409, 

              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 

            }

          )

        }

        return new Response(

          JSON.stringify({ error: `Failed to link user profile: ${publicUpdateError.message}` }),

          { 

            status: 500, 

            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 

          }

        )

      }



      publicUserResult = updatedPublicUser

    } else {

      console.log('🔗 Creating public user profile')

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

          updated_at: new Date().toISOString()

        })

        .select()

        .single()



      if (publicError) {

        console.error('❌ Public user creation failed:', publicError)

        

        if (!existingAuthUser) {

          try {

            await supabaseAdmin.auth.admin.deleteUser(authUser.id)

            console.log('🧹 Cleaned up auth user after public user creation failure')

          } catch (cleanupError) {

            console.error('❌ Failed to cleanup auth user:', cleanupError)

          }

        }

        

        if (publicError.code === '23505') {

          return new Response(

            JSON.stringify({ error: 'User with this email already exists' }),

            { 

              status: 409, 

              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 

            }

          )

        }

        

        return new Response(

          JSON.stringify({ error: `Failed to create user profile: ${publicError.message}` }),

          { 

            status: 500, 

            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 

          }

        )

      }



      publicUserResult = publicUser

    }



    console.log('✅ Public user saved successfully:', publicUserResult?.id)



    console.log('🎉 User creation completed successfully:', {

      authUserId: authUser.id,

      publicUserId: publicUserResult?.id,

      email: normalizedEmail,

      role: normalizedRole,

      modules

    })



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

          auth_uid: publicUserResult.auth_uid

        }

      }),

      { 

        status: 200, 

        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 

      }

    )



  } catch (error) {

    console.error('❌ Unexpected error:', error)

    

    // Provide more detailed error information

    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    const errorStack = error instanceof Error ? error.stack : undefined

    

    console.error('Error details:', { message: errorMessage, stack: errorStack })

    

    return new Response(

      JSON.stringify({ 

        error: 'Internal server error',

        details: errorMessage,

        timestamp: new Date().toISOString()

      }),

      { 

        status: 500, 

        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 

      }

    )

  }

})

