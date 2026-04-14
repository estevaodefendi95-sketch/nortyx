import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import {
  type Transaction,
  type DailyIncome,
  type FormaPagamento,
  type RecurrenceType,
} from "@/data/cashflow";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/context/OrganizationContext";

async function fetchAllFromTable(
  table: "transactions" | "daily_incomes",
  orderCol: string,
  organizationId: string,
) {
  const PAGE_SIZE = 1000;
  let allData: any[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .eq("organization_id", organizationId)
      .order(orderCol, { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;
    if (!data || data.length === 0) {
      hasMore = false;
    } else {
      allData = [...allData, ...data];
      from += PAGE_SIZE;
      if (data.length < PAGE_SIZE) hasMore = false;
    }
  }

  return allData;
}

interface TransactionsContextType {
  transactions: Transaction[];
  dailyIncomes: DailyIncome[];
  addTransaction: (t: Omit<Transaction, "id">) => Promise<boolean>;
  addDailyIncome: (d: DailyIncome) => Promise<boolean>;
  updateTransaction: (id: number, updates: Partial<Transaction>) => void;
  deleteTransaction: (id: number) => void;
  updateDailyIncome: (id: number, updates: Partial<DailyIncome>) => void;
  deleteDailyIncome: (id: number) => void;
  deleteTransactionsByDateRange: (startDate: string, endDate: string) => void;
  deleteDailyIncomesByDateRange: (startDate: string, endDate: string) => void;
  reassignCategory: (fromCode: string, toCode: string) => void;
  deleteRecurringFromDate: (groupId: string, fromDate: string) => void;
  isLoading: boolean;
}

const TransactionsContext = createContext<TransactionsContextType | null>(null);

export const useTransactions = () => {
  const ctx = useContext(TransactionsContext);
  if (!ctx) throw new Error("useTransactions must be used within TransactionsProvider");
  return ctx;
};

const isIsoDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);
const isBrDate = (value: string) => /^\d{2}\/\d{2}\/\d{4}$/.test(value);

const normalizeDate = (value: string) => {
  if (!value) return value;
  if (isBrDate(value)) return value;
  if (isIsoDate(value)) {
    const [year, month, day] = value.split("-");
    return `${day}/${month}/${year}`;
  }
  return value;
};

const mapTransactionRow = (r: any): Transaction => ({
  id: Number(r.id),
  empresa: r.empresa,
  valor: Number(r.valor),
  data: normalizeDate(r.data),
  categoria: r.categoria,
  subcategoria: r.subcategoria || null,
  pago: r.pago,
  agendado: r.agendado,
  tipo: r.tipo as "saida" | "entrada",
  forma_pagamento: (r.forma_pagamento as FormaPagamento) || null,
  pix_code: r.pix_code || null,
  recurrence_type: (r.recurrence_type as RecurrenceType) || null,
  recurrence_group_id: r.recurrence_group_id || null,
});

const mapDailyIncomeRow = (r: any): DailyIncome => ({
  id: Number(r.id),
  data: normalizeDate(r.data),
  valor: Number(r.valor),
});

const parseDate = (d: string) => {
  if (isIsoDate(d)) return d;
  const [day, month, year] = d.split("/");
  return `${year}-${month}-${day}`;
};

export const TransactionsProvider = ({ children }: { children: ReactNode }) => {
  const { user, loading: authLoading } = useAuth();
  const { organization } = useOrganization();
  const orgId = organization?.id;
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [incomes, setIncomes] = useState<DailyIncome[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    if (!user || !orgId) {
      setTxns([]);
      setIncomes([]);
      setIsLoading(false);
      return;
    }

    const loadData = async () => {
      setIsLoading(true);
      try {
        const [txData, incData] = await Promise.all([
          fetchAllFromTable("transactions", "id", orgId),
          fetchAllFromTable("daily_incomes", "id", orgId),
        ]);

        setTxns(txData.map(mapTransactionRow));
        setIncomes(incData.map(mapDailyIncomeRow));
      } catch (err) {
        console.error("Failed to load from database:", err);
        setTxns([]);
        setIncomes([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [user, authLoading, orgId]);

  useEffect(() => {
    if (!orgId) return;

    const txChannel = supabase
      .channel(`transactions-realtime-${orgId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "transactions" },
        (payload) => {
          const payloadOrgId = (payload.new as any)?.organization_id ?? (payload.old as any)?.organization_id;
          if (payloadOrgId !== orgId) return;

          if (payload.eventType === "INSERT") {
            setTxns((prev) => {
              if (prev.some((t) => t.id === Number(payload.new.id))) return prev;
              return [...prev, mapTransactionRow(payload.new)];
            });
          } else if (payload.eventType === "UPDATE") {
            setTxns((prev) =>
              prev.map((t) => (t.id === Number(payload.new.id) ? mapTransactionRow(payload.new) : t))
            );
          } else if (payload.eventType === "DELETE") {
            setTxns((prev) => prev.filter((t) => t.id !== Number(payload.old.id)));
          }
        }
      )
      .subscribe();

    const incChannel = supabase
      .channel(`daily-incomes-realtime-${orgId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "daily_incomes" },
        (payload) => {
          const payloadOrgId = (payload.new as any)?.organization_id ?? (payload.old as any)?.organization_id;
          if (payloadOrgId !== orgId) return;

          if (payload.eventType === "INSERT") {
            setIncomes((prev) => {
              const newId = Number(payload.new.id);
              if (prev.some((i) => i.id === newId)) return prev;
              return [...prev, mapDailyIncomeRow(payload.new)];
            });
          } else if (payload.eventType === "UPDATE") {
            setIncomes((prev) =>
              prev.map((i) =>
                i.id === Number(payload.new.id)
                  ? mapDailyIncomeRow(payload.new)
                  : i
              )
            );
          } else if (payload.eventType === "DELETE") {
            setIncomes((prev) => prev.filter((i) => i.id !== Number(payload.old.id)));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(txChannel);
      supabase.removeChannel(incChannel);
    };
  }, [orgId]);

  const logAudit = useCallback(async (action: string, tableName: string, recordId: string, oldData?: any, newData?: any) => {
    try {
      await supabase.from("audit_log").insert({
        action,
        table_name: tableName,
        record_id: String(recordId),
        old_data: oldData || null,
        new_data: newData || null,
        user_email: user?.email || null,
        organization_id: orgId,
      } as any);
    } catch (e) {
      console.error("Audit log error:", e);
    }
  }, [user, orgId]);

  const addTransaction = useCallback(async (t: Omit<Transaction, "id">) => {
    if (!orgId) return false;

    const tempId = Date.now() + Math.random();
    const normalizedTransaction = { ...t, data: normalizeDate(t.data) };
    const optimisticTx: Transaction = { ...normalizedTransaction, id: tempId };
    setTxns((prev) => [...prev, optimisticTx]);

    const { data, error } = await supabase
      .from("transactions")
      .insert({
        empresa: normalizedTransaction.empresa,
        valor: normalizedTransaction.valor,
        data: normalizedTransaction.data,
        categoria: normalizedTransaction.categoria,
        subcategoria: normalizedTransaction.subcategoria || null,
        pago: normalizedTransaction.pago,
        agendado: normalizedTransaction.agendado,
        tipo: normalizedTransaction.tipo,
        forma_pagamento: normalizedTransaction.forma_pagamento || null,
        pix_code: normalizedTransaction.pix_code || null,
        recurrence_type: normalizedTransaction.recurrence_type || null,
        recurrence_group_id: normalizedTransaction.recurrence_group_id || null,
        organization_id: orgId,
      } as any)
      .select()
      .single();

    if (error) {
      console.error("Error adding transaction:", error);
      setTxns((prev) => prev.filter((tx) => tx.id !== tempId));
      return false;
    }

    if (data) {
      const mapped = mapTransactionRow(data);
      setTxns((prev) => {
        const replaced = prev.map((tx) => (tx.id === tempId ? mapped : tx));
        return replaced.filter((tx, index, arr) => arr.findIndex((item) => item.id === tx.id) === index);
      });
      logAudit("INSERT", "transactions", String(data.id), null, mapped);
    }
    return true;
  }, [logAudit, orgId]);

  const updateTransaction = useCallback(async (id: number, updates: Partial<Transaction>) => {
    const oldTx = txns.find((t) => t.id === id);
    const normalizedUpdates = updates.data ? { ...updates, data: normalizeDate(updates.data) } : updates;
    setTxns((prev) => prev.map((t) => (t.id === id ? { ...t, ...normalizedUpdates } : t)));

    const { id: _removedId, ...dbUpdates } = normalizedUpdates as any;
    const { error } = await supabase
      .from("transactions")
      .update(dbUpdates)
      .eq("id", id);

    if (error) {
      console.error("Error updating transaction:", error);
    } else {
      logAudit("UPDATE", "transactions", String(id), oldTx, { ...oldTx, ...normalizedUpdates });
    }
  }, [txns, logAudit]);

  const deleteTransaction = useCallback(async (id: number) => {
    const oldTx = txns.find((t) => t.id === id);
    setTxns((prev) => prev.filter((t) => t.id !== id));

    const { error } = await supabase
      .from("transactions")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting transaction:", error);
    } else {
      logAudit("DELETE", "transactions", String(id), oldTx, null);
    }
  }, [txns, logAudit]);

  const deleteTransactionsByDateRange = useCallback(async (startDate: string, endDate: string) => {
    if (!orgId) return;

    setTxns((prev) => prev.filter((t) => {
      const iso = parseDate(t.data);
      return iso < startDate || iso > endDate;
    }));

    const allTxns = await fetchAllFromTable("transactions", "id", orgId) as any[];
    if (allTxns) {
      const idsToDelete = allTxns
        .filter((t) => {
          const iso = parseDate(t.data);
          return iso >= startDate && iso <= endDate;
        })
        .map((t) => t.id);

      if (idsToDelete.length > 0) {
        await supabase.from("transactions").delete().in("id", idsToDelete);
      }
    }
  }, [orgId]);

  const deleteDailyIncomesByDateRange = useCallback(async (startDate: string, endDate: string) => {
    if (!orgId) return;

    setIncomes((prev) => prev.filter((i) => {
      const iso = parseDate(i.data);
      return iso < startDate || iso > endDate;
    }));

    const allInc = await fetchAllFromTable("daily_incomes", "id", orgId) as any[];
    if (allInc) {
      const idsToDelete = allInc
        .filter((i) => {
          const iso = parseDate(i.data);
          return iso >= startDate && iso <= endDate;
        })
        .map((i) => i.id);

      if (idsToDelete.length > 0) {
        await supabase.from("daily_incomes").delete().in("id", idsToDelete);
      }
    }
  }, [orgId]);

  const addDailyIncome = useCallback(async (d: DailyIncome) => {
    if (!orgId) return false;

    const tempId = Date.now() + Math.random();
    const normalizedIncome = { ...d, data: normalizeDate(d.data) };
    const optimistic = { ...normalizedIncome, id: tempId };
    setIncomes((prev) => [...prev, optimistic]);

    const { data, error } = await supabase
      .from("daily_incomes")
      .insert({ data: normalizedIncome.data, valor: normalizedIncome.valor, organization_id: orgId } as any)
      .select()
      .single();

    if (error) {
      console.error("Error adding daily income:", error);
      setIncomes((prev) => prev.filter((i) => i.id !== tempId));
      return false;
    }

    if (data) {
      const mapped = mapDailyIncomeRow(data);
      setIncomes((prev) => {
        const replaced = prev.map((i) => i.id === tempId ? mapped : i);
        return replaced.filter((i, index, arr) => arr.findIndex((item) => item.id === i.id) === index);
      });
    }
    return true;
  }, [orgId]);

  const reassignCategory = useCallback((fromCode: string, toCode: string) => {
    setTxns((prev) =>
      prev.map((t) => (t.categoria === fromCode ? { ...t, categoria: toCode } : t))
    );
  }, []);

  const updateDailyIncome = useCallback(async (id: number, updates: Partial<DailyIncome>) => {
    const normalizedUpdates = updates.data ? { ...updates, data: normalizeDate(updates.data) } : updates;
    setIncomes((prev) => prev.map((i) => (i.id === id ? { ...i, ...normalizedUpdates } : i)));

    const { id: _removedId, ...dbUpdates } = normalizedUpdates as any;
    const { error } = await supabase
      .from("daily_incomes")
      .update(dbUpdates)
      .eq("id", id);

    if (error) {
      console.error("Error updating daily income:", error);
    }
  }, []);

  const deleteDailyIncome = useCallback(async (id: number) => {
    setIncomes((prev) => prev.filter((i) => i.id !== id));

    const { error } = await supabase
      .from("daily_incomes")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting daily income:", error);
    }
  }, []);

  const deleteRecurringFromDate = useCallback(async (groupId: string, fromDate: string) => {
    const toDelete = txns.filter(t => 
      t.recurrence_group_id === groupId && parseDate(t.data) >= fromDate
    );
    const idsToDelete = toDelete.map(t => t.id);
    
    setTxns(prev => prev.filter(t => !idsToDelete.includes(t.id)));
    
    if (idsToDelete.length > 0) {
      await supabase.from("transactions").delete().in("id", idsToDelete);
      logAudit("DELETE_RECURRING", "transactions", groupId, { count: idsToDelete.length }, null);
    }
  }, [txns, logAudit]);

  return (
    <TransactionsContext.Provider
      value={{
        transactions: txns,
        dailyIncomes: incomes,
        addTransaction,
        addDailyIncome,
        updateTransaction,
        deleteTransaction,
        updateDailyIncome,
        deleteDailyIncome,
        deleteTransactionsByDateRange,
        deleteDailyIncomesByDateRange,
        reassignCategory,
        deleteRecurringFromDate,
        isLoading,
      }}
    >
      {children}
    </TransactionsContext.Provider>
  );
};