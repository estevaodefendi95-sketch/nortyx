import { createContext, useContext, useEffect, useState, useRef, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PLATFORM_CONFIG } from "@/config/constants";
import type { User, Session } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  approved: boolean | null;
  isAdmin: boolean;
  isViewer: boolean;
  signOut: () => Promise<void>;
  refreshApproval: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [approved, setApproved] = useState<boolean | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isViewer, setIsViewer] = useState(false);

  // Guard against double-fetch (onAuthStateChange fires + getSession)
  const fetchingRef = useRef(false);
  const fetchedForRef = useRef<string | null>(null);

  const fetchRoles = async (u: User) => {
    // Prevent duplicate fetches for the same user
    if (fetchingRef.current || fetchedForRef.current === u.id) return;
    fetchingRef.current = true;
    fetchedForRef.current = u.id;

    try {
      // Accept any pending org invites
      try {
        await supabase.rpc("accept_pending_invites" as any, { _user_id: u.id });
      } catch {}

      // For a self-service SaaS, everyone who authenticates is approved.
      // We only check roles (admin / viewer).
      const { data: rolesData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", u.id);

      const roles = (rolesData ?? []).map((r: any) => r.role as string);
      const isSuper = u.email === PLATFORM_CONFIG.SUPER_USER_EMAIL;

      setApproved(true);           // SaaS: auto-approved
      setIsAdmin(roles.includes("admin") || isSuper);
      setIsViewer(roles.includes("viewer") && !roles.includes("admin") && !isSuper);
    } catch (err) {
      console.error("[useAuth] fetchRoles error:", err);
      // Even if roles fail, don't block the user
      setApproved(true);
    } finally {
      fetchingRef.current = false;
    }
  };

  const refreshApproval = async () => {
    if (!user) return;
    fetchedForRef.current = null; // force re-fetch
    fetchingRef.current = false;
    await fetchRoles(user);
  };

  useEffect(() => {
    // ── 1. Check existing session immediately (no flicker) ──────────────────
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (s?.user) {
        setSession(s);
        setUser(s.user);
        fetchRoles(s.user).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    // ── 2. Subscribe to future auth changes ──────────────────────────────────
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      const nextUser = s?.user ?? null;
      setUser(nextUser);

      if (nextUser) {
        // fetchRoles is idempotent (guards duplicate calls)
        fetchRoles(nextUser).finally(() => setLoading(false));
      } else {
        // Signed out — reset everything
        fetchingRef.current = false;
        fetchedForRef.current = null;
        setApproved(null);
        setIsAdmin(false);
        setIsViewer(false);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signOut = async () => {
    // Clear all nortyx-related localStorage data on logout
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith("nortyx:") || k.startsWith("nortyx_") || k.startsWith("paggio_"))) {
        toRemove.push(k);
      }
    }
    toRemove.forEach(k => { try { localStorage.removeItem(k); } catch {} });

    fetchingRef.current = false;
    fetchedForRef.current = null;
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, approved, isAdmin, isViewer, signOut, refreshApproval }}>
      {children}
    </AuthContext.Provider>
  );
};
