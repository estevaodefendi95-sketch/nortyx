

# Ajustar configurações do Painel de Dados

## Resumo
1. **Faturamento Médio / Dia** — remover input de personalização do nome, deixar fixo
2. **Ranking** — permitir o cliente escolher entre 1 ou 2 visualizações, com nome customizável para cada

## Alterações

### 1. Migração SQL
Adicionar colunas para suportar nomes separados e controle independente dos dois rankings:
```sql
ALTER TABLE public.org_dashboard_settings
  ADD COLUMN ranking_title_2 text NOT NULL DEFAULT 'Top 10';
```
(A coluna `ranking_title` já existe para o primeiro ranking. `show_top_foods` e `show_top_drinks` já controlam visibilidade individual.)

### 2. `useDashboardSettings.ts`
- Remover `faturamento_medio_title` da interface (nome fixo)
- Adicionar `ranking_title_2: string` à interface
- Carregar `ranking_title_2` do banco

### 3. `OrgSettings.tsx`
- **Faturamento Médio**: remover o input de nome (mesmo para super user). Label fixo "Faturamento Médio / Dia"
- **Ranking**: separar em dois switches independentes:
  - Switch 1: liga/desliga o primeiro ranking + input para nome (`ranking_title`)
  - Switch 2: liga/desliga o segundo ranking + input para nome (`ranking_title_2`)
  - Inputs de nome visíveis apenas para `isSuperUser`, como já funciona
- Salvar `ranking_title_2` no upsert

### 4. `DadosView.tsx`
- Substituir `dashSettings.faturamento_medio_title` por string fixa "Faturamento Médio / Dia"
- Primeiro ranking usa `dashSettings.ranking_title`
- Segundo ranking usa `dashSettings.ranking_title_2`
- Select do formulário de produto: usar os nomes configurados de cada ranking
- Listagem de produtos: mostrar o nome do ranking correspondente

### Detalhes técnicos
- `show_top_foods` controla o primeiro ranking, `show_top_drinks` o segundo (internamente mantém os nomes de coluna)
- A coluna `faturamento_medio_title` permanece no banco mas não é mais usada na UI
- O cliente pode ter apenas 1 ranking (desligando o segundo) ou 2, cada um com nome próprio

