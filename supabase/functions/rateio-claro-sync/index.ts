import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type DiffType = "CRIAR" | "ATUALIZAR" | "AUSENTE_NA_PLANILHA";

type PlanilhaRow = {
  numero_da_linha: string;
  nome: string;
  line?: number;
};

type HubRow = {
  id: string;
  nome: string | null;
  numero_linha: string | null;
  status?: string | null;
};

type DiffItem = {
  numero_da_linha: string;
  tipo: DiffType;
  planilha: { nome: string } | null;
  hub: { id: string; nome_completo: string | null; status?: string | null } | null;
};

type ValidationError = {
  duplicates: { numero: string; lines: number[] }[];
  invalidRows: { line: number; value: unknown }[];
  emptyNames: { line: number; numero_da_linha: string }[];
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const buildSummary = (diffs: DiffItem[]) =>
  diffs.reduce(
    (acc, item) => {
      if (item.tipo === "CRIAR") acc.criar += 1;
      if (item.tipo === "ATUALIZAR") acc.atualizar += 1;
      if (item.tipo === "AUSENTE_NA_PLANILHA") acc.ausentes += 1;
      return acc;
    },
    { criar: 0, atualizar: 0, ausentes: 0 }
  );

const normalizeRole = (role?: string | null) => {
  if (!role) return "";
  const value = role
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (value === "administrador") return "admin";
  if (value === "admin") return "admin";
  if (value === "financeiro") return "financeiro";
  if (value === "usuario") return "usuario";
  return value;
};

const normalizeNameForCompare = (value?: string | null) => {
  if (!value) return "";
  return value
    .toString()
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
};

const normalizeNumero = (value: unknown) => {
  if (value === null || value === undefined) return { ok: false, numero: "" };

  const normalizeDigits = (rawValue: string) => {
    let normalized = rawValue.replace(/^0+(?=\d)/, "");
    if (normalized.startsWith("55") && normalized.length > 11) {
      const withoutCountry = normalized.slice(2);
      if (withoutCountry.length >= 10 && withoutCountry.length <= 11) {
        normalized = withoutCountry.replace(/^0+(?=\d)/, "");
      }
    }
    if (!normalized || normalized === "0") return "";
    return normalized;
  };

  if (typeof value === "number") {
    if (!Number.isFinite(value)) return { ok: false, numero: "" };
    const intValue = Math.trunc(value);
    if (intValue <= 0) return { ok: false, numero: "" };
    const normalized = normalizeDigits(String(intValue));
    return normalized ? { ok: true, numero: normalized } : { ok: false, numero: "" };
  }

  const raw = value.toString().trim();
  if (!raw) return { ok: false, numero: "" };

  const compact = raw.replace(/\s+/g, "");

  const parsedFromNumber = (() => {
    let candidate = compact;

    if (/e/i.test(candidate)) {
      if (candidate.includes(",") && !candidate.includes(".")) {
        candidate = candidate.replace(/,/g, ".");
      }
      const num = Number(candidate);
      if (Number.isFinite(num)) return Math.trunc(num);
    }

    if (candidate.includes(".") && candidate.includes(",")) {
      const lastDot = candidate.lastIndexOf(".");
      const lastComma = candidate.lastIndexOf(",");
      if (lastComma > lastDot) {
        candidate = candidate.replace(/\./g, "").replace(/,/g, ".");
      } else {
        candidate = candidate.replace(/,/g, "");
      }
      const num = Number(candidate);
      if (Number.isFinite(num)) return Math.trunc(num);
    }

    if (candidate.includes(",") || candidate.includes(".")) {
      const sep = candidate.includes(",") ? "," : ".";
      const parts = candidate.split(sep);
      if (parts.length === 2 && /^\d+$/.test(parts[0]) && /^\d+$/.test(parts[1])) {
        const num = Number(`${parts[0]}.${parts[1]}`);
        if (Number.isFinite(num)) return Math.trunc(num);
      }
    }

    return null;
  })();

  if (parsedFromNumber && parsedFromNumber > 0) {
    const normalized = normalizeDigits(String(parsedFromNumber));
    return normalized ? { ok: true, numero: normalized } : { ok: false, numero: "" };
  }

  const digits = compact.replace(/\D/g, "");
  if (!digits) return { ok: false, numero: "" };
  const normalized = normalizeDigits(digits);
  if (!normalized) return { ok: false, numero: "" };
  return { ok: true, numero: normalized };
};

const buildPlanilhaHash = (numero: string, planilhaRowByNumero: Map<string, PlanilhaRow>) => {
  const row = planilhaRowByNumero.get(numero);
  if (!row) return "ABSENT";
  const nameNorm = normalizeNameForCompare(row.nome || "");
  return `PRESENT:${nameNorm}`;
};

const normalizeHeaderValue = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const mapHeader = (value: string): "nome" | "numero_da_linha" | null => {
  const normalized = normalizeHeaderValue(value);
  if (normalized.includes("nome completo") || normalized === "nome" || normalized.includes("nomecompleto")) {
    return "nome";
  }
  if (normalized.includes("numero") && normalized.includes("linha")) {
    return "numero_da_linha";
  }
  if (normalized.includes("numero_da_linha")) return "numero_da_linha";
  return null;
};

const parseSheetRange = (range: string) => {
  const trimmed = (range || "").trim();
  const [sheetNameRaw, a1Raw] = trimmed.split("!");
  const sheetName = a1Raw ? sheetNameRaw.trim() : "";
  const a1 = a1Raw ? a1Raw : sheetNameRaw;
  const start = (a1 || "").split(":")[0] || "";
  const match = start.match(/\d+/);
  const startRow = match ? Number.parseInt(match[0], 10) : 1;
  return { sheetName, startRow };
};

const normalizePrivateKey = (raw: string) => {
  const trimmed = (raw || "").trim();
  if (!trimmed) return "";
  return trimmed.includes("\\n") ? trimmed.replaceAll("\\n", "\n") : trimmed;
};

const decodeJwtPayload = (token: string) => {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const json = atob(padded);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
};

const formatJwtExp = (exp?: unknown) => {
  if (typeof exp !== "number") return null;
  const date = new Date(exp * 1000);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

const base64UrlEncode = (data: Uint8Array) => {
  const b64 = btoa(String.fromCharCode(...data));
  return b64.replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
};

const signJwtRS256 = async (message: string, privateKeyPem: string) => {
  const pem = privateKeyPem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replaceAll("\n", "")
    .trim();

  const keyData = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyData.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, new TextEncoder().encode(message));
  return base64UrlEncode(new Uint8Array(sig));
};

const getGoogleAccessToken = async (params: { clientEmail: string; privateKey: string; scope: string }) => {
  const { clientEmail, privateKey, scope } = params;
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 3600;

  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: clientEmail,
    scope,
    aud: "https://oauth2.googleapis.com/token",
    iat,
    exp,
  };

  const enc = new TextEncoder();
  const signingInput =
    `${base64UrlEncode(enc.encode(JSON.stringify(header)))}.${base64UrlEncode(enc.encode(JSON.stringify(payload)))}`;
  const signature = await signJwtRS256(signingInput, privateKey);
  const assertion = `${signingInput}.${signature}`;

  const form = new URLSearchParams();
  form.set("grant_type", "urn:ietf:params:oauth:grant-type:jwt-bearer");
  form.set("assertion", assertion);

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(`Google token error (${res.status}): ${JSON.stringify(data)}`);
  }
  const token = (data as any)?.access_token;
  if (!token) throw new Error("Google token error: missing access_token");
  return String(token);
};

