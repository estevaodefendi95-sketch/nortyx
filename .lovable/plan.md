## Problema

Na aba **Lançamento**, no diálogo "Correspondências identificadas no extrato", os botões **"Vincular cliente"** e **"Alterar cliente"** não fazem nada ao serem clicados — o popover de seleção de cobrança nunca abre.

## Causa raiz

Em `src/components/TransactionForm.tsx` (linha ~2479-2485), o trigger do Popover é um `<button>` com `asChild` que chama `ev.preventDefault()` e `ev.stopPropagation()` no `onClick`:

```tsx
<PopoverTrigger asChild>
  <button
    type="button"
    onClick={(ev) => { ev.preventDefault(); ev.stopPropagation(); }}
    ...
```

O Radix usa `composeEventHandlers`: ele executa primeiro o `onClick` do usuário e, **se `event.defaultPrevented` for `true`**, **não executa** o handler interno que abre o popover. Resultado: o popover nunca abre.

## Correção

Remover o `preventDefault()`. Manter apenas `stopPropagation()` (para o clique não borbulhar para o card pai) e adicionar `type="button"` já está OK.

```tsx
<PopoverTrigger asChild>
  <button
    type="button"
    onClick={(ev) => ev.stopPropagation()}
    className="text-xs text-primary hover:underline mt-1"
  >
    {mode === "change" ? "Alterar cliente" : "Vincular cliente"}
  </button>
</PopoverTrigger>
```

## Escopo

- Arquivo único: `src/components/TransactionForm.tsx`, função `renderChargePicker` (uma linha alterada).
- Sem mudanças de backend, schema, RLS ou novos componentes.

## Verificação

1. Importar um extrato com entradas que tenham cobranças pendentes compatíveis.
2. No diálogo, clicar em "Vincular cliente" numa entrada sem vínculo → o popover abre com a lista de cobranças pendentes.
3. Selecionar uma cobrança → entrada migra para a seção "Cobranças identificadas" com vínculo manual.
4. Clicar em "Alterar cliente" numa entrada já vinculada → popover abre permitindo trocar ou remover o vínculo.
