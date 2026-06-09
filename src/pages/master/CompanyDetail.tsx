import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Save,
  Loader2,
  Eye,
  Ban,
  CheckCircle2,
  Upload,
  X,
  Users,
  Calendar,
  Building2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import MasterLayout from "@/components/master/MasterLayout";
import { statusBadge } from "./Companies";
import {
  getOrganizationById,
  updateOrganization,
  suspendOrganization,
  activateOrganization,
  logAdminAction,
  startImpersonation,
  type OrgWithStats,
} from "@/lib/superAdmin";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { useOrganization } from "@/context/OrganizationContext";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import ColorPicker from "@/components/ColorPicker";

interface OrgMember {
  id: string;
  user_id: string;
  role: string;
  display_name: string | null;
  email: string | null;
}

const CompanyDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { plans } = useSuperAdmin();
  const { organization: currentOrg, switchOrganization } = useOrganization();

  const [org, setOrg] = useState<OrgWithStats | null>(null);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [customAppName, setCustomAppName] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#3B82F6");
  const [planId, setPlanId] = useState<string>("");
  const [subscriptionStatus, setSubscriptionStatus] = useState("trial");
  const [trialEndsAt, setTrialEndsAt] = useState("");

  // Logo upload
  const logoRef = useRef<HTMLInputElement>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);

    Promise.all([
      getOrganizationById(id),
      supabase
        .from("organization_members")
        .select("id, user_id, role")
        .eq("organization_id", id),
    ]).then(async ([orgData, { data: mems }]) => {
      if (!orgData) { navigate("/master/empresas"); return; }

      setOrg(orgData);
      setName(orgData.name);
      setCustomAppName(orgData.custom_app_name ?? "");
      setPrimaryColor(orgData.primary_color);
      setPlanId(orgData.plan_id ?? "");
      setSubscriptionStatus(orgData.subscription_status);
      setTrialEndsAt(orgData.trial_ends_at ? orgData.trial_ends_at.slice(0, 10) : "");
      setLogoPreview(orgData.logo_url);

      // Load member names
      if (mems && mems.length) {
        const ids = mems.map((m) => m.user_id);
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, display_name")
          .in("user_id", ids);
        const nameMap = new Map(profs?.map((p) => [p.user_id, p.display_name]) ?? []);

        // Try to get emails from auth.users via profiles
        const augmented: OrgMember[] = mems.map((m) => ({
          id: m.id,
          user_id: m.user_id,
          role: m.role,
          display_name: nameMap.get(m.user_id) ?? null,
          email: null,
        }));
        setMembers(augmented);
      }
    }).finally(() => setLoading(false));
  }, [id, navigate]);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setLogoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const uploadLogo = async (): Promise<string | null> => {
    if (!logoFile || !id) return logoPreview;
    const ext = logoFile.name.split(".").pop();
    const path = `logos/${id}/logo.${ext}`;
    const { error } = await supabase.storage
      .from("logos")
      .upload(path, logoFile, { upsert: true });
    if (error) { toast({ title: "Erro ao enviar logo", description: error.message, variant: "destructive" }); return null; }
    const { data } = supabase.storage.from("logos").getPublicUrl(path);
    return data.publicUrl;
  };

  const handleSave = async () => {
    if (!id || !org) return;
    setSaving(true);
    try {
      let logo_url = org.logo_url;
      if (logoFile) {
        const uploaded = await uploadLogo();
        if (uploaded) logo_url = uploaded;
      }

      await updateOrganization(id, {
        name,
        primary_color: primaryColor,
        plan_id: planId || null,
        subscription_status: subscriptionStatus,
        trial_ends_at: trialEndsAt ? new Date(trialEndsAt).toISOString() : null,
        custom_app_name: customAppName || null,
        logo_url,
      });

      await logAdminAction(user!.id, user!.email!, "update_org", id, { name, subscriptionStatus });

      toast({ title: "Empresa atualizada com sucesso" });
      const refreshed = await getOrganizationById(id);
      if (refreshed) setOrg(refreshed);
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleStatusToggle = async () => {
    if (!id || !org) return;
    setActionLoading(true);
    try {
      const isSuspended = org.subscription_status === "suspenso";
      if (isSuspended) {
        await activateOrganization(id);
        await logAdminAction(user!.id, user!.email!, "activate_org", id, { name: org.name });
        setSubscriptionStatus("ativo");
        toast({ title: `"${org.name}" reativada` });
      } else {
        await suspendOrganization(id);
        await logAdminAction(user!.id, user!.email!, "suspend_org", id, { name: org.name });
        setSubscriptionStatus("suspenso");
        toast({ title: `"${org.name}" suspensa` });
      }
      const refreshed = await getOrganizationById(id);
      if (refreshed) setOrg(refreshed);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleImpersonate = async () => {
    if (!id || !org) return;
    await logAdminAction(user!.id, user!.email!, "impersonate_start", id, { name: org.name });
    startImpersonation(id, org.custom_app_name || org.name, currentOrg?.id ?? "");
    await switchOrganization(id);
    navigate("/");
  };

  const badge = statusBadge(subscriptionStatus);

  return (
    <MasterLayout>
      <div className="p-8 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/master/empresas")}
              className="p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            {loading ? (
              <Skeleton className="h-7 w-48 bg-white/10" />
            ) : (
              <div>
                <h1 className="text-xl font-bold text-white">
                  {org?.custom_app_name || org?.name}
                </h1>
                <p className="text-white/40 text-sm">{org?.slug}</p>
              </div>
            )}
          </div>
          {!loading && org && (
            <div className="flex items-center gap-2">
              <Button
                onClick={handleStatusToggle}
                disabled={actionLoading}
                variant="outline"
                size="sm"
                className={`border-white/10 bg-transparent ${
                  org.subscription_status === "suspenso"
                    ? "text-green-400 hover:bg-green-400/10"
                    : "text-red-400 hover:bg-red-400/10"
                }`}
              >
                {actionLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : org.subscription_status === "suspenso" ? (
                  <><CheckCircle2 className="w-4 h-4 mr-1.5" /> Reativar</>
                ) : (
                  <><Ban className="w-4 h-4 mr-1.5" /> Suspender</>
                )}
              </Button>
              <Button
                onClick={handleImpersonate}
                size="sm"
                className="bg-amber-500 hover:bg-amber-400 text-amber-950 font-semibold"
              >
                <Eye className="w-4 h-4 mr-1.5" />
                Impersonar
              </Button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-48 w-full bg-white/5" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left column — main form */}
            <div className="lg:col-span-2 space-y-6">
              {/* General */}
              <Card className="bg-[#1a1a2e] border-white/5">
                <CardHeader>
                  <CardTitle className="text-white text-base flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-primary" />
                    Dados gerais
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-white/60 text-xs">Nome da empresa</Label>
                      <Input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="bg-[#0f0f1a] border-white/10 text-white focus:border-primary/50"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-white/60 text-xs">
                        Nome do app (white-label)
                        <span className="ml-1 text-white/30">(opcional)</span>
                      </Label>
                      <Input
                        value={customAppName}
                        onChange={(e) => setCustomAppName(e.target.value)}
                        placeholder="Ex.: FinançasPro"
                        className="bg-[#0f0f1a] border-white/10 text-white focus:border-primary/50 placeholder:text-white/20"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-white/60 text-xs">Plano</Label>
                      <Select value={planId} onValueChange={setPlanId}>
                        <SelectTrigger className="bg-[#0f0f1a] border-white/10 text-white">
                          <SelectValue placeholder="Selecionar plano" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#1a1a2e] border-white/10 text-white">
                          <SelectItem value="">Sem plano</SelectItem>
                          {plans.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name} — R$ {p.price.toFixed(2)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-white/60 text-xs">Status</Label>
                      <Select value={subscriptionStatus} onValueChange={setSubscriptionStatus}>
                        <SelectTrigger className="bg-[#0f0f1a] border-white/10 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#1a1a2e] border-white/10 text-white">
                          <SelectItem value="ativo">Ativo</SelectItem>
                          <SelectItem value="trial">Trial</SelectItem>
                          <SelectItem value="suspenso">Suspenso</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {subscriptionStatus === "trial" && (
                    <div className="space-y-2">
                      <Label className="text-white/60 text-xs">Trial expira em</Label>
                      <Input
                        type="date"
                        value={trialEndsAt}
                        onChange={(e) => setTrialEndsAt(e.target.value)}
                        className="bg-[#0f0f1a] border-white/10 text-white focus:border-primary/50"
                      />
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* White label */}
              <Card className="bg-[#1a1a2e] border-white/5">
                <CardHeader>
                  <CardTitle className="text-white text-base">White Label</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid grid-cols-2 gap-6">
                    {/* Logo */}
                    <div className="space-y-3">
                      <Label className="text-white/60 text-xs">Logo</Label>
                      <div className="flex flex-col items-start gap-3">
                        <div className="w-16 h-16 rounded-xl border border-white/10 bg-[#0f0f1a] flex items-center justify-center overflow-hidden">
                          {logoPreview ? (
                            <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" />
                          ) : (
                            <Building2 className="w-6 h-6 text-white/20" />
                          )}
                        </div>
                        <div className="flex gap-2">
                          <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => logoRef.current?.click()}
                            className="border-white/10 bg-transparent text-white/60 hover:bg-white/5 text-xs"
                          >
                            <Upload className="w-3.5 h-3.5 mr-1.5" />
                            Upload
                          </Button>
                          {logoPreview && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => { setLogoPreview(null); setLogoFile(null); }}
                              className="text-red-400/60 hover:text-red-400 hover:bg-red-400/5 text-xs"
                            >
                              <X className="w-3.5 h-3.5 mr-1" />
                              Remover
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Color */}
                    <div className="space-y-3">
                      <Label className="text-white/60 text-xs">Cor principal</Label>
                      <div className="flex items-center gap-2">
                        {/* Native color wheel — opens OS picker */}
                        <label
                          className="w-10 h-10 rounded-lg border border-white/15 cursor-pointer overflow-hidden flex-shrink-0 hover:ring-2 hover:ring-primary/50 transition-all"
                          style={{ backgroundColor: primaryColor }}
                          title="Abrir seletor de cor"
                        >
                          <input
                            type="color"
                            value={primaryColor}
                            onChange={(e) => setPrimaryColor(e.target.value)}
                            className="opacity-0 w-0 h-0"
                          />
                        </label>
                        {/* Hex text input */}
                        <input
                          value={primaryColor}
                          onChange={(e) => {
                            const v = e.target.value;
                            setPrimaryColor(v);
                          }}
                          onBlur={(e) => {
                            if (!/^#[0-9a-fA-F]{6}$/.test(e.target.value)) {
                              setPrimaryColor("#3B82F6");
                            }
                          }}
                          placeholder="#3B82F6"
                          maxLength={7}
                          className="flex-1 h-10 bg-[#0f0f1a] border border-white/10 rounded-md px-3 text-white font-mono text-sm focus:outline-none focus:border-primary/50"
                        />
                        {/* Popover picker (presets) */}
                        <div className="flex-shrink-0">
                          <ColorPicker value={primaryColor} onChange={setPrimaryColor} size="md" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Live preview */}
                  <div>
                    <p className="text-white/30 text-xs mb-3">Pré-visualização</p>
                    <div
                      className="rounded-xl border border-white/5 p-4 flex items-center gap-3"
                      style={{ background: primaryColor + "18" }}
                    >
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden border border-white/10"
                        style={{ background: primaryColor + "33" }}
                      >
                        {logoPreview ? (
                          <img src={logoPreview} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-white font-bold text-sm" style={{ color: primaryColor }}>
                            {(customAppName || name || "N").charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <span className="font-bold text-lg" style={{ color: primaryColor }}>
                        {customAppName || name || "Nortyx"}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Save button */}
              <Button
                onClick={handleSave}
                disabled={saving}
                className="w-full bg-primary hover:bg-primary/90"
              >
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Salvar alterações
              </Button>
            </div>

            {/* Right column — info + members */}
            <div className="space-y-6">
              {/* Summary card */}
              <Card className="bg-[#1a1a2e] border-white/5">
                <CardContent className="pt-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-white/40 text-xs">Status</span>
                    <Badge className={badge.className}>{badge.label}</Badge>
                  </div>
                  <Separator className="bg-white/5" />
                  <div className="flex items-center justify-between">
                    <span className="text-white/40 text-xs">Membros</span>
                    <span className="text-white text-sm font-medium flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-white/30" />
                      {org?.member_count ?? 0}
                    </span>
                  </div>
                  <Separator className="bg-white/5" />
                  <div className="flex items-center justify-between">
                    <span className="text-white/40 text-xs">Criada em</span>
                    <span className="text-white text-sm flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-white/30" />
                      {org ? new Date(org.created_at).toLocaleDateString("pt-BR") : "—"}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Members */}
              <Card className="bg-[#1a1a2e] border-white/5">
                <CardHeader className="pb-3">
                  <CardTitle className="text-white text-sm flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary/70" />
                    Membros ({members.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {members.length === 0 ? (
                    <p className="text-white/30 text-xs text-center py-6">Nenhum membro</p>
                  ) : (
                    <div className="divide-y divide-white/5">
                      {members.map((m) => (
                        <div key={m.id} className="flex items-center justify-between px-4 py-3">
                          <div>
                            <p className="text-sm text-white/80">
                              {m.display_name || m.user_id.slice(0, 8) + "..."}
                            </p>
                          </div>
                          <Badge variant="outline" className="text-[10px] border-white/10 text-white/40">
                            {m.role}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </MasterLayout>
  );
};

export default CompanyDetail;
