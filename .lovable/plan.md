## Bug

Quando uma entrada do extrato é vinculada a uma cobrança:
- A cobrança continua com a `data_cobranca` original (agendada) → conta como faturamento no dia agendado.
- A entrada real (data em que o dinheiro caiu) deveria substituir essa data, mas hoje só atualizamos `status='paga'`.

Resultado: o valor pode aparecer duplicado no dashboard (cobrança no dia agendado + a próxima cobrança recorrente / outro lançamento no dia real), e o faturamento fica registrado no dia errado.

## Correção

Em **`src/components/TransactionForm.tsx`**, nos dois pontos onde marcamos a cobrança como paga após match:

1. `approveBankEntry` (aprovação individual de um lançamento do extrato, linha ~616)
2. `approveAllBankEntries` (aprovar tudo, linha ~686)

Trocar:

```ts
await supabase.from("billing_charges")
  .update({ status: "paga" })
  .eq("id", entry.matchedChargeId);
```

por:

```ts
const [y, m, d] = entry.data.split("-");
const dataBR = `${d}/${m}/${y}`;
await supabase.from("billing_charges")
  .update({ status: "paga", data_cobranca: dataBR })
  .eq("id", entry.matchedChargeId);
```

Assim:
- A cobrança passa a ter como `data_cobranca` o dia real do recebimento (formato BR `DD/MM/YYYY`, igual ao resto do sistema).
- O faturamento no `DadosView` / `Index` (que soma `billing_charges.valor` por mês de `data_cobranca`) passa a registrar a entrada no dia certo.
- Continuamos **não** inserindo `daily_income` para a entrada vinculada → sem duplicação.

## Mensagens

Atualizar o toast de "Cobrança quitada" para mencionar a data ajustada, ex.:
`"Cobrança de {cliente} marcada como paga em {dataBR}"`.

## Escopo

Apenas `src/components/TransactionForm.tsx`. Sem migração, sem novo componente, sem alteração de RLS.
