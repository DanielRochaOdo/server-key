import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

serve(async (req) => {
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

    // Get request body
    const { email, password, name, role, is_active }: CreateUserRequest = await req.json()

    // Validate required fields
    if (!email || !password || !name || !role) {
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
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Create user in auth.users
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name,
        role
      }
    })

    if (authError) {
      console.error('Auth error:', authError)
      return new Response(
        JSON.stringify({ error: `Failed to create auth user: ${authError.message}` }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    if (!authUser.user) {
      return new Response(
        JSON.stringify({ error: 'Failed to create auth user: no user returned' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

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
        pass: password // Store temporary password
      })
      .select()
      .single()

    if (publicError) {
      console.error('Public user error:', publicError)
      
      // If public user creation fails, clean up auth user
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id)
      
      return new Response(
        JSON.stringify({ error: `Failed to create user profile: ${publicError.message}` }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('User created successfully:', { 
      authUserId: authUser.user.id, 
      publicUserId: publicUser.id,
      email,
      role 
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
          is_active: publicUser.is_active
        }
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})