import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTransactions } from "@/context/TransactionsContext";
import { useCategories } from "@/context/CategoriesContext";
import { useOrganization } from "@/context/OrganizationContext";
import type { ExpenseCategoryRow, ClientIncomeRow } from "@/lib/pdfReport";
import { dedupeChargesAgainstIncomes, dedupeDailyIncomes } from "@/lib/incomeDedup";

interface BillingClientRow {
  id: string;
  nome: string;
}
interface BillingChargeRow {
  id: string;
  client_id: string;
  valor: number;
  data_cobranca: string;
  status: string;
}

const MONTHS_FULL = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export interface ReportData {
  totals: { income: number; expenses: number; balance: number };
  expensesByCategory: ExpenseCategoryRow[];
  incomesByClient: ClientIncomeRow[];
  periodLabel: string;
}

export function useReportData(selectedMonths: number[], selectedYear: number): ReportData {
  const { transactions, dailyIncomes } = useTransactions();
  const { categories, getCategoryColor, getCategoryInfo } = useCategories();
  const { organization } = useOrganization();
  const [clients, setClients] = useState<BillingClientRow[]>([]);
  const [charges, setCharges] = useState<BillingChargeRow[]>([]);

  useEffect(() => {
    if (!organization?.id) {
      setClients([]); setCharges([]);
      return;
    }
    let active = true;
    (async () => {
      const [cRes, chRes] = await Promise.all([
        supabase.from("billing_clients").select("id, nome").eq("organization_id", organization.id),
        supabase.from("billing_charges").select("id, client_id, valor, data_cobranca, status").eq("organization_id", organization.id),
      ]);
      if (!active) return;
      setClients(((cRes.data as any) || []) as BillingClientRow[]);
      setCharges(((chRes.data as any) || []).map((c: any) => ({
        ...c,
        valor: Number(c.valor) || 0,
      })));
    })();
    return () => { active = false; };
  }, [organization?.id]);

  return useMemo(() => {
    const isAll = selectedMonths.length === 0;
    const matchMonth = (dateStr: string) => {
      const [, month, year] = dateStr.split("/").map(Number);
      if (year !== selectedYear) return false;
      return isAll || selectedMonths.includes(month - 1);
    };

    const expenses = transactions.filter((t) => t.tipo === "saida" && matchMonth(t.data));
    const totalExpenses = expenses.reduce((s, t) => s + t.valor, 0);

    const filteredDaily = dedupeDailyIncomes(dailyIncomes.filter((i) => matchMonth(i.data)));
    const totalDaily = filteredDaily.reduce((s, i) => s + i.valor, 0);

    const filteredCharges = charges.filter((c) => matchMonth(c.data_cobranca));
    // Evitar duplicação: se já existe um daily_income com mesma data+valor, a cobrança não soma novamente
    const dedupedForTotal = dedupeChargesAgainstIncomes(filteredCharges, filteredDaily);
    const chargesIncome = dedupedForTotal.reduce((s, c) => s + c.valor, 0);
    const totalIncome = totalDaily + chargesIncome;

    // Group by category
    const byCat = new Map<string, { total: number; count: number; descriptions: string[] }>();
    expenses.forEach((t) => {
      const e = byCat.get(t.categoria) || { total: 0, count: 0, descriptions: [] };
      e.total += t.valor;
      e.count += 1;
      if (e.descriptions.length < 5 && t.empresa && !e.descriptions.includes(t.empresa)) {
        e.descriptions.push(t.empresa);
      }
      byCat.set(t.categoria, e);
    });

    const expensesByCategory: ExpenseCategoryRow[] = Array.from(byCat.entries())
      .map(([code, v]) => {
        const info = getCategoryInfo(code) || { code, name: code, colorVar: "chart-other" };
        return {
          code,
          label: info.name,
          color: getCategoryColor(info.colorVar) || "#9ca3af",
          total: v.total,
          count: v.count,
          sampleDescriptions: v.descriptions,
        };
      })
      .sort((a, b) => b.total - a.total);

    // Group charges by client
    const byClient = new Map<string, { total: number; paid: number; count: number; paidCount: number }>();
    filteredCharges.forEach((c) => {
      const e = byClient.get(c.client_id) || { total: 0, paid: 0, count: 0, paidCount: 0 };
      e.total += c.valor;
      e.count += 1;
      if (c.status === "paga") {
        e.paid += c.valor;
        e.paidCount += 1;
      }
      byClient.set(c.client_id, e);
    });

    const clientNameById = new Map(clients.map((c) => [c.id, c.nome]));
    const incomesByClient: ClientIncomeRow[] = Array.from(byClient.entries())
      .map(([clientId, v]) => {
        let status: ClientIncomeRow["status"] = "Pendente";
        if (v.count === 0) status = "Sem cobranças";
        else if (v.paidCount === v.count) status = "Recebido";
        else if (v.paidCount > 0) status = "Parcial";
        return {
          name: clientNameById.get(clientId) || "Cliente",
          total: v.total,
          status,
        };
      })
      .sort((a, b) => b.total - a.total);

    // Period label
    let periodLabel: string;
    if (isAll) {
      periodLabel = `Período: Ano de ${selectedYear}`;
    } else {
      const months = [...selectedMonths].sort((a, b) => a - b);
      const first = months[0];
      const last = months[months.length - 1];
      const lastDay = new Date(selectedYear, last + 1, 0).getDate();
      const pad = (n: number) => String(n).padStart(2, "0");
      const start = `01/${pad(first + 1)}/${selectedYear}`;
      const end = `${pad(lastDay)}/${pad(last + 1)}/${selectedYear}`;
      if (months.length === 1) {
        periodLabel = `Período: ${MONTHS_FULL[first]} de ${selectedYear} (${start} a ${end})`;
      } else {
        periodLabel = `Período: ${start} a ${end}`;
      }
    }

    return {
      totals: { income: totalIncome, expenses: totalExpenses, balance: totalIncome - totalExpenses },
      expensesByCategory,
      incomesByClient,
      periodLabel,
    };
  }, [selectedMonths, selectedYear, transactions, dailyIncomes, charges, clients, categories, getCategoryColor, getCategoryInfo]);
}
