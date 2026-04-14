

# Corrigir recursão infinita nas políticas de `organization_members`

## Problema
As políticas RLS da tabela `organization_members` fazem subqueries na própria tabela `organization_members`, causando recursão infinita. Por exemplo, a policy de SELECT verifica `organization_id IN (SELECT ... FROM organization_members WHERE user_id = auth.uid())` — isso dispara a própria policy de SELECT novamente, em loop.

## Solução
Substituir todas as subqueries auto-referentes por chamadas à função `get_user_org_id(auth.uid())` que já existe como SECURITY DEFINER (bypassa RLS).

## Alterações

### 1. Migração SQL — recriar as políticas de `organization_members`

Dropar e recriar as 5 políticas existentes:

- **SELECT**: `user_id = auth.uid() OR organization_id = get_user_org_id(auth.uid())`
- **INSERT (owners)**: `organization_id = get_user_org_id(auth.uid()) AND has_role(...)` (para admins adicionarem membros)
- **INSERT (self)**: `user_id = auth.uid()` (manter — sem subquery)
- **UPDATE**: `organization_id = get_user_org_id(auth.uid()) AND has_role(...)`
- **DELETE**: `organization_id = get_user_org_id(auth.uid()) AND has_role(...)`

### 2. Atualizar `get_user_org_id` para suportar múltiplas orgs (opcional)

A função atual retorna apenas 1 org. Para o caso do onboarding (usuário acabou de criar a org e inserir a si mesmo como membro), a policy de INSERT self (`user_id = auth.uid()`) já cobre o cenário sem precisar da função.

Nenhuma alteração no frontend é necessária.

