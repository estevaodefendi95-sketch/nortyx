import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTransactions } from "@/context/TransactionsContext";
import { formatCurrency } from "@/data/cashflow";
import { History, RotateCcw, ChevronLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import AppHeader from "@/components/AppHeader";

interface AuditEntry {
  id: number;
  action: string;
  table_name: string;
  record_id: string;
  old_data: any;
  new_data: any;
  user_email: string | null;
  created_at: string;
}

const ACTION_LABELS: Record<string, string> = {
  INSERT: "Criou",
  UPDATE: "Editou",
  DELETE: "Excluiu",
};

const TABLE_LABELS: Record<string, string> = {
  transactions: "Transação",
  daily_incomes: "Entrada",
  products: "Produto",
};

const AdminHistory = () => {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [reverting, setReverting] = useState<number | null>(null);

  const loadLogs = useCallback(async () => {
    const { data, error } = await supabase
      .from("audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error("Error loading audit log:", error);
    } else {
      setLogs((data || []) as unknown as AuditEntry[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isAdmin) loadLogs();
  }, [isAdmin, loadLogs]);

  const revertChange = async (entry: AuditEntry) => {
    setReverting(entry.id);
    try {
      if (entry.action === "DELETE" && entry.old_data) {
        // Re-insert deleted record
        const { id, ...rest } = entry.old_data;
        if (entry.table_name === "transactions") {
          await supabase.from("transactions").insert({
            empresa: rest.empresa,
            valor: rest.valor,
            data: rest.data,
            categoria: rest.categoria,
            subcategoria: rest.subcategoria || null,
            pago: rest.pago,
            agendado: rest.agendado,
            tipo: rest.tipo,
            forma_pagamento: rest.forma_pagamento || null,
            pix_code: rest.pix_code || null,
          });
        } else if (entry.table_name === "daily_incomes") {
          await supabase.from("daily_incomes").insert({
            data: rest.data,
            valor: rest.valor,
          });
        }
        toast({ title: "Registro restaurado com sucesso" });
      } else if (entry.action === "UPDATE" && entry.old_data) {
        // Restore to old values
        const { id, ...rest } = entry.old_data;
        if (entry.table_name === "transactions") {
          const { id: _id, ...dbData } = rest;
          await supabase.from("transactions").update(dbData).eq("id", Number(entry.record_id));
        } else if (entry.table_name === "daily_incomes") {
          const { id: _id, ...dbData } = rest;
          await supabase.from("daily_incomes").update(dbData).eq("id", Number(entry.record_id));
        }
        toast({ title: "Alteração revertida com sucesso" });
      } else if (entry.action === "INSERT") {
        // Delete the inserted record
        if (entry.table_name === "transactions") {
          await supabase.from("transactions").delete().eq("id", Number(entry.record_id));
        } else if (entry.table_name === "daily_incomes") {
          await supabase.from("daily_incomes").delete().eq("id", Number(entry.record_id));
        }
        toast({ title: "Lançamento removido com sucesso" });
      }

      // Log the revert itself
      await supabase.from("audit_log").insert({
        action: "REVERT",
        table_name: entry.table_name,
        record_id: entry.record_id,
        old_data: entry.new_data,
        new_data: entry.old_data,
        user_email: "admin (revert)",
      });

      loadLogs();
    } catch (e) {
      console.error("Revert error:", e);
      toast({ title: "Erro ao reverter", variant: "destructive" });
    } finally {
      setReverting(null);
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  const getDescription = (entry: AuditEntry) => {
    const data = entry.action === "DELETE" ? entry.old_data : entry.new_data;
    if (!data) return entry.record_id;
    if (entry.table_name === "transactions") {
      return `${data.empresa || "?"} - ${formatCurrency(Number(data.valor || 0))} (${data.data || "?"})`;
    }
    if (entry.table_name === "daily_incomes") {
      return `Entrada ${formatCurrency(Number(data.valor || 0))} (${data.data || "?"})`;
    }
    return data.nome || entry.record_id;
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Acesso restrito a administradores</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader backTo="/" title="Histórico de Alterações" containerClassName="max-w-4xl" />

      <main className="container max-w-4xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12">
            <History className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">Nenhuma alteração registrada ainda</p>
          </div>
        ) : (
          <div className="space-y-2">
            {logs.map((entry) => (
              <div
                key={entry.id}
                className="rounded-xl bg-card border border-border p-4 flex items-start justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      entry.action === "INSERT" ? "bg-income/15 text-income" :
                      entry.action === "DELETE" ? "bg-expense/15 text-expense" :
                      entry.action === "REVERT" ? "bg-primary/15 text-primary" :
                      "bg-warning/15 text-warning"
                    }`}>
                      {ACTION_LABELS[entry.action] || entry.action}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {TABLE_LABELS[entry.table_name] || entry.table_name}
                    </span>
                    <span className="text-[10px] text-muted-foreground/70">
                      {formatDate(entry.created_at)}
                    </span>
                  </div>
                  <p className="text-sm font-medium truncate">{getDescription(entry)}</p>
                  {entry.user_email && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">por {entry.user_email}</p>
                  )}
                  {entry.action === "UPDATE" && entry.old_data && entry.new_data && (
                    <div className="mt-2 text-[11px] text-muted-foreground space-y-0.5">
                      {Object.keys(entry.new_data).filter((k) => k !== "id" && JSON.stringify(entry.old_data[k]) !== JSON.stringify(entry.new_data[k])).map((key) => (
                        <p key={key}>
                          <span className="font-medium">{key}:</span>{" "}
                          <span className="text-expense line-through">{String(entry.old_data[key] ?? "—")}</span>{" → "}
                          <span className="text-income">{String(entry.new_data[key] ?? "—")}</span>
                        </p>
                      ))}
                    </div>
                  )}
                </div>
                {entry.action !== "REVERT" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-shrink-0 h-8 text-xs gap-1"
                    onClick={() => revertChange(entry)}
                    disabled={reverting === entry.id}
                  >
                    {reverting === entry.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <RotateCcw className="w-3 h-3" />
                    )}
                    Reverter
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminHistory;
