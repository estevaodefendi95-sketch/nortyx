## Objetivo

Bloquear cadastro público no sistema. Apenas o administrador pode criar empresas e provisionar usuários. Usuários só conseguem entrar se o admin já tiver criado a conta deles dentro de uma empresa.

---

## Mudanças

### 1. Desativar cadastro público

- Chamar `configure_auth` com `disable_signup: true` para bloquear `supabase.auth.signUp` no backend.
- Em `src/pages/Auth.tsx`: remover/ocultar a aba "Criar conta" e o fluxo de signup. Exibir apenas login (e-mail+senha, Google, Apple). Mostrar aviso: *"Acesso somente por convite. Solicite ao administrador."*
- Remover qualquer link público para `/auth?mode=signup` ou similar.

### 2. Admin cria empresa em `/admin`

Botão **"Nova Empresa"** no cabeçalho de `AdminApproval.tsx` abre `Dialog`:
- Nome, slug (auto a partir do nome), cor primária, logo opcional.
- `INSERT` em `organizations` (RLS já permite a `authenticated` admin).
- Atualiza `allOrgs` localmente.

### 3. Admin cria usuário já configurado

Botão **"Criar Usuário"** no cabeçalho abre `Dialog` único com:
- E-mail, **senha provisória** (ou opção "enviar convite por e-mail")
- Nome de exibição
- **Empresa** (Select de `allOrgs`) — define como `organization_id` principal
- **Papel na empresa**: `member` / `admin` / `owner`
- **Perfil do sistema**: Editor / Visualizador / Administrador → `user_roles`
- **Abas visíveis**: checkboxes (`ALL_TABS`) → `tab_visibility`
- "Já aprovado" (default ligado)

Fluxo no submit → nova edge function `admin-create-user`:
1. Verifica que o caller é admin (via `has_role` ou super user).
2. `supabase.auth.admin.createUser({ email, password, email_confirm: true })` usando `SUPABASE_SERVICE_ROLE_KEY`. Se `password` não for informado, usa `inviteUserByEmail` (convite com link de definir senha).
3. Cria/atualiza `profiles` (display_name, organization_id, approved=true).
4. `INSERT organization_members (user_id, organization_id, role)`.
5. Aplica `user_roles` conforme perfil escolhido.
6. Faz upsert em `tab_visibility` para cada aba.
7. Retorna `{ ok, user_id }`.

Front recarrega `fetchUsers()` ao final.

### 4. Reforço no front

- `useAuth`/rotas: se um usuário logado não tiver nenhuma `organization_members`, deslogar e mostrar mensagem "Conta sem empresa associada — contate o administrador". Hoje já existe `PendingApproval`; reaproveitar com texto atualizado.

---

## Detalhes técnicos

**Arquivos**
- `src/pages/Auth.tsx` — remover signup, manter apenas login + OAuth.
- `src/pages/AdminApproval.tsx` — dois novos diálogos (Nova Empresa, Criar Usuário) e handlers.
- `src/pages/PendingApproval.tsx` — texto atualizado.
- `supabase/functions/admin-create-user/index.ts` — **nova** edge function (usa `SUPABASE_SERVICE_ROLE_KEY`, valida admin do caller).
- `supabase/config.toml` — entrada para a nova função (sem `verify_jwt = false`; vamos validar JWT em código).

**Auth config**
- `disable_signup: true`, `auto_confirm_email: false` (irrelevante pois admin cria com `email_confirm: true`), demais flags inalteradas.

**Sem migrations.** RLS atual cobre todas as escritas necessárias quando feitas pelo service role.

**Fora de escopo**
- Edição/remoção de empresas existentes.
- Auto-vincular invites pendentes anteriores (já tratado por `accept_pending_invites`, mas como signup público está desativado, isso deixa de importar).
- Reset de senha pelo admin (pode ser próxima iteração via `auth.admin.updateUserById`).
