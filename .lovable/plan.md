## Objetivo

No diálogo "Correspondências identificadas no extrato" (aba Lançamento), quando o usuário clica em **"Remover vinculação"** numa cobrança identificada, a cobrança precisa voltar imediatamente para o pool de cobranças disponíveis e poder ser vinculada a outra linha do extrato — priorizando linhas do **mesmo mês** da cobrança.

## Estado atual

Em `src/components/TransactionForm.tsx`:

- `handleChangeChargeLink(entryId, null)` (linha 221) já remove `matchedChargeId` da entrada, e `usedChargeIds` é recalculado a cada render a partir de `pendingMatchEntries`. Em teoria a cobrança liberada já fica disponível.
- Porém, no picker (`renderChargePicker`, linha 2467), a lista de cobranças é ordenada apenas por "mesmo valor" e alfabética. Não há nenhum destaque/filtro por **mês** — fica difícil encontrar a cobrança recém-liberada entre dezenas de cobranças pendentes de outros meses.
- A entrada que foi desvinculada vai parar na seção "Entradas sem cobrança vinculada", mas só aparece se `availableCharges.length > 0` (ok). Não há indicação visual de que existe cobrança liberada do mesmo mês esperando vínculo.

## Mudanças

Arquivo único: `src/components/TransactionForm.tsx`.

### 1. Filtrar/priorizar picker por mês da entrada

Em `renderChargePicker` (≈ linha 2470), além do critério atual (mesmo valor primeiro), agrupar/priorizar cobranças cuja `data_cobranca` esteja no **mesmo mês/ano** da `entry.data`:

```text
ordenação: (mesmoMês desc) → (mesmoValor desc) → (nome)
```

Adicionar um badge `mesmo mês` análogo ao `mesmo valor` existente (linha 2520), usando o token `secondary`/`outline` do design system. Cobranças de outros meses continuam visíveis no final da lista (não filtradas duras) para não bloquear casos legítimos cruzando meses.

### 2. Garantir que a cobrança liberada apareça destacada

Quando uma cobrança é liberada via "Remover vinculação", ela deve subir ao topo do picker das entradas do mesmo mês. Como `usedChargeIds` já é derivado de `pendingMatchEntries`, basta a nova ordenação acima — sem mudança de estado adicional.

### 3. Aviso leve na seção "Entradas sem cobrança vinculada"

Quando existir alguma entrada sem vínculo **e** existir alguma cobrança disponível do mesmo mês dessa entrada, mostrar abaixo do valor um chip discreto (ex.: "1 cobrança do mês disponível") para guiar o usuário a abrir "Vincular cliente". Texto neutro, sem alterar layout do cartão.

## Escopo

- Apenas frontend, em `src/components/TransactionForm.tsx`.
- Sem mudanças de schema, RLS, edge functions ou novos componentes.
- Sem alteração do fluxo de aprovação/finalização — só ordenação e dicas visuais no picker e na lista.

## Verificação

1. Importar extrato com 2 entradas no mesmo mês e ≥ 2 cobranças pendentes (uma no mesmo mês das entradas, outra em mês diferente).
2. Conferir que ambas entradas aparecem com vínculo automático correto.
3. Em uma das entradas vinculadas, clicar "Alterar cliente" → "Remover vinculação".
4. Verificar: a entrada migra para "Entradas sem cobrança vinculada" e exibe o chip "cobrança do mês disponível".
5. Na **outra** entrada, abrir "Alterar cliente": a cobrança recém-liberada aparece no topo com badges "mesmo mês" e/ou "mesmo valor", sem o badge "já usada".
6. Selecionar a cobrança liberada → vínculo é trocado, picker fecha, seções se reorganizam corretamente.
