## Objetivo

No diálogo "Correspondências identificadas no extrato" da aba **Lançamento**, permitir que o usuário **altere manualmente o cliente/cobrança vinculado** a cada entrada — corrigindo um match automático errado ou atribuindo um cliente a uma entrada que não foi auto-vinculada.

## Comportamento

Para cada entrada do tipo `entrada` listada no diálogo (tanto as que já foram auto-matched quanto as que ficaram sem match):

1. Mostrar, ao lado do nome do cliente identificado, um link **"Alterar cliente"** (ou **"Vincular cobrança"** quando não há match).
2. Ao clicar, abrir um popover/select com as cobranças pendentes/atrasadas da organização, agrupadas por cliente, exibindo:
   - Nome do cliente
   - Valor da cobrança
   - Data de cobrança
   - Indicador "(mesmo valor)" quando bate com o valor da entrada (sugestão prioritária no topo)
3. Incluir opção **"Remover vinculação"** para desfazer o match e tratar a entrada como lançamento novo.
4. Ao selecionar uma cobrança:
   - Atualizar `matchedChargeId` e `matchedChargeClient` da entrada.
   - Marcar o checkbox da entrada como aprovado.
   - Reservar essa cobrança (não pode aparecer como sugestão para outra entrada no mesmo diálogo).
5. Validação: impedir selecionar uma cobrança já vinculada a outra entrada do diálogo (mostrar badge "já usada").

## Implementação (escopo único: `src/components/TransactionForm.tsx`)

- Carregar uma única vez (junto com `detectMatches`) a lista completa de cobranças pendentes/atrasadas + mapa de clientes, salvar em estado `availableCharges` para reuso no diálogo.
- Na seção "Cobranças identificadas" do `showMatchApprovalDialog`, adicionar para cada item um botão/Popover com `Command` (shadcn) listando as opções.
- Adicionar uma nova seção **"Entradas sem cobrança vinculada"** logo abaixo, listando as `entradas` sem `matchedChargeId`, cada uma com o mesmo seletor "Vincular cobrança".
- Handler `handleChangeChargeLink(entryId, newChargeId | null)` que:
  - Atualiza `pendingMatchEntries` imutavelmente.
  - Recalcula `approvedMatchIds` (adiciona se vinculou, remove se desvinculou).
- Reaproveitar a lógica existente em `commitImport` — nenhuma mudança no fluxo de gravação, já que ela usa `matchedChargeId` final.

## Arquivos afetados

- `src/components/TransactionForm.tsx` (apenas)

Nenhuma mudança de schema, RLS ou backend.
