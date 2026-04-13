import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const ALL_TABS = ["dados", "calendar", "categories", "clientes", "lancamento"];

export function useTabVisibility() {
  const { session } = useAuth();
  const [visibleTabs, setVisibleTabs] = useState<string[]>(ALL_TABS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.user?.id) return;
    const load = async () => {
      const { data } = await supabase
        .from("tab_visibility")
        .select("tab_id, visible")
        .eq("user_id", session.user.id);
      if (data && data.length > 0) {
        const hidden = new Set(data.filter((d) => !d.visible).map((d) => d.tab_id));
        setVisibleTabs(ALL_TABS.filter((t) => !hidden.has(t)));
      } else {
        setVisibleTabs(ALL_TABS);
      }
      setLoading(false);
    };
    load();
  }, [session?.user?.id]);

  return { visibleTabs, loading, ALL_TABS };
}
