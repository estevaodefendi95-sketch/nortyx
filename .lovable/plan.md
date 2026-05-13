## Problema

Ao salvar uma entrada na empresa "Casa", aparece "Erro ao salvar entrada". A causa é uma regra de segurança no banco que valida o `organization_id` usando uma função antiga (`get_user_org_id`) que só retorna a **primeira** empresa do usuário. Quando o usuário está em outra empresa (ex.: "Casa", que não é a primeira), o INSERT é bloqueado.

O mesmo problema afeta várias tabelas multiempresa.

## Plano

1. **Migração de banco** — substituir, em todas as policies (SELECT/INSERT/UPDATE/DELETE) das tabelas abaixo, a checagem `organization_id = get_user_org_id(auth.uid())` por `is_org_member(auth.uid(), organization_id)`. Isso valida o `organization_id` real enviado na linha, em vez de comparar com uma única empresa fixa.

   Tabelas afetadas:
   - `daily_incomes` (causa direta do erro atual)
   - `transactions`
   - `fornecedores`
   - `products`
   - `push_subscriptions`
   - `notes`
   - `subcategories`

2. **Validação**
   - Trocar para a empresa "Casa" e registrar uma entrada → deve salvar sem erro.
   - Trocar para outra empresa e registrar entrada/saída/categoria → deve continuar salvando normalmente.
   - Conferir que listagens continuam mostrando apenas dados da empresa ativa.

## Escopo

Apenas correção das policies de banco. Nenhuma mudança de UI, nenhuma mudança no cabeçalho ou em cobranças (a parte de "vincular cobranças às entradas do mês" fica para uma próxima etapa, separada).
