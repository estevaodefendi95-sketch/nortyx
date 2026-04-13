

# Plano: Transformar o sistema em SaaS multi-tenant

## Situação atual
O sistema é single-tenant — todos os usuários autenticados compartilham os mesmos dados (transações, categorias, clientes, etc.). Personalização (nome/logo) é salva em localStorage. Não há isolamento de dados entre empresas.

## Visão geral da transformação

A migração será feita em **4 fases** para manter o sistema funcional a cada etapa.

---

## Fase 1 — Estrutura multi-tenant (banco de dados)

**Criar tabela `organizations`:**
- `id`, `name`, `logo_url`, `primary_color`, `slug` (subdomínio/identificador único), `created_at`, `plan` (free/pro/premium), `subscription_status`

**Criar tabela `organization_members`:**
- `user_id`, `organization_id`, `role` (owner/admin/member/viewer), com RLS

**Adicionar coluna `organization_id`** em todas as tabelas de dados:
- `transactions`, `daily_incomes`, `categories`, `subcategories`, `fornecedores`, `products`, `notes`, `billing_clients`, `billing_charges`, `push_subscriptions`, `tab_visibility`, `audit_log`

**Atualizar todas as políticas RLS** para filtrar por `organization_id`, garantindo que cada empresa veja apenas seus dados.

---

## Fase 2 — Onboarding e gestão de organizações

- Fluxo de criação de organização pós-cadastro (nome, logo, slug)
- Tela de convite de membros por e-mail
- Seletor de organização (para usuários que pertencem a múltiplas empresas)
- Página de configurações da organização (nome, logo, cores, plano)
- Substituir localStorage por dados do banco para branding

---

## Fase 3 — Personalização por cliente

- Cores e tema personalizados por organização (primary color, logo no cabeçalho)
- Configurações de abas visíveis por organização (não mais por usuário individual)
- Cada organização terá suas próprias categorias, subcategorias e fornecedores padrão

---

## Fase 4 — Pagamentos e assinaturas

- Integração de pagamentos via Lovable Payments (Stripe ou Paddle)
- Planos com limites (ex: número de usuários, transações/mês)
- Tela de billing para o owner da organização
- Controle de acesso baseado no plano ativo

---

## Detalhes técnicos

### Novas tabelas (migração SQL)

```text
organizations
├── id (uuid, PK)
├── name (text)
├── slug (text, unique)
├── logo_url (text, nullable)
├── primary_color (text, default '#3B82F6')
├── plan (text, default 'free')
├── subscription_status (text, default 'active')
├── created_at (timestamptz)
└── updated_at (timestamptz)

organization_members
├── id (uuid, PK)
├── organization_id (uuid, FK → organizations)
├── user_id (uuid, FK → auth.users)
├── role (enum: owner/admin/member/viewer)
├── created_at (timestamptz)
└── UNIQUE(organization_id, user_id)
```

### Alterações em tabelas existentes
- Adicionar `organization_id (uuid, NOT NULL)` em todas as tabelas de dados
- Criar função `get_user_org_id(uuid)` (SECURITY DEFINER) para uso nas RLS policies
- Atualizar todas as RLS policies para usar `organization_id = get_user_org_id(auth.uid())`

### Alterações no frontend
- Novo contexto `OrganizationContext` com dados da org ativa
- Todos os queries/inserts passam a incluir `organization_id`
- Branding dinâmico no cabeçalho baseado na org
- Novas páginas: `/onboarding`, `/settings/organization`, `/settings/billing`, `/settings/members`

### Fluxo de autenticação atualizado
```text
Cadastro → Criar organização → Dashboard (com dados isolados)
Login → Selecionar organização (se múltiplas) → Dashboard
```

---

## Ordem de implementação sugerida

Recomendo começar pela **Fase 1** (banco de dados), seguida da **Fase 2** (onboarding). Cada fase será implementada incrementalmente para manter o sistema funcional.

Deseja aprovar este plano para iniciar a implementação pela Fase 1?

