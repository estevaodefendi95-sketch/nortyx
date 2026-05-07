## Objetivo

Permitir que owners/admins de uma organização adicionem mais usuários à mesma empresa.

## Abordagem

Como pode haver dois cenários (usuário **já cadastrado** ou **ainda não cadastrado**), implemento ambos:

### 1. Tabela de convites (`organization_invites`)
- `id`, `organization_id`, `email`, `role`, `invited_by`, `created_at`, `accepted_at`
- RLS: owner/admin da org pode criar/listar/excluir; usuário pode ler convites do próprio e-mail; super user gerencia tudo.

### 2. Função `accept_pending_invites(_user_id)`
- Roda no signup/login: busca convites pelo e-mail, cria entrada em `organization_members`, aprova o profile e marca o convite como aceito.

### 3. Edge Function `add-org-member`
- Caminho rápido: se o e-mail já corresponde a um usuário existente, adiciona direto em `organization_members` (sem precisar de aceite).
- Valida que o caller é owner/admin da org (ou super user) usando service role.

### 4. UI em `OrgSettings.tsx`
- Novo card **"Membros da Organização"**:
  - Lista membros atuais (nome + papel) com botão de remover.
  - Campo de e-mail + select de papel (member/admin/viewer) + botão **"Adicionar membro"**.
  - Lista de convites pendentes com botão de cancelar.
- Ao adicionar: chama edge function. Se 404 (não cadastrado), insere convite na tabela e mostra mensagem "Convite criado — peça para a pessoa se cadastrar com este e-mail".

### 5. Integração no signup
- Em `useAuth` (ou após signup em `Auth.tsx`): após login bem-sucedido, chamar `supabase.rpc('accept_pending_invites', { _user_id: user.id })` e depois `refreshOrganization()`.

## Arquivos afetados

- **Migração nova**: cria `organization_invites` + RPC `accept_pending_invites`.
- **Nova edge function**: `supabase/functions/add-org-member/index.ts` (verify_jwt padrão).
- **`src/pages/OrgSettings.tsx`**: novo card de membros + estado/handlers.
- **`src/hooks/useAuth.tsx`** (ou `Auth.tsx`): chamar `accept_pending_invites` após login.

## Permissões resultantes

- Owner/Admin da org → pode convidar e adicionar membros.
- Super user → pode gerenciar membros de qualquer org.
- Membros normais → só veem convites enviados ao próprio e-mail.
