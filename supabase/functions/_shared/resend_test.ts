import { resolveRecipients, sendEmailWithResend } from "./resend.ts";

const assert = (condition: boolean, message: string) => {
  if (!condition) throw new Error(message);
};

const restoreEnvironmentValue = (name: string, value: string | undefined) => {
  if (value === undefined) {
    Deno.env.delete(name);
    return;
  }
  Deno.env.set(name, value);
};

Deno.test("Resend utility validates and classifies safe send results", async () => {
  const originalFetch = globalThis.fetch;
  const originalApiKey = Deno.env.get("RESEND_API_KEY");
  const originalFrom = Deno.env.get("RESEND_FROM_EMAIL");
  const originalReplyTo = Deno.env.get("RESEND_REPLY_TO");

  try {
    const defaults = ["Default@Example.com"];
    const fallback = resolveRecipients(undefined, defaults);
    assert(
      fallback.success &&
        fallback.recipients[0] === "default@example.com",
      "Default recipients should be normalized",
    );
    assert(
      !resolveRecipients([], defaults).success,
      "An explicit empty list must be rejected",
    );
    assert(
      !resolveRecipients(["invalid"], defaults).success,
      "Invalid recipients must be rejected",
    );
    assert(
      !resolveRecipients(
        Array.from({ length: 51 }, (_, index) => `user${index}@example.com`),
        defaults,
      ).success,
      "More than 50 recipients must be rejected",
    );

    const normalized = resolveRecipients(
      [" A@Example.com ", "a@example.com"],
      defaults,
    );
    assert(
      normalized.success &&
        normalized.recipients.length === 1 &&
        normalized.recipients[0] === "a@example.com",
      "Recipients should be normalized and deduplicated",
    );

    Deno.env.delete("RESEND_API_KEY");
    Deno.env.delete("RESEND_FROM_EMAIL");
    let result = await sendEmailWithResend({
      to: ["to@example.com"],
      subject: "Subject",
      html: "<p>Body</p>",
    });
    assert(
      !result.success && result.kind === "configuration",
      "Missing configuration should be classified",
    );

    Deno.env.set("RESEND_API_KEY", "test-key");
    Deno.env.set("RESEND_FROM_EMAIL", "Sender <sender@example.com>");
    Deno.env.set("RESEND_REPLY_TO", "reply@example.com");

    let capturedPayload: Record<string, unknown> | undefined;
    let capturedHeaders: Headers | undefined;
    globalThis.fetch = (_input, init) => {
      capturedPayload = JSON.parse(String(init?.body));
      capturedHeaders = new Headers(init?.headers);
      return Promise.resolve(
        new Response(JSON.stringify({ id: "email_test_id" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    };

    result = await sendEmailWithResend({
      to: ["TO@Example.com"],
      subject: "Subject",
      html: "<p>Body</p>",
    });
    assert(
      result.success && result.emailId === "email_test_id",
      "Successful sends should expose only the provider email ID",
    );
    assert(
      capturedPayload?.reply_to === "reply@example.com",
      "The Resend payload must use reply_to",
    );
    assert(
      capturedHeaders?.get("Authorization") === "Bearer test-key" &&
        capturedHeaders?.get("Content-Type") === "application/json",
      "The Resend request must use the expected authenticated JSON headers",
    );
    assert(
      Array.isArray(capturedPayload?.to) &&
        capturedPayload.to[0] === "to@example.com",
      "Payload recipients should be normalized",
    );

    const providerCases = [
      [400, "bad_request"],
      [401, "authentication"],
      [403, "authentication"],
      [429, "rate_limit"],
      [500, "server_error"],
    ] as const;

    for (const [status, category] of providerCases) {
      globalThis.fetch = () =>
        Promise.resolve(
          new Response("provider detail must stay private", { status }),
        );
      result = await sendEmailWithResend({
        to: ["to@example.com"],
        subject: "Subject",
        html: "<p>Body</p>",
      });
      assert(
        !result.success &&
          result.kind === "provider" &&
          result.providerCategory === category,
        `Provider status ${status} should be classified safely`,
      );
    }

    globalThis.fetch = () =>
      Promise.reject(new TypeError("simulated network failure"));
    result = await sendEmailWithResend({
      to: ["to@example.com"],
      subject: "Subject",
      html: "<p>Body</p>",
    });
    assert(
      !result.success && result.kind === "network",
      "Network errors should be classified safely",
    );

    globalThis.fetch = async (_input, init) =>
      await new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("simulated timeout", "AbortError"));
        });
      });
    result = await sendEmailWithResend({
      to: ["to@example.com"],
      subject: "Subject",
      html: "<p>Body</p>",
      timeoutMs: 5,
    });
    assert(
      !result.success && result.kind === "timeout",
      "Aborted requests should be classified as timeouts",
    );
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnvironmentValue("RESEND_API_KEY", originalApiKey);
    restoreEnvironmentValue("RESEND_FROM_EMAIL", originalFrom);
    restoreEnvironmentValue("RESEND_REPLY_TO", originalReplyTo);
  }
});
