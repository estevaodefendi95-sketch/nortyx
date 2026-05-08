import { useState, useMemo, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, getIncomeByMonth, type Transaction, type DailyIncome } from "@/data/cashflow";
import { useCategories } from "@/context/CategoriesContext";
import { useTransactions } from "@/context/TransactionsContext";
import { useOrganization } from "@/context/OrganizationContext";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, CheckCircle2, Clock, AlertCircle, ArrowUp, ArrowDown, Pencil, Check, X, Scale, CalendarDays, Trash2, ChevronDown, ChevronUp as ChevronUpIcon, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";

const DAYS_PT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTHS_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

interface CalendarViewProps {
  initialMonth?: number | null;
  selectedYear: number;
  isViewer?: boolean;
}

const CalendarView = ({ initialMonth, selectedYear: propYear, isViewer = false }: CalendarViewProps) => {
  const { transactions, dailyIncomes, deleteTransaction, updateTransaction, updateDailyIncome, deleteDailyIncome } = useTransactions();
  const { categories, getCategoryInfo, getCategoryColor } = useCategories();
  const { organization } = useOrganization();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const dayScrollerRef = useRef<HTMLDivElement>(null);
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(initialMonth != null ? initialMonth : today.getMonth());
  const [currentYear, setCurrentYear] = useState(propYear);
  const [selectedDay, setSelectedDay] = useState<number | null>(
    (initialMonth == null || initialMonth === today.getMonth()) && propYear === today.getFullYear() ? today.getDate() : null
  );

  // Sync year from parent prop
  useEffect(() => {
    setCurrentYear(propYear);
    setSelectedDay(null);
  }, [propYear]);

  // Collapse state for income entries
  const [incomeCollapsed, setIncomeCollapsed] = useState(true);

  const [editingIncomeId, setEditingIncomeId] = useState<number | null>(null);
  const [editIncomeValue, setEditIncomeValue] = useState("");

  // Billing charges with client info for current month
  interface BillingChargeWithClient {
    id: string;
    valor: number;
    data_cobranca: string;
    status: string;
    client_name: string;
    boleto_url: string | null;
    nf_url: string | null;
  }
  const [billingCharges, setBillingCharges] = useState<BillingChargeWithClient[]>([]);

  useEffect(() => {
    if (!organization?.id) {
      setBillingCharges([]);
      return;
    }
    let cancelled = false;
    const orgId = organization.id;
    const fetchBillingCharges = async () => {
      const { data } = await supabase
        .from("billing_charges")
        .select("id, valor, data_cobranca, status, boleto_url, nf_url, billing_clients(nome)")
        .eq("organization_id", orgId)
        .order("data_cobranca");
      if (!cancelled && data) {
        setBillingCharges(
          data.map((c: any) => ({
            id: c.id,
            valor: c.valor,
            data_cobranca: c.data_cobranca,
            status: c.status,
            client_name: c.billing_clients?.nome || "Cliente",
            boleto_url: c.boleto_url ?? null,
            nf_url: c.nf_url ?? null,
          }))
        );
      }
    };
    fetchBillingCharges();
    const channel = supabase
      .channel(`billing_charges_calendar_${orgId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "billing_charges" }, () => fetchBillingCharges())
      .on("postgres_changes", { event: "*", schema: "public", table: "billing_clients" }, () => fetchBillingCharges())
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [currentMonth, currentYear, organization?.id]);

  // Editable transaction overrides
  const [txOverrides, setTxOverrides] = useState<Map<number, { empresa?: string; valor?: number; pago?: boolean; data?: string }>>(new Map());
  const [editingTxId, setEditingTxId] = useState<number | null>(null);
  const [editTxEmpresa, setEditTxEmpresa] = useState("");
  const [editTxValor, setEditTxValor] = useState("");

  const getEffectiveIncomeValue = (_date: string, originalValue: number) => {
    return originalValue;
  };

  const getEffectiveTx = (t: Transaction) => {
    const override = txOverrides.get(t.id);
    return {
      ...t,
      empresa: override?.empresa ?? t.empresa,
      valor: override?.valor ?? t.valor,
      pago: override?.pago ?? t.pago,
      data: override?.data ?? t.data,
    };
  };

  // Expenses by day (considering date overrides)
  const dailyExpenses = useMemo(() => {
    const map = new Map<number, Transaction[]>();
    transactions.filter(t => t.tipo === "saida").forEach((t) => {
      const effectiveDate = txOverrides.get(t.id)?.data ?? t.data;
      const [day, month, year] = effectiveDate.split("/").map(Number);
      if (month - 1 === currentMonth && year === currentYear) {
        if (!map.has(day)) map.set(day, []);
        map.get(day)!.push(t);
      }
    });
    return map;
  }, [transactions, currentMonth, currentYear, txOverrides]);

  // Income by day
  const dailyIncomeMap = useMemo(() => {
    const map = new Map<number, { id?: number; date: string; valor: number }[]>();
    dailyIncomes.forEach((i) => {
      const parts = i.data.split("/").map(Number);
      const day = parts[0];
      const month = parts[1];
      const year = parts[2];
      if (month - 1 === currentMonth && year === currentYear) {
        if (!map.has(day)) map.set(day, []);
        map.get(day)!.push({ id: i.id, date: i.data, valor: i.valor });
      }
    });
    return map;
  }, [dailyIncomes, currentMonth, currentYear]);

  const getDayIncomeTotal = (day: number) => {
    const entries = dailyIncomeMap.get(day);
    const billingEntries = billingChargesByDay.get(day);
    let total = entries ? entries.reduce((sum, e) => sum + e.valor, 0) : 0;
    if (billingEntries) total += billingEntries.reduce((sum, c) => sum + c.valor, 0);
    return total;
  };

  const getDayExpenseTotal = (day: number) => {
    const txs = dailyExpenses.get(day);
    if (!txs) return 0;
    return txs.reduce((s, t) => s + (txOverrides.get(t.id)?.valor ?? t.valor), 0);
  };

  const monthExpenseTotal = useMemo(() => {
    let total = 0;
    dailyExpenses.forEach((txs) => txs.forEach((t) => {
      total += (txOverrides.get(t.id)?.valor ?? t.valor);
    }));
    return total;
  }, [dailyExpenses, txOverrides]);

  // Billing charges by day for current month
  const billingChargesByDay = useMemo(() => {
    const map = new Map<number, BillingChargeWithClient[]>();
    billingCharges.forEach((c) => {
      const parts = c.data_cobranca.split("/").map(Number);
      const day = parts[0];
      const month = parts[1];
      const year = parts[2];
      if (month - 1 === currentMonth && year === currentYear) {
        if (!map.has(day)) map.set(day, []);
        map.get(day)!.push(c);
      }
    });
    return map;
  }, [billingCharges, currentMonth, currentYear]);

  const monthIncomeTotal = useMemo(() => {
    let total = 0;
    dailyIncomeMap.forEach((entries) => entries.forEach((e) => (total += e.valor)));
    // Add billing charges for this month
    billingChargesByDay.forEach((charges) => charges.forEach((c) => (total += c.valor)));
    return total;
  }, [dailyIncomeMap, billingChargesByDay]);

  const paidTotal = useMemo(() => {
    let total = 0;
    dailyExpenses.forEach((txs) => txs.forEach((t) => {
      const isPaid = txOverrides.get(t.id)?.pago ?? t.pago;
      if (isPaid) total += (txOverrides.get(t.id)?.valor ?? t.valor);
    }));
    return total;
  }, [dailyExpenses, txOverrides]);

  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < firstDayOfMonth; i++) calendarDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarDays.push(d);

  // Calculate previous month's ending balance
  const previousMonthEndBalance = useMemo(() => {
    let balance = 0;
    // Sum all incomes before current month/year
    dailyIncomes.forEach((i) => {
      const parts = i.data.split("/").map(Number);
      const month = parts[1] - 1;
      const year = parts[2];
      if (year < currentYear || (year === currentYear && month < currentMonth)) {
        balance += getEffectiveIncomeValue(i.data, i.valor);
      }
    });
    // Subtract all expenses before current month/year
    transactions.filter(t => t.tipo === "saida").forEach((t) => {
      const effectiveDate = txOverrides.get(t.id)?.data ?? t.data;
      const parts = effectiveDate.split("/").map(Number);
      const month = parts[1] - 1;
      const year = parts[2];
      if (year < currentYear || (year === currentYear && month < currentMonth)) {
        balance -= (txOverrides.get(t.id)?.valor ?? t.valor);
      }
    });
    // Add billing charges from previous months
    billingCharges.forEach((c) => {
      const parts = c.data_cobranca.split("/").map(Number);
      const month = parts[1] - 1;
      const year = parts[2];
      if (year < currentYear || (year === currentYear && month < currentMonth)) {
        balance += c.valor;
      }
    });
    return balance;
  }, [currentMonth, currentYear, dailyIncomes, transactions, txOverrides, billingCharges]);

  // Cumulative balance: each day carries forward from the previous day, starting with previous month's balance
  const cumulativeBalance = useMemo(() => {
    const balances = new Map<number, number>();
    let running = previousMonthEndBalance;
    for (let d = 1; d <= daysInMonth; d++) {
      const income = getDayIncomeTotal(d);
      const expense = getDayExpenseTotal(d);
      running += income - expense;
      balances.set(d, running);
    }
    return balances;
  }, [daysInMonth, dailyIncomeMap, dailyExpenses, txOverrides, previousMonthEndBalance, billingChargesByDay]);

  const isToday = (day: number) => {
    return day === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear();
  };

  const selectedTransactions = selectedDay ? (dailyExpenses.get(selectedDay) || []).map(getEffectiveTx) : [];
  const selectedIncomeEntries = selectedDay ? dailyIncomeMap.get(selectedDay) || [] : [];
  const selectedIncomeTotal = selectedIncomeEntries.reduce((s, e) => s + e.valor, 0);
  const selectedBillingCharges = selectedDay ? billingChargesByDay.get(selectedDay) || [] : [];

  const minYear = today.getFullYear() - 2;
  const maxYear = today.getFullYear() + 2;

  const prevMonth = () => {
    setSelectedDay(null);
    if (currentMonth === 0) {
      if (currentYear > minYear) { setCurrentMonth(11); setCurrentYear(currentYear - 1); }
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };
  const nextMonth = () => {
    setSelectedDay(null);
    if (currentMonth === 11) {
      if (currentYear < maxYear) { setCurrentMonth(0); setCurrentYear(currentYear + 1); }
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const saldo = monthIncomeTotal - monthExpenseTotal;

  const startEditIncome = (id: number, currentVal: number) => {
    setEditingIncomeId(id);
    setEditIncomeValue(currentVal.toString());
  };

  const saveEditIncome = () => {
    if (editingIncomeId === null) return;
    const val = parseFloat(editIncomeValue);
    if (isNaN(val) || val < 0) {
      toast({ title: "Valor inválido", variant: "destructive" });
      return;
    }
    updateDailyIncome(editingIncomeId, { valor: val });
    setEditingIncomeId(null);
    toast({ title: "Entrada atualizada" });
  };

  const handleDeleteIncome = (id: number) => {
    deleteDailyIncome(id);
    toast({ title: "Entrada excluída" });
  };

  const startEditTx = (t: Transaction) => {
    const effective = getEffectiveTx(t);
    setEditingTxId(t.id);
    setEditTxEmpresa(effective.empresa);
    setEditTxValor(effective.valor.toString());
  };

  const saveEditTx = () => {
    if (editingTxId === null) return;
    const val = parseFloat(editTxValor);
    if (isNaN(val) || val < 0) {
      toast({ title: "Valor inválido", variant: "destructive" });
      return;
    }
    updateTransaction(editingTxId, { empresa: editTxEmpresa, valor: val });
    setTxOverrides((prev) => {
      const newMap = new Map(prev);
      newMap.delete(editingTxId);
      return newMap;
    });
    setEditingTxId(null);
    toast({ title: "Saída atualizada" });
  };

  const togglePago = (txId: number) => {
    const originalTx = transactions.find(t => t.id === txId);
    if (!originalTx) return;
    const currentPago = txOverrides.get(txId)?.pago ?? originalTx.pago;
    const currentAgendado = originalTx.agendado;

    let updates: Partial<Transaction>;
    if (currentPago) {
      // Pago → Pendente
      updates = { pago: false, agendado: false };
    } else if (currentAgendado) {
      // Agendado → Pago
      updates = { pago: true, agendado: false };
    } else {
      // Pendente → Agendado
      updates = { pago: false, agendado: true };
    }

    updateTransaction(txId, updates);
    setTxOverrides((prev) => {
      const newMap = new Map(prev);
      newMap.delete(txId);
      return newMap;
    });
    toast({ title: "Status atualizado" });
  };

  const updateTxDate = (txId: number, newDate: string) => {
    if (!newDate) return;
    const [y, m, d] = newDate.split("-");
    const formatted = `${d}/${m}/${y}`;
    updateTransaction(txId, { data: formatted });
    setTxOverrides((prev) => {
      const newMap = new Map(prev);
      newMap.delete(txId);
      return newMap;
    });
    toast({ title: "Data atualizada" });
  };

  const cancelEdit = () => {
    setEditingIncomeId(null);
    setEditingTxId(null);
  };

  const updateTxCategory = (txId: number, newCategory: string) => {
    updateTransaction(txId, { categoria: newCategory });
    toast({ title: "Categoria atualizada" });
  };

  const handleDeleteTransaction = (id: number) => {
    deleteTransaction(id);
    toast({ title: "Lançamento cancelado" });
  };

  // Helper: convert DD/MM/YYYY to YYYY-MM-DD for input[type=date]
  const toInputDate = (ddmmyyyy: string) => {
    const [d, m, y] = ddmmyyyy.split("/");
    return `${y}-${m}-${d}`;
  };

  // Auto-scroll day picker to today on mobile
  useEffect(() => {
    if (isMobile && dayScrollerRef.current && currentMonth === today.getMonth() && currentYear === today.getFullYear()) {
      const todayBtn = dayScrollerRef.current.querySelector(`[data-day="${today.getDate()}"]`) as HTMLElement;
      if (todayBtn) {
        todayBtn.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
      }
    }
  }, [isMobile, currentMonth]);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 lg:gap-4">
        <div className="rounded-xl bg-card p-3 sm:p-4 lg:p-5 border border-border overflow-hidden">
          <p className="text-xs sm:text-sm text-muted-foreground mb-1">Entradas</p>
          <p className="text-lg sm:text-base md:text-lg lg:text-2xl font-display font-bold text-income break-all">{formatCurrency(monthIncomeTotal)}</p>
        </div>
        <div className="rounded-xl bg-card p-3 sm:p-4 lg:p-5 border border-border overflow-hidden">
          <p className="text-xs sm:text-sm text-muted-foreground mb-1">Saídas</p>
          <p className="text-lg sm:text-base md:text-lg lg:text-2xl font-display font-bold text-expense break-all">{formatCurrency(monthExpenseTotal)}</p>
        </div>
        <div className="rounded-xl bg-card p-3 sm:p-4 lg:p-5 border border-border overflow-hidden">
          <p className="text-xs sm:text-sm text-muted-foreground mb-1">Saldo</p>
          <p className={`text-lg sm:text-base md:text-lg lg:text-2xl font-display font-bold break-all ${saldo >= 0 ? "text-income" : "text-expense"}`}>
            {formatCurrency(saldo)}
          </p>
        </div>
        <div className="rounded-xl bg-card p-3 sm:p-4 lg:p-5 border border-border overflow-hidden">
          <p className="text-xs sm:text-sm text-muted-foreground mb-1">Pendente</p>
          <p className="text-lg sm:text-base md:text-lg lg:text-2xl font-display font-bold text-warning break-all">{formatCurrency(monthExpenseTotal - paidTotal)}</p>
        </div>
      </div>

      {isMobile ? (
        /* ===== MOBILE: Day picker + details ===== */
        <div className="space-y-4">
          {/* Month + Day selector */}
          <div className="rounded-xl bg-card border border-border p-4">
            <div className="flex items-center justify-between mb-3">
              <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-secondary transition-colors" disabled={currentMonth === 0 && currentYear <= minYear}>
                <ChevronLeft className="w-5 h-5 text-muted-foreground" />
              </button>
              <h2 className="text-lg font-display font-semibold">
                {MONTHS_PT[currentMonth]} {currentYear}
              </h2>
              <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-secondary transition-colors" disabled={currentMonth === 11 && currentYear >= maxYear}>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            {/* Horizontal day scroller */}
            <div ref={dayScrollerRef} className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                const dayIncome = getDayIncomeTotal(day);
                const dayExpense = getDayExpenseTotal(day);
                const hasData = dayIncome > 0 || dayExpense > 0;
                const isSelected = selectedDay === day;
                const isTodayDay = isToday(day);
                const dayOfWeek = DAYS_PT[new Date(currentYear, currentMonth, day).getDay()];

                return (
                  <button
                    key={day}
                    data-day={day}
                    onClick={() => setSelectedDay(day)}
                    className={`
                      flex flex-col items-center min-w-[3rem] px-2 py-2 rounded-lg transition-all flex-shrink-0
                      ${isSelected
                        ? "bg-primary/15 border-2 border-primary/40"
                        : isTodayDay
                        ? "bg-accent/30 border-2 border-primary"
                        : "border border-border/50 hover:bg-secondary/50"
                      }
                      ${!hasData && !isTodayDay && !isSelected ? "opacity-40" : ""}
                    `}
                  >
                    <span className="text-[10px] text-muted-foreground">{dayOfWeek}</span>
                    <span className={`text-sm font-bold ${isTodayDay && !isSelected ? "text-primary" : isSelected ? "text-primary" : ""}`}>{day}</span>
                    {hasData && (
                      <div className="flex gap-0.5 mt-0.5 items-center">
                        {dayIncome > 0 && <div className="w-1.5 h-1.5 rounded-full bg-income" />}
                        {dayExpense > 0 && <div className="w-1.5 h-1.5 rounded-full bg-expense" />}
                        {billingChargesByDay.has(day) && <User className="w-2 h-2 text-income" />}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Day Details - inline on mobile */}
          <div className="rounded-xl bg-card border border-border p-4">
            {selectedDay ? (
              <>
                <h3 className="font-display font-semibold text-lg mb-3">
                  {selectedDay} de {MONTHS_PT[currentMonth]}
                </h3>

                {/* Day summary */}
                {(() => {
                  const dayExpTotal = selectedTransactions.reduce((s, t) => s + t.valor, 0);
                  const saldoInicialDay = (selectedDay! > 1 ? (cumulativeBalance.get(selectedDay! - 1) ?? 0) : previousMonthEndBalance) + selectedIncomeTotal;
                  const saldoDoDia = cumulativeBalance.get(selectedDay!) ?? 0;
                  return (
                    <div className="grid grid-cols-2 gap-2 mb-4">
                      <div className={`rounded-lg p-2 border ${saldoInicialDay >= 0 ? 'bg-muted/30 border-border' : 'bg-expense/10 border-expense/20'}`}>
                        <p className="text-[10px] text-muted-foreground">Saldo Inicial</p>
                        <p className={`text-sm font-bold ${saldoInicialDay >= 0 ? 'text-foreground' : 'text-expense'}`}>{formatCurrency(saldoInicialDay)}</p>
                      </div>
                      <div className="rounded-lg bg-income/10 p-2 border border-income/20">
                        <p className="text-[10px] text-muted-foreground">Entradas</p>
                        <p className="text-sm font-bold text-income">{formatCurrency(selectedIncomeTotal)}</p>
                      </div>
                      <div className="rounded-lg bg-expense/10 p-2 border border-expense/20">
                        <p className="text-[10px] text-muted-foreground">Saídas</p>
                        <p className="text-sm font-bold text-expense">{formatCurrency(dayExpTotal)}</p>
                      </div>
                      <div className={`rounded-lg p-2 border ${saldoDoDia >= 0 ? 'bg-income/10 border-income/20' : 'bg-expense/10 border-expense/20'}`}>
                        <p className="text-[10px] text-muted-foreground">Saldo do Dia</p>
                        <p className={`text-sm font-bold ${saldoDoDia >= 0 ? 'text-income' : 'text-expense'}`}>{formatCurrency(saldoDoDia)}</p>
                      </div>
                    </div>
                  );
                })()}

                {/* Income Entries */}
                {selectedIncomeEntries.length > 0 && (
                  <>
                    <button
                      onClick={() => setIncomeCollapsed(!incomeCollapsed)}
                      className="flex items-center justify-between w-full text-xs text-muted-foreground mb-2 uppercase tracking-wider hover:text-foreground transition-colors"
                    >
                      <span>Entradas ({selectedIncomeEntries.length})</span>
                      {incomeCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUpIcon className="w-4 h-4" />}
                    </button>
                    {!incomeCollapsed && (
                      <div className="space-y-2 mb-4">
                        {selectedIncomeEntries.map((entry, idx) => (
                          <div key={`income-${idx}`} className="flex items-center justify-between p-3 rounded-lg bg-income/5 border border-income/20">
                            {editingIncomeId === entry.id && !isViewer ? (
                              <div className="flex items-center gap-2 w-full">
                                <Input type="number" step="0.01" value={editIncomeValue} onChange={(e) => setEditIncomeValue(e.target.value)} className="h-8 text-sm flex-1" autoFocus onKeyDown={(e) => { if (e.key === "Enter") saveEditIncome(); if (e.key === "Escape") cancelEdit(); }} />
                                <button onClick={saveEditIncome} className="p-1 rounded hover:bg-income/20 text-income"><Check className="w-4 h-4" /></button>
                                <button onClick={cancelEdit} className="p-1 rounded hover:bg-secondary text-muted-foreground"><X className="w-4 h-4" /></button>
                              </div>
                            ) : (
                              <>
                                <div className="flex items-center gap-2">
                                  <ArrowUp className="w-4 h-4 text-income" />
                                  <span className="text-xs text-muted-foreground">{entry.date}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold text-income">{formatCurrency(entry.valor)}</span>
                                  {entry.id != null && !isViewer && (
                                    <>
                                      <button onClick={() => startEditIncome(entry.id!, entry.valor)} className="p-1 rounded hover:bg-secondary text-muted-foreground"><Pencil className="w-3.5 h-3.5" /></button>
                                      <button onClick={() => handleDeleteIncome(entry.id!)} className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                                    </>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {incomeCollapsed && <div className="mb-4" />}
                  </>
                )}

                {/* Billing Charges */}
                {selectedBillingCharges.length > 0 && (
                  <>
                    <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">Cobranças</p>
                    <div className="space-y-2 mb-4">
                      {selectedBillingCharges.map((charge) => (
                        <div key={charge.id} className="flex items-center justify-between p-3 rounded-lg bg-income/5 border border-income/20">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-income" />
                            <span className="text-sm font-medium">{charge.client_name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-income">{formatCurrency(charge.valor)}</span>
                            <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${charge.status === "paga" ? "border-primary/30 text-primary" : charge.status === "atrasado" ? "border-destructive/30 text-destructive" : "border-warning/30 text-warning"}`}>
                              {charge.status === "paga" ? "Pago" : charge.status === "atrasado" ? "Atrasado" : "Pendente"}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* Expense Entries */}
                {selectedTransactions.length > 0 && (
                  <>
                    <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">Saídas</p>
                    <div className="space-y-2">
                      {selectedTransactions.map((t) => {
                        const cat = getCategoryInfo(t.categoria);
                        const isEditing = editingTxId === t.id && !isViewer;
                        if (isEditing) {
                          return (
                            <div key={t.id} className="p-3 rounded-lg bg-secondary/50 border border-primary/30 space-y-2">
                              <Input value={editTxEmpresa} onChange={(e) => setEditTxEmpresa(e.target.value)} className="h-8 text-sm" placeholder="Empresa" autoFocus />
                              <div className="flex items-center gap-2">
                                <Input type="number" step="0.01" value={editTxValor} onChange={(e) => setEditTxValor(e.target.value)} className="h-8 text-sm flex-1" placeholder="Valor" onKeyDown={(e) => { if (e.key === "Enter") saveEditTx(); if (e.key === "Escape") cancelEdit(); }} />
                                <button onClick={saveEditTx} className="p-1.5 rounded hover:bg-primary/20 text-primary"><Check className="w-4 h-4" /></button>
                                <button onClick={cancelEdit} className="p-1.5 rounded hover:bg-secondary text-muted-foreground"><X className="w-4 h-4" /></button>
                              </div>
                            </div>
                          );
                        }
                        return (
                          <div key={t.id} className="p-3 rounded-lg bg-secondary/50 border border-border/50">
                            <div className="flex items-start justify-between">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: getCategoryColor(cat.code) }} />
                                  <span className="text-sm font-medium truncate">{t.empresa}</span>
                                </div>
                                <Select value={t.categoria} onValueChange={(val) => updateTxCategory(t.id, val)} disabled={isViewer}>
                                  <SelectTrigger className="h-6 text-[10px] px-1.5 py-0 w-auto min-w-[80px] max-w-[140px]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {categories.map((c) => (
                                      <SelectItem key={c.code} value={c.code} className="text-xs">{c.name}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                {t.forma_pagamento && (
                                  <div className="flex items-center gap-1 mt-1">
                                    <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                                      {t.forma_pagamento === "pix" ? "PIX" : t.forma_pagamento === "boleto" ? "Boleto" : t.forma_pagamento === "transferencia" ? "Transf." : "Cartão"}
                                    </Badge>
                                    {t.forma_pagamento === "pix" && t.pix_code && (
                                      <span className="text-[9px] text-muted-foreground break-all">
                                        {t.pix_code}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                                <span className="text-sm font-semibold text-expense">{formatCurrency(t.valor)}</span>
                                {!isViewer && (
                                  <>
                                    <button onClick={() => startEditTx(t)} className="p-1 rounded hover:bg-secondary text-muted-foreground"><Pencil className="w-3.5 h-3.5" /></button>
                                    <button onClick={() => handleDeleteTransaction(t.id)} className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                                  </>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/30">
                              <button onClick={() => !isViewer && togglePago(t.id)} disabled={isViewer} className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium transition-all border ${t.pago ? "bg-primary/15 border-primary/30 text-primary" : t.agendado ? "bg-warning/15 border-warning/30 text-warning" : "bg-expense/10 border-expense/20 text-expense"} ${isViewer ? "cursor-default" : ""}`}>
                                {t.pago ? <><CheckCircle2 className="w-3 h-3" /> Pago</> : t.agendado ? <><Clock className="w-3 h-3" /> Agendado</> : <><AlertCircle className="w-3 h-3" /> Pendente</>}
                              </button>
                              <Input type="date" value={toInputDate(t.data)} onChange={(e) => updateTxDate(t.id, e.target.value)} className="h-7 text-[11px] w-[130px] px-2" disabled={isViewer} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center text-center py-8">
                <CalendarDays className="w-10 h-10 text-muted-foreground mb-3" />
                <p className="text-muted-foreground text-sm">Selecione um dia acima</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ===== DESKTOP: Full calendar grid + side panel ===== */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar */}
          <div className="lg:col-span-2 rounded-xl bg-card border border-border p-5">
            <div className="flex items-center justify-between mb-6">
              <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-secondary transition-colors" disabled={currentMonth === 0 && currentYear <= minYear}>
                <ChevronLeft className="w-5 h-5 text-muted-foreground" />
              </button>
              <h2 className="text-xl font-display font-semibold">
                {MONTHS_PT[currentMonth]} {currentYear}
              </h2>
              <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-secondary transition-colors" disabled={currentMonth === 11 && currentYear >= maxYear}>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 mb-2">
              {DAYS_PT.map((d) => (
                <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day, i) => {
                if (day === null) return <div key={`empty-${i}`} />;
                const dayIncome = getDayIncomeTotal(day);
                const dayExpense = getDayExpenseTotal(day);
                const cumBal = cumulativeBalance.get(day) ?? 0;
                const isSelected = selectedDay === day;
                const isTodayDay = isToday(day);
                const hasData = dayIncome > 0 || dayExpense > 0;

                const saldoInicial = (day > 1 ? (cumulativeBalance.get(day - 1) ?? 0) : previousMonthEndBalance) + dayIncome;

                return (
                  <button
                    key={day}
                    onClick={() => setSelectedDay(day)}
                    className={`
                      relative p-1.5 rounded-lg text-left transition-all min-h-[100px] group
                      ${isSelected ? "bg-primary/15 border-2 border-primary/40 glow-primary" : isTodayDay ? "bg-accent/30 border-2 border-primary ring-2 ring-primary/20" : "hover:bg-secondary border border-transparent"}
                      ${hasData ? "cursor-pointer" : "cursor-default opacity-50"}
                    `}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-medium ${isTodayDay ? "bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center" : isSelected ? "text-primary" : "text-foreground"}`}>{day}</span>
                      {billingChargesByDay.has(day) && <User className="w-3 h-3 text-income" />}
                    </div>
                    {hasData && (
                      <div className="mt-0.5 space-y-0">
                        <p className={`text-[9px] font-medium truncate ${saldoInicial >= 0 ? "text-muted-foreground" : "text-expense/70"}`}>
                          SI: {formatCurrency(saldoInicial)}
                        </p>
                        {dayIncome > 0 && (
                          <p className="text-[9px] font-medium text-income truncate">
                            E: {formatCurrency(dayIncome)}
                          </p>
                        )}
                        {dayExpense > 0 && (
                          <p className="text-[9px] font-medium text-expense truncate">
                            S: {formatCurrency(dayExpense)}
                          </p>
                        )}
                        <p className={`text-[9px] font-semibold truncate ${cumBal >= 0 ? "text-income/70" : "text-expense/70"}`}>
                          SD: {formatCurrency(cumBal)}
                        </p>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Day Details */}
          <div className="rounded-xl bg-card border border-border p-5 max-h-[700px] overflow-y-auto">
            {selectedDay ? (
              <>
                <h3 className="font-display font-semibold text-lg mb-1">
                  {selectedDay} de {MONTHS_PT[currentMonth]}
                </h3>

                {/* Day summary */}
                {(() => {
                  const dayExpTotal = selectedTransactions.reduce((s, t) => s + t.valor, 0);
                  const saldoInicialDay = (selectedDay! > 1 ? (cumulativeBalance.get(selectedDay! - 1) ?? 0) : previousMonthEndBalance) + selectedIncomeTotal;
                  const saldoDoDia = cumulativeBalance.get(selectedDay!) ?? 0;
                  return (
                    <div className="grid grid-cols-2 gap-2 mb-4">
                      <div className={`rounded-lg p-2 border ${saldoInicialDay >= 0 ? 'bg-muted/30 border-border' : 'bg-expense/10 border-expense/20'}`}>
                        <p className="text-[10px] text-muted-foreground">Saldo Inicial</p>
                        <p className={`text-sm font-bold ${saldoInicialDay >= 0 ? 'text-foreground' : 'text-expense'}`}>{formatCurrency(saldoInicialDay)}</p>
                      </div>
                      {selectedIncomeTotal > 0 && (
                        <div className="rounded-lg bg-income/10 p-2 border border-income/20">
                          <p className="text-[10px] text-muted-foreground">Entradas</p>
                          <p className="text-sm font-bold text-income">{formatCurrency(selectedIncomeTotal)}</p>
                        </div>
                      )}
                      <div className="rounded-lg bg-expense/10 p-2 border border-expense/20">
                        <p className="text-[10px] text-muted-foreground">Saídas</p>
                        <p className="text-sm font-bold text-expense">{formatCurrency(dayExpTotal)}</p>
                      </div>
                      <div className={`rounded-lg p-2 border ${saldoDoDia >= 0 ? 'bg-income/10 border-income/20' : 'bg-expense/10 border-expense/20'}`}>
                        <p className="text-[10px] text-muted-foreground">Saldo do Dia</p>
                        <p className={`text-sm font-bold ${saldoDoDia >= 0 ? 'text-income' : 'text-expense'}`}>{formatCurrency(saldoDoDia)}</p>
                      </div>
                    </div>
                  );
                })()}

                {/* Editable Income Entries */}
                {selectedIncomeEntries.length > 0 && (
                  <>
                    <button
                      onClick={() => setIncomeCollapsed(!incomeCollapsed)}
                      className="flex items-center justify-between w-full text-xs text-muted-foreground mb-2 uppercase tracking-wider hover:text-foreground transition-colors"
                    >
                      <span>Entradas ({selectedIncomeEntries.length})</span>
                      {incomeCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUpIcon className="w-4 h-4" />}
                    </button>
                    {!incomeCollapsed && (
                      <div className="space-y-2 mb-4">
                        {selectedIncomeEntries.map((entry, idx) => (
                          <div key={`income-${idx}`} className="flex items-center justify-between p-3 rounded-lg bg-income/5 border border-income/20">
                            {editingIncomeId === entry.id && !isViewer ? (
                              <div className="flex items-center gap-2 w-full">
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={editIncomeValue}
                                  onChange={(e) => setEditIncomeValue(e.target.value)}
                                  className="h-8 text-sm flex-1"
                                  autoFocus
                                  onKeyDown={(e) => { if (e.key === "Enter") saveEditIncome(); if (e.key === "Escape") cancelEdit(); }}
                                />
                                <button onClick={saveEditIncome} className="p-1 rounded hover:bg-income/20 text-income"><Check className="w-4 h-4" /></button>
                                <button onClick={cancelEdit} className="p-1 rounded hover:bg-secondary text-muted-foreground"><X className="w-4 h-4" /></button>
                              </div>
                            ) : (
                              <>
                                <div className="flex items-center gap-2">
                                  <ArrowUp className="w-4 h-4 text-income" />
                                  <span className="text-xs text-muted-foreground">{entry.date}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold text-income">{formatCurrency(entry.valor)}</span>
                                  {entry.id != null && !isViewer && (
                                    <>
                                      <button onClick={() => startEditIncome(entry.id!, entry.valor)} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                                        <Pencil className="w-3.5 h-3.5" />
                                      </button>
                                      <button onClick={() => handleDeleteIncome(entry.id!)} className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors">
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {incomeCollapsed && <div className="mb-4" />}
                  </>
                )}

                {/* Billing Charges */}
                {selectedBillingCharges.length > 0 && (
                  <>
                    <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">Cobranças</p>
                    <div className="space-y-2 mb-4">
                      {selectedBillingCharges.map((charge) => (
                        <div key={charge.id} className="flex items-center justify-between p-3 rounded-lg bg-income/5 border border-income/20">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-income" />
                            <span className="text-sm font-medium">{charge.client_name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-income">{formatCurrency(charge.valor)}</span>
                            <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${charge.status === "paga" ? "border-primary/30 text-primary" : charge.status === "atrasado" ? "border-destructive/30 text-destructive" : "border-warning/30 text-warning"}`}>
                              {charge.status === "paga" ? "Pago" : charge.status === "atrasado" ? "Atrasado" : "Pendente"}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* Editable Expense Entries */}
                {selectedTransactions.length > 0 && (
                  <>
                    <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">Saídas</p>
                    <div className="space-y-2">
                      {selectedTransactions.map((t) => {
                        const cat = getCategoryInfo(t.categoria);
                        const isEditing = editingTxId === t.id && !isViewer;

                        if (isEditing) {
                          return (
                            <div key={t.id} className="p-3 rounded-lg bg-secondary/50 border border-primary/30 space-y-2">
                              <Input value={editTxEmpresa} onChange={(e) => setEditTxEmpresa(e.target.value)} className="h-8 text-sm" placeholder="Empresa" autoFocus />
                              <div className="flex items-center gap-2">
                                <Input type="number" step="0.01" value={editTxValor} onChange={(e) => setEditTxValor(e.target.value)} className="h-8 text-sm flex-1" placeholder="Valor" onKeyDown={(e) => { if (e.key === "Enter") saveEditTx(); if (e.key === "Escape") cancelEdit(); }} />
                                <button onClick={saveEditTx} className="p-1.5 rounded hover:bg-primary/20 text-primary"><Check className="w-4 h-4" /></button>
                                <button onClick={cancelEdit} className="p-1.5 rounded hover:bg-secondary text-muted-foreground"><X className="w-4 h-4" /></button>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div key={t.id} className="p-3 rounded-lg bg-secondary/50 border border-border/50 group">
                            <div className="flex items-start justify-between">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: getCategoryColor(cat.code) }} />
                                  <span className="text-sm font-medium truncate">{t.empresa}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Select value={t.categoria} onValueChange={(val) => updateTxCategory(t.id, val)} disabled={isViewer}>
                                    <SelectTrigger className="h-6 text-[10px] px-1.5 py-0 w-auto min-w-[80px] max-w-[140px]">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {categories.map((c) => (
                                        <SelectItem key={c.code} value={c.code} className="text-xs">{c.name}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                {t.forma_pagamento && (
                                  <div className="flex items-center gap-1 mt-1">
                                    <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                                      {t.forma_pagamento === "pix" ? "PIX" : t.forma_pagamento === "boleto" ? "Boleto" : t.forma_pagamento === "transferencia" ? "Transf." : "Cartão"}
                                    </Badge>
                                    {t.forma_pagamento === "pix" && t.pix_code && (
                                      <span className="text-[9px] text-muted-foreground break-all">
                                        {t.pix_code}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                                <span className="text-sm font-semibold text-expense">{formatCurrency(t.valor)}</span>
                                {!isViewer && (
                                  <>
                                    <button onClick={() => startEditTx(t)} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-all">
                                      <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    <button onClick={() => handleDeleteTransaction(t.id)} className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all">
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>

                            {/* Status toggle + date */}
                            <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/30">
                              <button
                                onClick={() => !isViewer && togglePago(t.id)}
                                disabled={isViewer}
                                className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium transition-all border ${
                                  t.pago
                                    ? "bg-primary/15 border-primary/30 text-primary"
                                    : t.agendado
                                    ? "bg-warning/15 border-warning/30 text-warning"
                                    : "bg-expense/10 border-expense/20 text-expense"
                                } ${isViewer ? "cursor-default" : ""}`}
                              >
                                {t.pago ? (
                                  <><CheckCircle2 className="w-3 h-3" /> Pago</>
                                ) : t.agendado ? (
                                  <><Clock className="w-3 h-3" /> Agendado</>
                                ) : (
                                  <><AlertCircle className="w-3 h-3" /> Pendente</>
                                )}
                              </button>
                              <Input
                                type="date"
                                value={toInputDate(t.data)}
                                onChange={(e) => updateTxDate(t.id, e.target.value)}
                                className="h-7 text-[11px] w-[130px] px-2"
                                disabled={isViewer}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4">
                  <span className="text-2xl">📅</span>
                </div>
                <p className="text-muted-foreground text-sm">Selecione um dia no calendário para ver os detalhes</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CalendarView;
