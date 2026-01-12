/*
  # Restrict contas_a_pagar to admin role only

  1. Changes
    - Update set_modules_by_role to include contas_a_pagar only for admin
    - Remove contas_a_pagar from existing financeiro users
*/

CREATE OR REPLACE FUNCTION set_modules_by_role()
RETURNS TRIGGER AS $$
BEGIN
  CASE NEW.role
    WHEN 'admin' THEN
      NEW.modules := ARRAY['usuarios', 'acessos', 'pessoal', 'teams', 'win_users', 'rateio_claro', 'rateio_google', 'contas_a_pagar'];
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

UPDATE users
SET modules = ARRAY['rateio_claro', 'rateio_google']
WHERE role = 'financeiro'
  AND ('contas_a_pagar' = ANY(modules));
