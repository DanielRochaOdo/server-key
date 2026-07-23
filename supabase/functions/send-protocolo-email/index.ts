import { createClient } from "npm:@supabase/supabase-js@2.39.3";
import { getPublicEmailError } from "../_shared/email-public-error.ts";
import { resolveRecipients, sendEmailWithResend } from "../_shared/resend.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const validationErrorResponse = () =>
  jsonResponse(
    {
      success: false,
      code: "VALIDATION_ERROR",
      message: "Os dados informados para o envio são inválidos.",
    },
    400,
  );

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

  const parseHttpUrl = (candidate: string) => {
    try {
      const parsed = new URL(candidate);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return "";
      }
      return parsed.toString();
    } catch {
      return "";
    }
  };

  if (/^https?:\/\//i.test(trimmed)) {
    return parseHttpUrl(trimmed);
  }

  if (/^(www\.|[\w-]+\.[\w.-]+)/i.test(trimmed)) {
    return parseHttpUrl(`https://${trimmed}`);
  }

  return "";
};

const handleRequest = async (req: Request) => {
  const requestId = crypto.randomUUID();
  const requestStartedAt = performance.now();

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(
      {
        success: false,
        code: "METHOD_NOT_ALLOWED",
        message: "Método não permitido.",
      },
      405,
    );
  }

  const authHeader = req.headers.get("authorization") ||
    req.headers.get("Authorization");
  if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
    return jsonResponse(
      {
        success: false,
        code: "UNAUTHORIZED",
        message: "É necessário estar autenticado para enviar este e-mail.",
      },
      401,
    );
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return jsonResponse(
      {
        success: false,
        code: "UNAUTHORIZED",
        message: "É necessário estar autenticado para enviar este e-mail.",
      },
      401,
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("email_send_configuration_error", {
      requestId,
      functionName: "send-protocolo-email",
      configuration: "supabase",
    });
    return jsonResponse(
      {
        success: false,
        code: "INTERNAL_ERROR",
        message: "Não foi possível processar a solicitação.",
      },
      500,
    );
  }

  let body: {
    protocoloId?: unknown;
    recipients?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    console.warn("email_send_validation_error", {
      requestId,
      functionName: "send-protocolo-email",
      reason: "invalid_json",
    });
    return validationErrorResponse();
  }

  const protocoloId = typeof body?.protocoloId === "string"
    ? body.protocoloId.trim()
    : "";
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(
    token,
  );
  if (authError || !authData?.user) {
    console.warn("email_send_authentication_failed", {
      requestId,
      functionName: "send-protocolo-email",
    });
    return jsonResponse(
      {
        success: false,
        code: "UNAUTHORIZED",
        message: "É necessário estar autenticado para enviar este e-mail.",
      },
      401,
    );
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("users")
    .select("id, role, modules, is_active")
    .eq("auth_uid", authData.user.id)
    .single();

  if (profileError || !profile) {
    console.warn("email_send_authorization_failed", {
      requestId,
      functionName: "send-protocolo-email",
      userId: authData.user.id,
      reason: "profile_unavailable",
    });
    return jsonResponse(
      {
        success: false,
        code: "FORBIDDEN",
        message: "Você não possui permissão para enviar este e-mail.",
      },
      403,
    );
  }

  const role = normalizeRole(profile.role);
  const modules = Array.isArray(profile.modules) ? profile.modules : [];
  const hasAccess = profile.is_active === true &&
    (role === "admin" || role === "owner" ||
      modules.includes("pedidos_de_compra"));
  if (!hasAccess) {
    console.warn("email_send_authorization_failed", {
      requestId,
      functionName: "send-protocolo-email",
      userId: authData.user.id,
      reason: "insufficient_permissions",
    });
    return jsonResponse(
      {
        success: false,
        code: "FORBIDDEN",
        message: "Você não possui permissão para enviar este e-mail.",
      },
      403,
    );
  }

  if (!UUID_PATTERN.test(protocoloId)) {
    return validationErrorResponse();
  }

  const defaultRecipients = [
    "daniel.rocha@odontoart.com",
    "ryanmendes@odontoart.com",
  ];
  const recipientsResult = resolveRecipients(
    body?.recipients,
    defaultRecipients,
  );
  if (!recipientsResult.success) {
    return validationErrorResponse();
  }
  const recipients = recipientsResult.recipients;

  console.log("email_send_started", {
    requestId,
    functionName: "send-protocolo-email",
    emailType: "pedido_compra",
    recordId: protocoloId,
  });

  console.log("email_send_user_validated", {
    requestId,
    functionName: "send-protocolo-email",
    userId: authData.user.id,
    emailType: "pedido_compra",
    recordId: protocoloId,
  });

  const { data: protocolo, error: protocoloError } = await supabaseAdmin
    .from("pc_protocolos")
    .select("id, titulo, valor_final, observacoes")
    .eq("id", protocoloId)
    .single();

  if (protocoloError || !protocolo) {
    console.warn("email_send_validation_error", {
      requestId,
      functionName: "send-protocolo-email",
      reason: "record_not_found",
      recordId: protocoloId,
    });
    return validationErrorResponse();
  }

  const { data: itens, error: itensError } = await supabaseAdmin
    .from("pc_protocolo_itens")
    .select(
      "loja, produto, prioridade, quantidade, valor_unit, frete, valor_total, link",
    )
    .eq("protocolo_id", protocoloId)
    .order("created_at", { ascending: true });

  if (itensError) {
    console.error("email_send_data_error", {
      requestId,
      functionName: "send-protocolo-email",
      operation: "load_items",
      recordId: protocoloId,
    });
    return jsonResponse(
      {
        success: false,
        code: "INTERNAL_ERROR",
        message: "Não foi possível processar a solicitação.",
      },
      500,
    );
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
        .filter(Boolean),
    ),
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
        ? `<a href="${
          escapeHtml(link)
        }" target="_blank" rel="noreferrer">Abrir</a>`
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
  const observacoes = String((protocolo as ProtocoloRow).observacoes || "")
    .trim();
  const subjectDate = formatDateBr(new Date());
  const htmlBody = `
    <p>Ol&aacute;,</p>
    <p>Segue abaixo pedido de compra:</p>
    <p><strong>${escapeHtml(titulo)}</strong> &mdash; Valor total: ${
    currencyFormatter.format(totalBase)
  }</p>
    ${
    observacoes
      ? `<p><strong>Observa&ccedil;&atilde;o:</strong> ${
        escapeHtml(observacoes)
      }</p>`
      : ""
  }
    <p>Prioridades: ${escapeHtml(priorities || "N/D")}</p>
    ${htmlTable}
    <p style="margin-top:16px;"><strong>Valor final:</strong> ${
    currencyFormatter.format(totalBase)
  }</p>
  `;

  const subject = `Pedido de Compra - ${titulo} | ${subjectDate}`.replace(
    /[\r\n]+/g,
    " ",
  ).trim();

  const sendResult = await sendEmailWithResend({
    to: recipients,
    subject,
    html: htmlBody,
  });

  if (!sendResult.success) {
    const publicError = getPublicEmailError(sendResult);

    console.error("email_send_failed", {
      requestId,
      functionName: "send-protocolo-email",
      emailType: "pedido_compra",
      recordId: protocoloId,
      userId: authData.user.id,
      errorKind: sendResult.kind,
      providerCategory: sendResult.providerCategory,
      providerStatus: sendResult.providerStatus,
      providerDurationMs: sendResult.durationMs,
      durationMs: Math.round(performance.now() - requestStartedAt),
    });

    return jsonResponse(
      {
        success: false,
        code: publicError.code,
        message: publicError.message,
      },
      publicError.status,
    );
  }

  console.log("email_send_succeeded", {
    requestId,
    functionName: "send-protocolo-email",
    emailType: "pedido_compra",
    recordId: protocoloId,
    userId: authData.user.id,
    providerStatus: sendResult.providerStatus,
    emailId: sendResult.emailId,
    providerDurationMs: sendResult.durationMs,
    durationMs: Math.round(performance.now() - requestStartedAt),
  });

  return jsonResponse(
    {
      success: true,
      message: "E-mail enviado com sucesso.",
      emailId: sendResult.emailId,
    },
    200,
  );
};

Deno.serve(async (req) => {
  try {
    return await handleRequest(req);
  } catch {
    console.error("email_send_unexpected_error", {
      functionName: "send-protocolo-email",
    });
    const message = "Não foi possível processar a solicitação.";
    return jsonResponse(
      {
        success: false,
        code: "INTERNAL_ERROR",
        message,
      },
      500,
    );
  }
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
