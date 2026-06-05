import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { DEFAULT_CATEGORIES, type CategoryInfo, type CategoryCode } from "@/data/cashflow";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/context/OrganizationContext";
import { PLATFORM_CONFIG, getCategoryMappingsStorageKey, getColorOverridesStorageKey } from "@/config/constants";

// Default color map for built-in categories
const DEFAULT_COLORS: Record<string, string> = {
  "chart-food": "hsl(25, 95%, 53%)",
  "chart-drinks": "hsl(200, 80%, 50%)",
  "chart-fixed": "hsl(260, 60%, 55%)",
  "chart-labor": "hsl(152, 60%, 48%)",
  "chart-equipment": "hsl(38, 92%, 50%)",
  "chart-freelance": "hsl(330, 70%, 55%)",
  "chart-lounge": "hsl(180, 60%, 45%)",
  "chart-other": "hsl(215, 12%, 50%)",
  "chart-withdrawal": "hsl(0, 0%, 60%)",
  "chart-reform": "hsl(15, 80%, 45%)",
};

// Extra colors for new categories
const EXTRA_COLORS = [
  "hsl(280, 60%, 55%)", "hsl(340, 70%, 50%)", "hsl(60, 70%, 45%)",
  "hsl(120, 50%, 45%)", "hsl(190, 70%, 45%)", "hsl(10, 80%, 50%)",
  "hsl(240, 50%, 55%)", "hsl(90, 60%, 40%)", "hsl(310, 55%, 50%)",
  "hsl(50, 80%, 48%)",
];

interface CategoriesContextType {
  categories: CategoryInfo[];
  addCategory: (name: string) => CategoryInfo;
  deleteCategory: (code: CategoryCode) => Promise<void>;
  getCategoryInfo: (code: CategoryCode) => CategoryInfo;
  getCategoryColor: (codeOrColorVar: string) => string;
  updateCategoryColor: (code: CategoryCode, color: string) => void;
  updateCategoryName: (code: CategoryCode, name: string) => Promise<void>;
  mappings: Record<string, CategoryCode>;
  addMapping: (keyword: string, categoryCode: CategoryCode) => void;
  findCategoryByKeyword: (empresa: string) => CategoryCode | null;
}

const CategoriesContext = createContext<CategoriesContextType | null>(null);

export const useCategories = () => {
  const ctx = useContext(CategoriesContext);
  if (!ctx) throw new Error("useCategories must be used within CategoriesProvider");
  return ctx;
};

