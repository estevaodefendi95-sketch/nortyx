

# Tornar o sistema de produtos/rankings universal

## Problema
1. O nome do card CMV não é editável nas configurações (imagem 1)
2. O ranking "Top 10" mostra ícone de comida/bebida desnecessário (imagem 2)
3. O formulário de produto tem seletor "Comida/Bebida" hardcoded — precisa ser genérico (imagem 3)

## Solução

### 1. Migração SQL — adicionar campo `cmv_title` na tabela `org_dashboard_settings`

Adicionar coluna para permitir renomear o card CMV:
```sql
ALTER TABLE public.org_dashboard_settings
  ADD COLUMN cmv_title text NOT NULL DEFAULT 'CMV';
```

### 2. Atualizar `useDashboardSettings.ts`

- Adicionar `cmv_title: string` à interface `DashboardSettings`
- Default: `"CMV"`
- Carregar do banco

### 3. Atualizar `OrgSettings.tsx`

- Adicionar input de texto para renomear o CMV (ao lado do switch de visibilidade)
- Campo: "Título do card CMV"

### 4. Atualizar `DadosView.tsx` — tornar universal

**Card CMV (imagem 1):**
- Usar `dashSettings.cmv_title` no lugar de "CMV" hardcoded

**Rankings (imagem 2):**
- Remover ícones emoji (🍽️ e 🍹) dos títulos dos rankings
- Remover ícones emoji da listagem de produtos recentes
- Usar apenas o texto do título configurado

**Formulário de produto (imagem 3):**
- Remover os botões "Comida" / "Bebida"
- Associar o produto ao ranking pela posição: primeiro ranking = tipo "comida" (internamente), segundo = "bebida"
- Trocar para um **Select** com as opções sendo os títulos configurados dos rankings (ex: "Top 10 Comidas" e "Top 10 Bebidas", ou o que o cliente definir)
- Placeholder do nome: "Ex: Produto, Cliente, Item..." em vez de "Ex: Picanha, Caipirinha..."
- Remover emojis da listagem de produtos do mês

### 5. Atualizar importação por IA

- Na listagem de resultados da IA, remover emojis e mostrar o nome do tipo configurado em vez de "comida"/"bebida"

### Detalhes técnicos
- O campo `tipo` no banco (`products.tipo`) continua como `"comida"` e `"bebida"` internamente — apenas a apresentação muda
- O Select no formulário mapeia o título do ranking para o tipo interno
- Uma coluna nova (`cmv_title`) na tabela existente, sem breaking changes

