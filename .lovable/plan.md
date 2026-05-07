## Por que os clientes não foram vinculados à cobrança

Pelo que verifiquei no banco, atualmente existem lançamentos normais (`daily_incomes` e `transactions`), mas **não existe nenhum registro salvo em `billing_clients` nem em `billing_charges`**. Ou seja: a cobrança não ficou “sem cliente”; ela não chegou a ser gravada como cobrança.

As causas prováveis no código atual são:

1. **A cobrança só é criada se o checkbox “Vincular cliente para cobrança” estiver marcado e nome + e-mail estiverem preenchidos.** Se qualquer um desses campos faltar, o sistema salva apenas como entrada comum.
2. **O formulário grava a entrada antes e tenta gravar o cliente/cobrança depois.** Se a segunda etapa falhar, a entrada fica salva, mas o cliente e a cobrança não ficam vinculados.
3. **Há consultas de cliente sem filtro explícito da empresa ativa no formulário de lançamento**, o que pode atrapalhar a seleção/reuso do cliente no contexto multiempresa.
4. **A tabela de cobrança permite inconsistências**, porque `organization_id` ainda está nullable e não há validação garantindo que `billing_charges.organization_id` seja a mesma empresa do `billing_clients.organization_id`.

## Plano de correção

### 1. Tornar o salvamento da cobrança mais seguro
No `TransactionForm.tsx`:

- Quando “Vincular cliente para cobrança” estiver marcado, exigir nome e e-mail antes de salvar.
- Não salvar como entrada comum se o usuário marcou vínculo de cobrança mas esqueceu dados obrigatórios.
- Usar uma sequência mais confiável: primeiro criar/atualizar o cliente, depois criar a cobrança.
- Melhorar a mensagem de erro para mostrar a falha real quando cliente/cobrança não for salvo.

### 2. Filtrar clientes pela empresa ativa no lançamento
No `TransactionForm.tsx`:

- Buscar clientes existentes com `.eq("organization_id", organization.id)`.
- Ao procurar cliente por e-mail, procurar dentro da empresa ativa.
- Se encontrar um cliente antigo sem empresa, atualizar/migrar para a empresa ativa quando permitido.

### 3. Garantir vínculo correto entre cliente e cobrança no banco
Criar uma nova migração para:

- Preencher `organization_id` em registros antigos, se existirem.
- Garantir que novos `billing_clients` e `billing_charges` tenham `organization_id` obrigatório quando possível.
- Criar uma validação no banco para impedir cobrança com empresa diferente da empresa do cliente.
- Ajustar RLS para permitir ao super usuário criar/editar cobranças na empresa selecionada, não apenas visualizar.

### 4. Corrigir visualização em Clientes e Calendário
No `ClientsView.tsx` e `CalendarView.tsx`:

- Manter o filtro por empresa ativa.
- Tratar erros de carregamento explicitamente, em vez de apenas mostrar lista vazia.
- No calendário, carregar cobrança com dados do cliente e mostrar mesmo quando a cobrança estiver pendente/enviada/paga.

### 5. Validação após implementar
Depois da aprovação, vou:

- Aplicar a migração.
- Ajustar os componentes.
- Verificar no banco se `billing_clients` e `billing_charges` passam a ser criados.
- Confirmar que aparecem na aba **Clientes** e no **Calendário** para a empresa selecionada.