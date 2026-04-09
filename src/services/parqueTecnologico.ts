import { supabase } from '../lib/supabase';
import type {
  ParqueCadastroLink,
  ParqueBaseCadastroTipo,
  ParqueBaseItem,
  ParqueCatalogos,
  ParqueDestinoSetorLink,
  ParqueDescarte,
  ParqueDescarteFormValues,
  ParqueItemParametroLink,
  ParqueParametroLink,
  ParqueMovimentacao,
  ParqueMovimentacaoFormValues,
  ParquePedidoCompraEntregue,
  ParquePermissoesAcao,
  ParqueProduto,
  ParqueProdutoFormValues,
  ParqueStatusEstoque,
  ParqueUnidadeBase,
} from '../types/parqueTecnologico';

const PRODUTO_SELECT = `
  id,
  categoria,
  especificacao_valor,
  quantidade_atual,
  quantidade_minima,
  custo_medio_atual,
  ativo,
  created_at,
  updated_at,
  item_base_id,
  unidade_base_id,
  marca_base_id,
  item_base:parque_itens_base(id, nome, ativo),
  unidade_base:parque_unidades_base(id, nome, sigla, ativo),
  marca_base:parque_marcas_base(id, nome, ativo)
`;

const MOVIMENTACAO_SELECT = `
  id,
  produto_id,
  tipo_movimentacao,
  origem_tipo,
  origem_id,
  origem_descricao,
  destino_tipo,
  destino_id,
  destino_descricao,
  quantidade,
  custo_unitario,
  custo_total,
  data_movimentacao,
  observacao,
  pedido_compra_id,
  custo_clinica_id,
  created_by,
  created_at,
  produto:parque_produtos(
    id,
    categoria,
    especificacao_valor,
    quantidade_atual,
    quantidade_minima,
    custo_medio_atual,
    ativo,
    created_at,
    updated_at,
    item_base_id,
    unidade_base_id,
    marca_base_id,
    item_base:parque_itens_base(id, nome, ativo),
    unidade_base:parque_unidades_base(id, nome, sigla, ativo),
    marca_base:parque_marcas_base(id, nome, ativo)
  )
`;

type BaseTarget = {
  table: 'parque_itens_base' | 'parque_unidades_base' | 'parque_marcas_base' | 'parque_parametros_base';
  categoria?:
    | 'categoria_produto'
    | 'especificacao_produto'
    | 'setor'
    | 'tipo_movimentacao'
    | 'origem_tipo'
    | 'destino_tipo'
    | 'destino_descricao';
};

const BASE_TARGET_BY_TIPO: Record<ParqueBaseCadastroTipo, BaseTarget> = {
  itens: { table: 'parque_itens_base' },
  unidades: { table: 'parque_unidades_base' },
  marcas: { table: 'parque_marcas_base' },
  categorias_produto: { table: 'parque_parametros_base', categoria: 'categoria_produto' },
  especificacoes_produto: { table: 'parque_parametros_base', categoria: 'especificacao_produto' },
  setores: { table: 'parque_parametros_base', categoria: 'setor' },
  tipos_movimentacao: { table: 'parque_parametros_base', categoria: 'tipo_movimentacao' },
  tipos_origem: { table: 'parque_parametros_base', categoria: 'origem_tipo' },
  tipos_destino: { table: 'parque_parametros_base', categoria: 'destino_tipo' },
  descricoes_destino: { table: 'parque_parametros_base', categoria: 'destino_descricao' },
};

const PARQUE_BASE_TIPOS_BLOQUEADOS = new Set<ParqueBaseCadastroTipo>([
  'setores',
  'tipos_movimentacao',
  'tipos_origem',
  'tipos_destino',
  'descricoes_destino',
]);

