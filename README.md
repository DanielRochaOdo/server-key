## Supabase Multi-Projeto (sem relogar toda hora)

Este repositório inclui um wrapper para reutilizar token/perfil do Supabase por projeto:

1. Faça login uma vez por conta/perfil:
```powershell
supabase login --name conta_empresa_a --token <SEU_TOKEN_AQUI>
```

2. Crie o contexto local deste projeto:
```powershell
Copy-Item .supabase-context.example.json .supabase-context.json
```

3. Edite `.supabase-context.json` com:
- `profile`: nome do perfil usado no `supabase login --name ...`
- `project_ref`: project ref do Supabase deste projeto
- `db_password_env`: nome da variável de ambiente com senha do banco (opcional, recomendado)

4. Defina a senha do banco em variável de ambiente (opcional):
```powershell
[Environment]::SetEnvironmentVariable("SUPABASE_DB_PASSWORD_A","<SENHA_DB>","User")
```

5. Use sempre o wrapper:
```powershell
.\scripts\sb.ps1 db pull
.\scripts\sb.ps1 db push
.\scripts\sb.ps1 migration list
.\scripts\sb.ps1 functions deploy minha-funcao --project-ref <project_ref>
```

Observações:
- O wrapper aplica `--profile` automaticamente e usa a raiz do repo como `--workdir`.
- Para comandos de `db`/`migration` que exigem link, ele roda `supabase link` automaticamente com o `project_ref` do contexto.
- `.supabase-context.json` está no `.gitignore`.
# Odontoart Hub - Sistema de Gerenciamento de SeguranÃ§a

Sistema completo de gerenciamento de acessos, usuÃ¡rios e rateios com controle de acesso baseado em funÃ§Ãµes (RBAC).

## ðŸš€ Funcionalidades

### MÃ³dulos DisponÃ­veis
- **UsuÃ¡rios**: Gerenciamento completo de usuÃ¡rios com RBAC
- **Acessos**: Controle de credenciais e sistemas
- **Contas Teams**: Gerenciamento de contas teams
- **UsuÃ¡rios Windows**: Gerenciamento de usuÃ¡rios Windows
- **Rateio Claro**: Controle de linhas telefÃ´nicas
- **Rateio Google**: UsuÃ¡rios Google Workspace

### Controle de Acesso (RBAC)
- **Admin**: Acesso total a todos os mÃ³dulos
- **Financeiro**: Acesso aos mÃ³dulos de rateio (Claro e Google)
- **UsuÃ¡rio**: Acesso aos mÃ³dulos operacionais (Acessos, Contas Teams, UsuÃ¡rios Windows)

## ðŸ› ï¸ Tecnologias

- **Frontend**: React + TypeScript + Tailwind CSS
- **Backend**: Supabase (Database + Auth + Edge Functions)
- **Deployment**: Netlify
- **Icons**: Lucide React

## ðŸ“‹ PrÃ©-requisitos

1. Conta no Supabase
2. Projeto Supabase configurado
3. VariÃ¡veis de ambiente configuradas

## âš™ï¸ ConfiguraÃ§Ã£o

### 1. VariÃ¡veis de Ambiente

