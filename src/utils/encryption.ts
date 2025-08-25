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

// ========================================
// CRIPTOGRAFIA REVERSÍVEL PARA MÓDULOS
// ========================================
// Usar APENAS para senhas dos módulos (Pessoal, Acessos, Teams, etc.)
// NÃO usar para senhas de login/autenticação

export const encryptPassword = (password: string): string => {
  if (!password) return '';
  
  console.log('🔐 Criptografando senha:', password);
  
  let encrypted = '';
  for (let i = 0; i < password.length; i++) {
    const charCode = password.charCodeAt(i);
    const keyChar = ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length);
    encrypted += String.fromCharCode(charCode ^ keyChar);
  }
  const result = btoa(encrypted); // Base64 encode
  console.log('✅ Senha criptografada:', result);
  return result;
};

export const decryptPassword = (encryptedPassword: string): string => {
  console.log('🔍 Tentando descriptografar:', encryptedPassword);
  
  if (!encryptedPassword) return '';
  
  // Se é string vazia ou null, retorna vazio
  if (!encryptedPassword.trim()) return '';
  
  // Se é hash bcrypt, não pode ser descriptografado
  if (encryptedPassword.startsWith('$2')) {
    console.log('⚠️ Senha bcrypt detectada');
    return '[Senha bcrypt - reinsira a senha]';
  }
  
  // Verificar se é uma senha em texto plano (não criptografada)
  // Base64 válido deve ter apenas caracteres A-Z, a-z, 0-9, +, /, =
  const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
  if (!base64Regex.test(encryptedPassword)) {
    console.log('⚠️ Senha em texto plano detectada:', encryptedPassword);
    // Se é texto plano, criptografar e retornar descriptografado
    return encryptedPassword;
  }
  
  try {
    const encrypted = atob(encryptedPassword);
    let decrypted = '';
    for (let i = 0; i < encrypted.length; i++) {
      const charCode = encrypted.charCodeAt(i);
      const keyChar = ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length);
      decrypted += String.fromCharCode(charCode ^ keyChar);
    }
    console.log('✅ Senha descriptografada:', decrypted);
    return decrypted;
  } catch (error) {
    console.log('❌ Erro ao descriptografar, retornando original:', error);
    return encryptedPassword;
  }
};