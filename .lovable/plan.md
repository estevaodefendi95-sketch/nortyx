## Diagnóstico

Confirmado no banco:
- Usuário `nortyx.` (`ee14e46e…`) tem **2 memberships**: `Lema.` (owner) e `nortyx.` (member).
- RLS de `organization_members` e `organizations` permite enxergar ambas.
- O código atual em `OrganizationContext.tsx` já popula `availableOrganizations` para usuários comuns com 2+ memberships, e `Index.tsx` mostra o popover quando `availableOrganizations.length > 1`.

Apesar disso, o screenshot do usuário `nortyx.` (logado como Lema.) não mostra o ícone `Building2` ao lado do nome da empresa — ou seja, o estado `availableOrganizations` está chegando com tamanho ≤ 1 em runtime.

Causas prováveis (a confirmar com instrumentação):
1. A query `organizations .in("id", orgIds)` está retornando 1 só registro por algum motivo de RLS/cache.
2. O contexto está re-rodando e sobrescrevendo `availableOrganizations` com `[]` (linha 91, branch não-super) sem voltar a popular caso a query `memberships` falhe silenciosamente.
3. Estado pré-cached no navegador (não recarregou após o último deploy).

## Plano de correção

### 1) Endurecer `OrganizationContext.tsx`
- Não zerar `availableOrganizations` para `[]` no início do branch não-super; só atribuir após o resultado real.
- Logar (`console.warn`) quando `memberships.length > 1` mas `availableOrganizations` terminar com `< 2` itens, com os erros das queries de `organization_members` e `organizations`.
- Garantir que mesmo se a query de `organizations` falhar, montamos um fallback mínimo a partir de `memberships` (id + nome resolvido depois) para não ocultar o switcher.
- Ordenar `availableOrganizations` deixando a empresa ativa primeiro (cosmético).

### 2) Tornar o switcher mais resiliente em `Index.tsx`
- Mudar a condição do popover para `availableOrganizations.length > 1 || (availableOrganizations.length === 1 && availableOrganizations[0].id !== organization?.id)` — defensivo contra estados intermediários.
- Manter aparência atual (ícone `Building2` + popover com lista).

### 3) Forçar refresh quando memberships mudarem
- Em `OrganizationContext`, escutar mudanças realtime na tabela `organization_members` filtradas por `user_id` do usuário logado. Quando houver INSERT/DELETE para esse usuário, chamar `refreshOrganization()`.
- Isso garante que se o admin acabou de adicionar a 2ª empresa para `nortyx.`, ele veja o switcher sem precisar deslogar.

### 4) Verificação
- Após aplicar, abrir o preview com a sessão de `nortyx.`, conferir no console:
  - `memberships.length === 2`
  - `availableOrganizations.length === 2`
  - ícone `Building2` aparece e o popover lista `Lema.` e `nortyx.`.
- Se ainda assim não aparecer, os logs do passo 1 vão apontar exatamente qual query devolveu menos linhas que o esperado.

## Arquivos afetados
- `src/context/OrganizationContext.tsx` — fallback robusto + logs + assinatura realtime de `organization_members`.
- `src/pages/Index.tsx` — condição defensiva no switcher (mudança mínima).

## Fora do escopo
- Mudanças no `AdminApproval`, em RLS, ou no fluxo de convite/onboarding.
