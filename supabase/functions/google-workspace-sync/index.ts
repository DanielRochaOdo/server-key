import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-sync-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type SyncMode = "full" | "incremental";

type SyncRequest = {
  mode?: SyncMode;
  domains?: string[];
};

type GoogleUser = {
  id?: string;
  etag?: string;
  primaryEmail?: string;
  name?: { fullName?: string; givenName?: string; familyName?: string };
  orgUnitPath?: string;
  suspended?: boolean;
  archived?: boolean;
  lastLoginTime?: string;
  isAdmin?: boolean;
  aliases?: string[];
};

type UsageParameter = {
  name?: string;
  intValue?: string;
  value?: string;
};

type UsageReportItem = {
  entity?: { userEmail?: string };
  parameters?: UsageParameter[];
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function formatError(value: unknown) {
  if (value instanceof Error && typeof value.message === "string") return value.message;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function normalizePrivateKey(raw: string) {
  const trimmed = (raw || "").trim();
  if (!trimmed) return "";
  // GitHub/Supabase secrets geralmente vêm com \n literal
  return trimmed.includes("\\n") ? trimmed.replaceAll("\\n", "\n") : trimmed;
}

function base64UrlEncode(data: Uint8Array) {
  const b64 = btoa(String.fromCharCode(...data));
  return b64.replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function signJwtRS256(message: string, privateKeyPem: string) {
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
}

async function getGoogleAccessToken(params: {
  clientEmail: string;
  privateKey: string;
  subject: string;
  scope: string;
}) {
  const { clientEmail, privateKey, subject, scope } = params;
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 3600;

  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: clientEmail,
    scope,
    aud: "https://oauth2.googleapis.com/token",
    sub: subject,
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
}

async function listGoogleUsers(params: { accessToken: string; domain: string }) {
  const { accessToken, domain } = params;
  const users: GoogleUser[] = [];
  let pageToken: string | undefined = undefined;

  for (; ;) {
    const url = new URL("https://admin.googleapis.com/admin/directory/v1/users");
    url.searchParams.set("customer", "my_customer");
    url.searchParams.set("domain", domain);
    url.searchParams.set("maxResults", "500");
    url.searchParams.set("orderBy", "email");
    url.searchParams.set("projection", "full");
    url.searchParams.set("viewType", "admin_view");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(`Directory API error (${res.status}) for ${domain}: ${JSON.stringify(data)}`);
    }

    const batch = (data as any)?.users as GoogleUser[] | undefined;
    if (Array.isArray(batch)) users.push(...batch);
    pageToken = (data as any)?.nextPageToken ? String((data as any).nextPageToken) : undefined;
    if (!pageToken) break;
  }

  return users;
}

async function getUsageReport(params: { accessToken: string; domain: string; date: string }) {
  const { accessToken, domain, date } = params;
  const items: UsageReportItem[] = [];
  let pageToken: string | undefined = undefined;

  for (;;) {
    const url = new URL("https://admin.googleapis.com/admin/reports/v1/usage/users");
    url.searchParams.set("userKey", "all");
    url.searchParams.set("date", date);
    url.searchParams.set("parameters", "accounts:used_quota_in_mb");
    url.searchParams.set("filters", "accounts:is_google_workspace_account==true");
    url.searchParams.set("customerId", "my_customer");
    url.searchParams.set("entityType", "USER");
    url.searchParams.set("domain", domain);
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(`Reports API error (${res.status}) for ${domain}: ${JSON.stringify(data)}`);
    }

    const batch = (data as any)?.usageReports as UsageReportItem[] | undefined;
    if (Array.isArray(batch)) items.push(...batch);
    pageToken = (data as any)?.nextPageToken ? String((data as any).nextPageToken) : undefined;
    if (!pageToken) break;
  }

  return items;
}

function normalizeDomain(primaryEmail: string) {
  const at = primaryEmail.lastIndexOf("@");
  if (at < 0) return "";
  return primaryEmail.slice(at + 1).toLowerCase();
}

function parseUsageValue(raw?: string) {
  if (!raw) return null;
  const cleaned = raw.replace(/[^0-9.]/g, "");
  const numeric = Number(cleaned);
  return Number.isFinite(numeric) ? numeric : null;
}

function getUsageParamValue(item: UsageReportItem, name: string) {
  const param = item.parameters?.find((p) => p.name === name);
  if (!param) return null;
  const rawValue = param.intValue ?? param.value ?? "";
  return parseUsageValue(String(rawValue));
}

function resolveStorageMb(item: UsageReportItem) {
  const accountsUsed = getUsageParamValue(item, "accounts:used_quota_in_mb");
  if (accountsUsed !== null) return accountsUsed;

  const driveUsed = getUsageParamValue(item, "drive:used_storage_in_mb");
  const gmailUsed = getUsageParamValue(item, "gmail:used_storage_in_mb");
  if (driveUsed !== null || gmailUsed !== null) return (driveUsed ?? 0) + (gmailUsed ?? 0);

  const accountsStorage = getUsageParamValue(item, "accounts:used_storage_in_mb");
  if (accountsStorage !== null) return accountsStorage;

  const anyUsed = item.parameters?.find((p) => String(p.name || "").includes("used_storage_in_mb"));
  if (anyUsed) {
    const rawValue = anyUsed.intValue ?? anyUsed.value ?? "";
    return parseUsageValue(String(rawValue));
  }

  return null;
}

type DomainCredentials = {
  client_email: string;
  private_key: string;
  subject: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ ok: false, error: "Method not allowed" }, 405);

  const expectedSecret = (Deno.env.get("GOOGLE_WORKSPACE_SYNC_SECRET") || "").trim();
  const providedSecret = (req.headers.get("x-sync-secret") || "").trim();
  if (!expectedSecret || providedSecret !== expectedSecret) {
    return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ ok: false, error: "Missing SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY" }, 500);
  }

  const domainCredentialsJsonRaw = (Deno.env.get("GOOGLE_DOMAIN_CREDENTIALS_JSON") || "").trim();
  let domainCredentials: Record<string, DomainCredentials> | null = null;

  if (domainCredentialsJsonRaw) {
    try {
      domainCredentials = JSON.parse(domainCredentialsJsonRaw) as Record<string, DomainCredentials>;
    } catch {
      return jsonResponse({ ok: false, error: "Invalid GOOGLE_DOMAIN_CREDENTIALS_JSON (must be JSON object)" }, 500);
    }
  }

  const saClientEmail = (Deno.env.get("GOOGLE_SA_CLIENT_EMAIL") || "").trim();
  const saPrivateKey = normalizePrivateKey(Deno.env.get("GOOGLE_SA_PRIVATE_KEY") || "");
  const subjectsJsonRaw = (Deno.env.get("GOOGLE_ADMIN_SUBJECTS_JSON") || "").trim();

  if (!domainCredentials && (!saClientEmail || !saPrivateKey || !subjectsJsonRaw)) {
    return jsonResponse(
      { ok: false, error: "Missing GOOGLE_SA_CLIENT_EMAIL/GOOGLE_SA_PRIVATE_KEY/GOOGLE_ADMIN_SUBJECTS_JSON" },
      500
    );
  }

  let subjectsByDomain: Record<string, string> = {};
  if (!domainCredentials) {
    try {
      subjectsByDomain = JSON.parse(subjectsJsonRaw) as Record<string, string>;
    } catch {
      return jsonResponse({ ok: false, error: "Invalid GOOGLE_ADMIN_SUBJECTS_JSON (must be JSON object)" }, 500);
    }
  }

  let payload: SyncRequest = {};
  try {
    payload = (await req.json()) as SyncRequest;
  } catch {
    // ignore, use defaults
  }

  const defaultDomains = ["odontoart.com", "odontoartonline.com.br"];
  const mode: SyncMode = payload.mode === "incremental" ? "incremental" : "full";
  const domains = Array.isArray(payload.domains) && payload.domains.length ? payload.domains : defaultDomains;

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const scope = "https://www.googleapis.com/auth/admin.directory.user.readonly https://www.googleapis.com/auth/admin.reports.usage.readonly";
  const runStartedAt = new Date().toISOString();
  const usageDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const summary: any = { ok: true, mode, runStartedAt, domains: [] as any[] };

  for (const domain of domains) {
    const normalized = String(domain || "").trim().toLowerCase();
    let subject = "";
    let clientEmail = saClientEmail;
    let privateKey = saPrivateKey;

    if (domainCredentials) {
      const creds = domainCredentials[normalized];
      if (!creds?.client_email || !creds?.private_key || !creds?.subject) {
        summary.domains.push({ domain: normalized, ok: false, error: "Missing domain credentials for domain" });
        continue;
      }
      subject = String(creds.subject).trim();
      clientEmail = String(creds.client_email).trim();
      privateKey = normalizePrivateKey(String(creds.private_key || ""));
    } else {
      subject = (subjectsByDomain[normalized] || "").trim();
    }

    if (!subject || !clientEmail || !privateKey) {
      summary.domains.push({ domain: normalized, ok: false, error: "Missing credentials/subject for domain" });
      continue;
    }

    const domainResult: any = { domain: normalized, ok: false, fetched: 0, upserts: 0, marked_deleted: 0 };
    try {
      const accessToken = await getGoogleAccessToken({
        clientEmail,
        privateKey,
        subject,
        scope,
      });

      const users = await listGoogleUsers({ accessToken, domain: normalized });
      domainResult.fetched = users.length;

      const usageReports = await getUsageReport({ accessToken, domain: normalized, date: usageDate });
      const usageByEmail = new Map<string, number>();
      for (const item of usageReports) {
        const email = (item.entity?.userEmail || "").toLowerCase().trim();
        if (!email) continue;
        const storageMb = resolveStorageMb(item);
        if (storageMb !== null) usageByEmail.set(email, storageMb);
      }

      const records = users
        .filter((u) => u.primaryEmail && u.id)
        .map((u) => {
          const primaryEmail = String(u.primaryEmail).toLowerCase();
          const recordDomain = normalizeDomain(primaryEmail);
          const storageMb = usageByEmail.get(primaryEmail);
          return {
            primary_email: primaryEmail,
            domain: recordDomain || normalized,
            full_name: u.name?.fullName ?? null,
            given_name: u.name?.givenName ?? null,
            family_name: u.name?.familyName ?? null,
            org_unit_path: u.orgUnitPath ?? null,
            suspended: Boolean(u.suspended),
            archived: Boolean((u as any).archived),
            deleted: false,
            last_login_at: u.lastLoginTime ? new Date(u.lastLoginTime).toISOString() : null,
            storage_mb: Number.isFinite(storageMb) ? storageMb : null,
            is_admin: typeof u.isAdmin === "boolean" ? u.isAdmin : null,
            aliases: Array.isArray(u.aliases) ? u.aliases.map((a) => String(a).toLowerCase()) : null,
            google_etag: u.etag ?? null,
            google_id: String(u.id),
            last_synced_at: runStartedAt,
          };
        });

      let bulkUpsertError: unknown | null = null;
      const chunkSize = 200;
      for (let i = 0; i < records.length; i += chunkSize) {
        const chunk = records.slice(i, i + chunkSize);

        const { error } = await supabase.from("google_workspace_accounts").upsert(chunk, {
          onConflict: "google_id",
        });

        if (error) {
          domainResult.error = formatError(error);
          bulkUpsertError = error;
          break;
        }

        domainResult.upserts += chunk.length;
      }

      if (bulkUpsertError) {
        // Remediação simples para conflitos raros de primary_email (reuso de email)
        const errMsg = formatError(bulkUpsertError);
        if (!errMsg.toLowerCase().includes("primary_email")) throw bulkUpsertError;

        for (const rec of records) {
          const { error: upsertError } = await supabase.from("google_workspace_accounts").upsert([rec], {
            onConflict: "google_id",
          });

          if (!upsertError) {
            domainResult.upserts += 1;
            continue;
          }

          const { data: existing } = await supabase
            .from("google_workspace_accounts")
            .select("id, google_id, primary_email")
            .eq("primary_email", rec.primary_email)
            .limit(1)
            .maybeSingle();

          if (existing?.id && existing.google_id && existing.google_id !== rec.google_id) {
            const tombstone = `${existing.primary_email}#reused#${existing.google_id}`.slice(0, 320);
            await supabase
              .from("google_workspace_accounts")
              .update({ primary_email: tombstone, deleted: true, updated_at: new Date().toISOString() })
              .eq("id", existing.id);

            const { error: retryError } = await supabase.from("google_workspace_accounts").upsert([rec], {
              onConflict: "google_id",
            });
            if (retryError) throw retryError;
            domainResult.upserts += 1;
          } else {
            throw upsertError;
          }
        }
      }

      if (mode === "full") {
        const { data: deletedRows, error: deletedErr } = await supabase
          .from("google_workspace_accounts")
          .update({ deleted: true, updated_at: new Date().toISOString() })
          .eq("domain", normalized)
          .lt("last_synced_at", runStartedAt)
          .eq("deleted", false)
          .select("id");

        if (!deletedErr && Array.isArray(deletedRows)) domainResult.marked_deleted = deletedRows.length;
      }

      await supabase.from("google_workspace_sync_state").upsert(
        [
          {
            domain: normalized,
            next_page_token: null,
            last_full_sync_at: mode === "full" ? runStartedAt : null,
            last_incremental_sync_at: mode === "incremental" ? runStartedAt : null,
            last_sync_status: "ok",
            last_sync_error: null,
            updated_at: new Date().toISOString(),
          },
        ],
        { onConflict: "domain" }
      );

      domainResult.ok = true;
    } catch (err) {
      const message = formatError(err);
      domainResult.error = message;
      await supabase.from("google_workspace_sync_state").upsert(
        [
          {
            domain: String(domain || "").trim().toLowerCase(),
            last_sync_status: "error",
            last_sync_error: message.slice(0, 2000),
            updated_at: new Date().toISOString(),
          },
        ],
        { onConflict: "domain" }
      );
    }

    summary.domains.push(domainResult);
  }

  summary.ok = summary.domains.every((d: any) => d.ok);
  return jsonResponse(summary, summary.ok ? 200 : 500);
});
