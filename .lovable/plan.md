

# Plano: Autocompletar dados de clientes já cadastrados

## Objetivo
Quando o usuário digita o nome de um cliente no formulário de cobrança, o sistema deve sugerir clientes já cadastrados na tabela `billing_clients` e preencher automaticamente e-mail, telefone e forma de cobrança.

## Alterações

### `src/components/TransactionForm.tsx`

1. **Buscar clientes existentes**: Ao abrir a seção de cobrança (`showBilling = true`), carregar todos os clientes de `billing_clients` via query
2. **Autocomplete no campo Nome**: Ao digitar no campo "Nome do cliente", filtrar e exibir uma lista dropdown com clientes que correspondem ao texto digitado
3. **Preenchimento automático**: Ao selecionar um cliente da lista, preencher automaticamente `email`, `telefone` e `forma_cobranca` com os dados salvos
4. **Permitir edição**: Os campos preenchidos continuam editáveis para ajustes pontuais
5. **Permitir novo cliente**: Se o nome digitado não corresponder a nenhum existente, o formulário funciona normalmente para cadastro novo

A implementação usará um Popover/Command (componentes já existentes no projeto) para a lista de sugestões, filtrando por nome conforme o usuário digita.

## Arquivos impactados

- **Editar**: `src/components/TransactionForm.tsx` (adicionar fetch de clientes e autocomplete)

