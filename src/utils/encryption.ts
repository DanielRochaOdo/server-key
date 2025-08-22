import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;
const ENCRYPTION_KEY = 'ServerKey2024!@#$'; // Em produção, usar variável de ambiente

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

// Função simples de encriptação reversível para visualização no frontend
export const encryptPassword = (password: string): string => {
  if (!password) return '';
  
  let encrypted = '';
  for (let i = 0; i < password.length; i++) {
    const charCode = password.charCodeAt(i);
    const keyChar = ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length);
    encrypted += String.fromCharCode(charCode ^ keyChar);
  }
  return btoa(encrypted); // Base64 encode
};

// Função para desencriptar senhas para visualização
export const decryptPassword = (encryptedPassword: string): string => {
  if (!encryptedPassword) return '';
  
  try {
    // Validate Base64 format before attempting to decode
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    if (!base64Regex.test(encryptedPassword)) {
      return encryptedPassword;
    }
    
    const encrypted = atob(encryptedPassword); // Base64 decode
    let decrypted = '';
    for (let i = 0; i < encrypted.length; i++) {
      const charCode = encrypted.charCodeAt(i);
      const keyChar = ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length);
      decrypted += String.fromCharCode(charCode ^ keyChar);
    }
    return decrypted;
  } catch (error) {
    console.error('Error decrypting password:', error);
    return '';
  }
};