const toNumber = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeErrorText = (value: unknown) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const toFriendlyMovimentacaoError = (error: { message?: unknown; details?: unknown; hint?: unknown }) => {
  const message = String(error?.message || '');
  const details = String(error?.details || '');
  const hint = String(error?.hint || '');
  const combined = [message, details, hint].filter(Boolean).join(' | ');
  const normalized = normalizeErrorText(combined);

  if (normalized.includes('saldo insuficiente')) {
    return 'Saldo insuficiente para esta saida. Reduza a quantidade ou registre uma entrada no estoque.';
  }
  if (normalized.includes('produto nao encontrado')) {
    return 'Produto nao encontrado. Selecione um item valido e tente novamente.';
  }
  if (normalized.includes('tipo de movimentacao invalido')) {
    return 'Acao invalida para movimentacao. Revise os campos e tente novamente.';
  }
  if (normalized.includes('quantidade deve ser maior que zero')) {
    return 'Informe uma quantidade maior que zero.';
  }
  if (normalized.includes('selecione um pedido entregue para entrada por compra')) {
    return 'Selecione um pedido entregue para registrar entrada por compra.';
  }
  if (normalized.includes('somente pedidos entregues podem gerar entrada no parque')) {
    return 'Somente pedidos com status ENTREGUE podem ser adicionados ao estoque.';
  }
  if (normalized.includes('pedido entregue ja foi totalmente incluido no estoque')) {
    return 'Esse pedido ja foi totalmente incluido no estoque.';
  }
  if (normalized.includes('quantidade informada excede saldo disponivel do pedido')) {
    return 'A quantidade informada excede o saldo disponivel desse pedido.';
  }
  if (normalized.includes('setor invalido para matriz')) {
    return 'Setor de MATRIZ invalido. Verifique se o setor esta cadastrado e ativo.';
  }
  if (normalized.includes('sem permiss')) {
    return 'Voce nao possui permissao para registrar movimentacoes.';
  }

  const cleaned = String(combined)
    .replace(/falha ao registrar movimenta[\w\W]?o:\s*/i, '')
    .replace(/\(sqlstate [^)]+\)\.?/i, '')
    .replace(/dados:\s*.*$/i, '')
    .trim();

  return cleaned || 'Nao foi possivel registrar a movimentacao. Revise os dados e tente novamente.';
};

const normalizeBaseItem = (row: any): ParqueBaseItem => ({
  id: row.id,
  nome: row.nome,
  ativo: Boolean(row.ativo),
  created_at: row.created_at ?? null,
  updated_at: row.updated_at ?? null,
});

const normalizeUnidadeBase = (row: any): ParqueUnidadeBase => ({
  ...normalizeBaseItem(row),
  sigla: row.sigla ?? null,
});

const normalizeProduto = (row: any): ParqueProduto => ({
  id: row.id,
  categoria: row.categoria ?? '',
  especificacao_valor: row.especificacao_valor ?? null,
  quantidade_atual: toNumber(row.quantidade_atual),
  quantidade_minima: row.quantidade_minima === null ? null : toNumber(row.quantidade_minima),
  custo_medio_atual: toNumber(row.custo_medio_atual),
  ativo: Boolean(row.ativo),
  created_at: row.created_at ?? null,
  updated_at: row.updated_at ?? null,
  item_base_id: row.item_base_id,
  unidade_base_id: row.unidade_base_id ?? null,
  marca_base_id: row.marca_base_id ?? null,
  item_base: row.item_base ? normalizeBaseItem(row.item_base) : null,
  unidade_base: row.unidade_base ? normalizeUnidadeBase(row.unidade_base) : null,
  marca_base: row.marca_base ? normalizeBaseItem(row.marca_base) : null,
});

const normalizeMovimentacao = (row: any): ParqueMovimentacao => ({
  id: row.id,
  produto_id: row.produto_id,
  tipo_movimentacao: row.tipo_movimentacao,
  origem_tipo: row.origem_tipo ?? null,
  origem_id: row.origem_id ?? null,
  origem_descricao: row.origem_descricao ?? null,
  destino_tipo: row.destino_tipo ?? null,
  destino_id: row.destino_id ?? null,
  destino_descricao: row.destino_descricao ?? null,
  quantidade: toNumber(row.quantidade),
  custo_unitario: row.custo_unitario === null ? null : toNumber(row.custo_unitario),
  custo_total: row.custo_total === null ? null : toNumber(row.custo_total),
  data_movimentacao: row.data_movimentacao,
  observacao: row.observacao ?? null,
  pedido_compra_id: row.pedido_compra_id ?? null,
  custo_clinica_id: row.custo_clinica_id ?? null,
  created_by: row.created_by ?? null,
  created_at: row.created_at ?? null,
  produto: row.produto ? normalizeProduto(row.produto) : null,
});

const normalizeItemParametroLink = (row: any): ParqueItemParametroLink => ({
  id: row.id,
  item_base_id: row.item_base_id,
  categoria_parametro_id: row.categoria_parametro_id ?? null,
  especificacao_parametro_id: row.especificacao_parametro_id ?? null,
  unidade_base_id: row.unidade_base_id ?? null,
  marca_base_id: row.marca_base_id ?? null,
  ativo: Boolean(row.ativo),
  created_at: row.created_at ?? null,
  updated_at: row.updated_at ?? null,
  item_base: row.item_base ? normalizeBaseItem(row.item_base) : null,
  categoria_parametro: row.categoria_parametro ? normalizeBaseItem(row.categoria_parametro) : null,
  especificacao_parametro: row.especificacao_parametro ? normalizeBaseItem(row.especificacao_parametro) : null,
  unidade_base: row.unidade_base ? normalizeUnidadeBase(row.unidade_base) : null,
  marca_base: row.marca_base ? normalizeBaseItem(row.marca_base) : null,
});

