import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { DEFAULT_CATEGORIES, type CategoryInfo, type CategoryCode } from "@/data/cashflow";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const STORAGE_KEY_MAP = "paggio_category_mappings";

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

// Runtime color overrides (code → color)
const colorOverrides: Record<string, string> = {};

export const CategoriesProvider = ({ children }: { children: ReactNode }) => {
  const { user, loading: authLoading } = useAuth();
  const [cats, setCats] = useState<CategoryInfo[]>(DEFAULT_CATEGORIES);
  const [dbLoaded, setDbLoaded] = useState(false);

  const [mappings, setMappings] = useState<Record<string, CategoryCode>>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_MAP);
      if (raw) return JSON.parse(raw);
    } catch {}
    return {};
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_MAP, JSON.stringify(mappings));
  }, [mappings]);

  // Load categories from DB and migrate any orphaned categories from transactions
  useEffect(() => {
    if (authLoading || !user) return;

    const loadCategories = async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error loading categories:", error);
        setDbLoaded(true);
        return;
      }

      if (!data || data.length === 0) {
        // Seed default categories into DB
        const toInsert = DEFAULT_CATEGORIES.map((cat) => ({
          code: cat.code,
          name: cat.name,
          color: DEFAULT_COLORS[cat.colorVar] || "hsl(215, 12%, 50%)",
        }));
        await supabase.from("categories").insert(toInsert);
        DEFAULT_CATEGORIES.forEach((cat) => {
          colorOverrides[cat.code] = DEFAULT_COLORS[cat.colorVar] || "hsl(215, 12%, 50%)";
        });
      } else {
        const dbCats: CategoryInfo[] = data.map((row) => ({
          code: row.code,
          name: row.name,
          colorVar: `db-${row.code}`,
        }));
        setCats(dbCats);
        data.forEach((row) => {
          colorOverrides[row.code] = row.color;
        });
      }

      // Migrate orphaned categories: check if transactions reference category codes not in DB
      const existingCodes = new Set((data || []).map((r) => r.code));
      const { data: txCats } = await supabase
        .from("transactions")
        .select("categoria");
      
      if (txCats) {
        const orphanedCodes = new Set<string>();
        txCats.forEach((t) => {
          if (!existingCodes.has(t.categoria)) {
            orphanedCodes.add(t.categoria);
          }
        });

        if (orphanedCodes.size > 0) {
          // Try to recover names from localStorage
          let localCats: CategoryInfo[] = [];
          try {
            const raw = localStorage.getItem("paggio_categories");
            if (raw) localCats = JSON.parse(raw);
          } catch {}

          const toInsert = Array.from(orphanedCodes).map((code, idx) => {
            const localMatch = localCats.find((c) => c.code === code);
            const color = EXTRA_COLORS[(existingCodes.size + idx) % EXTRA_COLORS.length];
            return {
              code,
              name: localMatch?.name || `Categoria ${code}`,
              color,
            };
          });

          await supabase.from("categories").insert(toInsert);

          // Update local state with new categories
          const newCats = toInsert.map((row) => ({
            code: row.code,
            name: row.name,
            colorVar: `db-${row.code}`,
          }));
          newCats.forEach((c) => {
            const match = toInsert.find((t) => t.code === c.code);
            if (match) colorOverrides[c.code] = match.color;
          });
          setCats((prev) => [...prev, ...newCats]);
        }
      }

      // Legacy localStorage category migration removed to avoid resurrecting deleted categories
      // Source of truth is now only the database


      setDbLoaded(true);
    };

    loadCategories();
  }, [user, authLoading]);

  // Realtime sync
  useEffect(() => {
    const channel = supabase
      .channel("categories-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "categories" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const row = payload.new as any;
            colorOverrides[row.code] = row.color;
            setCats((prev) => {
              if (prev.some((c) => c.code === row.code)) return prev;
              return [...prev, { code: row.code, name: row.name, colorVar: `db-${row.code}` }];
            });
          } else if (payload.eventType === "UPDATE") {
            const row = payload.new as any;
            colorOverrides[row.code] = row.color;
            setCats((prev) =>
              prev.map((c) =>
                c.code === row.code ? { ...c, name: row.name, colorVar: `db-${row.code}` } : c
              )
            );
            // Force re-render by triggering state change
            setCats((prev) => [...prev]);
          } else if (payload.eventType === "DELETE") {
            const row = payload.old as any;
            delete colorOverrides[row.code];
            setCats((prev) => prev.filter((c) => c.code !== row.code));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const addCategory = useCallback((name: string): CategoryInfo => {
    const code = name.substring(0, 3).toUpperCase().replace(/\s/g, "") + Date.now().toString(36).slice(-3);
    const colorIdx = cats.length % EXTRA_COLORS.length;
    const color = EXTRA_COLORS[colorIdx];
    colorOverrides[code] = color;
    const newCat: CategoryInfo = { code, name, colorVar: `db-${code}` };
    setCats((prev) => [...prev, newCat]);

    // Save to DB
    supabase.from("categories").insert({ code, name, color }).then(({ error }) => {
      if (error) console.error("Error saving category:", error);
    });

    return newCat;
  }, [cats]);

  const updateCategoryColor = useCallback(async (code: CategoryCode, color: string) => {
    colorOverrides[code] = color;
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

    delete colorOverrides[code];
    setCats((prev) => prev.filter((c) => c.code !== code));

    setMappings((prev) => {
      const next = Object.fromEntries(
        Object.entries(prev).filter(([, mappedCode]) => mappedCode !== code)
      ) as Record<string, CategoryCode>;
      return next;
    });

    try {
      const raw = localStorage.getItem("paggio_categories");
      if (raw) {
        const localCats: CategoryInfo[] = JSON.parse(raw);
        const filtered = localCats.filter((c) => c.code !== code);
        localStorage.setItem("paggio_categories", JSON.stringify(filtered));
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
