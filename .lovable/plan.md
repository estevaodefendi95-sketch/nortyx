## Diagnóstico

Hoje existem **dois tipos de duplicação convivendo**:

1. **Duplicatas reais em `daily_incomes`** (mesma data + valor + organização aparecendo 2x). Encontrei 12 linhas assim (pares em 12/05, 13/05 x2, 15/05, 19/05, 20/05). Como há **duas** linhas de entrada com a mesma data e valor, mesmo o filtro de dedup atual (que esconde a cobrança paga) ainda soma a entrada em dobro.
2. **Entrada + cobrança paga com mesmo dia/valor**: já é coberto por `dedupeChargesAgainstIncomes`, mas o problema #1 atrapalha o resultado.

Também identifiquei que o vínculo entrada↔cobrança no diálogo de importação já impede que duas entradas selecionem a mesma cobrança (`handleChangeChargeLink` faz "transferência"), mas falta a mesma garantia ao salvar (caso a UI mude no futuro ou em aprovações em lote).

## O que vou fazer

### 1. Limpeza dos dados atuais
- Apagar de `daily_incomes` toda linha que seja "irmã duplicada" de outra (mesma `organization_id` + `data` + `valor`), mantendo apenas a de menor `id`.
- Resultado esperado: cair de 12 linhas conflitantes para 6 (uma por grupo). As cobranças pagas continuam representando o dinheiro; o dedup nas views esconde a cobrança e mostra só a entrada — sem dobrar.

### 2. Prevenção no app (sem mexer em schema)
- `TransactionsContext.addDailyIncome`: antes de inserir, verificar se já existe um `daily_income` com mesma `data` + `valor` na organização. Se existir, **não inserir** e retornar `true` (idempotente), exibindo a entrada existente.
- `TransactionForm` (fluxos `approveBankEntry` e `approveAllBankEntries`):
  - Manter a remoção de duplicados de `daily_incomes` quando aprovar entrada vinculada a cobrança (já existe).
  - Antes de marcar a cobrança como `paga`, garantir que **nenhuma outra entrada do lote** está vinculada à mesma `matchedChargeId` (defesa extra além do que `handleChangeChargeLink` já faz na UI).
  - Ao aprovar entrada **não vinculada**, usar a nova checagem de idempotência do contexto (evita criar duplicata se o usuário aprovar duas vezes ou re-importar).

### 3. Reforço de exibição
- Revisar `DadosView`, `CalendarView` e `useReportData` para também **deduplicar `daily_incomes` entre si** (não só contra `billing_charges`) no cálculo de faturamento, blindando contra qualquer duplicata residual.

### 4. Verificação
- Rodar consulta de auditoria pós-limpeza para confirmar 0 duplicatas em `daily_incomes` e 0 pares "entrada + cobrança paga" somando em dobro.
- Conferir no preview que o faturamento dos dias 12/05, 13/05, 15/05, 19/05 e 20/05 caiu para o valor correto (sem dobro).

## Detalhes técnicos

- **SQL de limpeza** (executado como `insert`/delete via tool):
  ```sql
  DELETE FROM public.daily_incomes a
  USING public.daily_incomes b
  WHERE a.organization_id = b.organization_id
    AND a.data = b.data
    AND a.valor = b.valor
    AND a.id > b.id;
  ```
- **`addDailyIncome` idempotente**: checar no estado local primeiro (rápido) e, se passar, no banco com `.select().eq(...)` antes do `insert`.
- **Helper novo** em `src/lib/incomeDedup.ts`: `dedupeDailyIncomes(list)` que remove duplicatas exatas (mesma data+valor) mantendo a primeira ocorrência. Usado nas 3 views.
- **Sem alterações de schema** (nenhuma migração). Sem mexer em `client.ts` ou `types.ts`.

## Fora de escopo
- Não vou adicionar `UNIQUE INDEX` no banco agora porque duas entradas legítimas de mesmo valor no mesmo dia (ex.: duas vendas iguais) poderiam ser bloqueadas. A proteção será só no fluxo de vínculo com cobrança.
