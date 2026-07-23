const RESEND_ENDPOINT = "https://api.resend.com/emails";
const RESEND_TIMEOUT_MS = 10_000;
const RESEND_MAX_RECIPIENTS = 50;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type ResendErrorKind =
  | "configuration"
  | "validation"
  | "timeout"
  | "network"
  | "provider";

export type ResendProviderCategory =
  | "bad_request"
  | "authentication"
  | "rate_limit"
  | "server_error"
  | "unexpected_status"
  | "invalid_response";

export type SendEmailResult =
  | {
    success: true;
    emailId: string;
    providerStatus: number;
    durationMs: number;
  }
  | {
    success: false;
    kind: ResendErrorKind;
    providerStatus?: number;
    providerCategory?: ResendProviderCategory;
    durationMs: number;
  };

export type RecipientResolution =
  | { success: true; recipients: string[] }
  | { success: false };

type SendEmailInput = {
  to: string[];
  subject: string;
  html?: string;
  text?: string;
  timeoutMs?: number;
};

const normalizeEmail = (value: string) => value.trim().toLowerCase();

const isValidEmail = (value: string) => EMAIL_PATTERN.test(value);

export const resolveRecipients = (
  input: unknown,
  defaultRecipients: string[],
): RecipientResolution => {
  const source = input === undefined ? defaultRecipients : input;
  if (!Array.isArray(source) || source.length === 0) {
    return { success: false };
  }

  const normalized = source.map((recipient) =>
    typeof recipient === "string" ? normalizeEmail(recipient) : ""
  );

  if (normalized.some((recipient) => !recipient || !isValidEmail(recipient))) {
    return { success: false };
  }

  const recipients = Array.from(new Set(normalized));
  return recipients.length > 0 && recipients.length <= RESEND_MAX_RECIPIENTS
    ? { success: true, recipients }
    : { success: false };
};

const getProviderCategory = (status: number): ResendProviderCategory => {
  if (status === 400) return "bad_request";
  if (status === 401 || status === 403) return "authentication";
  if (status === 429) return "rate_limit";
  if (status >= 500) return "server_error";
  return "unexpected_status";
};

export const sendEmailWithResend = async (
  input: SendEmailInput,
): Promise<SendEmailResult> => {
  const startedAt = performance.now();
  const durationMs = () => Math.round(performance.now() - startedAt);
  const apiKey = Deno.env.get("RESEND_API_KEY")?.trim();
  const from = Deno.env.get("RESEND_FROM_EMAIL")?.trim();
  const replyTo = Deno.env.get("RESEND_REPLY_TO")?.trim();

  if (!apiKey || !from) {
    return {
      success: false,
      kind: "configuration",
      durationMs: durationMs(),
    };
  }

  const to = Array.from(
    new Set(input.to.map((recipient) => normalizeEmail(recipient))),
  );
  const subject = input.subject.trim();
  const html = input.html?.trim();
  const text = input.text?.trim();

  if (
    to.length === 0 ||
    to.length > RESEND_MAX_RECIPIENTS ||
    to.some((recipient) => !isValidEmail(recipient)) ||
    !subject ||
    (!html && !text)
  ) {
    return {
      success: false,
      kind: "validation",
      durationMs: durationMs(),
    };
  }

  const controller = new AbortController();
  const timeoutMs = input.timeoutMs && input.timeoutMs > 0
    ? input.timeoutMs
    : RESEND_TIMEOUT_MS;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const payload: Record<string, unknown> = {
      from,
      to,
      subject,
    };

    if (html) payload.html = html;
    if (text) payload.text = text;
    if (replyTo) payload.reply_to = replyTo;

    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        success: false,
        kind: "provider",
        providerStatus: response.status,
        providerCategory: getProviderCategory(response.status),
        durationMs: durationMs(),
      };
    }

    let responseBody: unknown;
    try {
      responseBody = await response.json();
    } catch {
      return {
        success: false,
        kind: "provider",
        providerStatus: response.status,
        providerCategory: "invalid_response",
        durationMs: durationMs(),
      };
    }

    const emailId = responseBody &&
        typeof responseBody === "object" &&
        "id" in responseBody &&
        typeof responseBody.id === "string"
      ? responseBody.id.trim()
      : "";

    if (!emailId) {
      return {
        success: false,
        kind: "provider",
        providerStatus: response.status,
        providerCategory: "invalid_response",
        durationMs: durationMs(),
      };
    }

    return {
      success: true,
      emailId,
      providerStatus: response.status,
      durationMs: durationMs(),
    };
  } catch (error) {
    const timedOut = controller.signal.aborted ||
      (error instanceof DOMException && error.name === "AbortError");

    return {
      success: false,
      kind: timedOut ? "timeout" : "network",
      durationMs: durationMs(),
    };
  } finally {
    clearTimeout(timeoutId);
  }
};
