import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/context/OrganizationContext";

export interface DashboardSettings {
  show_faturamento_medio: boolean;
  show_cmv: boolean;
  show_top_foods: boolean;
  show_top_drinks: boolean;
  cmv_categories: string[];
  faturamento_medio_title: string;
  ranking_title: string;
}

const DEFAULTS: DashboardSettings = {
  show_faturamento_medio: true,
  show_cmv: true,
  show_top_foods: true,
  show_top_drinks: true,
  cmv_categories: ["C", "B"],
  faturamento_medio_title: "Faturamento Médio / Dia",
  ranking_title: "Top 10",
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
          faturamento_medio_title: (data as any).faturamento_medio_title || DEFAULTS.faturamento_medio_title,
          ranking_title: (data as any).ranking_title || DEFAULTS.ranking_title,
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
