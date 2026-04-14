import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/context/OrganizationContext";

export interface Subcategory {
  id: string;
  category_code: string;
  name: string;
  color: string;
}

interface SubcategoriesContextType {
  subcategories: Subcategory[];
  addSubcategory: (categoryCode: string, name: string) => Promise<Subcategory | null>;
  deleteSubcategory: (id: string) => Promise<void>;
  getSubcategoriesByCategory: (categoryCode: string) => Subcategory[];
  getSubcategoryName: (id: string) => string | null;
}

const SubcategoriesContext = createContext<SubcategoriesContextType | null>(null);

export const useSubcategories = () => {
  const ctx = useContext(SubcategoriesContext);
  if (!ctx) throw new Error("useSubcategories must be used within SubcategoriesProvider");
  return ctx;
};

const EXTRA_COLORS = [
  "hsl(280, 60%, 55%)", "hsl(340, 70%, 50%)", "hsl(60, 70%, 45%)",
  "hsl(120, 50%, 45%)", "hsl(190, 70%, 45%)", "hsl(10, 80%, 50%)",
  "hsl(240, 50%, 55%)", "hsl(90, 60%, 40%)", "hsl(310, 55%, 50%)",
  "hsl(50, 80%, 48%)",
];

export const SubcategoriesProvider = ({ children }: { children: ReactNode }) => {
  const { user, loading: authLoading } = useAuth();
  const { organization } = useOrganization();
  const orgId = organization?.id;
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);

  useEffect(() => {
    if (authLoading || !user || !orgId) return;

    const load = async () => {
      const { data, error } = await supabase
        .from("subcategories")
        .select("*")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: true });

      if (!error && data) {
        setSubcategories(data.map((r) => ({
          id: r.id,
          category_code: r.category_code,
          name: r.name,
          color: r.color,
        })));
      }
    };

    load();
  }, [user, authLoading, orgId]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel("subcategories-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "subcategories" }, (payload) => {
        if (payload.eventType === "INSERT") {
          const r = payload.new as any;
          setSubcategories((prev) => {
            if (prev.some((s) => s.id === r.id)) return prev;
            return [...prev, { id: r.id, category_code: r.category_code, name: r.name, color: r.color }];
          });
        } else if (payload.eventType === "DELETE") {
          const r = payload.old as any;
          setSubcategories((prev) => prev.filter((s) => s.id !== r.id));
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const addSubcategory = useCallback(async (categoryCode: string, name: string): Promise<Subcategory | null> => {
    const color = EXTRA_COLORS[subcategories.length % EXTRA_COLORS.length];
    const { data, error } = await supabase
      .from("subcategories")
      .insert({ category_code: categoryCode, name, color, organization_id: orgId } as any)
      .select()
      .single();

    if (error || !data) {
      console.error("Error adding subcategory:", error);
      return null;
    }

    const sub: Subcategory = { id: data.id, category_code: data.category_code, name: data.name, color: data.color };
    setSubcategories((prev) => [...prev, sub]);
    return sub;
  }, [subcategories]);

  const deleteSubcategory = useCallback(async (id: string) => {
    setSubcategories((prev) => prev.filter((s) => s.id !== id));
    await supabase.from("subcategories").delete().eq("id", id);
  }, []);

  const getSubcategoriesByCategory = useCallback((categoryCode: string) => {
    return subcategories.filter((s) => s.category_code === categoryCode);
  }, [subcategories]);

  const getSubcategoryName = useCallback((id: string) => {
    return subcategories.find((s) => s.id === id)?.name || null;
  }, [subcategories]);

  return (
    <SubcategoriesContext.Provider value={{ subcategories, addSubcategory, deleteSubcategory, getSubcategoriesByCategory, getSubcategoryName }}>
      {children}
    </SubcategoriesContext.Provider>
  );
};
