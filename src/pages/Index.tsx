import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { CalendarDays, Tags, Plus, ArrowUpDown, Camera, X, BarChart3, Bell, LogOut, Shield, Clock, Sparkles, History, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import CalendarView from "@/components/CalendarView";
import CategoriesView from "@/components/CategoriesView";
import TransactionForm from "@/components/TransactionForm";
import EvolutionChart from "@/components/EvolutionChart";
import DadosView from "@/components/DadosView";
import ThemeToggle from "@/components/ThemeToggle";
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
  const { signOut, isAdmin, isViewer } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { visibleTabs } = useTabVisibility();
  const { logoUrl: companyLogo, companyName } = useOrgBranding();
  const { membership } = useOrganization();
  const pendingBills = useMemo(() => getPendingBills(), [getPendingBills]);
  const [pendingUsersCount, setPendingUsersCount] = useState(0);
  const [activeTab, setActiveTab] = useState<Tab>("dados");
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [selectedMonths, setSelectedMonths] = useState<number[]>([new Date().getMonth()]);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  // Extract available years from data
  const availableYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years: number[] = [];
    for (let y = currentYear - 2; y <= currentYear + 2; y++) {
      years.push(y);
    }
    return years.sort((a, b) => b - a);
  }, []);
  const [companyName, setCompanyName] = useState(() => localStorage.getItem("companyName") || "PAGGIO");
  const [companyLogo, setCompanyLogo] = useState<string | null>(() => localStorage.getItem("companyLogo"));
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState(companyName);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Fetch pending users count for admin badge
  useEffect(() => {
    if (!isAdmin) return;
    const fetchPending = async () => {
      const { count } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("approved", false);
      setPendingUsersCount(count ?? 0);
    };
    fetchPending();
    const interval = setInterval(fetchPending, 30000);
    return () => clearInterval(interval);
  }, [isAdmin]);

  useEffect(() => {
    localStorage.setItem("companyName", companyName);
  }, [companyName]);

  useEffect(() => {
    if (companyLogo) localStorage.setItem("companyLogo", companyLogo);
    else localStorage.removeItem("companyLogo");
  }, [companyLogo]);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setCompanyLogo(reader.result as string);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const saveCompanyName = () => {
    if (editNameValue.trim()) {
      setCompanyName(editNameValue.trim());
    }
    setIsEditingName(false);
  };

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

    const expenses = transactions
      .filter((t) => t.tipo === "saida" && matchMonth(t.data))
      .reduce((sum, t) => sum + t.valor, 0);

    return { filteredIncome: income, filteredExpenses: expenses };
  }, [selectedMonths, isAllSelected, transactions, dailyIncomes, selectedYear]);

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
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-2">
            {/* Logo + Name */}
            <div className="flex items-center gap-3 min-w-0">
              {/* Company Logo */}
              <div className="relative group">
                <button
                  onClick={() => !isViewer && logoInputRef.current?.click()}
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg border border-border bg-secondary/50 flex items-center justify-center overflow-hidden hover:border-primary/50 transition-colors flex-shrink-0"
                >
                  {companyLogo ? (
                    <img src={companyLogo} alt="Logo" className="w-full h-full object-cover" />
                  ) : (
                    <Camera className="w-4 h-4 text-muted-foreground" />
                  )}
                </button>
                {companyLogo && !isViewer && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setCompanyLogo(null); }}
                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                )}
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLogoUpload}
                />
              </div>

              <div className="min-w-0">
                {isEditingName && !isViewer ? (
                  <Input
                    value={editNameValue}
                    onChange={(e) => setEditNameValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") saveCompanyName(); if (e.key === "Escape") setIsEditingName(false); }}
                    className="h-7 w-28 sm:w-32 text-base sm:text-lg font-bold text-primary"
                    autoFocus
                    onBlur={saveCompanyName}
                  />
                ) : (
                  <button
                    onClick={() => { if (!isViewer) { setEditNameValue(companyName); setIsEditingName(true); } }}
                    className="text-xl sm:text-2xl font-display font-bold transition-colors cursor-pointer truncate text-primary"
                    title={isViewer ? companyName : "Clique para editar o nome"}
                  >
                    {companyName}
                  </button>
                )}
              </div>
            </div>

            {/* Action icons - always top right */}
            <div className="flex items-center gap-1 flex-shrink-0">
              {/* Bell notification */}
              <Popover>
                <PopoverTrigger asChild>
                  <button className="relative p-2 rounded-lg hover:bg-secondary transition-colors flex-shrink-0">
                    <Bell className="w-5 h-5 text-muted-foreground" />
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
                        Total: <span className="text-warning font-medium">{formatCurrency(pendingBills.reduce((s, t) => s + t.valor, 0))}</span>
                      </p>
                    )}
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {pendingBills.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">Nenhuma conta pendente 🎉</p>
                    ) : (
                      pendingBills.map((t) => (
                        <div key={t.id} className="flex items-center justify-between px-3 py-2 border-b border-border/30 last:border-0">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{t.empresa}</p>
                            <p className="text-[11px] text-muted-foreground">{t.data}</p>
                          </div>
                          <span className="text-sm font-semibold text-expense ml-2 flex-shrink-0">{formatCurrency(t.valor)}</span>
                        </div>
                      ))
                    )}
                  </div>
                </PopoverContent>
              </Popover>

              <ThemeToggle />

              {isAdmin && (
                <>
                  <button
                    onClick={() => navigate("/admin/history")}
                    className="p-2 rounded-lg hover:bg-secondary transition-colors flex-shrink-0"
                    title="Histórico de Alterações"
                  >
                    <History className="w-5 h-5 text-muted-foreground" />
                  </button>
                  <button
                    onClick={() => navigate("/admin")}
                    className={`relative p-2 rounded-lg hover:bg-secondary transition-colors flex-shrink-0 ${pendingUsersCount > 0 ? 'border border-primary/30' : ''}`}
                    title="Gerenciar Usuários"
                  >
                    <Shield className="w-5 h-5 text-primary" />
                    {pendingUsersCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-primary animate-pulse" />
                    )}
                  </button>
                </>
              )}

              <button
                onClick={signOut}
                className="p-2 rounded-lg hover:bg-secondary transition-colors flex-shrink-0"
                title="Sair"
              >
                <LogOut className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
          </div>

          {/* Summary row - below header on all sizes */}
          <div className="flex items-center gap-2 sm:gap-4 mt-1.5 flex-wrap">
            <span className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1">
              <ArrowUpDown className="w-3 h-3 sm:w-3.5 sm:h-3.5 hidden sm:inline" />
              <span className="text-income font-medium">{formatCurrency(filteredIncome)}</span>
            </span>
            <span className="text-xs sm:text-sm text-muted-foreground">
              <span className="text-expense font-medium">{formatCurrency(filteredExpenses)}</span>
            </span>
            <span className="text-xs sm:text-sm text-muted-foreground">
              Saldo: <span className={`font-medium ${saldo >= 0 ? "text-income" : "text-expense"}`}>{formatCurrency(saldo)}</span>
            </span>
          </div>

          {/* Desktop tabs */}
          {!isMobile && (
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
          )}

          {/* Year + Month Multi-Select Filter */}
          <div className="flex items-center gap-1.5 mt-2.5 sm:mt-3 overflow-x-auto pb-1 scrollbar-hide">
            {/* Year selector - popover */}
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
        </div>
      </header>

      {/* Content */}
      <main className="container max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6">
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
