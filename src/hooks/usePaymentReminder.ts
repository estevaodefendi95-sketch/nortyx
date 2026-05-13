import { useEffect, useCallback, useState } from "react";
import { useTransactions } from "@/context/TransactionsContext";
import { supabase } from "@/integrations/supabase/client";

const LAST_NOTIF_KEY = "nortyx_last_reminder";
const VAPID_PUBLIC_KEY = "BP9SVkOCyXQ23hyRgLw9_LVTUeZ2cD8eLVDjtsyeDIx_BJxfDz-NSImcdvIlBUVShBAWcg4ZGrooizPgoJ2V05w";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function uint8ArrayToBase64Url(uint8Array: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < uint8Array.length; i++) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function usePaymentReminder() {
  const { transactions } = useTransactions();
  const [configuredHour, setConfiguredHour] = useState<number | null>(null);
  const [configuredMinute, setConfiguredMinute] = useState<number>(0);

  // Fetch the configured notification time from push_subscriptions
  useEffect(() => {
    const fetchSchedule = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("push_subscriptions")
        .select("notify_hour, notify_minute")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      if (data) {
        setConfiguredHour(data.notify_hour);
        setConfiguredMinute(data.notify_minute);
      } else {
        // Fallback: try to get the global schedule from the edge function
        try {
          const { data: scheduleData } = await supabase.functions.invoke("update-push-schedule", {
            method: "GET",
          });
          if (scheduleData?.hour_brt != null) {
            setConfiguredHour(scheduleData.hour_brt);
            setConfiguredMinute(0);
          }
        } catch {
          // Default to 18:00 if nothing configured
          setConfiguredHour(18);
          setConfiguredMinute(0);
        }
      }
    };
    fetchSchedule();
  }, []);

  const getPendingBills = useCallback(() => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    return transactions.filter((t) => {
      if (t.tipo !== "saida" || t.pago) return false;
      const [d, m, y] = t.data.split("/").map(Number);
      const txDate = new Date(y, m - 1, d);
      return txDate <= today;
    });
  }, [transactions]);

  const registerPushSubscription = useCallback(async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      console.log("[Push] Not supported in this browser");
      return;
    }

    try {
      console.log("[Push] Waiting for service worker...");
      const registration = await navigator.serviceWorker.ready;
      console.log("[Push] Service worker ready, scope:", registration.scope);

      let subscription = await registration.pushManager.getSubscription();
      console.log("[Push] Existing subscription:", !!subscription);

      if (!subscription) {
        console.log("[Push] Creating new subscription...");
        const appServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: appServerKey.buffer as ArrayBuffer,
        });
        console.log("[Push] New subscription created");
      }

      if (!subscription) {
        console.error("[Push] Failed to get subscription");
        return;
      }

      const key = subscription.getKey("p256dh");
      const auth = subscription.getKey("auth");
      if (!key || !auth) {
        console.error("[Push] Missing p256dh or auth keys");
        return;
      }

      const p256dh = uint8ArrayToBase64Url(new Uint8Array(key));
      const authStr = uint8ArrayToBase64Url(new Uint8Array(auth));
      const endpoint = subscription.endpoint;

      console.log("[Push] Endpoint:", endpoint.substring(0, 60) + "...");

      const { data: { user } } = await supabase.auth.getUser();
      console.log("[Push] User:", user?.id ?? "anonymous");

      const { data: existing } = await supabase
        .from("push_subscriptions")
        .select("id")
        .eq("endpoint", endpoint)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("push_subscriptions")
          .update({
            p256dh,
            auth: authStr,
            user_id: user?.id ?? null,
          } as any)
          .eq("id", existing.id);
        if (error) {
          console.error("[Push] Update error:", error);
        } else {
          console.log("[Push] Subscription updated successfully");
        }
      } else {
        const { error } = await supabase.from("push_subscriptions").insert({
          endpoint,
          p256dh,
          auth: authStr,
          user_id: user?.id ?? null,
          notify_hour: configuredHour ?? 18,
          notify_minute: configuredMinute,
        } as any);
        if (error) {
          console.error("[Push] Insert error:", error);
        } else {
          console.log("[Push] Subscription saved successfully");
        }
      }
    } catch (err) {
      console.error("[Push] Registration error:", err);
    }
  }, [configuredHour, configuredMinute]);

  // Auto-register on mount
  useEffect(() => {
    const autoRegister = async () => {
      if (!("Notification" in window)) {
        console.log("[Push] Notifications not supported");
        return;
      }

      console.log("[Push] Permission:", Notification.permission);

      if (Notification.permission === "default") {
        const result = await Notification.requestPermission();
        console.log("[Push] Permission result:", result);
        if (result === "granted") {
          await registerPushSubscription();
        }
      } else if (Notification.permission === "granted") {
        await registerPushSubscription();
      }
    };

    const timer = setTimeout(autoRegister, 1500);
    return () => clearTimeout(timer);
  }, [registerPushSubscription]);

  // Local fallback notification - only at configured time
  const showNotification = useCallback((pending: typeof transactions) => {
    if (pending.length === 0) return;
    const title = "Você tem contas para pagar";
    const body = `${pending.length} conta${pending.length > 1 ? "s" : ""} pendente${pending.length > 1 ? "s" : ""}. Não esqueça!`;

    if ("Notification" in window && Notification.permission === "granted") {
      try {
        if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
          navigator.serviceWorker.ready.then((reg) => {
            reg.showNotification(title, { body, tag: "payment-reminder", vibrate: [200, 100, 200] } as NotificationOptions);
          });
        } else {
          new Notification(title, { body, tag: "payment-reminder" });
        }
      } catch {
        new Notification(title, { body, tag: "payment-reminder" });
      }
    }
  }, []);

  const checkAndNotify = useCallback(() => {
    // Only notify at the configured hour/minute
    if (configuredHour === null) return;

    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    // Only fire if current time matches configured time
    if (currentHour !== configuredHour || currentMinute !== configuredMinute) return;

    const todayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
    const lastNotif = localStorage.getItem(LAST_NOTIF_KEY);

    // Only send once per day
    if (lastNotif === todayKey) return;

    const pending = getPendingBills();
    if (pending.length > 0) {
      showNotification(pending);
      localStorage.setItem(LAST_NOTIF_KEY, todayKey);
    }
  }, [getPendingBills, showNotification, configuredHour, configuredMinute]);

  useEffect(() => {
    checkAndNotify();
    const interval = setInterval(checkAndNotify, 60_000);
    return () => clearInterval(interval);
  }, [checkAndNotify]);

  return {
    getPendingBills,
    registerPushSubscription,
  };
}