export const CategoriesProvider = ({ children }: { children: ReactNode }) => {
  const { user, loading: authLoading } = useAuth();
  const { organization } = useOrganization();
  const orgId = organization?.id;
  const [cats, setCats] = useState<CategoryInfo[]>([]);
  const [dbLoaded, setDbLoaded] = useState(false);
  const [colorOverrides, setColorOverrides] = useState<Record<string, string>>({});

  // Initialize mappings with org-scoped storage
  const [mappings, setMappings] = useState<Record<string, CategoryCode>>(() => {
    if (!orgId) return {};
    try {
      const raw = localStorage.getItem(getCategoryMappingsStorageKey(orgId)) || localStorage.getItem(PLATFORM_CONFIG.LEGACY_CATEGORY_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return {};
  });

  // Persist mappings to org-scoped storage
  useEffect(() => {
    if (!orgId) return;
    localStorage.setItem(getCategoryMappingsStorageKey(orgId), JSON.stringify(mappings));
  }, [mappings, orgId]);

  // Load and persist color overrides to org-scoped storage
  useEffect(() => {
    if (!orgId) {
      setColorOverrides({});
      return;
    }
    try {
      const raw = localStorage.getItem(getColorOverridesStorageKey(orgId));
      if (raw) setColorOverrides(JSON.parse(raw));
    } catch {}
  }, [orgId]);

  // Save color overrides to storage when they change
  useEffect(() => {
    if (!orgId) return;
    localStorage.setItem(getColorOverridesStorageKey(orgId), JSON.stringify(colorOverrides));
  }, [colorOverrides, orgId]);

  // Load categories from DB and migrate any orphaned categories from transactions
  useEffect(() => {
    if (authLoading || !user || !orgId) return;

    const loadCategories = async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error loading categories:", error);
        setDbLoaded(true);
        return;
      }

      let rows = data || [];

      if (rows.length === 0) {
        // Seed default categories into DB for this org
        const toInsert = DEFAULT_CATEGORIES.map((cat) => ({
          code: cat.code,
          name: cat.name,
          color: DEFAULT_COLORS[cat.colorVar] || "hsl(215, 12%, 50%)",
          organization_id: orgId,
        }));
        const { data: inserted, error: insErr } = await supabase
          .from("categories")
          .insert(toInsert as any)
          .select("*");
        if (insErr) {
          console.error("Error seeding default categories:", insErr);
        }
        rows = inserted || [];
      }

      const dbCats: CategoryInfo[] = rows.map((row: any) => ({
        code: row.code,
        name: row.name,
        colorVar: `db-${row.code}`,
      }));
      const newColorOverrides: Record<string, string> = {};
      rows.forEach((row: any) => {
        newColorOverrides[row.code] = row.color;
      });
      setColorOverrides(newColorOverrides);
      setCats(dbCats);

      // Source of truth is the DB only — orphan codes in transactions
      // fall back to "Outros" via getCategoryInfoFn. We never invent
      // categories from transaction data anymore.

      setDbLoaded(true);
    };

    loadCategories();
  }, [user, authLoading, orgId]);

  // Realtime sync (filtered by organization)
  useEffect(() => {
    if (!orgId) return;

    const channel = supabase
      .channel(`categories-${orgId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "categories", filter: `organization_id=eq.${orgId}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const row = payload.new as any;
            setColorOverrides((prev) => ({ ...prev, [row.code]: row.color }));
            setCats((prev) => {
              if (prev.some((c) => c.code === row.code)) return prev;
              return [...prev, { code: row.code, name: row.name, colorVar: `db-${row.code}` }];
            });
          } else if (payload.eventType === "UPDATE") {
            const row = payload.new as any;
            setColorOverrides((prev) => ({ ...prev, [row.code]: row.color }));
            setCats((prev) =>
              prev.map((c) =>
                c.code === row.code ? { ...c, name: row.name, colorVar: `db-${row.code}` } : c
              )
            );
          } else if (payload.eventType === "DELETE") {
            const row = payload.old as any;
            setColorOverrides((prev) => {
              const next = { ...prev };
              delete next[row.code];
              return next;
            });
            setCats((prev) => prev.filter((c) => c.code !== row.code));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orgId]);

  const addCategory = useCallback((name: string): CategoryInfo => {
    const code = name.substring(0, 3).toUpperCase().replace(/\s/g, "") + Date.now().toString(36).slice(-3);
    const colorIdx = cats.length % EXTRA_COLORS.length;
    const color = EXTRA_COLORS[colorIdx];
    setColorOverrides((prev) => ({ ...prev, [code]: color }));
    const newCat: CategoryInfo = { code, name, colorVar: `db-${code}` };
    setCats((prev) => [...prev, newCat]);

    // Save to DB
    supabase.from("categories").insert({ code, name, color, organization_id: orgId } as any).then(({ error }) => {
      if (error) console.error("Error saving category:", error);
    });

    return newCat;
  }, [cats, orgId]);

  const updateCategoryColor = useCallback(async (code: CategoryCode, color: string) => {
    setColorOverrides((prev) => ({ ...prev, [code]: color }));
    // Force re-render
    setCats((prev) => [...prev]);

    const { error } = await supabase
      .from("categories")
      .update({ color })
      .eq("code", code);

    if (error) {
      console.error("Error updating category color:", error);
    }
  }, []);

  const updateCategoryName = useCallback(async (code: CategoryCode, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setCats((prev) => prev.map((c) => (c.code === code ? { ...c, name: trimmed } : c)));
    const { error } = await supabase
      .from("categories")
      .update({ name: trimmed })
      .eq("code", code);
    if (error) console.error("Error renaming category:", error);
  }, []);

  const deleteCategory = useCallback(async (code: CategoryCode) => {
    if (code === "O") return;

    const { error: txError } = await supabase
      .from("transactions")
      .update({ categoria: "O" })
      .eq("categoria", code);

    if (txError) {
      console.error("Error reassigning transactions before deleting category:", txError);
      return;
    }

    const { error } = await supabase
      .from("categories")
      .delete()
      .eq("code", code);

    if (error) {
      console.error("Error deleting category:", error);
      return;
    }

    setColorOverrides((prev) => {
      const next = { ...prev };
      delete next[code];
      return next;
    });
    setCats((prev) => prev.filter((c) => c.code !== code));

    setMappings((prev) => {
      const next = Object.fromEntries(
        Object.entries(prev).filter(([, mappedCode]) => mappedCode !== code)
      ) as Record<string, CategoryCode>;
      return next;
    });

    try {
      const raw = localStorage.getItem("nortyx_categories") || localStorage.getItem("paggio_categories");
      if (raw) {
        const localCats: CategoryInfo[] = JSON.parse(raw);
        const filtered = localCats.filter((c) => c.code !== code);
        localStorage.setItem("nortyx_categories", JSON.stringify(filtered));
        localStorage.removeItem("paggio_categories");
      }
    } catch {}
  }, []);

  const getCategoryInfoFn = useCallback((code: CategoryCode): CategoryInfo => {
    return cats.find((c) => c.code === code) || cats.find((c) => c.code === "O") || cats[0];
  }, [cats]);

  const getCategoryColor = useCallback((codeOrColorVar: string): string => {
    // Check by code first (direct lookup)
    if (colorOverrides[codeOrColorVar]) return colorOverrides[codeOrColorVar];
    // Check if it's a db-prefixed colorVar
    if (codeOrColorVar.startsWith("db-")) {
      const code = codeOrColorVar.replace("db-", "");
      if (colorOverrides[code]) return colorOverrides[code];
    }
    // Fallback to default color map
    if (DEFAULT_COLORS[codeOrColorVar]) return DEFAULT_COLORS[codeOrColorVar];
    return "hsl(215, 12%, 50%)";
  }, []);

  const addMapping = useCallback((keyword: string, categoryCode: CategoryCode) => {
    const key = keyword.toLowerCase().trim();
    if (!key) return;
    setMappings((prev) => ({ ...prev, [key]: categoryCode }));
  }, []);

  const findCategoryByKeyword = useCallback((empresa: string): CategoryCode | null => {
    const lower = empresa.toLowerCase().trim();
    if (mappings[lower]) return mappings[lower];
    for (const [keyword, code] of Object.entries(mappings)) {
      if (lower.includes(keyword) || keyword.includes(lower)) return code;
    }
    return null;
  }, [mappings]);

  return (
    <CategoriesContext.Provider
      value={{
        categories: cats,
        addCategory,
        deleteCategory,
        getCategoryInfo: getCategoryInfoFn,
        getCategoryColor,
        updateCategoryColor,
        updateCategoryName,
        mappings,
        addMapping,
        findCategoryByKeyword,
      }}
    >
      {children}
    </CategoriesContext.Provider>
  );
};

export { DEFAULT_COLORS as CATEGORY_COLORS };
