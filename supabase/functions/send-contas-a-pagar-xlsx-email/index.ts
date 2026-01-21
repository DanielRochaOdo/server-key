import { createClient } from "npm:@supabase/supabase-js@2.39.3";
import nodemailer from "npm:nodemailer@6.9.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" });

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

const normalizeColumnKey = (value: string) =>
  value
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const parseNumericValue = (value: unknown) => {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const cleaned = value.replace(/[^\d,.-]/g, "");
    if (!cleaned) return null;
    const hasComma = cleaned.includes(",");
    const normalized = hasComma ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned;
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
  const isDateColumn = columnKey.includes("vencimento") || columnKey.includes("data");

  if (value === null || value === undefined || value === "") {
    return "&mdash;";
  }

  const urlValue = normalizeUrl(value);
  if (urlValue) {
    return `<a href="${escapeHtml(urlValue)}" target="_blank" rel="noreferrer">Abrir</a>`;
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
  const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const smtpHost = Deno.env.get("SMTP_HOST");
  const smtpPortValue = Deno.env.get("SMTP_PORT");
  const smtpUser = Deno.env.get("SMTP_USER");
  const smtpPass = Deno.env.get("SMTP_PASS");
  const smtpFrom = Deno.env.get("SMTP_FROM");

  if (!supabaseUrl || !supabaseKey) {
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

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData?.user) {
    console.error("Auth error:", authError);
    return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
  }

  let body: { subject?: string; columns?: unknown; rows?: unknown; meta?: unknown };
  try {
    body = await req.json();
  } catch (error) {
    console.error("Invalid JSON body:", error);
    return jsonResponse({ ok: false, error: "Invalid request body" }, 400);
  }

  const columnsRaw = Array.isArray(body?.columns) ? body.columns : [];
  const columns = columnsRaw
    .map((column) => (column ?? "").toString().trim())
    .filter((column) => column);

  if (!columns.length) {
    return jsonResponse({ ok: false, error: "Missing columns" }, 400);
  }

  if (!Array.isArray(body?.rows)) {
    return jsonResponse({ ok: false, error: "Missing rows" }, 400);
  }

  const rowsRaw = body.rows as unknown[];
  if (!rowsRaw.every((row) => Array.isArray(row))) {
    return jsonResponse({ ok: false, error: "Invalid rows" }, 400);
  }
  const rows = rowsRaw as unknown[][];

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
          const isDateColumn = columnKey.includes("vencimento") || columnKey.includes("data");
          const align = isMoneyColumn ? "right" : isDateColumn ? "center" : "left";
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

  console.log("send-contas-a-pagar-xlsx-email: sending email");
  try {
    await transporter.sendMail({
      from: smtpFrom,
      to: "daniel.rocha@odontoart.com",
      subject,
      html: htmlBody,
    });
  } catch (error) {
    console.error("SMTP send error:", error);
    return jsonResponse({ ok: false, error: "Failed to send email" }, 500);
  }

  console.log("send-contas-a-pagar-xlsx-email: done");
  return jsonResponse({ ok: true }, 200);
});
