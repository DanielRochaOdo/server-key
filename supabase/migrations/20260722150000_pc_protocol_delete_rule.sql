/*
  Ajusta a edicao e exclusao de protocolos:
  - editar apenas o titulo nao ressincroniza o mensal;
  - alterar a competencia move os registros mensais sem recria-los;
  - salvar um rascunho continua executando a sincronizacao completa;
  - permite excluir protocolos apenas quando:
  - estiverem em RASCUNHO; ou
  - nao possuirem itens.

  Registros mensais vinculados sao removidos antes do protocolo para evitar
  numeros orfaos quando a exclusao for permitida.
*/

CREATE OR REPLACE FUNCTION public.pc_protocolos_sync_mensal_trigger()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status::text = 'SALVO' THEN
    PERFORM public.pc_sync_mensal_from_protocolo(NEW.id);
  ELSIF OLD.ano IS DISTINCT FROM NEW.ano OR OLD.mes IS DISTINCT FROM NEW.mes THEN
    UPDATE public.pc_mensal_itens mensal
    SET
      ano = NEW.ano,
      mes = NEW.mes,
      updated_at = now()
    WHERE mensal.protocolo_id = NEW.id
       OR mensal.protocolo_item_id IN (
         SELECT item.id
         FROM public.pc_protocolo_itens item
         WHERE item.protocolo_id = NEW.id
       );
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.pc_protocol_delete_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status::text <> 'RASCUNHO'
     AND EXISTS (
       SELECT 1
       FROM public.pc_protocolo_itens item
       WHERE item.protocolo_id = OLD.id
     )
  THEN
    RAISE EXCEPTION 'Protocolo salvo com itens nao pode ser excluido.';
  END IF;

  DELETE FROM public.pc_mensal_itens mensal
  WHERE mensal.protocolo_id = OLD.id
     OR mensal.protocolo_item_id IN (
       SELECT item.id
       FROM public.pc_protocolo_itens item
       WHERE item.protocolo_id = OLD.id
     );

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_pc_protocol_delete_guard ON public.pc_protocolos;
CREATE TRIGGER trg_pc_protocol_delete_guard
BEFORE DELETE ON public.pc_protocolos
FOR EACH ROW
EXECUTE FUNCTION public.pc_protocol_delete_guard();
