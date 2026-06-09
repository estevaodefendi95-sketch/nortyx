import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Building2,
  CheckCircle2,
  Clock,
  Ban,
  TrendingUp,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import MasterLayout from "@/components/master/MasterLayout";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { statusBadge } from "./Companies";

const StatCard = ({
  label,
  value,
  icon: Icon,
  color,
  loading,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
  loading: boolean;
}) => (
  <Card className="bg-[#1a1a2e] border-white/5">
    <CardContent className="pt-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-white/50 mb-1">{label}</p>
          {loading ? (
            <Skeleton className="h-9 w-16 bg-white/10" />
          ) : (
            <p className="text-3xl font-bold text-white">{value}</p>
          )}
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </CardContent>
  </Card>
);

const MasterDashboard = () => {
  const { stats, organizations, loading, error, refetchOrgs } = useSuperAdmin();
  const navigate = useNavigate();

  const recent = organizations.slice(0, 10);

  useEffect(() => { document.title = "Master — Dashboard | Nortyx"; }, []);

  return (
    <MasterLayout>
      <div className="p-8 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Dashboard</h1>
            <p className="text-white/40 text-sm mt-0.5">Visão geral da plataforma</p>
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

        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard label="Total de empresas" value={stats.total}        icon={Building2}    color="bg-blue-500/15 text-blue-400"   loading={loading} />
          <StatCard label="Ativas"            value={stats.ativo}        icon={CheckCircle2} color="bg-green-500/15 text-green-400" loading={loading} />
          <StatCard label="Em trial"          value={stats.trial}        icon={Clock}        color="bg-amber-500/15 text-amber-400" loading={loading} />
          <StatCard label="Suspensas"         value={stats.suspenso}     icon={Ban}          color="bg-red-500/15 text-red-400"     loading={loading} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Bar Chart */}
          <Card className="lg:col-span-2 bg-[#1a1a2e] border-white/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                Novas empresas — últimos 6 meses
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-48 w-full bg-white/10" />
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={stats.monthlyGrowth} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis
                      dataKey="month"
                      tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#1a1a2e",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 8,
                        color: "#fff",
                        fontSize: 12,
                      }}
                      cursor={{ fill: "rgba(255,255,255,0.04)" }}
                    />
                    <Bar dataKey="count" name="Empresas" fill="var(--brand-primary, #3B82F6)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Recent companies */}
          <Card className="bg-[#1a1a2e] border-white/5">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-white text-base">Recentes</CardTitle>
                <button
                  onClick={() => navigate("/master/empresas")}
                  className="text-xs text-primary/70 hover:text-primary flex items-center gap-1 transition-colors"
                >
                  Ver todas <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="px-4 pb-4 space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full bg-white/10" />
                  ))}
                </div>
              ) : recent.length === 0 ? (
                <p className="text-white/30 text-sm text-center py-8">Nenhuma empresa ainda</p>
              ) : (
                <div className="divide-y divide-white/5">
                  {recent.map((org) => (
                    <button
                      key={org.id}
                      onClick={() => navigate(`/master/empresas/${org.id}`)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/3 transition-colors text-left group"
                    >
                      <div className="min-w-0">
                        <p className="text-sm text-white/90 truncate font-medium">{org.name}</p>
                        <p className="text-[11px] text-white/30">
                          {new Date(org.created_at).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                        <Badge className={statusBadge(org.subscription_status).className}>
                          {statusBadge(org.subscription_status).label}
                        </Badge>
                        <ChevronRight className="w-3.5 h-3.5 text-white/20 group-hover:text-white/50 transition-colors" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </MasterLayout>
  );
};

export default MasterDashboard;
