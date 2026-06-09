import { type ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Building2,
  CreditCard,
  LogOut,
  Shield,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

interface MasterLayoutProps {
  children: ReactNode;
}

const NAV_ITEMS = [
  { to: "/master",          label: "Dashboard",  icon: LayoutDashboard, end: true },
  { to: "/master/empresas", label: "Empresas",   icon: Building2,       end: false },
  { to: "/master/planos",   label: "Planos",     icon: CreditCard,      end: false },
];

const MasterLayout = ({ children }: MasterLayoutProps) => {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  return (
    <div className="flex h-screen bg-[#0f0f1a] text-white overflow-hidden">
      {/* Sidebar */}
      <aside className="w-60 flex-shrink-0 bg-[#1a1a2e] flex flex-col border-r border-white/5">
        {/* Brand */}
        <div className="px-5 py-6 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
              <Shield className="w-4 h-4 text-primary" />
            </div>
            <div className="leading-tight">
              <p className="text-[11px] font-bold tracking-[0.12em] uppercase text-primary/70">
                Nortyx
              </p>
              <p className="text-[13px] font-bold text-white">Master Panel</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group",
                  isActive
                    ? "bg-primary/15 text-primary"
                    : "text-white/50 hover:text-white/90 hover:bg-white/5"
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={cn("w-4 h-4 flex-shrink-0", isActive ? "text-primary" : "text-white/40 group-hover:text-white/70")} />
                  <span className="flex-1">{label}</span>
                  {isActive && <ChevronRight className="w-3 h-3 text-primary/60" />}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-3 py-4 border-t border-white/5">
          <NavLink
            to="/"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-white/50 hover:text-white/90 hover:bg-white/5 transition-colors mb-1"
          >
            <LayoutDashboard className="w-4 h-4 flex-shrink-0 text-white/40" />
            Ir para o App
          </NavLink>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-400/70 hover:text-red-400 hover:bg-red-400/5 transition-colors text-left"
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            Sair
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto bg-[#0f0f1a]">
        {children}
      </main>
    </div>
  );
};

export default MasterLayout;
