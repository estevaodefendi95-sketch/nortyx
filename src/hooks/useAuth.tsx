import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
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

  const fetchApprovalAndRole = async (userId: string) => {
    // Accept any pending org invites for this user (by email)
    try {
      await supabase.rpc("accept_pending_invites" as any, { _user_id: userId });
    } catch {}
    const [profileRes, rolesRes] = await Promise.all([
      supabase.from("profiles").select("approved").eq("user_id", userId).single(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);
    setApproved(profileRes.data?.approved ?? false);
    const roles = rolesRes.data?.map((r: any) => r.role) || [];
    setIsAdmin(roles.includes("admin"));
    setIsViewer(roles.includes("viewer"));
  };

  const refreshApproval = async () => {
    if (user) await fetchApprovalAndRole(user.id);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        // Use setTimeout to avoid Supabase deadlock
        setTimeout(() => fetchApprovalAndRole(session.user.id), 0);
      } else {
      setApproved(null);
        setIsAdmin(false);
        setIsViewer(false);
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchApprovalAndRole(session.user.id).then(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, approved, isAdmin, isViewer, signOut, refreshApproval }}>
      {children}
    </AuthContext.Provider>
  );
};
