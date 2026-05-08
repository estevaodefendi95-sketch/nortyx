# Polir carregamento inicial da tela principal

## Problema
Ao abrir `/`, há um "flash" onde o cabeçalho aparece com nome de empresa vazio, valores em R$ 0,00 e abas piscando antes dos dados de auth/organização/transações chegarem. Isso parece um bug de "layout antigo".

## Causa
- `AuthProvider`, `OrganizationProvider` e `TransactionsProvider` carregam dados em sequência (auth → org → transactions).
- A `Index` renderiza o layout completo imediatamente, mostrando estados vazios (logo placeholder, nome em branco, valores R$ 0,00, contadores zerados) antes desses providers terminarem.
- O switcher de empresas (`Building2`), o badge de notificações e os ícones de admin aparecem depois — causando "saltos" visuais.

## Solução: skeletons consistentes durante o boot

Manter o layout atual, apenas adicionando placeholders animados (`<Skeleton/>` do shadcn) enquanto `loading` for verdadeiro nos providers.

### Mudanças

**1. `src/pages/Index.tsx`**
- Ler `loading` de `useAuth()` e de `useOrganization()`, e `isLoading` de `useTransactions()`.
- Definir `bootLoading = authLoading || orgLoading` (essencial pra evitar piscar do header).
- Definir `dataLoading = txLoading` (afeta valores e conteúdo das views).
- No header, quando `bootLoading`:
  - Logo: manter círculo, sem ícone de câmera placeholder (já neutro).
  - Nome da empresa: substituir por `<Skeleton className="h-6 w-32" />`.
  - Botão de switcher de empresa: ocultar (já que depende de `availableOrganizations`).
  - Ícones de admin/settings: ocultar até `authLoading` terminar (evita aparecer/sumir).
- Linha de resumo (income/expense/saldo): quando `dataLoading || bootLoading`, mostrar 3 `<Skeleton className="h-4 w-24" />` no lugar dos valores.
- Abas (desktop) e bottom nav (mobile): renderizar normalmente já que dependem só de `visibleTabs` (que não depende de fetch crítico). Se `visibleTabs` ainda não carregou, mostrar `<Skeleton className="h-9 w-full" />` no lugar da barra de abas.
- Conteúdo principal (`<main>`): se `bootLoading`, mostrar bloco de skeleton genérico (3-4 cards) em vez de renderizar `DadosView` com dados vazios.

**2. `src/hooks/useTabVisibility.ts`** (verificar se expõe `loading`)
- Se não expõe, adicionar flag `loading` para alinhar com o padrão.

**3. Animação suave**
- Envolver header e main num wrapper com `transition-opacity` para fade-in quando `bootLoading` terminar.

### Fora de escopo
- Lógica de auth, RLS, organizações ou transações.
- Redesign visual: manter cores, tipografia, espaçamentos atuais.
- Otimização de queries (não pedido).

### Verificação
- Recarregar `/` com cache limpo: header deve mostrar skeletons → fade para conteúdo real, sem nome vazio nem valores R$ 0,00 piscando.
- Trocar de empresa: switcher mantém comportamento atual.
