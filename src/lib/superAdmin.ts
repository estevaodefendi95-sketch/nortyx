import { supabase } from "@/integrations/supabase/client";
import { PLATFORM_CONFIG } from "@/config/constants";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface OrgWithStats {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string;
  plan: string;
  plan_id: string | null;
  subscription_status: string;
  trial_ends_at: string | null;
  custom_app_name: string | null;
  custom_favicon_url: string | null;
  created_at: string;
  updated_at: string;
  member_count: number;
}

export interface PlanRow {
  id: string;
  name: string;
  max_users: number;
  max_transactions: number;
  features: string[];
  price: number;
  is_active: boolean;
  created_at: string;
}

export interface SuperAdminLog {
  id: string;
  admin_id: string | null;
  admin_email: string | null;
  action: string;
  target_org_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface ImpersonationState {
  active: true;
  orgId: string;
  orgName: string;
  originalOrgId: string;
}

const IMPERSONATION_KEY = "nortyx_impersonation";

// ── Super admin check ─────────────────────────────────────────────────────────

export function isEmailSuperAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return email === PLATFORM_CONFIG.SUPER_USER_EMAIL;
}

// ── Organizations ─────────────────────────────────────────────────────────────

export async function getAllOrganizations(): Promise<OrgWithStats[]> {
  const { data: orgs, error } = await supabase
    .from("organizations")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  if (!orgs) return [];

  // Fetch member counts in a single query
  const orgIds = orgs.map((o) => o.id);
  const { data: counts } = await supabase
    .from("organization_members")
    .select("organization_id")
    .in("organization_id", orgIds);

  const countMap = new Map<string, number>();
  (counts ?? []).forEach((row) => {
    countMap.set(row.organization_id, (countMap.get(row.organization_id) ?? 0) + 1);
  });

  return orgs.map((o) => ({
    id: o.id,
    name: o.name,
    slug: o.slug,
    logo_url: o.logo_url,
    primary_color: o.primary_color,
    plan: o.plan,
    plan_id: (o as any).plan_id ?? null,
    subscription_status: o.subscription_status,
    trial_ends_at: (o as any).trial_ends_at ?? null,
    custom_app_name: (o as any).custom_app_name ?? null,
    custom_favicon_url: (o as any).custom_favicon_url ?? null,
    created_at: o.created_at,
    updated_at: o.updated_at,
    member_count: countMap.get(o.id) ?? 0,
  }));
}

export async function getOrganizationById(id: string): Promise<OrgWithStats | null> {
  const { data, error } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const { data: members } = await supabase
    .from("organization_members")
    .select("id")
    .eq("organization_id", id);

  return {
    ...data,
    plan_id: (data as any).plan_id ?? null,
    trial_ends_at: (data as any).trial_ends_at ?? null,
    custom_app_name: (data as any).custom_app_name ?? null,
    custom_favicon_url: (data as any).custom_favicon_url ?? null,
    member_count: members?.length ?? 0,
  };
}

export async function updateOrganization(
  id: string,
  updates: Partial<{
    name: string;
    subscription_status: string;
    plan_id: string | null;
    plan: string;
    trial_ends_at: string | null;
    custom_app_name: string | null;
    logo_url: string | null;
    primary_color: string;
    custom_favicon_url: string | null;
  }>
): Promise<void> {
  const { error } = await supabase
    .from("organizations")
    .update(updates as any)
    .eq("id", id);
  if (error) throw error;
}

export async function suspendOrganization(id: string): Promise<void> {
  await updateOrganization(id, { subscription_status: "suspenso" });
}

export async function activateOrganization(id: string): Promise<void> {
  await updateOrganization(id, { subscription_status: "ativo" });
}

// ── Plans ─────────────────────────────────────────────────────────────────────

export async function getAllPlans(): Promise<PlanRow[]> {
  const { data, error } = await supabase
    .from("plans" as any)
    .select("*")
    .order("price", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as PlanRow[];
}

export async function upsertPlan(plan: Partial<PlanRow> & { name: string }): Promise<PlanRow> {
  const { data, error } = await supabase
    .from("plans" as any)
    .upsert(plan)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as PlanRow;
}

export async function togglePlanActive(id: string, is_active: boolean): Promise<void> {
  const { error } = await supabase
    .from("plans" as any)
    .update({ is_active })
    .eq("id", id);
  if (error) throw error;
}

export async function deletePlan(id: string): Promise<void> {
  const { error } = await supabase
    .from("plans" as any)
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ── Audit logging ─────────────────────────────────────────────────────────────

export async function logAdminAction(
  adminId: string,
  adminEmail: string,
  action: string,
  targetOrgId: string | null,
  details?: Record<string, unknown>
): Promise<void> {
  try {
    await supabase.from("super_admin_logs" as any).insert({
      admin_id: adminId,
      admin_email: adminEmail,
      action,
      target_org_id: targetOrgId,
      details: details ?? null,
    });
  } catch {
    // Non-blocking: log errors should not block admin actions
  }
}

export async function getAdminLogs(limit = 50): Promise<SuperAdminLog[]> {
  const { data, error } = await supabase
    .from("super_admin_logs" as any)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as SuperAdminLog[];
}

// ── Impersonation ─────────────────────────────────────────────────────────────

export function startImpersonation(orgId: string, orgName: string, currentOrgId: string): void {
  const state: ImpersonationState = {
    active: true,
    orgId,
    orgName,
    originalOrgId: currentOrgId,
  };
  sessionStorage.setItem(IMPERSONATION_KEY, JSON.stringify(state));
}

export function stopImpersonation(): string | null {
  const raw = sessionStorage.getItem(IMPERSONATION_KEY);
  sessionStorage.removeItem(IMPERSONATION_KEY);
  if (!raw) return null;
  try {
    const state = JSON.parse(raw) as ImpersonationState;
    return state.originalOrgId;
  } catch {
    return null;
  }
}

export function getImpersonationState(): ImpersonationState | null {
  const raw = sessionStorage.getItem(IMPERSONATION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ImpersonationState;
  } catch {
    return null;
  }
}

// ── Org stats helpers ─────────────────────────────────────────────────────────

export interface DashboardStats {
  total: number;
  ativo: number;
  trial: number;
  suspenso: number;
  newThisMonth: number;
  monthlyGrowth: { month: string; count: number }[];
}

export function computeStats(orgs: OrgWithStats[]): DashboardStats {
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const total = orgs.length;
  const ativo = orgs.filter((o) => o.subscription_status === "ativo").length;
  const trial = orgs.filter((o) => o.subscription_status === "trial").length;
  const suspenso = orgs.filter((o) => o.subscription_status === "suspenso").length;
  const newThisMonth = orgs.filter((o) => o.created_at >= thisMonthStart).length;

  // Build last-6-months growth chart
  const monthlyGrowth: { month: string; count: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const start = d.toISOString();
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString();
    const label = d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
    const count = orgs.filter((o) => o.created_at >= start && o.created_at < end).length;
    monthlyGrowth.push({ month: label, count });
  }

  return { total, ativo, trial, suspenso, newThisMonth, monthlyGrowth };
}
