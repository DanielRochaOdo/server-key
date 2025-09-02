import { createClient } from 'npm:@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface CreateUserRequest {
  email: string
  password: string
  name: string
  role: 'admin' | 'financeiro' | 'usuario'
  is_active: boolean
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

    console.log('📝 Request received:', { email, name, role, is_active })

    // Validate required fields
    if (!email || !password || !name || !role) {
      console.log('❌ Missing required fields')
      return new Response(
        JSON.stringify({ error: 'Missing required fields: email, password, name, role' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Validate role
    if (!['admin', 'financeiro', 'usuario'].includes(role)) {
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

    console.log('🔍 Checking for existing users with email:', email)

    // Check if user already exists in auth.users
    const { data: existingAuthUser, error: authCheckError } = await supabaseAdmin.auth.admin.getUserByEmail(email)
    
    if (authCheckError) {
      console.error('❌ Error checking existing auth user:', authCheckError)
      return new Response(
        JSON.stringify({ error: `Database error: ${authCheckError.message}` }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    if (existingAuthUser.user) {
      console.log('❌ User already exists in auth.users')
      return new Response(
        JSON.stringify({ error: 'User with this email already exists' }),
        { 
          status: 409, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Check if user already exists in public.users
    const { data: existingPublicUser, error: publicCheckError } = await supabaseAdmin
      .from('users')
      .select('id, email')
      .eq('email', email)
      .single()

    if (publicCheckError && publicCheckError.code !== 'PGRST116') {
      console.error('❌ Error checking existing public user:', publicCheckError)
      return new Response(
        JSON.stringify({ error: `Database error: ${publicCheckError.message}` }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    if (existingPublicUser) {
      console.log('❌ User already exists in public.users')
      return new Response(
        JSON.stringify({ error: 'User with this email already exists' }),
        { 
          status: 409, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('✅ No existing user found, proceeding with creation')

    // Define modules based on role
    let modules: string[] = []
    switch (role) {
      case 'admin':
        modules = ['usuarios', 'acessos', 'teams', 'win_users', 'rateio_claro', 'rateio_google']
        break
      case 'financeiro':
        modules = ['rateio_claro', 'rateio_google']
        break
      case 'usuario':
        modules = ['acessos', 'teams', 'win_users']
        break
    }

    console.log('📝 Creating auth user with role:', role, 'and modules:', modules)

    // Create user in auth.users
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        name,
        role
      }
    })

    if (authError) {
      console.error('❌ Auth error:', authError)
      return new Response(
        JSON.stringify({ error: `Failed to create auth user: ${authError.message}` }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    if (!authUser.user) {
      console.error('❌ No auth user returned')
      return new Response(
        JSON.stringify({ error: 'Failed to create auth user: no user returned' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('✅ Auth user created successfully:', authUser.user.id)

    // Create user in public.users table
    const { data: publicUser, error: publicError } = await supabaseAdmin
      .from('users')
      .insert({
        email,
        name,
        role,
        modules,
        is_active: is_active ?? true,
        auth_uid: authUser.user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single()

    if (publicError) {
      console.error('❌ Public user creation failed:', publicError)
      
      // Clean up auth user if public user creation fails
      try {
        await supabaseAdmin.auth.admin.deleteUser(authUser.user.id)
        console.log('🧹 Cleaned up auth user after public user creation failure')
      } catch (cleanupError) {
        console.error('❌ Failed to cleanup auth user:', cleanupError)
      }
      
      // Check if it's a unique constraint violation
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

    console.log('✅ Public user created successfully:', publicUser.id)

    console.log('🎉 User creation completed successfully:', {
      authUserId: authUser.user.id,
      publicUserId: publicUser.id,
      email,
      role,
      modules
    })

    return new Response(
      JSON.stringify({ 
        success: true, 
        user: {
          id: publicUser.id,
          email: publicUser.email,
          name: publicUser.name,
          role: publicUser.role,
          modules: publicUser.modules,
          is_active: publicUser.is_active,
          auth_uid: publicUser.auth_uid
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