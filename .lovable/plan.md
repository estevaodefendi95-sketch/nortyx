

# Corrigir títulos dos rankings e esconder formulário de produtos

## Problemas
1. Os rankings mostram "Top 10 1" e "Top 10 2" — o número "1" e "2" não deveria aparecer se o título já foi personalizado nas configurações. O título nas configurações deve ser o título exato exibido no painel.
2. O formulário "Adicionar Produto" e "Importar Arquivo" aparece mesmo quando ambos os rankings estão desativados — deveria sumir.

## Alterações

### `DadosView.tsx`
1. **Títulos dos rankings**: remover o sufixo ` 1` e ` 2` dos títulos. Usar `dashSettings.ranking_title` e `dashSettings.ranking_title_2` diretamente como título completo.
2. **Esconder formulário de produtos**: mover a seção de "Adicionar Produto" + "Importar Arquivo" para dentro do mesmo bloco condicional `(dashSettings.show_top_foods || dashSettings.show_top_drinks)`, assim ela desaparece quando nenhum ranking está visível.
3. **Select de categoria no formulário**: atualizar as opções para usar os títulos sem sufixo numérico.

### `OrgSettings.tsx`
1. **Labels dos switches**: remover o sufixo ` 1` e ` 2` dos labels dos switches de ranking. Mostrar apenas o título configurado (ex: "Top 10" em vez de "Top 10 1").

### Escopo
- Sem migração SQL
- Sem mudança no hook
- Apenas ajustes de apresentação em 2 arquivos

