import { useState, useRef, useEffect } from "react";
import { useOrganization } from "@/context/OrganizationContext";
import { useAuth } from "@/hooks/useAuth";
import { useCategories } from "@/context/CategoriesContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Camera, X, Save, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

const ALL_TABS = [
  { id: "dados", label: "Dados" },
  { id: "calendar", label: "Calendário" },
  { id: "categories", label: "Categorias" },
  { id: "clientes", label: "Clientes" },
  { id: "lancamento", label: "Lançamento" },
];

const SUPER_EMAIL = "estevaodefendi95@gmail.com";

const OrgSettings = () => {
  const { organization, membership, refreshOrganization } = useOrganization();
  const { user } = useAuth();
  const { categories } = useCategories();
  const { toast } = useToast();
  const navigate = useNavigate();
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(organization?.name || "");
  const [primaryColor, setPrimaryColor] = useState(organization?.primary_color || "#3B82F6");
  const [logoPreview, setLogoPreview] = useState<string | null>(organization?.logo_url || null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [tabVisibility, setTabVisibility] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  // Dashboard settings state
  const [showFaturamentoMedio, setShowFaturamentoMedio] = useState(true);
  const [showCmv, setShowCmv] = useState(true);
  const [showTopFoods, setShowTopFoods] = useState(true);
  const [showTopDrinks, setShowTopDrinks] = useState(true);
  const [cmvCategories, setCmvCategories] = useState<string[]>(["C", "B"]);
  const [rankingTitle, setRankingTitle] = useState("Top 10");
  const [rankingTitle2, setRankingTitle2] = useState("Top 10");

  const isOwner = membership?.role === "owner" || membership?.role === "admin";
  const isSuperUser = user?.email === SUPER_EMAIL;

  // Load tab visibility for the org
  useEffect(() => {
    if (!organization) return;
    const load = async () => {
      const { data } = await supabase
        .from("tab_visibility")
        .select("tab_id, visible")
        .eq("organization_id", organization.id);

      const vis: Record<string, boolean> = {};
      ALL_TABS.forEach((t) => (vis[t.id] = true));
      if (data) {
        data.forEach((d) => (vis[d.tab_id] = d.visible));
      }
      setTabVisibility(vis);
    };
    load();
  }, [organization]);

  // Load dashboard settings
  useEffect(() => {
    if (!organization) return;
    const load = async () => {
      const { data } = await supabase
        .from("org_dashboard_settings")
        .select("*")
        .eq("organization_id", organization.id)
        .maybeSingle();

      if (data) {
        setShowFaturamentoMedio(data.show_faturamento_medio);
        setShowCmv(data.show_cmv);
        setShowTopFoods(data.show_top_foods);
        setShowTopDrinks(data.show_top_drinks);
        setCmvCategories(data.cmv_categories || ["C", "B"]);
        setRankingTitle((data as any).ranking_title || "Top 10");
        setRankingTitle2((data as any).ranking_title_2 || "Top 10");
      }
    };
    load();
  }, [organization]);

  useEffect(() => {
    if (organization) {
      setName(organization.name);
      setPrimaryColor(organization.primary_color);
      setLogoPreview(organization.logo_url);
    }
  }, [organization]);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setLogoPreview(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const toggleCmvCategory = (code: string) => {
    setCmvCategories((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const handleSave = async () => {
    if (!organization || !user) return;
    setSaving(true);

    try {
      let logoUrl = organization.logo_url;

      if (logoFile) {
        const ext = logoFile.name.split(".").pop();
        const path = `${organization.id}/logo.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("org-logos")
          .upload(path, logoFile, { upsert: true });
        if (!uploadError) {
          const { data: urlData } = supabase.storage.from("org-logos").getPublicUrl(path);
          logoUrl = urlData.publicUrl;
        }
      }

      if (logoPreview === null && organization.logo_url) {
        logoUrl = null;
      }

      const { error } = await supabase
        .from("organizations")
        .update({ name, primary_color: primaryColor, logo_url: logoUrl })
        .eq("id", organization.id);
      if (error) throw error;

      // Save tab visibility
      for (const tab of ALL_TABS) {
        const visible = tabVisibility[tab.id] ?? true;
        const { data: existing } = await supabase
          .from("tab_visibility")
          .select("id")
          .eq("organization_id", organization.id)
          .eq("tab_id", tab.id)
          .eq("user_id", user.id)
          .maybeSingle();

        if (existing) {
          await supabase.from("tab_visibility").update({ visible }).eq("id", existing.id);
        } else {
          await supabase.from("tab_visibility").insert({
            organization_id: organization.id,
            tab_id: tab.id,
            user_id: user.id,
            visible,
          });
        }
      }

      // Save dashboard settings (upsert)
      const { error: dashError } = await supabase
        .from("org_dashboard_settings")
        .upsert(
          {
            organization_id: organization.id,
            show_faturamento_medio: showFaturamentoMedio,
            show_cmv: showCmv,
            show_top_foods: showTopFoods,
            show_top_drinks: showTopDrinks,
            cmv_categories: cmvCategories,
            ranking_title: rankingTitle,
            ranking_title_2: rankingTitle2,
          } as any,
          { onConflict: "organization_id" }
        );
      if (dashError) throw dashError;

      await refreshOrganization();
      toast({ title: "Configurações salvas com sucesso!" });
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (!organization || !isOwner) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Acesso restrito ao proprietário da organização.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold">Configurações da Organização</h1>
        </div>
      </header>

      <main className="container max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Branding */}
        <Card>
          <CardHeader>
            <CardTitle>Identidade Visual</CardTitle>
            <CardDescription>Logo, nome e cor principal da sua empresa</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="relative group">
                <button
                  onClick={() => logoInputRef.current?.click()}
                  className="w-16 h-16 rounded-lg border border-border bg-secondary/50 flex items-center justify-center overflow-hidden hover:border-primary/50 transition-colors"
                >
                  {logoPreview ? (
                    <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" />
                  ) : (
                    <Camera className="w-6 h-6 text-muted-foreground" />
                  )}
                </button>
                {logoPreview && (
                  <button
                    onClick={() => { setLogoPreview(null); setLogoFile(null); }}
                    className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
                <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
              </div>
              <div className="text-sm text-muted-foreground">Clique para alterar o logotipo</div>
            </div>

            <div className="space-y-2">
              <Label>Nome da Empresa</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome da empresa" />
            </div>

            <div className="space-y-2">
              <Label>Cor Principal</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="w-10 h-10 rounded border border-border cursor-pointer"
                />
                <Input
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="w-32"
                  placeholder="#3B82F6"
                />
                <div className="w-10 h-10 rounded-lg border border-border" style={{ backgroundColor: primaryColor }} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tab Visibility */}
        <Card>
          <CardHeader>
            <CardTitle>Abas Visíveis</CardTitle>
            <CardDescription>Controle quais abas ficam disponíveis para os membros</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {ALL_TABS.map((tab) => (
              <div key={tab.id} className="flex items-center justify-between">
                <Label>{tab.label}</Label>
                <Switch
                  checked={tabVisibility[tab.id] ?? true}
                  onCheckedChange={(checked) =>
                    setTabVisibility((prev) => ({ ...prev, [tab.id]: checked }))
                  }
                />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Dashboard Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Painel de Dados</CardTitle>
            <CardDescription>Configure quais cards aparecem no painel</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Card visibility */}
            <div className="space-y-3">
              <Label className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Visibilidade dos Cards</Label>
              
              {/* Faturamento Médio */}
              <div className="flex items-center justify-between">
                <Label>Faturamento Médio / Dia</Label>
                <Switch checked={showFaturamentoMedio} onCheckedChange={setShowFaturamentoMedio} />
              </div>

              {/* Porcentagem (CMV) */}
              <div className="flex items-center justify-between">
                <Label>Porcentagem</Label>
                <Switch checked={showCmv} onCheckedChange={setShowCmv} />
              </div>

              {/* Ranking 1 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>{rankingTitle || "Top 10"} 1</Label>
                  <Switch checked={showTopFoods} onCheckedChange={setShowTopFoods} />
                </div>
                {showTopFoods && isSuperUser && (
                  <div className="ml-4">
                    <Input
                      value={rankingTitle}
                      onChange={(e) => setRankingTitle(e.target.value)}
                      placeholder="Top 10"
                      className="h-8 text-sm"
                    />
                  </div>
                )}
              </div>

              {/* Ranking 2 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>{rankingTitle2 || "Top 10"} 2</Label>
                  <Switch checked={showTopDrinks} onCheckedChange={setShowTopDrinks} />
                </div>
                {showTopDrinks && isSuperUser && (
                  <div className="ml-4">
                    <Input
                      value={rankingTitle2}
                      onChange={(e) => setRankingTitle2(e.target.value)}
                      placeholder="Top 10"
                      className="h-8 text-sm"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* CMV categories */}
            {showCmv && (
              <div className="space-y-2">
                <Label className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Categorias da Porcentagem</Label>
                <p className="text-xs text-muted-foreground">Selecione quais categorias compõem o cálculo</p>
                <div className="flex flex-wrap gap-2">
                  {categories.map((cat) => (
                    <button
                      key={cat.code}
                      onClick={() => toggleCmvCategory(cat.code)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                        cmvCategories.includes(cat.code)
                          ? "bg-primary/15 border-primary/40 text-primary"
                          : "bg-secondary/40 border-transparent text-muted-foreground"
                      }`}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          Salvar Configurações
        </Button>
      </main>
    </div>
  );
};

export default OrgSettings;
