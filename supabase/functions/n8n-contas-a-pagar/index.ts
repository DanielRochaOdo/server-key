import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-n8n-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonResponse = (body: unknown, status = 200) => new Response(
  JSON.stringify(body),
  { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
);

const isValidIsoDate = (value: unknown): value is string => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

const normalizeText = (value: unknown, maxLength: number) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return jsonResponse({ success: false, code: "METHOD_NOT_ALLOWED" }, 405);
  }

  const expectedSecret = Deno.env.get("N8N_WEBHOOK_SECRET");
  const receivedSecret = request.headers.get("x-n8n-secret");
  if (!expectedSecret || !receivedSecret || receivedSecret !== expectedSecret) {
    return jsonResponse({ success: false, code: "UNAUTHORIZED" }, 401);
  }

  let payload: Record<string, unknown>;
  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return jsonResponse({ success: false, code: "INVALID_BODY" }, 400);
    }
    payload = body as Record<string, unknown>;
  } catch {
    return jsonResponse({ success: false, code: "INVALID_JSON" }, 400);
  }

  if (payload.necessita_revisao === true) {
    return jsonResponse({ success: false, code: "REVIEW_REQUIRED" }, 422);
  }
  if (payload.necessita_revisao !== false) {
    return jsonResponse({ success: false, code: "MISSING_REVIEW_STATUS" }, 400);
  }

  const fileName = normalizeText(payload.nome_arquivo, 500);
  const explicitCode = normalizeText(payload.codigo_integracao, 20)?.toUpperCase();
  const fileCode = fileName?.match(/^\s*\[?([A-Z0-9]{1,3}-\d{3,})\]?/i)?.[1]?.toUpperCase();
  if (explicitCode && fileCode && explicitCode !== fileCode) {
    return jsonResponse({ success: false, code: "ACCOUNT_CODE_FILENAME_MISMATCH" }, 422);
  }
  const codigo = explicitCode || fileCode;
  const driveFileId = normalizeText(payload.drive_file_id, 300);
  const issuer = normalizeText(payload.empresa_emissora, 300);
  const observation = normalizeText(payload.observacao, 2000);
  const dueDate = payload.vencimento;
  const amount = payload.valor;

  if (!codigo || !/^[A-Z0-9]{1,3}-\d{3,}$/.test(codigo)) {
    return jsonResponse({ success: false, code: "ACCOUNT_CODE_NOT_FOUND_IN_FILENAME" }, 400);
  }
  if (!driveFileId) {
    return jsonResponse({ success: false, code: "MISSING_DRIVE_FILE_ID" }, 400);
  }
  if (!issuer) {
    return jsonResponse({ success: false, code: "MISSING_ISSUER" }, 400);
  }
  if (!isValidIsoDate(dueDate)) {
    return jsonResponse({ success: false, code: "INVALID_DUE_DATE" }, 400);
  }
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0 || amount > 9999999999) {
    return jsonResponse({ success: false, code: "INVALID_AMOUNT" }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Supabase function environment is missing required credentials.");
    return jsonResponse({ success: false, code: "SERVER_CONFIGURATION_ERROR" }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.rpc("aplicar_fatura_conta_a_pagar_n8n", {
    p_codigo_integracao: codigo,
    p_drive_file_id: driveFileId,
    p_empresa_emissora: issuer,
    p_vencimento: dueDate,
    p_valor: amount,
    p_observacao: observation,
  });

  if (error) {
    console.error("Failed to apply n8n invoice to accounts payable:", error.message);
    return jsonResponse({ success: false, code: "UPDATE_FAILED" }, 500);
  }

  const result = data as Record<string, unknown> | null;
  if (result?.code === "ACCOUNT_NOT_FOUND") {
    return jsonResponse({ success: false, code: "ACCOUNT_NOT_FOUND" }, 404);
  }

  return jsonResponse(result ?? { success: false, code: "EMPTY_DATABASE_RESPONSE" }, result?.success ? 200 : 422);
});
