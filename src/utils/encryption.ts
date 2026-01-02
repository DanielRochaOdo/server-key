import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;
const PASSWORD_PREFIX = 'sk:';
const ENCRYPTION_KEY = import.meta.env.VITE_PASSWORD_ENCRYPTION_KEY || 'ServerKey2024!@#$';
const BASE64_REGEX = /^[A-Za-z0-9+/]*={0,2}$/;

export const hashPassword = async (password: string): Promise<string> => {
  try {
    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    const hashedPassword = await bcrypt.hash(password, salt);
    return hashedPassword;
  } catch (error) {
    console.error('Error hashing password:', error);
    throw new Error('Failed to hash password');
  }
};

export const verifyPassword = async (password: string, hashedPassword: string): Promise<boolean> => {
  try {
    return await bcrypt.compare(password, hashedPassword);
  } catch (error) {
    console.error('Error verifying password:', error);
    return false;
  }
};

export const isPasswordHashed = (password: string): boolean => {
  // bcrypt hashes start with $2a$, $2b$, $2x$, or $2y$
  return /^\$2[abxy]\$\d+\$/.test(password);
};

const isBase64Like = (value: string): boolean => {
  return !!value && value.length % 4 === 0 && BASE64_REGEX.test(value);
};

const xorWithKey = (value: string): string => {
  let output = '';
  for (let i = 0; i < value.length; i++) {
    const charCode = value.charCodeAt(i);
    const keyChar = ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length);
    output += String.fromCharCode(charCode ^ keyChar);
  }
  return output;
};

const decodeEncrypted = (value: string): string => {
  const decoded = atob(value);
  return xorWithKey(decoded);
};

const encodeEncrypted = (value: string): string => {
  const encrypted = xorWithKey(value);
  return btoa(encrypted);
};

const isMostlyPrintable = (value: string): boolean => {
  if (!value) return false;
  let printableCount = 0;
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if ((code >= 32 && code <= 126) || code === 9 || code === 10 || code === 13) {
      printableCount += 1;
    }
  }
  return printableCount / value.length >= 0.85;
};

const isEncryptedPassword = (password: string): boolean => {
  if (!password) return false;
  if (password.startsWith(PASSWORD_PREFIX)) return true;
  if (password.startsWith('$2')) return true;
  if (!isBase64Like(password)) return false;
  try {
    const decrypted = decodeEncrypted(password);
    return isMostlyPrintable(decrypted);
  } catch {
    return false;
  }
};

// ========================================
// REVERSIBLE ENCRYPTION FOR MODULE PASSWORDS
// ========================================
// Use ONLY for module passwords (Pessoal, Acessos, Teams, etc.)
// Do NOT use for login/auth passwords

export const encryptPassword = (password: string): string => {
  if (!password) return '';
  if (isEncryptedPassword(password)) {
    return password;
  }
  return `${PASSWORD_PREFIX}${encodeEncrypted(password)}`;
};

export const decryptPassword = (encryptedPassword: string): string => {
  if (!encryptedPassword) return '';

  const trimmedPassword = encryptedPassword.trim();
  if (!trimmedPassword) return '';

  if (trimmedPassword.startsWith('$2')) {
    return '[Senha bcrypt - reinsira a senha]';
  }

  const hasPrefix = trimmedPassword.startsWith(PASSWORD_PREFIX);
  const payload = hasPrefix ? trimmedPassword.slice(PASSWORD_PREFIX.length) : trimmedPassword;

  if (!isBase64Like(payload)) {
    return trimmedPassword;
  }

  try {
    const decrypted = decodeEncrypted(payload);

    if (!hasPrefix && isBase64Like(decrypted)) {
      const secondPass = decodeEncrypted(decrypted);
      if (isMostlyPrintable(secondPass)) {
        return secondPass;
      }
    }

    if (!isMostlyPrintable(decrypted)) {
      return trimmedPassword;
    }

    return decrypted;
  } catch (error) {
    return trimmedPassword;
  }
};
