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
    if (!authHeader) {
      return json({ error: "Não autenticado" }, 401);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const caller = userData?.user;
    if (!caller) return json({ error: "Sessão inválida" }, 401);

    const body = await req.json().catch(() => ({}));
    const { email, organization_id, role = "member" } = body || {};
    if (!email || !organization_id) {
      return json({ error: "email e organization_id obrigatórios" }, 400);
    }
    if (!["member", "admin", "owner"].includes(role)) {
      return json({ error: "papel inválido" }, 400);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // permission check
    const isSuper = caller.email === SUPER_EMAIL;
    if (!isSuper) {
      const { data: mem } = await admin
        .from("organization_members")
        .select("role")
        .eq("organization_id", organization_id)
        .eq("user_id", caller.id)
        .maybeSingle();
      if (!mem || (mem.role !== "owner" && mem.role !== "admin")) {
        return json({ error: "Sem permissão" }, 403);
      }
    }

    // Look up user by email
    const normalized = String(email).trim().toLowerCase();
    let target: { id: string; email?: string } | null = null;
    let page = 1;
    while (page <= 25) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw error;
      const found = data.users.find((u) => (u.email || "").toLowerCase() === normalized);
      if (found) { target = { id: found.id, email: found.email ?? undefined }; break; }
      if (data.users.length < 200) break;
      page++;
    }

    if (!target) {
      // Create / update invite row, RLS bypass via service role
      const { error: invErr } = await admin
        .from("organization_invites")
        .upsert(
          { organization_id, email: normalized, role, invited_by: caller.id, accepted_at: null },
          { onConflict: "organization_id,email" }
        );
      if (invErr) throw invErr;
      return json({ ok: true, invited: true, email: normalized });
    }

    // Already member?
    const { data: existing } = await admin
      .from("organization_members")
      .select("id")
      .eq("organization_id", organization_id)
      .eq("user_id", target.id)
      .maybeSingle();
    if (existing) return json({ error: "Esse usuário já é membro da organização" }, 409);

    const { error: insErr } = await admin
      .from("organization_members")
      .insert({ organization_id, user_id: target.id, role });
    if (insErr) throw insErr;

    await admin
      .from("profiles")
      .update({ organization_id, approved: true })
      .eq("user_id", target.id);

    // Mark any pending invite as accepted
    await admin
      .from("organization_invites")
      .update({ accepted_at: new Date().toISOString() })
      .eq("organization_id", organization_id)
      .eq("email", normalized);

    return json({ ok: true, added: true, user_id: target.id, email: target.email });
  } catch (e) {
    console.error("add-org-member error", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
