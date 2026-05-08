## Anexar boleto e NF nas cobranças

Permitir anexar **boleto** e **nota fiscal** (PDF, JPG ou PNG) tanto no momento do lançamento da entrada quanto ao editar uma cobrança existente na área de Clientes. No e-mail enviado ao cliente, os arquivos serão incluídos como **links de download** (o sistema de e-mail do app não suporta anexos binários — a alternativa padrão é o link, com a mesma utilidade prática para o cliente).

### 1. Banco de dados

Nova migração:
- Adiciona em `billing_charges` as colunas `boleto_url text` e `nf_url text` (nullable).
- Cria o bucket de storage **`billing-attachments`** (privado).
- Políticas de storage: somente membros da empresa dona da cobrança podem ler/enviar/excluir arquivos do próprio `organization_id/...`. Super user com acesso total.

Caminho dos arquivos: `billing-attachments/{organization_id}/{charge_id}/boleto.{ext}` e `.../nf.{ext}`.

### 2. Lançamento de entrada (`TransactionForm.tsx`)

Dentro do bloco "Vincular cliente para cobrança":
- Dois campos novos: **Boleto** e **Nota Fiscal**, cada um com botão "Selecionar arquivo" (aceitando `.pdf,.jpg,.jpeg,.png`, limite ~10MB) e indicação do nome do arquivo escolhido.
- Validação: se o arquivo tiver tipo/tamanho inválido, bloqueia o envio com mensagem clara.
- Ao salvar:
  1. Cria/atualiza o cliente.
  2. Insere a(s) cobrança(s) (já com `organization_id`).
  3. Faz upload dos arquivos para o bucket no caminho da **primeira cobrança** apenas (recorrentes ficam sem anexo até serem editadas, conforme escolha).
  4. Atualiza essa cobrança com `boleto_url` / `nf_url` (URL pública assinada do path).
- Se algum upload falhar, mostra toast de aviso mas mantém a cobrança criada.

### 3. Edição de cobrança (`ClientsView.tsx`)

No formulário de edição de cobrança (já existente):
- Adicionar duas linhas: **Boleto** e **Nota Fiscal**.
  - Se já existe arquivo: mostra link "Visualizar", botão "Substituir" e botão "Remover".
  - Se não existe: botão "Anexar arquivo".
- Mesma validação de tipo/tamanho.
- "Salvar" persiste qualquer troca (upload + update da coluna; remoção apaga o arquivo do storage e zera a coluna).

### 4. Visualização auxiliar

- Na listagem compacta de cada cobrança em `ClientsView.tsx`, mostrar pequenos ícones (📎 boleto / 📄 NF) clicáveis quando os arquivos existirem, abrindo em nova aba.
- Mesmos ícones aparecem no calendário (`CalendarView.tsx`) dentro do popover/tooltip da cobrança.

### 5. E-mail de cobrança (`send-billing-email` + template `billing-reminder`)

- Buscar `boleto_url` e `nf_url` ao montar o e-mail.
- Passar via `templateData` para o template React Email.
- O template renderiza dois botões/links extras quando os campos estão presentes: "Baixar boleto" e "Baixar nota fiscal".
- Caso ambos estejam vazios, o e-mail fica idêntico ao atual.
- Importante: o pipeline de e-mail do app não envia arquivo como anexo; usamos link de download (URL assinada de longa validade ou pública via storage). Isso garante que o cliente receba os documentos clicando no e-mail.

### 6. Detalhes técnicos

- Helper único `uploadChargeAttachment(chargeId, kind: 'boleto'|'nf', file)` em `src/lib/billingAttachments.ts` para reaproveitar entre `TransactionForm` e `ClientsView`.
- URL armazenada: usar `getPublicUrl` se o bucket for público, ou `createSignedUrl` com validade longa (ex.: 1 ano) e regenerar quando o e-mail for enviado.
- Ao excluir uma cobrança, também remover os objetos correspondentes no storage (best-effort).
