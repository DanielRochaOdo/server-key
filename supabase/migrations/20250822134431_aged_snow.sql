/*
  # Update user role modules

  1. Changes
    - Admin: Add 'pessoal' module to existing modules
    - Usuario: Change from ['acessos', 'teams', 'win_users'] to ['pessoal'] only
    - Financeiro: Keep existing modules ['rateio_claro', 'rateio_google']

  2. Security
    - Update existing users with new module assignments
    - Maintain role-based access control
*/

-- Update admin users to include pessoal module
UPDATE users 
SET modules = array_append(modules, 'pessoal'),
    updated_at = now()
WHERE role = 'admin' 
  AND NOT ('pessoal' = ANY(modules));

-- Update usuario role to have only pessoal module
UPDATE users 
SET modules = ARRAY['pessoal'],
    updated_at = now()
WHERE role = 'usuario';

-- Financeiro role keeps existing modules (no change needed)
-- They should only have ['rateio_claro', 'rateio_google']