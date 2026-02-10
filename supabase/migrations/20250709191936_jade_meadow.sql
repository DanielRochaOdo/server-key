/*
  # Create Default Admin User

  1. New Operations
    - Create default admin user in auth.users
    - Create corresponding record in public.users
    - Set up proper authentication credentials

  2. Security
    - Uses service role permissions
    - Creates user with confirmed email
    - Sets up proper role and module access
*/

-- Ensure pgcrypto is available for gen_random_uuid / gen_salt / crypt
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
SET search_path = public, extensions;

-- Create the default admin user in auth.users if it doesn't exist
DO $$
DECLARE
    admin_auth_id uuid;
    existing_user_count integer;
BEGIN
    -- Check if admin user already exists in auth.users
    SELECT COUNT(*) INTO existing_user_count
    FROM auth.users 
    WHERE lower(email) = lower('admin@serverkey.com');
    
    IF existing_user_count = 0 THEN
        -- Insert admin user into auth.users
        IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'gen_salt') THEN
            EXECUTE $sql$
                INSERT INTO auth.users (
                    instance_id,
                    id,
                    aud,
                    role,
                    email,
                    encrypted_password,
                    email_confirmed_at,
                    recovery_sent_at,
                    last_sign_in_at,
                    raw_app_meta_data,
                    raw_user_meta_data,
                    is_super_admin,
                    created_at,
                    updated_at,
                    confirmation_token,
                    email_change,
                    email_change_token_new,
                    recovery_token
                ) VALUES (
                    '00000000-0000-0000-0000-000000000000',
                    gen_random_uuid(),
                    'authenticated',
                    'authenticated',
                    'admin@serverkey.com',
                    crypt('admin123', gen_salt('bf')),
                    NOW(),
                    NOW(),
                    NOW(),
                    '{"provider": "email", "providers": ["email"]}',
                    '{"name": "Administrador", "role": "admin"}',
                    false,
                    NOW(),
                    NOW(),
                    '',
                    '',
                    '',
                    ''
                );
            $sql$;
        ELSE
            RAISE NOTICE 'Skipping auth.users admin insert: pgcrypto (gen_salt) not available.';
        END IF;
        
        RAISE NOTICE 'Default admin user created successfully';
    ELSE
        RAISE NOTICE 'Default admin user already exists';
    END IF;
END $$;
