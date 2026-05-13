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
      location.reload();
    }
  } catch {
    localStorage.setItem(SW_PURGE_KEY, "1");
  }
})();

// Sincroniza o manifesto do PWA: se o name/short_name mudou desde a última
// visita, limpa caches do app, atualiza o <link rel="manifest"> com cache-bust
// e recarrega para que o navegador (e o prompt de instalação) leiam o novo
// manifesto. Isso resolve o caso "nome antigo aparece no popup de instalação".
const MANIFEST_KEY = "pwa-manifest-sig-v1";
(async () => {
  if (typeof window === "undefined") return;
  try {
    const url = `/manifest.webmanifest?t=${Date.now()}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return;
    const m = await res.json();
    const sig = `${m.name ?? ""}|${m.short_name ?? ""}|${m.start_url ?? ""}|${m.theme_color ?? ""}`;
    const prev = localStorage.getItem(MANIFEST_KEY);

    // Sempre força o navegador a reler o manifesto a partir de uma URL única
    const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (link) {
      const fresh = `/manifest.webmanifest?v=${encodeURIComponent(sig)}`;
      if (link.href.indexOf(fresh) === -1) link.href = fresh;
    }

    if (prev && prev !== sig) {
      const keys = (await caches?.keys?.()) || [];
      await Promise.all(keys.map((k) => caches.delete(k)));
      localStorage.setItem(MANIFEST_KEY, sig);
      // Pequeno delay para o link href propagar antes do reload
      setTimeout(() => location.reload(), 50);
      return;
    }
    localStorage.setItem(MANIFEST_KEY, sig);
  } catch {
    // silencioso: manifesto pode não estar acessível em dev
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
