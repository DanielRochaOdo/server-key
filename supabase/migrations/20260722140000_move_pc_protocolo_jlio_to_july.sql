/*
  Move o protocolo "pedido de compra jlio_12-06-2026" e todos os registros
  mensais vinculados para a competencia 07/2026.

  A migracao aborta sem alterar dados caso o protocolo nao seja encontrado ou
  caso mais de um registro corresponda ao nome informado.
*/

DO $$
DECLARE
  target_name text := 'PEDIDO DE COMPRA JLIO_12-06-2026';
  target_year integer := 2026;
  target_month integer := 7;
  protocol_id uuid;
  protocol_count integer;
  linked_monthly_count integer;
  moved_monthly_count integer;
  sync_trigger record;
  sync_trigger_count integer := 0;
BEGIN
  SELECT count(*)
    INTO protocol_count
  FROM public.pc_protocolos
  WHERE lower(btrim(nome)) = lower(target_name);

  IF protocol_count = 0 THEN
    RAISE EXCEPTION 'Protocolo "%" nao encontrado; nenhuma alteracao foi realizada.', target_name;
  END IF;

  IF protocol_count > 1 THEN
    RAISE EXCEPTION 'Foram encontrados % protocolos com o nome "%"; nenhuma alteracao foi realizada.',
      protocol_count,
      target_name;
  END IF;

  SELECT id
    INTO protocol_id
  FROM public.pc_protocolos
  WHERE lower(btrim(nome)) = lower(target_name);

  SELECT count(*)
    INTO linked_monthly_count
  FROM public.pc_mensal_itens mensal
  WHERE mensal.protocolo_id = protocol_id
     OR mensal.protocolo_item_id IN (
       SELECT item.id
       FROM public.pc_protocolo_itens item
       WHERE item.protocolo_id = protocol_id
     );

  /*
    No SQL Editor nao existe auth.uid(). Desativa temporariamente apenas os
    gatilhos que ressincronizam o mensal e tentariam recriar linhas com
    criado_por nulo. Se qualquer etapa falhar, o rollback reativa os gatilhos.
  */
  FOR sync_trigger IN
    SELECT trg.tgname
    FROM pg_trigger trg
    JOIN pg_proc proc ON proc.oid = trg.tgfoid
    WHERE trg.tgrelid = 'public.pc_protocolos'::regclass
      AND NOT trg.tgisinternal
      AND proc.proname IN (
        'pc_protocolos_sync_mensal_trigger',
        'pc_copy_to_mensal_on_save'
      )
  LOOP
    EXECUTE format(
      'ALTER TABLE public.pc_protocolos DISABLE TRIGGER %I',
      sync_trigger.tgname
    );
    sync_trigger_count := sync_trigger_count + 1;
  END LOOP;

  IF sync_trigger_count = 0 THEN
    RAISE EXCEPTION 'Gatilho de sincronizacao do protocolo nao encontrado; nenhuma alteracao foi realizada.';
  END IF;

  UPDATE public.pc_protocolos
  SET
    ano = target_year,
    mes = target_month,
    updated_at = now()
  WHERE id = protocol_id;

  UPDATE public.pc_mensal_itens mensal
  SET
    ano = target_year,
    mes = target_month,
    updated_at = now()
  WHERE mensal.protocolo_id = protocol_id
     OR mensal.protocolo_item_id IN (
       SELECT item.id
       FROM public.pc_protocolo_itens item
       WHERE item.protocolo_id = protocol_id
     );

  GET DIAGNOSTICS moved_monthly_count = ROW_COUNT;

  FOR sync_trigger IN
    SELECT trg.tgname
    FROM pg_trigger trg
    JOIN pg_proc proc ON proc.oid = trg.tgfoid
    WHERE trg.tgrelid = 'public.pc_protocolos'::regclass
      AND NOT trg.tgisinternal
      AND proc.proname IN (
        'pc_protocolos_sync_mensal_trigger',
        'pc_copy_to_mensal_on_save'
      )
  LOOP
    EXECUTE format(
      'ALTER TABLE public.pc_protocolos ENABLE TRIGGER %I',
      sync_trigger.tgname
    );
  END LOOP;

  IF moved_monthly_count <> linked_monthly_count THEN
    RAISE EXCEPTION
      'Falha ao mover itens mensais do protocolo: esperados %, atualizados %.',
      linked_monthly_count,
      moved_monthly_count;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.pc_mensal_itens mensal
    WHERE (
      mensal.protocolo_id = protocol_id
      OR mensal.protocolo_item_id IN (
        SELECT item.id
        FROM public.pc_protocolo_itens item
        WHERE item.protocolo_id = protocol_id
      )
    )
      AND (mensal.ano <> target_year OR mensal.mes <> target_month)
  ) THEN
    RAISE EXCEPTION 'Ainda existem itens vinculados fora da competencia 07/2026.';
  END IF;

  RAISE NOTICE
    'Protocolo % e % item(ns) mensal(is) movidos para 07/2026.',
    protocol_id,
    moved_monthly_count;
END;
$$;
