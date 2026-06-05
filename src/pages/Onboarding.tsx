import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/context/OrganizationContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Building2,
  ArrowRight,
  ArrowLeft,
  Check,
  Store,
  Utensils,
  Briefcase,
  Heart,
  Wrench,
  ShoppingBag,
  GraduationCap,
  MoreHorizontal,
  Users,
  User,
  UsersRound,
  Building,
  BarChart3,
  CreditCard,
  ClipboardList,
  Sparkles,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

// ─── Types ────────────────────────────────────────────────────────────────────

type BusinessType = {
  id: string;
  label: string;
  icon: React.ReactNode;
};

type TeamSize = {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
};

type Feature = {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
};

// ─── Data ─────────────────────────────────────────────────────────────────────

const BUSINESS_TYPES: BusinessType[] = [
  { id: "restaurante", label: "Restaurante / Bar", icon: <Utensils className="w-5 h-5" /> },
  { id: "loja", label: "Loja / Varejo", icon: <ShoppingBag className="w-5 h-5" /> },
  { id: "servicos", label: "Serviços", icon: <Wrench className="w-5 h-5" /> },
  { id: "saude", label: "Saúde / Beleza", icon: <Heart className="w-5 h-5" /> },
  { id: "educacao", label: "Educação", icon: <GraduationCap className="w-5 h-5" /> },
  { id: "empresa", label: "Empresa / Escritório", icon: <Briefcase className="w-5 h-5" /> },
  { id: "comercio", label: "Comércio Geral", icon: <Store className="w-5 h-5" /> },
  { id: "outro", label: "Outro", icon: <MoreHorizontal className="w-5 h-5" /> },
];

const TEAM_SIZES: TeamSize[] = [
  { id: "solo", label: "Só eu", description: "Empreendedor individual", icon: <User className="w-5 h-5" /> },
  { id: "pequeno", label: "2 a 10 pessoas", description: "Pequena equipe", icon: <Users className="w-5 h-5" /> },
  { id: "medio", label: "11 a 50 pessoas", description: "Equipe em crescimento", icon: <UsersRound className="w-5 h-5" /> },
  { id: "grande", label: "Mais de 50", description: "Grande empresa", icon: <Building className="w-5 h-5" /> },
];

const FEATURES: Feature[] = [
  { id: "financeiro", label: "Controle Financeiro", description: "Receitas, despesas e fluxo de caixa", icon: <BarChart3 className="w-5 h-5" /> },
  { id: "cobranca", label: "Cobrança de Clientes", description: "Gestão de cobranças e inadimplência", icon: <CreditCard className="w-5 h-5" /> },
  { id: "lancamentos", label: "Lançamentos Rápidos", description: "Registre entradas e saídas facilmente", icon: <ClipboardList className="w-5 h-5" /> },
];

// ─── Step Components ──────────────────────────────────────────────────────────