const fetchSheetValues = async (sheetId: string, range: string) => {
  const apiKey = (Deno.env.get("GOOGLE_SHEETS_API_KEY") || "").trim();
  console.log("rateio-claro-sync: sheets config", {
    hasApiKey: Boolean(apiKey),
    sheetIdLength: sheetId.length,
    range: range || null,
  });
  const url = new URL(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}`);

  if (apiKey) {
    url.searchParams.set("key", apiKey);
    const res = await fetch(url.toString());
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(`Sheets API error (${res.status}): ${JSON.stringify(data)}`);
    }
    return (data as any)?.values as string[][] | undefined;
  }

  const clientEmail = (Deno.env.get("GOOGLE_SHEETS_CLIENT_EMAIL") || "").trim();
  const privateKey = normalizePrivateKey(Deno.env.get("GOOGLE_SHEETS_PRIVATE_KEY") || "");

  if (!clientEmail || !privateKey) {
    throw new Error("Missing GOOGLE_SHEETS_CLIENT_EMAIL/GOOGLE_SHEETS_PRIVATE_KEY or GOOGLE_SHEETS_API_KEY");
  }

  const accessToken = await getGoogleAccessToken({
    clientEmail,
    privateKey,
    scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
  });

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(`Sheets API error (${res.status}): ${JSON.stringify(data)}`);
  }
  return (data as any)?.values as string[][] | undefined;
};

const parseSheetRows = (values: string[][] | undefined, sheetRange?: string) => {
  if (!values || !values.length) return [] as Record<string, unknown>[];
  const { startRow } = parseSheetRange(sheetRange || "");
  const headerMap = values[0].map((value) => mapHeader(String(value || "")));
  const hasHeader = headerMap.some((value) => value !== null);
  const dataRows = hasHeader ? values.slice(1) : values;

  return dataRows
    .filter((row) => row.some((cell) => String(cell ?? "").trim() !== ""))
    .map((row, index) => {
      const lineNumber = startRow + index + (hasHeader ? 1 : 0);
      if (hasHeader) {
        const record: Record<string, unknown> = { _line: lineNumber };
        row.forEach((cell, colIndex) => {
          const key = headerMap[colIndex];
          if (key) record[key] = cell;
        });
        return record;
      }
      return {
        nome: row[0],
        numero_da_linha: row[1],
        _line: lineNumber,
      };
    });
};

const buildPlanilhaRows = (rawRows: unknown[]) => {
  const rows: PlanilhaRow[] = [];
  const invalidRows: { line: number; value: unknown }[] = [];
  const emptyNames: { line: number; numero_da_linha: string }[] = [];
  const seen = new Map<string, number[]>();

  rawRows.forEach((raw, index) => {
    if (!raw || typeof raw !== "object") {
      invalidRows.push({ line: index + 1, value: raw });
      return;
    }
    const row = raw as Record<string, unknown>;
    const line = typeof row._line === "number" ? row._line : index + 1;
    const numeroRaw = row.numero_da_linha ?? row.numero_linha ?? row.numero ?? row.linha;
    const nomeRaw = row.nome ?? row.nome_completo ?? row.name ?? row.full_name;

    const numeroParsed = normalizeNumero(numeroRaw);
    if (!numeroParsed.ok) {
      invalidRows.push({ line, value: numeroRaw });
      return;
    }

    const numero = numeroParsed.numero;
    const lines = seen.get(numero) || [];
    lines.push(line);
    seen.set(numero, lines);
    if (lines.length > 1) {
      return;
    }

    const nome = (nomeRaw ?? "").toString();
    const trimmedNome = nome.trim();
    if (!trimmedNome) {
      emptyNames.push({ line, numero_da_linha: numero });
    }

    rows.push({ numero_da_linha: numero, nome: trimmedNome, line });
  });

  const duplicates = Array.from(seen.entries())
    .filter(([, lines]) => lines.length > 1)
    .map(([numero, lines]) => ({ numero, lines }));

  return { rows, duplicates, invalidRows, emptyNames };
};

const computeDiffs = (planilhaRows: PlanilhaRow[], hubRows: HubRow[]) => {
  const hubMap = new Map<string, HubRow>();
  hubRows.forEach((row) => {
    const numeroParsed = normalizeNumero(row.numero_linha);
    if (!numeroParsed.ok) return;
    const numero = numeroParsed.numero;
    if (!hubMap.has(numero)) {
      hubMap.set(numero, { ...row, numero_linha: numero });
    }
  });

  const planilhaMap = new Map<string, PlanilhaRow>();
  planilhaRows.forEach((row) => {
    planilhaMap.set(row.numero_da_linha, row);
  });

  const diffs: DiffItem[] = [];

  for (const row of planilhaRows) {
    const hub = hubMap.get(row.numero_da_linha);
    if (!hub) {
      diffs.push({
        numero_da_linha: row.numero_da_linha,
        tipo: "CRIAR",
        planilha: { nome: row.nome },
        hub: null,
      });
      continue;
    }

    const hubNome = hub.nome ?? "";
    const planilhaNorm = normalizeNameForCompare(row.nome);
    const hubNorm = normalizeNameForCompare(hubNome);
    const needsUpdate = planilhaNorm !== hubNorm || hub.status === "inactive";

    if (needsUpdate) {
      diffs.push({
        numero_da_linha: row.numero_da_linha,
        tipo: "ATUALIZAR",
        planilha: { nome: row.nome },
        hub: { id: hub.id, nome_completo: hubNome, status: hub.status ?? null },
      });
    }
  }

  for (const hub of hubMap.values()) {
    const numeroParsed = normalizeNumero(hub.numero_linha);
    if (!numeroParsed.ok) continue;
    const numero = numeroParsed.numero;
    if (!planilhaMap.has(numero)) {
      diffs.push({
        numero_da_linha: numero,
        tipo: "AUSENTE_NA_PLANILHA",
        planilha: null,
        hub: { id: hub.id, nome_completo: hub.nome ?? "", status: hub.status ?? null },
      });
    }
  }

  const summary = diffs.reduce(
    (acc, item) => {
      if (item.tipo === "CRIAR") acc.criar += 1;
      if (item.tipo === "ATUALIZAR") acc.atualizar += 1;
      if (item.tipo === "AUSENTE_NA_PLANILHA") acc.ausentes += 1;
      return acc;
    },
    { criar: 0, atualizar: 0, ausentes: 0 }
  );

  return { diffs, summary };
};

const toHex = (buffer: ArrayBuffer) =>
  Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

const hashPlanilha = async (planilhaRows: PlanilhaRow[]) => {
  const encoder = new TextEncoder();
  const payload = JSON.stringify(planilhaRows);
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(payload));
  return toHex(digest);
};

const getActionFromUrl = (url: URL) => {
  const segments = url.pathname.split("/").filter(Boolean);
  if (!segments.length) return "";
  const last = segments[segments.length - 1];
  if (last === "preview" || last === "apply") return last;
  const action = url.searchParams.get("action");
  if (action === "preview" || action === "apply") return action;
  return "";
};

const resolvePlanilhaRows = async (bodyRows?: unknown) => {
  if (Array.isArray(bodyRows) && bodyRows.length > 0) {
    return bodyRows;
  }

  const sheetId = (Deno.env.get("RATEIO_CLARO_SHEET_ID") || "").trim();
  const sheetRange = (Deno.env.get("RATEIO_CLARO_SHEET_RANGE") || "").trim();
  if (!sheetId || !sheetRange) {
    console.error("rateio-claro-sync: missing sheet env", {
      hasSheetId: Boolean(sheetId),
      hasSheetRange: Boolean(sheetRange),
    });
    throw new Error("Missing RATEIO_CLARO_SHEET_ID/RATEIO_CLARO_SHEET_RANGE");
  }

  const values = await fetchSheetValues(sheetId, sheetRange);
  return parseSheetRows(values, sheetRange);
};

const loadOverrides = async (supabase: ReturnType<typeof createClient>, numeros: string[]) => {
  const overrides = new Map<string, string>();
  if (!numeros.length) return overrides;
  const { data, error } = await supabase
    .from("rateio_claro_sync_overrides")
    .select("numero_linha, planilha_hash")
    .in("numero_linha", numeros);

  if (error) {
    if (error.code !== "42P01") {
      console.error("rateio-claro-sync: failed to load overrides", error);
    }
    return overrides;
  }

  (data || []).forEach((row: any) => {
    if (row?.numero_linha && row?.planilha_hash) {
      overrides.set(String(row.numero_linha), String(row.planilha_hash));
    }
  });

  return overrides;
};

const applyOverridesToDiffs = (
  diffs: DiffItem[],
  overrides: Map<string, string>,
  planilhaRowByNumero: Map<string, PlanilhaRow>
) => {
  if (!overrides.size) return diffs;
  return diffs.filter((diff) => {
    const stored = overrides.get(diff.numero_da_linha);
    if (!stored) return true;
    const currentHash = buildPlanilhaHash(diff.numero_da_linha, planilhaRowByNumero);
    return stored !== currentHash;
  });
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
  }

  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");

  const url = new URL(req.url);
  const actionFromUrl = getActionFromUrl(url);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Missing Supabase environment variables.");
    return jsonResponse({ ok: false, error: "Server configuration error" }, 500);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let body: {
    action?: string;
    planilhaRows?: unknown;
    options?: { onMissingInSheet?: string };
    sessionToken?: string;
    selection?: {
      criar?: string[];
      atualizar?: string[];
      ausentes?: string[];
      manter?: string[];
    };
  } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch (error) {
    console.error("Invalid JSON body:", error);
    return jsonResponse({ ok: false, error: "Invalid request body" }, 400);
  }

  const tokenFromHeader =
    authHeader && authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
  const tokenFromBody = typeof body.sessionToken === "string" ? body.sessionToken.trim() : "";
  const token = tokenFromHeader || tokenFromBody;

  console.log("rateio-claro-sync: auth header present?", Boolean(authHeader), "token in body?", Boolean(tokenFromBody));

  if (!token) {
    return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
  }

  const tokenPayload = decodeJwtPayload(token);
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData?.user) {
    console.error("Auth error:", authError, {
      tokenExp: formatJwtExp(tokenPayload?.exp),
      tokenAud: tokenPayload?.aud ?? null,
      tokenIss: tokenPayload?.iss ?? null,
    });
    return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
  }

  const { data: profile, error: profileError } = await supabase
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
    modules.includes("rateio_claro") &&
    (role === "admin" || role === "financeiro");

  if (!hasAccess) {
    console.error("Access denied for user:", authData.user.id);
    return jsonResponse({ ok: false, error: "Forbidden" }, 403);
  }

  const action =
    actionFromUrl || (body.action === "preview" || body.action === "apply" ? body.action : "");
  if (!action) {
    return jsonResponse({ ok: false, error: "Route not found" }, 404);
  }

  let rawRows: unknown[] = [];
  try {
    rawRows = (await resolvePlanilhaRows(body.planilhaRows)) as unknown[];
  } catch (error: any) {
    console.error("rateio-claro-sync: failed to load planilha", error);
    return jsonResponse({ ok: false, error: error?.message || "Failed to load planilha" }, 400);
  }

  const { rows: planilhaRows, duplicates, invalidRows, emptyNames } = buildPlanilhaRows(rawRows);
  const validationErrors: ValidationError = { duplicates, invalidRows, emptyNames };
  if (duplicates.length || invalidRows.length) {
    return jsonResponse(
      {
        ok: false,
        error: "Invalid planilhaRows",
        details: validationErrors,
      },
      400
    );
  }

  if (!planilhaRows.length) {
    console.error("rateio-claro-sync: planilha vazia");
    return jsonResponse({ ok: false, error: "Planilha vazia" }, 400);
  }

  let statusSupported = true;
  let hubRows: HubRow[] = [];
  const { data: hubRowsWithStatus, error: hubError } = await supabase
    .from("rateio_claro")
    .select("id, nome, numero_linha, status");

  if (hubError) {
    if (hubError.code === "42703") {
      statusSupported = false;
      const { data: hubRowsNoStatus, error: hubErrorNoStatus } = await supabase
        .from("rateio_claro")
        .select("id, nome, numero_linha");
      if (hubErrorNoStatus) {
        console.error("Error fetching rateio_claro without status:", hubErrorNoStatus);
        return jsonResponse({ ok: false, error: "Failed to load hub data" }, 500);
      }
      hubRows = (hubRowsNoStatus as HubRow[]) || [];
    } else {
      console.error("Error fetching rateio_claro:", hubError);
      return jsonResponse({ ok: false, error: "Failed to load hub data" }, 500);
    }
  } else {
    hubRows = hubRowsWithStatus || [];
  }

  const { diffs, summary } = computeDiffs(planilhaRows, hubRows || []);
  const planilhaRowByNumero = new Map<string, PlanilhaRow>();
  planilhaRows.forEach((row) => {
    planilhaRowByNumero.set(row.numero_da_linha, row);
  });

  if (action === "preview") {
    const overrideMap = await loadOverrides(
      supabase,
      diffs.map((diff) => diff.numero_da_linha)
    );
    const filteredDiffs = applyOverridesToDiffs(diffs, overrideMap, planilhaRowByNumero);
    const filteredSummary = buildSummary(filteredDiffs);
    return jsonResponse({ diffs: filteredDiffs, summary: filteredSummary, warnings: { nomesVazios: emptyNames } });
  }

  const selection = body.selection;
  let selectedDiffs = diffs;
  let manterSet = new Set<string>();
  if (selection) {
    const criarSet = new Set((selection.criar || []).map((n) => String(n)));
    const atualizarSet = new Set((selection.atualizar || []).map((n) => String(n)));
    const ausentesSet = new Set((selection.ausentes || []).map((n) => String(n)));
    manterSet = new Set((selection.manter || []).map((n) => String(n)));
    selectedDiffs = diffs.filter((diff) => {
      if (diff.tipo === "CRIAR") return criarSet.has(diff.numero_da_linha);
      if (diff.tipo === "ATUALIZAR") return atualizarSet.has(diff.numero_da_linha);
      if (diff.tipo === "AUSENTE_NA_PLANILHA") return ausentesSet.has(diff.numero_da_linha);
      return false;
    });
    if (selectedDiffs.length === 0 && manterSet.size === 0) {
      return jsonResponse({ ok: false, error: "Nenhuma linha selecionada para aplicar." }, 400);
    }
  }

  if (manterSet.size) {
    const rowsToUpsert = Array.from(manterSet).map((numero) => ({
      numero_linha: numero,
      planilha_hash: buildPlanilhaHash(numero, planilhaRowByNumero),
      updated_at: new Date().toISOString(),
      user_id: authData.user.id,
    }));
    const { error: overrideError } = await supabase
      .from("rateio_claro_sync_overrides")
      .upsert(rowsToUpsert, { onConflict: "numero_linha" });

    if (overrideError && overrideError.code !== "42P01") {
      console.error("rateio-claro-sync: failed to upsert overrides", overrideError);
    }
  }

  if (selection) {
    const planilhaSet = new Set<string>([
      ...(selection.criar || []),
      ...(selection.atualizar || []),
      ...(selection.ausentes || []),
    ]);
    if (planilhaSet.size) {
      const { error: deleteError } = await supabase
        .from("rateio_claro_sync_overrides")
        .delete()
        .in("numero_linha", Array.from(planilhaSet));
      if (deleteError && deleteError.code !== "42P01") {
        console.error("rateio-claro-sync: failed to clear overrides", deleteError);
      }
    }
  }

  const selectedSummary = selectedDiffs.reduce(
    (acc, item) => {
      if (item.tipo === "CRIAR") acc.criar += 1;
      if (item.tipo === "ATUALIZAR") acc.atualizar += 1;
      if (item.tipo === "AUSENTE_NA_PLANILHA") acc.ausentes += 1;
      return acc;
    },
    { criar: 0, atualizar: 0, ausentes: 0 }
  );

  if (!selectedDiffs.length && manterSet.size > 0) {
    const checksum_planilha = await hashPlanilha(planilhaRows).catch(() => null);
    const payload = {
      summary,
      diffs_sample: diffs.slice(0, 25),
      selection,
    };

    await supabase.from("rateio_sync_logs").insert({
      user_id: authData.user.id,
      inserted: 0,
      updated: 0,
      inactivated: 0,
      options: { onMissingInSheet: "KEEP_ACTIVE", selection: selection || null },
      checksum_planilha,
      payload,
    });

    return jsonResponse({
      inserted: 0,
      updated: 0,
      inactivated: 0,
      keptActive: 0,
      total: 0,
    });
  }

  if (!statusSupported) {
    return jsonResponse(
      {
        ok: false,
        error: "Migration required: coluna status ausente em rateio_claro. Rode a migration de sync.",
      },
      400
    );
  }

  const onMissing = body.options?.onMissingInSheet === "KEEP_ACTIVE" ? "KEEP_ACTIVE" : "INACTIVATE";
  const now = new Date().toISOString();

  const toInsert = selectedDiffs
    .filter((diff) => diff.tipo === "CRIAR")
    .map((diff) => ({
      nome: diff.planilha?.nome ?? "",
      numero_linha: diff.numero_da_linha,
      user_id: authData.user.id,
      status: "active",
      created_at: now,
      updated_at: now,
    }));

  const toUpdate = selectedDiffs
    .filter((diff) => diff.tipo === "ATUALIZAR" && diff.hub?.id)
    .map((diff) => ({
      id: diff.hub?.id,
      nome: diff.planilha?.nome ?? "",
      status: "active",
      updated_at: now,
    }));

  const toInactivate =
    onMissing === "INACTIVATE"
      ? selectedDiffs
          .filter((diff) => diff.tipo === "AUSENTE_NA_PLANILHA" && diff.hub?.id)
          .map((diff) => ({ id: diff.hub?.id }))
      : [];

  const { data: applyData, error: applyError } = await supabase.rpc("rateio_claro_sync_apply", {
    p_inserts: toInsert,
    p_updates: toUpdate,
    p_inactivate: toInactivate,
  });

  if (applyError) {
    console.error("Apply sync error:", applyError);
    return jsonResponse({ ok: false, error: "Failed to apply sync" }, 500);
  }

  const applyResult = Array.isArray(applyData) ? applyData[0] : applyData;
  const inserted = applyResult?.inserted ?? toInsert.length;
  const updated = applyResult?.updated ?? toUpdate.length;
  const inactivated = applyResult?.inactivated ?? toInactivate.length;
  const keptActive = onMissing === "KEEP_ACTIVE" ? selectedSummary.ausentes : 0;
  const total = inserted + updated + inactivated + keptActive;

  const checksum_planilha = await hashPlanilha(planilhaRows).catch(() => null);
  const payload = {
    summary,
    diffs_sample: diffs.slice(0, 25),
  };

  await supabase.from("rateio_sync_logs").insert({
    user_id: authData.user.id,
    inserted,
    updated,
    inactivated,
    options: { onMissingInSheet: onMissing },
    checksum_planilha,
    payload,
  });

  return jsonResponse({
    inserted,
    updated,
    inactivated,
    keptActive,
    total,
  });
});
