import { useState, useEffect, useMemo, useCallback } from "react";
import { CalendarDays, Tags, Plus, ArrowUpDown, Camera, X, BarChart3, Bell, LogOut, Shield, Clock, Sparkles, History, Users, Settings, Building2, Check, MoreVertical, TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import CalendarView from "@/components/CalendarView";
import CategoriesView from "@/components/CategoriesView";
import TransactionForm from "@/components/TransactionForm";
import EvolutionChart from "@/components/EvolutionChart";
import DadosView from "@/components/DadosView";
import ThemeToggle from "@/components/ThemeToggle";
import AppHeader from "@/components/AppHeader";
import ExportReportButton from "@/components/ExportReportButton";
import { formatCurrency } from "@/data/cashflow";
import { useTransactions } from "@/context/TransactionsContext";
import { Input } from "@/components/ui/input";
import { usePaymentReminder } from "@/hooks/usePaymentReminder";
import { useAuth } from "@/hooks/useAuth";
import AIChatWidget from "@/components/AIChatWidget";
import ClientsView from "@/components/ClientsView";
import NotificationBanner from "@/components/NotificationBanner";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTabVisibility } from "@/hooks/useTabVisibility";
import { useOrgBranding } from "@/hooks/useOrgBranding";
import { useOrganization } from "@/context/OrganizationContext";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

const MONTHS_PT = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

const MONTHS_FULL = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

type Tab = "calendar" | "categories" | "lancamento" | "dados" | "clientes";