const normalizeDestinoSetorLink = (row: any): ParqueDestinoSetorLink => ({
  id: row.id,
  destino_parametro_id: row.destino_parametro_id,
  setor_parametro_id: row.setor_parametro_id,
  ativo: Boolean(row.ativo),
  created_at: row.created_at ?? null,
  updated_at: row.updated_at ?? null,
  destino_parametro: row.destino_parametro ? normalizeBaseItem(row.destino_parametro) : null,
  setor_parametro: row.setor_parametro ? normalizeBaseItem(row.setor_parametro) : null,
});

const normalizeCadastroLink = (row: any): ParqueCadastroLink => ({
  id: row.id,
  origem_tipo: row.origem_tipo,
  origem_id: row.origem_id,
  destino_tipo: row.destino_tipo,
  destino_id: row.destino_id,
  ativo: Boolean(row.ativo),
  created_at: row.created_at ?? null,
  updated_at: row.updated_at ?? null,
});

const normalizeParametroLink = (row: any): ParqueParametroLink => ({
  id: row.id,
  origem_parametro_id: row.origem_parametro_id,
  destino_parametro_id: row.destino_parametro_id,
  ativo: Boolean(row.ativo),
  created_at: row.created_at ?? null,
  updated_at: row.updated_at ?? null,
  origem_parametro: row.origem_parametro ? normalizeBaseItem(row.origem_parametro) : null,
  destino_parametro: row.destino_parametro ? normalizeBaseItem(row.destino_parametro) : null,
});

export const getParqueProdutoLabel = (produto?: ParqueProduto | null) => {
  if (!produto) return '-';
  const item = produto.item_base?.nome || 'Item';
  const especificacao = produto.especificacao_valor?.trim();
  const unidade = produto.unidade_base?.sigla || produto.unidade_base?.nome || '';
  const marca = produto.marca_base?.nome || '';
  return [item, especificacao ? `${especificacao}${unidade ? ` ${unidade}` : ''}` : '', marca]
    .filter(Boolean)
    .join(' • ');
};

export const getParqueProdutoStatus = (produto: ParqueProduto): ParqueStatusEstoque => {
  if (!produto.ativo) return 'inativo';
  if (
    produto.quantidade_minima !== null &&
    produto.quantidade_minima !== undefined &&
    produto.quantidade_atual <= produto.quantidade_minima
  ) {
    return 'estoque_baixo';
  }
  return 'ativo';
};

export const getParquePermissoes = (params: {
  canRead: boolean;
  canEdit: boolean;
  isAdmin: boolean;
  isOwner: boolean;
}): ParquePermissoesAcao => {
  const canAdjust = params.canEdit && (params.isAdmin || params.isOwner);

  return {
    visualizarEstoque: params.canRead,
    cadastrarProduto: params.canEdit,
    editarProduto: params.canEdit,
    registrarMovimentacao: params.canEdit,
    registrarDescarte: params.canEdit,
    visualizarInventario: params.canRead,
    realizarAjuste: canAdjust,
    gerenciarCadastrosBase: params.canEdit,
  };
};

