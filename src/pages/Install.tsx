import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Download, Smartphone, CheckCircle2 } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const InstallPage = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    setIsIOS(/iPad|iPhone|iPod/.test(ua));

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);

    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setIsInstalled(true);
    setDeferredPrompt(null);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-6">
        <img src="/pwa-icon-512.png" alt="nortyx" className="w-24 h-24 mx-auto rounded-2xl shadow-lg" />
        <h1 className="text-3xl font-display font-bold">nortyx</h1>
        <p className="text-muted-foreground">
          Instale o app no seu celular para acessar rapidamente o controle financeiro do restaurante.
        </p>

        {isInstalled ? (
          <div className="flex items-center justify-center gap-2 text-income">
            <CheckCircle2 className="w-5 h-5" />
            <span className="font-medium">App já instalado!</span>
          </div>
        ) : deferredPrompt ? (
          <Button onClick={handleInstall} size="lg" className="w-full">
            <Download className="w-5 h-5 mr-2" /> Instalar App
          </Button>
        ) : isIOS ? (
          <div className="rounded-xl bg-card border border-border p-4 text-left space-y-3">
            <p className="font-medium flex items-center gap-2">
              <Smartphone className="w-4 h-4" /> No iPhone / iPad:
            </p>
            <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
              <li>Toque no botão <strong>Compartilhar</strong> (ícone de quadrado com seta)</li>
              <li>Role para baixo e toque em <strong>"Adicionar à Tela de Início"</strong></li>
              <li>Toque em <strong>"Adicionar"</strong></li>
            </ol>
          </div>
        ) : (
          <div className="rounded-xl bg-card border border-border p-4 text-left space-y-3">
            <p className="font-medium flex items-center gap-2">
              <Smartphone className="w-4 h-4" /> No Android:
            </p>
            <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
              <li>Abra o menu do navegador (três pontinhos)</li>
              <li>Toque em <strong>"Instalar app"</strong> ou <strong>"Adicionar à tela inicial"</strong></li>
            </ol>
          </div>
        )}

        <a href="/" className="text-sm text-primary hover:underline block">
          ← Voltar ao app
        </a>
      </div>
    </div>
  );
};

export default InstallPage;
