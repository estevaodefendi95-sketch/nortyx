import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Check, X, ArrowLeft, Loader2, Shield, Eye, Pencil, Bell, Clock, Send, LayoutGrid, Building2, Star, Plus, UserPlus, StarOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

const ALL_TABS = [
  { id: "dados", label: "Dados" },
  { id: "calendar", label: "Calendário" },
  { id: "categories", label: "Categorias" },
  { id: "clientes", label: "Clientes" },
  { id: "lancamento", label: "Lançamento" },
];

interface OrgInfo {
  id: string;
  name: string;
  primary_color: string | null;
  logo_url: string | null;
}

interface PendingUser {
  id: string;
  user_id: string;
  display_name: string | null;
  created_at: string;
  approved: boolean;
  role?: string;
  tabVisibility?: Record<string, boolean>;
  organizationIds?: string[];
  primaryOrgId?: string | null;
}

const AdminApproval = () => {
  const [users, setUsers] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [pushHour, setPushHour] = useState<number>(18);
  const [pushMinute, setPushMinute] = useState<number>(0);
  const [pushLoading, setPushLoading] = useState(false);
  const [testPushLoading, setTestPushLoading] = useState(false);
  const [allOrgs, setAllOrgs] = useState<OrgInfo[]>([]);
  const [orgFilter, setOrgFilter] = useState<string>("all");

  // Nova empresa
  const [newOrgOpen, setNewOrgOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgSlug, setNewOrgSlug] = useState("");
  const [newOrgColor, setNewOrgColor] = useState("#3B82F6");
  const [newOrgSaving, setNewOrgSaving] = useState(false);

  // Novo usuário
  const [newUserOpen, setNewUserOpen] = useState(false);
  const [nuEmail, setNuEmail] = useState("");
  const [nuName, setNuName] = useState("");
  const [nuPassword, setNuPassword] = useState("");
  const [nuSendInvite, setNuSendInvite] = useState(false);
  const [nuOrgIds, setNuOrgIds] = useState<string[]>([]);
  const [nuPrimaryOrgId, setNuPrimaryOrgId] = useState<string>("");
  const [nuOrgRole, setNuOrgRole] = useState<"member" | "admin" | "owner">("member");
  const [nuSystemRole, setNuSystemRole] = useState<"user" | "admin" | "viewer">("user");
  const [nuTabs, setNuTabs] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(ALL_TABS.map((t) => [t.id, true]))
  );
  const [nuApproved, setNuApproved] = useState(true);
  const [nuSaving, setNuSaving] = useState(false);

  const { toast } = useToast();
  const navigate = useNavigate();

  const slugify = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50);

  const handleCreateOrg = async () => {
    if (!newOrgName.trim()) return;
    setNewOrgSaving(true);
    try {
      const slug = (newOrgSlug.trim() || slugify(newOrgName)) + "-" + Math.random().toString(36).slice(2, 6);
      const { data, error } = await supabase
        .from("organizations")
        .insert({ name: newOrgName.trim(), slug, primary_color: newOrgColor } as any)
        .select()
        .single();
      if (error) throw error;
      toast({ title: "Empresa criada", description: newOrgName });
      setAllOrgs((prev) => [...prev, {
        id: data.id, name: data.name, primary_color: data.primary_color, logo_url: data.logo_url,
      }].sort((a, b) => a.name.localeCompare(b.name)));
      setNewOrgName(""); setNewOrgSlug(""); setNewOrgColor("#3B82F6");
      setNewOrgOpen(false);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
    setNewOrgSaving(false);
  };

  const handleCreateUser = async () => {
    if (!nuEmail.trim() || nuOrgIds.length === 0) {
      toast({ title: "Preencha email e ao menos uma empresa", variant: "destructive" });
      return;
    }
    if (!nuSendInvite && (!nuPassword || nuPassword.length < 6)) {
      toast({ title: "Senha inválida", description: "Mínimo 6 caracteres ou marque enviar convite.", variant: "destructive" });
      return;
    }
    setNuSaving(true);
    try {
      const primary = nuOrgIds.includes(nuPrimaryOrgId) ? nuPrimaryOrgId : nuOrgIds[0];
      const { data, error } = await supabase.functions.invoke("admin-create-user", {
        body: {
          email: nuEmail.trim(),
          password: nuSendInvite ? undefined : nuPassword,
          send_invite: nuSendInvite,
          display_name: nuName.trim() || undefined,
          organization_ids: nuOrgIds,
          primary_organization_id: primary,
          organization_id: primary, // compat
          org_role: nuOrgRole,
          system_role: nuSystemRole,
          tab_visibility: nuTabs,
          approved: nuApproved,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({
        title: nuSendInvite ? "Convite enviado" : "Usuário criado",
        description: nuEmail,
      });
      setNuEmail(""); setNuName(""); setNuPassword(""); setNuSendInvite(false);
      setNuOrgRole("member"); setNuSystemRole("user");
      setNuOrgIds([]); setNuPrimaryOrgId("");
      setNuTabs(Object.fromEntries(ALL_TABS.map((t) => [t.id, true])));
      setNuApproved(true);
      setNewUserOpen(false);
      await fetchUsers();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
    setNuSaving(false);
  };


  // Fetch current push notification time from subscriptions
  useEffect(() => {
    const fetchPushTime = async () => {
      try {
        const { data } = await supabase
          .from("push_subscriptions")
          .select("notify_hour, notify_minute")
          .limit(1)
          .maybeSingle();
        if (data) {
          setPushHour(data.notify_hour ?? 18);
          setPushMinute(data.notify_minute ?? 0);
        }
      } catch {}
    };
    fetchPushTime();
  }, []);

  const handlePushTimeChange = async (hour: number, minute: number) => {
    setPushLoading(true);
    try {
      // Update all subscriptions with the new time
      const { error } = await supabase
        .from("push_subscriptions")
        .update({ notify_hour: hour, notify_minute: minute })
        .gte("id", 0); // update all rows
      if (error) throw error;
      setPushHour(hour);
      setPushMinute(minute);
      toast({ title: "Horário atualizado", description: `Notificações às ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}` });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message || "Falha ao atualizar horário", variant: "destructive" });
    }
    setPushLoading(false);
  };

  const fetchUsers = async () => {
    setLoading(true);
    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("id, user_id, display_name, created_at, approved, organization_id")
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    // Fetch roles for all users
    const { data: roles } = await supabase.from("user_roles").select("user_id, role");
    const roleMap = new Map<string, string>();
    roles?.forEach((r: any) => {
      const current = roleMap.get(r.user_id);
      if (r.role === "admin") roleMap.set(r.user_id, "admin");
      else if (r.role === "viewer" && current !== "admin") roleMap.set(r.user_id, "viewer");
      else if (!current) roleMap.set(r.user_id, r.role);
    });

    // Fetch tab visibility for all users
    const { data: tabVis } = await supabase.from("tab_visibility").select("user_id, tab_id, visible");
    const tabVisMap = new Map<string, Record<string, boolean>>();
    tabVis?.forEach((tv: any) => {
      const existing = tabVisMap.get(tv.user_id) || {};
      existing[tv.tab_id] = tv.visible;
      tabVisMap.set(tv.user_id, existing);
    });

    // Fetch all organizations
    const { data: orgs } = await supabase
      .from("organizations")
      .select("id, name, primary_color, logo_url")
      .order("name");
    setAllOrgs((orgs || []) as OrgInfo[]);

    // Fetch all org memberships
    const { data: memberships } = await supabase
      .from("organization_members")
      .select("user_id, organization_id");
    const memberMap = new Map<string, string[]>();
    memberships?.forEach((m: any) => {
      const arr = memberMap.get(m.user_id) || [];
      arr.push(m.organization_id);
      memberMap.set(m.user_id, arr);
    });

    setUsers((profiles || []).map((u: any) => ({
      id: u.id,
      user_id: u.user_id,
      display_name: u.display_name,
      created_at: u.created_at,
      approved: u.approved,
      role: roleMap.get(u.user_id) || "user",
      tabVisibility: tabVisMap.get(u.user_id) || {},
      organizationIds: memberMap.get(u.user_id) || [],
      primaryOrgId: u.organization_id || null,
    })));
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleApprove = async (userId: string, profileId: string) => {
    setActionLoading(profileId);
    const { error } = await supabase
      .from("profiles")
      .update({ approved: true })
      .eq("id", profileId);

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Aprovado!", description: "Usuário aprovado com sucesso." });
      setUsers((prev) => prev.map((u) => (u.id === profileId ? { ...u, approved: true } : u)));
    }
    setActionLoading(null);
  };

  const handleRevoke = async (profileId: string) => {
    setActionLoading(profileId);
    const { error } = await supabase
      .from("profiles")
      .update({ approved: false })
      .eq("id", profileId);

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Acesso revogado", description: "Usuário teve o acesso revogado." });
      setUsers((prev) => prev.map((u) => (u.id === profileId ? { ...u, approved: false } : u)));
    }
    setActionLoading(null);
  };

  const handleRoleChange = async (userId: string, profileId: string, newRole: string) => {
    setActionLoading(profileId);
    // Delete existing non-admin roles for this user (keep admin if changing to admin)
    await supabase.from("user_roles").delete().eq("user_id", userId).neq("role", "admin");

    if (newRole === "admin") {
      // Delete all roles then insert admin
      await supabase.from("user_roles").delete().eq("user_id", userId);
      await supabase.from("user_roles").insert({ user_id: userId, role: "admin" as any });
    } else if (newRole === "viewer") {
      // Delete admin role if exists, insert viewer
      await supabase.from("user_roles").delete().eq("user_id", userId);
      await supabase.from("user_roles").insert({ user_id: userId, role: "viewer" as any });
    } else {
      // Regular user - delete all roles
      await supabase.from("user_roles").delete().eq("user_id", userId);
    }

    setUsers((prev) => prev.map((u) => (u.id === profileId ? { ...u, role: newRole } : u)));
    toast({ title: "Perfil atualizado", description: `Usuário agora é ${newRole === "admin" ? "Administrador" : newRole === "viewer" ? "Visualizador" : "Editor"}` });
    setActionLoading(null);
  };

  const handleTabVisibilityChange = async (userId: string, profileId: string, tabId: string, visible: boolean) => {
    // Upsert tab visibility
    const { error } = await supabase
      .from("tab_visibility")
      .upsert({ user_id: userId, tab_id: tabId, visible }, { onConflict: "user_id,tab_id" });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === profileId) {
          const tv = { ...u.tabVisibility, [tabId]: visible };
          return { ...u, tabVisibility: tv };
        }
        return u;
      })
    );
  };

  const handleToggleOrg = async (user: PendingUser, orgId: string) => {
    const isMember = user.organizationIds?.includes(orgId);
    setActionLoading(user.id);
    try {
      if (isMember) {
        if ((user.organizationIds?.length || 0) <= 1) {
          toast({ title: "Ação bloqueada", description: "O usuário precisa pertencer a pelo menos uma empresa.", variant: "destructive" });
          setActionLoading(null);
          return;
        }
        const { error } = await supabase
          .from("organization_members")
          .delete()
          .eq("user_id", user.user_id)
          .eq("organization_id", orgId);
        if (error) throw error;
        const newIds = (user.organizationIds || []).filter((id) => id !== orgId);
        let newPrimary = user.primaryOrgId;
        if (user.primaryOrgId === orgId) {
          newPrimary = newIds[0] || null;
          await supabase.from("profiles").update({ organization_id: newPrimary }).eq("id", user.id);
        }
        setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, organizationIds: newIds, primaryOrgId: newPrimary } : u)));
      } else {
        const { error } = await supabase
          .from("organization_members")
          .insert({ user_id: user.user_id, organization_id: orgId, role: "member" as any });
        if (error) throw error;
        const newIds = [...(user.organizationIds || []), orgId];
        let newPrimary = user.primaryOrgId;
        if (!newPrimary) {
          newPrimary = orgId;
          await supabase.from("profiles").update({ organization_id: orgId, approved: true }).eq("id", user.id);
        }
        setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, organizationIds: newIds, primaryOrgId: newPrimary } : u)));
      }
    } catch (e: any) {
      toast({ title: "Erro", description: e.message || "Falha ao atualizar empresa", variant: "destructive" });
    }
    setActionLoading(null);
  };

  const handleSetPrimaryOrg = async (user: PendingUser, orgId: string) => {
    if (!user.organizationIds?.includes(orgId)) return;
    setActionLoading(user.id);
    const { error } = await supabase.from("profiles").update({ organization_id: orgId }).eq("id", user.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, primaryOrgId: orgId } : u)));
      toast({ title: "Empresa principal atualizada" });
    }
    setActionLoading(null);
  };


  const getRoleLabel = (role: string) => {
    switch (role) {
      case "admin": return "Administrador";
      case "viewer": return "Visualizador";
      default: return "Editor";
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "admin": return <Shield className="w-3.5 h-3.5 text-primary" />;
      case "viewer": return <Eye className="w-3.5 h-3.5 text-muted-foreground" />;
      default: return <Pencil className="w-3.5 h-3.5 text-income" />;
    }
  };

  const filterByOrg = (u: PendingUser) => orgFilter === "all" || u.organizationIds?.includes(orgFilter);
  const pending = users.filter((u) => !u.approved).filter(filterByOrg);
  const approved = users.filter((u) => u.approved).filter(filterByOrg);

  // Group approved by primary org when filter = all
  const approvedGroups: { orgId: string | "none"; org: OrgInfo | null; users: PendingUser[] }[] = (() => {
    if (orgFilter !== "all") return [{ orgId: orgFilter, org: allOrgs.find((o) => o.id === orgFilter) || null, users: approved }];
    const groups = new Map<string, PendingUser[]>();
    approved.forEach((u) => {
      const key = u.primaryOrgId || "none";
      const arr = groups.get(key) || [];
      arr.push(u);
      groups.set(key, arr);
    });
    const result: { orgId: string | "none"; org: OrgInfo | null; users: PendingUser[] }[] = [];
    allOrgs.forEach((o) => {
      if (groups.has(o.id)) result.push({ orgId: o.id, org: o, users: groups.get(o.id)! });
    });
    if (groups.has("none")) result.push({ orgId: "none", org: null, users: groups.get("none")! });
    return result;
  })();

  return (
    <div className="min-h-screen bg-background p-4 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold text-foreground">Gerenciar Usuários</h1>
        </div>
      </div>

      {/* Ações administrativas */}
      <section className="p-4 rounded-lg border border-border bg-card">
        <div className="flex items-center gap-2 mb-3">
          <Plus className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Criar novos</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Button variant="outline" onClick={() => setNewOrgOpen(true)} className="gap-2 justify-start h-auto py-3">
            <Building2 className="w-4 h-4 text-primary flex-shrink-0" />
            <div className="text-left">
              <div className="text-sm font-medium">Nova Empresa</div>
              <div className="text-[11px] text-muted-foreground font-normal">Cadastrar uma nova organização</div>
            </div>
          </Button>
          <Button onClick={() => { const first = allOrgs[0]?.id || ""; setNuOrgIds(first ? [first] : []); setNuPrimaryOrgId(first); setNewUserOpen(true); }} className="gap-2 justify-start h-auto py-3">
            <UserPlus className="w-4 h-4 flex-shrink-0" />
            <div className="text-left">
              <div className="text-sm font-medium">Criar Usuário</div>
              <div className="text-[11px] opacity-80 font-normal">Vincular usuário a uma empresa</div>
            </div>
          </Button>
        </div>
      </section>

      {/* Push Notification Settings */}
      <section className="p-4 rounded-lg border border-border bg-card space-y-3">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Notificações Push</h2>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Horário de envio:</span>
          <div className="flex items-center gap-1">
            <Select
              value={String(pushHour)}
              onValueChange={(v) => handlePushTimeChange(parseInt(v, 10), pushMinute)}
              disabled={pushLoading}
            >
              <SelectTrigger className="w-[70px] h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 24 }, (_, i) => (
                  <SelectItem key={i} value={String(i)} className="text-sm">
                    {String(i).padStart(2, "0")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-sm font-medium text-muted-foreground">:</span>
            <Select
              value={String(pushMinute)}
              onValueChange={(v) => handlePushTimeChange(pushHour, parseInt(v, 10))}
              disabled={pushLoading}
            >
              <SelectTrigger className="w-[70px] h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 60 }, (_, i) => (
                  <SelectItem key={i} value={String(i)} className="text-sm">
                    {String(i).padStart(2, "0")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {pushLoading && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
        </div>
        <p className="text-xs text-muted-foreground">
          Horário de envio das notificações para todos os dispositivos (horário de Brasília).
        </p>
        <Button
          variant="outline"
          size="sm"
          disabled={testPushLoading}
          onClick={async () => {
            setTestPushLoading(true);
            try {
              const { data, error } = await supabase.functions.invoke("send-push", {
                body: { test: true },
              });
              if (error) throw error;
              toast({
                title: "Teste enviado",
                description: `Enviados: ${data?.sent ?? 0}, Falhas: ${data?.failed ?? 0}, Dispositivos: ${data?.totalSubs ?? 0}`,
              });
            } catch (e: any) {
              toast({ title: "Erro no teste", description: e.message || "Falha ao enviar push de teste", variant: "destructive" });
            }
            setTestPushLoading(false);
          }}
          className="gap-2"
        >
          {testPushLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Testar Notificação
        </Button>
      </section>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Pendentes ({pending.length})
            </h2>
            {pending.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum usuário pendente.</p>
            ) : (
              pending.map((user) => (
                <div key={user.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
                  <div>
                    <p className="font-medium text-foreground">{user.display_name || "Sem nome"}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(user.created_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleApprove(user.user_id, user.id)}
                    disabled={actionLoading === user.id}
                  >
                    {actionLoading === user.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4 mr-1" />
                    )}
                    Aprovar
                  </Button>
                </div>
              ))
            )}
          </section>

          {/* Filtro de empresa */}
          {allOrgs.length > 1 && (
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Filtrar por empresa:</span>
              <Select value={orgFilter} onValueChange={setOrgFilter}>
                <SelectTrigger className="h-8 w-[180px] text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-sm">Todas</SelectItem>
                  {allOrgs.map((o) => (
                    <SelectItem key={o.id} value={o.id} className="text-sm">{o.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Aprovados ({approved.length})
            </h2>
            {approvedGroups.map((group) => (
              <div key={group.orgId} className="space-y-2">
                <div className="flex items-center gap-2 pt-2">
                  <span
                    className="inline-block w-2 h-2 rounded-full"
                    style={{ backgroundColor: group.org?.primary_color || "hsl(var(--muted-foreground))" }}
                  />
                  <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                    {group.org?.name || "Sem empresa"} ({group.users.length})
                  </h3>
                </div>
                {group.users.map((user) => (
              <div key={user.id} className="p-3 rounded-lg border border-border bg-card space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {getRoleIcon(user.role || "user")}
                      <p className="font-medium text-foreground truncate">{user.display_name || "Sem nome"}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(user.created_at).toLocaleDateString("pt-BR")} · {getRoleLabel(user.role || "user")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Select
                      value={user.role || "user"}
                      onValueChange={(val) => handleRoleChange(user.user_id, user.id, val)}
                      disabled={actionLoading === user.id}
                    >
                      <SelectTrigger className="h-8 w-[130px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin" className="text-xs">
                          <span className="flex items-center gap-1.5"><Shield className="w-3 h-3" /> Administrador</span>
                        </SelectItem>
                        <SelectItem value="user" className="text-xs">
                          <span className="flex items-center gap-1.5"><Pencil className="w-3 h-3" /> Editor</span>
                        </SelectItem>
                        <SelectItem value="viewer" className="text-xs">
                          <span className="flex items-center gap-1.5"><Eye className="w-3 h-3" /> Visualizador</span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRevoke(user.id)}
                      disabled={actionLoading === user.id}
                    >
                      {actionLoading === user.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <X className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
                {/* Tab visibility controls */}
                <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-border/50">
                  <LayoutGrid className="w-3 h-3 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground mr-1">Abas:</span>
                  {ALL_TABS.map((tab) => {
                    const isVisible = user.tabVisibility?.[tab.id] !== false;
                    return (
                      <label key={tab.id} className="flex items-center gap-1 cursor-pointer">
                        <Checkbox
                          checked={isVisible}
                          onCheckedChange={(checked) => handleTabVisibilityChange(user.user_id, user.id, tab.id, !!checked)}
                          className="w-3.5 h-3.5"
                        />
                        <span className="text-[10px] text-muted-foreground">{tab.label}</span>
                      </label>
                    );
                  })}
                </div>
                {/* Empresas controls (minimizado) */}
                {allOrgs.length > 0 && (() => {
                  const memberOrgs = allOrgs.filter((o) => user.organizationIds?.includes(o.id));
                  const availableToAdd = allOrgs.filter((o) => !user.organizationIds?.includes(o.id));
                  const primaryOrg =
                    memberOrgs.find((o) => o.id === user.primaryOrgId) || memberOrgs[0] || null;
                  const extraCount = Math.max(0, memberOrgs.length - 1);
                  return (
                    <div className="pt-2 border-t border-border/50 flex items-center gap-2">
                      <Building2 className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            disabled={actionLoading === user.id}
                            className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-border bg-muted/20 hover:bg-muted/40 text-xs min-w-0 max-w-full disabled:opacity-50"
                            title="Gerenciar empresas"
                          >
                            {primaryOrg ? (
                              <>
                                <span
                                  className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: primaryOrg.primary_color || "hsl(var(--muted-foreground))" }}
                                />
                                <span className="truncate text-foreground">{primaryOrg.name}</span>
                                {extraCount > 0 && (
                                  <span className="ml-0.5 px-1 rounded bg-primary/10 text-primary text-[10px] font-medium flex-shrink-0">
                                    +{extraCount}
                                  </span>
                                )}
                              </>
                            ) : (
                              <span className="text-muted-foreground italic">Sem empresa</span>
                            )}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent align="start" className="w-72 p-2 space-y-2">
                          {memberOrgs.length === 0 ? (
                            <p className="text-[10px] text-muted-foreground italic px-1">Nenhuma empresa vinculada</p>
                          ) : (
                            <div className="space-y-1">
                              {memberOrgs.map((org) => {
                                const isPrimary = user.primaryOrgId === org.id;
                                const canRemove = (user.organizationIds?.length || 0) > 1;
                                return (
                                  <div
                                    key={org.id}
                                    className={`flex items-center gap-2 px-2 py-1.5 rounded-md border text-xs ${
                                      isPrimary ? "bg-primary/5 border-primary/30" : "bg-muted/20 border-border"
                                    }`}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => !isPrimary && handleSetPrimaryOrg(user, org.id)}
                                      disabled={isPrimary || actionLoading === user.id}
                                      title={isPrimary ? "Empresa principal" : "Definir como principal"}
                                      className="flex items-center"
                                    >
                                      <Star
                                        className={`w-3.5 h-3.5 ${isPrimary ? "fill-primary text-primary" : "text-muted-foreground hover:text-primary"}`}
                                      />
                                    </button>
                                    <span
                                      className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                                      style={{ backgroundColor: org.primary_color || "hsl(var(--muted-foreground))" }}
                                    />
                                    <span className="truncate flex-1 text-foreground">{org.name}</span>
                                    {isPrimary && (
                                      <span className="text-[9px] uppercase tracking-wider text-primary font-medium">Principal</span>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => handleToggleOrg(user, org.id)}
                                      disabled={!canRemove || actionLoading === user.id}
                                      title={canRemove ? "Remover empresa" : "Usuário precisa ter ao menos uma empresa"}
                                      className="p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          <Command className="border border-border rounded-md">
                            <CommandInput placeholder="Adicionar empresa..." className="h-8" />
                            <CommandList>
                              <CommandEmpty>
                                {availableToAdd.length === 0 ? "Todas adicionadas" : "Nenhuma empresa"}
                              </CommandEmpty>
                              {availableToAdd.length > 0 && (
                                <CommandGroup>
                                  {availableToAdd.map((org) => (
                                    <CommandItem
                                      key={org.id}
                                      value={org.name}
                                      onSelect={() => handleToggleOrg(user, org.id)}
                                      className="text-xs gap-2"
                                    >
                                      <Plus className="w-3 h-3 text-muted-foreground" />
                                      <span
                                        className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                                        style={{ backgroundColor: org.primary_color || "hsl(var(--muted-foreground))" }}
                                      />
                                      <span className="truncate">{org.name}</span>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              )}
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                  );
                })()}
              </div>
                ))}
              </div>
            ))}
          </section>
        </>
      )}

      {/* Dialog: Nova Empresa */}
      <Dialog open={newOrgOpen} onOpenChange={setNewOrgOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Empresa</DialogTitle>
            <DialogDescription>Crie uma empresa para vincular usuários.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input value={newOrgName} onChange={(e) => { setNewOrgName(e.target.value); if (!newOrgSlug) setNewOrgSlug(slugify(e.target.value)); }} placeholder="Minha Empresa" />
            </div>
            <div className="space-y-1.5">
              <Label>Slug</Label>
              <Input value={newOrgSlug} onChange={(e) => setNewOrgSlug(slugify(e.target.value))} placeholder="minha-empresa" />
            </div>
            <div className="space-y-1.5">
              <Label>Cor principal</Label>
              <div className="flex items-center gap-2">
                <input type="color" value={newOrgColor} onChange={(e) => setNewOrgColor(e.target.value)} className="w-10 h-10 rounded border border-border cursor-pointer" />
                <Input value={newOrgColor} onChange={(e) => setNewOrgColor(e.target.value)} className="w-32" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOrgOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateOrg} disabled={newOrgSaving || !newOrgName.trim()}>
              {newOrgSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Criar Usuário */}
      <Dialog open={newUserOpen} onOpenChange={setNewUserOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Criar Usuário</DialogTitle>
            <DialogDescription>Provisione um novo usuário e vincule a uma empresa.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>E-mail</Label>
                <Input type="email" value={nuEmail} onChange={(e) => setNuEmail(e.target.value)} placeholder="usuario@exemplo.com" />
              </div>
              <div className="space-y-1.5">
                <Label>Nome</Label>
                <Input value={nuName} onChange={(e) => setNuName(e.target.value)} placeholder="Nome do usuário" />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-md border border-border p-2">
              <Label className="text-sm">Enviar convite por e-mail (sem senha)</Label>
              <Switch checked={nuSendInvite} onCheckedChange={setNuSendInvite} />
            </div>
            {!nuSendInvite && (
              <div className="space-y-1.5">
                <Label>Senha provisória</Label>
                <Input type="text" value={nuPassword} onChange={(e) => setNuPassword(e.target.value)} placeholder="mínimo 6 caracteres" />
              </div>
            )}

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Empresas ({nuOrgIds.length})</Label>
                {allOrgs.length > 0 && (
                  <button
                    type="button"
                    className="text-xs text-primary hover:underline"
                    onClick={() => {
                      if (nuOrgIds.length === allOrgs.length) {
                        setNuOrgIds([]); setNuPrimaryOrgId("");
                      } else {
                        const ids = allOrgs.map((o) => o.id);
                        setNuOrgIds(ids);
                        if (!ids.includes(nuPrimaryOrgId)) setNuPrimaryOrgId(ids[0] || "");
                      }
                    }}
                  >
                    {nuOrgIds.length === allOrgs.length ? "Limpar" : "Selecionar todas"}
                  </button>
                )}
              </div>
              <div className="max-h-56 overflow-y-auto rounded-md border border-border divide-y divide-border">
                {allOrgs.length === 0 ? (
                  <p className="p-3 text-xs text-muted-foreground">Nenhuma empresa cadastrada.</p>
                ) : (
                  allOrgs.map((o) => {
                    const checked = nuOrgIds.includes(o.id);
                    const isPrimary = nuPrimaryOrgId === o.id;
                    return (
                      <div key={o.id} className="flex items-center gap-2 px-2.5 py-2 text-sm">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(c) => {
                            const next = !!c;
                            setNuOrgIds((prev) => {
                              const arr = next ? [...prev, o.id] : prev.filter((x) => x !== o.id);
                              if (next && !nuPrimaryOrgId) setNuPrimaryOrgId(o.id);
                              if (!next && nuPrimaryOrgId === o.id) setNuPrimaryOrgId(arr[0] || "");
                              return arr;
                            });
                          }}
                        />
                        <span
                          className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: o.primary_color || "hsl(var(--muted-foreground))" }}
                        />
                        <span className="flex-1 truncate text-foreground">{o.name}</span>
                        <button
                          type="button"
                          disabled={!checked}
                          onClick={() => setNuPrimaryOrgId(o.id)}
                          title={isPrimary ? "Empresa principal" : "Definir como principal"}
                          className="p-0.5 disabled:opacity-30"
                        >
                          {isPrimary ? (
                            <Star className="w-4 h-4 fill-primary text-primary" />
                          ) : (
                            <StarOff className="w-4 h-4 text-muted-foreground hover:text-primary" />
                          )}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
              {nuOrgIds.length > 1 && (
                <p className="text-[11px] text-muted-foreground">
                  ⭐ marca a empresa principal (a que abre por padrão para o usuário).
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Papel na empresa</Label>
                <Select value={nuOrgRole} onValueChange={(v: any) => setNuOrgRole(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">Membro</SelectItem>
                    <SelectItem value="admin">Admin da empresa</SelectItem>
                    <SelectItem value="owner">Owner</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Perfil do sistema</Label>
                <Select value={nuSystemRole} onValueChange={(v: any) => setNuSystemRole(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Editor</SelectItem>
                    <SelectItem value="viewer">Visualizador</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Abas visíveis</Label>
              <div className="flex flex-wrap gap-3">
                {ALL_TABS.map((tab) => (
                  <label key={tab.id} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox checked={nuTabs[tab.id] !== false} onCheckedChange={(c) => setNuTabs((p) => ({ ...p, [tab.id]: !!c }))} />
                    <span className="text-sm">{tab.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-md border border-border p-2">
              <Label className="text-sm">Já aprovado</Label>
              <Switch checked={nuApproved} onCheckedChange={setNuApproved} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewUserOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateUser} disabled={nuSaving}>
              {nuSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {nuSendInvite ? "Enviar convite" : "Criar usuário"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminApproval;
