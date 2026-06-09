import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  getAllOrganizations,
  getAllPlans,
  computeStats,
  isEmailSuperAdmin,
  type OrgWithStats,
  type PlanRow,
  type DashboardStats,
} from "@/lib/superAdmin";

interface UseSuperAdminReturn {
  isSuperAdmin: boolean;
  organizations: OrgWithStats[];
  plans: PlanRow[];
  stats: DashboardStats;
  loading: boolean;
  error: string | null;
  refetchOrgs: () => Promise<void>;
  refetchPlans: () => Promise<void>;
}

const EMPTY_STATS: DashboardStats = {
  total: 0,
  ativo: 0,
  trial: 0,
  suspenso: 0,
  newThisMonth: 0,
  monthlyGrowth: [],
};

export function useSuperAdmin(): UseSuperAdminReturn {
  const { user, loading: authLoading } = useAuth();

  const isSuperAdmin = isEmailSuperAdmin(user?.email);

  const [organizations, setOrganizations] = useState<OrgWithStats[]>([]);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [stats, setStats] = useState<DashboardStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetchOrgs = useCallback(async () => {
    if (!isSuperAdmin) return;
    try {
      setError(null);
      const orgs = await getAllOrganizations();
      setOrganizations(orgs);
      setStats(computeStats(orgs));
    } catch (err: any) {
      setError(err.message ?? "Erro ao carregar empresas");
    }
  }, [isSuperAdmin]);

  const refetchPlans = useCallback(async () => {
    if (!isSuperAdmin) return;
    try {
      const p = await getAllPlans();
      setPlans(p);
    } catch (err: any) {
      setError(err.message ?? "Erro ao carregar planos");
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    if (authLoading || !isSuperAdmin) return;

    setLoading(true);
    Promise.all([refetchOrgs(), refetchPlans()]).finally(() => setLoading(false));
  }, [authLoading, isSuperAdmin, refetchOrgs, refetchPlans]);

  return {
    isSuperAdmin,
    organizations,
    plans,
    stats,
    loading,
    error,
    refetchOrgs,
    refetchPlans,
  };
}
