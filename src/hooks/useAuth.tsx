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

  // Prevent double-fetch: onAuthStateChange + getSession can both fire
  const fetchingRef = useRef(false);
  const initializedRef = useRef(false);

  const fetchApprovalAndRole = async (userId: string, userEmail?: string) => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;

    try {
      // Accept any pending org invites for this user (by email)
      try {
        await supabase.rpc("accept_pending_invites" as any, { _user_id: userId });
      } catch {}

      const [profileRes, rolesRes] = await Promise.all([
        supabase.from("profiles").select("approved").eq("user_id", userId).single(),
        supabase.from("user_roles").select("role").eq("user_id", userId),
      ]);

      // SaaS self-service: treat every user as approved by default.
      // Only block if the profile explicitly has approved=false AND it was
      // set that way by an admin (not just the DB default).
      // For now we auto-approve — DB migration will fix the default too.
      const profileApproved = profileRes.data?.approved;
      setApproved(profileApproved === false ? false : true);

      // Auto-approve at DB level if still false (race condition after signup)
      if (profileApproved === false) {
        supabase
          .from("profiles")
          .update({ approved: true })
          .eq("user_id", userId)
          .then(() => setApproved(true));
      }

      const roles = rolesRes.data?.map((r: any) => r.role) || [];
      const email = userEmail ?? (await supabase.auth.getUser()).data?.user?.email;
      const isSuper = email === PLATFORM_CONFIG.SUPER_USER_EMAIL;
      setIsAdmin(roles.includes("admin") || isSuper);
      setIsViewer(roles.includes("viewer") && !roles.includes("admin") && !isSuper);
    } finally {
      fetchingRef.current = false;
    }
  };

  const refreshApproval = async () => {
    if (user) await fetchApprovalAndRole(user.id, user.email ?? undefined);
  };

  useEffect(() => {
    // 1. Subscribe to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (newSession?.user) {
        // Only fetch if not already initialized (avoids double-fetch on load)
        if (!initializedRef.current) {
          initializedRef.current = true;
          fetchApprovalAndRole(newSession.user.id, newSession.user.email ?? undefined)
            .finally(() => setLoading(false));
        }
      } else {
        initializedRef.current = false;
        fetchingRef.current = false;
        setApproved(null);
        setIsAdmin(false);
        setIsViewer(false);
        setLoading(false);
      }
    });

    // 2. Check for an existing session on mount
    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      if (existingSession?.user && !initializedRef.current) {
        initializedRef.current = true;
        setSession(existingSession);
        setUser(existingSession.user);
        fetchApprovalAndRole(existingSession.user.id, existingSession.user.email ?? undefined)
          .finally(() => setLoading(false));
      } else if (!existingSession) {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signOut = async () => {
    // Clear all nortyx-related localStorage data
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith("nortyx:") || key.startsWith("nortyx_") || key.startsWith("paggio_"))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => {
      try { localStorage.removeItem(key); } catch {}
    });

    initializedRef.current = false;
    fetchingRef.current = false;
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, approved, isAdmin, isViewer, signOut, refreshApproval }}>
      {children}
    </AuthContext.Provider>
  );
};
