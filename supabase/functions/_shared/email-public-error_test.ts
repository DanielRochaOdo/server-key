import { getPublicEmailError } from "./email-public-error.ts";
import type { SendEmailResult } from "./resend.ts";

const assert = (condition: boolean, message: string) => {
  if (!condition) throw new Error(message);
};

Deno.test("provider failures use only public simplified error codes", () => {
  const knownProviderFailure = {
    success: false,
    kind: "provider",
    providerStatus: 500,
    providerCategory: "server_error",
    durationMs: 10,
  } satisfies Extract<SendEmailResult, { success: false }>;

  assert(
    !isEmailDeliveryStatusUncertain(knownProviderFailure),
    "A provider 5xx response should remain a controlled provider failure",
  );
  assert(
    getPublicEmailError(knownProviderFailure).code === "EMAIL_PROVIDER_ERROR",
    "Known provider failures should retain their public classification",
  );

  const rateLimit = {
    success: false,
    kind: "provider",
    providerStatus: 429,
    providerCategory: "rate_limit",
    durationMs: 10,
  } satisfies Extract<SendEmailResult, { success: false }>;

  assert(
    getPublicEmailError(rateLimit).code === "RATE_LIMITED",
    "Provider rate limits should use the public rate-limited code",
  );
});
