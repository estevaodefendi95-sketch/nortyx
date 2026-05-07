## Adicionar observação opcional aos lançamentos

### Mudanças

**1. Banco de dados (migração)**
- `ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS observacao TEXT;`

**2. `src/data/cashflow.ts`**
- Adicionar `observacao?: string | null` na interface `Transaction`.

**3. `src/context/TransactionsContext.tsx`**
- Mapear `observacao` em `mapTransactionRow`.
- Incluir `observacao` no `insert` de `addTransaction`.
- `updateTransaction` já passa quaisquer campos via spread — funcionará automaticamente.

**4. `src/components/CategoriesView.tsx` (lista de lançamentos por categoria)**
- Novo estado: `expandedNoteId: number | null` e `noteDraft: string`.
- Para cada item da lista de transações, adicionar um botão pequeno (ícone `MessageSquare` do lucide) ao lado dos botões Pencil/Repeat/Trash:
  - Se `t.observacao` existir → ícone com cor `text-primary` (indica que há nota).
  - Se não → ícone `text-muted-foreground` (sutil).
  - Visível também para `isViewer` (somente leitura, sem abrir editor).
- Ao clicar (não-viewer): expande área inline abaixo do item com `Textarea` + botões "Salvar" / "Cancelar".
  - Salvar → `updateTransaction(t.id, { observacao: noteDraft.trim() || null })` + toast + fecha.
  - Cancelar → fecha sem salvar.
- Quando recolhido e há observação: exibe um pequeno preview (1 linha truncada, `text-[11px] text-muted-foreground italic`) abaixo da linha de data/categoria, para o usuário saber que existe sem precisar abrir.
- Para `isViewer`, clicar apenas alterna a exibição completa do texto da observação (read-only).

### Resultado
Cada lançamento ganha um campo opcional de observação/descrição, exibido de forma minimizada (só ícone + preview de 1 linha quando existir), expansível sob demanda.