export const listParqueCatalogos = async (): Promise<ParqueCatalogos> => {
  const [itensRes, unidadesRes, marcasRes, parametrosRes] = await Promise.all([
    supabase.from('parque_itens_base').select('id, nome, ativo, created_at, updated_at').order('nome'),
    supabase
      .from('parque_unidades_base')
      .select('id, nome, sigla, ativo, created_at, updated_at')
      .order('nome'),
    supabase.from('parque_marcas_base').select('id, nome, ativo, created_at, updated_at').order('nome'),
    supabase
      .from('parque_parametros_base')
      .select('id, categoria, nome, ativo, created_at, updated_at')
      .order('nome'),
  ]);

  if (itensRes.error) throw itensRes.error;
  if (unidadesRes.error) throw unidadesRes.error;
  if (marcasRes.error) throw marcasRes.error;
  if (parametrosRes.error) throw parametrosRes.error;

  const parametros = (parametrosRes.data || []) as Array<{
    id: string;
    categoria:
      | 'categoria_produto'
      | 'especificacao_produto'
      | 'setor'
      | 'tipo_movimentacao'
      | 'origem_tipo'
      | 'destino_tipo'
      | 'destino_descricao';
    nome: string;
    ativo: boolean;
    created_at?: string | null;
    updated_at?: string | null;
  }>;

  return {
    itens: (itensRes.data || []).map(normalizeBaseItem),
    unidades: (unidadesRes.data || []).map(normalizeUnidadeBase),
    marcas: (marcasRes.data || []).map(normalizeBaseItem),
    categorias_produto: parametros
      .filter((row) => row.categoria === 'categoria_produto')
      .map(normalizeBaseItem),
    especificacoes_produto: parametros
      .filter((row) => row.categoria === 'especificacao_produto')
      .map(normalizeBaseItem),
    setores: parametros
      .filter((row) => row.categoria === 'setor')
      .map(normalizeBaseItem),
    tipos_movimentacao: parametros
      .filter((row) => row.categoria === 'tipo_movimentacao')
      .map(normalizeBaseItem),
    tipos_origem: parametros
      .filter((row) => row.categoria === 'origem_tipo')
      .map(normalizeBaseItem),
    tipos_destino: parametros
      .filter((row) => row.categoria === 'destino_tipo')
      .map(normalizeBaseItem),
    descricoes_destino: parametros
      .filter((row) => row.categoria === 'destino_descricao')
      .map(normalizeBaseItem),
  };
};

export const listParqueBaseCadastros = async (
  tipo: ParqueBaseCadastroTipo
): Promise<Array<ParqueBaseItem | ParqueUnidadeBase>> => {
  const target = BASE_TARGET_BY_TIPO[tipo];
  const select =
    tipo === 'unidades'
      ? 'id, nome, sigla, ativo, created_at, updated_at'
      : target.table === 'parque_parametros_base'
        ? 'id, categoria, nome, ativo, created_at, updated_at'
        : 'id, nome, ativo, created_at, updated_at';

  let query = supabase.from(target.table).select(select).order('nome');
  if (target.categoria) {
    query = query.eq('categoria', target.categoria);
  }

  const { data, error } = await query;

  if (error) throw error;

  return (data || []).map((row: any) =>
    tipo === 'unidades' ? normalizeUnidadeBase(row) : normalizeBaseItem(row)
  );
};

export const saveParqueBaseCadastro = async (
  tipo: ParqueBaseCadastroTipo,
  payload: { id?: string; nome: string; sigla?: string; ativo: boolean },
  options?: { previousNome?: string }
) => {
  if (PARQUE_BASE_TIPOS_BLOQUEADOS.has(tipo)) {
    throw new Error('Este cadastro é controlado pelo sistema e não pode ser alterado manualmente.');
  }

  const target = BASE_TARGET_BY_TIPO[tipo];
  const body =
    tipo === 'unidades'
      ? {
          nome: payload.nome,
          sigla: payload.sigla?.trim() || null,
          ativo: payload.ativo,
        }
      : target.table === 'parque_parametros_base'
        ? {
            categoria: target.categoria,
            nome: payload.nome,
            ativo: payload.ativo,
          }
      : {
          nome: payload.nome,
          ativo: payload.ativo,
        };

  if (payload.id) {
    const { error } = await supabase.from(target.table).update(body).eq('id', payload.id);
    if (error) throw error;

    const previousNome = String(options?.previousNome || '').trim();
    const nextNome = String(payload.nome || '').trim();
    if (
      target.table === 'parque_parametros_base' &&
      previousNome &&
      nextNome &&
      previousNome !== nextNome
    ) {
      const columnByCategoria: Partial<
        Record<NonNullable<BaseTarget['categoria']>, 'tipo_movimentacao' | 'origem_tipo' | 'destino_tipo' | 'destino_descricao'>
      > = {
        tipo_movimentacao: 'tipo_movimentacao',
        origem_tipo: 'origem_tipo',
        destino_tipo: 'destino_tipo',
        destino_descricao: 'destino_descricao',
      };
      const targetColumn = target.categoria ? columnByCategoria[target.categoria] : null;

      if (targetColumn) {
        const { error: syncError } = await supabase
          .from('parque_movimentacoes')
          .update({ [targetColumn]: nextNome })
          .eq(targetColumn, previousNome);
        if (syncError) throw syncError;
      }
    }

    return;
  }

  const { error } = await supabase.from(target.table).insert(body);
  if (error) throw error;
};

