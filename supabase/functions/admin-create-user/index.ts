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

    // Verificar se é admin ou super user
    const isSuper = caller.email === SUPER_EMAIL;
    if (!isSuper) {
      const { data: roles } = await admin
        .from("user_roles")
        .select("role")
        .eq("user_id", caller.id);
      const hasAdmin = (roles || []).some((r: any) => r.role === "admin");
      if (!hasAdmin) return json({ error: "Sem permissão" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const {
      email,
      password,
      display_name,
      organization_id,
      org_role = "member",
      system_role = "user", // user | admin | viewer
      tab_visibility = {}, // { tab_id: boolean }
      approved = true,
      send_invite = false,
    } = body || {};

    if (!email || !organization_id) {
      return json({ error: "email e organization_id são obrigatórios" }, 400);
    }
    if (!["member", "admin", "owner"].includes(org_role)) {
      return json({ error: "papel inválido" }, 400);
    }
    if (!["user", "admin", "viewer"].includes(system_role)) {
      return json({ error: "perfil inválido" }, 400);
    }

    const normalized = String(email).trim().toLowerCase();

    // Verifica se usuário já existe
    let userId: string | null = null;
    let page = 1;
    while (page <= 25) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw error;
      const found = data.users.find((u) => (u.email || "").toLowerCase() === normalized);
      if (found) { userId = found.id; break; }
      if (data.users.length < 200) break;
      page++;
    }

    if (!userId) {
      // Criar
      if (send_invite || !password) {
        const { data, error } = await admin.auth.admin.inviteUserByEmail(normalized, {
          data: { full_name: display_name || normalized },
        });
        if (error) throw error;
        userId = data.user?.id || null;
      } else {
        const { data, error } = await admin.auth.admin.createUser({
          email: normalized,
          password,
          email_confirm: true,
          user_metadata: { full_name: display_name || normalized },
        });
        if (error) throw error;
        userId = data.user?.id || null;
      }
    } else if (password) {
      // Atualizar senha de usuário existente
      await admin.auth.admin.updateUserById(userId, { password });
    }

    if (!userId) return json({ error: "Falha ao criar usuário" }, 500);

    // Profile
    const { data: existingProfile } = await admin
      .from("profiles")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    const profilePayload: any = {
      organization_id,
      approved,
    };
    if (display_name) profilePayload.display_name = display_name;
    if (existingProfile) {
      await admin.from("profiles").update(profilePayload).eq("user_id", userId);
    } else {
      await admin.from("profiles").insert({ user_id: userId, ...profilePayload });
    }

    // Membership
    const { data: existingMem } = await admin
      .from("organization_members")
      .select("id")
      .eq("organization_id", organization_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!existingMem) {
      await admin.from("organization_members").insert({
        organization_id,
        user_id: userId,
        role: org_role,
      });
    } else {
      await admin.from("organization_members").update({ role: org_role }).eq("id", existingMem.id);
    }

    // System role (user_roles): admin e viewer ficam armazenados; "user" = sem role
    await admin.from("user_roles").delete().eq("user_id", userId);
    if (system_role === "admin") {
      await admin.from("user_roles").insert({ user_id: userId, role: "admin" });
    } else if (system_role === "viewer") {
      await admin.from("user_roles").insert({ user_id: userId, role: "viewer" });
    }

    // Tab visibility
    const tabEntries = Object.entries(tab_visibility || {});
    for (const [tab_id, visible] of tabEntries) {
      const { data: existingTv } = await admin
        .from("tab_visibility")
        .select("id")
        .eq("user_id", userId)
        .eq("tab_id", tab_id)
        .maybeSingle();
      if (existingTv) {
        await admin.from("tab_visibility").update({ visible: !!visible, organization_id }).eq("id", existingTv.id);
      } else {
        await admin.from("tab_visibility").insert({
          user_id: userId,
          tab_id,
          visible: !!visible,
          organization_id,
        });
      }
    }

    return json({ ok: true, user_id: userId });
  } catch (e) {
    console.error("admin-create-user error", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
