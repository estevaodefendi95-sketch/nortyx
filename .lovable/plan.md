## Problema

A segunda imagem (layout antigo: switcher de empresa em formato de Select largo, sem ícones de admin) é o bundle anterior que o **Service Worker do PWA** está servindo do cache. Quando o app é aberto, o SW entrega os assets antigos primeiro; depois detecta uma nova versão, mas só aplica na próxima visita — por isso o usuário vê o layout antigo "piscar" antes do novo aparecer.

Hoje o `vite.config.ts` usa `VitePWA({ registerType: "autoUpdate", skipWaiting: true, clientsClaim: true })`, mas o `src/main.tsx` **não chama `registerSW`** com handler de update. Resultado: o novo SW assume controle, mas a página já carregou com os assets antigos e nada força o reload.

## Solução (instantânea, sem mudar layout)

### 1. `src/main.tsx` — registrar SW com auto-reload

Importar `registerSW` do `virtual:pwa-register` e disparar `window.location.reload()` assim que uma nova versão estiver pronta. Também checar atualização periódica (a cada 60s) enquanto a aba está aberta:

```ts
import { registerSW } from "virtual:pwa-register";

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    updateSW(true); // aplica skipWaiting e recarrega
  },
  onRegisteredSW(_swUrl, registration) {
    if (registration) {
      setInterval(() => registration.update(), 60_000);
    }
  },
});
```

### 2. `src/vite-env.d.ts` — adicionar referência de tipos do plugin

```ts
/// <reference types="vite-plugin-pwa/client" />
```

### 3. `vite.config.ts` — manter `autoUpdate` e garantir limpeza

Já está com `cleanupOutdatedCaches: true`, `skipWaiting: true`, `clientsClaim: true`. Adicionar `navigateFallback: 'index.html'` apenas se necessário (manter como está se já funciona). Sem mais mudanças aqui.

## Resultado esperado

- Usuário que já tinha o app aberto/instalado abre a página → SW antigo entrega o shell em cache → em paralelo busca o novo bundle → assim que novo SW está "waiting", `updateSW(true)` é chamado → página recarrega automaticamente para a versão nova **sem o flash do layout antigo persistir**.
- Em sessões longas, a checagem a cada 60s garante que novos deploys sejam aplicados sem o usuário precisar refresh manual.

## Fora de escopo

- Mudanças de UI/cores/tabs.
- Lógica de autenticação, organizações, transações.
- Skeletons (já implementados na resposta anterior).

## Verificação

1. Build + abrir preview com o app já instalado/cache antigo.
2. Confirmar que o reload automático acontece **uma vez** e mostra direto o layout novo (Building2 icon compacto + ícones de admin), sem piscar o Select largo antigo.
3. Console deve mostrar log de SW atualizado; sem loops de reload.
