import { useState, useRef, useEffect, useMemo } from "react";
import { MessageCircle, X, Send, Loader2, Trash2, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useTransactions } from "@/context/TransactionsContext";
import { formatCurrency } from "@/data/cashflow";

type Msg = { role: "user" | "assistant"; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

interface AIChatWidgetProps {
  forceOpen?: boolean;
  onClose?: () => void;
}

const AIChatWidget = ({ forceOpen, onClose }: AIChatWidgetProps = {}) => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { transactions, dailyIncomes } = useTransactions();

  const financialContext = useMemo(() => {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    // Current month data
    const monthTx = transactions.filter((t) => {
      const [, m, y] = t.data.split("/").map(Number);
      return m === month && y === year;
    });
    const monthInc = dailyIncomes.filter((i) => {
      const [, m, y] = i.data.split("/").map(Number);
      return m === month && y === year;
    });

    const totalIncome = monthInc.reduce((s, i) => s + i.valor, 0);
    const totalExpense = monthTx.filter((t) => t.tipo === "saida").reduce((s, t) => s + t.valor, 0);
    const pending = monthTx.filter((t) => !t.pago && t.tipo === "saida");
    const paid = monthTx.filter((t) => t.pago && t.tipo === "saida");

    // Category breakdown
    const catSummary: Record<string, number> = {};
    monthTx.filter((t) => t.tipo === "saida").forEach((t) => {
      catSummary[t.categoria] = (catSummary[t.categoria] || 0) + t.valor;
    });
    const topCats = Object.entries(catSummary)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([cat, val]) => `${cat}: ${formatCurrency(val)}`)
      .join(", ");

    // Top suppliers current month
    const supplierMap: Record<string, number> = {};
    monthTx.filter((t) => t.tipo === "saida").forEach((t) => {
      supplierMap[t.empresa] = (supplierMap[t.empresa] || 0) + t.valor;
    });
    const topSuppliers = Object.entries(supplierMap)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([name, val]) => `${name}: ${formatCurrency(val)}`)
      .join(", ");

    // Previous month
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const prevTx = transactions.filter((t) => {
      const [, m, y] = t.data.split("/").map(Number);
      return m === prevMonth && y === prevYear;
    });
    const prevInc = dailyIncomes.filter((i) => {
      const [, m, y] = i.data.split("/").map(Number);
      return m === prevMonth && y === prevYear;
    });
    const prevTotalIncome = prevInc.reduce((s, i) => s + i.valor, 0);
    const prevTotalExpense = prevTx.filter((t) => t.tipo === "saida").reduce((s, t) => s + t.valor, 0);

    // ALL pending bills (any month)
    const allPending = transactions.filter((t) => t.tipo === "saida" && !t.pago);
    const allPendingDetails = allPending
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 20)
      .map((t) => `${t.empresa} (${t.data}): ${formatCurrency(t.valor)} [${t.categoria}] ${t.agendado ? "Agendado" : "Pendente"}`)
      .join("\n  ");

    // ALL paid bills (complete history for lookup)
    const allPaid = transactions.filter((t) => t.tipo === "saida" && t.pago);
    const allPaidDetails = allPaid
      .sort((a, b) => {
        const [da, ma, ya] = a.data.split("/").map(Number);
        const [db, mb, yb] = b.data.split("/").map(Number);
        return new Date(yb, mb - 1, db).getTime() - new Date(ya, ma - 1, da).getTime();
      })
      .slice(0, 50)
      .map((t) => `${t.empresa} (${t.data}): ${formatCurrency(t.valor)} [${t.categoria}] ✅ Pago${t.forma_pagamento ? ` via ${t.forma_pagamento}` : ""}`)
      .join("\n  ");

    // Monthly summary for last 6 months
    const monthlySummary: string[] = [];
    for (let i = 0; i < 6; i++) {
      const m = ((month - 1 - i + 12) % 12) + 1;
      const y = month - 1 - i < 0 ? year - 1 : year;
      const mTx = transactions.filter((t) => {
        const [, tm, ty] = t.data.split("/").map(Number);
        return tm === m && ty === y;
      });
      const mInc = dailyIncomes.filter((inc) => {
        const [, tm, ty] = inc.data.split("/").map(Number);
        return tm === m && ty === y;
      });
      const mRec = mInc.reduce((s, inc) => s + inc.valor, 0);
      const mDesp = mTx.filter((t) => t.tipo === "saida").reduce((s, t) => s + t.valor, 0);
      if (mRec > 0 || mDesp > 0) {
        monthlySummary.push(`${String(m).padStart(2, "0")}/${y}: Receita ${formatCurrency(mRec)}, Despesa ${formatCurrency(mDesp)}, Saldo ${formatCurrency(mRec - mDesp)}`);
      }
    }

    // Supplier full history (for "when did I pay X" queries)
    const supplierHistory: Record<string, { data: string; valor: number; pago: boolean; categoria: string }[]> = {};
    transactions.filter((t) => t.tipo === "saida").forEach((t) => {
      if (!supplierHistory[t.empresa]) supplierHistory[t.empresa] = [];
      supplierHistory[t.empresa].push({ data: t.data, valor: t.valor, pago: t.pago, categoria: t.categoria });
    });
    const supplierHistoryStr = Object.entries(supplierHistory)
      .sort(([, a], [, b]) => b.length - a.length)
      .slice(0, 30)
      .map(([name, entries]) => {
        const sorted = entries.sort((a, b) => {
          const [da, ma, ya] = a.data.split("/").map(Number);
          const [db, mb, yb] = b.data.split("/").map(Number);
          return new Date(yb, mb - 1, db).getTime() - new Date(ya, ma - 1, da).getTime();
        });
        const details = sorted.slice(0, 5).map((e) => `${e.data}: ${formatCurrency(e.valor)} ${e.pago ? "✅" : "❌"}`).join("; ");
        return `${name} (${entries.length}x): ${details}`;
      })
      .join("\n  ");

    return `Mês atual: ${month}/${year}
Receita total do mês: ${formatCurrency(totalIncome)}
Despesa total do mês: ${formatCurrency(totalExpense)}
Saldo do mês: ${formatCurrency(totalIncome - totalExpense)}
Margem: ${totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome * 100).toFixed(1) : 0}%
Contas pagas no mês: ${paid.length} (${formatCurrency(paid.reduce((s, t) => s + t.valor, 0))})
Contas pendentes no mês: ${pending.length} (${formatCurrency(pending.reduce((s, t) => s + t.valor, 0))})
Total de transações no mês: ${monthTx.length}

Mês anterior (${prevMonth}/${prevYear}):
  Receita: ${formatCurrency(prevTotalIncome)}
  Despesa: ${formatCurrency(prevTotalExpense)}
  Saldo: ${formatCurrency(prevTotalIncome - prevTotalExpense)}

Resumo mensal (últimos 6 meses):
  ${monthlySummary.join("\n  ") || "Sem dados"}

Categorias de despesa (mês atual):
  ${topCats || "Nenhuma"}

Maiores fornecedores (mês atual):
  ${topSuppliers || "Nenhum"}

TODAS as contas pendentes (qualquer mês):
  ${allPendingDetails || "Nenhuma"}

Últimas contas pagas (histórico completo):
  ${allPaidDetails || "Nenhuma"}

Histórico por fornecedor (últimos pagamentos):
  ${supplierHistoryStr || "Nenhum"}

Total geral de transações no sistema: ${transactions.length}
Total geral de entradas no sistema: ${dailyIncomes.length}`;
  }, [transactions, dailyIncomes]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  const send = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: Msg = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    let assistantSoFar = "";
    const allMessages = [...messages, userMsg];

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: allMessages,
          financialContext,
        }),
      });

      if (!resp.ok || !resp.body) {
        const err = await resp.json().catch(() => ({ error: "Erro desconhecido" }));
        throw new Error(err.error || "Erro ao conectar com a IA");
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") {
            streamDone = true;
            break;
          }

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantSoFar += content;
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant") {
                  return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
                }
                return [...prev, { role: "assistant", content: assistantSoFar }];
              });
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      // Final flush
      if (textBuffer.trim()) {
        for (let raw of textBuffer.split("\n")) {
          if (!raw) continue;
          if (raw.endsWith("\r")) raw = raw.slice(0, -1);
          if (raw.startsWith(":") || raw.trim() === "") continue;
          if (!raw.startsWith("data: ")) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantSoFar += content;
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant") {
                  return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
                }
                return [...prev, { role: "assistant", content: assistantSoFar }];
              });
            }
          } catch { /* ignore */ }
        }
      }
    } catch (e) {
      console.error(e);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `❌ ${e instanceof Error ? e.message : "Erro ao conectar com a IA"}` },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const suggestions = [
    "Como está minha saúde financeira este mês?",
    "Quais categorias estão gastando mais?",
    "Dicas para melhorar meu fluxo de caixa",
  ];

  const isOpen = forceOpen || open;

  return (
    <>
      {/* Floating button - only show when not forceOpen mode and not open */}
      {!forceOpen && !open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:scale-105 transition-transform flex items-center justify-center"
        >
          <Sparkles className="w-6 h-6" />
        </button>
      )}

      {/* Chat panel */}
      {isOpen && (
        <div className={`fixed z-50 bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden ${
          forceOpen
            ? "bottom-16 left-2 right-2 h-[calc(100vh-8rem)]"
            : "bottom-6 right-6 w-[380px] max-w-[calc(100vw-2rem)] h-[520px] max-h-[calc(100vh-4rem)]"
        }`}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-primary/5">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              <span className="font-semibold text-sm">Assistente Financeiro IA</span>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  onClick={() => setMessages([])}
                  className="p-1.5 rounded-md hover:bg-secondary transition-colors"
                  title="Limpar conversa"
                >
                  <Trash2 className="w-4 h-4 text-muted-foreground" />
                </button>
              )}
              <button
                onClick={() => { setOpen(false); onClose?.(); }}
                className="p-1.5 rounded-md hover:bg-secondary transition-colors"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.length === 0 && (
              <div className="space-y-3 pt-4">
                <p className="text-sm text-muted-foreground text-center">
                  Olá! Sou seu assistente financeiro. Pergunte-me sobre seus dados! 💡
                </p>
                <div className="space-y-2">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => { setInput(s); }}
                      className="w-full text-left px-3 py-2 rounded-lg bg-secondary/50 hover:bg-secondary text-xs text-foreground transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary/70 text-foreground"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:m-0 [&>ul]:my-1 [&>ol]:my-1">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
            ))}

            {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
              <div className="flex justify-start">
                <div className="bg-secondary/70 rounded-xl px-3 py-2">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-border p-3">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder="Pergunte sobre suas finanças..."
                className="flex-1 bg-secondary/50 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/30 placeholder:text-muted-foreground"
                disabled={isLoading}
              />
              <button
                onClick={send}
                disabled={isLoading || !input.trim()}
                className="p-2 rounded-lg bg-primary text-primary-foreground disabled:opacity-50 hover:bg-primary/90 transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AIChatWidget;
