## Objetivo

Permitir que o administrador atribua a cada usuário uma ou mais **empresas (organizações)** que ele pode acessar, diretamente da tela `/admin` (Gerenciar Usuários), com visualização clara de qual usuário pertence a qual empresa.

## Contexto atual

- Já existem múltiplas organizações (`nortyx.`, `Lema.`).
- Cada usuário tem 0..N linhas em `organization_members` (org_id + role: owner/admin/member/viewer).
- Hoje a tela `/admin` lista todos os profiles mas **não mostra nem permite editar a empresa** do usuário. O usuário entra em uma única org definida no signup/onboarding.
- O `OrganizationContext` já suporta múltiplas organizações por usuário (faz `switchOrganization`), então atribuir várias empresas a um usuário já funcionará no front — falta apenas a UI de gestão.

## Mudanças

### 1. UI – `src/pages/AdminApproval.tsx`

Para cada usuário **aprovado**, adicionar uma nova linha (abaixo da linha de Abas) chamada **"Empresas"** com:

- Ícone `Building2` + label "Empresas:"
- **Chips/badges** de cada organização disponível. Cada chip mostra o nome da org + um check quando o usuário pertence. Clicar no chip alterna a associação:
  - Se o usuário **não** é membro → cria linha em `organization_members` com role `member` (padrão) e sincroniza `profiles.organization_id` se for a 1ª.
  - Se o usuário **já** é membro → remove a linha (com confirmação inline somente se for a última empresa do usuário, para evitar deixá-lo "órfão").
- Indicador visual da empresa "principal" (a que está em `profiles.organization_id`) com um pequeno ícone de estrela; clicar na estrela de outra empresa promove ela como principal.

Bloqueios:
- Não permitir remover a última empresa de um usuário (toast informativo).
- Não permitir o admin remover a si mesmo da única org (mesma regra).

Filtro novo no topo (acima das listas Pendentes/Aprovados): **Select "Empresa"** com opções `Todas | nortyx. | Lema.` para filtrar a lista visível por empresa associada — ajuda a "separar cada usuário por empresa cadastrada".

Agrupamento opcional (dentro da seção Aprovados): quando o filtro estiver em "Todas", mostrar os usuários **agrupados por empresa principal**, com um cabeçalho `[Logo/cor] Nome da empresa (N usuários)` por grupo. Usuários sem empresa caem em um grupo "Sem empresa".

### 2. Carregamento de dados

No `fetchUsers`:
- Buscar `organizations` (id, name, primary_color, logo_url) → guardar em estado `allOrgs`.
- Buscar `organization_members` (user_id, organization_id, role) → mapa `user_id → orgs[]`.
- Buscar `profiles.organization_id` (já vem) para saber a "principal".

### 3. Operações

- **Adicionar membership**: `insert` em `organization_members` `{user_id, organization_id, role:'member'}`. Atualiza estado local e, se for a primeira, faz `update` em `profiles` setando `organization_id`.
- **Remover membership**: `delete` em `organization_members where user_id=… and organization_id=…`. Se removeu a "principal" e ainda restam outras, faz `update profiles.organization_id` para outra qualquer.
- **Definir principal**: `update profiles.organization_id`.

### 4. Banco / RLS

- Tabela `organization_members` já existe com policies "Owners can manage/update/delete members" exigindo `has_role(auth.uid(),'admin')` + `organization_id = get_user_org_id(auth.uid())`. Isso impede o admin de inserir/remover memberships em **outra** org além da sua atual.
- Para que o admin (especialmente o super user `estevaodefendi95@gmail.com`) consiga gerenciar em **qualquer** organização, adicionar policies de bypass para super user em `organization_members`:

```sql
CREATE POLICY "Super user manage members"
  ON public.organization_members FOR ALL
  TO authenticated
  USING (public.is_super_user(auth.uid()))
  WITH CHECK (public.is_super_user(auth.uid()));
```

E policy análoga para `profiles UPDATE` por super user (já existe `Admins can update any profile`, mas restrita à `has_role admin`; o super user já é admin, então ok — verificar e, se necessário, adicionar bypass).

### 5. Tipos / contexto

Nenhuma alteração em `OrganizationContext` necessária. `types.ts` é auto-gerado.

## Arquivos afetados

- `supabase/migrations/<nova>.sql` – policy de super user em `organization_members`.
- `src/pages/AdminApproval.tsx` – UI de empresas por usuário, filtro, agrupamento, handlers.

## Wireframe (cartão de usuário aprovado)

```text
┌────────────────────────────────────────────────────────┐
│ ✏ Estevão Defendi              [Editor ▼]   [✕]       │
│ 07/05/2026 · Editor                                    │
│ ⊞ Abas:  ☑ Dados ☑ Calendário ☑ Categorias ...        │
│ 🏢 Empresas:  [★ nortyx. ✓]  [☆ Lema.  ]              │
└────────────────────────────────────────────────────────┘
```

Chip preenchido = membro. ★ = empresa principal. Clique no chip = toggle membership. Clique na estrela = promover.