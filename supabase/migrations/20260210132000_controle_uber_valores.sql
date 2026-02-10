/*
  # Controle Uber - Valores de Saida/Retorno

  1. Changes
    - Renomear coluna valor -> valor_saida
    - Adicionar coluna valor_retorno
*/

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'controle_uber'
      AND column_name = 'valor'
  ) THEN
    ALTER TABLE public.controle_uber
      RENAME COLUMN valor TO valor_saida;
  END IF;
END $$;

ALTER TABLE public.controle_uber
  ADD COLUMN IF NOT EXISTS valor_retorno numeric(12, 2) NOT NULL DEFAULT 0;
