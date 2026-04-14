import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

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
  const [loading, setLoading] = useState(true);

  const loadOrganization = useCallback(async () => {
    if (!user) {
      setOrganization(null);
      setMembership(null);
      setLoading(false);
      return;
    }

    try {
      // Get the user's membership(s)
      const { data: memberships, error: memError } = await supabase
        .from("organization_members")
        .select("*")
        .eq("user_id", user.id);

      if (memError) throw memError;

      if (!memberships || memberships.length === 0) {
        setOrganization(null);
        setMembership(null);
        setLoading(false);
        return;
      }

      // Check localStorage for preferred org
      const preferredOrgId = localStorage.getItem("paggio_active_org");
      const activeMembership = memberships.find((m) => m.organization_id === preferredOrgId) || memberships[0];

      // Load the organization
      const { data: org, error: orgError } = await supabase
        .from("organizations")
        .select("*")
        .eq("id", activeMembership.organization_id)
        .single();

      if (orgError) throw orgError;

      setOrganization({
        id: org.id,
        name: org.name,
        slug: org.slug,
        logo_url: org.logo_url,
        primary_color: org.primary_color,
        plan: org.plan,
        subscription_status: org.subscription_status,
      });
      setMembership({
        id: activeMembership.id,
        organization_id: activeMembership.organization_id,
        user_id: activeMembership.user_id,
        role: activeMembership.role as OrgMember["role"],
        created_at: activeMembership.created_at,
      });
      localStorage.setItem("paggio_active_org", activeMembership.organization_id);
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
        switchOrganization,
        refreshOrganization,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
};
