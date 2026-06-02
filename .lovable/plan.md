# Folha de Pagamento (Mão de Obra)

Nova seção fixa dentro da aba **Lançamento** para gerenciar funcionários e lançar a folha mensal automaticamente como saída no fluxo de caixa.

## Funcionalidades

1. **Cadastro de funcionários** (fixo, persistido no banco por organização):
   - Nome
   - Salário (valor mensal base)
   - Quinzena (valor pago no dia 15)
   - Extra (valor adicional variável por mês)
   - Ações: adicionar, editar, excluir

2. **Lançamento mensal da folha**:
   - Seletor de mês/ano (default: mês atual)
   - Tabela com todos os funcionários e seus valores (salário + quinzena + extra) — extra editável inline por mês
   - Total da folha do mês exibido no topo
   - Botão **"Lançar folha do mês"** cria as transações de saída na categoria "Mão de Obra" (ou categoria escolhida) para cada funcionário, com data no último dia do mês (configurável)
   - Indicador visual se a folha do mês já foi lançada (evita duplicação)
   - Botão **"Estornar folha do mês"** remove as transações vinculadas

3. **Histórico**: lista os meses já lançados com total e status.

## Estrutura técnica

### Banco de dados (nova migração)

**Tabela `payroll_employees`**
- id, organization_id, nome, salario, quinzena, extra_padrao, ativo, created_at
- RLS: org members CRUD; GRANT para authenticated/service_role

**Tabela `payroll_runs`** (registro de folha lançada por mês)
- id, organization_id, ano, mes, total, lancado_em, created_at
- UNIQUE (organization_id, ano, mes)

**Tabela `payroll_run_items`** (snapshot por funcionário do mês lançado + link com transação)
- id, run_id, employee_id, nome_snapshot, salario, quinzena, extra, total, transaction_id
- ON DELETE da run remove itens; ao estornar, deleta transações vinculadas

### Frontend

- `src/context/PayrollContext.tsx` — provider com funcionários, runs, CRUD, lançar/estornar folha (insere transações via TransactionsContext)
- `src/components/PayrollView.tsx` — UI da seção (tabela de funcionários + tabela mensal + botões)
- Integração em `src/components/TransactionForm.tsx` (aba Lançamento): nova seção colapsável "Folha de Pagamento" no topo, abaixo do formulário atual
- Realtime em payroll_employees e payroll_runs

### Lançamento das saídas
- Cada item gera 1 transação de saída: empresa = nome do funcionário, valor = salario+quinzena+extra, categoria configurável (default primeira categoria de saída ou "Mão de Obra" se existir), data = último dia do mês selecionado, `pago = false`, `agendado = true`
- `transaction_id` salvo em `payroll_run_items` para permitir estorno
- Idempotência: se já existe `payroll_run` para (org, ano, mes), bloqueia novo lançamento

## Fora de escopo
- Cálculo de impostos, INSS, FGTS
- Holerites/PDFs
- Adiantamentos parciais fora do ciclo mensal/quinzena