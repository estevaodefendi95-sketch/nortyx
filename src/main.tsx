import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "./index.css";

// Limpeza única por sessão: remove SW/cache antigos que podem estar
// servindo um bundle desatualizado (ex.: input sem suporte a PDF).
(async () => {
  if (typeof window === "undefined") return;
  if (sessionStorage.getItem("sw-cleaned-v2") === "1") return;
  try {
    const regs = (await navigator.serviceWorker?.getRegistrations?.()) || [];
    const keys = (await caches?.keys?.()) || [];
    if (regs.length === 0 && keys.length === 0) {
      sessionStorage.setItem("sw-cleaned-v2", "1");
      return;
    }
    await Promise.all(keys.map((k) => caches.delete(k)));
    sessionStorage.setItem("sw-cleaned-v2", "1");
    // Apenas força reload se havia cache antigo realmente presente
    if (keys.length > 0) {
      location.reload();
    }
  } catch {
    sessionStorage.setItem("sw-cleaned-v2", "1");
  }
})();

// Auto-update PWA: assim que uma nova versão do bundle estiver pronta,
// recarrega a página para evitar o "flash" do layout antigo em cache.
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    updateSW(true);
  },
  onRegisteredSW(_swUrl, registration) {
    if (registration) {
      // Verifica novas versões a cada 60s enquanto a aba estiver aberta
      setInterval(() => {
        registration.update().catch(() => {});
      }, 60_000);
    }
  },
});

createRoot(document.getElementById("root")!).render(<App />);
