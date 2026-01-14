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
        const totalConsiderados = mensal.reduce((acc, item) => {
            if (item.status === 'ENTREGUE' || item.status === 'PEDIDO_FEITO') {
                return acc + Number(item.valor_total_frete || 0);
            }
            return acc;
        }, 0);
        return 2500 - totalConsiderados;
    }, [mensal]);

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
        <div className="relative rounded-2xl border border-neutral-800 bg-neutral-950/60 p-6 shadow-xl overflow-hidden">
            <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1 text-white">
                    <h1 className="text-2xl sm:text-3xl font-bold">Pedidos de Compra</h1>
                    <p className="text-sm text-neutral-300">MENSAL (controle do mês) e PROTOCOLO (pedidos por título)</p>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:flex sm:items-center">
                    <select
                        className="w-full min-w-[110px] rounded-2xl border border-neutral-800 bg-black/40 px-3 py-2 text-sm text-white shadow-sm focus:border-primary-500"
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
                        className="w-full min-w-[110px] rounded-2xl border border-neutral-800 bg-black/40 px-3 py-2 text-sm text-white shadow-sm focus:border-primary-500"
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
        </div>

            {/* Tabs */}
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-1 flex gap-2 overflow-hidden">
            <button
                onClick={() => setTab("MENSAL")}
                className={`flex-1 rounded-xl px-4 py-2 text-xs sm:text-sm font-semibold transition-colors duration-150
                    ${tab === "MENSAL"
                        ? "bg-button text-white shadow-lg"
                        : "bg-neutral-950/90 text-neutral-300 hover:bg-neutral-900/80"
                    }`}
            >
                Mensal
            </button>

            <button
                onClick={() => setTab("PROTOCOLO")}
                className={`flex-1 rounded-xl px-4 py-2 text-xs sm:text-sm font-semibold transition-colors duration-150
                    ${tab === "PROTOCOLO"
                        ? "bg-button text-white shadow-lg"
                        : "bg-neutral-950/90 text-neutral-300 hover:bg-neutral-900/80"
                    }`}
            >
                Protocolo
            </button>
        </div>

            {/* ================= MENSAL ================= */}
            {tab === "MENSAL" && (
                <div className="mt-4 overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/70 shadow-xl text-white">
                    <div className="border-b border-neutral-800 px-4 py-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <h2 className="text-lg font-bold">Compras do mês</h2>
                            <p className="text-sm text-neutral-400">Dados mensais consultados com base no mês selecionado.</p>
                        </div>
                        <div className="mt-4 grid gap-3 sm:grid-cols-3">
                            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                <p className="text-xs uppercase tracking-widest text-neutral-400">Total Aprovado</p>
                                <p className="text-2xl font-semibold text-white">{currency(totais?.total_aprovado ?? 0)}</p>
                                <p className="text-xs text-neutral-400">Aprovações do mês corrente</p>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                <p className="text-xs uppercase tracking-widest text-neutral-400">Total Entregue</p>
                                <p className="text-2xl font-semibold text-white">{currency(totais?.total_entregue ?? 0)}</p>
                                <p className="text-xs text-neutral-400">Atualizado automaticamente</p>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                <p className="text-xs uppercase tracking-widest text-neutral-400">Saldo Restante</p>
                                <p className={`text-2xl font-semibold ${saldo < 0 ? "text-red-500" : "text-emerald-400"}`}>{currency(saldo)}</p>
                                <p className="text-xs text-neutral-400">Base R$ 2.500,00</p>
                            </div>
                        </div>
                    </div>

                    <div className="overflow-x-auto p-4">
                        <table className="min-w-full divide-y divide-white/5 text-[11px] text-white">
                            <thead>
                                <tr className="text-[10px] uppercase tracking-wider text-neutral-400">
                                    <th className="px-2 py-2 text-left font-semibold">Item</th>
                                    <th className="px-2 py-2 text-right font-semibold">Quantidade</th>
                                    <th className="px-2 py-2 text-right font-semibold">Valor Unit.</th>
                                    <th className="px-2 py-2 text-right font-semibold">Valor Total + Frete</th>
                                    <th className="px-2 py-2 text-center font-semibold">Setor</th>
                                    <th className="px-2 py-2 text-center font-semibold">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {mensal.map((m) => (
                                    <tr key={m.id} className="bg-white/5 transition-colors duration-150 hover:bg-white/10">
                                        <td className="px-3 py-2 border-b border-white/5 text-left font-semibold">{m.item}</td>
                                        <td className="px-3 py-2 border-b border-white/5 text-right">{Number(m.quantidade || 0)}</td>
                                        <td className="px-3 py-2 border-b border-white/5 text-right">{currency(Number(m.valor_unit || 0))}</td>
                                        <td className="px-3 py-2 border-b border-white/5 text-right">{currency(Number(m.valor_total_frete || 0))}</td>
                                        <td className="px-3 py-2 border-b border-white/5">
                                            <input
                                                className="w-full rounded-xl border border-neutral-800 bg-neutral-950/40 px-2 py-1 text-sm text-white"
                                                value={m.setor ?? ""}
                                                onChange={(e) => updateMensalItem(m.id, { setor: e.target.value.toUpperCase() })}
                                                placeholder="Setor"
                                            />
                                        </td>
                                        <td className="px-3 py-2 border-b border-white/5">
                                            <select
                                                className="w-full rounded-xl border border-neutral-800 bg-neutral-950/40 px-2 py-1 text-sm text-white"
                                                value={m.status}
                                                onChange={(e) => updateMensalItem(m.id, { status: e.target.value as PcStatusMensal })}
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
                                        <td className="px-3 py-6 text-center text-neutral-400" colSpan={6}>
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
                <div className="grid grid-cols-12 gap-6 mt-4">
                <div className="col-span-12 lg:col-span-4 rounded-2xl border border-neutral-800 bg-neutral-900/70 text-white shadow-xl overflow-hidden">
                        <div className="px-4 py-3">
                            <h2 className="text-base font-bold text-white">Protocolos</h2>
                            <p className="mt-1 text-xs text-neutral-400">Gerencie títulos e envie itens para o mensal.</p>
                        </div>

                        <div className="p-4 space-y-2">
                            <input
                                className="w-full rounded-2xl border border-neutral-800 bg-neutral-950/40 px-3 py-2 text-sm text-white shadow-sm"
                                placeholder="Título do protocolo..."
                                value={novoTitulo}
                                onChange={(e) => setNovoTitulo(e.target.value.toUpperCase())}
                            />
                            <button
                                onClick={criarProtocolo}
                                className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-button px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition-colors hover:bg-button-hover"
                            >
                                <Plus size={16} /> Criar protocolo
                            </button>
                        </div>

                        <div className="p-4 space-y-3 max-h-[400px] overflow-y-auto">
                            {protocolos.map((p) => (
                                <button
                                    key={p.id}
                                    onClick={() => {
                                        setProtocoloSel(p);
                                        setProtocoloSelId(p.id);
                                    }}
                                    className={`w-full rounded-2xl border px-3 py-2 text-left transition-all
                                        ${protocoloSel?.id === p.id
                                            ? "border-primary-500 bg-primary-600/20 text-white shadow-inner"
                                            : "border-neutral-800 bg-white/5 text-neutral-200 hover:bg-white/10"
                                        }`}
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="font-semibold text-white truncate" title={p.nome}>
                                            {p.nome}
                                        </div>
                                        <span
                                            className={`text-xs font-semibold px-2 py-1 rounded-lg ${p.status === "SALVO" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                                                }`}
                                        >
                                            {p.status}
                                        </span>
                                    </div>
                                    <div className="text-xs text-neutral-300 mt-1">
                                        Valor final: <span className="font-semibold">{currency(Number(p.valor_final || 0))}</span>
                                    </div>
                                </button>
                            ))}

                            {!protocolos.length && (
                                <div className="text-sm text-gray-500 dark:text-neutral-400 py-6 text-center">Nenhum protocolo no mês selecionado.</div>
                            )}
                        </div>

                        {protocoloSel && (
                            <div className="mt-4 space-y-2 px-4 pb-4 pt-2">
                                <div className="flex flex-col gap-2 sm:flex-row">
                                    <button
                                        onClick={salvarProtocolo}
                                        className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-button px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white shadow-lg transition-colors hover:bg-button-hover"
                                        title="Salvar e enviar itens para Mensal"
                                    >
                                        <Save className="h-4 w-4" />
                                        Salvar
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Editor protocolo */}
                    <div className="col-span-12 lg:col-span-8 rounded-2xl border border-neutral-800 bg-neutral-900/70 text-white shadow-xl px-4 py-3">
                        <div className="flex items-center justify-between gap-3 text-sm">
                            <div>
                                <h2 className="text-lg font-bold text-white">Itens do Protocolo</h2>
                            </div>

                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                <button
                                    disabled={!protocoloSel}
                                    onClick={exportarProtocoloSelecionado}
                                    className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2 text-xs font-semibold uppercase tracking-wide transition-colors
                                        ${protocoloSel
                                            ? "bg-button text-white shadow-lg hover:bg-button-hover"
                                            : "bg-white/5 text-white/50 cursor-not-allowed border border-white/10"
                                        }`}
                                >
                                    <Download size={16} /> Exportar XLSX
                                </button>

                                <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm">
                                    <span className="text-neutral-300">Valor final:</span>{" "}
                                    <span className="font-semibold text-white">{currency(valorFinalProtocolo)}</span>
                                </div>
                            </div>
                        </div>

                        {!protocoloSel ? (
                            <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 px-6 py-8 text-center text-sm text-neutral-300">
                                Selecione ou crie um protocolo para inserir itens.
                            </div>
                        ) : (
                            <>
                                {/* Form add */}
                                <div className="mt-4 grid grid-cols-12 gap-2 w-full mb-6">
                                    <input
                                        className="col-span-12 md:col-span-2 rounded-2xl border border-neutral-800 bg-neutral-950/40 px-3 py-2 text-sm text-white shadow-sm"
                                        placeholder="Loja"
                                        value={draft.loja}
                                        onChange={(e) => setDraft((d) => ({ ...d, loja: e.target.value.toUpperCase() }))}
                                    />
                                    <input
                                        className="col-span-12 md:col-span-4 rounded-2xl border border-neutral-800 bg-neutral-950/40 px-3 py-2 text-sm text-white shadow-sm"
                                        placeholder="Produto"
                                        value={draft.produto}
                                        onChange={(e) => setDraft((d) => ({ ...d, produto: e.target.value.toUpperCase() }))}
                                    />
                                    <select
                                        className="col-span-6 md:col-span-2 rounded-2xl border border-neutral-800 bg-neutral-950/40 px-3 py-2 text-sm text-white shadow-sm"
                                        value={draft.prioridade}
                                        onChange={(e) => setDraft((d) => ({ ...d, prioridade: e.target.value as PcPrioridade }))}
                                    >
                                        <option value="BAIXA">Baixa</option>
                                        <option value="MEDIA">Média</option>
                                        <option value="ALTA">Alta</option>
                                    </select>
                                    <input
                                        type="number"
                                        className="rounded-2xl border border-neutral-800 bg-neutral-950/40 px-3 py-2 text-center text-sm text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                        placeholder="Qtd"
                                        value={draft.quantidade}
                                        onChange={(e) => setDraft((d) => ({ ...d, quantidade: Number(e.target.value) }))}
                                    />
                                    <MoneyInputBRL
                                        value={draft.valor_unit}
                                        onChange={(val) => setDraft((d) => ({ ...d, valor_unit: val }))}
                                        placeholder="Valor"
                                        className="col-span-12 md:col-span-2 rounded-2xl border border-neutral-800 bg-neutral-950/40 px-3 py-2 text-sm text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    />
                                    <input
                                        className="col-span-12 md:col-span-1 rounded-2xl border border-neutral-800 bg-neutral-950/40 px-3 py-2 text-sm text-white shadow-sm"
                                        placeholder="Link"
                                        value={draft.link || ""}
                                        onChange={(e) => setDraft((d) => ({ ...d, link: e.target.value }))}
                                    />
                                    <button
                                        onClick={addItem}
                                        className="col-span-12 rounded-2xl bg-button px-3 py-2 text-sm font-semibold uppercase tracking-wide text-white shadow-lg transition-colors hover:bg-button-hover"
                                    >
                                        Adicionar item
                                    </button>
                                </div>

                                {/* Table */}
                                <div className="overflow-x-auto p-4 rounded-2xl border border-white/10">
                                    <table className="min-w-full divide-y divide-white/5 text-[11px] text-white">
                                        <thead>
                                            <tr className="text-[10px] uppercase tracking-wider text-neutral-400">
                                                <th className="px-2 py-2 text-left font-semibold">Loja</th>
                                                <th className="px-2 py-2 text-left font-semibold w-[32%]">Produto</th>
                                                <th className="px-2 py-2 text-center font-semibold">Prioridade</th>
                                                <th className="px-2 py-2 text-right font-semibold">Quant</th>
                                                <th className="px-2 py-2 text-right font-semibold">Valor</th>
                                                <th className="px-2 py-2 text-right font-semibold">Valor Total</th>
                                                <th className="px-2 py-2 text-center font-semibold">Link</th>
                                                <th className="px-2 py-2 text-center font-semibold">Ações</th>
                                            </tr>
                                        </thead>

                                        <tbody className="divide-y divide-white/5">
                                            {itens.map((i) => (
                                                <tr key={i.id} className="bg-white/5 transition-colors duration-150 hover:bg-white/10">
                                                    <td className="px-3 py-2 border-b border-white/5 text-left font-semibold">{i.loja}</td>
                                                    <td className="px-3 py-2 border-b border-white/5 text-left text-sm" title={i.produto}>{i.produto}</td>
                                                    <td className="px-3 py-2 border-b border-white/5 text-center">
                                                        <span className={prioridadeBadge(i.prioridade)}>{i.prioridade}</span>
                                                    </td>
                                                    <td className="px-3 py-2 border-b border-white/5 text-right">{Number(i.quantidade || 0)}</td>
                                                    <td className="px-3 py-2 border-b border-white/5 text-right">{currency(Number(i.valor_unit || 0))}</td>
                                                    <td className="px-3 py-2 border-b border-white/5 text-right">{currency(Number(i.valor_total || 0))}</td>

                                                    <td className="px-2 py-2 text-center w-12">
                                                        {i.link ? (
                                                            <a
                                                                href={i.link}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="inline-flex items-center justify-center text-white/70 transition hover:text-white"
                                                                title="Abrir link"
                                                            >
                                                                <ExternalLink className="h-4 w-4" />
                                                            </a>
                                                        ) : (
                                                            <span className="inline-flex items-center justify-center text-white/30" title="Sem link" aria-hidden="true">
                                                                <ExternalLink className="h-4 w-4" />
                                                            </span>
                                                        )}
                                                    </td>

                                                    <td className="px-2 py-2 whitespace-nowrap font-medium w-20">
                                                        <div className="flex items-center justify-center gap-2">
                                                            <button
                                                                onClick={() => startEdit(i)}
                                                                className="text-button hover:text-button-hover"
                                                                title="Editar"
                                                            >
                                                                <Pencil className="h-4 w-4" />
                                                            </button>

                                                            <button
                                                                onClick={() => deleteItem(i.id)}
                                                                className="text-red-500 hover:text-red-400"
                                                                title="Excluir"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}

                                            {!itens.length && (
                                                <tr>
                                                    <td className="px-3 py-6 text-center text-neutral-400" colSpan={8}>
                                                        Sem itens neste protocolo.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                    {editItem && (
                                        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                                            <div className="w-full max-w-4xl rounded-3xl border border-neutral-800 bg-neutral-950/90 text-white shadow-2xl p-5">
                                                <div className="flex items-center justify-between">
                                                    <h3 className="text-lg font-bold text-white">Editar item</h3>
                                                    <button
                                                        onClick={() => setEditItem(null)}
                                                        className="rounded-2xl border border-neutral-800 bg-white/5 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white/70 hover:border-neutral-600 hover:bg-white/10 transition"
                                                    >
                                                        Fechar
                                                    </button>
                                                </div>

                                                <div className="mt-4 grid grid-cols-12 gap-2">
                                                    <input
                                                        className="col-span-12 md:col-span-3 rounded-2xl border border-neutral-800 bg-neutral-950/40 px-3 py-2 text-sm text-white shadow-sm"
                                                        value={editDraft.loja}
                                                        onChange={(e) => setEditDraft((d) => ({ ...d, loja: e.target.value.toUpperCase() }))}
                                                        placeholder="Loja"
                                                    />
                                                    <input
                                                        className="col-span-12 md:col-span-4 rounded-2xl border border-neutral-800 bg-neutral-950/40 px-3 py-2 text-sm text-white shadow-sm"
                                                        value={editDraft.produto}
                                                        onChange={(e) => setEditDraft((d) => ({ ...d, produto: e.target.value.toUpperCase() }))}
                                                        placeholder="Produto"
                                                    />
                                                    <select
                                                        className="col-span-5 md:col-span-2 rounded-2xl border border-neutral-800 bg-neutral-950/40 px-3 py-2 text-sm text-white shadow-sm"
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
                                                        className="col-span-6 md:col-span-1 rounded-2xl border border-neutral-800 bg-neutral-950/40 px-2 py-2 text-sm text-right text-white shadow-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                        value={editDraft.quantidade}
                                                        onChange={(e) => setEditDraft((d) => ({ ...d, quantidade: Number(e.target.value) }))}
                                                        placeholder="Qtd"
                                                    />

                                                    <MoneyInputBRL
                                                        value={editDraft.valor_unit}
                                                        onChange={(val) => setEditDraft((d) => ({ ...d, valor_unit: val }))}
                                                        placeholder="Valor"
                                                        className="col-span-12 md:col-span-2 rounded-2xl border border-neutral-800 bg-neutral-950/40 px-3 py-2 text-sm text-white shadow-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                    />

                                                    <input
                                                        className="col-span-12 rounded-2xl border border-neutral-800 bg-neutral-950/40 px-3 py-2 text-sm text-white shadow-sm"
                                                        value={editDraft.link}
                                                        onChange={(e) => setEditDraft((d) => ({ ...d, link: e.target.value }))}
                                                        placeholder="Link do produto"
                                                    />
                                                </div>

                                                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
                                                    <button
                                                        onClick={() => setEditItem(null)}
                                                        className="rounded-2xl border border-neutral-800 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white/70 hover:border-neutral-600 hover:bg-white/10 transition"
                                                    >
                                                        Cancelar
                                                    </button>
                                                    <button
                                                        onClick={saveEdit}
                                                        className="rounded-2xl bg-button px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white shadow-lg transition-colors hover:bg-button-hover"
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
