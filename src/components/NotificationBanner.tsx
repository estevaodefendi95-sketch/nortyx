import { useState, useEffect } from "react";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const DISMISSED_KEY = "paggio_notif_banner_dismissed";

export default function NotificationBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!("Notification" in window)) return;
    if (Notification.permission === "granted" || Notification.permission === "denied") return;
    if (localStorage.getItem(DISMISSED_KEY)) return;
    setVisible(true);
  }, []);

  const handleAllow = async () => {
    const result = await Notification.requestPermission();
    if (result === "granted") {
      new Notification("🔔 Notificações ativadas!", {
        body: "Você receberá lembretes de contas pendentes.",
        icon: "/pwa-icon-192.png",
      });
    }
    setVisible(false);
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "true");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-md bg-card border border-border rounded-xl shadow-lg p-4 animate-in slide-in-from-bottom-4">
      <button onClick={handleDismiss} className="absolute top-2 right-2 p-1 text-muted-foreground hover:text-foreground">
        <X className="w-4 h-4" />
      </button>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Bell className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">Ativar notificações</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Receba lembretes diários sobre contas pendentes no seu celular.
          </p>
          <Button onClick={handleAllow} size="sm" className="mt-2 w-full">
            Permitir notificações
          </Button>
        </div>
      </div>
    </div>
  );
}
