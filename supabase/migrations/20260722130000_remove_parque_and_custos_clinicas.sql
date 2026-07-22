/*
  Remove the retired Parque Tecnologico (Estoque/Inventario) and Custos das
  Clinicas modules. Historical migrations remain untouched so databases can
  still be rebuilt in order; this migration removes their runtime objects.

  Warning: applying this migration permanently deletes the modules' data.
*/

UPDATE public.users
SET
  modules = array_remove(array_remove(COALESCE(modules, ARRAY[]::text[]), 'parque_tecnologico'), 'custos_clinicas'),
  edit_modules = array_remove(array_remove(COALESCE(edit_modules, ARRAY[]::text[]), 'parque_tecnologico'), 'custos_clinicas'),
  updated_at = NOW()
WHERE COALESCE(modules, ARRAY[]::text[]) && ARRAY['parque_tecnologico', 'custos_clinicas']::text[]
   OR COALESCE(edit_modules, ARRAY[]::text[]) && ARRAY['parque_tecnologico', 'custos_clinicas']::text[];

CREATE OR REPLACE FUNCTION public.strip_retired_modules()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.modules := array_remove(
    array_remove(COALESCE(NEW.modules, ARRAY[]::text[]), 'parque_tecnologico'),
    'custos_clinicas'
  );
  NEW.edit_modules := array_remove(
    array_remove(COALESCE(NEW.edit_modules, ARRAY[]::text[]), 'parque_tecnologico'),
    'custos_clinicas'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS zzz_strip_retired_modules ON public.users;
CREATE TRIGGER zzz_strip_retired_modules
BEFORE INSERT OR UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.strip_retired_modules();

DROP TABLE IF EXISTS public.parque_pedidos_aprovacao_origem CASCADE;
DROP TABLE IF EXISTS public.parque_pedidos_aprovacao CASCADE;
DROP TABLE IF EXISTS public.parque_descartes CASCADE;
DROP TABLE IF EXISTS public.parque_movimentacoes CASCADE;
DROP TABLE IF EXISTS public.parque_produtos CASCADE;
DROP TABLE IF EXISTS public.parque_cadastros_link CASCADE;
DROP TABLE IF EXISTS public.parque_parametros_link CASCADE;
DROP TABLE IF EXISTS public.parque_destino_setor_link CASCADE;
DROP TABLE IF EXISTS public.parque_item_parametros_link CASCADE;
DROP TABLE IF EXISTS public.parque_parametros_base CASCADE;
DROP TABLE IF EXISTS public.parque_marcas_base CASCADE;
DROP TABLE IF EXISTS public.parque_unidades_base CASCADE;
DROP TABLE IF EXISTS public.parque_itens_base CASCADE;

DROP TABLE IF EXISTS public.custos_clinicas_carryover CASCADE;
DROP TABLE IF EXISTS public.custos_clinicas_unify CASCADE;
DROP TABLE IF EXISTS public.custos_clinicas_movements CASCADE;

DO $$
DECLARE
  routine record;
BEGIN
  FOR routine IN
    SELECT
      namespace.nspname AS schema_name,
      procedure.proname AS function_name,
      pg_get_function_identity_arguments(procedure.oid) AS identity_arguments
    FROM pg_proc procedure
    JOIN pg_namespace namespace ON namespace.oid = procedure.pronamespace
    WHERE namespace.nspname = 'public'
      AND procedure.proname LIKE 'parque\_%' ESCAPE '\'
  LOOP
    EXECUTE format(
      'DROP FUNCTION %I.%I(%s) CASCADE',
      routine.schema_name,
      routine.function_name,
      routine.identity_arguments
    );
  END LOOP;
END;
$$;
