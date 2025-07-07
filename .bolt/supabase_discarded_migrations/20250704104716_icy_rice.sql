/*
  # Create users management table

  1. New Tables
    - `users`
      - `id` (uuid, primary key, references auth.users)
      - `email` (text, unique, required)
      - `name` (text, required)
      - `role` (text, default 'user')
      - `permissions` (jsonb) - Store module permissions
      - `is_active` (boolean, default true)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `users` table
    - Add policies for admin access

  3. Performance
    - Add indexes for better query performance
*/

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  name text NOT NULL,
  role text DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  permissions jsonb DEFAULT '{
    "acessos": {"view": false, "edit": false},
    "teams": {"view": false, "edit": false},
    "win_users": {"view": false, "edit": false},
    "rateio_claro": {"view": false, "edit": false},
    "rateio_google": {"view": false, "edit": false}
  }'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Policy for admins to manage all users
CREATE POLICY "Admins can manage all users"
  ON users
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

-- Policy for users to read their own data
CREATE POLICY "Users can read own data"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);

-- Create trigger to automatically update updated_at timestamp
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert default admin user (you'll need to update this with actual admin user ID)
-- This is just a placeholder - you should update it with the actual admin user data
INSERT INTO users (id, email, name, role, permissions, is_active)
SELECT 
  auth.uid(),
  'admin@serverkey.com',
  'Administrador',
  'admin',
  '{
    "acessos": {"view": true, "edit": true},
    "teams": {"view": true, "edit": true},
    "win_users": {"view": true, "edit": true},
    "rateio_claro": {"view": true, "edit": true},
    "rateio_google": {"view": true, "edit": true}
  }'::jsonb,
  true
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@serverkey.com');