export const deleteParqueBaseCadastro = async (
  tipo: ParqueBaseCadastroTipo,
  id: string
) => {
  if (PARQUE_BASE_TIPOS_BLOQUEADOS.has(tipo)) {
    throw new Error('Este cadastro é controlado pelo sistema e não pode ser excluído.');
  }

  const { error } = await supabase.rpc('parque_delete_base_cadastro', {
    p_tipo: tipo,
    p_id: id,
  });
  if (error) {
    const message = [error.message, (error as any).details, (error as any).hint]
      .filter(Boolean)
      .join(' | ');
    throw new Error(message || 'Erro ao excluir cadastro base.');
  }
};

export const listParqueItemParametroLinks = async (): Promise<ParqueItemParametroLink[]> => {
  const { data, error } = await supabase
    .from('parque_item_parametros_link')
    .select(`
      id,
      item_base_id,
      categoria_parametro_id,
      especificacao_parametro_id,
      unidade_base_id,
      marca_base_id,
      ativo,
      created_at,
      updated_at,
      item_base:parque_itens_base(id, nome, ativo),
      categoria_parametro:parque_parametros_base!parque_item_parametros_link_categoria_fkey(id, nome, ativo),
      especificacao_parametro:parque_parametros_base!parque_item_parametros_link_especificacao_fkey(id, nome, ativo),
      unidade_base:parque_unidades_base(id, nome, sigla, ativo),
      marca_base:parque_marcas_base(id, nome, ativo)
    `)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(normalizeItemParametroLink);
};

export const saveParqueItemParametroLink = async (payload: {
  id?: string;
  item_base_id: string;
  categoria_parametro_id?: string | null;
  especificacao_parametro_id?: string | null;
  unidade_base_id?: string | null;
  marca_base_id?: string | null;
  ativo?: boolean;
}) => {
  const body = {
    item_base_id: payload.item_base_id,
    categoria_parametro_id: payload.categoria_parametro_id || null,
    especificacao_parametro_id: payload.especificacao_parametro_id || null,
    unidade_base_id: payload.unidade_base_id || null,
    marca_base_id: payload.marca_base_id || null,
    ativo: payload.ativo ?? true,
  };

  if (payload.id) {
    const { error } = await supabase.from('parque_item_parametros_link').update(body).eq('id', payload.id);
    if (error) throw error;
    return;
  }

  const { error } = await supabase
    .from('parque_item_parametros_link')
    .upsert(body, { onConflict: 'item_base_id' });
  if (error) throw error;
};

export const listParqueDestinoSetorLinks = async (): Promise<ParqueDestinoSetorLink[]> => {
  const { data, error } = await supabase
    .from('parque_destino_setor_link')
    .select(`
      id,
      destino_parametro_id,
      setor_parametro_id,
      ativo,
      created_at,
      updated_at,
      destino_parametro:parque_parametros_base!parque_destino_setor_link_destino_fkey(id, nome, ativo),
      setor_parametro:parque_parametros_base!parque_destino_setor_link_setor_fkey(id, nome, ativo)
    `)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(normalizeDestinoSetorLink);
};

export const saveParqueDestinoSetorLink = async (payload: {
  id?: string;
  destino_parametro_id: string;
  setor_parametro_id: string;
  ativo?: boolean;
}) => {
  const body = {
    destino_parametro_id: payload.destino_parametro_id,
    setor_parametro_id: payload.setor_parametro_id,
    ativo: payload.ativo ?? true,
  };

  if (payload.id) {
    const { error } = await supabase.from('parque_destino_setor_link').update(body).eq('id', payload.id);
    if (error) throw error;
    return;
  }

  const { error } = await supabase
    .from('parque_destino_setor_link')
    .upsert(body, { onConflict: 'destino_parametro_id' });
  if (error) throw error;
};

export const saveParqueDestinoParametro = async (payload: {
  id?: string;
  nome: string;
  tipo_movimentacao_parametro_id: string;
  ativo?: boolean;
}) => {
  const nomeNormalizado = String(payload.nome || '')
    .trim()
    .toUpperCase();

  if (!nomeNormalizado) {
    throw new Error('Informe o destino.');
  }
  if (!payload.tipo_movimentacao_parametro_id) {
    throw new Error('Selecione a ação.');
  }

  const { data, error } = await supabase.rpc('parque_save_destino_parametro', {
    p_destino_id: payload.id || null,
    p_destino_nome: nomeNormalizado,
    p_tipo_movimentacao_id: payload.tipo_movimentacao_parametro_id,
    p_ativo: payload.ativo ?? true,
  });

  if (error) {
    const message = [error.message, (error as any).details, (error as any).hint]
      .filter(Boolean)
      .join(' | ');
    throw new Error(message || 'Erro ao salvar destino.');
  }

  return data as string;
};

