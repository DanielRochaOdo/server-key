/*
  # Update user modules to include pessoal

  1. Changes
    - Add 'pessoal' module to usuario role
    - Update existing users with usuario role to include pessoal module
    - Update set_modules_by_role function to include pessoal for usuario role

  2. Security
    - Maintain existing role-based access control
    - Pessoal module only available to usuario role (and admin)
*/

-- Update the set_modules_by_role function to include pessoal
CREATE OR REPLACE FUNCTION set_modules_by_role()
RETURNS TRIGGER AS $$
BEGIN
  CASE NEW.role
    WHEN 'admin' THEN
      NEW.modules := ARRAY['usuarios', 'acessos', 'pessoal', 'teams', 'win_users', 'rateio_claro', 'rateio_google'];
    WHEN 'financeiro' THEN
      NEW.modules := ARRAY['rateio_claro', 'rateio_google'];
    WHEN 'usuario' THEN
      NEW.modules := ARRAY['acessos', 'pessoal', 'teams', 'win_users'];
    ELSE
      NEW.modules := ARRAY[]::text[];
  END CASE;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update existing users with usuario role to include pessoal module
UPDATE users 
SET modules = ARRAY['acessos', 'pessoal', 'teams', 'win_users']
WHERE role = 'usuario' 
AND NOT ('pessoal' = ANY(modules));

-- Update existing users with admin role to include pessoal module
UPDATE users 
SET modules = ARRAY['usuarios', 'acessos', 'pessoal', 'teams', 'win_users', 'rateio_claro', 'rateio_google']
WHERE role = 'admin' 
AND NOT ('pessoal' = ANY(modules));