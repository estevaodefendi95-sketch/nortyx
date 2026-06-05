import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  ArrowLeft,
  Bell,
  Building2,
  Check,
  History,
  LogOut,
  MoreVertical,
  Settings,
  Shield,
} from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import LogoImage from "@/components/LogoImage";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useOrgBranding } from "@/hooks/useOrgBranding";
import { useOrganization } from "@/context/OrganizationContext";
import { usePaymentReminder } from "@/hooks/usePaymentReminder";
import { formatCurrency } from "@/data/cashflow";

interface AppHeaderProps {
  /** If provided, shows back arrow that navigates to this route. */
  backTo?: string;
  /** Optional secondary title displayed below the company name. */
  title?: string;
  /** Extra content rendered inside the header container, below the top row. */
  children?: React.ReactNode;
  /** Container max width class. Defaults to max-w-7xl. */
  containerClassName?: string;
}

const AppHeader = ({ backTo, title, children, containerClassName = "max-w-7xl" }: AppHeaderProps) => {
  const navigate = useNavigate();
  const { signOut, isAdmin, loading: authLoading } = useAuth();
  const { logoUrl: companyLogo, companyName } = useOrgBranding();
  const {
    membership,
    availableOrganizations,
    isSuperUser,
    switchOrganization,
    organization,
    loading: orgLoading,
  } = useOrganization();
  const { getPendingBills } = usePaymentReminder();

  const bootLoading = authLoading || orgLoading;
  const pendingBills = useMemo(() => getPendingBills(), [getPendingBills]);
  const isOrgOwner =
    membership?.role === "owner" || membership?.role === "admin" || isAdmin || isSuperUser;

  const showOrgSwitcher =
    !bootLoading &&
    (availableOrganizations.length > 1 ||
      (availableOrganizations.length === 1 && availableOrganizations[0].id !== organization?.id));

  return (
    <header className="border-b border-border/20 bg-card/70 backdrop-blur-md shadow-soft-sm sticky top-0 z-10">
      <div className={`container ${containerClassName} mx-auto px-lg sm:px-lg py-md sm:py-lg`}>
        <div className="flex items-center justify-between gap-2">
          {/* Logo + Name */}
          <div className="flex items-center gap-3 min-w-0">
            {backTo && (
              <button
                onClick={() => navigate(backTo)}
                className="p-md -ml-md rounded-md hover:bg-secondary/80 active:scale-95 transition-all duration-200 flex-shrink-0"
                title="Voltar"
              >
                <ArrowLeft className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />
              </button>
            )}

            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg border border-border bg-secondary/50 flex items-center justify-center overflow-hidden flex-shrink-0">
              <LogoImage
                src={companyLogo}
                alt={companyName}
                className="w-full h-full object-cover"
                fallbackClassName="w-4 h-4"
              />
            </div>

            <div className="min-w-0 flex flex-col leading-tight">
              {bootLoading ? (
                <Skeleton className="h-7 w-32" />
              ) : (
                <span className="text-xl sm:text-2xl font-display font-bold truncate text-primary">
                  {companyName}
                </span>
              )}
              {title && (
                <span className="text-[11px] sm:text-xs text-muted-foreground truncate">{title}</span>
              )}
            </div>

            {showOrgSwitcher && (
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    className="p-md rounded-md hover:bg-secondary/80 active:scale-95 transition-all duration-200 flex-shrink-0"
                    title={organization?.name || "Trocar empresa"}
                  >
                    <Building2 className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-64 p-1">
                  <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                    Selecionar empresa
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    {availableOrganizations.map((org) => {
                      const active = org.id === organization?.id;
                      return (
                        <button
                          key={org.id}
                          onClick={() => switchOrganization(org.id)}
                          className={`w-full flex items-center justify-between gap-2 px-2 py-2 rounded-md text-sm text-left transition-colors ${
                            active ? "bg-primary/10 text-primary" : "hover:bg-secondary"
                          }`}
                        >
                          <span className="truncate">{org.name}</span>
                          {active && <Check className="w-4 h-4 flex-shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>

          {/* Action icons */}
          <div className="flex items-center gap-xs sm:gap-sm flex-shrink-0">
            <Popover>
              <PopoverTrigger asChild>
                <button className="relative p-md rounded-md hover:bg-secondary/80 active:scale-95 transition-all duration-200 flex-shrink-0">
                  <Bell className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />
                  {pendingBills.length > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-warning text-[9px] font-bold text-background flex items-center justify-center">
                      {pendingBills.length > 9 ? "9+" : pendingBills.length}
                    </span>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="end">
                <div className="p-3 border-b border-border">
                  <p className="text-sm font-semibold">Contas Pendentes</p>
                  {pendingBills.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Total:{" "}
                      <span className="text-warning font-medium">
                        {formatCurrency(pendingBills.reduce((s, t) => s + t.valor, 0))}
                      </span>
                    </p>
                  )}
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {pendingBills.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">
                      Nenhuma conta pendente 🎉
                    </p>
                  ) : (
                    pendingBills.map((t) => (
                      <div
                        key={t.id}
                        className="flex items-center justify-between px-3 py-2 border-b border-border/30 last:border-0"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{t.empresa}</p>
                          <p className="text-[11px] text-muted-foreground">{t.data}</p>
                        </div>
                        <span className="text-sm font-semibold text-expense ml-2 flex-shrink-0">
                          {formatCurrency(t.valor)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <button className="relative p-md rounded-md hover:bg-secondary/80 active:scale-95 transition-all duration-200 flex-shrink-0">
                  <MoreVertical className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-56 p-1">
                <div className="flex items-center justify-between px-2 py-2 border-b border-border mb-1">
                  <span className="text-xs font-medium text-muted-foreground">Tema</span>
                  <ThemeToggle />
                </div>
                {!authLoading && isAdmin && (
                  <>
                    <button
                      onClick={() => navigate("/admin/history")}
                      className="w-full flex items-center gap-2 px-2 py-2 rounded-md text-sm hover:bg-secondary transition-colors text-left"
                    >
                      <History className="w-4 h-4 text-muted-foreground" />
                      Histórico
                    </button>
                    <button
                      onClick={() => navigate("/admin")}
                      className="w-full flex items-center gap-2 px-2 py-2 rounded-md text-sm hover:bg-secondary transition-colors text-left"
                    >
                      <Shield className="w-4 h-4 text-primary" />
                      Usuários
                    </button>
                  </>
                )}
                {!bootLoading && isOrgOwner && (
                  <button
                    onClick={() => navigate("/settings")}
                    className="w-full flex items-center gap-2 px-2 py-2 rounded-md text-sm hover:bg-secondary transition-colors text-left"
                  >
                    <Settings className="w-4 h-4 text-muted-foreground" />
                    Configurações
                  </button>
                )}
                <button
                  onClick={signOut}
                  className="w-full flex items-center gap-2 px-2 py-2 rounded-md text-sm hover:bg-secondary transition-colors text-left text-destructive"
                >
                  <LogOut className="w-4 h-4" />
                  Sair
                </button>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {children}
      </div>
    </header>
  );
};

export default AppHeader;
