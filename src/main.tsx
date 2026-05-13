import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "./index.css";

// Purga única (versionada) de SW/caches antigos para garantir que usuários
// recebam o bundle mais recente após uma atualização. Incrementar a chave
// abaixo força uma nova limpeza em todos os clientes já instalados.
const SW_PURGE_KEY = "sw-purged-v4";
(async () => {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(SW_PURGE_KEY) === "1") return;
  try {
    const keys = (await caches?.keys?.()) || [];
    await Promise.all(keys.map((k) => caches.delete(k)));
    localStorage.setItem(SW_PURGE_KEY, "1");
    if (keys.length > 0) {
      // Recarrega ignorando cache HTTP para puxar o novo index.html/bundle
      location.reload();
    }
  } catch {
    localStorage.setItem(SW_PURGE_KEY, "1");
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
