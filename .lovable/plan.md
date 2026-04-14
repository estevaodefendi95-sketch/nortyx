

# Simplificar dashboard e restringir personalização

## Resumo
1. Rankings usam título único (sem "comida"/"bebida")
2. CMV vira "Porcentagem" fixo, sem campo de personalização
3. Nos toggles de visibilidade, permitir personalizar nome e logo — mas apenas para a conta `estevaodefendi95@gmail.com`

## Alterações

### 1. Migração SQL
Adicionar colunas à `org_dashboard_settings`:
- `faturamento_medio_title text NOT NULL DEFAULT 'Faturamento Médio / Dia'`
- `ranking_title text NOT NULL DEFAULT 'Top 10'`

### 2. `useDashboardSettings.ts`
- Adicionar `faturamento_medio_title` e `ranking_title` à interface
- Remover `cmv_title` da interface (usar "Porcentagem" fixo no código)
- Ambos os rankings usam `ranking_title`

### 3. `OrgSettings.tsx`
- **Seção "Painel de Dados"**: cada switch mostra input de nome quando ativo:
  - Faturamento Médio → input `faturamento_medio_title`
  - Porcentagem → sem input (nome fixo)
  - Ranking → input único `ranking_title` (sem separação comida/bebida)
- Remover seção separada "Títulos dos Rankings"
- Remover campo `cmv_title`
- **Restrição**: toda a seção de personalização do dashboard (ou apenas os inputs de nome/logo) só aparece se `user?.email === "estevaodefendi95@gmail.com"`. Demais usuários admin/owner veem apenas os switches de visibilidade.

### 4. `DadosView.tsx`
- Card CMV: título fixo **"Porcentagem"**
- Ambos os rankings: usar `dashSettings.ranking_title`
- Faturamento Médio: usar `dashSettings.faturamento_medio_title`
- No Select do formulário de produto: usar `ranking_title + " 1"` e `ranking_title + " 2"` ou apenas o `ranking_title` como label genérico

### Detalhes técnicos
- A restrição por email é feita no frontend (OrgSettings) comparando `user.email`
- O banco continua acessível por qualquer admin via RLS — a restrição é apenas de UI
- Campos `top_foods_title` e `top_drinks_title` no banco continuam existindo mas não são mais editáveis separadamente

