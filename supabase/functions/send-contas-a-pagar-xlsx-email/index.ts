import { createClient } from "npm:@supabase/supabase-js@2.39.3";
import { getPublicEmailError } from "../_shared/email-public-error.ts";
import { resolveRecipients, sendEmailWithResend } from "../_shared/resend.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" });
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

const normalizeColumnKey = (value: string) =>
  value
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const normalizeRole = (role?: string | null) => {
  if (!role) return "";
  const value = role
    .toString()
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

const parseNumericValue = (value: unknown) => {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const cleaned = value.replace(/[^\d,.-]/g, "");
    if (!cleaned) return null;
    const hasComma = cleaned.includes(",");
    const normalized = hasComma
      ? cleaned.replace(/\./g, "").replace(",", ".")
      : cleaned;
    const numeric = Number(normalized);
    return Number.isFinite(numeric) ? numeric : null;
  }
  return null;
};

const normalizeUrl = (value: unknown) => {
  if (!value) return "";
  const trimmed = value.toString().trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return "";
};

const formatDateValue = (value: unknown) => {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) return trimmed;
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const [year, month, day] = trimmed.split("-");
      return `${day}/${month}/${year}`;
    }
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return dateFormatter.format(parsed);
    }
  }
  if (typeof value === "number") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return dateFormatter.format(parsed);
    }
  }
  return null;
};

const formatCellValue = (column: string, value: unknown) => {
  const columnKey = normalizeColumnKey(column);
  const isMoneyColumn = columnKey.includes("valor");
  const isDateColumn = columnKey.includes("vencimento") ||
    columnKey.includes("data");

  if (value === null || value === undefined || value === "") {
    return "&mdash;";
  }

  const urlValue = normalizeUrl(value);
  if (urlValue) {
    return `<a href="${
      escapeHtml(urlValue)
    }" target="_blank" rel="noreferrer">Abrir</a>`;
  }

  if (isMoneyColumn) {
    const numeric = parseNumericValue(value);
    if (numeric !== null) {
      return currencyFormatter.format(numeric);
    }
  }

  if (isDateColumn) {
    const formattedDate = formatDateValue(value);
    if (formattedDate) return escapeHtml(formattedDate);
  }

  return escapeHtml(value.toString());
};

