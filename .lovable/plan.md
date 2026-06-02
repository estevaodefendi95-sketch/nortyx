# Filtro de visibilidade da Folha de Pagamento

Adicionar a **Folha de Pagamento** ao sistema existente de visibilidade por usuário (`tab_visibility`), gerenciado em **Configurações da Empresa**.

## Mudanças

1. **`src/hooks/useTabVisibility.ts`** — incluir `"payroll"` em `ALL_TABS` para que apareça na lista de itens controlados.

2. **`src/pages/OrgSettings.tsx`** — adicionar `{ id: "payroll", label: "Folha de Pagamento" }` em `ALL_TABS`, fazendo aparecer um switch por usuário na seção de visibilidade. O fluxo de salvamento existente já faz upsert em `tab_visibility` por (organization_id, user_id, tab_id).

3. **`src/pages/Index.tsx`** — no bloco da aba Lançamento, condicionar `<PayrollView />` a `visibleTabs.includes("payroll")`. A aba Lançamento em si continua independente.

## Sem alterações no banco

A tabela `tab_visibility` já suporta qualquer `tab_id` arbitrário — basta usar `"payroll"` como identificador. Default (sem registro) = visível, mantendo o comportamento atual para todos os usuários.