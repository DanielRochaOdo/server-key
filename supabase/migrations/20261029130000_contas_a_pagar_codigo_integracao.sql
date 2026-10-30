ALTER TABLE public.contas_a_pagar
  ADD COLUMN IF NOT EXISTS codigo_prefixo text,
  ADD COLUMN IF NOT EXISTS codigo_integracao text;

CREATE TABLE IF NOT EXISTS public.contas_a_pagar_codigo_contadores (
  prefixo text PRIMARY KEY,
  ultimo_numero integer NOT NULL CHECK (ultimo_numero > 0)
);
ALTER TABLE public.contas_a_pagar_codigo_contadores ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.contas_a_pagar_codigo_contadores FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.derive_conta_a_pagar_prefix(p_fornecedor text, p_prefixo text DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_override text;
  v_normalizado text;
  v_primeiro_token text;
  v_consoantes text;
  v_resultado text;
BEGIN
  v_override := upper(regexp_replace(coalesce(p_prefixo, ''), '[^A-Z0-9]', '', 'g'));
  IF v_override <> '' THEN
    IF length(v_override) > 3 THEN
      RAISE EXCEPTION 'Prefix must have at most three characters.';
    END IF;
    RETURN v_override;
  END IF;

  v_normalizado := translate(
    upper(coalesce(p_fornecedor, '')),
    U&'\00C1\00C0\00C2\00C3\00C4\00C9\00C8\00CA\00CB\00CD\00CC\00CE\00CF\00D3\00D2\00D4\00D5\00D6\00DA\00D9\00DB\00DC\00C7',
    'AAAAAEEEEIIIIOOOOOUUUUC'
  );
  v_primeiro_token := regexp_replace(split_part(btrim(v_normalizado), ' ', 1), '[^A-Z0-9]', '', 'g');

  -- Preserve alphanumeric commercial initials such as DB3.
  IF v_primeiro_token ~ '[0-9]' AND length(v_primeiro_token) BETWEEN 2 AND 3 THEN
    RETURN v_primeiro_token;
  END IF;

  v_consoantes := regexp_replace(v_normalizado, '[^A-Z]', '', 'g');
  v_consoantes := regexp_replace(v_consoantes, '[AEIOU]', '', 'g');
  v_resultado := left(v_consoantes, 3);

  IF length(v_resultado) < 3 THEN
    v_resultado := v_resultado || left(
      regexp_replace(regexp_replace(v_normalizado, '[^A-Z0-9]', '', 'g'), '[' || v_resultado || ']', '', 'g'),
      3 - length(v_resultado)
    );
  END IF;

  v_resultado := rpad(v_resultado, 3, 'X');
  RETURN left(v_resultado, 3);
END;
$$;

-- Atribui códigos permanentes aos registros existentes, numerados por prefixo.
WITH prefixes AS (
  SELECT
    id,
    public.derive_conta_a_pagar_prefix(fornecedor, codigo_prefixo) AS prefixo,
    row_number() OVER (
      PARTITION BY public.derive_conta_a_pagar_prefix(fornecedor, codigo_prefixo)
      ORDER BY created_at NULLS FIRST, id
    ) AS numero
  FROM public.contas_a_pagar
  WHERE codigo_integracao IS NULL
)
UPDATE public.contas_a_pagar AS conta
SET
  codigo_prefixo = prefixes.prefixo,
  codigo_integracao = prefixes.prefixo || '-' || lpad(prefixes.numero::text, 3, '0')
FROM prefixes
WHERE conta.id = prefixes.id;

ALTER TABLE public.contas_a_pagar
  ALTER COLUMN codigo_prefixo SET NOT NULL,
  ALTER COLUMN codigo_integracao SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contas_a_pagar_codigo_integracao_format_check'
  ) THEN
    ALTER TABLE public.contas_a_pagar
      ADD CONSTRAINT contas_a_pagar_codigo_integracao_format_check
      CHECK (codigo_integracao ~ '^[A-Z0-9]{1,3}-[0-9]{3,}$');
  END IF;
END $$;

INSERT INTO public.contas_a_pagar_codigo_contadores (prefixo, ultimo_numero)
SELECT codigo_prefixo, max(split_part(codigo_integracao, '-', 2)::integer)
FROM public.contas_a_pagar
WHERE codigo_prefixo IS NOT NULL AND codigo_integracao IS NOT NULL
GROUP BY codigo_prefixo
ON CONFLICT (prefixo) DO UPDATE
SET ultimo_numero = greatest(
  public.contas_a_pagar_codigo_contadores.ultimo_numero,
  EXCLUDED.ultimo_numero
);

CREATE UNIQUE INDEX IF NOT EXISTS contas_a_pagar_codigo_integracao_unique
  ON public.contas_a_pagar (codigo_integracao);

CREATE OR REPLACE FUNCTION public.assign_conta_a_pagar_codigo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefixo text;
  v_numero integer;
