## Objetivo
No diálogo "Criar Usuário" (em `/admin`), permitir vincular o usuário a **várias empresas** de uma vez, em vez de só uma.

## Mudanças no formulário (src/pages/AdminApproval.tsx)

- Substituir o `Select` único de empresa por uma **lista com checkboxes** das empresas disponíveis (uma por linha, com bolinha colorida + nome).
- Adicionar uma marcação de **empresa principal** (estrela ⭐) entre as selecionadas — define o `profiles.organization_id` (a empresa "primária" usada no app).
- Validação: pelo menos 1 empresa marcada; se houver várias selecionadas e nenhuma marcada como principal, usar a primeira da lista automaticamente.
- O **papel na empresa** (member / admin / owner) permanece um único valor e é aplicado a todas as empresas escolhidas.
- Estado novo: `nuOrgIds: string[]` e `nuPrimaryOrgId: string` (substitui o atual `nuOrgId`).
- Caixa de seleção rolável quando houver muitas empresas, com busca opcional simples.

## Mudanças no backend (supabase/functions/admin-create-user/index.ts)

- Aceitar `organization_ids: string[]` (mantendo compatibilidade com o antigo `organization_id` para não quebrar outras chamadas).
- Aceitar `primary_organization_id: string` (default: primeiro item de `organization_ids`).
- Criar/atualizar uma linha em `organization_members` para **cada** empresa do array, com o `org_role` informado.
- Definir `profiles.organization_id` como a `primary_organization_id`.
- `tab_visibility` fica vinculado à empresa principal (como hoje).

## Detalhes técnicos

```text
Form
 ├─ Empresas (checkbox list)
 │    □ ⭐  • Empresa A
 │    ☑ ⭐  • Empresa B   ← principal
 │    ☑     • Empresa C
 ├─ Papel na empresa: [member ▾]   (aplicado a todas)
 ├─ Perfil do sistema: [user ▾]
 └─ Abas visíveis: [□ □ □ □ □]
```

Payload enviado ao edge function:
```json
{
  "email": "...",
  "organization_ids": ["uuid-a", "uuid-b"],
  "primary_organization_id": "uuid-b",
  "org_role": "member",
  "system_role": "user",
  "tab_visibility": { ... }
}
```

## Fora do escopo
- Permitir papel diferente por empresa (continua um papel único aplicado a todas).
- Mudar a UI de edição de empresas dos usuários já existentes (já existe o popover de empresas em cada card).
