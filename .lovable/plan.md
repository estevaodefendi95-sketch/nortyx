

# Permitir super user transitar entre todas as organizações

## Resumo
A conta `estevaodefendi95@gmail.com` poderá ver e alternar entre todas as organizações cadastradas no sistema, não apenas aquelas em que é membro.

## Alterações

### 1. `OrganizationContext.tsx`
- Adicionar `availableOrganizations: Organization[]` ao contexto
- Para o super user (`user.email === "estevaodefendi95@gmail.com"`):
  - Carregar **todas** as organizações via `supabase.from("organizations").select("*")`
  - No `switchOrganization`, carregar qualquer org diretamente (sem exigir membership)
  - Criar um membership "virtual" com role `owner` para a org selecionada
- Para usuários normais: comportamento atual (apenas orgs com membership)

### 2. RLS — Política de leitura em `organizations`
- Atualmente a política SELECT só permite ver orgs onde o user é membro
- Criar uma **database function** `is_super_user()` que verifica se o email do usuário é o email especial
- Adicionar política SELECT permissiva: `is_super_user(auth.uid())` para permitir leitura de todas as orgs
- Adicionar políticas SELECT similares nas tabelas de dados (`transactions`, `daily_incomes`, `products`, `org_dashboard_settings`, etc.) para que o super user veja dados de qualquer org

### 3. UI — Seletor de organização no header ou settings
- Adicionar um dropdown/select no cabeçalho (visível apenas para o super user) com a lista de todas as organizações
- Ao selecionar uma org, chamar `switchOrganization(orgId)`

### 4. Migração SQL
```sql
-- Função para verificar super user
CREATE OR REPLACE FUNCTION public.is_super_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = _user_id AND email = 'estevaodefendi95@gmail.com'
  )
$$;

-- Permitir super user ler todas as orgs
CREATE POLICY "Super user can view all organizations"
ON public.organizations FOR SELECT TO authenticated
USING (public.is_super_user(auth.uid()));

-- Permitir super user ler dados de qualquer org
CREATE POLICY "Super user can read all transactions"
ON public.transactions FOR SELECT TO authenticated
USING (public.is_super_user(auth.uid()));

-- (repetir para: daily_incomes, products, org_dashboard_settings,
--  categories, subcategories, fornecedores, billing_clients,
--  billing_charges, notes, tab_visibility, push_subscriptions, audit_log)
```

### 5. Ajuste no `OrganizationContext` para super user
- Quando super user seleciona uma org da qual **não é membro**, o contexto carrega a org normalmente e cria um membership virtual `{ role: "owner" }` para que todas as permissões de UI funcionem

### Detalhes técnicos
- A restrição por email é feita tanto no banco (função `is_super_user`) quanto no frontend
- O super user terá acesso **somente leitura** via RLS (SELECT) — para write, precisaria de políticas adicionais; por ora, manter o comportamento atual onde ele só edita orgs onde é membro real
- O dropdown de orgs aparece apenas quando `user.email === SUPER_EMAIL`

