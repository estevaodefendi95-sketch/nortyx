import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPER_EMAIL = "estevaodefendi95@gmail.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autenticado" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const caller = userData?.user;
    if (!caller) return json({ error: "Sessão inválida" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const isSuper = caller.email === SUPER_EMAIL;
    if (!isSuper) {
      const { data: roles } = await admin
        .from("user_roles")
        .select("role")
        .eq("user_id", caller.id);
      const hasAdmin = (roles || []).some((r: any) => r.role === "admin");
      if (!hasAdmin) return json({ error: "Sem permissão" }, 403);
    }

    const { user_id } = await req.json().catch(() => ({}));
    if (!user_id || typeof user_id !== "string") {
      return json({ error: "user_id é obrigatório" }, 400);
    }
    if (user_id === caller.id) {
      return json({ error: "Você não pode excluir a si mesmo" }, 400);
    }

    // Limpa dados relacionados (caso não haja CASCADE configurado)
    await admin.from("tab_visibility").delete().eq("user_id", user_id);
    await admin.from("user_roles").delete().eq("user_id", user_id);
    await admin.from("organization_members").delete().eq("user_id", user_id);
    await admin.from("profiles").delete().eq("user_id", user_id);

    // Remove do auth
    const { error: delErr } = await admin.auth.admin.deleteUser(user_id);
    if (delErr) throw delErr;

    return json({ ok: true });
  } catch (e) {
    console.error("admin-delete-user error", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
