## Objetivo

No calendário (visualização desktop), quando um dia não tiver movimentação (sem entradas e sem saídas), exibir apenas o **Saldo Inicial (SI)** — e apenas em dias úteis (segunda a sexta). Sábados, domingos e dias fora do mês continuam sem nenhum valor.

## Comportamento atual

Em `src/components/CalendarView.tsx` (grid do desktop, linhas ~703-751), as linhas SI / E / S / SD só aparecem quando `hasData` é `true` (existe entrada ou saída no dia). Dias sem movimento ficam em branco.

## Mudança proposta

Na renderização de cada célula do grid desktop:

1. Calcular `isWeekday` a partir de `new Date(currentYear, currentMonth, day).getDay()` (1–5 = seg–sex).
2. Manter o bloco atual com SI / E / S / SD quando `hasData` for `true`.
3. Adicionar um novo ramo: quando `!hasData && isWeekday`, renderizar apenas a linha `SI: ...` (mesma classe/estilo já usado).
4. Sábados e domingos sem movimento permanecem como hoje (apenas o número do dia).
5. Ajustar o `cursor-default opacity-50` para que dias úteis sem movimento continuem visualmente "vazios" (sem opacidade reduzida) caso mostrem o SI — para não destacar como clicável, manter `cursor-default` mas remover a opacidade só quando o SI for exibido.

A versão mobile (scroller horizontal de dias) e o painel lateral de detalhes **não mudam** — o pedido é específico sobre o calendário (grid).

## Arquivo afetado

- `src/components/CalendarView.tsx` — apenas o trecho do grid desktop (~linhas 703-751).

## Fora do escopo

- Mobile day-scroller, painel de detalhes do dia, totais do mês, lógica de cálculo de saldos, exportações.