BEGIN
  v_prefixo := public.derive_conta_a_pagar_prefix(NEW.fornecedor, NEW.codigo_prefixo);

  INSERT INTO public.contas_a_pagar_codigo_contadores (prefixo, ultimo_numero)
  VALUES (v_prefixo, 1)
  ON CONFLICT (prefixo) DO UPDATE
    SET ultimo_numero = public.contas_a_pagar_codigo_contadores.ultimo_numero + 1
  RETURNING ultimo_numero INTO v_numero;

  NEW.codigo_prefixo := v_prefixo;
  NEW.codigo_integracao := v_prefixo || '-' || lpad(v_numero::text, 3, '0');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.keep_conta_a_pagar_codigo_immutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.codigo_integracao IS DISTINCT FROM OLD.codigo_integracao
     OR NEW.codigo_prefixo IS DISTINCT FROM OLD.codigo_prefixo THEN
      RAISE EXCEPTION 'The account integration code is permanent and cannot be changed.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS assign_conta_a_pagar_codigo ON public.contas_a_pagar;
CREATE TRIGGER assign_conta_a_pagar_codigo
  BEFORE INSERT ON public.contas_a_pagar
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_conta_a_pagar_codigo();

DROP TRIGGER IF EXISTS keep_conta_a_pagar_codigo_immutable ON public.contas_a_pagar;
CREATE TRIGGER keep_conta_a_pagar_codigo_immutable
  BEFORE UPDATE ON public.contas_a_pagar
  FOR EACH ROW
  EXECUTE FUNCTION public.keep_conta_a_pagar_codigo_immutable();

CREATE TABLE IF NOT EXISTS public.contas_a_pagar_documentos_n8n (
  drive_file_id text PRIMARY KEY,
  conta_id uuid NOT NULL REFERENCES public.contas_a_pagar(id) ON DELETE CASCADE,
  codigo_integracao text NOT NULL,
  empresa_emissora text,
  vencimento date NOT NULL,
  valor_documento numeric(12,2) NOT NULL,
  observacao text,
  processado_em timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.contas_a_pagar_documentos_n8n FROM anon, authenticated;

ALTER TABLE public.contas_a_pagar_documentos_n8n ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users with contas a pagar module can read n8n document records"
  ON public.contas_a_pagar_documentos_n8n;
CREATE POLICY "Users with contas a pagar module can read n8n document records"
  ON public.contas_a_pagar_documentos_n8n
  FOR SELECT
  TO authenticated
  USING (has_module_access('contas_a_pagar'));

CREATE OR REPLACE FUNCTION public.aplicar_fatura_conta_a_pagar_n8n(
  p_codigo_integracao text,
  p_drive_file_id text,
  p_empresa_emissora text,
  p_vencimento date,
  p_valor numeric,
  p_observacao text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conta public.contas_a_pagar%ROWTYPE;
  v_valor_brl numeric(12,2);
  v_codigo_processado text;
BEGIN
  SELECT * INTO v_conta
  FROM public.contas_a_pagar
  WHERE codigo_integracao = upper(trim(p_codigo_integracao))
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'ACCOUNT_NOT_FOUND');
  END IF;
  IF v_conta.user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'ACCOUNT_OWNER_MISSING');
  END IF;

  INSERT INTO public.contas_a_pagar_documentos_n8n (
    drive_file_id, conta_id, codigo_integracao, empresa_emissora,
    vencimento, valor_documento, observacao
  ) VALUES (
    p_drive_file_id, v_conta.id, v_conta.codigo_integracao, p_empresa_emissora,
    p_vencimento, p_valor, p_observacao
  ) ON CONFLICT (drive_file_id) DO NOTHING;

  IF NOT FOUND THEN
    SELECT codigo_integracao INTO v_codigo_processado
    FROM public.contas_a_pagar_documentos_n8n
    WHERE drive_file_id = p_drive_file_id;
    IF v_codigo_processado IS DISTINCT FROM v_conta.codigo_integracao THEN
      RETURN jsonb_build_object('success', false, 'code', 'DRIVE_FILE_ALREADY_LINKED_TO_OTHER_ACCOUNT');
    END IF;
    RETURN jsonb_build_object('success', true, 'duplicate', true, 'codigo_integracao', v_conta.codigo_integracao);
  END IF;

  IF coalesce(v_conta.moeda, 'BRL') = 'USD' THEN
    IF coalesce(v_conta.cotacao_usd_brl, 0) <= 0 THEN
      RAISE EXCEPTION 'The USD account has no registered exchange rate.';
    END IF;
    v_valor_brl := round(p_valor * v_conta.cotacao_usd_brl, 2);
  ELSE
    v_valor_brl := round(p_valor, 2);
  END IF;

  UPDATE public.contas_a_pagar
  SET
    valor = v_valor_brl,
    valor_moeda = round(p_valor, 2),
    vencimento = extract(day FROM p_vencimento)::integer,
    updated_at = now()
  WHERE id = v_conta.id;

  INSERT INTO public.contas_a_pagar_competencias (conta_id, competencia, user_id)
  VALUES (
    v_conta.id,
    date_trunc('month', p_vencimento)::date,
    v_conta.user_id
  )
  ON CONFLICT (conta_id) DO UPDATE
    SET competencia = EXCLUDED.competencia,
        user_id = EXCLUDED.user_id,
        updated_at = now();

  RETURN jsonb_build_object(
    'success', true,
    'duplicate', false,
    'codigo_integracao', v_conta.codigo_integracao,
    'conta_id', v_conta.id,
    'vencimento', p_vencimento,
    'valor', v_valor_brl
  );
END;
$$;

REVOKE ALL ON FUNCTION public.aplicar_fatura_conta_a_pagar_n8n(text, text, text, date, numeric, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.aplicar_fatura_conta_a_pagar_n8n(text, text, text, date, numeric, text)
  TO service_role;
