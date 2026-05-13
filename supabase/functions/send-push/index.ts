import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const VAPID_PUBLIC = "BP9SVkOCyXQ23hyRgLw9_LVTUeZ2cD8eLVDjtsyeDIx_BJxfDz-NSImcdvIlBUVShBAWcg4ZGrooizPgoJ2V05w";
    const VAPID_PRIVATE = "z-iWHjRCZfNchvr5xltBH_nJ6pFx241RIVx4oGYU928";
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    webpush.setVapidDetails("mailto:admin@nortyx.app", VAPID_PUBLIC, VAPID_PRIVATE);

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    // Check if this is a test/force send
    let forceAll = false;
    try {
      const body = await req.json();
      forceAll = body?.test === true;
    } catch {
      // No body or invalid JSON — normal cron call
    }

    // If test mode, send a generic test notification to ALL subscriptions immediately
    if (forceAll) {
      const { data: allSubs } = await supabase.from("push_subscriptions").select("*");
      console.log(`[TEST] Sending test notification to ${(allSubs || []).length} subscriptions`);

      const testPayload = JSON.stringify({
        title: "Teste de notificação",
        body: "nortyx - Notificações push funcionando! ✅",
      });

      let sent = 0;
      let failed = 0;
      for (const sub of allSubs || []) {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            testPayload
          );
          sent++;
        } catch (e: any) {
          console.error("Push error for sub", sub.id, ":", e?.statusCode, e?.body || e?.message);
          if (e?.statusCode === 410 || e?.statusCode === 404) {
            await supabase.from("push_subscriptions").delete().eq("id", sub.id);
          }
          failed++;
        }
      }

      return new Response(JSON.stringify({ test: true, sent, failed, totalSubs: (allSubs || []).length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Normal cron flow: check pending bills using BRT date
    const now = new Date();
    const brtOffset = -3 * 60;
    const brtTime = new Date(now.getTime() + brtOffset * 60 * 1000);
    const currentHour = brtTime.getUTCHours();
    const currentMinute = brtTime.getUTCMinutes();

    // BRT "today" end of day for comparison
    const brtYear = brtTime.getUTCFullYear();
    const brtMonth = brtTime.getUTCMonth();
    const brtDay = brtTime.getUTCDate();
    const todayEndBRT = new Date(brtYear, brtMonth, brtDay, 23, 59, 59, 999);

    console.log(`BRT time: ${currentHour}:${String(currentMinute).padStart(2, "0")}, today BRT: ${brtDay}/${brtMonth + 1}/${brtYear}`);

    const { data: txns } = await supabase
      .from("transactions")
      .select("*")
      .eq("tipo", "saida")
      .eq("pago", false);

    const pending = (txns || []).filter((t: any) => {
      const [d, m, y] = t.data.split("/").map(Number);
      const txDate = new Date(y, m - 1, d);
      txDate.setHours(23, 59, 59, 999);
      return txDate <= todayEndBRT;
    });

    if (pending.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: "no pending bills" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = JSON.stringify({
      title: "Você tem contas para pagar",
      body: `${pending.length} conta${pending.length > 1 ? "s" : ""} pendente${pending.length > 1 ? "s" : ""}. Não esqueça!`,
    });

    // Get subscriptions matching current BRT hour/minute
    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("notify_hour", currentHour)
      .eq("notify_minute", currentMinute);

    console.log(`Subscriptions to notify: ${(subs || []).length}`);

    let sent = 0;
    let failed = 0;
    for (const sub of subs || []) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
        sent++;
      } catch (e: any) {
        console.error("Push error for sub", sub.id, ":", e?.statusCode, e?.body || e?.message);
        if (e?.statusCode === 410 || e?.statusCode === 404) {
          await supabase.from("push_subscriptions").delete().eq("id", sub.id);
        }
        failed++;
      }
    }

    return new Response(JSON.stringify({ sent, failed, pending: pending.length, totalSubs: (subs || []).length, brtHour: currentHour, brtMinute: currentMinute }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-push error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
