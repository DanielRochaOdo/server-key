/*
  # Create users table for user management

  1. New Tables
    - `users`
      - `id` (uuid, primary key)
      - `email` (text, unique, required)
      - `name` (text, required)
      - `role` (text, required, default 'user', check constraint for 'admin'|'user')
      - `permissions` (jsonb, required, default permissions structure)
      - `is_active` (boolean, required, default true)
      - `created_at` (timestamptz, default now())
      - `updated_at` (timestamptz, default now())

  2. Security
    - Enable RLS on `users` table
    - Add policy for authenticated users to read all user data
    - Add policy for users to manage their own data
    - Add policy for admins to manage all user data

  3. Indexes
    - Index on email for faster lookups
    - Index on role for filtering
    - Index on is_active for status filtering
    - Index on created_at for sorting

  4. Triggers
    - Auto-update updated_at timestamp on row updates
*/

-- Create the users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  name text NOT NULL,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  permissions jsonb NOT NULL DEFAULT '{
    "acessos": {"view": false, "edit": false},
    "teams": {"view": false, "edit": false},
    "win_users": {"view": false, "edit": false},
    "rateio_claro": {"view": false, "edit": false},
    "rateio_google": {"view": false, "edit": false}
  }'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users (is_active);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users (created_at);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Authenticated users can read all users"
  ON users
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update their own data"
  ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = id::text)
  WITH CHECK (auth.uid()::text = id::text);

CREATE POLICY "Admins can manage all users"
  ON users
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id::text = auth.uid()::text 
      AND role = 'admin' 
      AND is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id::text = auth.uid()::text 
      AND role = 'admin' 
      AND is_active = true
    )
  );

CREATE POLICY "Admins can insert new users"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id::text = auth.uid()::text 
      AND role = 'admin' 
      AND is_active = true
    )
  );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert a default admin user (you should change the email and name)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'permissions'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM users WHERE lower(email) = lower('admin@example.com')) THEN
      INSERT INTO users (email, name, role, is_active, permissions) VALUES (
        'admin@example.com',
        'Administrador',
        'admin',
        true,
        '{
          "acessos": {"view": true, "edit": true},
          "teams": {"view": true, "edit": true},
          "win_users": {"view": true, "edit": true},
          "rateio_claro": {"view": true, "edit": true},
          "rateio_google": {"view": true, "edit": true}
        }'::jsonb
      );
    END IF;
  ELSE
    IF NOT EXISTS (SELECT 1 FROM users WHERE lower(email) = lower('admin@example.com')) THEN
      INSERT INTO users (email, name, role, is_active) VALUES (
        'admin@example.com',
        'Administrador',
        'admin',
        true
      );
    END IF;
  END IF;
END $$;
