## Objetivo

1. Permitir que **qualquer usuário** com mais de uma empresa associada possa trocar a empresa ativa no próprio perfil (hoje só o super user faz isso).
2. Redesenhar o seletor de empresas do usuário no painel admin (`AdminApproval`) para escalar bem quando houver muitas empresas, melhorando usabilidade e edição.

---

## 1) Troca de empresa pelo próprio usuário

### Contexto atual
- `OrganizationContext` já carrega `availableOrganizations` apenas para o super user; usuários comuns recebem `[]`, mesmo tendo múltiplas memberships.
- O switcher no cabeçalho (`src/pages/Index.tsx`, linhas 139–168) só aparece quando `isSuperUser && availableOrganizations.length > 1`.

### Mudança
- **`src/context/OrganizationContext.tsx`**:
  - Para usuários não super, quando houver mais de uma membership, carregar todas as organizações vinculadas e popular `availableOrganizations` com elas.
  - `switchOrganization` continua o mesmo (já grava em `localStorage` e recarrega).
- **`src/pages/Index.tsx`**:
  - Trocar a condição do popover de troca de empresa para `availableOrganizations.length > 1` (sem mais o gate de `isSuperUser`).
  - Manter o mesmo visual (botão `Building2` + popover com lista).

Resultado: usuário com 2+ empresas vê o ícone de prédio no cabeçalho e troca a empresa ativa direto, sem ir ao admin.

---

## 2) Novo seletor de empresas no admin

### Problema atual
Em `AdminApproval.tsx` (linhas 549–596), as empresas viram uma fileira de pills com estrela e check inline. Com muitas empresas, a linha quebra muito, fica difícil escanear quais estão marcadas e qual é a principal.

### Novo layout (por usuário aprovado)
Substituir a fileira de pills por um **bloco "Empresas" mais estruturado**:

```text
Empresas                              [+ Adicionar empresa ▾]
─────────────────────────────────────────────────────────────
[★] ● Lema.        principal               [×]
[☆] ● nortyx.                              [×]
```

Componentes:
- **Lista vertical** das empresas que o usuário JÁ pertence:
  - Botão de estrela à esquerda → define como principal (estrela cheia se for principal, badge "principal" ao lado do nome).
  - Bolinha colorida + nome da empresa.
  - Botão `×` à direita → remove a empresa do usuário (com a regra atual de não permitir remover a última).
- **Combobox/Popover "Adicionar empresa"** (usando `Command` do shadcn) à direita do título:
  - Mostra apenas empresas em que o usuário NÃO é membro.
  - Campo de busca por nome (importante quando houver muitas empresas).
  - Ao clicar em uma, vincula o usuário (`organization_members.insert`) e fecha o popover.
- Se o usuário já pertence a todas as empresas existentes, o botão "Adicionar empresa" fica desabilitado com texto "Todas adicionadas".

Reaproveitar handlers existentes: `handleToggleOrg` (para adicionar/remover) e `handleSetPrimaryOrg`.

### Impacto visual
- Cards de usuário ficam um pouco mais altos quando ele pertence a muitas empresas, mas sempre uma empresa por linha (escaneável).
- Ações (principal, remover) ficam claras com ícones dedicados em vez de toda a pill servir como toggle.

---

## Fora do escopo
- Mudar `OrgSettings`, fluxo de convite por e-mail, criação de novas empresas.
- Alterar permissões/roles por empresa (continua role único por usuário).
- Alterar a regra "usuário precisa ter ao menos 1 empresa".

## Arquivos afetados
- `src/context/OrganizationContext.tsx` — popular `availableOrganizations` para usuários comuns.
- `src/pages/Index.tsx` — remover o gate `isSuperUser` no switcher do cabeçalho.
- `src/pages/AdminApproval.tsx` — novo bloco de empresas com lista vertical + combobox de busca.