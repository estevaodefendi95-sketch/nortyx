import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/context/OrganizationContext";

const ALL_TABS = ["dados", "calendar", "categories", "clientes", "lancamento"];

export function useTabVisibility() {
  const { session } = useAuth();
  const { organization } = useOrganization();
  const [visibleTabs, setVisibleTabs] = useState<string[]>(ALL_TABS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userId = session?.user?.id;
    const orgId = organization?.id;
    if (!userId || !orgId) return;

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("tab_visibility")
        .select("tab_id, visible")
        .eq("user_id", userId)
        .eq("organization_id", orgId);
      if (cancelled) return;
      if (data && data.length > 0) {
        const hidden = new Set(data.filter((d) => !d.visible).map((d) => d.tab_id));
        setVisibleTabs(ALL_TABS.filter((t) => !hidden.has(t)));
      } else {
        setVisibleTabs(ALL_TABS);
      }
      setLoading(false);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id, organization?.id]);

  return { visibleTabs, loading, ALL_TABS };
}
