export type ParqueBaseCadastroTipo =
  | 'itens'
  | 'unidades'
  | 'marcas'
  | 'categorias_produto'
  | 'especificacoes_produto'
  | 'setores'
  | 'tipos_movimentacao'
  | 'tipos_origem'
  | 'tipos_destino'
  | 'descricoes_destino';

export type ParqueMovimentacaoTipo =
  | 'entrada_manual'
  | 'entrada_compra'
  | 'saida_clinica'
  | 'saida_setor'
  | 'transferencia'
  | 'ajuste_positivo'
  | 'ajuste_negativo'
  | 'descarte';

export type ParqueOrigemDestinoTipo =
  | 'estoque'
  | 'compras'
  | 'clinica'
  | 'setor'
  | 'fornecedor'
  | 'ajuste'
  | 'descarte';

export type ParqueStatusEstoque = 'ativo' | 'inativo' | 'estoque_baixo';

export interface ParqueBaseItem {
  id: string;
  nome: string;
  ativo: boolean;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface ParqueUnidadeBase extends ParqueBaseItem {
  sigla?: string | null;
}

export interface ParqueProduto {
  id: string;
  categoria: string;
  especificacao_valor: string | null;
  quantidade_atual: number;
  quantidade_minima: number | null;
  custo_medio_atual: number;
  ativo: boolean;
  created_at: string | null;
  updated_at: string | null;
  item_base_id: string;
  unidade_base_id: string | null;
  marca_base_id: string | null;
  item_base?: ParqueBaseItem | null;
  unidade_base?: ParqueUnidadeBase | null;
  marca_base?: ParqueBaseItem | null;
}

export interface ParqueMovimentacao {
  id: string;
  produto_id: string;
  tipo_movimentacao: ParqueMovimentacaoTipo;
  origem_tipo: ParqueOrigemDestinoTipo | null;
  origem_id: string | null;
  origem_descricao: string | null;
  destino_tipo: ParqueOrigemDestinoTipo | null;
  destino_id: string | null;
  destino_descricao: string | null;
  quantidade: number;
  custo_unitario: number | null;
  custo_total: number | null;
  data_movimentacao: string;
  observacao: string | null;
  pedido_compra_id: string | null;
  custo_clinica_id: string | null;
  created_by: string | null;
  created_at: string | null;
  produto?: ParqueProduto | null;
  created_by_user?: {
    id?: string;
    name?: string | null;
    email?: string | null;
  } | null;
}

export interface ParqueDescarte {
  id: string;
  produto_id: string;
  data_descarte: string;
  quantidade: number;
  motivo: string;
  observacao: string | null;
  movimentacao_id: string | null;
  created_by: string | null;
  created_at: string | null;
}

export interface ParquePedidoCompraEntregue {
  id: string;
  ano: number;
  mes: number;
  item: string;
  loja: string | null;
  quantidade: number;
  quantidade_alocada: number;
  quantidade_disponivel: number;
  valor_unit: number;
  valor_total_frete: number;
  setor: string | null;
  protocolo_id: string | null;
  protocolo_item_id: string | null;
  origem_label: string;
}

export interface ParqueProdutoFormValues {
  item_base_id: string;
  categoria: string;
  especificacao_valor: string;
  unidade_base_id: string;
  marca_base_id: string;
  quantidade_inicial: number | '';
  valor_unitario_inicial: number | '';
  quantidade_minima: number | '';
  ativo: boolean;
}

export interface ParqueMovimentacaoFormValues {
  produto_id: string;
  tipo_movimentacao: ParqueMovimentacaoTipo;
  quantidade: number | '';
  valor_unitario: number | '';
  origem_tipo: string;
  origem_descricao: string;
  destino_tipo: string;
  destino_descricao: string;
  data_movimentacao: string;
  observacao: string;
  pedido_compra_id: string;
  setor_destino: string;
}

export interface ParqueItemParametroLink {
  id: string;
  item_base_id: string;
  categoria_parametro_id: string | null;
  especificacao_parametro_id: string | null;
  unidade_base_id: string | null;
  marca_base_id: string | null;
  ativo: boolean;
  created_at: string | null;
  updated_at: string | null;
  item_base?: ParqueBaseItem | null;
  categoria_parametro?: ParqueBaseItem | null;
  especificacao_parametro?: ParqueBaseItem | null;
  unidade_base?: ParqueUnidadeBase | null;
  marca_base?: ParqueBaseItem | null;
}

export interface ParqueDestinoSetorLink {
  id: string;
  destino_parametro_id: string;
  setor_parametro_id: string;
  ativo: boolean;
  created_at: string | null;
  updated_at: string | null;
  destino_parametro?: ParqueBaseItem | null;
  setor_parametro?: ParqueBaseItem | null;
}

export interface ParqueParametroLink {
  id: string;
  origem_parametro_id: string;
  destino_parametro_id: string;
  ativo: boolean;
  created_at: string | null;
  updated_at: string | null;
  origem_parametro?: ParqueBaseItem | null;
  destino_parametro?: ParqueBaseItem | null;
}

export interface ParqueCadastroLink {
  id: string;
  origem_tipo: ParqueBaseCadastroTipo;
  origem_id: string;
  destino_tipo: ParqueBaseCadastroTipo;
  destino_id: string;
  ativo: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export interface ParqueDescarteFormValues {
  produto_id: string;
  quantidade: number | '';
  data_descarte: string;
  motivo: string;
  observacao: string;
}

export interface ParqueCatalogos {
  itens: ParqueBaseItem[];
  unidades: ParqueUnidadeBase[];
  marcas: ParqueBaseItem[];
  categorias_produto: ParqueBaseItem[];
  especificacoes_produto: ParqueBaseItem[];
  setores: ParqueBaseItem[];
  tipos_movimentacao: ParqueBaseItem[];
  tipos_origem: ParqueBaseItem[];
  tipos_destino: ParqueBaseItem[];
  descricoes_destino: ParqueBaseItem[];
}

export interface ParquePermissoesAcao {
  visualizarEstoque: boolean;
  cadastrarProduto: boolean;
  editarProduto: boolean;
  registrarMovimentacao: boolean;
  registrarDescarte: boolean;
  visualizarInventario: boolean;
  realizarAjuste: boolean;
  gerenciarCadastrosBase: boolean;
}
