# Corrigir duplicação ao importar extrato vinculado a cobranças

## Problema

No fluxo de importação de extrato bancário (`src/components/TransactionForm.tsx`), quando uma transação do tipo `entrada` é vinculada a uma cobrança (`matchedChargeId`), o sistema:

1. Cria um lançamento em `daily_incomes` via `addDailyIncome(...)` — **gera entrada duplicada**
2. **E** marca a cobrança como `paga` em `billing_charges`

Como a cobrança já é contabilizada como entrada na receita, o resultado é que o mesmo valor aparece duas vezes no faturamento.

## Correção

Em `src/components/TransactionForm.tsx`, ajustar tanto `approveBankEntry` (aprovar uma) quanto `approveAllBankEntries` (aprovar todas):

- Se `entry.tipo === "entrada"` **e** `entry.matchedChargeId` existe → **NÃO** chamar `addDailyIncome`. Apenas executar `UPDATE billing_charges SET status = 'paga'` para o id vinculado e marcar a entry como `approved`.
- Se `entry.tipo === "entrada"` **sem** match de cobrança → manter comportamento atual (`addDailyIncome`).
- Saídas com `matchedTransactionId` já estão corretas (apenas atualizam o agendado).

### Trechos afetados

`approveBankEntry` (~linhas 556–609): reordenar os ramos para tratar `entrada + matchedChargeId` antes de `addDailyIncome`, retornando após marcar a cobrança como paga, com toast informando "Cobrança quitada — sem duplicar lançamento".

`approveAllBankEntries` (~linhas 611–667): no loop, quando `entry.tipo === "entrada"` e `matchedChargeId`, pular `addDailyIncome`, marcar `saved = true` apenas após o `UPDATE` da cobrança, e contabilizar em `chargesMarked`.

## Fora do escopo

- Sem alterações de schema, RLS ou backend.
- Sem alterações nas demais abas/contextos.
- Comportamento de saídas vinculadas a agendados permanece inalterado.
