## Objetivo

Permitir que qualquer usuário com perfil de sistema **Administrador** (`user_roles.role = 'admin'`) acesse, no cabeçalho, todas as áreas administrativas (sino de notificações, tema, histórico, painel admin, configurações da empresa e sair) para **qualquer empresa em que ele esteja cadastrado**, não apenas aquelas em que tem papel `owner`/`admin` na organização.

## Situação atual

- O sino, tema, sair: já visíveis para todos.
- Histórico (`/admin/history`) e painel (`/admin`): já visíveis quando `isAdmin` (perfil de sistema). OK.
- **Engrenagem de Configurações** (`/settings`): só aparece quando `isOrgOwner = membership.role in ('owner','admin')`. Um administrador de sistema que entra em uma empresa apenas como `member` **não vê** a engrenagem nem consegue editar.
- Mesmo se a engrenagem aparecesse, o RLS atual restringe a edição:
  - `organizations` UPDATE → somente `owner` da empresa ou super user.
  - `org_dashboard_settings` INSERT/UPDATE → somente `owner` ou quem tem papel de sistema `admin` **na empresa ativa** (via `get_user_org_id`, que só devolve uma org).
  - `organization_members` / `organization_invites` → exigem papel `owner`/`admin` na própria empresa.

## Mudanças

### 1. Frontend — mostrar engrenagem para admins de sistema

`src/pages/Index.tsx`: incluir o admin de sistema no gate da engrenagem.

```ts
const isOrgOwner =
  membership?.role === "owner" ||
  membership?.role === "admin" ||
  isAdmin || // perfil de sistema
  isSuperUser;
```

`src/pages/OrgSettings.tsx`: a constante `isOwner` também precisa considerar `isAdmin` (do `useAuth`) para liberar os formulários de edição.

### 2. Backend — RLS para admin de sistema em qualquer empresa onde for membro

Substituir/adicionar políticas usando a combinação `has_role(auth.uid(), 'admin') AND is_org_member(auth.uid(), organization_id)`:

- `organizations`: nova policy UPDATE — admins de sistema podem atualizar qualquer organização da qual sejam membros (logo, nome, cor, etc.).
- `org_dashboard_settings`: novas policies INSERT/UPDATE com a mesma regra (substituem a dependência de `get_user_org_id`, que só funciona para a empresa "principal").
- `organization_members`: novas policies INSERT/UPDATE/DELETE permitindo admins de sistema gerenciarem membros das organizações em que pertencem.
- `organization_invites`: nova policy ALL com a mesma regra.
- `tab_visibility`: nova policy permitindo admin de sistema gerenciar visibilidade de membros das empresas em que está vinculado.

As policies existentes para `owner` e `super_user` permanecem intactas (são aditivas).

### 3. Verificação

- Logar como usuário admin de sistema membro da Empresa A e Empresa B (sem ser owner em nenhuma):
  - Ver os ícones de histórico, painel admin, configurações no header.
  - Trocar para Empresa B no seletor → engrenagem continua visível, edição de logo/cor/nome funciona.
  - Conseguir convidar/remover membros e editar dashboard settings em ambas.
- Usuário comum (sem `admin`) continua sem ver a engrenagem.

## Detalhes técnicos

- Funções já existentes reutilizadas: `has_role`, `is_org_member`, `is_super_user`. Sem novas funções.
- Nenhuma alteração em `client.ts` ou `types.ts`.
- Sem mudança no edge function `admin-create-user` / `admin-delete-user`.
