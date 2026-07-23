export type EmailFunctionResponse = {
  success: boolean;
  code?: string;
  message?: string;
  emailId?: string;
};

const DEFAULT_EMAIL_ERROR_MESSAGE =
  'Não foi possível enviar o e-mail. Tente novamente.';

const EMAIL_ERROR_MESSAGES: Record<string, string> = {
  VALIDATION_ERROR: 'Verifique os destinatários e os dados do e-mail.',
  UNAUTHORIZED: 'É necessário estar autenticado para enviar este e-mail.',
  FORBIDDEN: 'Você não possui permissão para enviar este e-mail.',
  EMAIL_CONFIGURATION_ERROR:
    'O serviço de e-mail não está configurado corretamente. Entre em contato com o suporte.',
  EMAIL_TIMEOUT: 'O serviço de e-mail demorou para responder. Tente novamente.',
  EMAIL_PROVIDER_ERROR: DEFAULT_EMAIL_ERROR_MESSAGE,
  RATE_LIMITED:
    'O limite temporário de envios foi atingido. Aguarde e tente novamente.',
};

export const parseEmailFunctionResponse = (
  value: unknown,
): EmailFunctionResponse | null => {
  if (!value || typeof value !== 'object' || !('success' in value)) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  if (typeof candidate.success !== 'boolean') {
    return null;
  }

  return {
    success: candidate.success,
    code: typeof candidate.code === 'string' ? candidate.code : undefined,
    message:
      typeof candidate.message === 'string' ? candidate.message.trim() : undefined,
    emailId:
      typeof candidate.emailId === 'string' ? candidate.emailId : undefined,
  };
};

export const getEmailErrorMessage = (code?: string) =>
  (code && EMAIL_ERROR_MESSAGES[code]) || DEFAULT_EMAIL_ERROR_MESSAGE;

export const getEmailSuccessMessage = (message?: string) =>
  message || 'E-mail enviado com sucesso.';

export { DEFAULT_EMAIL_ERROR_MESSAGE };
