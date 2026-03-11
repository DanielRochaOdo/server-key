/*
  # Remocao da desagregacao de produtos em custos das clinicas

  Remove tabela, politicas e trigger relacionados a `custos_clinicas_split`.
*/

DROP TRIGGER IF EXISTS update_custos_clinicas_split_updated_at ON public.custos_clinicas_split;
DROP POLICY IF EXISTS "custos_clinicas_split_read" ON public.custos_clinicas_split;
DROP POLICY IF EXISTS "custos_clinicas_split_write" ON public.custos_clinicas_split;
DROP TABLE IF EXISTS public.custos_clinicas_split;
