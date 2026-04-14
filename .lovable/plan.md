

# Personalização de Cards do Dashboard (Dados)

## Resumo
Três funcionalidades novas: (1) visibilidade dos cards no Settings, (2) seleção de categorias no CMV, (3) títulos editáveis nos Top 10.

## Alterações

### 1. Migração SQL — nova tabela `org_dashboard_settings`

Armazenar preferências do dashboard por organização:

```sql
CREATE TABLE public.org_dashboard_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  -- Visibilidade dos cards
  show_faturamento_medio boolean NOT NULL DEFAULT true,
  show_cmv boolean NOT NULL DEFAULT true,
  show_top_foods boolean NOT NULL DEFAULT true,
  show_top_drinks boolean NOT NULL DEFAULT true,
  -- Categorias do CMV (array de códigos de categoria)
  cmv_categories text[] NOT NULL DEFAULT '{C,B}',
  -- Títulos customizados
  top_foods_title text NOT NULL DEFAULT 'Top 10 Comidas',
  top_drinks_title text NOT NULL DEFAULT 'Top 10 Bebidas',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id)
);

ALTER TABLE public.org_dashboard_settings ENABLE ROW LEVEL SECURITY;

-- RLS: membros da org podem ler
CREATE POLICY "Org members can read dashboard settings"
  ON public.org_dashboard_settings FOR SELECT TO authenticated
  USING (organization_id = get_user_org_id(auth.uid()));

-- RLS: owners/admins podem inserir/atualizar
CREATE POLICY "Org owners can insert dashboard settings"
  ON public.org_dashboard_settings FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'admin'));

CREATE POLICY "Org owners can update dashboard settings"
  ON public.org_dashboard_settings FOR UPDATE TO authenticated
  USING (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'admin'));
```

### 2. Atualizar `src/pages/OrgSettings.tsx`

Adicionar novo Card "Painel de Dados" com:
- **Switches** para mostrar/esconder: Faturamento Médio, CMV, Top Comidas, Top Bebidas
- **Multi-select de categorias** para o CMV (listar categorias do CategoriesContext)
- **Inputs de texto** para renomear os títulos dos Top 10
- Carregar/salvar de `org_dashboard_settings`

### 3. Criar hook `src/hooks/useDashboardSettings.ts`

- Busca as configurações de `org_dashboard_settings` para a org atual
- Retorna valores com defaults caso não exista registro
- Expõe `settings` para o DadosView consumir

### 4. Atualizar `src/components/DadosView.tsx`

- Consumir o hook `useDashboardSettings`
- Condicionar renderização dos cards com `show_faturamento_medio`, `show_cmv`, `show_top_foods`, `show_top_drinks`
- No CMV: filtrar transações por `cmv_categories` em vez de hardcoded `"C"` e `"B"`
- Nos Top 10: usar `top_foods_title` e `top_drinks_title` como títulos

### Detalhes técnicos

- A tabela usa `UNIQUE(organization_id)` para garantir um registro por org
- O save no OrgSettings faz upsert (`INSERT ... ON CONFLICT`)
- O hook usa `useOrganization()` para obter o `organization.id`
- As categorias do CMV são armazenadas como array de códigos (ex: `{C,B,F}`)

