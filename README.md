# ServerKey - Sistema de Gerenciamento de Segurança

Sistema completo de gerenciamento de acessos, usuários e rateios com controle de acesso baseado em funções (RBAC).

## 🚀 Funcionalidades

### Módulos Disponíveis
- **Usuários**: Gerenciamento completo de usuários com RBAC
- **Acessos**: Controle de credenciais e sistemas
- **Teams**: Gerenciamento de equipes
- **Win Users**: Usuários Windows
- **Rateio Claro**: Controle de linhas telefônicas
- **Rateio Google**: Usuários Google Workspace
- **Pessoal**: Controle de credenciais pessoal

### Controle de Acesso (RBAC)
- **Admin**: Acesso total a todos os módulos
- **Financeiro**: Acesso aos módulos de rateio (Claro e Google)
- **Usuário**: Acesso aos módulos operacionais (Acessos, Teams, Win Users)

## 🛠️ Tecnologias

- **Frontend**: React + TypeScript + Tailwind CSS
- **Backend**: Supabase (Database + Auth + Edge Functions)
- **Deployment**: Netlify
- **Icons**: Lucide React

## 📋 Pré-requisitos

1. Conta no Supabase
2. Projeto Supabase configurado
3. Variáveis de ambiente configuradas

## ⚙️ Configuração

### 1. Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anonima
```

### 2. Configuração do Supabase

#### Executar Migrações
Execute as migrações SQL na seguinte ordem no SQL Editor do Supabase:

1. `supabase/migrations/20250627152047_copper_hill.sql` - Tabela de acessos
2. `supabase/migrations/20250630125339_crystal_frog.sql` - Atualização da tabela teams
3. `supabase/migrations/20250702185944_wispy_frost.sql` - Tabela rateio_claro
4. `supabase/migrations/20250703110048_fancy_cherry.sql` - Tabela rateio_google
5. `supabase/migrations/20250703121850_silver_moon.sql` - Atualização rateio_google
6. `supabase/migrations/20250703122636_royal_hat.sql` - Ajuste ultimo_login
7. `supabase/migrations/20250704105041_dry_term.sql` - Correção coluna nome
8. `supabase/migrations/20250707104823_rustic_shore.sql` - Sistema RBAC
9. `supabase/migrations/20250707110558_purple_plain.sql` - Correções estrutura
10. `supabase/migrations/20250707120000_fix_users_policies.sql` - Políticas finais

#### Configurar Edge Function

1. No painel do Supabase, vá para **Edge Functions**
2. Crie uma nova função chamada `create-user`
3. Cole o código de `supabase/functions/create-user/index.ts`
4. Deploy a função

### 3. Usuário Admin Padrão

Após executar as migrações, será criado um usuário admin padrão:
- **Email**: admin@serverkey.com
- **Senha**: admin123

⚠️ **IMPORTANTE**: Altere essas credenciais após o primeiro login!

## 🚀 Deploy

### Netlify (Recomendado)

1. Conecte seu repositório ao Netlify
2. Configure as variáveis de ambiente no painel do Netlify
3. Deploy automático será feito a cada push

### Vercel

1. Conecte seu repositório ao Vercel
2. Configure as variáveis de ambiente
3. Deploy automático

## 📱 Uso

### Login
Acesse a aplicação e faça login com as credenciais do admin padrão ou com um usuário criado.

### Criação de Usuários
1. Faça login como admin
2. Acesse o módulo "Usuários"
3. Clique em "Novo Usuário"
4. Preencha os dados e selecione o role
5. Os módulos serão atribuídos automaticamente baseado no role

### Navegação
- O menu lateral mostra apenas os módulos que o usuário tem acesso
- Tentativas de acesso não autorizado resultam em página de acesso negado

## 🔒 Segurança

### Row Level Security (RLS)
- Todas as tabelas têm RLS habilitado
- Políticas específicas por módulo e role
- Usuários só acessam seus próprios dados (exceto admins)

### Autenticação
- Integração completa com Supabase Auth
- Tokens JWT para autenticação
- Sessões seguras

### Autorização
- Controle de acesso baseado em roles
- Validação no frontend e backend
- Proteção de rotas

## 📊 Estrutura do Banco

### Tabela `users`
- Controle de usuários do sistema
- Integração com `auth.users`
- Campos: id, email, name, role, modules, is_active, auth_uid

### Tabelas de Dados
- `acessos`: Credenciais de sistemas
- `teams`: Equipes
- `win_users`: Usuários Windows
- `rateio_claro`: Linhas telefônicas
- `rateio_google`: Usuários Google

## 🛠️ Desenvolvimento

### Instalação
```bash
npm install
```

### Desenvolvimento
```bash
npm run dev
```

### Build
```bash
npm run build
```

## 📞 Suporte

Para suporte técnico ou dúvidas sobre o sistema, entre em contato com a equipe de desenvolvimento.

## 📄 Licença

Este projeto é propriedade da empresa e seu uso é restrito aos funcionários autorizados.