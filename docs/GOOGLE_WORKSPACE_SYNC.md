# Google Workspace Sync (Rateio Email)

Este repositÃ³rio inclui uma sincronizaÃ§Ã£o recorrente (cron) para manter um catÃ¡logo local de contas corporativas do Google Workspace no Supabase.

## O que foi adicionado

- MigraÃ§Ã£o (tabelas + RLS):
  - `supabase/migrations/20260127111000_google_workspace_catalog.sql`
  - Tabelas: `public.google_workspace_accounts`, `public.google_workspace_sync_state`
- Edge Function (DWD + Directory API):
  - `supabase/functions/google-workspace-sync/index.ts`
- Cron (GitHub Actions):
  - `.github/workflows/google-workspace-sync.yml`

DomÃ­nios sincronizados:
- `odontoart.com`
- `odontoartonline.com.br`

## PrÃ©-requisitos (Google)

1) Criar Service Account no Google Cloud
2) Habilitar **Domain Wide Delegation (DWD)**
3) No Admin Console, autorizar o **Client ID** da service account
4) Scopes mÃ­nimos:
   - `https://www.googleapis.com/auth/admin.directory.user.readonly`
5) Definir um admin do Workspace para **impersonaÃ§Ã£o** (subject) por domÃ­nio

## Secrets / VariÃ¡veis

### Supabase (Edge Function)

Defina em **Project Settings â†’ Functions â†’ Secrets**:

- `GOOGLE_WORKSPACE_SYNC_SECRET`: segredo compartilhado (header `x-sync-secret`)
- `GOOGLE_SA_CLIENT_EMAIL`: `client_email` do JSON da service account
- `GOOGLE_SA_PRIVATE_KEY`: `private_key` do JSON (pode conter `\\n`)
- `GOOGLE_ADMIN_SUBJECTS_JSON`: JSON com admin por domÃ­nio, ex.:
  - `{"odontoart.com":"ti.admin@odontoart.com","odontoartonline.com.br":"ti.admin@odontoartonline.com.br"}`

### Workspaces diferentes (multi-tenant)
Se cada domÃƒÂ­nio estiver em **um Google Workspace diferente**, use **credenciais por domÃƒÂ­nio**:

- `GOOGLE_DOMAIN_CREDENTIALS_JSON`: JSON com `client_email`, `private_key` e `subject` por domÃƒÂ­nio.

Exemplo:
```json
{
  "odontoart.com": {
    "client_email": "sa-odontoart@project.iam.gserviceaccount.com",
    "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
    "subject": "daniel.rocha@odontoart.com"
  },
  "odontoartonline.com.br": {
    "client_email": "sa-odontoartonline@project.iam.gserviceaccount.com",
    "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
    "subject": "tecnologia@odontoartonline.com.br"
  }
}
```

> Se `GOOGLE_DOMAIN_CREDENTIALS_JSON` estiver definido, ele tem prioridade sobre `GOOGLE_SA_CLIENT_EMAIL/GOOGLE_SA_PRIVATE_KEY/GOOGLE_ADMIN_SUBJECTS_JSON`.

### GitHub Actions (cron)

Em **GitHub â†’ Settings â†’ Secrets and variables â†’ Actions**:

- `SUPABASE_URL`: ex. `https://<project-ref>.supabase.co`
- `GOOGLE_WORKSPACE_SYNC_SECRET`: mesmo valor do Supabase

## Como rodar manualmente (curl)

```bash
curl -sS -X POST "$SUPABASE_URL/functions/v1/google-workspace-sync" \
  -H "Content-Type: application/json" \
  -H "x-sync-secret: $GOOGLE_WORKSPACE_SYNC_SECRET" \
  -d '{"mode":"full","domains":["odontoart.com","odontoartonline.com.br"]}'
```

## EstratÃ©gia de sync

- FULL sync:
  - Upsert por `google_id` (identidade estÃ¡vel)
  - `deleted=false` para quem apareceu no ciclo
  - ApÃ³s concluir, marca `deleted=true` para registros do domÃ­nio com `last_synced_at < runStartedAt` (soft delete)

## IntegraÃ§Ã£o no mÃ³dulo (Rateio Google)

O formulÃ¡rio `src/components/RateioGoogleForm.tsx` valida o campo **Email** contra o catÃ¡logo `google_workspace_accounts`:
- Bloqueia salvar se o e-mail nÃ£o existir no catÃ¡logo
- Bloqueia salvar se estiver `suspended=true` ou `deleted=true`

## Queries de validaÃ§Ã£o (SQL)

1) Ver contas ativas:
```sql
select primary_email, full_name, domain, suspended, deleted, last_synced_at
from public.google_workspace_accounts
where deleted = false and suspended = false
order by primary_email;
```

2) Ver status do sync:
```sql
select *
from public.google_workspace_sync_state
order by domain;
```