Crie um arquivo `.env` na raiz do projeto:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anonima
```

### 2. ConfiguraÃ§Ã£o do Supabase

#### Executar MigraÃ§Ãµes
Execute as migraÃ§Ãµes SQL na seguinte ordem no SQL Editor do Supabase:

1. `supabase/migrations/20250627152047_copper_hill.sql` - Tabela de acessos
2. `supabase/migrations/20250630125339_crystal_frog.sql` - AtualizaÃ§Ã£o da tabela teams
3. `supabase/migrations/20250702185944_wispy_frost.sql` - Tabela rateio_claro
4. `supabase/migrations/20250703110048_fancy_cherry.sql` - Tabela rateio_google
5. `supabase/migrations/20250703121850_silver_moon.sql` - AtualizaÃ§Ã£o rateio_google
6. `supabase/migrations/20250703122636_royal_hat.sql` - Ajuste ultimo_login
7. `supabase/migrations/20250704105041_dry_term.sql` - CorreÃ§Ã£o coluna nome
8. `supabase/migrations/20250707104823_rustic_shore.sql` - Sistema RBAC
9. `supabase/migrations/20250707110558_purple_plain.sql` - CorreÃ§Ãµes estrutura
10. `supabase/migrations/20250707120000_fix_users_policies.sql` - PolÃ­ticas finais

#### Configurar Edge Function

1. No painel do Supabase, vÃ¡ para **Edge Functions**
2. Crie uma nova funÃ§Ã£o chamada `create-user`
3. Cole o cÃ³digo de `supabase/functions/create-user/index.ts`
4. Deploy a funÃ§Ã£o

### 3. UsuÃ¡rio Admin PadrÃ£o

ApÃ³s executar as migraÃ§Ãµes, serÃ¡ criado um usuÃ¡rio admin padrÃ£o:
- **Email**: admin@serverkey.com
- **Senha**: admin123

âš ï¸ **IMPORTANTE**: Altere essas credenciais apÃ³s o primeiro login!

## ðŸš€ Deploy

### Netlify (Recomendado)

1. Conecte seu repositÃ³rio ao Netlify
2. Configure as variÃ¡veis de ambiente no painel do Netlify
3. Deploy automÃ¡tico serÃ¡ feito a cada push

### Vercel

1. Conecte seu repositÃ³rio ao Vercel
2. Configure as variÃ¡veis de ambiente
3. Deploy automÃ¡tico

## ðŸ“± Uso

### Login
Acesse a aplicaÃ§Ã£o e faÃ§a login com as credenciais do admin padrÃ£o ou com um usuÃ¡rio criado.

### CriaÃ§Ã£o de UsuÃ¡rios
1. FaÃ§a login como admin
2. Acesse o mÃ³dulo "UsuÃ¡rios"
3. Clique em "Novo UsuÃ¡rio"
4. Preencha os dados e selecione o role
5. Os mÃ³dulos serÃ£o atribuÃ­dos automaticamente baseado no role

### NavegaÃ§Ã£o
- O menu lateral mostra apenas os mÃ³dulos que o usuÃ¡rio tem acesso
- Tentativas de acesso nÃ£o autorizado resultam em pÃ¡gina de acesso negado

## ðŸ”’ SeguranÃ§a

### Row Level Security (RLS)
- Todas as tabelas tÃªm RLS habilitado
- PolÃ­ticas especÃ­ficas por mÃ³dulo e role
- UsuÃ¡rios sÃ³ acessam seus prÃ³prios dados (exceto admins)

### AutenticaÃ§Ã£o
- IntegraÃ§Ã£o completa com Supabase Auth
- Tokens JWT para autenticaÃ§Ã£o
- SessÃµes seguras

### AutorizaÃ§Ã£o
- Controle de acesso baseado em roles
- ValidaÃ§Ã£o no frontend e backend
- ProteÃ§Ã£o de rotas

## ðŸ“Š Estrutura do Banco

### Tabela `users`
- Controle de usuÃ¡rios do sistema
- IntegraÃ§Ã£o com `auth.users`
- Campos: id, email, name, role, modules, is_active, auth_uid

### Tabelas de Dados
- `acessos`: Credenciais de sistemas
- `teams`: Contas Teams
- `win_users`: UsuÃ¡rios Windows
- `rateio_claro`: Linhas telefÃ´nicas
- `rateio_google`: UsuÃ¡rios Google

## ðŸ› ï¸ Desenvolvimento

### InstalaÃ§Ã£o
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

## ðŸ“ž Suporte

Para suporte tÃ©cnico ou dÃºvidas sobre o sistema, entre em contato com a equipe de desenvolvimento.

## ðŸ“„ LicenÃ§a

Este projeto Ã© propriedade da empresa e seu uso Ã© restrito aos funcionÃ¡rios autorizados.


