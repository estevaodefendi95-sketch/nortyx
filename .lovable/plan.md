## Objetivo

Hoje, no picker "Vincular/Alterar cliente", uma cobrança já vinculada a outra entrada aparece desabilitada com o badge "já usada". O usuário quer poder selecioná-la mesmo assim: ao escolher, a cobrança é **transferida** para a nova entrada e a entrada anterior fica sem vínculo (volta para "Entradas sem cobrança vinculada").

## Mudanças (`src/components/TransactionForm.tsx`, somente frontend)

### 1. `handleChangeChargeLink` (≈ linha 221) — transferir vínculo

Quando `newChargeId` não é nulo, antes de aplicar no entry alvo, percorrer `pendingMatchEntries` e remover `matchedChargeId/matchedChargeClient/matchedFrom` de qualquer outra entry que esteja usando essa mesma cobrança. Também remover essa entry anterior de `approvedMatchIds` (já que perdeu a sugestão).

Tudo num único `setPendingMatchEntries` + um único `setApprovedMatchIds` para manter consistência.

### 2. Picker (`renderChargePicker`, ≈ linha 2517) — habilitar item "já usada"

- Remover `disabled={alreadyUsed}` do `CommandItem`.
- `onSelect` chama `handleChangeChargeLink(entry.id, c.id)` sempre.
- Substituir o badge "já usada" por "vai desvincular de {nome da entrada atual}" (ou simplesmente "transferir") usando `variant="outline"`, para deixar claro o efeito.

### 3. Chip "X cobranças do mês disponíveis" (≈ linha 2608)

Atualmente filtra `!usedChargeIds.has(c.id)`. Como agora qualquer cobrança do mês pode ser transferida, mudar para contar **todas** as cobranças do mesmo mês (usadas ou não). Mantém a heurística útil sem desincentivar a transferência.

## Verificação

Cenário: 2 entradas A e B no mesmo mês, 1 cobrança X sugerida automaticamente para A.
- Abrir "Vincular cliente" em B → X aparece com badge "transferir" e fica selecionável.
- Ao escolher X em B: A volta para a lista "Entradas sem cobrança vinculada", B aparece em "Cobranças identificadas" com X, e o checkbox de aprovação de A é desmarcado.
- Reabrir picker em A e escolher X de volta inverte a transferência.

Sem mudanças em backend, schema, RLS ou aprovação final (a tela de salvar continua usando `matchedChargeId` do estado atual).