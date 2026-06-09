import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  ChevronRight,
  Building2,
  CheckCircle2,
  Clock,
  Ban,
  MoreHorizontal,
  RefreshCw,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import MasterLayout from "@/components/master/MasterLayout";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { suspendOrganization, activateOrganization } from "@/lib/superAdmin";
import { useToast } from "@/hooks/use-toast";
import { logAdminAction } from "@/lib/superAdmin";
import { useAuth } from "@/hooks/useAuth";

// ── Status badge helper (also used by Dashboard) ─────────────────────────────
export function statusBadge(status: string): { label: string; className: string } {
  switch (status) {
    case "ativo":
      return { label: "Ativo", className: "bg-green-500/15 text-green-400 border-green-500/20" };
    case "trial":
      return { label: "Trial", className: "bg-amber-500/15 text-amber-400 border-amber-500/20" };
    case "suspenso":
      return { label: "Suspenso", className: "bg-red-500/15 text-red-400 border-red-500/20" };
    default:
      return { label: status, className: "bg-white/10 text-white/50 border-white/10" };
  }
}

const Companies = () => {
  const { organizations, plans, loading, error, refetchOrgs } = useSuperAdmin();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [search, setSearch] = useState("");

  useEffect(() => { document.title = "Master — Empresas | Nortyx"; }, []);
  const [statusFilter, setStatusFilter] = useState("all");
  const [planFilter, setPlanFilter] = useState("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return organizations.filter((o) => {
      const matchSearch = !search || o.name.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || o.subscription_status === statusFilter;
      const matchPlan = planFilter === "all" || o.plan === planFilter || o.plan_id === planFilter;
      return matchSearch && matchStatus && matchPlan;
    });
  }, [organizations, search, statusFilter, planFilter]);

  const handleSuspend = async (id: string, name: string) => {
    setActionLoading(id);
    try {
      await suspendOrganization(id);
      await logAdminAction(user!.id, user!.email!, "suspend_org", id, { name });
      toast({ title: `"${name}" suspensa com sucesso` });
      await refetchOrgs();
    } catch (err: any) {
      toast({ title: "Erro ao suspender", description: err.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleActivate = async (id: string, name: string) => {
    setActionLoading(id);
    try {
      await activateOrganization(id);
      await logAdminAction(user!.id, user!.email!, "activate_org", id, { name });
      toast({ title: `"${name}" reativada com sucesso` });
      await refetchOrgs();
    } catch (err: any) {
      toast({ title: "Erro ao reativar", description: err.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const planOptions = useMemo(() => {
    const seen = new Set<string>();
    return organizations.reduce<{ value: string; label: string }[]>((acc, o) => {
      if (o.plan && !seen.has(o.plan)) {
        seen.add(o.plan);
        acc.push({ value: o.plan, label: o.plan });
      }
      return acc;
    }, []);
  }, [organizations]);

  return (
    <MasterLayout>
      <div className="p-8 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Empresas</h1>
            <p className="text-white/40 text-sm mt-0.5">
              {filtered.length} de {organizations.length} empresa{organizations.length !== 1 ? "s" : ""}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={refetchOrgs}
            disabled={loading}
            className="text-white/50 hover:text-white hover:bg-white/5"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>

        {error && (
          <div className="mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <Input
              placeholder="Buscar por nome..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-[#1a1a2e] border-white/10 text-white placeholder:text-white/30 focus:border-primary/50"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40 bg-[#1a1a2e] border-white/10 text-white/70">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="bg-[#1a1a2e] border-white/10 text-white">
              <SelectItem value="all">Todos status</SelectItem>
              <SelectItem value="ativo">Ativo</SelectItem>
              <SelectItem value="trial">Trial</SelectItem>
              <SelectItem value="suspenso">Suspenso</SelectItem>
            </SelectContent>
          </Select>
          <Select value={planFilter} onValueChange={setPlanFilter}>
            <SelectTrigger className="w-44 bg-[#1a1a2e] border-white/10 text-white/70">
              <SelectValue placeholder="Plano" />
            </SelectTrigger>
            <SelectContent className="bg-[#1a1a2e] border-white/10 text-white">
              <SelectItem value="all">Todos planos</SelectItem>
              {planOptions.map((p) => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="rounded-xl border border-white/5 bg-[#1a1a2e] overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_120px_100px_80px_120px_48px] gap-4 px-4 py-3 border-b border-white/5 text-xs font-medium text-white/30 uppercase tracking-wider">
            <span>Empresa</span>
            <span>Plano</span>
            <span>Status</span>
            <span>Usuários</span>
            <span>Criada em</span>
            <span />
          </div>

          {loading ? (
            <div className="divide-y divide-white/5">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="grid grid-cols-[1fr_120px_100px_80px_120px_48px] gap-4 px-4 py-4">
                  {[...Array(6)].map((_, j) => (
                    <Skeleton key={j} className="h-5 bg-white/10" />
                  ))}
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-white/30">
              <Building2 className="w-8 h-8 mb-3" />
              <p className="text-sm">Nenhuma empresa encontrada</p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {filtered.map((org) => {
                const badge = statusBadge(org.subscription_status);
                const busy = actionLoading === org.id;
                return (
                  <div
                    key={org.id}
                    className="grid grid-cols-[1fr_120px_100px_80px_120px_48px] gap-4 px-4 py-3.5 items-center hover:bg-white/2 transition-colors group"
                  >
                    {/* Name */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 text-white text-xs font-bold"
                        style={{ background: org.primary_color + "33" }}
                      >
                        {org.logo_url ? (
                          <img src={org.logo_url} alt="" className="w-full h-full object-cover rounded-md" />
                        ) : (
                          org.name.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0">
                        <button
                          onClick={() => navigate(`/master/empresas/${org.id}`)}
                          className="text-sm text-white/90 font-medium hover:text-primary truncate max-w-[200px] text-left transition-colors"
                        >
                          {org.custom_app_name || org.name}
                        </button>
                        <p className="text-[11px] text-white/30">{org.slug}</p>
                      </div>
                    </div>

                    {/* Plan */}
                    <span className="text-sm text-white/50 truncate">
                      {org.plan || "—"}
                    </span>

                    {/* Status */}
                    <Badge className={badge.className}>{badge.label}</Badge>

                    {/* Members */}
                    <span className="text-sm text-white/50">{org.member_count}</span>

                    {/* Created */}
                    <span className="text-sm text-white/40">
                      {new Date(org.created_at).toLocaleDateString("pt-BR")}
                    </span>

                    {/* Actions */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          disabled={busy}
                          className="w-8 h-8 flex items-center justify-center rounded-md text-white/30 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50"
                        >
                          {busy ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <MoreHorizontal className="w-4 h-4" />
                          )}
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-[#1a1a2e] border-white/10 text-white w-44">
                        <DropdownMenuItem
                          onClick={() => navigate(`/master/empresas/${org.id}`)}
                          className="hover:bg-white/5 cursor-pointer"
                        >
                          <ChevronRight className="w-4 h-4 mr-2 text-white/40" />
                          Ver detalhes
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-white/5" />
                        {org.subscription_status !== "ativo" ? (
                          <DropdownMenuItem
                            onClick={() => handleActivate(org.id, org.name)}
                            className="hover:bg-white/5 cursor-pointer text-green-400"
                          >
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                            Reativar
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            onClick={() => handleSuspend(org.id, org.name)}
                            className="hover:bg-white/5 cursor-pointer text-red-400"
                          >
                            <Ban className="w-4 h-4 mr-2" />
                            Suspender
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </MasterLayout>
  );
};

export default Companies;
