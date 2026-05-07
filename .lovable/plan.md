## Objetivo

Três melhorias relacionadas:

1. Permitir que **administradores e editores** (não-viewers) criem e excluam categorias na própria aba "Categorias".
2. Quando um **extrato bancário** for importado e já houver conta lançada com mesma descrição/valor em outra data, **pedir aprovação** para mover (atualizar a data) ou manter o lançamento original.
3. Permitir marcar um lançamento como **recorrente** (fixo, replicado nos próximos meses) de forma clara, tanto no formulário novo quanto a partir de uma transação existente na aba Categorias.

---

## 1. Edição de categorias para admin e editor

**Comportamento atual**
- Apenas o `TransactionForm` permite criar/excluir categorias (via context menu / botão "Nova categoria").
- Na aba **Categorias**, qualquer um que não seja `viewer` já pode mexer em subcategorias, mas **não pode** criar/excluir categorias-pai.
- RLS do Supabase já libera INSERT/DELETE de `categories` para qualquer membro da org — ou seja, basta liberar a UI.

**O que muda**

Em `src/components/CategoriesView.tsx`, dentro do card "Categorias de Saída" (lista da direita):
- Adicionar, para `!isViewer`, um campo **"+ Nova categoria"** no rodapé da lista (input + botão `addCategory`).
- Em cada item da lista, ao lado do `ColorPicker`, expor um menu com:
  - **Renomear** (inline edit — usar update na tabela `categories.name`).
  - **Excluir** (chama `reassignCategory(code, "O")` + `deleteCategory(code)` com `AlertDialog` de confirmação).
- A categoria padrão **"Outros" (`O`)** nunca pode ser excluída/renomeada.

Definição de "editor" usada aqui: qualquer usuário com role de organização `owner`, `admin` ou `member` (i.e. **qualquer um que não seja `viewer`**). É a mesma regra já em vigor para criar lançamentos.

**Adicionar `updateCategoryName` em `CategoriesContext.tsx`** (UPDATE na tabela `categories` + sincronização local), já que hoje só existe `updateCategoryColor`.

---

## 2. Aprovação de mudança de data ao importar extrato

**Comportamento atual** (`TransactionForm.tsx`, função `applyImportEntries`)
- A detecção de "matched existing" e o diálogo `showDateApprovalDialog` só roda no modo **"substituir período"** (`mode === "replace"`).
- No modo **"adicionar"** o sistema simplesmente insere tudo, podendo gerar duplicatas.

**O que muda**
- Mover a lógica de matching para rodar **também no modo "add"**:
  - Para cada entrada do extrato (somente saídas), buscar em `transactions` uma conta com **mesmo valor (±0,01)** e **mesmo fornecedor / palavra-chave** (usar `findCategoryByKeyword` + comparação de strings tolerante) dentro de uma janela de **±15 dias** da data nova.
  - Se encontrar e a data for diferente, registrar um `DateChangeCandidate` (`kind: "move"`) — reusa o mesmo dialog já existente.
  - Para cada candidato, o usuário escolhe (checkbox por linha):
    - **Mover** → `updateTransaction(existingId, { data: newDate, pago: true })` e **não** insere nova entrada.
    - **Manter como está** → insere a nova entrada normalmente (resultado: duas linhas, decisão consciente do usuário).
- O dialog atual já tem essa estrutura, só precisa abrir também em modo "add" e mostrar texto claro: *"Esta conta já está lançada em outra data. Mover para a nova data ou manter ambas?"*.

---

## 3. Marcar lançamento como recorrente (contas fixas)

**Comportamento atual**
- O `TransactionForm` já tem `recurrence_type` (`daily | weekly | monthly`) e gera 12 ocorrências automaticamente. Mas o seletor **fica escondido** no fim do formulário e o usuário não percebe.
- Existe `recurrence_group_id` salvo no banco e `deleteRecurringFromDate(groupId, fromDate)` no contexto.

**O que muda**

### 3a. Destacar a recorrência no formulário
- Trazer o seletor de recorrência para um bloco visível logo após "Categoria", com cards estilo botão:
  - "Lançamento único" (default)
  - "Repetir mensalmente (12 meses)" — caso típico de contas fixas (aluguel, internet, salário…)
  - "Repetir semanalmente (12 semanas)"
  - "Repetir diariamente (30 dias)"
- Quando recorrência ≠ nula, mostrar resumo: *"Será criado 1 lançamento agora + 11 cópias nos próximos meses"*.

### 3b. Tornar uma transação existente recorrente
Na aba **Categorias**, no painel de detalhes do lançamento (`CategoriesView.tsx`, lista `selectedTransactionsList`):
- Adicionar botão **"Tornar recorrente"** (ícone `Repeat`) ao lado dos botões já existentes (editar, duplicar, excluir).
- Abre um pequeno dialog: "Repetir esta conta por quantos meses?" (input numérico, default 12).
- Cria as cópias futuras com `addTransaction({...mesmos campos, data: dataFutura, recurrence_type: "monthly", recurrence_group_id})` e atribui o mesmo `recurrence_group_id` à transação original via `updateTransaction`.
- Se o lançamento já tiver `recurrence_group_id`, mostrar badge "Recorrente" e oferecer **"Encerrar recorrência a partir deste mês"** chamando `deleteRecurringFromDate(groupId, data)` (já existe).

### 3c. Identificação visual
- Em cada item da lista de categorias e do calendário, mostrar um pequeno ícone `Repeat` quando `recurrence_group_id` estiver preenchido.

---

## Detalhes técnicos

**Arquivos editados**
- `src/components/CategoriesView.tsx` — UI de criar/renomear/excluir categoria, botão "Tornar recorrente", badge de recorrência.
- `src/context/CategoriesContext.tsx` — adicionar `updateCategoryName(code, name)`.
- `src/components/TransactionForm.tsx`:
  - Recolocar/destacar o seletor de recorrência.
  - Estender `applyImportEntries` para rodar matching de data também no modo "add".
  - Ao confirmar candidato `kind: "move"`, chamar `updateTransaction` em vez de inserir.
- (Sem nova migração — RLS de `categories` já permite todas as operações para membros da org.)

**Regras de papel**
- `isViewer === true` → continua só leitura.
- Todos os demais (`owner`, `admin`, `member`) — chamados aqui de "admin/editor" — podem criar/excluir/renomear categorias.

**Testes manuais sugeridos**
1. Login como member: criar categoria nova na aba Categorias, renomear, excluir → transações migradas para "Outros".
2. Importar PDF de extrato no modo "adicionar" contendo uma conta cujo valor já existe em outra data → dialog aparece, escolher "mover" → transação original tem data atualizada e nada novo é criado.
3. Lançar conta de "Aluguel R$ 1.500" marcando "Repetir mensalmente" → 12 lançamentos criados; abrir Categorias > Fixo > clicar `Repeat` no item → encerrar recorrência a partir de um mês remove só os futuros.
