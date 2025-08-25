/*
  # Converter senhas bcrypt para criptografia reversível no módulo Pessoal

  1. Problema Identificado
    - Senhas no módulo Pessoal estão usando bcrypt ($2b$12$...)
    - bcrypt é irreversível, não podemos descriptografar
    - Módulo Pessoal precisa mostrar senhas descriptografadas

  2. Solução
    - Limpar senhas bcrypt existentes
    - Permitir que usuários reinsiram senhas
    - Novos formulários usarão criptografia reversível

  3. Segurança
    - Senhas de login continuam com bcrypt
    - Apenas módulo Pessoal usa criptografia reversível
*/

-- Limpar senhas bcrypt existentes na tabela pessoal
-- Usuários precisarão reinserir as senhas
UPDATE pessoal 
SET senha = NULL 
WHERE senha LIKE '$2%$%$%';

-- Adicionar comentário na tabela para documentar o tipo de criptografia
COMMENT ON COLUMN pessoal.senha IS 'Senha criptografada com encryptPassword (reversível) - NÃO usar bcrypt';