import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/context/OrganizationContext";

export interface DashboardSettings {
  show_faturamento_medio: boolean;
  show_cmv: boolean;
  show_top_foods: boolean;
  show_top_drinks: boolean;
  cmv_categories: string[];
  top_foods_title: string;
  top_drinks_title: string;
}

const DEFAULTS: DashboardSettings = {
  show_faturamento_medio: true,
  show_cmv: true,
  show_top_foods: true,
  show_top_drinks: true,
  cmv_categories: ["C", "B"],
  top_foods_title: "Top 10 Comidas",
  top_drinks_title: "Top 10 Bebidas",
};

export const useDashboardSettings = () => {
  const { organization } = useOrganization();
  const [settings, setSettings] = useState<DashboardSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!organization) {
      setSettings(DEFAULTS);
      setLoading(false);
      return;
    }
    try {
      const { data } = await supabase
        .from("org_dashboard_settings")
        .select("*")
        .eq("organization_id", organization.id)
        .maybeSingle();

      if (data) {
        setSettings({
          show_faturamento_medio: data.show_faturamento_medio,
          show_cmv: data.show_cmv,
          show_top_foods: data.show_top_foods,
          show_top_drinks: data.show_top_drinks,
          cmv_categories: data.cmv_categories || DEFAULTS.cmv_categories,
          top_foods_title: data.top_foods_title || DEFAULTS.top_foods_title,
          top_drinks_title: data.top_drinks_title || DEFAULTS.top_drinks_title,
        });
      } else {
        setSettings(DEFAULTS);
      }
    } catch {
      setSettings(DEFAULTS);
    } finally {
      setLoading(false);
    }
  }, [organization]);

  useEffect(() => {
    load();
  }, [load]);

  return { settings, loading, refresh: load };
};
