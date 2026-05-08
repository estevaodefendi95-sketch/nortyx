import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const SUPER_USER_EMAIL = "estevaodefendi95@gmail.com";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string;
  plan: string;
  subscription_status: string;
}

export interface OrgMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: "owner" | "admin" | "member" | "viewer";
  created_at: string;
}

interface OrganizationContextType {
  organization: Organization | null;
  membership: OrgMember | null;
  loading: boolean;
  hasOrg: boolean;
  availableOrganizations: Organization[];
  isSuperUser: boolean;
  switchOrganization: (orgId: string) => Promise<void>;
  refreshOrganization: () => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType | null>(null);

export const useOrganization = () => {
  const ctx = useContext(OrganizationContext);
  if (!ctx) throw new Error("useOrganization must be used within OrganizationProvider");
  return ctx;
};

export const OrganizationProvider = ({ children }: { children: ReactNode }) => {
  const { user, loading: authLoading } = useAuth();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [membership, setMembership] = useState<OrgMember | null>(null);
  const [availableOrganizations, setAvailableOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);

  const isSuperUser = user?.email === SUPER_USER_EMAIL;

  const loadOrganization = useCallback(async () => {
    if (!user) {
      setOrganization(null);
      setMembership(null);
      setAvailableOrganizations([]);
      setLoading(false);
      return;
    }

    try {
      // Get the user's membership(s)
      const { data: memberships, error: memError } = await supabase
        .from("organization_members")
        .select("*")
        .eq("user_id", user.id);

      if (memError) {
        console.warn("[OrgContext] memberships query error:", memError);
        throw memError;
      }
      console.log("[OrgContext] memberships loaded:", memberships?.length ?? 0, memberships);

      // For super user, load all organizations
      let allOrgs: Organization[] = [];
      if (user.email === SUPER_USER_EMAIL) {
        const { data: orgs, error: orgsError } = await supabase
          .from("organizations")
          .select("*")
          .order("name");
        if (!orgsError && orgs) {
          allOrgs = orgs.map((o) => ({
            id: o.id,
            name: o.name,
            slug: o.slug,
            logo_url: o.logo_url,
            primary_color: o.primary_color,
            plan: o.plan,
            subscription_status: o.subscription_status,
          }));
        }
        setAvailableOrganizations(allOrgs);
      }
      // For non-super users, do NOT clear availableOrganizations here — it will be set
      // below from the actual orgs query (or kept as fallback) to avoid hiding the switcher.

      if ((!memberships || memberships.length === 0) && allOrgs.length === 0) {
        setOrganization(null);
        setMembership(null);
        setLoading(false);
        return;
      }

      // Check localStorage for preferred org
      const preferredOrgId = localStorage.getItem("paggio_active_org");

      // For super user, allow selecting any org
      if (user.email === SUPER_USER_EMAIL && allOrgs.length > 0) {
        const selectedOrg = allOrgs.find((o) => o.id === preferredOrgId) || allOrgs[0];
        setOrganization(selectedOrg);

        // Check if user has real membership
        const realMembership = memberships?.find((m) => m.organization_id === selectedOrg.id);
        if (realMembership) {
          setMembership({
            id: realMembership.id,
            organization_id: realMembership.organization_id,
            user_id: realMembership.user_id,
            role: realMembership.role as OrgMember["role"],
            created_at: realMembership.created_at,
          });
        } else {
          // Virtual membership for super user
          setMembership({
            id: "virtual-super-user",
            organization_id: selectedOrg.id,
            user_id: user.id,
            role: "owner",
            created_at: new Date().toISOString(),
          });
        }
        localStorage.setItem("paggio_active_org", selectedOrg.id);
      } else if (memberships && memberships.length > 0) {
        // Load all organizations the user belongs to
        const orgIds = memberships.map((m) => m.organization_id);
        const { data: orgsData, error: orgsErr } = await supabase
          .from("organizations")
          .select("*")
          .in("id", orgIds);

        if (orgsErr) {
          console.warn("[OrgContext] organizations query error:", orgsErr);
        }

        let userOrgs: Organization[] = (orgsData || []).map((o: any) => ({
          id: o.id,
          name: o.name,
          slug: o.slug,
          logo_url: o.logo_url,
          primary_color: o.primary_color,
          plan: o.plan,
          subscription_status: o.subscription_status,
        }));

        // Fallback: if RLS hid some orgs, synthesize minimal entries from memberships
        // so the switcher never disappears when the user clearly has 2+ memberships.
        if (userOrgs.length < memberships.length) {
          console.warn(
            `[OrgContext] organizations returned ${userOrgs.length} but user has ${memberships.length} memberships — using fallback entries.`
          );
          const knownIds = new Set(userOrgs.map((o) => o.id));
          for (const m of memberships) {
            if (!knownIds.has(m.organization_id)) {
              userOrgs.push({
                id: m.organization_id,
                name: "Empresa",
                slug: "",
                logo_url: null,
                primary_color: "#3B82F6",
                plan: "free",
                subscription_status: "active",
              });
            }
          }
        }

        userOrgs.sort((a, b) => a.name.localeCompare(b.name));
        setAvailableOrganizations(userOrgs);
        console.log("[OrgContext] availableOrganizations:", userOrgs.length, userOrgs.map((o) => o.name));

        const activeMembership =
          memberships.find((m) => m.organization_id === preferredOrgId) || memberships[0];
        const activeOrg =
          userOrgs.find((o) => o.id === activeMembership.organization_id) || null;

        if (!activeOrg) {
          setOrganization(null);
          setMembership(null);
        } else {
          setOrganization(activeOrg);
          setMembership({
            id: activeMembership.id,
            organization_id: activeMembership.organization_id,
            user_id: activeMembership.user_id,
            role: activeMembership.role as OrgMember["role"],
            created_at: activeMembership.created_at,
          });
          localStorage.setItem("paggio_active_org", activeMembership.organization_id);
        }
      } else {
        setAvailableOrganizations([]);
        setOrganization(null);
        setMembership(null);
      }
    } catch (err) {
      console.error("Error loading organization:", err);
      setOrganization(null);
      setMembership(null);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    loadOrganization();
  }, [user, authLoading, loadOrganization]);

  const switchOrganization = useCallback(async (orgId: string) => {
    localStorage.setItem("paggio_active_org", orgId);
    await loadOrganization();
  }, [loadOrganization]);

  const refreshOrganization = useCallback(async () => {
    await loadOrganization();
  }, [loadOrganization]);

  return (
    <OrganizationContext.Provider
      value={{
        organization,
        membership,
        loading,
        hasOrg: !!organization,
        availableOrganizations,
        isSuperUser,
        switchOrganization,
        refreshOrganization,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
};