export const listParqueParametrosLinks = async (): Promise<ParqueParametroLink[]> => {
  const { data, error } = await supabase
    .from('parque_parametros_link')
    .select(`
      id,
      origem_parametro_id,
      destino_parametro_id,
      ativo,
      created_at,
      updated_at,
      origem_parametro:parque_parametros_base!parque_parametros_link_origem_fkey(id, nome, ativo),
      destino_parametro:parque_parametros_base!parque_parametros_link_destino_fkey(id, nome, ativo)
    `)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(normalizeParametroLink);
};

export const saveParqueParametroLink = async (payload: {
  id?: string;
  origem_parametro_id: string;
  destino_parametro_id: string;
  ativo?: boolean;
}) => {
  const body = {
    origem_parametro_id: payload.origem_parametro_id,
    destino_parametro_id: payload.destino_parametro_id,
    ativo: payload.ativo ?? true,
  };

  if (payload.id) {
    const { error } = await supabase.from('parque_parametros_link').update(body).eq('id', payload.id);
    if (error) throw error;
    return;
  }

  const { error } = await supabase
    .from('parque_parametros_link')
    .upsert(body, { onConflict: 'origem_parametro_id' });
  if (error) throw error;
};

export const listParqueCadastrosLinks = async (): Promise<ParqueCadastroLink[]> => {
  const { data, error } = await supabase
    .from('parque_cadastros_link')
    .select('id, origem_tipo, origem_id, destino_tipo, destino_id, ativo, created_at, updated_at')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(normalizeCadastroLink);
};

export const replaceParqueCadastroLinks = async (payload: {
  origem_tipo: ParqueBaseCadastroTipo;
  origem_id: string;
  destino_tipo: ParqueBaseCadastroTipo;
  destino_ids: string[];
}) => {
  const { error: deleteError } = await supabase
    .from('parque_cadastros_link')
    .delete()
    .eq('origem_tipo', payload.origem_tipo)
    .eq('origem_id', payload.origem_id);
  if (deleteError) throw deleteError;

  const uniqueDestinoIds = Array.from(new Set(payload.destino_ids.filter(Boolean)));
  if (uniqueDestinoIds.length === 0) return;

  const rows = uniqueDestinoIds.map((destinoId) => ({
    origem_tipo: payload.origem_tipo,
    origem_id: payload.origem_id,
    destino_tipo: payload.destino_tipo,
    destino_id: destinoId,
    ativo: true,
  }));

  const { error: insertError } = await supabase.from('parque_cadastros_link').insert(rows);
  if (insertError) throw insertError;
};

export interface ListParqueProdutosFilters {
  busca?: string;
  itemBaseId?: string;
  categoria?: string;
  marcaBaseId?: string;
  unidadeBaseId?: string;
  status?: ParqueStatusEstoque | '';
  estoqueBaixo?: boolean;
}

