import { useMemo, useState, useEffect, useCallback } from "react";
import { formatCurrency, type CategoryCode } from "@/data/cashflow";
import { useTransactions } from "@/context/TransactionsContext";
import { useCategories } from "@/context/CategoriesContext";
import { useSubcategories } from "@/context/SubcategoriesContext";
import { supabase } from "@/integrations/supabase/client";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowDown, CheckCircle2, Clock, AlertCircle, ChevronDown, Plus, X, Copy, StickyNote, Trash2, Repeat, Pencil, Check, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ColorPicker from "@/components/ColorPicker";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

const MONTHS_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

interface CategoriesViewProps {
  selectedMonths: number[];
  selectedYear: number;
  isViewer?: boolean;
}

const CategoriesView = ({ selectedMonths, selectedYear, isViewer = false }: CategoriesViewProps) => {
  const { transactions, addTransaction, updateTransaction, deleteTransaction, deleteRecurringFromDate, reassignCategory } = useTransactions();
  const { categories, addCategory, deleteCategory, getCategoryInfo, getCategoryColor, updateCategoryColor, updateCategoryName } = useCategories();
  const { subcategories, addSubcategory, deleteSubcategory, getSubcategoriesByCategory, getSubcategoryName } = useSubcategories();
  const { toast } = useToast();
  const [selectedCategory, setSelectedCategory] = useState<CategoryCode | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [newSubName, setNewSubName] = useState("");
  const [showNewSub, setShowNewSub] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const isAllSelected = selectedMonths.length === 0;

  // Delete recurring dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [pendingDeleteTx, setPendingDeleteTx] = useState<{ id: number; groupId: string | null; data: string } | null>(null);

  // Category management state
  const [newCatName, setNewCatName] = useState("");
  const [showNewCat, setShowNewCat] = useState(false);
  const [editingCatCode, setEditingCatCode] = useState<string | null>(null);
  const [editingCatName, setEditingCatName] = useState("");
  const [catToDelete, setCatToDelete] = useState<{ code: string; name: string } | null>(null);

  // Make recurring dialog state
  const [makeRecurringTx, setMakeRecurringTx] = useState<any | null>(null);
  const [recurringMonths, setRecurringMonths] = useState(12);

  // Inline edit state
  const [editingTxId, setEditingTxId] = useState<number | null>(null);
  const [editTxEmpresa, setEditTxEmpresa] = useState("");
  const [editTxValor, setEditTxValor] = useState("");

  // Observação (nota) inline state
  const [expandedNoteId, setExpandedNoteId] = useState<number | null>(null);
  const [noteDraft, setNoteDraft] = useState("");

  const toggleNote = (t: any) => {
    if (expandedNoteId === t.id) {
      setExpandedNoteId(null);
      setNoteDraft("");
    } else {
      setExpandedNoteId(t.id);
      setNoteDraft(t.observacao || "");
    }
  };

  const saveNote = (id: number) => {
    const value = noteDraft.trim();
    updateTransaction(id, { observacao: value || null });
    toast({ title: value ? "Observação salva" : "Observação removida" });
    setExpandedNoteId(null);
    setNoteDraft("");
  };

  const startEditTx = (t: any) => {
    setEditingTxId(t.id);
    setEditTxEmpresa(t.empresa);
    setEditTxValor(String(t.valor));
  };

  const cancelEditTx = () => {
    setEditingTxId(null);
    setEditTxEmpresa("");
    setEditTxValor("");
  };

  const saveEditTx = () => {
    if (!editingTxId) return;
    const valor = parseFloat(editTxValor.replace(",", "."));
    if (isNaN(valor) || valor <= 0) {
      toast({ title: "Valor inválido", variant: "destructive" });
      return;
    }
    updateTransaction(editingTxId, { empresa: editTxEmpresa.trim(), valor });
    toast({ title: "Lançamento atualizado" });
    cancelEditTx();
  };

  // Notes state
  interface Note { id: number; title: string; content: string; category: string; created_at: string; }
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNoteTitle, setNewNoteTitle] = useState("");
  const [newNoteContent, setNewNoteContent] = useState("");

  // Duplicate multi-select state
  const [selectedForDup, setSelectedForDup] = useState<Set<number>>(new Set());
  const [showDupConfirm, setShowDupConfirm] = useState(false);
  const [dupMonth, setDupMonth] = useState(new Date().getMonth() + 1);
  const [dupYear, setDupYear] = useState(new Date().getFullYear());
  const [selectMode, setSelectMode] = useState(false);

  // Load notes
  useEffect(() => {
    const loadNotes = async () => {
      const { data } = await supabase.from("notes").select("*").eq("category", "atrasadas").order("created_at", { ascending: false });
      if (data) setNotes(data as Note[]);
    };
    loadNotes();
  }, []);

  const addNote = useCallback(async () => {
    if (!newNoteTitle.trim()) return;
    const { data, error } = await supabase.from("notes").insert({ title: newNoteTitle.trim(), content: newNoteContent.trim(), category: "atrasadas" }).select().single();
    if (data) {
      setNotes(prev => [data as Note, ...prev]);
      setNewNoteTitle("");
      setNewNoteContent("");
      toast({ title: "Anotação salva" });
    }
  }, [newNoteTitle, newNoteContent, toast]);

  const deleteNote = useCallback(async (id: number) => {
    setNotes(prev => prev.filter(n => n.id !== id));
    await supabase.from("notes").delete().eq("id", id);
    toast({ title: "Anotação excluída" });
  }, [toast]);

  const duplicateSelected = useCallback(() => {
    selectedForDup.forEach((txId) => {
      const tx = transactions.find(t => t.id === txId);
      if (!tx) return;
      const [day] = tx.data.split("/");
      const newDate = `${day}/${String(dupMonth).padStart(2, "0")}/${dupYear}`;
      addTransaction({
        empresa: tx.empresa,
        valor: tx.valor,
        data: newDate,
        categoria: tx.categoria,
        subcategoria: tx.subcategoria || null,
        pago: false,
        agendado: true,
        tipo: tx.tipo,
        forma_pagamento: tx.forma_pagamento || null,
        pix_code: tx.pix_code || null,
      });
    });
    toast({ title: "Lançamentos duplicados", description: `${selectedForDup.size} item(ns) copiado(s) para ${String(dupMonth).padStart(2, "0")}/${dupYear}` });
    setSelectedForDup(new Set());
    setShowDupConfirm(false);
    setSelectMode(false);
  }, [transactions, selectedForDup, dupMonth, dupYear, addTransaction, toast]);

  const toggleSelectItem = useCallback((id: number) => {
    setSelectedForDup(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      if (t.tipo !== "saida") return false;
      const [, month, year] = t.data.split("/").map(Number);
      if (year !== selectedYear) return false;
      if (isAllSelected) return true;
      return selectedMonths.includes(month - 1);
    });
  }, [transactions, selectedMonths, isAllSelected, selectedYear]);

  const filteredTotal = useMemo(() => filteredTransactions.reduce((sum, t) => sum + t.valor, 0), [filteredTransactions]);

  const categoryData = useMemo(() => {
    const map = new Map<CategoryCode, number>();
    filteredTransactions.forEach((t) => {
      map.set(t.categoria, (map.get(t.categoria) || 0) + t.valor);
    });

    return categories
      .map((cat) => ({
        ...cat,
        total: map.get(cat.code) || 0,
        percentage: filteredTotal > 0 ? ((map.get(cat.code) || 0) / filteredTotal) * 100 : 0,
      }))
      .filter((c) => c.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [filteredTransactions, filteredTotal]);

  const pieData = categoryData.map((c) => ({
    name: c.name,
    value: c.total,
    color: getCategoryColor(c.code),
  }));

  const selectedTransactionsList = useMemo(() => {
    if (!selectedCategory) return [];
    return filteredTransactions
      .filter((t) => t.categoria === selectedCategory)
      .sort((a, b) => {
        const [dA, mA, yA] = a.data.split("/").map(Number);
        const [dB, mB, yB] = b.data.split("/").map(Number);
        return new Date(yA, mA - 1, dA).getTime() - new Date(yB, mB - 1, dB).getTime();
      });
  }, [selectedCategory, filteredTransactions]);

  const selectedInfo = selectedCategory ? getCategoryInfo(selectedCategory) : null;
  const selectedTotal = selectedTransactionsList.reduce((s, t) => s + t.valor, 0);

  // Weekly spending card state
  const [selectedWeekCategories, setSelectedWeekCategories] = useState<CategoryCode[]>([]);

  const toggleWeekCategory = useCallback((code: CategoryCode) => {
    setSelectedWeekCategories(prev => {
      if (prev.includes(code)) return prev.filter(c => c !== code);
      if (prev.length >= 3) return prev;
      return [...prev, code];
    });
  }, []);

  const weeklyData = useMemo(() => {
    // Determine which month to use for weeks
    const targetMonth = selectedMonths.length === 1 ? selectedMonths[0] : (selectedMonths.length > 1 ? selectedMonths[0] : new Date().getMonth());
    const targetYear = selectedYear;
    const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate();
    const monthLabel = MONTHS_PT[targetMonth];

    const weeks = [
      { label: "Semana 1", range: [1, 7], dateLabel: `01-07/${String(targetMonth + 1).padStart(2, "0")}` },
      { label: "Semana 2", range: [8, 14], dateLabel: `08-14/${String(targetMonth + 1).padStart(2, "0")}` },
      { label: "Semana 3", range: [15, 21], dateLabel: `15-21/${String(targetMonth + 1).padStart(2, "0")}` },
      { label: "Semana 4", range: [22, lastDay], dateLabel: `22-${lastDay}/${String(targetMonth + 1).padStart(2, "0")}` },
    ];

    // Filter transactions for this specific month
    const monthTxns = transactions.filter(t => {
      if (t.tipo !== "saida") return false;
      const [, m, y] = t.data.split("/").map(Number);
      return y === targetYear && m - 1 === targetMonth;
    });

    return weeks.map(week => ({
      ...week,
      totals: selectedWeekCategories.map(catCode => {
        return monthTxns
          .filter(t => {
            if (t.categoria !== catCode) return false;
            const day = parseInt(t.data.split("/")[0], 10);
            return day >= week.range[0] && day <= week.range[1];
          })
          .reduce((sum, t) => sum + t.valor, 0);
      }),
    }));
  }, [transactions, selectedMonths, selectedYear, selectedWeekCategories]);

  return (
    <div className="space-y-6">
      {/* Weekly Spending Card */}
      {categoryData.length > 0 && (
        <div className="rounded-xl bg-card border border-border p-4 sm:p-6">
          <h2 className="font-display font-semibold text-lg mb-1">📊 Gastos por Semana</h2>
          <p className="text-xs text-muted-foreground mb-3">Selecione até 3 categorias para comparar</p>
          <div className="flex gap-1.5 mb-4 overflow-x-auto pb-2 scrollbar-hide" style={{ WebkitOverflowScrolling: 'touch' }}>
            {categoryData.map(cat => {
              const isActive = selectedWeekCategories.includes(cat.code);
              const color = getCategoryColor(cat.code);
              return (
                <button
                  key={cat.code}
                  onClick={() => toggleWeekCategory(cat.code)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all border whitespace-nowrap flex-shrink-0 ${
                    isActive
                      ? "text-white border-transparent"
                      : "bg-secondary/50 text-muted-foreground border-border hover:bg-secondary"
                  }`}
                  style={isActive ? { backgroundColor: color, borderColor: color } : {}}
                  disabled={!isActive && selectedWeekCategories.length >= 3}
                >
                  {cat.name}
                </button>
              );
            })}
          </div>

          {selectedWeekCategories.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 pr-3 text-xs text-muted-foreground font-medium">Categoria</th>
                    {weeklyData.map((week, i) => (
                      <th key={i} className="text-center py-2 px-2 min-w-[90px]">
                        <p className="text-xs font-semibold">{week.label}</p>
                        <p className="text-[10px] text-muted-foreground">{week.dateLabel}</p>
                      </th>
                    ))}
                    <th className="text-center py-2 px-2 min-w-[90px]">
                      <p className="text-xs font-semibold">Total</p>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {selectedWeekCategories.map((catCode, catIdx) => {
                    const catInfo = getCategoryInfo(catCode);
                    const color = getCategoryColor(catCode);
                    const rowTotal = weeklyData.reduce((sum, w) => sum + (w.totals[catIdx] || 0), 0);
                    return (
                      <tr key={catCode} className="border-b border-border/50">
                        <td className="py-2.5 pr-3">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                            <span className="text-xs font-medium truncate max-w-[100px]">{catInfo?.name || catCode}</span>
                          </div>
                        </td>
                        {weeklyData.map((week, i) => (
                          <td key={i} className="text-center py-2.5 px-2">
                            <span className={`text-xs ${week.totals[catIdx] > 0 ? "font-semibold text-expense" : "text-muted-foreground"}`}>
                              {week.totals[catIdx] > 0 ? formatCurrency(week.totals[catIdx]) : "—"}
                            </span>
                          </td>
                        ))}
                        <td className="text-center py-2.5 px-2">
                          <span className="text-xs font-bold text-expense">{formatCurrency(rowTotal)}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-4">Clique em uma categoria acima para ver os gastos semanais</p>
          )}
        </div>
      )}

      {/* Top: Chart + Category List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie Chart */}
        <div className="rounded-xl bg-card border border-border p-6 flex flex-col items-center justify-center">
          <h2 className="font-display font-semibold text-lg mb-2 self-start">Distribuição por Categoria</h2>
          <p className="text-sm text-muted-foreground mb-6 self-start">
            Total: {formatCurrency(filteredTotal)}
          </p>
          <div className="w-full h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={120}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} className="cursor-pointer" />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    color: "hsl(var(--foreground))",
                    fontSize: "13px",
                  }}
                  itemStyle={{ color: "hsl(var(--foreground))" }}
                  labelStyle={{ color: "hsl(var(--muted-foreground))" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category List */}
        <div className="rounded-xl bg-card border border-border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold text-lg">Categorias de Saída</h2>
            {!isViewer && (
              <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => { setShowNewCat(!showNewCat); setNewCatName(""); }}>
                <Plus className="w-3 h-3" /> Nova
              </Button>
            )}
          </div>
          {!isViewer && showNewCat && (
            <div className="flex gap-2 mb-3">
              <Input
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newCatName.trim()) {
                    addCategory(newCatName.trim());
                    setNewCatName("");
                    setShowNewCat(false);
                    toast({ title: "Categoria criada" });
                  }
                  if (e.key === "Escape") setShowNewCat(false);
                }}
                placeholder="Nome da categoria"
                className="h-8 text-xs"
                autoFocus
              />
              <Button size="sm" className="h-8 text-xs" onClick={() => {
                if (newCatName.trim()) {
                  addCategory(newCatName.trim());
                  setNewCatName("");
                  setShowNewCat(false);
                  toast({ title: "Categoria criada" });
                }
              }}>OK</Button>
            </div>
          )}
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {categoryData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhuma saída neste período</p>
            ) : (
              categoryData.map((cat) => {
                const isSelected = selectedCategory === cat.code;
                const isEditing = editingCatCode === cat.code;
                return (
                  <div
                    key={cat.code}
                    className={`
                      w-full flex items-center justify-between p-3 rounded-lg transition-all text-left
                      ${isSelected ? "bg-primary/10 border border-primary/30" : "bg-secondary/40 border border-transparent hover:bg-secondary/70"}
                    `}
                  >
                    <button
                      onClick={() => {
                        if (isEditing) return;
                        const newCat = isSelected ? null : cat.code;
                        setSelectedCategory(newCat);
                        setDetailOpen(false);
                      }}
                      className="flex items-center gap-3 min-w-0 flex-1 text-left"
                    >
                      <ColorPicker
                        currentColor={getCategoryColor(cat.code)}
                        onColorChange={(color) => updateCategoryColor(cat.code, color)}
                      />
                      <div className="min-w-0 flex-1">
                        {isEditing ? (
                          <Input
                            value={editingCatName}
                            onChange={(e) => setEditingCatName(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => {
                              e.stopPropagation();
                              if (e.key === "Enter" && editingCatName.trim()) {
                                updateCategoryName(cat.code, editingCatName.trim());
                                setEditingCatCode(null);
                                toast({ title: "Categoria renomeada" });
                              }
                              if (e.key === "Escape") setEditingCatCode(null);
                            }}
                            className="h-7 text-xs"
                            autoFocus
                          />
                        ) : (
                          <p className="text-sm font-medium truncate">{cat.name}</p>
                        )}
                        <p className="text-xs text-muted-foreground">{cat.percentage.toFixed(1)}%</p>
                      </div>
                    </button>
                    <div className="text-right flex-shrink-0 ml-2 flex items-center gap-1">
                      <p className="text-sm font-semibold text-expense">{formatCurrency(cat.total)}</p>
                      {!isViewer && cat.code !== "O" && (
                        <>
                          {isEditing ? (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (editingCatName.trim()) {
                                    updateCategoryName(cat.code, editingCatName.trim());
                                    setEditingCatCode(null);
                                    toast({ title: "Categoria renomeada" });
                                  }
                                }}
                                className="p-1 rounded hover:bg-primary/10"
                              >
                                <Check className="w-3.5 h-3.5 text-primary" />
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); setEditingCatCode(null); }} className="p-1 rounded hover:bg-destructive/10">
                                <X className="w-3.5 h-3.5 text-muted-foreground" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={(e) => { e.stopPropagation(); setEditingCatCode(cat.code); setEditingCatName(cat.name); }}
                                className="p-1 rounded hover:bg-primary/10"
                                title="Renomear"
                              >
                                <Pencil className="w-3.5 h-3.5 text-muted-foreground hover:text-primary" />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); setCatToDelete({ code: cat.code, name: cat.name }); }}
                                className="p-1 rounded hover:bg-destructive/10"
                                title="Excluir"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
                              </button>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            {/* Show categories without spending too, so they can still be managed */}
            {!isViewer && categories.filter(c => !categoryData.some(cd => cd.code === c.code)).map((cat) => (
              <div key={cat.code} className="w-full flex items-center justify-between p-2 rounded-lg bg-secondary/20 border border-transparent text-left opacity-60 hover:opacity-100">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <ColorPicker currentColor={getCategoryColor(cat.code)} onColorChange={(color) => updateCategoryColor(cat.code, color)} />
                  {editingCatCode === cat.code ? (
                    <Input
                      value={editingCatName}
                      onChange={(e) => setEditingCatName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && editingCatName.trim()) {
                          updateCategoryName(cat.code, editingCatName.trim());
                          setEditingCatCode(null);
                          toast({ title: "Categoria renomeada" });
                        }
                        if (e.key === "Escape") setEditingCatCode(null);
                      }}
                      className="h-7 text-xs"
                      autoFocus
                    />
                  ) : (
                    <p className="text-xs text-muted-foreground truncate">{cat.name} <span className="text-[10px]">(sem lançamentos)</span></p>
                  )}
                </div>
                {cat.code !== "O" && (
                  <div className="flex items-center gap-1">
                    <button onClick={() => { setEditingCatCode(cat.code); setEditingCatName(cat.name); }} className="p-1 rounded hover:bg-primary/10">
                      <Pencil className="w-3.5 h-3.5 text-muted-foreground hover:text-primary" />
                    </button>
                    <button onClick={() => setCatToDelete({ code: cat.code, name: cat.name })} className="p-1 rounded hover:bg-destructive/10">
                      <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom: Detail List */}
      {selectedCategory && selectedInfo && (
        <div className="rounded-xl bg-card border border-border animate-in fade-in slide-in-from-bottom-4 duration-300 p-4 sm:p-6">
          {/* Header - always visible */}
          <div className="flex items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <ColorPicker
                currentColor={getCategoryColor(selectedInfo.code)}
                onColorChange={(color) => updateCategoryColor(selectedInfo.code, color)}
                size="md"
              />
              <div className="min-w-0 text-left">
                <h3 className="font-display font-semibold text-base sm:text-lg truncate">{selectedInfo.name}</h3>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  {selectedTransactionsList.length} lançamentos · {formatCurrency(selectedTotal)}
                </p>
              </div>
            </div>
            <button
              onClick={() => setSelectedCategory(null)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
            >
              Fechar
            </button>
          </div>

          {/* Subcategory totals */}
          {(() => {
            const subs = getSubcategoriesByCategory(selectedCategory);
            if (subs.length === 0) return null;
            const subTotals = subs.map((sub) => {
              const total = selectedTransactionsList
                .filter((t) => t.subcategoria === sub.id)
                .reduce((s, t) => s + t.valor, 0);
              return { ...sub, total };
            }).filter((s) => s.total > 0).sort((a, b) => b.total - a.total);
            const unassignedTotal = selectedTransactionsList
              .filter((t) => !t.subcategoria || !subs.some((s) => s.id === t.subcategoria))
              .reduce((s, t) => s + t.valor, 0);
            if (subTotals.length === 0 && unassignedTotal === 0) return null;
            return (
              <div className="mb-4">
                <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">Totais por Subcategoria</p>
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  {subTotals.map((sub) => (
                    <Badge key={sub.id} variant="secondary" className="text-[10px] sm:text-xs" style={{ borderLeft: `3px solid ${sub.color}` }}>
                      {sub.name} · {formatCurrency(sub.total)}
                    </Badge>
                  ))}
                  {unassignedTotal > 0 && (
                    <Badge variant="secondary" className="text-[10px] sm:text-xs">
                      Geral · {formatCurrency(unassignedTotal)}
                    </Badge>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Top suppliers - collapsible */}
          <Collapsible open={detailOpen} onOpenChange={setDetailOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full text-xs text-muted-foreground mb-2 uppercase tracking-wider hover:text-foreground transition-colors">
              <span>Maiores fornecedores</span>
              <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${detailOpen ? "rotate-180" : ""}`} />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-4">
                {(() => {
                  const supplierMap = new Map<string, number>();
                  selectedTransactionsList.forEach((t) => {
                    supplierMap.set(t.empresa, (supplierMap.get(t.empresa) || 0) + t.valor);
                  });
                  return Array.from(supplierMap.entries())
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 5)
                    .map(([name, total]) => (
                      <Badge key={name} variant="secondary" className="text-[10px] sm:text-xs">
                        {name} · {formatCurrency(total)}
                      </Badge>
                    ));
                })()}
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Subcategories management */}
          {selectedCategory && !isViewer && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Subcategorias</p>
                <button
                  onClick={() => setShowNewSub(!showNewSub)}
                  className="text-xs text-primary hover:text-primary/80 flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Adicionar
                </button>
              </div>
              {showNewSub && (
                <div className="flex gap-2 mb-2">
                  <Input
                    value={newSubName}
                    onChange={(e) => setNewSubName(e.target.value)}
                    onKeyDown={async (e) => {
                      if (e.key === "Enter" && newSubName.trim()) {
                        await addSubcategory(selectedCategory, newSubName.trim());
                        setNewSubName("");
                        setShowNewSub(false);
                        toast({ title: "Subcategoria criada" });
                      }
                      if (e.key === "Escape") setShowNewSub(false);
                    }}
                    placeholder="Nome da subcategoria"
                    className="h-7 text-xs"
                    autoFocus
                  />
                  <Button size="sm" className="h-7 text-xs" onClick={async () => {
                    if (newSubName.trim()) {
                      await addSubcategory(selectedCategory, newSubName.trim());
                      setNewSubName("");
                      setShowNewSub(false);
                      toast({ title: "Subcategoria criada" });
                    }
                  }}>OK</Button>
                </div>
              )}
              <div className="flex flex-wrap gap-1.5">
                {getSubcategoriesByCategory(selectedCategory).map((sub) => (
                  <Badge key={sub.id} variant="secondary" className="text-[10px] sm:text-xs gap-1 pr-1">
                    {sub.name}
                    <button
                      onClick={async () => {
                        await deleteSubcategory(sub.id);
                        toast({ title: "Subcategoria excluída" });
                      }}
                      className="ml-0.5 hover:text-destructive"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
                {getSubcategoriesByCategory(selectedCategory).length === 0 && !showNewSub && (
                  <p className="text-[11px] text-muted-foreground">Nenhuma subcategoria</p>
                )}
              </div>
            </div>
          )}

          {/* Duplicate toolbar */}
          {!isViewer && (
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Lançamentos ({selectedTransactionsList.length})</p>
            <div className="flex items-center gap-2">
              {selectMode && selectedForDup.size > 0 && (
                <Button size="sm" className="h-7 text-xs gap-1" onClick={() => { setShowDupConfirm(true); setDupMonth(new Date().getMonth() + 1); setDupYear(new Date().getFullYear()); }}>
                  <Copy className="w-3 h-3" /> Duplicar ({selectedForDup.size})
                </Button>
              )}
              <Button
                size="sm"
                variant={selectMode ? "secondary" : "ghost"}
                className="h-7 text-xs gap-1"
                onClick={() => { setSelectMode(!selectMode); setSelectedForDup(new Set()); setShowDupConfirm(false); }}
              >
                <Copy className="w-3 h-3" /> {selectMode ? "Cancelar" : "Selecionar"}
              </Button>
            </div>
          </div>
          )}
          {isViewer && (
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Lançamentos ({selectedTransactionsList.length})</p>
          )}

          {/* Duplicate confirmation */}
          {showDupConfirm && (
            <div className="mb-3 p-3 rounded-lg bg-primary/5 border border-primary/20 flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium">Duplicar {selectedForDup.size} item(ns) para:</span>
              <select
                value={dupMonth}
                onChange={(e) => setDupMonth(Number(e.target.value))}
                className="h-7 text-xs rounded-md border border-border bg-background px-2"
              >
                {MONTHS_PT.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
              <select
                value={dupYear}
                onChange={(e) => setDupYear(Number(e.target.value))}
                className="h-7 text-xs rounded-md border border-border bg-background px-2"
              >
                {[selectedYear - 1, selectedYear, selectedYear + 1, selectedYear + 2].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <Button size="sm" className="h-7 text-xs" onClick={duplicateSelected}>Confirmar</Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowDupConfirm(false)}>Cancelar</Button>
            </div>
          )}

          {/* Select all */}
          {selectMode && (
            <div className="mb-2 flex items-center gap-2">
              <button
                onClick={() => {
                  if (selectedForDup.size === selectedTransactionsList.length) {
                    setSelectedForDup(new Set());
                  } else {
                    setSelectedForDup(new Set(selectedTransactionsList.map(t => t.id)));
                  }
                }}
                className="text-xs text-primary hover:underline"
              >
                {selectedForDup.size === selectedTransactionsList.length ? "Desmarcar todos" : "Selecionar todos"}
              </button>
            </div>
          )}

          <div className="space-y-2 max-h-[60vh] sm:max-h-[400px] overflow-y-auto">
            {selectedTransactionsList.map((t) => (
              <div
                key={t.id}
                className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg bg-secondary/30 border gap-2 sm:gap-0 ${selectMode && selectedForDup.has(t.id) ? "border-primary/50 bg-primary/5" : "border-border/30"}`}
              >
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  {selectMode && (
                    <input
                      type="checkbox"
                      checked={selectedForDup.has(t.id)}
                      onChange={() => toggleSelectItem(t.id)}
                      className="w-4 h-4 rounded border-border accent-primary flex-shrink-0"
                    />
                  )}
                  <ArrowDown className="w-4 h-4 text-expense flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    {editingTxId === t.id ? (
                      <div className="flex items-center gap-2">
                        <Input
                          value={editTxEmpresa}
                          onChange={(e) => setEditTxEmpresa(e.target.value)}
                          className="h-7 text-sm"
                          onKeyDown={(e) => e.key === "Enter" && saveEditTx()}
                        />
                        <Input
                          value={editTxValor}
                          onChange={(e) => setEditTxValor(e.target.value)}
                          className="h-7 text-sm w-24"
                          onKeyDown={(e) => e.key === "Enter" && saveEditTx()}
                        />
                        <button onClick={saveEditTx} className="p-1 rounded hover:bg-primary/10">
                          <Check className="w-4 h-4 text-primary" />
                        </button>
                        <button onClick={cancelEditTx} className="p-1 rounded hover:bg-destructive/10">
                          <X className="w-4 h-4 text-muted-foreground" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm font-medium truncate">
                          {t.empresa}
                          {t.subcategoria && getSubcategoryName(t.subcategoria) && (
                            <span className="text-[10px] text-muted-foreground ml-1">({getSubcategoryName(t.subcategoria)})</span>
                          )}
                        </p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <p className="text-xs text-muted-foreground">{t.data}</p>
                          {!isViewer ? (
                            <>
                              <Select value={t.categoria} onValueChange={(val) => {
                                updateTransaction(t.id, { categoria: val, subcategoria: null });
                                toast({ title: "Categoria atualizada" });
                              }}>
                                <SelectTrigger className="h-6 text-[10px] sm:text-xs px-1.5 py-0 w-auto min-w-[80px] max-w-[160px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {categories.map((c) => (
                                    <SelectItem key={c.code} value={c.code} className="text-xs">{c.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {(() => {
                                const subs = getSubcategoriesByCategory(t.categoria);
                                if (subs.length === 0) return null;
                                return (
                                  <Select value={t.subcategoria || "_none"} onValueChange={(val) => {
                                    updateTransaction(t.id, { subcategoria: val === "_none" ? null : val });
                                    toast({ title: "Subcategoria atualizada" });
                                  }}>
                                    <SelectTrigger className="h-6 text-[10px] sm:text-xs px-1.5 py-0 w-auto min-w-[60px] max-w-[120px]">
                                      <SelectValue placeholder="Sub..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="_none" className="text-xs">Geral</SelectItem>
                                      {subs.map((s) => (
                                        <SelectItem key={s.id} value={s.id} className="text-xs">{s.name}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                );
                              })()}
                            </>
                          ) : (
                            <span className="text-[10px] sm:text-xs text-muted-foreground">{getCategoryInfo(t.categoria)?.name}</span>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0 ml-6 sm:ml-2 self-end sm:self-auto">
                  {t.recurrence_type && (
                    <span title={`Recorrente: ${t.recurrence_type === "daily" ? "diário" : t.recurrence_type === "weekly" ? "semanal" : "mensal"}`}><Repeat className="w-3.5 h-3.5 text-muted-foreground" /></span>
                  )}
                  {editingTxId !== t.id && (
                    <>
                      {t.pago ? (
                        <CheckCircle2 className="w-4 h-4 text-primary" />
                      ) : t.agendado ? (
                        <Clock className="w-4 h-4 text-warning" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-expense" />
                      )}
                      <span className="text-sm font-semibold text-expense">{formatCurrency(t.valor)}</span>
                    </>
                  )}
                  {!isViewer && editingTxId !== t.id && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          startEditTx(t);
                        }}
                        className="p-1 rounded hover:bg-primary/10 transition-colors"
                        title="Editar"
                      >
                        <Pencil className="w-3.5 h-3.5 text-muted-foreground hover:text-primary" />
                      </button>
                      {!t.recurrence_group_id && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setMakeRecurringTx(t);
                            setRecurringMonths(12);
                          }}
                          className="p-1 rounded hover:bg-primary/10 transition-colors"
                          title="Tornar recorrente (repetir nos próximos meses)"
                        >
                          <Repeat className="w-3.5 h-3.5 text-muted-foreground hover:text-primary" />
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (t.recurrence_group_id) {
                            setPendingDeleteTx({ id: t.id, groupId: t.recurrence_group_id, data: t.data });
                            setDeleteDialogOpen(true);
                          } else {
                            deleteTransaction(t.id);
                            toast({ title: "Lançamento excluído" });
                          }
                        }}
                        className="p-1 rounded hover:bg-destructive/10 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notes / Contas Atrasadas - hidden for viewers */}
      {!isViewer && (
      <div className="rounded-xl bg-card border border-border p-4 sm:p-6">
        <Collapsible open={notesOpen} onOpenChange={setNotesOpen}>
          <CollapsibleTrigger className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <StickyNote className="w-4 h-4 text-warning" />
              <h2 className="font-display font-semibold text-base sm:text-lg">Contas Atrasadas / Anotações</h2>
              {notes.length > 0 && (
                <Badge variant="secondary" className="text-[10px]">{notes.length}</Badge>
              )}
            </div>
            <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${notesOpen ? "rotate-180" : ""}`} />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-4 space-y-3">
              {/* Add note form */}
              <div className="flex flex-col gap-2 p-3 rounded-lg bg-secondary/30 border border-border/30">
                <Input
                  value={newNoteTitle}
                  onChange={(e) => setNewNoteTitle(e.target.value)}
                  placeholder="Título (ex: Conta de luz atrasada)"
                  className="h-8 text-xs"
                />
                <Textarea
                  value={newNoteContent}
                  onChange={(e) => setNewNoteContent(e.target.value)}
                  placeholder="Detalhes (opcional)"
                  className="text-xs min-h-[50px]"
                  rows={2}
                />
                <Button size="sm" onClick={addNote} disabled={!newNoteTitle.trim()} className="self-end gap-1.5">
                  <Plus className="w-3 h-3" /> Adicionar
                </Button>
              </div>
              {/* Notes list */}
              {notes.map((note) => (
                <div key={note.id} className="flex items-start justify-between p-3 rounded-lg bg-warning/5 border border-warning/20 gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{note.title}</p>
                    {note.content && <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{note.content}</p>}
                    <p className="text-[10px] text-muted-foreground mt-1">{new Date(note.created_at).toLocaleDateString("pt-BR")}</p>
                  </div>
                  <button onClick={() => deleteNote(note.id)} className="p-1 rounded hover:bg-destructive/10 transition-colors flex-shrink-0">
                    <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
                  </button>
                </div>
              ))}
              {notes.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">Nenhuma anotação ainda</p>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
      )}

      {/* Delete recurring dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lançamento recorrente</AlertDialogTitle>
            <AlertDialogDescription>
              Este lançamento faz parte de uma série recorrente. O que deseja fazer?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDeleteTx) {
                  deleteTransaction(pendingDeleteTx.id);
                  toast({ title: "Lançamento excluído" });
                }
                setPendingDeleteTx(null);
              }}
            >
              Apenas este
            </AlertDialogAction>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (pendingDeleteTx?.groupId) {
                  const [d, m, y] = pendingDeleteTx.data.split("/");
                  const isoDate = `${y}-${m}-${d}`;
                  deleteRecurringFromDate(pendingDeleteTx.groupId, isoDate);
                  toast({ title: "Lançamentos recorrentes excluídos", description: "Este e todos os futuros foram removidos." });
                }
                setPendingDeleteTx(null);
              }}
            >
              Este e futuros
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete category dialog */}
      <AlertDialog open={!!catToDelete} onOpenChange={(open) => !open && setCatToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir categoria "{catToDelete?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Todos os lançamentos desta categoria serão movidos para "Outros". Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!catToDelete) return;
                reassignCategory(catToDelete.code, "O");
                await deleteCategory(catToDelete.code);
                if (selectedCategory === catToDelete.code) setSelectedCategory(null);
                toast({ title: "Categoria excluída", description: `${catToDelete.name} — lançamentos movidos para Outros` });
                setCatToDelete(null);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Make recurring dialog */}
      <AlertDialog open={!!makeRecurringTx} onOpenChange={(open) => !open && setMakeRecurringTx(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tornar recorrente</AlertDialogTitle>
            <AlertDialogDescription>
              Repetir "{makeRecurringTx?.empresa}" ({makeRecurringTx && formatCurrency(makeRecurringTx.valor)}) nos próximos meses, mantendo o mesmo dia do mês.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="my-3">
            <label className="text-xs text-muted-foreground">Quantos meses?</label>
            <Input
              type="number"
              min={1}
              max={60}
              value={recurringMonths}
              onChange={(e) => setRecurringMonths(Math.max(1, Math.min(60, parseInt(e.target.value) || 1)))}
              className="mt-1 w-24"
            />
            <p className="text-[11px] text-muted-foreground mt-1">Será criada 1 cópia para cada mês adicional (mín. 1, máx. 60).</p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                const t = makeRecurringTx;
                if (!t) return;
                const groupId = crypto.randomUUID();
                // Mark original
                updateTransaction(t.id, { recurrence_type: "monthly", recurrence_group_id: groupId });
                // Create future copies
                const [d, m, y] = t.data.split("/").map(Number);
                let created = 0;
                for (let i = 1; i < recurringMonths; i++) {
                  const newDate = new Date(y, m - 1 + i, d);
                  const dd = String(newDate.getDate()).padStart(2, "0");
                  const mm = String(newDate.getMonth() + 1).padStart(2, "0");
                  const yyyy = newDate.getFullYear();
                  const ok = await addTransaction({
                    empresa: t.empresa,
                    valor: t.valor,
                    data: `${dd}/${mm}/${yyyy}`,
                    categoria: t.categoria,
                    subcategoria: t.subcategoria || null,
                    pago: false,
                    agendado: true,
                    tipo: t.tipo,
                    forma_pagamento: t.forma_pagamento || null,
                    pix_code: t.pix_code || null,
                    recurrence_type: "monthly",
                    recurrence_group_id: groupId,
                  });
                  if (ok) created++;
                }
                toast({ title: "Recorrência criada", description: `${created} lançamento(s) futuro(s) gerado(s).` });
                setMakeRecurringTx(null);
              }}
            >
              Criar recorrência
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CategoriesView;
