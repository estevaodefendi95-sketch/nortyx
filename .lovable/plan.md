## Objetivo

Garantir que o usuário administrador master (`estevaodefendi95@gmail.com`) tenha acesso completo a todas as empresas e a todos os usuários, sem precisar de papel `admin` na tabela `user_roles` nem de pertencer a uma empresa.

## Situação atual

- O contexto de organizações já reconhece o super user e lista todas as empresas para troca.
- Porém o super user é bloqueado em `/admin` e `/admin/history` porque o `AdminRoute` valida apenas `isAdmin` (papel `admin` em `user_roles`).
- Mesmo entrando na tela, várias consultas usadas em `AdminApproval` falham por RLS para o super user:
  - `profiles` (SELECT só permitido a admins via `has_role`)
  - `user_roles` (SELECT só para admins via `has_role`)
  - `tab_visibility` (SELECT exige `has_role` admin)
  - `organization_members` (sem SELECT explícito para super user)
  - Operações de update em `profiles.approved`, insert/delete em `user_roles` e upsert em `tab_visibility` também não cobrem o super user.

## Mudanças

### 1. Frontend — tratar super user como admin

- `src/hooks/useAuth.tsx`: marcar `isAdmin = true` automaticamente quando `user.email === 'estevaodefendi95@gmail.com'`, mesmo sem linha em `user_roles`. Isso libera o `AdminRoute`, os botões e as telas `/admin` e `/admin/history`.

### 2. Backend — políticas RLS para o super user

Adicionar políticas `USING is_super_user(auth.uid())` (e `WITH CHECK` correspondente) nas tabelas usadas pelas telas administrativas:

- `profiles`: SELECT (todas), e já existe UPDATE; manter.
- `user_roles`: SELECT, INSERT, UPDATE, DELETE para super user (necessário para alterar perfil de usuários).
- `tab_visibility`: SELECT, INSERT, UPDATE, DELETE para super user.
- `organization_members`: garantir SELECT explícito para super user (a policy `Super user manage members` cobre ALL, mas confirmar que não está mascarada por outras restrictive — caso contrário, adicionar SELECT dedicada).
- `audit_log`: já coberto.

As edge functions `admin-create-user` e `admin-delete-user` já reconhecem o super user por email, então não precisam mudar.

### 3. Verificação

- Logar como master, acessar `/admin`: deve listar todos os usuários de todas as empresas, permitir aprovar/reprovar, alterar papel, ajustar abas, vincular/desvincular empresas e definir empresa principal.
- O seletor de empresa no cabeçalho continua mostrando todas as empresas (já implementado).

## Detalhes técnicos

- Não criar role `admin` para o super user no banco — manter o reconhecimento por email para evitar acoplamento.
- Todas as novas policies usam `is_super_user(auth.uid())`, função SECURITY DEFINER já existente, evitando recursão.
- Nenhuma alteração em `client.ts` ou `types.ts`.