const Index = () => {
  const { transactions, dailyIncomes } = useTransactions();
  const { getPendingBills } = usePaymentReminder();
  const { signOut, isAdmin, isViewer, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { visibleTabs, loading: tabsLoading } = useTabVisibility();
  const { logoUrl: companyLogo, companyName } = useOrgBranding();
  const { membership, availableOrganizations, isSuperUser, switchOrganization, organization, loading: orgLoading } = useOrganization();
  const { isLoading: txLoading } = useTransactions();
  const bootLoading = authLoading || orgLoading;
  const summaryLoading = bootLoading || txLoading;
  const pendingBills = useMemo(() => getPendingBills(), [getPendingBills]);
  const [pendingUsersCount, setPendingUsersCount] = useState(0);
  const [searchParams, setSearchParams] = useSearchParams();
  const storagePrefix = `nortyx:${organization?.id ?? "anon"}`;
  const readLS = (key: string) => { try { return localStorage.getItem(`${storagePrefix}:${key}`); } catch { return null; } };
  const writeLS = (key: string, val: string) => { try { localStorage.setItem(`${storagePrefix}:${key}`, val); } catch {} };

  const validTabs: Tab[] = ["dados", "calendar", "categories", "clientes", "lancamento"];
  const initialTab: Tab = (() => {
    const fromUrl = searchParams.get("tab");
    if (fromUrl && validTabs.includes(fromUrl as Tab)) return fromUrl as Tab;
    const fromLS = readLS("active_tab");
    if (fromLS && validTabs.includes(fromLS as Tab)) return fromLS as Tab;
    return "dados";
  })();
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [selectedMonths, setSelectedMonths] = useState<number[]>(() => {
    const v = readLS("selected_months");
    if (v) { try { const arr = JSON.parse(v); if (Array.isArray(arr) && arr.every((n) => typeof n === "number")) return arr; } catch {} }
    return [new Date().getMonth()];
  });
  const [selectedYear, setSelectedYear] = useState<number>(() => {
    const v = readLS("selected_year");
    const n = v ? Number(v) : NaN;
    return Number.isFinite(n) ? n : new Date().getFullYear();
  });
  const [billingCharges, setBillingCharges] = useState<{ valor: number; data_cobranca: string }[]>([]);

  // Persist active tab + reflect in URL
  useEffect(() => {
    writeLS("active_tab", activeTab);
    if (searchParams.get("tab") !== activeTab) {
      const next = new URLSearchParams(searchParams);
      next.set("tab", activeTab);
      setSearchParams(next, { replace: true });
    }
  }, [activeTab, organization?.id]);

  // Persist filters
  useEffect(() => { writeLS("selected_months", JSON.stringify(selectedMonths)); }, [selectedMonths, organization?.id]);
  useEffect(() => { writeLS("selected_year", String(selectedYear)); }, [selectedYear, organization?.id]);

  // If restored tab is no longer visible, fall back to first visible
  useEffect(() => {
    if (tabsLoading) return;
    if (!visibleTabs.includes(activeTab)) {
      const fallback = (visibleTabs[0] as Tab) || "dados";
      setActiveTab(fallback);
    }
  }, [tabsLoading, visibleTabs, activeTab]);


  useEffect(() => {
    if (!organization?.id) {
      setBillingCharges([]);
      return;
    }
    const load = async () => {
      const { data } = await supabase
        .from("billing_charges")
        .select("valor, data_cobranca")
        .eq("organization_id", organization.id);
      setBillingCharges(((data as any) || []).map((c: any) => ({ valor: Number(c.valor) || 0, data_cobranca: c.data_cobranca })));
    };
    load();
    const channel = supabase
      .channel(`billing_charges_header_${organization.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "billing_charges", filter: `organization_id=eq.${organization.id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [organization?.id]);

  // Extract available years from data
  const availableYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years: number[] = [];
    for (let y = currentYear - 2; y <= currentYear + 2; y++) {
      years.push(y);
    }
    return years.sort((a, b) => b - a);
  }, []);

  const isOrgOwner = membership?.role === "owner" || membership?.role === "admin" || isAdmin || isSuperUser;

  const toggleMonth = (month: number) => {
    setSelectedMonths((prev) => {
      if (prev.includes(month)) {
        return prev.filter((m) => m !== month);
      }
      return [...prev, month].sort((a, b) => a - b);
    });
  };

  const selectAll = () => setSelectedMonths([]);
  const isAllSelected = selectedMonths.length === 0;

  const { filteredIncome, filteredExpenses } = useMemo(() => {
    const matchMonth = (dateStr: string) => {
      const [, month, year] = dateStr.split("/").map(Number);
      if (year !== selectedYear) return false;
      return isAllSelected || selectedMonths.includes(month - 1);
    };

    const income = dailyIncomes
      .filter((i) => matchMonth(i.data))
      .reduce((sum, i) => sum + i.valor, 0);

    const chargesIncome = billingCharges
      .filter((c) => matchMonth(c.data_cobranca))
      .reduce((sum, c) => sum + c.valor, 0);

    const expenses = transactions
      .filter((t) => t.tipo === "saida" && matchMonth(t.data))
      .reduce((sum, t) => sum + t.valor, 0);

    return { filteredIncome: income + chargesIncome, filteredExpenses: expenses };
  }, [selectedMonths, isAllSelected, transactions, dailyIncomes, billingCharges, selectedYear]);

  const saldo = filteredIncome - filteredExpenses;

  const allTabs: { id: Tab; label: string; icon: any; viewerHidden?: boolean }[] = [
    { id: "dados", label: "Dados", icon: BarChart3 },
    { id: "calendar", label: "Calendário", icon: CalendarDays },
    { id: "categories", label: "Categorias", icon: Tags },
    { id: "clientes", label: "Clientes", icon: Users },
    { id: "lancamento", label: "Lançamento", icon: Plus, viewerHidden: true },
  ];

  const tabs = allTabs.filter((t) => {
    if (isViewer && t.viewerHidden) return false;
    return visibleTabs.includes(t.id);
  });

  const mobileTabs = [
    ...tabs,
    ...(!isViewer ? [{ id: "chat" as string, label: "IA", icon: Sparkles }] : []),
  ];

  return (
    <div className={`min-h-screen bg-background ${isMobile ? "pb-16" : ""}`}>
      {/* Header */}
      <AppHeader>
        <div className="sm:w-fit">
        {/* Summary row */}
        {summaryLoading ? (
          <div className="flex items-center gap-2 mt-2">
            <Skeleton className="h-12 sm:h-4 flex-1 sm:w-20" />
            <Skeleton className="h-12 sm:h-4 flex-1 sm:w-20" />
            <Skeleton className="h-12 sm:h-4 flex-1 sm:w-28" />
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2 mt-2.5 w-full">
            <div className="flex flex-col items-start gap-0.5 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg bg-secondary/40 border border-border/40">
              <span className="flex items-center gap-1 text-[9px] sm:text-[10px] uppercase tracking-wide text-muted-foreground">
                <TrendingUp className="w-3 h-3 text-income" /> Entrada
              </span>
              <span className="text-[12px] sm:text-sm font-semibold text-income leading-tight truncate w-full">{formatCurrency(filteredIncome)}</span>
            </div>
            <div className="flex flex-col items-start gap-0.5 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg bg-secondary/40 border border-border/40">
              <span className="flex items-center gap-1 text-[9px] sm:text-[10px] uppercase tracking-wide text-muted-foreground">
                <TrendingDown className="w-3 h-3 text-expense" /> Saída
              </span>
              <span className="text-[12px] sm:text-sm font-semibold text-expense leading-tight truncate w-full">{formatCurrency(filteredExpenses)}</span>
            </div>
            <div className={`flex flex-col items-start gap-0.5 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg border ${saldo >= 0 ? "bg-income/10 border-income/30" : "bg-expense/10 border-expense/30"}`}>
              <span className="flex items-center gap-1 text-[9px] sm:text-[10px] uppercase tracking-wide text-muted-foreground">
                <Wallet className="w-3 h-3" /> Saldo
              </span>
              <span className={`text-[12px] sm:text-sm font-semibold leading-tight truncate w-full ${saldo >= 0 ? "text-income" : "text-expense"}`}>{formatCurrency(saldo)}</span>
            </div>
          </div>
        )}

        {/* Desktop tabs */}
        {!isMobile && (
          tabsLoading || bootLoading ? (
            <Skeleton className="h-10 w-full sm:w-80 mt-2" />
          ) : (
          <div className="flex gap-1 bg-secondary/50 rounded-lg p-1 mt-2 w-full sm:w-fit">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    flex items-center justify-center gap-1.5 md:gap-2 px-3 md:px-4 py-2 rounded-md text-xs md:text-sm font-medium transition-all flex-1 sm:flex-none
                    ${isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden md:inline">{tab.label}</span>
                </button>
              );
            })}
          </div>
          )
        )}
        </div>

        {/* Year + Month Multi-Select Filter */}
        <div className="flex items-center gap-2 mt-2.5 sm:mt-3">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide flex-1 min-w-0">
          <Popover>
            <PopoverTrigger asChild>
              <button className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-md text-xs font-bold transition-all border border-transparent bg-secondary/40 text-muted-foreground whitespace-nowrap flex-shrink-0 hover:bg-secondary/70">
                {selectedYear} ▾
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2" align="start">
              <div className="flex flex-col gap-1">
                {availableYears.map((year) => (
                  <button
                    key={year}
                    onClick={() => setSelectedYear(year)}
                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                      selectedYear === year
                        ? "bg-primary text-primary-foreground"
                        : "text-foreground hover:bg-secondary"
                    }`}
                  >
                    {year}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          <div className="w-px h-5 bg-border flex-shrink-0 mx-0.5" />
          <button
            onClick={selectAll}
            className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-md text-xs font-medium transition-all border whitespace-nowrap flex-shrink-0 ${
              isAllSelected
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-secondary/40 text-muted-foreground border-transparent hover:bg-secondary/70"
            }`}
          >
            Todos
          </button>
          {MONTHS_PT.map((label, idx) => {
            const isActive = selectedMonths.includes(idx);
            return (
              <button
                key={idx}
                onClick={() => toggleMonth(idx)}
                className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-md text-xs font-medium transition-all border whitespace-nowrap flex-shrink-0 ${
                  isActive
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-secondary/40 text-muted-foreground border-transparent hover:bg-secondary/70"
                }`}
              >
                {label}
              </button>
            );
          })}
          </div>
          <ExportReportButton selectedMonths={selectedMonths} selectedYear={selectedYear} />
        </div>
      </AppHeader>

      {/* Content */}
      <main className="container max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {bootLoading ? (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Skeleton className="h-24 w-full rounded-xl" />
              <Skeleton className="h-24 w-full rounded-xl" />
              <Skeleton className="h-24 w-full rounded-xl" />
            </div>
            <Skeleton className="h-64 w-full rounded-xl" />
            <Skeleton className="h-48 w-full rounded-xl" />
          </div>
        ) : (
          <div className="animate-in fade-in duration-300">
            {activeTab === "calendar" && (
              <>
                <div className="hidden lg:block">
                  <EvolutionChart selectedYear={selectedYear} />
                </div>
                <CalendarView initialMonth={selectedMonths.length === 1 ? selectedMonths[0] : null} selectedYear={selectedYear} isViewer={isViewer} />
              </>
            )}
            {activeTab === "categories" && <CategoriesView selectedMonths={selectedMonths} selectedYear={selectedYear} isViewer={isViewer} />}
            {activeTab === "clientes" && <ClientsView selectedMonths={selectedMonths} selectedYear={selectedYear} isViewer={isViewer} />}
            {activeTab === "lancamento" && <TransactionForm />}
            {activeTab === "dados" && <DadosView selectedMonths={selectedMonths} selectedYear={selectedYear} isViewer={isViewer} />}
          </div>
        )}
      </main>

      {/* Mobile Bottom Navigation */}
      {isMobile && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border backdrop-blur-sm safe-area-bottom">
          <div className="flex items-center justify-around h-14">
            {mobileTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = tab.id === "chat" ? showMobileChat : activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    if (tab.id === "chat") {
                      setShowMobileChat(!showMobileChat);
                    } else {
                      setShowMobileChat(false);
                      setActiveTab(tab.id as Tab);
                    }
                  }}
                  className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors ${
                    isActive ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? "text-primary" : ""}`} />
                  <span className="text-[10px] font-medium">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      )}

      {/* AI Chat: floating on desktop, controlled by tab on mobile */}
      {isMobile ? (
        showMobileChat && <AIChatWidget forceOpen onClose={() => setShowMobileChat(false)} />
      ) : (
        <AIChatWidget />
      )}
      <NotificationBanner />
    </div>
  );
};

export default Index;
