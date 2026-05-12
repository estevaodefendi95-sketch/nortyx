## Objetivo

Após importar o extrato (PDF/OFX/CSV), identificar automaticamente — pelo valor e dentro do período — os lançamentos do extrato que correspondem a:

1. **Cobranças** existentes (`billing_charges` com status `pendente`/`atrasado`) → entradas
2. **Saídas agendadas** já cadastradas (`transactions` com `agendado=true && pago=false`) → débitos

Antes de aplicar qualquer mudança, **abrir um diálogo de aprovação** listando os matches encontrados. O usuário escolhe item a item (com opção "aprovar todos") quais correspondências aceitar. Apenas os aprovados terão o status alterado:
- Cobrança casada e aprovada → `billing_charges.status = 'paga'`
- Saída agendada casada e aprovada → `transactions.pago = true` (atualiza data se diferente; **não duplica**)

Itens não casados ou recusados seguem o fluxo normal (criam novo `daily_income` ou `transaction`).

## Mudanças

### 1. `src/lib/bankParser.ts`
Adicionar campos opcionais em `ParsedBankEntry`:
- `matchedChargeId?: string`
- `matchedChargeClient?: string`
- `matchedTransactionId?: number`
- `matchedTransactionEmpresa?: string`
- `matchedTransactionDate?: string` (BR)

### 2. `src/components/TransactionForm.tsx` — detecção de matches
Em `applyImportEntries`, após enriquecer entries e antes de finalizar:
- **Entradas**: consultar `billing_charges` da org com status `pendente`/`atrasado`. Casar 1‑para‑1 por valor (tolerância 0,01), priorizando `data_cobranca` mais próxima da data do extrato. Preencher `matchedChargeId`/`matchedChargeClient`.
- **Saídas**: incluir transações `agendado=true && pago=false` no conjunto de candidatos a casar (independente do modo add/replace), 1‑para‑1 por valor, no período do extrato (±15 dias). Preencher `matchedTransactionId`.

### 3. Novo diálogo "Confirmar correspondências"
Aparece **logo após** o diálogo de aprovação de mudança de data (ou direto, se não houver), antes de `finalizeImport`. Conteúdo:
- Lista agrupada: "Cobranças identificadas" e "Contas agendadas identificadas"
- Cada linha: descrição do extrato, valor, data, → match (cliente / empresa+data agendada), checkbox aprovar
- Botões: "Aprovar todos", "Recusar todos", "Confirmar"

Estado novo: `matchCandidates`, `approvedMatchIds: Set<number>` (entry.id), `showMatchApprovalDialog`.

### 4. Aprovação dos lançamentos (`approveBankEntry` / `approveAllBankEntries`)
- Se `entry.matchedTransactionId` **e** o usuário aprovou o match: `updateTransaction(matchedId, { pago: true, data: dataBR })`; **não** chamar `addTransaction`.
- Se `entry.matchedChargeId` **e** aprovado: `update billing_charges set status='paga' where id = matchedChargeId` (substitui a busca atual por valor, que pode casar com cobrança errada).
- Caso contrário: comportamento atual (cria novo registro).

### 5. UI da tabela de revisão
Mostrar badge ao lado da descrição quando `matchedFrom` indica match aprovado:
- "Cobrança: <cliente>" (verde)
- "Agendado: <empresa> <data>" (âmbar)

## Fora do escopo
- Não alterar parser/formatos de banco
- Não criar tabelas novas
- Não mexer em DDA, fornecedores, recorrência

## Arquivos
- `src/lib/bankParser.ts`
- `src/components/TransactionForm.tsx`

## Verificação
1. Período do extrato contém cobrança pendente de R$ X → diálogo lista o match → aprovar → após aprovar o lançamento, `billing_charges.status='paga'` no id correto.
2. Recusar o match → cobrança permanece pendente, entrada vira `daily_income` normal.
3. Período contém conta agendada de R$ Y não paga → diálogo lista → aprovar → conta agendada vira paga, **sem duplicata** na lista de transações.
4. Sem matches → diálogo não aparece, fluxo segue direto.