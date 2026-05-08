# Leitor de boleto/NF na entrada de cobrança

Hoje, no formulário de lançamento, ao marcar **"Vincular cliente para cobrança"** o usuário precisa digitar manualmente nome, e-mail, valor, data e anexar boleto/NF. A proposta é permitir **enviar o boleto e/ou a NF primeiro**, deixar a IA ler os arquivos, **identificar o cliente** (existente ou novo), **preencher automaticamente** todos os campos e exigir uma **tela de revisão/aprovação** antes de salvar.

## Fluxo de uso

1. Em "Lançamento" → Tipo **Entrada**, abre-se uma nova ação acima da seção de cobrança: **"Ler boleto / NF para preencher"**.
2. Usuário envia 1 arquivo de boleto (PDF/JPG/PNG) e/ou 1 arquivo de NF (PDF/JPG/PNG) — mesmas regras já usadas em anexos (até 10MB, validação via `validateAttachment`).
3. Aparece um indicador "Lendo documento..." enquanto a edge function processa.
4. Volta um **dialog de revisão "Confirmar dados extraídos"** mostrando, lado a lado, os campos lidos e quem foi reconhecido:
   - Cliente (nome, e-mail, telefone) — com badge "Cliente existente" (match em `billing_clients` por e-mail ou nome) ou "Novo cliente".
   - Valor, data de vencimento, descrição/empresa.
   - Forma de cobrança sugerida (boleto, pix, etc.).
   - Pré-visualização miniatura dos arquivos enviados.
5. Usuário pode editar qualquer campo nesse dialog.
6. Botões: **"Cancelar"** e **"Aprovar e preencher"**. Ao aprovar:
   - Os campos são jogados no formulário principal (`empresa`, `valor`, `data`, e `billingClient.*`).
   - Os arquivos enviados ficam pendurados no estado `boletoFile` / `nfFile` já existentes para serem feitos upload no `handleSubmit` (sem upload duplicado agora).
   - A seção de cobrança é aberta automaticamente (`setShowBilling(true)`).
7. O usuário ainda precisa clicar em **"Salvar"** normal — a aprovação só preenche; ela não persiste sozinha. Isso garante o "solicitar aprovação" pedido.

## Identificação do cliente

- Match preferencial: e-mail (case-insensitive) na lista já carregada de `billing_clients` da organização.
- Fallback: nome normalizado (lowercase + trim) com similaridade simples.
- Se não houver match → "Novo cliente" (será criado no submit pelo fluxo já existente).

## Mudanças técnicas

### Nova edge function `supabase/functions/read-billing-doc/index.ts`
- Espelha o padrão de `extract-dda` (Lovable AI Gateway, `google/gemini-2.5-flash`, vision).
- Aceita `{ boleto?: { base64, mimeType }, nf?: { base64, mimeType }, knownClients: [{nome,email}] }`.
- Prompt em PT-BR pedindo extrair: `cliente_nome`, `cliente_email`, `cliente_telefone`, `valor` (decimal), `data_vencimento` (YYYY-MM-DD), `descricao`, `forma_cobranca` ("boleto"|"pix"|"transferencia"|"cartao"). Para boleto, identificar o **sacado/pagador** (não o beneficiário). Para NF, identificar o **tomador**. Quando ambos existirem, priorizar dados da NF para nome/e-mail e dados do boleto para valor/vencimento.
- Inclui no prompt a lista de clientes conhecidos para que a IA use exatamente o mesmo `nome`/`email` quando reconhecer.
- Retorna JSON único `{ extracted: {...}, matchedClientId?: string }`.
- `verify_jwt` segue o padrão dos outros (default).

### `src/components/TransactionForm.tsx`
- Novo estado: `pendingBoletoFile`, `pendingNfFile`, `extractDialogOpen`, `extractedData`, `isExtracting`.
- Novo bloco UI dentro da seção de cobrança (visível quando `tipo === "entrada"`), antes dos campos manuais:
  - Botão **"Ler boleto/NF e preencher"** que abre input de arquivo (aceita múltiplos: 1 boleto + 1 NF, identificados por toggle).
  - Após upload converte para base64 e chama `supabase.functions.invoke("read-billing-doc", ...)`.
  - Abre `Dialog` de confirmação (componente novo inline) com formulário editável.
  - Ao "Aprovar": faz `setBillingClient(...)`, `setEmpresa`, `setValor`, `setData`, `setBoletoFile(pendingBoletoFile)`, `setNfFile(pendingNfFile)`, `setShowBilling(true)`, fecha o dialog.
- Não muda `handleSubmit`: o upload dos anexos já acontece via `uploadChargeAttachment` no fluxo existente.

### Nada de mudanças em DB nem em storage
- Reaproveita `billing-attachments` bucket, colunas `boleto_url` / `nf_url` já criadas, e `billingAttachments.ts`.

## Fora de escopo
- Não altera o leitor de DDA (saídas/extrato) — fica restrito à entrada/cobrança.
- Não cria automação para enviar e-mail de cobrança após aprovação; o envio segue o botão atual.
- Não persiste nada antes da aprovação — arquivos só sobem após o "Salvar".
