/*
  # Create access management table

  1. New Tables
    - `acessos`
      - `id` (uuid, primary key)
      - `descricao` (text, required) - System description
      - `para_que_serve` (text) - What it's used for / How it works
      - `ip_url` (text) - IP address or URL
      - `usuario_login` (text) - Username/Login
      - `senha` (text) - Password
      - `observacao` (text) - Observations
      - `suporte_contato` (text) - Support/Contact
      - `email` (text) - Email
      - `data_pagamento` (date) - Payment date
      - `user_id` (uuid, foreign key) - User who created the record
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `acessos` table
    - Add policy for authenticated users to manage their own data
*/

CREATE TABLE IF NOT EXISTS acessos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  descricao text NOT NULL,
  para_que_serve text,
  ip_url text,
  usuario_login text,
  senha text,
  observacao text,
  suporte_contato text,
  email text,
  data_pagamento date,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE acessos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own access data"
  ON acessos
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create an index for better performance
CREATE INDEX IF NOT EXISTS idx_acessos_user_id ON acessos(user_id);
CREATE INDEX IF NOT EXISTS idx_acessos_created_at ON acessos(created_at);