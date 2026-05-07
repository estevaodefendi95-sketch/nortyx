## Diagnóstico

As cobranças lançadas na aba **Lançamento** (quando o usuário marca "Cliente de cobrança") estão **sendo descartadas pela RLS** do banco, porque os `INSERT` em `billing_clients` e `billing_charges` no `TransactionForm.tsx` (linhas 608‑641) **não enviam `organization_id`** — e a policy `Org members can insert ...` exige `organization_id = get_user_org_id(auth.uid())`. Resultado: a entrada salva, mas a cobrança "some" silenciosamente.

A `CalendarView` já tem a infraestrutura completa de leitura, agrupamento por dia e renderização de cobranças (`selectedBillingCharges`, `billingChargesByDay`), mas como nada chega ao banco, nada aparece no calendário.

## Mudanças

### 1. `src/components/TransactionForm.tsx` — corrigir inserts
- Importar `useOrganization` e pegar `organization?.id`.
- Incluir `organization_id: organization.id` nos `insert` de:
  - `billing_clients` (linha ~610)
  - cada item de `chargesData` para `billing_charges` (linha ~631)
- Bloquear o salvamento da cobrança caso `organization` ainda não esteja carregado, com toast claro.

### 2. `src/components/CalendarView.tsx` — robustez na exibição
- Filtrar `billing_charges` por `organization_id` no fetch (já é feito por RLS, mas tornar explícito) e **recarregar quando uma transação de entrada é criada/editada**, escutando o canal Realtime de `billing_charges` (igual ao padrão usado em `TransactionsContext`). Sem isso, o usuário precisa recarregar a página para ver a cobrança recém‑lançada.
- Garantir que cada chip do dia mostre um marcador visual quando há cobranças (já existe `getDayIncomeTotal` somando, mas conferir se há ícone/dot indicando cobrança vs entrada manual; se não, adicionar um pequeno `User` icon no canto da célula quando `billingChargesByDay.has(day)`).

### 3. Nenhuma migração necessária
Schema e RLS já estão corretos.

## Arquivos afetados

- `src/components/TransactionForm.tsx`
- `src/components/CalendarView.tsx`