import type { SendEmailResult } from "./resend.ts";

export type PublicEmailError = {
  code:
    | "EMAIL_CONFIGURATION_ERROR"
    | "VALIDATION_ERROR"
    | "EMAIL_TIMEOUT"
    | "EMAIL_PROVIDER_ERROR"
    | "RATE_LIMITED";
  message: string;
  status: number;
};

export const getPublicEmailError = (
  result: Extract<SendEmailResult, { success: false }>,
): PublicEmailError => {
  if (result.kind === "configuration") {
    return {
      code: "EMAIL_CONFIGURATION_ERROR",
      message: "O serviço de e-mail não está configurado corretamente.",
      status: 500,
    };
  }

  if (result.kind === "validation") {
    return {
      code: "VALIDATION_ERROR",
      message: "Os dados informados para o envio são inválidos.",
      status: 400,
    };
  }

  if (result.kind === "timeout") {
    return {
      code: "EMAIL_TIMEOUT",
      message: "O serviço de e-mail demorou para responder.",
      status: 504,
    };
  }

  if (
    result.kind === "provider" &&
    result.providerCategory === "rate_limit"
  ) {
    return {
      code: "RATE_LIMITED",
      message: "O limite temporário de envios foi atingido.",
      status: 429,
    };
  }

  return {
    code: "EMAIL_PROVIDER_ERROR",
    message: "Não foi possível enviar o e-mail.",
    status: 502,
  };
};
