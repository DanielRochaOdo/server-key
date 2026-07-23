# E-mails transacionais com Resend

Os fluxos de Pedido de Compra e Contas a Pagar usam Edge Functions da Supabase
para enviar e-mails pela API HTTPS do Resend.

## Arquitetura

```text
Botão no frontend
  -> Edge Function autenticada e autorizada
  -> POST https://api.resend.com/emails
  -> destinatário
```

- Pedido de Compra chama `send-protocolo-email`. A função consulta os dados
  oficiais do protocolo, monta o template e envia o e-mail.
- Contas a Pagar chama `send-contas-a-pagar-xlsx-email` com `columns`, `rows`,
  `recipients` e `meta`. A função monta a tabela HTML e envia o e-mail.

O frontend envia o JWT somente no cabeçalho `Authorization: Bearer`. A chave do
Resend existe somente nas Edge Functions.

## Secrets

Configure nas Edge Functions:

```text
RESEND_API_KEY
RESEND_FROM_EMAIL
RESEND_REPLY_TO
```

`RESEND_REPLY_TO` é opcional. Não exponha esses Secrets com prefixo `VITE_`,
pois variáveis com esse prefixo são incluídas no bundle do navegador.

O SMTP configurado no Supabase Authentication é independente destas funções.
Os Secrets SMTP antigos só devem ser removidos depois que a versão com Resend
for implantada, testada e monitorada.

## Publicação

Antes de publicar:

1. confirme que o domínio e o remetente estão verificados no Resend;
2. confirme os três Secrets das Edge Functions;
3. revise o diff e confirme o projeto Supabase correto;
4. registre a versão atualmente implantada para permitir rollback.

Comandos previstos, que devem ser executados somente após autorização:

```bash
supabase functions deploy send-protocolo-email
supabase functions deploy send-contas-a-pagar-xlsx-email
```

Depois das funções, publique o frontend pelo processo normal do projeto.
Nenhuma migration de banco é necessária para estes envios.

## Teste

Pedido de Compra:

1. abra um protocolo válido;
2. abra o modal de destinatários;
3. confirme que o botão muda para `Enviando...`;
4. clique rapidamente duas vezes e confirme apenas uma requisição no Network;
5. confirme a mensagem pública de sucesso ou erro.

Contas a Pagar:

1. teste o envio pelo modal atual e por um lote fechado;
2. confirme que `columns`, `rows`, `recipients` e `meta` permanecem no payload;
3. confirme que não existe `access_token` no corpo;
4. confirme que o histórico local registra o resultado público;
5. confirme que a tabela HTML recebida mantém o conteúdo esperado.

Nos dois fluxos, verifique que o JWT aparece apenas no cabeçalho
`Authorization`, sem credenciais do Resend no navegador.

## Painel do Resend

Após um envio autorizado:

1. abra a área de e-mails do projeto Resend;
2. localize o envio pelo horário, remetente e destinatário;
3. confirme o estado de entrega e o identificador do e-mail;
4. compare o identificador com o `emailId` presente somente na resposta técnica
   da Edge Function ou nos logs seguros de desenvolvimento.

Não há fallback para Gmail, retry automático, histórico em banco ou chave de
deduplicação no provedor. A prevenção de clique duplo imediato é feita no
frontend com `useRef`, e o botão sempre é liberado no bloco `finally`.
