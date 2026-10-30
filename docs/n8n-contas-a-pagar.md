# Integração n8n com Contas a Pagar

## Identificação do PDF

Cada conta tem um código permanente, exibido na coluna **Protocolo** do módulo. O nome do PDF deve começar com esse código, entre colchetes:

```text
[DB3-001] fatura novembro.pdf
```

O prefixo é sugerido pelo nome do fornecedor: as três primeiras consoantes, com preservação automática de siglas alfanuméricas no início, como `DB3`. O cadastro permite ajustar a sigla antes de salvar. O número é sequencial por prefixo e não muda depois da criação.

## Workflow

Mantenha os nós atuais até o **Information Extractor**. Depois dele, acrescente:

1. **IF**: continue somente quando `output.necessita_revisao` for `false`, houver vencimento, valor positivo e empresa emissora.
2. Na saída aprovada, use um **HTTP Request** para chamar a Edge Function.
3. Na saída de revisão, não chame a função; encaminhe o arquivo para análise manual.

O endpoint extrai o código do começo do nome do arquivo. No HTTP Request, envie:

- Method: `POST`
- URL: `https://<project-ref>.supabase.co/functions/v1/n8n-contas-a-pagar`
- Header `Content-Type`: `application/json`
- Header `x-n8n-secret`: o segredo configurado no n8n e no Supabase
- Body Content Type: `JSON`

No campo **JSON Body**, use uma expressão que monte o objeto. Ajuste os nomes dos nós para corresponderem aos do seu workflow:

```javascript
={{ ({
  drive_file_id: $('Google Drive Trigger').item.json.id,
  nome_arquivo: $('Google Drive Trigger').item.json.name,
  empresa_emissora: $json.output.empresa_emissora,
  vencimento: $json.output.vencimento,
  valor: $json.output.valor,
  necessita_revisao: $json.output.necessita_revisao,
  observacao: $json.output.observacao,
}) }}
```

Se o nó **Information Extractor** não mantiver os dados do Google Drive no mesmo item, recupere o `id` e o `name` por referência ao nó **Google Drive Trigger**, como no exemplo. O n8n permite referenciar dados de nós anteriores por expressão.

## Respostas e comportamento

- HTTP `200`: conta atualizada; `duplicate: true` significa que o mesmo arquivo já foi processado.
- HTTP `400`: nome/código, arquivo, vencimento ou valor inválido.
- HTTP `401`: segredo ausente ou incorreto.
- HTTP `404`: código não cadastrado.
- HTTP `422`: documento requer revisão ou foi associado a outro código.

O ID do Drive é usado para impedir aplicação repetida do mesmo arquivo. A função atualiza o valor e o dia do vencimento da conta e grava a competência correspondente ao mês/ano extraídos. Ela não altera lotes já criados.

## Ativação no Supabase

1. Aplique a migration `supabase/migrations/20261029130000_contas_a_pagar_codigo_integracao.sql` antes de usar os códigos no módulo.
2. Crie um segredo longo para a integração e cadastre-o como segredo `N8N_WEBHOOK_SECRET` na Edge Function e como credencial/variável no n8n.
3. Faça deploy da função `n8n-contas-a-pagar`.
4. Teste com um PDF de uma conta de homologação e confirme o protocolo, o valor, o dia de vencimento e a competência no módulo.

Nunca coloque a chave `service_role` no n8n. O workflow usa somente o segredo próprio da integração.
