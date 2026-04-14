

# Corrigir erro RLS ao criar organização no onboarding

## Problema
O erro "new row violates row-level security policy for table organizations" ocorre porque o código faz `.insert().select().single()`. O Supabase precisa que a policy de SELECT também passe ao usar `.select()` após INSERT. Porém, a policy de SELECT exige que o usuário já seja membro da organização — e neste momento ele ainda não foi adicionado à `organization_members`.

## Solução

Criar uma função SQL `SECURITY DEFINER` que faz tudo atomicamente numa única transação:
1. Cria a organização
2. Adiciona o usuário como `owner` em `organization_members`
3. Atualiza o `profiles` com o `organization_id`
4. Retorna o ID da organização criada

### Alterações

**1. Migração SQL** — criar função `create_organization_with_owner`:
- Parâmetros: `_name text`, `_slug text`, `_user_id uuid`
- SECURITY DEFINER para bypassar RLS
- Retorna o `id` da organização criada
- Faz INSERT em `organizations`, `organization_members` e UPDATE em `profiles`

**2. Atualizar `src/pages/Onboarding.tsx`**:
- Substituir os 3 queries separados por uma chamada `supabase.rpc('create_organization_with_owner', { ... })`
- Simplifica o código e elimina o problema de RLS

