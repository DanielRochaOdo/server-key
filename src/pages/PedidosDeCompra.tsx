import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { Plus, Download, ExternalLink, Save, Trash2, Pencil } from "lucide-react";
import * as XLSX from "xlsx-js-style";
import { exportProtocoloXlsx } from "../utils/exportProtocoloXlsx";
import MoneyInputBRL from "../components/MoneyInputBRL";

type PcStatusMensal = "ENTREGUE" | "PEDIDO_FEITO";
type PcPrioridade = "BAIXA" | "MEDIA" | "ALTA";
type PcStatusProtocolo = "RASCUNHO" | "SALVO";

type MensalItem = {
    id: string;
    ano: number;
    mes: number;
    item: string;
    quantidade: number;
    valor_unit: number;
    valor_total_frete: number;
    setor: string | null;
    status: PcStatusMensal;
};

type Protocolo = {
    id: string;
    titulo: string;
    nome: string; // TITULO_DD-MM-AAAA
    ano: number;
    mes: number;
    status: PcStatusProtocolo;
    valor_final: number;
    created_at: string;
};


const PC_STATE_KEY = "serverkey:pedidos_compra_state";

type PcUiState = {
    tab: "MENSAL" | "PROTOCOLO";
    ano: number;
    mes: number;
    protocoloSelId: string | null;
};

function loadPcUiState(defaults: PcUiState): PcUiState {
    try {
        const raw = localStorage.getItem(PC_STATE_KEY);
        if (!raw) return defaults;
        const parsed = JSON.parse(raw) as Partial<PcUiState>;
        return {
            tab: parsed.tab ?? defaults.tab,
            ano: parsed.ano ?? defaults.ano,
            mes: parsed.mes ?? defaults.mes,
            protocoloSelId: parsed.protocoloSelId ?? defaults.protocoloSelId,
        };
    } catch {
        return defaults;
    }
}

function savePcUiState(state: PcUiState) {
    try {
        localStorage.setItem(PC_STATE_KEY, JSON.stringify(state));
    } catch { }
}


type ProtocoloItem = {
    id: string;
    protocolo_id: string;
    loja: string;
    produto: string;
    prioridade: PcPrioridade;
    quantidade: number;
    valor_unit: number;
    valor_total: number;
    link?: string | null;
};

function getNowYM() {
    const now = new Date();
    return { ano: now.getFullYear(), mes: now.getMonth() + 1 };
}

