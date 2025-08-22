/*
  # Create pessoal table

  1. New Tables
    - `pessoal`
      - `id` (uuid, primary key)
      - `descricao` (text, required)
      - `para_que_serve` (text, optional)
      - `ip_url` (text, optional)
      - `usuario_login` (text, optional)
      - `senha` (text, optional - stores hashed passwords)
      - `observacao` (text, optional)
      - `suporte_contato` (text, optional)
      - `email` (text, optional)
      - `dia_pagamento` (integer, optional, 1-31)
      - `user_id` (uuid, foreign key to auth.users)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `pessoal` table
    - Add policies for authenticated users to manage only their own data
    - Users can only see, create, update, and delete their own pessoal records

  3. Indexes
    - Add indexes for performance on commonly queried columns
*/

-- Create the pessoal table
CREATE TABLE IF NOT EXISTS public.pessoal (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    descricao text NOT NULL,
    para_que_serve text,
    ip_url text,
    usuario_login text,
    senha text,
    observacao text,
    suporte_contato text,
    email text,
    dia_pagamento integer CHECK (dia_pagamento >= 1 AND dia_pagamento <= 31),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.pessoal ENABLE ROW LEVEL SECURITY;

-- Create RLS policies - users can only access their own data
CREATE POLICY "pessoal_module_manage_own"
  ON public.pessoal
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "pessoal_module_read"
  ON public.pessoal
  FOR SELECT
  TO authenticated
  USING (has_module_access('pessoal'));

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_pessoal_user_id ON public.pessoal(user_id);
CREATE INDEX IF NOT EXISTS idx_pessoal_created_at ON public.pessoal(created_at);
CREATE INDEX IF NOT EXISTS idx_pessoal_descricao ON public.pessoal(descricao);
CREATE INDEX IF NOT EXISTS idx_pessoal_dia_pagamento ON public.pessoal(dia_pagamento);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.triggers 
        WHERE trigger_name = 'update_pessoal_updated_at'
    ) THEN
        CREATE TRIGGER update_pessoal_updated_at
            BEFORE UPDATE ON public.pessoal
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;