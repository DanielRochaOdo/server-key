import React, { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { Plus, Download, ExternalLink, Save, Trash2, Pencil, Star, Mail, Loader2, FileText } from "lucide-react";
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
    diretoria: boolean;
    protocolo_item_id?: string | null;
};

type Protocolo = {
    id: string;
    titulo: string;
    nome: string; // TITULO_DD-MM-AAAA
    ano: number;
    mes: number;
    status: PcStatusProtocolo;
    valor_final: number;
    observacoes: string | null;
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
    frete: number;
    valor_total: number;
    link?: string | null;
    diretoria: boolean;
};

type ProtocoloItemDraft = Omit<ProtocoloItem, "id" | "protocolo_id" | "valor_total">;

function getNowYM() {
    const now = new Date();
    return { ano: now.getFullYear(), mes: now.getMonth() + 1 };
}

function currency(n: number) {
    return (n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function round2(n: number) {
    return Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;
}

function getMensalBaseTotal(item: MensalItem) {
    return round2(Number(item.quantidade || 0) * Number(item.valor_unit || 0));
}

function getMensalFrete(item: MensalItem) {
    return round2(Number(item.valor_total_frete || 0) - getMensalBaseTotal(item));
}

function getProtocoloItemTotal(item: ProtocoloItem) {
    return round2(Number(item.valor_total || 0) + Number(item.frete || 0));
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
    const [mensalSort, setMensalSort] = useState<{
        column: "item" | "quantidade" | "valor_unit" | "frete" | "valor_total" | "diretoria" | "status";
        direction: "asc" | "desc";
    }>({
        column: "item",
        direction: "asc",
    });

    // PROTOCOLOS
    const [protocolos, setProtocolos] = useState<Protocolo[]>([]);
    const [itens, setItens] = useState<ProtocoloItem[]>([]);
    const [novoTitulo, setNovoTitulo] = useState("");

    const [editItem, setEditItem] = useState<ProtocoloItem | null>(null);
    const [editDraft, setEditDraft] = useState<ProtocoloItemDraft>({
        loja: "",
        produto: "",
        prioridade: "MEDIA" as PcPrioridade,
        quantidade: 1,
        valor_unit: 0,
        frete: 0,
        link: "",
        diretoria: false,
    });
    const [sendingEmail, setSendingEmail] = useState(false);
    const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
    const [observacoesModalOpen, setObservacoesModalOpen] = useState(false);
    const [observacoesDraft, setObservacoesDraft] = useState("");
    const [observacoesModalProtocoloId, setObservacoesModalProtocoloId] = useState<string | null>(null);
    const [observacoesSaving, setObservacoesSaving] = useState(false);
    const [observacoesError, setObservacoesError] = useState<string | null>(null);

    // item editor protocolo
    const [draft, setDraft] = useState<ProtocoloItemDraft>({
        loja: "",
        produto: "",
        prioridade: "MEDIA",
        quantidade: 1,
        valor_unit: 0,
        frete: 0,
        link: "",
        diretoria: false,
    });

    const valorFinalProtocolo = useMemo(() => {
        return round2(itens.reduce((acc, i) => acc + getProtocoloItemTotal(i), 0));
    }, [itens]);

    const aprovadoDiretoria = useMemo(() => {
        return mensal.reduce((acc, item) => {
            if (item.diretoria && (item.status === 'ENTREGUE' || item.status === 'PEDIDO_FEITO')) {
                return acc + Number(item.valor_total_frete || 0);
            }
            return acc;
        }, 0);
    }, [mensal]);

    const saldo = useMemo(() => {
        const totalConsiderados = mensal.reduce((acc, item) => {
            if (!item.diretoria && (item.status === 'ENTREGUE' || item.status === 'PEDIDO_FEITO')) {
                return acc + Number(item.valor_total_frete || 0);
            }
            return acc;
        }, 0);
        return 2500 - totalConsiderados;
    }, [mensal]);

    const handleMensalSort = (column: "item" | "quantidade" | "valor_unit" | "frete" | "valor_total" | "diretoria" | "status") => {
        setMensalSort((prev) => {
            if (prev.column === column) {
                return { column, direction: prev.direction === "asc" ? "desc" : "asc" };
            }
            return { column, direction: "asc" };
        });
    };

    const sortedMensal = useMemo(() => {
        const list = [...mensal];
        const dir = mensalSort.direction === "asc" ? 1 : -1;
        list.sort((a, b) => {
            let aVal: string | number | boolean;
            let bVal: string | number | boolean;

            switch (mensalSort.column) {
                case "item":
                    aVal = a.item;
                    bVal = b.item;
                    break;
                case "quantidade":
                    aVal = Number(a.quantidade || 0);
                    bVal = Number(b.quantidade || 0);
                    break;
                case "valor_unit":
                    aVal = Number(a.valor_unit || 0);
                    bVal = Number(b.valor_unit || 0);
                    break;
                case "frete":
                    aVal = getMensalFrete(a);
                    bVal = getMensalFrete(b);
                    break;
                case "valor_total":
                    aVal = Number(a.valor_total_frete || 0);
                    bVal = Number(b.valor_total_frete || 0);
                    break;
                case "diretoria":
                    aVal = a.diretoria;
                    bVal = b.diretoria;
                    break;
                case "status":
                    aVal = a.status;
                    bVal = b.status;
                    break;
                default:
                    aVal = a.item;
                    bVal = b.item;
            }

            if (typeof aVal === "number" && typeof bVal === "number") {
                return (aVal - bVal) * dir;
            }

            if (typeof aVal === "boolean" && typeof bVal === "boolean") {
                return (Number(aVal) - Number(bVal)) * dir;
            }

            return aVal.toString().localeCompare(bVal.toString(), "pt-BR", { sensitivity: "base" }) * dir;
        });
        return list;
    }, [mensal, mensalSort]);

    // =============================
    // LOADERS
    // =============================
    const loadMensal = useCallback(async () => {
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
    }, [ano, mes]);

    const loadProtocolos = useCallback(async () => {
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
    }, [ano, mes]);

    useEffect(() => {
        if (!protocoloSelId) return;
        if (protocoloSel?.id === protocoloSelId) return;

        const found = protocolos.find((p) => p.id === protocoloSelId);
        if (found) setProtocoloSel(found);
    }, [protocolos, protocoloSelId]);

    const loadItens = useCallback(async (protocoloId: string) => {
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
    }, []);

    useEffect(() => {
        loadMensal();
        loadProtocolos();
    }, [loadMensal, loadProtocolos]);

    useEffect(() => {
        if (protocoloSel?.id) loadItens(protocoloSel.id);
        else setItens([]);
    }, [loadItens, protocoloSel?.id]);

    useEffect(() => {
        savePcUiState({
            tab,
            ano,
            mes,
            protocoloSelId,
        });
    }, [tab, ano, mes, protocoloSelId]);

    useEffect(() => {
        if (!toast) return;
        const timer = setTimeout(() => setToast(null), 3500);
        return () => clearTimeout(timer);
    }, [toast]);

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

    const toggleMensalDiretoria = useCallback(
        async (item: MensalItem) => {
            const nextValue = !item.diretoria;
            try {
                const { error } = await supabase
                    .from("pc_mensal_itens")
                    .update({ diretoria: nextValue })
                    .eq("id", item.id);

                if (error) throw error;

                if (item.protocolo_item_id) {
                    const { error: protoError } = await supabase
                        .from("pc_protocolo_itens")
                        .update({ diretoria: nextValue })
                        .eq("id", item.protocolo_item_id);

                    if (protoError) {
                        console.warn("Erro sincronizando diretoria protocolo:", protoError.message);
                    }
                }

                await loadMensal();
                if (item.protocolo_item_id) {
                    await loadProtocolos();
                }
            } catch (error) {
                console.error("Erro atualizando diretoria do mensal:", error);
            }
        },
        [loadMensal, loadProtocolos]
    );

    // =============================
    // ACTIONS: PROTOCOLO
    function openObservacoesModal(protocolo: Protocolo) {
        setProtocoloSel(protocolo);
        setProtocoloSelId(protocolo.id);
        setObservacoesModalProtocoloId(protocolo.id);
        setObservacoesDraft(protocolo.observacoes ?? "");
        setObservacoesError(null);
        setObservacoesSaving(false);
        setObservacoesModalOpen(true);
    }

    const handleObservacoesClick = (event: React.MouseEvent<HTMLDivElement>, protocolo: Protocolo) => {
        event.stopPropagation();
        openObservacoesModal(protocolo);
    };

    const handleObservacoesKeyDown = (event: React.KeyboardEvent<HTMLDivElement>, protocolo: Protocolo) => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            event.stopPropagation();
            openObservacoesModal(protocolo);
        }
    };

    function closeObservacoesModal() {
        setObservacoesModalOpen(false);
        setObservacoesError(null);
        setObservacoesModalProtocoloId(null);
        setObservacoesSaving(false);
    }

    async function saveObservacoes() {
        if (!observacoesModalProtocoloId) return;

        setObservacoesSaving(true);
        setObservacoesError(null);

        const trimmed = observacoesDraft.trim();
        const { error } = await supabase
            .from("pc_protocolos")
            .update({ observacoes: trimmed || null })
            .eq("id", observacoesModalProtocoloId);

        setObservacoesSaving(false);

        if (error) {
            console.error("Erro salvar observações:", error.message);
            setObservacoesError("Não foi possível salvar as observações.");
            return;
        }

        await loadProtocolos();
        closeObservacoesModal();
    }
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
            frete: Number(i.frete || 0),
            link: i.link || "",
            diretoria: i.diretoria ?? false,
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
                frete: Number(editDraft.frete || 0),
                link: (editDraft.link || "").trim() || null,
                diretoria: editDraft.diretoria,
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

    const [showSaveConfirm, setShowSaveConfirm] = useState(false);

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
        setShowSaveConfirm(true);
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
            frete: Number(draft.frete || 0),
            link: (draft.link || "").trim() || null,
            diretoria: draft.diretoria,
        };

        const { error } = await supabase.from("pc_protocolo_itens").insert([payload]);
        if (error) {
            console.error("Erro add item:", error.message);
            return;
        }

        setDraft({ loja: "", produto: "", prioridade: "MEDIA", quantidade: 1, valor_unit: 0, frete: 0, link: "", diretoria: false });
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

    const toggleDiretoria = useCallback(
    async (itemId: string, value: boolean) => {
            try {
                const { error } = await supabase
                    .from("pc_protocolo_itens")
                    .update({ diretoria: value })
                    .eq("id", itemId);

                if (error) throw error;

                const { error: mensalError } = await supabase
                    .from("pc_mensal_itens")
                    .update({ diretoria: value })
                    .eq("protocolo_item_id", itemId);

                if (mensalError) {
                    console.warn("Erro atualizando item no mensal:", mensalError.message);
                }

                if (protocoloSel?.id) {
                    await loadItens(protocoloSel.id);
                }
                await loadProtocolos();
                await loadMensal();
            } catch (error) {
                console.error("Erro ao marcar diretoria:", error);
            }
        },
        [loadItens, loadProtocolos, loadMensal, protocoloSel?.id]
    );

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
                frete: Number(i.frete || 0),
                link: i.link || "",
            })),
        });
    }

    async function enviarEmailProtocolo() {
        if (!protocoloSel || sendingEmail) return;
        setSendingEmail(true);

        try {
            const { data, error } = await supabase.functions.invoke("send-protocolo-email", {
                body: { protocoloId: protocoloSel.id },
            });

            if (error) {
                let errorMessage = "Falha ao enviar e-mail.";
                const context = (error as { context?: Response }).context;
                if (context instanceof Response) {
                    try {
                        const body = await context.json();
                        if (body?.error) {
                            errorMessage = body.error;
                        }
                    } catch {
                        // ignore response parse issues
                    }
                }
                console.error("Erro ao enviar e-mail:", error);
                setToast({ type: "error", message: errorMessage });
                return;
            }

            if (!data?.ok) {
                console.error("Resposta inesperada da function:", data);
                setToast({ type: "error", message: "Falha ao enviar e-mail." });
                return;
            }

            setToast({ type: "success", message: "E-mail enviado." });
        } catch (err) {
            console.error("Erro inesperado ao enviar e-mail:", err);
            setToast({ type: "error", message: "Falha ao enviar e-mail." });
        } finally {
            setSendingEmail(false);
        }
    }

    // =============================
    // UI
    // =============================
    return (
        <>
        <div className="space-y-6 sm:space-y-8">
            {toast && (
                <div
                    className={`fixed right-4 top-4 z-50 rounded-2xl px-4 py-3 text-xs font-semibold uppercase tracking-wide text-white shadow-lg ${
                        toast.type === "success" ? "bg-emerald-500/90" : "bg-red-500/90"
                    }`}
                    role="status"
                >
                    {toast.message}
                </div>
            )}
            {/* Header (Server-Key feel) */}
        <div className="relative rounded-2xl border border-neutral-800 bg-neutral-950/60 p-6 shadow-xl overflow-hidden">
            <div className="relative flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2 text-white">
                    <Star className="h-6 w-6 text-primary-400" />
                    <div className="flex flex-col text-left">
                        <span className="text-2xl sm:text-3xl font-bold">Pedidos de Compra</span>
                        <span className="text-xs text-neutral-400 uppercase tracking-wide">Mensal & Protocolo</span>
                    </div>
                </div>
                <div className="flex-1 grid grid-cols-2 gap-3 sm:flex sm:items-center sm:justify-end">
                    <select
                        className="w-full max-w-[90px] rounded-2xl border border-neutral-800 bg-black/40 px-2 py-1 text-xs text-white shadow-sm focus:border-primary-500"
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
                        className="w-full max-w-[70px] rounded-2xl border border-neutral-800 bg-black/40 px-2 py-1 text-xs text-white shadow-sm focus:border-primary-500"
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
                        <div className="mt-4 grid gap-3 sm:grid-cols-4">
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
                                <p className="text-xs uppercase tracking-widest text-neutral-400">Aprovado diretoria</p>
                                <p className="text-2xl font-semibold text-white">{currency(aprovadoDiretoria)}</p>
                                <p className="text-xs text-neutral-400">Itens marcados como diretoria</p>
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
                                        <th className="px-2 py-2 text-center font-semibold">
                                            <button
                                                type="button"
                                                onClick={() => handleMensalSort("item")}
                                                className="flex items-center justify-center gap-1"
                                            >
                                                Item
                                                <span className="text-neutral-400">
                                                    {mensalSort.column === "item" ? (mensalSort.direction === "asc" ? "↑" : "↓") : "↕"}
                                                </span>
                                            </button>
                                        </th>
                                        <th className="px-2 py-2 text-center font-semibold">
                                            <button
                                                type="button"
                                                onClick={() => handleMensalSort("quantidade")}
                                                className="flex items-center justify-center gap-1"
                                            >
                                                Quantidade
                                                <span className="text-neutral-400">
                                                    {mensalSort.column === "quantidade" ? (mensalSort.direction === "asc" ? "↑" : "↓") : "↕"}
                                                </span>
                                            </button>
                                        </th>
                                        <th className="px-2 py-2 text-center font-semibold">
                                            <button
                                                type="button"
                                                onClick={() => handleMensalSort("valor_unit")}
                                                className="flex items-center justify-center gap-1"
                                            >
                                                Valor Unit.
                                                <span className="text-neutral-400">
                                                    {mensalSort.column === "valor_unit" ? (mensalSort.direction === "asc" ? "↑" : "↓") : "↕"}
                                                </span>
                                            </button>
                                        </th>
                                        <th className="px-2 py-2 text-center font-semibold">
                                            <button
                                                type="button"
                                                onClick={() => handleMensalSort("frete")}
                                                className="flex items-center justify-center gap-1"
                                            >
                                                Frete
                                                <span className="text-neutral-400">
                                                    {mensalSort.column === "frete" ? (mensalSort.direction === "asc" ? "↑" : "↓") : "↕"}
                                                </span>
                                            </button>
                                        </th>
                                        <th className="px-2 py-2 text-center font-semibold">
                                            <button
                                                type="button"
                                                onClick={() => handleMensalSort("valor_total")}
                                                className="flex items-center justify-center gap-1"
                                            >
                                                Valor Total + Frete
                                                <span className="text-neutral-400">
                                                    {mensalSort.column === "valor_total" ? (mensalSort.direction === "asc" ? "↑" : "↓") : "↕"}
                                                </span>
                                            </button>
                                        </th>
                                        <th className="px-2 py-2 text-center font-semibold">
                                            <button
                                                type="button"
                                                onClick={() => handleMensalSort("diretoria")}
                                                className="flex items-center justify-center gap-1"
                                            >
                                                Diretoria
                                                <span className="text-neutral-400">
                                                    {mensalSort.column === "diretoria" ? (mensalSort.direction === "asc" ? "↑" : "↓") : "↕"}
                                                </span>
                                            </button>
                                        </th>
                                        <th className="px-2 py-2 text-center font-semibold">Setor</th>
                                        <th className="px-2 py-2 text-center font-semibold">
                                            <button
                                                type="button"
                                                onClick={() => handleMensalSort("status")}
                                                className="flex items-center justify-center gap-1"
                                            >
                                                Status
                                                <span className="text-neutral-400">
                                                    {mensalSort.column === "status" ? (mensalSort.direction === "asc" ? "↑" : "↓") : "↕"}
                                                </span>
                                            </button>
                                        </th>
                                    </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {sortedMensal.map((m) => (
                                    <tr key={m.id} className="bg-white/5 transition-colors duration-150 hover:bg-white/10">
                                        <td className="px-3 py-2 border-b border-white/5 text-left font-semibold">{m.item}</td>
                                        <td className="px-3 py-2 border-b border-white/5 text-center">{Number(m.quantidade || 0)}</td>
                                        <td className="px-3 py-2 border-b border-white/5 text-center">{currency(Number(m.valor_unit || 0))}</td>
                                        <td className="px-3 py-2 border-b border-white/5 text-center">{currency(getMensalFrete(m))}</td>
                                        <td className="px-3 py-2 border-b border-white/5 text-center">{currency(Number(m.valor_total_frete || 0))}</td>
                                        <td className="px-3 py-2 border-b border-white/5 text-center">
                                            <button
                                                onClick={() => toggleMensalDiretoria(m)}
                                                className="inline-flex items-center justify-center rounded-full border border-white/10 p-2 transition hover:border-white/40"
                                            >
                                                <Star className={`h-4 w-4 ${m.diretoria ? "text-primary-400" : "text-white/40"}`} />
                                            </button>
                                        </td>
                                        <td className="px-3 py-2 border-b border-white/5">
                                            <input
                                                className="w-full rounded-xl border border-neutral-800 bg-neutral-950/40 px-2 py-1 text-sm text-white text-center"
                                                value={m.setor ?? ""}
                                                onChange={(e) => updateMensalItem(m.id, { setor: e.target.value.toUpperCase() })}
                                                placeholder="Setor"
                                            />
                                        </td>
                                        <td className="px-3 py-2 border-b border-white/5">
                                            <select
                                                className="w-full rounded-xl border border-neutral-800 bg-neutral-950/40 px-2 py-1 text-sm text-white text-center"
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
                                        <td className="px-3 py-6 text-center text-neutral-400" colSpan={8}>
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
                            {protocolos.map((p) => {
                                const observacoesContent = (p.observacoes ?? "").trim();
                                const hasObservacoes = Boolean(observacoesContent);
                                const observacoesPreviewLimit = 15;
                                const observacoesPreview = hasObservacoes
                                    ? observacoesContent.length > observacoesPreviewLimit
                                        ? `${observacoesContent.slice(0, observacoesPreviewLimit)}...`
                                        : observacoesContent
                                    : "Sem observações";

                                return (
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
                                        <div className="text-xs text-neutral-300 mt-1 flex items-start justify-between gap-2">
                                            <div>
                                                Valor final: <span className="font-semibold">{currency(Number(p.valor_final || 0))}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span
                                                    className="text-[10px] text-neutral-400"
                                                    title={observacoesPreview}
                                                >
                                                    {observacoesPreview}
                                                </span>
                                                <div
                                                    role="button"
                                                    tabIndex={0}
                                                    onClick={(event) => handleObservacoesClick(event, p)}
                                                    onKeyDown={(event) => handleObservacoesKeyDown(event, p)}
                                                    className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/70 transition hover:border-white/40 hover:text-white cursor-pointer"
                                                    aria-label="Abrir observações"
                                                    title="Adicionar ou editar observações"
                                                >
                                                    <FileText className="h-4 w-4" />
                                                </div>
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}

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
                                    disabled={!protocoloSel || sendingEmail}
                                    onClick={enviarEmailProtocolo}
                                    className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2 text-xs font-semibold uppercase tracking-wide transition-colors
                                        ${protocoloSel && !sendingEmail
                                            ? "bg-white/10 text-white shadow-lg hover:bg-white/20"
                                            : "bg-white/5 text-white/50 cursor-not-allowed border border-white/10"
                                        }`}
                                    title="Enviar e-mail do protocolo"
                                    aria-busy={sendingEmail}
                                >
                                    {sendingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail size={16} />}
                                    {sendingEmail ? "Enviando..." : "Enviar email"}
                                </button>
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
                                <div className="mt-4 flex flex-wrap gap-2 items-center w-full mb-6">
                                    <input
                                        className="flex-1 min-w-[140px] rounded-2xl border border-neutral-800 bg-neutral-950/40 px-3 py-2 text-sm text-white shadow-sm"
                                        placeholder="Loja"
                                        value={draft.loja}
                                        onChange={(e) => setDraft((d) => ({ ...d, loja: e.target.value.toUpperCase() }))}
                                    />
                                    <input
                                        className="flex-1 min-w-[200px] rounded-2xl border border-neutral-800 bg-neutral-950/40 px-3 py-2 text-sm text-white shadow-sm"
                                        placeholder="Produto"
                                        value={draft.produto}
                                        onChange={(e) => setDraft((d) => ({ ...d, produto: e.target.value.toUpperCase() }))}
                                    />
                                    <select
                                        className="w-32 rounded-2xl border border-neutral-800 bg-neutral-950/40 px-3 py-2 text-sm text-white shadow-sm"
                                        value={draft.prioridade}
                                        onChange={(e) => setDraft((d) => ({ ...d, prioridade: e.target.value as PcPrioridade }))}
                                    >
                                        <option value="BAIXA">Baixa</option>
                                        <option value="MEDIA">Média</option>
                                        <option value="ALTA">Alta</option>
                                    </select>
                                    <input
                                        type="number"
                                        className="w-20 rounded-2xl border border-neutral-800 bg-neutral-950/40 px-3 py-2 text-center text-sm text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                        placeholder="Qtd"
                                        value={draft.quantidade}
                                        onChange={(e) => setDraft((d) => ({ ...d, quantidade: Number(e.target.value) }))}
                                    />
                                    <MoneyInputBRL
                                        value={draft.valor_unit}
                                        onChange={(val) => setDraft((d) => ({ ...d, valor_unit: val }))}
                                        placeholder="Valor"
                                        className="w-32 rounded-2xl border border-neutral-800 bg-neutral-950/40 px-3 py-2 text-sm text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    />
                                    <MoneyInputBRL
                                        value={draft.frete}
                                        onChange={(val) => setDraft((d) => ({ ...d, frete: val }))}
                                        placeholder="Frete"
                                        className="w-32 rounded-2xl border border-neutral-800 bg-neutral-950/40 px-3 py-2 text-sm text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    />
                                    <input
                                        className="flex-1 min-w-[120px] rounded-2xl border border-neutral-800 bg-neutral-950/40 px-3 py-2 text-sm text-white shadow-sm"
                                        placeholder="Link"
                                        value={draft.link || ""}
                                        onChange={(e) => setDraft((d) => ({ ...d, link: e.target.value }))}
                                    />
                                    <button
                                        onClick={() => setDraft((d) => ({ ...d, diretoria: !d.diretoria }))}
                                        className={`flex items-center gap-1 rounded-2xl border border-neutral-800 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white shadow-sm transition-colors ${
                                            draft.diretoria ? "bg-white/10" : "hover:bg-white/5"
                                        }`}
                                        aria-pressed={draft.diretoria}
                                    >
                                        <Star className="h-4 w-4 text-primary-400" aria-hidden="true" />
                                        <span className="sr-only">Diretoria</span>
                                    </button>
                                    <button
                                        onClick={addItem}
                                        className="rounded-2xl bg-button px-3 py-2 text-sm font-semibold uppercase tracking-wide text-white shadow-lg transition-colors hover:bg-button-hover"
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
                                                <th className="px-2 py-2 text-right font-semibold">Frete</th>
                                                <th className="px-2 py-2 text-right font-semibold">Total + Frete</th>
                                                <th className="px-2 py-2 text-center font-semibold">
                                                    <Star className="h-4 w-4 text-primary-400" aria-hidden="true" />
                                                    <span className="sr-only">Diretoria</span>
                                                </th>
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
                                                    <td className="px-3 py-2 border-b border-white/5 text-right">{currency(Number(i.frete || 0))}</td>
                                                    <td className="px-3 py-2 border-b border-white/5 text-right">{currency(getProtocoloItemTotal(i))}</td>
                                                    <td className="px-2 py-2 text-center">
                                                        <input
                                                            type="checkbox"
                                                            checked={i.diretoria}
                                                            onChange={(e) => toggleDiretoria(i.id, e.target.checked)}
                                                            className="h-4 w-4 rounded border-neutral-600 bg-neutral-950/40 text-primary-500 focus:ring-primary-500"
                                                        />
                                                    </td>

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
                                                    <td className="px-3 py-6 text-center text-neutral-400" colSpan={10}>
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
                                                    <MoneyInputBRL
                                                        value={editDraft.frete}
                                                        onChange={(val) => setEditDraft((d) => ({ ...d, frete: val }))}
                                                        placeholder="Frete"
                                                        className="col-span-12 md:col-span-2 rounded-2xl border border-neutral-800 bg-neutral-950/40 px-3 py-2 text-sm text-white shadow-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                    />

                                                    <input
                                                        className="col-span-12 rounded-2xl border border-neutral-800 bg-neutral-950/40 px-3 py-2 text-sm text-white shadow-sm"
                                                        value={editDraft.link}
                                                        onChange={(e) => setEditDraft((d) => ({ ...d, link: e.target.value }))}
                                                        placeholder="Link do produto"
                                                    />
                                                    <div className="col-span-12 flex items-center gap-3">
                                                        <button
                                                            type="button"
                                                            onClick={() => setEditDraft((d) => ({ ...d, diretoria: !d.diretoria }))}
                                                            className={`flex items-center gap-1 rounded-2xl border border-neutral-800 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white shadow-sm transition-colors ${
                                                                editDraft.diretoria ? "bg-white/10" : "hover:bg-white/5"
                                                            }`}
                                                            aria-pressed={editDraft.diretoria}
                                                        >
                                                            <Star className="h-4 w-4 text-primary-400" aria-hidden="true" />
                                                            <span className="sr-only">Diretoria</span>
                                                        </button>
                                                        <span className="text-xs text-neutral-400">Itens marcados como ⭐ não serão contabilizados orçamento.</span>
                                                    </div>
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

            {observacoesModalOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
                    onClick={closeObservacoesModal}
                >
                    <div
                        className="w-full max-w-xl rounded-3xl border border-neutral-800 bg-neutral-950/90 p-6 text-white shadow-2xl"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="flex items-center justify-between gap-2">
                            <div>
                                <h3 className="text-lg font-bold">Observações do protocolo</h3>
                                <p className="text-xs text-neutral-400">Sem impacto no mensal, apenas para referência aqui.</p>
                            </div>
                            <button
                                type="button"
                                onClick={closeObservacoesModal}
                                className="rounded-2xl border border-neutral-800 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/70 transition hover:border-neutral-600 hover:bg-white/10"
                            >
                                Fechar
                            </button>
                        </div>

                        <textarea
                            className="mt-4 h-36 w-full rounded-2xl border border-neutral-800 bg-neutral-950/40 px-3 py-2 text-sm text-white shadow-sm focus:border-primary-500 focus:outline-none"
                            placeholder="Adicione observações sobre este protocolo..."
                            value={observacoesDraft}
                            onChange={(event) => setObservacoesDraft(event.target.value)}
                        />

                        {observacoesError && (
                            <p className="mt-2 text-xs text-red-400">{observacoesError}</p>
                        )}

                        <div className="mt-4 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={closeObservacoesModal}
                                disabled={observacoesSaving}
                                className="rounded-2xl border border-neutral-800 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white/70 transition hover:border-neutral-600 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={saveObservacoes}
                                disabled={observacoesSaving}
                                className="rounded-2xl bg-button px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white shadow-lg transition-colors hover:bg-button-hover disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {observacoesSaving ? "Salvando..." : "Salvar"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showSaveConfirm && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
                    onClick={() => setShowSaveConfirm(false)}
                >
                    <div className="max-w-xs rounded-2xl border border-white/10 bg-neutral-900/95 px-6 py-6 text-center text-white shadow-2xl backdrop-blur-xl">
                        <p className="text-sm font-semibold uppercase tracking-wide text-white/90">Salvar confirmado</p>
                        <p className="mt-1 text-xs text-neutral-400">Protocolo salvo com sucesso.</p>
                        <p className="mt-3 text-[7px] uppercase tracking-[0.3em] text-white/60">Clique em qualquer lugar para fechar</p>
                    </div>
                </div>
            )}
        </>
    );
}