const StepIndicator = ({ current, total }: { current: number; total: number }) => (
  <div className="flex items-center gap-2">
    {Array.from({ length: total }).map((_, i) => (
      <div
        key={i}
        className={`h-1.5 rounded-full transition-all duration-300 ${
          i < current
            ? "bg-primary w-6"
            : i === current
            ? "bg-primary w-10"
            : "bg-border w-6"
        }`}
      />
    ))}
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

const TOTAL_STEPS = 4;

const Onboarding = () => {
  const { user } = useAuth();
  const { refreshOrganization } = useOrganization();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  // Form state
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [teamSize, setTeamSize] = useState("");
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>(["financeiro"]);

  const generateSlug = (value: string) =>
    value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40);

  const handleNameChange = (value: string) => {
    setName(value);
    setSlug(generateSlug(value));
  };

  const toggleFeature = (id: string) => {
    setSelectedFeatures((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
    );
  };

  const canAdvance = () => {
    if (step === 0) return name.trim().length > 1 && slug.trim().length > 1;
    if (step === 1) return businessType !== "";
    if (step === 2) return teamSize !== "";
    return true;
  };

  const handleFinish = async () => {
    if (!user || !name.trim() || !slug.trim()) return;
    setLoading(true);
    try {
      const { error } = await supabase.rpc("create_organization_with_owner", {
        _name: name.trim(),
        _slug: slug.trim(),
        _user_id: user.id,
      });

      if (error) {
        if (error.message.includes("duplicate") || error.message.includes("unique")) {
          toast({
            title: "Identificador já em uso",
            description: "Tente um nome diferente para sua empresa.",
            variant: "destructive",
          });
          setStep(0);
          setLoading(false);
          return;
        }
        throw error;
      }

      await refreshOrganization();
      setStep(TOTAL_STEPS); // success screen
    } catch (err: any) {
      console.error("Error creating organization:", err);
      toast({
        title: "Erro ao criar empresa",
        description: err.message || "Tente novamente em instantes.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // ── Success screen ──────────────────────────────────────────────────────────
  if (step === TOTAL_STEPS) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center space-y-6 animate-fade-in">
          <div className="mx-auto w-20 h-20 rounded-full bg-primary/15 flex items-center justify-center">
            <Check className="w-10 h-10 text-primary" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-display font-bold">Tudo pronto! 🎉</h1>
            <p className="text-muted-foreground">
              <span className="font-semibold text-foreground">{name}</span> foi configurada com sucesso.
            </p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 text-left space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Configurações salvas</p>
            <div className="flex items-center gap-2 text-sm">
              <Check className="w-4 h-4 text-primary flex-shrink-0" />
              <span>Empresa: <strong>{name}</strong></span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Check className="w-4 h-4 text-primary flex-shrink-0" />
              <span>Tipo: <strong>{BUSINESS_TYPES.find(b => b.id === businessType)?.label}</strong></span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Check className="w-4 h-4 text-primary flex-shrink-0" />
              <span>Equipe: <strong>{TEAM_SIZES.find(t => t.id === teamSize)?.label}</strong></span>
            </div>
          </div>
          <Button
            className="w-full h-12 text-base gap-2 font-semibold"
            onClick={() => navigate("/", { replace: true })}
          >
            <Sparkles className="w-4 h-4" />
            Começar a usar o Nortyx
          </Button>
        </div>
      </div>
    );
  }

  // ── Steps ───────────────────────────────────────────────────────────────────
  const stepTitles = [
    "Qual o nome da sua empresa?",
    "Qual é o tipo do seu negócio?",
    "Quantas pessoas na sua equipe?",
    "O que você quer gerenciar?",
  ];
  const stepSubtitles = [
    "Você pode alterar isso depois nas configurações.",
    "Isso nos ajuda a personalizar o sistema para você.",
    "Vamos adaptar as funcionalidades ao seu perfil.",
    "Selecione tudo que for relevante para o seu negócio.",
  ];

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg">

        {/* Header */}
        <div className="mb-8 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
                <Building2 className="w-4 h-4 text-primary" />
              </div>
              <span className="text-sm font-semibold text-muted-foreground">Nortyx</span>
            </div>
            <span className="text-xs text-muted-foreground">
              Passo {step + 1} de {TOTAL_STEPS}
            </span>
          </div>
          <StepIndicator current={step} total={TOTAL_STEPS} />
        </div>

        {/* Card */}
        <div className="bg-card border border-border/60 rounded-2xl p-6 sm:p-8 shadow-soft-md space-y-6 animate-fade-in">
          <div className="space-y-1">
            <h1 className="text-2xl font-display font-bold text-foreground">
              {stepTitles[step]}
            </h1>
            <p className="text-sm text-muted-foreground">{stepSubtitles[step]}</p>
          </div>

          {/* ── Step 0: Nome + Slug ─────────────────────────────────────────── */}
          {step === 0 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="orgName">Nome da empresa</Label>
                <Input
                  id="orgName"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Ex: Restaurante Sabor & Arte"
                  autoFocus
                  maxLength={100}
                  className="h-11"
                />
              </div>
              {name && (
                <div className="space-y-2 animate-fade-in">
                  <Label htmlFor="orgSlug">
                    Identificador único
                    <span className="ml-2 text-xs text-muted-foreground font-normal">(editável)</span>
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground select-none">
                      nortyx.app/
                    </span>
                    <Input
                      id="orgSlug"
                      value={slug}
                      onChange={(e) => setSlug(generateSlug(e.target.value))}
                      placeholder="restaurante-sabor-arte"
                      maxLength={40}
                      pattern="[a-z0-9\-]+"
                      className="h-11 pl-[90px]"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Usado como identificador único da sua empresa.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── Step 1: Tipo de negócio ─────────────────────────────────────── */}
          {step === 1 && (
            <div className="grid grid-cols-2 gap-2.5">
              {BUSINESS_TYPES.map((type) => (
                <button
                  key={type.id}
                  onClick={() => setBusinessType(type.id)}
                  className={`flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all duration-200 ${
                    businessType === type.id
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-secondary/30 hover:bg-secondary/60 hover:border-border/80 text-foreground"
                  }`}
                >
                  <span className={businessType === type.id ? "text-primary" : "text-muted-foreground"}>
                    {type.icon}
                  </span>
                  <span className="text-sm font-medium leading-tight">{type.label}</span>
                  {businessType === type.id && (
                    <Check className="w-4 h-4 text-primary ml-auto flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>
          )}

          {/* ── Step 2: Tamanho da equipe ───────────────────────────────────── */}
          {step === 2 && (
            <div className="space-y-2.5">
              {TEAM_SIZES.map((size) => (
                <button
                  key={size.id}
                  onClick={() => setTeamSize(size.id)}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl border text-left transition-all duration-200 ${
                    teamSize === size.id
                      ? "border-primary bg-primary/10"
                      : "border-border bg-secondary/30 hover:bg-secondary/60 hover:border-border/80"
                  }`}
                >
                  <span className={`flex-shrink-0 ${teamSize === size.id ? "text-primary" : "text-muted-foreground"}`}>
                    {size.icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold ${teamSize === size.id ? "text-primary" : "text-foreground"}`}>
                      {size.label}
                    </p>
                    <p className="text-xs text-muted-foreground">{size.description}</p>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                    teamSize === size.id ? "border-primary bg-primary" : "border-border"
                  }`}>
                    {teamSize === size.id && <Check className="w-3 h-3 text-primary-foreground" />}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* ── Step 3: Funcionalidades ─────────────────────────────────────── */}
          {step === 3 && (
            <div className="space-y-2.5">
              {FEATURES.map((feature) => {
                const selected = selectedFeatures.includes(feature.id);
                return (
                  <button
                    key={feature.id}
                    onClick={() => toggleFeature(feature.id)}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl border text-left transition-all duration-200 ${
                      selected
                        ? "border-primary bg-primary/10"
                        : "border-border bg-secondary/30 hover:bg-secondary/60 hover:border-border/80"
                    }`}
                  >
                    <span className={`flex-shrink-0 ${selected ? "text-primary" : "text-muted-foreground"}`}>
                      {feature.icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold ${selected ? "text-primary" : "text-foreground"}`}>
                        {feature.label}
                      </p>
                      <p className="text-xs text-muted-foreground">{feature.description}</p>
                    </div>
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                      selected ? "border-primary bg-primary" : "border-border"
                    }`}>
                      {selected && <Check className="w-3 h-3 text-primary-foreground" />}
                    </div>
                  </button>
                );
              })}
              <p className="text-xs text-muted-foreground pt-1">
                Você pode ativar ou desativar funcionalidades depois nas configurações.
              </p>
            </div>
          )}

          {/* ── Navigation ──────────────────────────────────────────────────── */}
          <div className="flex items-center gap-3 pt-2">
            {step > 0 && (
              <Button
                variant="outline"
                onClick={() => setStep((s) => s - 1)}
                disabled={loading}
                className="flex-1 h-11 gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Voltar
              </Button>
            )}

            {step < TOTAL_STEPS - 1 ? (
              <Button
                onClick={() => setStep((s) => s + 1)}
                disabled={!canAdvance()}
                className="flex-1 h-11 gap-2 font-semibold"
              >
                Continuar
                <ArrowRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                onClick={handleFinish}
                disabled={loading || selectedFeatures.length === 0}
                className="flex-1 h-11 gap-2 font-semibold"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Criando empresa…
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Criar minha empresa
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground mt-6">
          Seus dados são privados e ficam isolados da sua conta.
        </p>
      </div>
    </div>
  );
};

export default Onboarding;
