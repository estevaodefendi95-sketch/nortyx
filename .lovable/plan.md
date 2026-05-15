## Problema

Atualmente, ao recarregar o app ou voltar depois de fechar, o usuário sempre cai na aba **Dados** com o mês atual selecionado — porque `activeTab`, `selectedMonths` e `selectedYear` são `useState` simples em `src/pages/Index.tsx`, sem persistência.

## Objetivo

Manter o usuário exatamente na mesma página/aba e com os mesmos filtros que ele estava usando, mesmo após:
- Recarregar a página (F5)
- Fechar e reabrir o app/PWA
- Navegar entre rotas e voltar

## Mudanças

### 1. Persistir aba ativa e filtros em `src/pages/Index.tsx`
- Trocar `useState<Tab>("dados")` por um estado inicializado a partir de `localStorage` (chave `nortyx_active_tab`), com fallback `"dados"`.
- Mesmo tratamento para `selectedMonths` (`nortyx_selected_months`) e `selectedYear` (`nortyx_selected_year`).
- Adicionar `useEffect` que grava cada um no `localStorage` sempre que mudar.
- Ao restaurar a aba, validar que ela ainda está em `visibleTabs` (caso o admin tenha desabilitado aquela aba); se não estiver, cair na primeira aba visível.

### 2. Refletir aba ativa na URL (opcional, recomendado)
- Usar `?tab=calendar` como query param via `useSearchParams`, sincronizando com `activeTab`.
- Vantagem: refresh real do navegador mantém a aba mesmo sem `localStorage`, e o usuário pode compartilhar/fixar o link da aba.
- Mantém `localStorage` como fallback para quando entrar pela raiz `/`.

### 3. Escopo por organização
- Como o app é multi-tenant, prefixar as chaves do `localStorage` com o `organization.id` (ex.: `nortyx:${orgId}:active_tab`) para que trocar de organização não traga a aba "errada" da org anterior.

### 4. Não tocar em rotas de auth
- Restauração só vale dentro de `Index` (rotas protegidas). `/auth`, `/onboarding`, `/pending`, `/reset-password` continuam com seus redirecionamentos atuais — esse fluxo de autenticação não deve ser preservado.

## Fora do escopo
- Não mexer em `RouteTransition`, providers ou no roteador.
- Não persistir estado interno de subtelas (modais abertos, scroll, etc.) — só aba e filtros globais do header.

## Detalhes técnicos

Arquivo afetado: `src/pages/Index.tsx`.

Padrão de leitura segura:
```ts
const STORAGE_PREFIX = `nortyx:${organization?.id ?? "anon"}`;
const [activeTab, setActiveTab] = useState<Tab>(() => {
  try {
    const v = localStorage.getItem(`${STORAGE_PREFIX}:active_tab`);
    return (v as Tab) || "dados";
  } catch { return "dados"; }
});
```
+ `useEffect` com `localStorage.setItem` quando o valor muda, e validação contra `visibleTabs` quando `tabsLoading` terminar.
