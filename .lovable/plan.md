## Objetivo

Corrigir o layout do bloco **"Criar novos"** no topo da página `/admin` (botões **Nova Empresa** e **Criar Usuário**), mantendo tudo no mesmo lugar mas com aparência mais limpa, alinhada ao tema escuro do nortyx.

## O que muda

Arquivo: `src/pages/AdminApproval.tsx` (apenas as linhas 440–461 do card "Criar novos").

### Layout novo

- Remover o cabeçalho redundante "Criar novos" + ícone Plus (o título da página já indica o contexto).
- Transformar os dois botões em **cards clicáveis** lado a lado, com:
  - Ícone em círculo com fundo `bg-primary/10` (Building2 / UserPlus em `text-primary`).
  - Título em `text-sm font-semibold` + descrição em `text-xs text-muted-foreground`.
  - Borda `border-border`, fundo `bg-card`, hover com `hover:border-primary/50 hover:bg-accent/30 transition-colors`.
  - Altura uniforme, padding consistente (`p-4`), `rounded-xl`.
  - Grid responsivo: `grid-cols-1 sm:grid-cols-2 gap-3`.
- Texto alinhado à esquerda, ícone no topo-esquerda, sem truncar em telas estreitas.
- Acessibilidade: cada card é um `<button>` com `aria-label` descritivo.

### Exemplo de estrutura

```text
┌─────────────────────────┐  ┌─────────────────────────┐
│ ◉  Nova Empresa         │  │ ◉  Criar Usuário        │
│    Cadastrar uma nova   │  │    Vincular usuário a   │
│    organização          │  │    uma ou mais empresas │
└─────────────────────────┘  └─────────────────────────┘
```

## Fora do escopo

- Lógica dos diálogos (Nova Empresa / Criar Usuário) — sem alterações.
- Fluxo de seleção múltipla de empresas — já implementado e funcional.
- Renomear "Paggio" em chaves de localStorage / dados internos (não são visíveis ao usuário).

## Arquivos

- `src/pages/AdminApproval.tsx` — apenas o bloco `<section>` "Criar novos".