function currency(n: number) {
    return (n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function prioridadeBadge(p: PcPrioridade) {
    const base = "px-2 py-1 rounded-lg text-xs font-semibold";
    if (p === "BAIXA") return `${base} bg-blue-100 text-blue-700`;
    if (p === "MEDIA") return `${base} bg-yellow-100 text-yellow-800`;
    return `${base} bg-red-100 text-red-700`;
}

export default function PedidosDeCompra() {
    const { ano: anoNow, mes: mesNow } = getNowYM();

    const initialUi = loadPcUiState({
        tab: "MENSAL",
        ano: anoNow,
        mes: mesNow,
        protocoloSelId: null,
    });

    const [tab, setTab] = useState<"MENSAL" | "PROTOCOLO">(initialUi.tab);
    const [ano, setAno] = useState<number>(initialUi.ano);
    const [mes, setMes] = useState<number>(initialUi.mes);

    const [protocoloSel, setProtocoloSel] = useState<Protocolo | null>(null);
    const [protocoloSelId, setProtocoloSelId] = useState<string | null>(initialUi.protocoloSelId);


    const [mensal, setMensal] = useState<MensalItem[]>([]);
    const [totais, setTotais] = useState<{ total_entregue: number; total_aprovado: number } | null>(null);

    // PROTOCOLOS
    const [protocolos, setProtocolos] = useState<Protocolo[]>([]);
    const [itens, setItens] = useState<ProtocoloItem[]>([]);
    const [novoTitulo, setNovoTitulo] = useState("");

    const [editItem, setEditItem] = useState<ProtocoloItem | null>(null);
    const [editDraft, setEditDraft] = useState({
        loja: "",
        produto: "",
        prioridade: "MEDIA" as PcPrioridade,
        quantidade: 1,
        valor_unit: 0,
        link: "",
    });

    // item editor protocolo
    const [draft, setDraft] = useState<Omit<ProtocoloItem, "id" | "protocolo_id" | "valor_total">>({
        loja: "",
        produto: "",
        prioridade: "MEDIA",
        quantidade: 1,
        valor_unit: 0,
        link: "",
    });

    const valorFinalProtocolo = useMemo(() => {
        return itens.reduce((acc, i) => acc + (Number(i.valor_total) || 0), 0);
    }, [itens]);

    const saldo = useMemo(() => {
        const totalEntregue = totais?.total_entregue ?? 0;
        return 2500 - totalEntregue;
    }, [totais]);

    // =============================
    // LOADERS
    // =============================
    async function loadMensal() {
        const { data, error } = await supabase
            .from("pc_mensal_itens")
            .select("*")
            .eq("ano", ano)
            .eq("mes", mes)
            .order("created_at", { ascending: true });

        if (error) {
            console.error("Erro loadMensal:", error.message);
            setMensal([]);
            return;
        }
        setMensal((data ?? []) as MensalItem[]);

        const { data: tData, error: tErr } = await supabase
            .from("pc_mensal_totais")
            .select("*")
            .eq("ano", ano)
            .eq("mes", mes)
            .maybeSingle();

        if (tErr) {
            console.error("Erro totais:", tErr.message);
            setTotais(null);
            return;
        }
        setTotais(tData ? { total_entregue: Number(tData.total_entregue || 0), total_aprovado: Number(tData.total_aprovado || 0) } : null);
    }

    async function loadProtocolos() {
        const { data, error } = await supabase
            .from("pc_protocolos")
            .select("*")
            .eq("ano", ano)
            .eq("mes", mes)
            .order("created_at", { ascending: false });

        if (error) {
            console.error("Erro loadProtocolos:", error.message);
            setProtocolos([]);
            return;
        }
        setProtocolos((data ?? []) as Protocolo[]);
    }

    useEffect(() => {
        if (!protocoloSelId) return;
        if (protocoloSel?.id === protocoloSelId) return;

        const found = protocolos.find((p) => p.id === protocoloSelId);
        if (found) setProtocoloSel(found);
    }, [protocolos, protocoloSelId]);

    async function loadItens(protocoloId: string) {
        const { data, error } = await supabase
            .from("pc_protocolo_itens")
            .select("*")
            .eq("protocolo_id", protocoloId)
            .order("created_at", { ascending: true });

        if (error) {
            console.error("Erro loadItens:", error.message);
            setItens([]);
            return;
        }
        setItens((data ?? []) as ProtocoloItem[]);
    }

    useEffect(() => {
        loadMensal();
        loadProtocolos();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ano, mes]);

    useEffect(() => {
        if (protocoloSel?.id) loadItens(protocoloSel.id);
        else setItens([]);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [protocoloSel?.id]);

    useEffect(() => {
        savePcUiState({
            tab,
            ano,
            mes,
            protocoloSelId,
        });
    }, [tab, ano, mes, protocoloSelId]);

    // =============================
    // ACTIONS: MENSAL
    // =============================
    async function updateMensalItem(id: string, patch: Partial<MensalItem>) {
        const { error } = await supabase.from("pc_mensal_itens").update(patch).eq("id", id);
        if (error) {
            console.error("Erro update mensal:", error.message);
            return;
        }
        await loadMensal();
    }

    // =============================
    // ACTIONS: PROTOCOLO
    // =============================
    async function criarProtocolo() {
        const titulo = novoTitulo.trim();
        if (!titulo) return;

        const { data, error } = await supabase
            .from("pc_protocolos")
            .insert([{ titulo, ano, mes }])
            .select("*")
            .single();

        if (error) {
            console.error("Erro criar protocolo:", error.message);
            return;
        }

        setNovoTitulo("");
        await loadProtocolos();
        setProtocoloSel(data as Protocolo);
        setProtocoloSelId((data as Protocolo).id);
    }

    function startEdit(i: ProtocoloItem) {
        setEditItem(i);
        setEditDraft({
            loja: i.loja,
            produto: i.produto,
            prioridade: i.prioridade,
            quantidade: Number(i.quantidade || 0),
            valor_unit: Number(i.valor_unit || 0),
            link: i.link || "",
        });
    }

    async function saveEdit() {
        if (!editItem) return;

        const { error } = await supabase
            .from("pc_protocolo_itens")
            .update({
                loja: editDraft.loja.trim(),
                produto: editDraft.produto.trim(),
                prioridade: editDraft.prioridade,
                quantidade: Number(editDraft.quantidade || 0),
                valor_unit: Number(editDraft.valor_unit || 0),
                link: (editDraft.link || "").trim() || null,
            })
            .eq("id", editItem.id);

        if (error) {
            console.error("Erro editar item:", error.message);
            return;
        }

        setEditItem(null);
        if (protocoloSel) {
            await loadItens(protocoloSel.id);
            await loadProtocolos();
        }
    }

    async function salvarProtocolo() {
        if (!protocoloSel) return;

        // mudar status para SALVO -> trigger joga pro mensal com PEDIDO_FEITO
        const { error } = await supabase
            .from("pc_protocolos")
            .update({ status: "SALVO", valor_final: valorFinalProtocolo })
            .eq("id", protocoloSel.id);

        if (error) {
            console.error("Erro salvar protocolo:", error.message);
            return;
        }

        await loadProtocolos();
        await loadMensal();
    }

    async function excluirProtocolo() {
        if (!protocoloSel) return;
        const { error } = await supabase.from("pc_protocolos").delete().eq("id", protocoloSel.id);
        if (error) {
            console.error("Erro excluir protocolo:", error.message);
            return;
        }
        setProtocoloSel(null);
        setProtocoloSelId(null);
        await loadProtocolos();
    }

    async function addItem() {
        if (!protocoloSel) return;
        if (!draft.loja.trim() || !draft.produto.trim()) return;

        const payload = {
            protocolo_id: protocoloSel.id,
            loja: draft.loja.trim(),
            produto: draft.produto.trim(),
            prioridade: draft.prioridade,
            quantidade: Number(draft.quantidade || 0),
            valor_unit: Number(draft.valor_unit || 0),
            link: (draft.link || "").trim() || null,
        };

        const { error } = await supabase.from("pc_protocolo_itens").insert([payload]);
        if (error) {
            console.error("Erro add item:", error.message);
            return;
        }

        setDraft({ loja: "", produto: "", prioridade: "MEDIA", quantidade: 1, valor_unit: 0, link: "" });
        await loadItens(protocoloSel.id);
        await loadProtocolos();
    }

    async function deleteItem(itemId: string) {
        const { error } = await supabase.from("pc_protocolo_itens").delete().eq("id", itemId);
        if (error) {
            console.error("Erro delete item:", error.message);
            return;
        }
        if (protocoloSel) {
            await loadItens(protocoloSel.id);
            await loadProtocolos();
        }
    }

    function exportarProtocoloSelecionado() {
        if (!protocoloSel) return;
        exportProtocoloXlsx({
            protocoloNome: protocoloSel.nome,
            itens: itens.map((i) => ({
                loja: i.loja,
                produto: i.produto,
                prioridade: i.prioridade,
                quantidade: Number(i.quantidade || 0),
                valorUnit: Number(i.valor_unit || 0),
                link: i.link || "",
            })),
        });
    }

    // =============================
    // UI
    // =============================
    return (
        <div className="space-y-6 sm:space-y-8">
            {/* Header (Server-Key feel) */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-primary-900">Pedidos de Compra</h1>
                    <p className="mt-1 sm:mt-2 text-x1 text-primary-400">MENSAL (controle do mês) e PROTOCOLO (pedidos por título)</p>
                </div>

                <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
                    <select
                        className="border rounded-xl px-3 py-2 text-sm"
                        value={ano}
                        onChange={(e) => setAno(Number(e.target.value))}
                    >
                        {Array.from({ length: 6 }).map((_, idx) => {
                            const y = anoNow - 2 + idx;
                            return (
                                <option key={y} value={y}>
                                    {y}
                                </option>
                            );
                        })}
                    </select>

                    <select
                        className="border rounded-xl px-3 py-2 text-sm"
                        value={mes}
                        onChange={(e) => setMes(Number(e.target.value))}
                    >
                        {Array.from({ length: 12 }).map((_, i) => (
                            <option key={i + 1} value={i + 1}>
                                {String(i + 1).padStart(2, "0")}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
                <button
                    onClick={() => setTab("MENSAL")}
                    className={`inline-flex items-center justify-center w-full sm:w-auto px-3 sm:px-4 py-2 border text-xs sm:text-sm font-medium rounded-lg
                    ${tab === "MENSAL"
                            ? "border-transparent text-white bg-button hover:bg-button-hover"
                            : "border border-button text-button bg-white hover:bg-button-50"
                        }`}
                >
                    Mensal
                </button>

                <button
                    onClick={() => setTab("PROTOCOLO")}
                    className={`inline-flex items-center justify-center w-full sm:w-auto px-3 sm:px-4 py-2 border text-xs sm:text-sm font-medium rounded-lg
                    ${tab === "PROTOCOLO"
                            ? "border-transparent text-white bg-button hover:bg-button-hover"
                            : "border border-button text-button bg-white hover:bg-button-50"
                        }`}
                >
                    Protocolo
                </button>
            </div>

            {/* ================= MENSAL ================= */}
            {tab === "MENSAL" && (
                <div className="mt-4 bg-white rounded-xl shadow-md overflow-hidden hide-scrollbar">
                    <div className="flex items-center justify-between gap-4 px-3 py-3 border-b">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white px-3">Compras do mês</h2>

                        <div className="flex items-center gap-3 text-sm">
                            <div className="px-3 py-2 rounded-xl bg-gray-50 border">
                                <span className="text-gray-500 dark:text-black">Total Entregue:</span>{" "}
                                <span className="font-semibold dark:text-black">{currency(totais?.total_entregue ?? 0)}</span>
                            </div>
                            <div className="px-3 py-2 rounded-xl bg-gray-50 border">
                                <span className="text-gray-500 dark:text-black">Total Aprovado:</span>{" "}
                                <span className="font-semibold dark:text-black">{currency(totais?.total_aprovado ?? 0)}</span>
                            </div>
                            <div className="px-3 py-2 rounded-xl bg-gray-50 border">
                                <span className="text-gray-500 dark:text-black">Saldo (R$ 2500 - Entregue):</span>{" "}
                                <span className={`font-semibold ${saldo < 0 ? "text-red-600" : "text-green-700"}`}>
                                    {currency(saldo)}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-neutral-200 text-[11px]">
                            <thead className="bg-neutral-50">
                                <tr className="group hover:bg-neutral-50 dark:hover:bg-neutral-900/40 transition-colors duration-150">
                                    <th className="px-2 py-2 text-center font-medium text-neutral-500 uppercase tracking-wider">Item</th>
                                    <th className="px-2 py-2 text-center font-medium text-neutral-500 uppercase tracking-wider">Quantidade</th>
                                    <th className="px-2 py-2 text-center font-medium text-neutral-500 uppercase tracking-wider">Valor Unit.</th>
                                    <th className="px-2 py-2 text-center font-medium text-neutral-500 uppercase tracking-wider">Valor Total + Frete</th>
                                    <th className="px-2 py-2 text-center font-medium text-neutral-500 uppercase tracking-wider">Setor</th>
                                    <th className="px-2 py-2 text-center font-medium text-neutral-500 uppercase tracking-wider">Status</th>
                                </tr>
                            </thead>
                            <tbody className="text-center bg-white divide-y divide-neutral-200 dark:bg-neutral-950 dark:divide-neutral-800">
                                {mensal.map((m) => (
                                    <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-neutral-900/60">
                                        <td className="px-3 py-2 border-b text-center text-neutral-900 dark:text-neutral-100">{m.item}</td>
                                        <td className="px-3 py-2 border-b text-center text-neutral-900 dark:text-neutral-100">{Number(m.quantidade || 0)}</td>
                                        <td className="px-3 py-2 border-b text-center text-neutral-900 dark:text-neutral-100">{currency(Number(m.valor_unit || 0))}</td>
                                        <td className="px-3 py-2 border-b text-center text-neutral-900 dark:text-neutral-100">{currency(Number(m.valor_total_frete || 0))}</td>

                                        <td className="px-3 py-2 border-b">
                                            <input
                                                className="w-full border rounded-lg px-2 py-1"
                                                value={m.setor ?? ""}
                                                onChange={(e) => updateMensalItem(m.id, { setor: e.target.value })}
                                            />
                                        </td>

                                        <td className="px-3 py-2 border-b text-center">
                                            <select
                                                value={m.status}
                                                onChange={(e) => updateMensalItem(m.id, { status: e.target.value as PcStatusMensal })}
                                                className={`border rounded-lg px-1 py-1 w-32 disabled:opacity-60
                                                    ${m.status === "ENTREGUE"
                                                        ? "bg-green-50 text-green-700 border-green-200"
                                                        : "bg-yellow-50 text-yellow-800 border-yellow-200"
                                                    }`}
                                                aria-label="Status"
                                            >
                                                <option value="PEDIDO_FEITO">PEDIDO FEITO</option>
                                                <option value="ENTREGUE">ENTREGUE</option>
                                            </select>
                                        </td>
                                    </tr>
                                ))}

                                {!mensal.length && (
                                    <tr>
                                        <td className="px-3 py-6 text-center text-gray-500 dark:text-neutral-400 dark:text-neutral-400" colSpan={6}>
                                            Nenhum item no mensal para {String(mes).padStart(2, "0")}/{ano}.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ================= PROTOCOLO ================= */}
            {tab === "PROTOCOLO" && (
                <div className="grid grid-cols-12 gap-6 mt-4 ">
                    <div className="col-span-12 lg:col-span-4 bg-white border rounded-2xl shadow-sm p-4dark:bg-neutral-950 border border-neutral-200 dark:border-white rounded-2xl shadow-sm overflow-hidden">
                        <div className="px-4 py-3">
                            <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100">Protocolos</h2>
                        </div>

                        <div className="p-4 flex items-center gap-2">
                            <input
                                className="flex-1 border rounded-xl px-3 py-2 text-sm"
                                placeholder="Título do protocolo..."
                                value={novoTitulo}
                                onChange={(e) => setNovoTitulo(e.target.value)}
                            />
                            <button
                                onClick={criarProtocolo}
                                className="inline-flex items-center justify-center px-3 sm:px-4 py-2 border border-transparent text-xs sm:text-sm font-medium rounded-lg text-white bg-button hover:bg-button-hover"
                            >
                                <Plus size={16} /> Criar
                            </button>
                        </div>

                        <div className="p-4 flex items-center gap-2 flex-col space-y-2 max-h-[400px] overflow-y-auto">
                            {protocolos.map((p) => (
                                <button
                                    key={p.id}
                                    onClick={() => {
                                        setProtocoloSel(p);
                                        setProtocoloSelId(p.id);
                                    }}
                                    className={`w-full text-left border rounded-xl px-3 py-2 transition-colors
                                        ${protocoloSel?.id === p.id
                                            ? "border-primary-500 bg-primary-50/40 dark:bg-primary-900/15"
                                            : "border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-900/50"
                                        }`}
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="font-semibold text-neutral-900 dark:text-neutral-100 truncate" title={p.nome}>
                                            {p.nome}
                                        </div>
                                        <span
                                            className={`text-xs font-semibold px-2 py-1 rounded-lg ${p.status === "SALVO" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                                                }`}
                                        >
                                            {p.status}
                                        </span>
                                    </div>
                                    <div className="text-xs text-gray-500 dark:text-neutral-400 mt-1">
                                        Valor final: <span className="font-semibold">{currency(Number(p.valor_final || 0))}</span>
                                    </div>
                                </button>
                            ))}

                            {!protocolos.length && (
                                <div className="text-sm text-gray-500 dark:text-neutral-400 py-6 text-center">Nenhum protocolo no mês selecionado.</div>
                            )}
                        </div>

                        {protocoloSel && (
                            <div className="mt-4 px-4 pb-4 pt-2">
                                <div className="flex gap-3">
                                    <button
                                        onClick={salvarProtocolo}
                                        className="flex-1 inline-flex items-center justify-center px-4 py-2 rounded-xl
                   bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold
                   transition-colors"
                                        title="Salvar e enviar itens para Mensal"
                                    >
                                        <Save className="h-4 w-4 mr-2" />
                                        Salvar
                                    </button>

                                    {/* <button
                                        onClick={excluirProtocolo}
                                        className="flex-1 inline-flex items-center justify-center px-4 py-2 rounded-xl
                   border border-red-300 dark:border-red-800
                   text-red-700 dark:text-red-300 text-sm font-semibold
                   hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                        title="Excluir protocolo"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button> */}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Editor protocolo */}
                    <div className="col-span-12 lg:col-span-8 bg-white border rounded-2xl shadow-sm p-4">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <h2 className="text-lg font-bold text-white">Itens do Protocolo</h2>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    disabled={!protocoloSel}
                                    onClick={exportarProtocoloSelecionado}
                                    className={`inline-flex items-center justify-center w-full sm:w-auto px-3 sm:px-4 py-2 border border-button text-xs sm:text-sm font-medium rounded-lg
                                        ${protocoloSel
                                            ? "text-button bg-white hover:bg-button-50"
                                            : "text-neutral-400 bg-neutral-100 border-neutral-200 cursor-not-allowed"
                                        }`}
                                >
                                    <Download size={16} /> Exportar XLSX
                                </button>

                                <div className="px-3 py-2 rounded-xl bg-gray-50 border text-sm">
                                    <span className="font-semibold dark:text-black">Valor final:</span>{" "}
                                    <span className="dark:text-black">{currency(valorFinalProtocolo)}</span>
                                </div>
                            </div>
                        </div>

                        {!protocoloSel ? (
                            <div className="mt-6 text-sm text-gray-500 dark:text-black text-center py-12 border rounded-xl bg-gray-50">
                                Selecione ou crie um protocolo para inserir itens.
                            </div>
                        ) : (
                            <>
                                {/* Form add */}
                                <div className="mt-4 grid grid-cols-12 gap-2 w-full">
                                    <input
                                        className="col-span-12 md:col-span-2 border rounded-xl px-3 py-2 text-sm"
                                        placeholder="Loja"
                                        value={draft.loja}
                                        onChange={(e) => setDraft((d) => ({ ...d, loja: e.target.value }))}
                                    />
                                    <input
                                        className="col-span-12 md:col-span-4 border rounded-xl px-3 py-2 text-sm"
                                        placeholder="Produto"
                                        value={draft.produto}
                                        onChange={(e) => setDraft((d) => ({ ...d, produto: e.target.value }))}
                                    />
                                    <select
                                        className="col-span-6 md:col-span-2 border rounded-xl px-3 py-2 text-sm"
                                        value={draft.prioridade}
                                        onChange={(e) => setDraft((d) => ({ ...d, prioridade: e.target.value as PcPrioridade }))}
                                    >
                                        <option value="BAIXA">Baixa</option>
                                        <option value="MEDIA">Média</option>
                                        <option value="ALTA">Alta</option>
                                    </select>
                                    <input
                                        type="number"
                                        className="px-3 py-2 border border-neutral-300 rounded-lg text-sm w-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-center"
                                        placeholder="Qtd"
                                        value={draft.quantidade}
                                        onChange={(e) => setDraft((d) => ({ ...d, quantidade: Number(e.target.value) }))}
                                    />
                                    {/* className="px-3 py-2 border border-neutral-300 rounded-lg text-sm w-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" */}
                                    <MoneyInputBRL
                                        value={draft.valor_unit}
                                        onChange={(val) => setDraft((d) => ({ ...d, valor_unit: val }))}
                                        placeholder="Valor"
                                        className="col-span-12 md:col-span-2 border rounded-xl px-3 py-2 text-sm w-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-left"
                                    />
                                    <input
                                        className="col-span-12 md:col-span-1 border rounded-xl px-3 py-2 text-sm"
                                        placeholder="Link"
                                        value={draft.link || ""}
                                        onChange={(e) => setDraft((d) => ({ ...d, link: e.target.value }))}
                                    />
                                    <button
                                        onClick={addItem}
                                        className="col-span-12 md:col-span-12 px-3 py-2 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-black transition-colors"
                                    >
                                        Adicionar item
                                    </button>
                                </div>

                                {/* Table */}
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-neutral-200 text-[11px]">
                                        <thead className="bg-neutral-50">
                                            <tr className="group hover:bg-neutral-50 dark:hover:bg-neutral-900/40 transition-colors duration-150">
                                                <th className="px-2 py-2 text-center font-medium text-neutral-500 uppercase tracking-wider">Loja</th>
                                                <th className="px-2 py-2 text-center font-medium text-neutral-500 uppercase tracking-wider w-[32%]">Produto</th>
                                                <th className="px-2 py-2 text-center font-medium text-neutral-500 uppercase tracking-wider">Prioridade</th>
                                                <th className="px-2 py-2 text-center font-medium text-neutral-500 uppercase tracking-wider">Quant</th>
                                                <th className="px-2 py-2 text-center font-medium text-neutral-500 uppercase tracking-wider">Valor</th>
                                                <th className="px-2 py-2 text-center font-medium text-neutral-500 uppercase tracking-wider">Valor Total</th>
                                                <th className="px-2 py-2 text-center font-medium text-neutral-500 uppercase tracking-wider">Link</th>
                                                <th className="px-2 py-2 text-center font-medium text-neutral-500 uppercase tracking-wider">Ações</th>
                                            </tr>
                                        </thead>

                                        <tbody className="bg-white divide-y divide-neutral-200">
                                            {itens.map((i) => (
                                                <tr key={i.id} className="group hover:bg-neutral-50 transition-colors duration-150">
                                                    <td className="px-3 py-2 border-b text-center text-neutral-900 dark:text-neutral-100">{i.loja}</td>
                                                    <td className="px-3 py-2 border-b text-center text-neutral-900 dark:text-neutral-100" title={i.produto}>{i.produto}</td>
                                                    <td className="px-3 py-2 border-b text-center text-neutral-900 dark:text-neutral-100">
                                                        <span className={prioridadeBadge(i.prioridade)}>{i.prioridade}</span>
                                                    </td>
                                                    <td className="px-3 py-2 border-b text-center text-neutral-900 dark:text-neutral-100">{Number(i.quantidade || 0)}</td>
                                                    <td className="px-3 py-2 border-b text-center text-neutral-900 dark:text-neutral-100">{currency(Number(i.valor_unit || 0))}</td>
                                                    <td className="px-3 py-2 border-b text-center text-neutral-900 dark:text-neutral-100">{currency(Number(i.valor_total || 0))}</td>

                                                    <td className="px-2 py-2 text-center w-12 ">
                                                        {i.link ? (
                                                            <a
                                                                href={i.link}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="inline-flex items-center justify-center text-primary-600 hover:text-primary-900"
                                                                title="Abrir link"
                                                            >
                                                                <ExternalLink className="h-4 w-4" />
                                                            </a>
                                                        ) : (
                                                            <span className="inline-flex items-center justify-center text-neutral-300" title="Sem link" aria-hidden="true">
                                                                <ExternalLink className="h-4 w-4" />
                                                            </span>
                                                        )}
                                                    </td>

                                                    <td className="px-2 py-2 whitespace-nowrap font-medium w-20">
                                                        <div className="flex items-center space-x-1 sm:space-x-2 justify-center">
                                                            <button
                                                                onClick={() => startEdit(i)}
                                                                className="text-primary-600 hover:text-primary-900"
                                                                title="Editar"
                                                            >
                                                                <Pencil className="h-3 w-3 sm:h-4 sm:w-4" />
                                                            </button>

                                                            <button
                                                                onClick={() => deleteItem(i.id)}
                                                                className="text-red-600 hover:text-red-900"
                                                                title="Excluir"
                                                            >
                                                                <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}

                                            {!itens.length && (
                                                <tr>
                                                    <td className="px-3 py-6 text-center text-gray-500 dark:text-neutral-400" colSpan={8}>
                                                        Sem itens neste protocolo.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                    {editItem && (
                                        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                                            <div className="w-full max-w-5xl bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xl p-4">
                                                <div className="flex items-center justify-between">
                                                    <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">Editar item</h3>
                                                    <button
                                                        onClick={() => setEditItem(null)}
                                                        className="px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-900"
                                                    >
                                                        Fechar
                                                    </button>
                                                </div>

                                                <div className="mt-4 grid grid-cols-12 gap-2">
                                                    <input
                                                        className="col-span-12 md:col-span-3 border rounded-xl px-3 py-2 text-sm bg-white dark:bg-neutral-950 dark:text-neutral-100 dark:border-neutral-800"
                                                        value={editDraft.loja}
                                                        onChange={(e) => setEditDraft((d) => ({ ...d, loja: e.target.value }))}
                                                        placeholder="Loja"
                                                    />
                                                    <input
                                                        className="col-span-12 md:col-span-4 border rounded-xl px-3 py-2 text-sm bg-white dark:bg-neutral-950 dark:text-neutral-100 dark:border-neutral-800"
                                                        value={editDraft.produto}
                                                        onChange={(e) => setEditDraft((d) => ({ ...d, produto: e.target.value }))}
                                                        placeholder="Produto"
                                                    />
                                                    <select
                                                        className="col-span-5 md:col-span-2 border rounded-xl px-3 py-2 text-sm bg-white dark:bg-neutral-950 dark:text-neutral-100 dark:border-neutral-800"
                                                        value={editDraft.prioridade}
                                                        onChange={(e) => setEditDraft((d) => ({ ...d, prioridade: e.target.value as PcPrioridade }))}
                                                    >
                                                        <option value="BAIXA">Baixa</option>
                                                        <option value="MEDIA">Média</option>
                                                        <option value="ALTA">Alta</option>
                                                    </select>
                                                    <input
                                                        type="number"
                                                        inputMode="decimal"
                                                        className="col-span-6 md:col-span-1 border rounded-xl px-2 py-2 text-sm text-right
                                                                    bg-white dark:bg-neutral-950 dark:text-neutral-100 dark:border-neutral-800
                                                                    max-w-[90px]
                                                                    appearance-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                        value={editDraft.quantidade}
                                                        onChange={(e) => setEditDraft((d) => ({ ...d, quantidade: Number(e.target.value) }))}
                                                        placeholder="Qtd"
                                                    />

                                                    <MoneyInputBRL
                                                        value={editDraft.valor_unit}
                                                        onChange={(val) => setEditDraft((d) => ({ ...d, valor_unit: val }))}
                                                        placeholder="Valor"
                                                        className="col-span-12 md:col-span-2 border dark:border-neutral-800 rounded-xl px-3 py-2 text-sm w-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-left"
                                                    />

                                                    <input
                                                        className="col-span-12 md:col-span-12 border rounded-xl px-3 py-2 text-sm bg-white dark:bg-neutral-950 dark:text-neutral-100 dark:border-neutral-800"
                                                        value={editDraft.link}
                                                        onChange={(e) => setEditDraft((d) => ({ ...d, link: e.target.value }))}
                                                        placeholder="Link do produto"
                                                    />
                                                </div>

                                                <div className="mt-4 flex justify-end gap-2">
                                                    <button
                                                        onClick={() => setEditItem(null)}
                                                        className="px-4 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-900"
                                                    >
                                                        Cancelar
                                                    </button>
                                                    <button
                                                        onClick={saveEdit}
                                                        className="px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-semibold"
                                                    >
                                                        Salvar
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
