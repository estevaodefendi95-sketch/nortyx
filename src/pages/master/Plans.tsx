import { useState, useEffect } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  CreditCard,
  Check,
  X,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import MasterLayout from "@/components/master/MasterLayout";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { upsertPlan, togglePlanActive, deletePlan, type PlanRow } from "@/lib/superAdmin";
import { useToast } from "@/hooks/use-toast";

const EMPTY_PLAN: Omit<PlanRow, "id" | "created_at"> = {
  name: "",
  max_users: 5,
  max_transactions: 1000,
  features: [],
  price: 0,
  is_active: true,
};

const PlansPage = () => {
  const { plans, loading, refetchPlans } = useSuperAdmin();
  const { toast } = useToast();

  useEffect(() => { document.title = "Master — Planos | Nortyx"; }, []);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PlanRow | null>(null);
  const [editTarget, setEditTarget] = useState<PlanRow | null>(null);
  const [form, setForm] = useState<Omit<PlanRow, "id" | "created_at">>(EMPTY_PLAN);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const openCreate = () => {
    setEditTarget(null);
    setForm(EMPTY_PLAN);
    setDialogOpen(true);
  };

  const openEdit = (plan: PlanRow) => {
    setEditTarget(plan);
    setForm({
      name: plan.name,
      max_users: plan.max_users,
      max_transactions: plan.max_transactions,
      features: plan.features,
      price: plan.price,
      is_active: plan.is_active,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await upsertPlan(editTarget ? { ...form, id: editTarget.id } : form);
      toast({ title: editTarget ? "Plano atualizado" : "Plano criado" });
      setDialogOpen(false);
      await refetchPlans();
    } catch (err: any) {
      toast({ title: "Erro ao salvar plano", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (plan: PlanRow) => {
    setTogglingId(plan.id);
    try {
      await togglePlanActive(plan.id, !plan.is_active);
      await refetchPlans();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeletingId(deleteTarget.id);
    try {
      await deletePlan(deleteTarget.id);
      toast({ title: `Plano "${deleteTarget.name}" excluído` });
      setDeleteTarget(null);
      await refetchPlans();
    } catch (err: any) {
      toast({ title: "Erro ao excluir", description: err.message, variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  const setField = <K extends keyof typeof form>(key: K, val: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: val }));

  return (
    <MasterLayout>
      <div className="p-8 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Planos</h1>
            <p className="text-white/40 text-sm mt-0.5">Gerencie os planos disponíveis na plataforma</p>
          </div>
          <Button onClick={openCreate} size="sm" className="bg-primary hover:bg-primary/90">
            <Plus className="w-4 h-4 mr-1.5" />
            Novo plano
          </Button>
        </div>

        {/* Plan grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-48 bg-white/5 rounded-xl" />
            ))}
          </div>
        ) : plans.length === 0 ? (
          <Card className="bg-[#1a1a2e] border-white/5">
            <CardContent className="flex flex-col items-center justify-center py-16 text-white/30">
              <CreditCard className="w-10 h-10 mb-3" />
              <p>Nenhum plano cadastrado</p>
              <Button onClick={openCreate} variant="ghost" size="sm" className="mt-3 text-primary hover:bg-primary/10">
                Criar primeiro plano
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {plans.map((plan) => (
              <Card
                key={plan.id}
                className={`bg-[#1a1a2e] border transition-colors ${
                  plan.is_active ? "border-white/10" : "border-white/3 opacity-60"
                }`}
              >
                <CardContent className="pt-5">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-white font-semibold">{plan.name}</h3>
                        <Badge className={plan.is_active
                          ? "bg-green-500/15 text-green-400 border-green-500/20"
                          : "bg-white/5 text-white/30 border-white/10"
                        }>
                          {plan.is_active ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>
                      <p className="text-2xl font-bold text-white mt-1">
                        {plan.price === 0 ? (
                          <span className="text-primary">Grátis</span>
                        ) : (
                          <>
                            <span className="text-sm font-normal text-white/40">R$ </span>
                            {plan.price.toFixed(2)}
                            <span className="text-sm font-normal text-white/40">/mês</span>
                          </>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEdit(plan)}
                        className="p-1.5 rounded-md text-white/30 hover:text-white hover:bg-white/5 transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(plan)}
                        className="p-1.5 rounded-md text-white/30 hover:text-red-400 hover:bg-red-400/5 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5 mb-4">
                    <p className="text-xs text-white/40">
                      Até <span className="text-white/70">{plan.max_users}</span> usuários ·{" "}
                      <span className="text-white/70">{plan.max_transactions.toLocaleString("pt-BR")}</span> lançamentos
                    </p>
                    {plan.features.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {plan.features.map((f) => (
                          <span key={f} className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/40">
                            {f}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-white/5">
                    <span className="text-xs text-white/30">
                      {plan.is_active ? "Visível para clientes" : "Oculto"}
                    </span>
                    <Switch
                      checked={plan.is_active}
                      disabled={togglingId === plan.id}
                      onCheckedChange={() => handleToggle(plan)}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Create / Edit dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="bg-[#1a1a2e] border-white/10 text-white max-w-md">
            <DialogHeader>
              <DialogTitle className="text-white">
                {editTarget ? "Editar plano" : "Novo plano"}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label className="text-white/60 text-xs">Nome do plano *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setField("name", e.target.value)}
                  placeholder="Ex.: Profissional"
                  className="bg-[#0f0f1a] border-white/10 text-white focus:border-primary/50 placeholder:text-white/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-white/60 text-xs">Preço (R$/mês)</Label>
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    value={form.price}
                    onChange={(e) => setField("price", parseFloat(e.target.value) || 0)}
                    className="bg-[#0f0f1a] border-white/10 text-white focus:border-primary/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-white/60 text-xs">Máx. usuários</Label>
                  <Input
                    type="number"
                    min={1}
                    value={form.max_users}
                    onChange={(e) => setField("max_users", parseInt(e.target.value) || 1)}
                    className="bg-[#0f0f1a] border-white/10 text-white focus:border-primary/50"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-white/60 text-xs">Máx. lançamentos</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.max_transactions}
                  onChange={(e) => setField("max_transactions", parseInt(e.target.value) || 1)}
                  className="bg-[#0f0f1a] border-white/10 text-white focus:border-primary/50"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-white/60 text-xs">
                  Features <span className="text-white/30">(separadas por vírgula)</span>
                </Label>
                <Input
                  value={form.features.join(", ")}
                  onChange={(e) =>
                    setField(
                      "features",
                      e.target.value
                        .split(",")
                        .map((f) => f.trim())
                        .filter(Boolean)
                    )
                  }
                  placeholder="financeiro, cobranca, payroll"
                  className="bg-[#0f0f1a] border-white/10 text-white focus:border-primary/50 placeholder:text-white/20"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-white/3">
                <Label className="text-white/60 text-sm cursor-pointer">Plano ativo</Label>
                <Switch
                  checked={form.is_active}
                  onCheckedChange={(v) => setField("is_active", v)}
                />
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="ghost"
                onClick={() => setDialogOpen(false)}
                className="text-white/50 hover:text-white hover:bg-white/5"
              >
                <X className="w-4 h-4 mr-1.5" />
                Cancelar
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving || !form.name.trim()}
                className="bg-primary hover:bg-primary/90"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                ) : (
                  <Check className="w-4 h-4 mr-1.5" />
                )}
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete confirm */}
        <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
          <AlertDialogContent className="bg-[#1a1a2e] border-white/10 text-white">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-white">Excluir plano</AlertDialogTitle>
              <AlertDialogDescription className="text-white/50">
                Tem certeza que deseja excluir o plano{" "}
                <strong className="text-white">"{deleteTarget?.name}"</strong>? Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="bg-transparent border-white/10 text-white/60 hover:bg-white/5">
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={!!deletingId}
                className="bg-red-500 hover:bg-red-600 text-white"
              >
                {deletingId ? <Loader2 className="w-4 h-4 animate-spin" /> : "Excluir"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </MasterLayout>
  );
};

export default PlansPage;