export const listParqueProdutos = async (
  filters?: ListParqueProdutosFilters
): Promise<ParqueProduto[]> => {
  let query = supabase.from('parque_produtos').select(PRODUTO_SELECT).order('created_at', { ascending: false });

  if (filters?.itemBaseId) {
    query = query.eq('item_base_id', filters.itemBaseId);
  }
  if (filters?.categoria) {
    query = query.ilike('categoria', `%${filters.categoria}%`);
  }
  if (filters?.marcaBaseId) {
    query = query.eq('marca_base_id', filters.marcaBaseId);
  }
  if (filters?.unidadeBaseId) {
    query = query.eq('unidade_base_id', filters.unidadeBaseId);
  }
  if (filters?.status === 'inativo') {
    query = query.eq('ativo', false);
  }
  if (filters?.status === 'ativo' || filters?.status === 'estoque_baixo') {
    query = query.eq('ativo', true);
  }
  if (filters?.estoqueBaixo) {
    query = query.not('quantidade_minima', 'is', null);
  }

  const { data, error } = await query;

  if (error) throw error;

  let produtos = (data || []).map(normalizeProduto);

  if (filters?.busca?.trim()) {
    const term = filters.busca.trim().toLowerCase();
    produtos = produtos.filter((produto) =>
      [
        produto.item_base?.nome,
        produto.categoria,
        produto.especificacao_valor,
        produto.marca_base?.nome,
        produto.unidade_base?.nome,
        produto.unidade_base?.sigla,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }

  if (filters?.status === 'estoque_baixo' || filters?.estoqueBaixo) {
    produtos = produtos.filter((produto) => getParqueProdutoStatus(produto) === 'estoque_baixo');
  }

  return produtos;
};

export const createParqueProduto = async (values: ParqueProdutoFormValues) => {
  const quantidadeInicial = values.quantidade_inicial === '' ? 0 : Number(values.quantidade_inicial);
  const valorUnitarioInicial = values.valor_unitario_inicial === '' ? null : Number(values.valor_unitario_inicial);

  const { data, error } = await supabase.rpc('parque_create_produto', {
    p_item_base_id: values.item_base_id,
    p_categoria: values.categoria,
    p_especificacao_valor: values.especificacao_valor || null,
    p_unidade_base_id: values.unidade_base_id || null,
    p_marca_base_id: values.marca_base_id || null,
    p_quantidade_inicial: quantidadeInicial,
    p_quantidade_minima: values.quantidade_minima === '' ? null : Number(values.quantidade_minima),
    p_ativo: values.ativo,
    p_observacao: null,
  });

  if (error) {
    const code = String((error as any)?.code || '');
    const message = String((error as any)?.message || '').toLowerCase();
    const details = String((error as any)?.details || '').toLowerCase();
    const isDuplicate =
      code === '23505' ||
      message.includes('duplicate key') ||
      details.includes('duplicate key') ||
      message.includes('parque_produtos_unique_key') ||
      details.includes('parque_produtos_unique_key');

    if (isDuplicate) {
      throw new Error('Já existe um produto com o mesmo item, especificação, unidade e marca.');
    }

    throw error;
  }

  const produtoId = data as string;
  if (
    quantidadeInicial > 0 &&
    valorUnitarioInicial !== null &&
    Number.isFinite(valorUnitarioInicial) &&
    valorUnitarioInicial > 0
  ) {
    const { error: updateError } = await supabase
      .from('parque_movimentacoes')
      .update({
        custo_unitario: valorUnitarioInicial,
      })
      .eq('produto_id', produtoId)
      .eq('tipo_movimentacao', 'entrada_manual');

    if (updateError) throw updateError;
  }

  return produtoId;
};

export const updateParqueProduto = async (
  id: string,
  payload: Partial<Pick<ParqueProduto, 'categoria' | 'especificacao_valor' | 'quantidade_minima' | 'ativo'>> & {
    item_base_id?: string;
    unidade_base_id?: string | null;
    marca_base_id?: string | null;
  }
) => {
  const { error } = await supabase
    .from('parque_produtos')
    .update({
      item_base_id: payload.item_base_id,
      categoria: payload.categoria,
      especificacao_valor: payload.especificacao_valor ?? null,
      unidade_base_id: payload.unidade_base_id ?? null,
      marca_base_id: payload.marca_base_id ?? null,
      quantidade_minima: payload.quantidade_minima ?? null,
      ativo: payload.ativo,
    })
    .eq('id', id);

  if (error) throw error;
};

export const deleteParqueProduto = async (id: string) => {
  const { error } = await supabase.rpc('parque_delete_produto', { p_produto_id: id });
  if (error) {
    const message = [error.message, (error as any).details, (error as any).hint]
      .filter(Boolean)
      .join(' | ');
    throw new Error(message || 'Erro ao excluir produto.');
  }
};

export interface ListParqueMovimentacoesFilters {
  busca?: string;
  produtoId?: string;
  tipoMovimentacao?: string;
  origemTipo?: string;
  destinoTipo?: string;
  clinica?: string;
  setor?: string;
  startDate?: string;
  endDate?: string;
}

export const listParqueMovimentacoes = async (
  filters?: ListParqueMovimentacoesFilters
): Promise<ParqueMovimentacao[]> => {
  let query = supabase
    .from('parque_movimentacoes')
    .select(MOVIMENTACAO_SELECT)
    .order('data_movimentacao', { ascending: false })
    .order('created_at', { ascending: false });

  if (filters?.produtoId) {
    query = query.eq('produto_id', filters.produtoId);
  }
  if (filters?.tipoMovimentacao) {
    query = query.eq('tipo_movimentacao', filters.tipoMovimentacao);
  }
  if (filters?.origemTipo) {
    query = query.eq('origem_tipo', filters.origemTipo);
  }
  if (filters?.destinoTipo) {
    query = query.eq('destino_tipo', filters.destinoTipo);
  }
  if (filters?.startDate) {
    query = query.gte('data_movimentacao', filters.startDate);
  }
  if (filters?.endDate) {
    query = query.lte('data_movimentacao', `${filters.endDate}T23:59:59`);
  }

  const { data, error } = await query;

  if (error) throw error;

  let movimentacoes = (data || []).map(normalizeMovimentacao);

  if (filters?.busca?.trim()) {
    const term = filters.busca.trim().toLowerCase();
    movimentacoes = movimentacoes.filter((row) =>
      [
        getParqueProdutoLabel(row.produto),
        row.tipo_movimentacao,
        row.origem_descricao,
        row.destino_descricao,
        row.observacao,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }

  if (filters?.clinica) {
    const clinic = filters.clinica.toLowerCase();
    movimentacoes = movimentacoes.filter(
      (row) =>
        row.destino_tipo === 'clinica' &&
        String(row.destino_descricao || '')
          .toLowerCase()
          .includes(clinic)
    );
  }

  if (filters?.setor) {
    const setor = filters.setor.toLowerCase();
    movimentacoes = movimentacoes.filter(
      (row) =>
        ((row.destino_tipo === 'setor' && row.destino_descricao) ||
          (row.origem_tipo === 'setor' && row.origem_descricao) ||
          row.tipo_movimentacao === 'saida_clinica') &&
        [row.destino_descricao, row.origem_descricao, row.observacao]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(setor))
    );
  }

  return movimentacoes;
};

export const listParqueHistoricoProduto = async (produtoId: string) =>
  listParqueMovimentacoes({ produtoId });

export const registerParqueMovimentacao = async (values: ParqueMovimentacaoFormValues) => {
  const { data, error } = await supabase.rpc('parque_registrar_movimentacao', {
    p_produto_id: values.produto_id,
    p_tipo_movimentacao: values.tipo_movimentacao,
    p_quantidade: values.quantidade === '' ? 0 : Number(values.quantidade),
    p_origem_tipo: values.origem_tipo || null,
    p_origem_id: null,
    p_origem_descricao: values.origem_descricao || null,
    p_destino_tipo: values.destino_tipo || null,
    p_destino_id: null,
    p_destino_descricao: values.destino_descricao || null,
    p_data_movimentacao: values.data_movimentacao,
    p_observacao: values.observacao || null,
    p_pedido_compra_id: values.pedido_compra_id || null,
    p_custo_unitario: values.valor_unitario === '' ? null : Number(values.valor_unitario),
  });

  if (error) {
    throw new Error(
      toFriendlyMovimentacaoError({
        message: error.message,
        details: (error as any).details,
        hint: (error as any).hint,
      })
    );
  }
  return data as string;
};

export const registerParqueDescarte = async (values: ParqueDescarteFormValues) => {
  const { data, error } = await supabase.rpc('parque_registrar_descarte', {
    p_produto_id: values.produto_id,
    p_quantidade: values.quantidade === '' ? 0 : Number(values.quantidade),
    p_data_descarte: values.data_descarte,
    p_motivo: values.motivo,
    p_observacao: values.observacao || null,
  });

  if (error) throw error;
  return data as string;
};

export const listParqueDescartes = async (): Promise<ParqueDescarte[]> => {
  const { data, error } = await supabase
    .from('parque_descartes')
    .select('id, produto_id, data_descarte, quantidade, motivo, observacao, movimentacao_id, created_by, created_at')
    .order('data_descarte', { ascending: false });

  if (error) throw error;

  return (data || []).map((row: any) => ({
    id: row.id,
    produto_id: row.produto_id,
    data_descarte: row.data_descarte,
    quantidade: toNumber(row.quantidade),
    motivo: row.motivo,
    observacao: row.observacao ?? null,
    movimentacao_id: row.movimentacao_id ?? null,
    created_by: row.created_by ?? null,
    created_at: row.created_at ?? null,
  }));
};

export const listParquePedidosEntregues = async (): Promise<ParquePedidoCompraEntregue[]> => {
  const { data, error } = await supabase.rpc('parque_list_pedidos_entregues');

  if (error) throw error;

  return ((data || []) as any[]).map((row) => ({
    id: row.id,
    ano: Number(row.ano || 0),
    mes: Number(row.mes || 0),
    item: row.item || '',
    loja: row.loja ?? null,
    quantidade: toNumber(row.quantidade),
    quantidade_alocada: toNumber(row.quantidade_alocada),
    quantidade_disponivel: toNumber(row.quantidade_disponivel),
    valor_unit: toNumber(row.valor_unit),
    valor_total_frete: toNumber(row.valor_total_frete),
    setor: row.setor ?? null,
    protocolo_id: row.protocolo_id ?? null,
    protocolo_item_id: row.protocolo_item_id ?? null,
    origem_label: row.origem_label || row.item || '',
  }));
};