const handleRequest = async (req: Request) => {
  const requestId = crypto.randomUUID();
  const requestStartedAt = performance.now();

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    const message = "Método não permitido.";
    return jsonResponse(
      {
        success: false,
        code: "METHOD_NOT_ALLOWED",
        message,
      },
      405,
    );
  }

  let body: {
    subject?: string;
    columns?: unknown;
    rows?: unknown;
    meta?: unknown;
    recipients?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    console.warn("email_send_validation_error", {
      requestId,
      functionName: "send-contas-a-pagar-xlsx-email",
      reason: "invalid_json",
    });
    return validationErrorResponse();
  }

  const authHeader = req.headers.get("authorization") ||
    req.headers.get("Authorization");
  const token = authHeader && authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : "";

  if (!token) {
    const message = "É necessário estar autenticado para enviar este e-mail.";
    return jsonResponse(
      {
        success: false,
        code: "UNAUTHORIZED",
        message,
      },
      401,
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("email_send_configuration_error", {
      requestId,
      functionName: "send-contas-a-pagar-xlsx-email",
      configuration: "supabase",
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

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data: authData, error: authError } = await supabase.auth.getUser(
    token,
  );
  if (authError || !authData?.user) {
    console.warn("email_send_authentication_failed", {
      requestId,
      functionName: "send-contas-a-pagar-xlsx-email",
    });
    const message = "É necessário estar autenticado para enviar este e-mail.";
    return jsonResponse(
      {
        success: false,
        code: "UNAUTHORIZED",
        message,
      },
      401,
    );
  }

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("id, role, modules, is_active")
    .eq("auth_uid", authData.user.id)
    .single();

  if (profileError || !profile) {
    console.warn("email_send_authorization_failed", {
      requestId,
      functionName: "send-contas-a-pagar-xlsx-email",
      userId: authData.user.id,
      reason: "profile_unavailable",
    });
    const message = "Você não possui permissão para enviar este e-mail.";
    return jsonResponse(
      {
        success: false,
        code: "FORBIDDEN",
        message,
      },
      403,
    );
  }

  const role = normalizeRole(profile.role);
  const hasAccess = profile.is_active === true &&
    (role === "admin" || role === "owner");
  if (!hasAccess) {
    console.warn("email_send_authorization_failed", {
      requestId,
      functionName: "send-contas-a-pagar-xlsx-email",
      userId: authData.user.id,
      reason: "insufficient_permissions",
    });
    const message = "Você não possui permissão para enviar este e-mail.";
    return jsonResponse(
      {
        success: false,
        code: "FORBIDDEN",
        message,
      },
      403,
    );
  }

  const meta = body?.meta ?? null;
  if (
    meta !== null &&
    (typeof meta !== "object" || Array.isArray(meta))
  ) {
    return validationErrorResponse();
  }

  const metaLoteId = meta && "loteId" in meta
    ? (meta as Record<string, unknown>).loteId
    : undefined;
  if (
    metaLoteId !== undefined &&
    (typeof metaLoteId !== "string" || !UUID_PATTERN.test(metaLoteId.trim()))
  ) {
    return validationErrorResponse();
  }
  const relatedRecordId = typeof metaLoteId === "string"
    ? metaLoteId.trim()
    : null;

  const columnsRaw = Array.isArray(body?.columns) ? body.columns : [];
  const columns = columnsRaw
    .map((column) => (column ?? "").toString().trim())
    .filter((column) => column);

  if (!columns.length) {
    return validationErrorResponse();
  }

  const defaultRecipients = ["daniel.rocha@odontoart.com"];
  const recipientsResult = resolveRecipients(
    body?.recipients,
    defaultRecipients,
  );
  if (!recipientsResult.success) {
    return validationErrorResponse();
  }
  const recipients = recipientsResult.recipients;

  if (!Array.isArray(body?.rows)) {
    return validationErrorResponse();
  }

  const rowsRaw = body.rows as unknown[];
  if (!rowsRaw.every((row) => Array.isArray(row))) {
    return validationErrorResponse();
  }
  const rows = rowsRaw as unknown[][];

  console.log("email_send_started", {
    requestId,
    functionName: "send-contas-a-pagar-xlsx-email",
    emailType: "contas_a_pagar",
    recordId: relatedRecordId,
    userId: authData.user.id,
    rowCount: rows.length,
  });

  const MAX_ROWS = 2000;
  const totalRows = rows.length;
  const isPartial = totalRows > MAX_ROWS;
  const limitedRows = isPartial ? rows.slice(0, MAX_ROWS) : rows;

  const rowsHtml = limitedRows
    .map((row) => {
      const normalizedRow = columns.map((_, index) => (row[index] ?? null));
      const cells = normalizedRow
        .map((value, index) => {
          const column = columns[index];
          const columnKey = normalizeColumnKey(column);
          const isMoneyColumn = columnKey.includes("valor");
          const isDateColumn = columnKey.includes("vencimento") ||
            columnKey.includes("data");
          const align = isMoneyColumn
            ? "right"
            : isDateColumn
            ? "center"
            : "left";
          return `<td align="${align}">${formatCellValue(column, value)}</td>`;
        })
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");

  const headerCells = columns
    .map((column) => `<th align="left">${escapeHtml(column)}</th>`)
    .join("");

  const htmlTable = `
    <table border="0" cellpadding="8" cellspacing="0" width="100%" style="border-collapse:collapse">
      <thead>
        <tr style="background:#f4f4f4;">
          ${headerCells}
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
  `;

  const partialNote = isPartial
    ? `<p><em>(parcial) Exibindo ${MAX_ROWS} de ${totalRows} linhas.</em></p>`
    : "";

  const htmlBody = `
    <p>Olá,</p>
    <p>Segue abaixo contas a pagar:</p>
    ${partialNote}
    ${htmlTable}
  `;

  const buildProtocolSubject = () => {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, "0");
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const year = now.getFullYear();
    return `PROTOCOLO TI CONTAS A PAGAR ${day}-${month}-${year}`;
  };

  const subject = buildProtocolSubject();
  const requestedSubject = typeof body.subject === "string"
    ? body.subject.replace(/[\r\n]+/g, " ").trim()
    : "";
  if (
    body.subject !== undefined &&
    (!requestedSubject || requestedSubject.length > 998)
  ) {
    return validationErrorResponse();
  }

  const sendResult = await sendEmailWithResend({
    to: recipients,
    subject: requestedSubject || subject,
    html: htmlBody,
  });

  if (!sendResult.success) {
    const publicError = getPublicEmailError(sendResult);

    console.error("email_send_failed", {
      requestId,
      functionName: "send-contas-a-pagar-xlsx-email",
      emailType: "contas_a_pagar",
      recordId: relatedRecordId,
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
    functionName: "send-contas-a-pagar-xlsx-email",
    emailType: "contas_a_pagar",
    recordId: relatedRecordId,
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
      functionName: "send-contas-a-pagar-xlsx-email",
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
