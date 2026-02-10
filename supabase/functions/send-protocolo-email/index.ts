import { createClient } from "npm:@supabase/supabase-js@2.39.3";
import nodemailer from "npm:nodemailer@6.9.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type ProtocoloRow = {
  id: string;
  titulo: string;
  valor_final?: number | null;
  observacoes?: string | null;
};

type ProtocoloItemRow = {
  loja: string | null;
  produto: string | null;
  prioridade: string | null;
  quantidade: number | null;
  valor_unit: number | null;
  frete: number | null;
  valor_total: number | null;
  link?: string | null;
};

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const numberFormatter = new Intl.NumberFormat("pt-BR");

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const normalizeRole = (role?: string | null) => {
  if (!role) return "";
  const value = role
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (value === "administrador") return "admin";
  if (value === "admin") return "admin";
  if (value === "owner") return "owner";
  if (value === "financeiro") return "financeiro";
  if (value === "usuario") return "usuario";
  return value;
};

const sanitizeUrl = (value?: string | null) => {
  const trimmed = (value || "").trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return "";
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
  }

  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
    return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const smtpHost = Deno.env.get("SMTP_HOST");
  const smtpPortValue = Deno.env.get("SMTP_PORT");
  const smtpUser = Deno.env.get("SMTP_USER");
  const smtpPass = Deno.env.get("SMTP_PASS");
  const smtpFrom = Deno.env.get("SMTP_FROM");

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Missing Supabase environment variables.");
    return jsonResponse({ ok: false, error: "Server configuration error" }, 500);
  }

  if (!smtpHost || !smtpPortValue || !smtpUser || !smtpPass || !smtpFrom) {
    console.error("Missing SMTP environment variables.");
    return jsonResponse({ ok: false, error: "Server configuration error" }, 500);
  }

  const smtpPort = Number(smtpPortValue);
  if (!Number.isFinite(smtpPort)) {
    console.error("Invalid SMTP port.");
    return jsonResponse({ ok: false, error: "Server configuration error" }, 500);
  }

  let body: { protocoloId?: string };
  try {
    body = await req.json();
  } catch (error) {
    console.error("Invalid JSON body:", error);
    return jsonResponse({ ok: false, error: "Invalid request body" }, 400);
  }

  const protocoloId = typeof body?.protocoloId === "string" ? body.protocoloId.trim() : "";
  if (!protocoloId) {
    return jsonResponse({ ok: false, error: "Missing protocoloId" }, 400);
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  console.log("send-protocolo-email: validating user");
  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData?.user) {
    console.error("Auth error:", authError);
    return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("users")
    .select("id, role, modules, is_active")
    .eq("auth_uid", authData.user.id)
    .single();

  if (profileError || !profile) {
    console.error("Profile error:", profileError);
    return jsonResponse({ ok: false, error: "Forbidden" }, 403);
  }

  const role = normalizeRole(profile.role);
  const modules = Array.isArray(profile.modules) ? profile.modules : [];
  const hasAccess =
    profile.is_active === true &&
    (role === "admin" || role === "owner" || modules.includes("pedidos_de_compra"));
  if (!hasAccess) {
    console.error("Access denied for user:", authData.user.id);
    return jsonResponse({ ok: false, error: "Forbidden" }, 403);
  }

  console.log("send-protocolo-email: loading protocolo", protocoloId);
  const { data: protocolo, error: protocoloError } = await supabaseAdmin
    .from("pc_protocolos")
    .select("id, titulo, valor_final, observacoes")
    .eq("id", protocoloId)
    .single();

  if (protocoloError || !protocolo) {
    console.error("Protocolo error:", protocoloError);
    return jsonResponse({ ok: false, error: "Protocolo not found" }, 404);
  }

  const { data: itens, error: itensError } = await supabaseAdmin
    .from("pc_protocolo_itens")
    .select("loja, produto, prioridade, quantidade, valor_unit, frete, valor_total, link")
    .eq("protocolo_id", protocoloId)
    .order("created_at", { ascending: true });

  if (itensError) {
    console.error("Itens error:", itensError);
    return jsonResponse({ ok: false, error: "Failed to load itens" }, 500);
  }

  const items = (itens ?? []) as ProtocoloItemRow[];
  const totalFromItems = items.reduce((acc, item) => {
    const quantidade = Number(item.quantidade || 0);
    const valorUnit = Number(item.valor_unit || 0);
    const valorBase = Number(item.valor_total || 0) || quantidade * valorUnit;
    const frete = Number(item.frete || 0);
    return acc + valorBase + frete;
  }, 0);

  const protocoloTotal = Number((protocolo as ProtocoloRow).valor_final || 0);
  const totalBase = protocoloTotal > 0 ? protocoloTotal : totalFromItems;

  const priorities = Array.from(
    new Set(
      items
        .map((item) => (item.prioridade || "").toString().trim())
        .filter(Boolean)
    )
  ).join(", ");

  const rows = items
    .map((item) => {
      const loja = escapeHtml(item.loja || "");
      const produto = escapeHtml(item.produto || "");
      const prioridade = escapeHtml(item.prioridade || "N/D");
      const quantidade = Number(item.quantidade || 0);
      const valorUnit = Number(item.valor_unit || 0);
      const frete = Number(item.frete || 0);
      const valorBase = Number(item.valor_total || 0) || quantidade * valorUnit;
      const valorTotal = valorBase + frete;
      const link = sanitizeUrl(item.link);
      const linkCell = link
        ? `<a href="${escapeHtml(link)}" target="_blank" rel="noreferrer">Abrir</a>`
        : "&mdash;";

      return `
        <tr>
          <td align="left">${loja}</td>
          <td align="left">${produto}</td>
          <td align="left">${prioridade}</td>
          <td align="center">${numberFormatter.format(quantidade)}</td>
          <td align="right">${currencyFormatter.format(valorUnit)}</td>
          <td align="right">${currencyFormatter.format(frete)}</td>
          <td align="right">${currencyFormatter.format(valorTotal)}</td>
          <td align="left">${linkCell}</td>
        </tr>
      `;
    })
    .join("");

  const htmlTable = `
    <table border="0" cellpadding="8" cellspacing="0" width="100%" style="border-collapse:collapse">
      <thead>
        <tr style="background:#f4f4f4;">
          <th align="left">Loja</th>
          <th align="left">Produto</th>
          <th align="left">Prioridade</th>
          <th align="center">Qtd</th>
          <th align="right">Valor Unit.</th>
          <th align="right">Frete</th>
          <th align="right">Valor Total + Frete</th>
          <th align="left">Link</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;

  const titulo = ((protocolo as ProtocoloRow).titulo || "").toString();
  const observacoes = String((protocolo as ProtocoloRow).observacoes || "").trim();
  const subjectDate = formatDateBr(new Date());
  const htmlBody = `
    <p>Ol&aacute;,</p>
    <p>Segue abaixo pedido de compra:</p>
    <p><strong>${escapeHtml(titulo)}</strong> &mdash; Valor total: ${currencyFormatter.format(totalBase)}</p>
    ${observacoes ? `<p><strong>Observa&ccedil;&atilde;o:</strong> ${escapeHtml(observacoes)}</p>` : ""}
    <p>Prioridades: ${escapeHtml(priorities || "N/D")}</p>
    ${htmlTable}
    <p style="margin-top:16px;"><strong>Valor final:</strong> ${currencyFormatter.format(totalBase)}</p>
  `;

  const subject = `Pedido de Compra - ${titulo} | ${subjectDate}`.replace(/[\r\n]+/g, " ").trim();
  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000,
  });

  console.log("send-protocolo-email: sending email");
  try {
    await transporter.sendMail({
      from: smtpFrom,
      to: ["daniel.rocha@odontoart.com", "ryanmendes@odontoart.com"],
      subject,
      html: htmlBody,
    });
  } catch (error) {
    console.error("SMTP send error:", error);
    return jsonResponse({ ok: false, error: "Failed to send email" }, 500);
  }

  console.log("send-protocolo-email: done");
  return jsonResponse({ ok: true }, 200);
});

function formatDateBr(value: Date) {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(value);

  const day = parts.find((p) => p.type === "day")?.value ?? "00";
  const month = parts.find((p) => p.type === "month")?.value ?? "00";
  const year = parts.find((p) => p.type === "year")?.value ?? "0000";
  return `${day}-${month}-${year}`;
}
