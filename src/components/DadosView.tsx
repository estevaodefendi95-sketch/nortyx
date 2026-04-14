import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useTransactions } from "@/context/TransactionsContext";
import { formatCurrency, type CategoryCode } from "@/data/cashflow";
import { supabase } from "@/integrations/supabase/client";
import { useCategories } from "@/context/CategoriesContext";
import { useDashboardSettings } from "@/hooks/useDashboardSettings";
import { FileText, Upload, Trophy, TrendingUp, Wallet, X, Plus, Trash2, Calendar, Percent, Image, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const MONTHS_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

interface Product {
  id: number;
  nome: string;
  tipo: "comida" | "bebida";
  quantidade: number;
  valorTotal: number;
  data: string; // DD/MM/YYYY
}

interface DadosViewProps {
  selectedMonths: number[];
  selectedYear: number;
  isViewer?: boolean;
}

const WEEKDAYS_PT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const DadosView = ({ selectedMonths, selectedYear, isViewer = false }: DadosViewProps) => {
  const isAllSelected = selectedMonths.length === 0;
  const { transactions, dailyIncomes } = useTransactions();
  const { settings: dashSettings } = useDashboardSettings();
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>([]);
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [uploadedFiles, setUploadedFiles] = useState<{ file: File; name: string; processing?: boolean; importMonth?: number; importYear?: number; results?: { nome: string; tipo: "comida" | "bebida"; quantidade: number; valorTotal: number }[] }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // New product form
  const [newProduct, setNewProduct] = useState({
    nome: "",
    tipo: "comida" as "comida" | "bebida",
    quantidade: "",
    valorTotal: "",
    mes: selectedMonths.length === 1 ? selectedMonths[0] + 1 : new Date().getMonth() + 1,
    ano: selectedYear,
  });

  // Load products from database
  const loadProducts = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("id", { ascending: true });
      if (error) throw error;
      setProducts(
        (data || []).map((r: any) => ({
          id: Number(r.id),
          nome: r.nome,
          tipo: r.tipo as "comida" | "bebida",
          quantidade: Number(r.quantidade),
          valorTotal: Number(r.valor_total),
          data: `01/${String(r.mes).padStart(2, "0")}/${r.ano}`,
        }))
      );
    } catch (err) {
      console.error("Error loading products:", err);
    } finally {
      setProductsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("products-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, () => {
        loadProducts();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadProducts]);

  const formatDateToBR = (dateStr: string) => {
    const [y, m, d] = dateStr.split("-");
    return `${d}/${m}/${y}`;
  };

  const addProduct = async () => {
    if (!newProduct.nome || !newProduct.quantidade || !newProduct.valorTotal) {
      toast({ title: "Preencha todos os campos", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("products").insert({
      nome: newProduct.nome,
      tipo: newProduct.tipo,
      quantidade: parseInt(newProduct.quantidade),
      valor_total: parseFloat(newProduct.valorTotal),
      mes: newProduct.mes,
      ano: newProduct.ano,
    });
    if (error) {
      console.error("Error adding product:", error);
      toast({ title: "Erro ao salvar produto", variant: "destructive" });
      return;
    }
    setNewProduct((prev) => ({ ...prev, nome: "", quantidade: "", valorTotal: "" }));
    toast({ title: "Produto adicionado e salvo" });
  };

  const removeProduct = async (id: number) => {
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) {
      console.error("Error deleting product:", error);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newFiles = Array.from(files).map((f) => ({ file: f, name: f.name }));
    setUploadedFiles((prev) => [...prev, ...newFiles]);
    toast({ title: "Arquivo importado", description: "Clique em 'Identificar com IA' para processar." });
    e.target.value = "";
  };

  const processFileWithAI = async (idx: number) => {
    setUploadedFiles((prev) => prev.map((f, i) => i === idx ? { ...f, processing: true } : f));
    
    const file = uploadedFiles[idx].file;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = (reader.result as string).split(",")[1];
        const { data, error } = await supabase.functions.invoke("extract-products", {
          body: {
            imageBase64: base64,
            mimeType: file.type,
          },
        });

        if (error) throw error;

        const products = data?.products || [];

        setUploadedFiles((prev) => prev.map((f, i) => i === idx ? { ...f, processing: false, results: products } : f));
        if (products.length > 0) {
          toast({ title: `${products.length} produtos identificados`, description: "Revise e confirme abaixo." });
        } else {
          toast({ title: "Nenhum produto identificado", description: "Adicione manualmente.", variant: "destructive" });
        }
      } catch (err) {
        console.error("AI processing error:", err);
        setUploadedFiles((prev) => prev.map((f, i) => i === idx ? { ...f, processing: false } : f));
        toast({ title: "Erro ao processar", description: "Tente novamente ou adicione manualmente.", variant: "destructive" });
      }
    };
    reader.readAsDataURL(file);
  };

  const confirmAIProducts = async (idx: number) => {
    const file = uploadedFiles[idx];
    if (!file.results) return;
    const importMonth = file.importMonth ?? (selectedMonths.length === 1 ? selectedMonths[0] + 1 : new Date().getMonth() + 1);
    const importYear = file.importYear ?? selectedYear;
    
    const inserts = file.results.map((p) => ({
      nome: p.nome,
      tipo: p.tipo,
      quantidade: p.quantidade,
      valor_total: p.valorTotal,
      mes: importMonth,
      ano: importYear,
    }));
    
    const { error } = await supabase.from("products").insert(inserts);
    if (error) {
      console.error("Error saving products:", error);
      toast({ title: "Erro ao salvar produtos", variant: "destructive" });
      return;
    }
    toast({ title: `${file.results.length} produtos salvos em ${MONTHS_PT[importMonth - 1]}/${importYear}` });
    setUploadedFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const removeFile = (idx: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const matchMonth = (dateStr: string) => {
    const [, m, y] = dateStr.split("/").map(Number);
    if (y !== selectedYear) return false;
    return isAllSelected || selectedMonths.includes(m - 1);
  };

  // Filter products by selected months
  const filteredProducts = useMemo(() => {
    return products.filter((p) => matchMonth(p.data));
  }, [products, selectedMonths, isAllSelected]);

  // Top 10 foods
  const topFoods = useMemo(() => {
    const foodMap = new Map<string, { quantidade: number; valorTotal: number }>();
    filteredProducts
      .filter((p) => p.tipo === "comida")
      .forEach((p) => {
        const existing = foodMap.get(p.nome) || { quantidade: 0, valorTotal: 0 };
        foodMap.set(p.nome, {
          quantidade: existing.quantidade + p.quantidade,
          valorTotal: existing.valorTotal + p.valorTotal,
        });
      });
    return Array.from(foodMap.entries())
      .map(([nome, data]) => ({ nome, ...data }))
      .sort((a, b) => b.quantidade - a.quantidade)
      .slice(0, 10);
  }, [filteredProducts]);

  // Top 10 drinks
  const topDrinks = useMemo(() => {
    const drinkMap = new Map<string, { quantidade: number; valorTotal: number }>();
    filteredProducts
      .filter((p) => p.tipo === "bebida")
      .forEach((p) => {
        const existing = drinkMap.get(p.nome) || { quantidade: 0, valorTotal: 0 };
        drinkMap.set(p.nome, {
          quantidade: existing.quantidade + p.quantidade,
          valorTotal: existing.valorTotal + p.valorTotal,
        });
      });
    return Array.from(drinkMap.entries())
      .map(([nome, data]) => ({ nome, ...data }))
      .sort((a, b) => b.quantidade - a.quantidade)
      .slice(0, 10);
  }, [filteredProducts]);

  // Monthly revenue & balance from context
  const { faturamento, despesas, saldo } = useMemo(() => {
    const fat = dailyIncomes.filter((i) => matchMonth(i.data)).reduce((s, i) => s + i.valor, 0);
    const desp = transactions.filter((t) => t.tipo === "saida" && matchMonth(t.data)).reduce((s, t) => s + t.valor, 0);
    return { faturamento: fat, despesas: desp, saldo: fat - desp };
  }, [selectedMonths, isAllSelected, transactions, dailyIncomes]);

  // CMV = (Comida + Bebida expenses) / Faturamento
  const cmv = useMemo(() => {
    const gastosCB = transactions
      .filter((t) => t.tipo === "saida" && dashSettings.cmv_categories.includes(t.categoria) && matchMonth(t.data))
      .reduce((s, t) => s + t.valor, 0);
    return { gastosCB, percentual: faturamento > 0 ? (gastosCB / faturamento) * 100 : 0 };
  }, [transactions, faturamento, selectedMonths, isAllSelected, dashSettings.cmv_categories]);

  // Parse DD/MM/YYYY to Date
  const parseDate = (dateStr: string) => {
    const [d, m, y] = dateStr.split("/").map(Number);
    return new Date(y, m - 1, d);
  };

  // Daily revenue data filtered by months — keep Monday entries as-is
  const dailyRevenueData = useMemo(() => {
    return dailyIncomes
      .filter((i) => matchMonth(i.data))
      .map((i) => {
        const date = parseDate(i.data);
        return {
          date: i.data,
          dia: `${i.data.split("/")[0]}/${i.data.split("/")[1]}`,
          valor: i.valor,
          weekday: date.getDay(),
        };
      })
      .sort((a, b) => parseDate(a.date).getTime() - parseDate(b.date).getTime());
  }, [dailyIncomes, selectedMonths, isAllSelected]);

  // Filter by weekday
  const filteredDailyData = useMemo(() => {
    if (selectedWeekdays.length === 0) return dailyRevenueData;
    return dailyRevenueData.filter((d) => selectedWeekdays.includes(d.weekday));
  }, [dailyRevenueData, selectedWeekdays]);

  const CLOSED_DAY = 1; // Segunda-feira

  // Count all calendar days in selected months (ALL weekdays included)
  const totalCalendarDays = useMemo(() => {
    const months = isAllSelected ? Array.from({ length: 12 }, (_, i) => i) : selectedMonths;
    let count = 0;
    for (const m of months) {
      const daysInMonth = new Date(selectedYear, m + 1, 0).getDate();
      count += daysInMonth;
    }
    return count;
  }, [selectedMonths, isAllSelected, selectedYear]);

  // Count calendar days for specific selected weekdays
  const totalWeekdayCalendarDays = useMemo(() => {
    if (selectedWeekdays.length === 0) return 0;
    const months = isAllSelected ? Array.from({ length: 12 }, (_, i) => i) : selectedMonths;
    let count = 0;
    for (const m of months) {
      const daysInMonth = new Date(selectedYear, m + 1, 0).getDate();
      for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(selectedYear, m, d);
        if (selectedWeekdays.includes(date.getDay())) count++;
      }
    }
    return count;
  }, [selectedMonths, isAllSelected, selectedWeekdays, selectedYear]);

  const toggleWeekday = (wd: number) => {
    setSelectedWeekdays((prev) =>
      prev.includes(wd) ? prev.filter((w) => w !== wd) : [...prev, wd].sort()
    );
  };

  const RankingList = ({
    title,
    items,
    emptyText,
  }: {
    title: string;
    items: { nome: string; quantidade: number; valorTotal: number }[];
    emptyText: string;
  }) => (
    <div className="rounded-xl bg-card border border-border p-5">
      <h3 className="font-display font-semibold text-base mb-4 flex items-center gap-2">
        <Trophy className="w-4 h-4" /> {title}
      </h3>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">{emptyText}</p>
      ) : (
        <div className="space-y-2">
          {items.map((item, idx) => (
            <div
              key={item.nome}
              className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/30"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    idx === 0
                      ? "bg-yellow-500/20 text-yellow-400"
                      : idx === 1
                      ? "bg-gray-400/20 text-gray-300"
                      : idx === 2
                      ? "bg-amber-700/20 text-amber-600"
                      : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {idx + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{item.nome}</p>
                  <p className="text-xs text-muted-foreground">{item.quantidade} unidades</p>
                </div>
              </div>
              <span className="text-sm font-semibold text-foreground ml-2 flex-shrink-0">
                {formatCurrency(item.valorTotal)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const monthLabel = isAllSelected
    ? "Todos os meses"
    : selectedMonths.map((m) => MONTHS_PT[m]).join(", ");

  return (
    <div className="space-y-6">

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl bg-card border border-border p-5">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <TrendingUp className="w-4 h-4" />
            <span className="text-xs font-medium uppercase tracking-wider">Faturamento</span>
          </div>
          <p className="text-2xl font-display font-bold text-income">{formatCurrency(faturamento)}</p>
          <p className="text-xs text-muted-foreground mt-1">{monthLabel}</p>
        </div>
        <div className="rounded-xl bg-card border border-border p-5">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Wallet className="w-4 h-4" />
            <span className="text-xs font-medium uppercase tracking-wider">Despesas</span>
          </div>
          <p className="text-2xl font-display font-bold text-expense">{formatCurrency(despesas)}</p>
          <p className="text-xs text-muted-foreground mt-1">{monthLabel}</p>
        </div>
        <div className="rounded-xl bg-card border border-border p-5">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Trophy className="w-4 h-4" />
            <span className="text-xs font-medium uppercase tracking-wider">Saldo</span>
            {faturamento > 0 && (
              <span className={`text-xs font-semibold ${saldo >= 0 ? "text-income" : "text-expense"}`}>
                {((saldo / faturamento) * 100).toFixed(1)}%
              </span>
            )}
          </div>
          <p className={`text-2xl font-display font-bold ${saldo >= 0 ? "text-income" : "text-expense"}`}>
            {formatCurrency(saldo)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">{monthLabel}</p>
        </div>
      </div>

      {/* Faturamento Médio + CMV */}
      {(dashSettings.show_faturamento_medio || dashSettings.show_cmv) && (
      <div className={`grid grid-cols-1 ${dashSettings.show_faturamento_medio && dashSettings.show_cmv ? "sm:grid-cols-2" : ""} gap-4`}>
        {/* Faturamento Médio por Dia */}
        {dashSettings.show_faturamento_medio && (
        <div className="rounded-xl bg-card border border-border p-5">
          {/* Weekday filter on top */}
          <div className="flex gap-1 sm:gap-1.5 mb-4 flex-nowrap overflow-x-auto">
            {WEEKDAYS_PT.map((label, idx) => (
              <button
                key={idx}
                onClick={() => toggleWeekday(idx)}
                className={`px-2 sm:px-2.5 py-1.5 rounded-md text-xs font-medium transition-all border flex-shrink-0 ${
                  selectedWeekdays.includes(idx)
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-secondary/40 text-muted-foreground border-transparent hover:bg-secondary/70"
                }`}
              >
                {label}
              </button>
            ))}
            {selectedWeekdays.length > 0 && (
              <button
                onClick={() => setSelectedWeekdays([])}
                className="px-2.5 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Calendar className="w-4 h-4" />
            <span className="text-xs font-medium uppercase tracking-wider">
              {selectedWeekdays.length === 0
                ? "Faturamento Médio / Dia"
                : `Média ${selectedWeekdays.map((w) => WEEKDAYS_PT[w]).join(" + ")}`}
            </span>
          </div>

          {selectedWeekdays.length === 0 ? (
            totalCalendarDays === 0 ? (
              <p className="text-2xl font-display font-bold text-muted-foreground">—</p>
            ) : (
              <>
                <p className="text-2xl font-display font-bold text-income">
                  {formatCurrency(dailyRevenueData.reduce((s, d) => s + d.valor, 0) / totalCalendarDays)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {totalCalendarDays} dias · Total {formatCurrency(dailyRevenueData.reduce((s, d) => s + d.valor, 0))}
                </p>
              </>
            )
          ) : totalWeekdayCalendarDays === 0 ? (
            <p className="text-2xl font-display font-bold text-muted-foreground">—</p>
          ) : (
            <>
              <p className="text-2xl font-display font-bold text-income">
                {formatCurrency(filteredDailyData.reduce((s, d) => s + d.valor, 0) / totalWeekdayCalendarDays)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {totalWeekdayCalendarDays} dia{totalWeekdayCalendarDays !== 1 ? "s" : ""} · Total {formatCurrency(filteredDailyData.reduce((s, d) => s + d.valor, 0))}
              </p>
            </>
          )}
        </div>
        )}

        {/* CMV Card */}
        {dashSettings.show_cmv && (
        <div className="rounded-xl bg-card border border-border p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Percent className="w-4 h-4" />
              <span className="text-xs font-medium uppercase tracking-wider">Porcentagem</span>
            </div>
            <p className={`text-2xl font-display font-bold ${cmv.percentual <= 35 ? "text-income" : cmv.percentual <= 45 ? "text-yellow-400" : "text-expense"}`}>
              {cmv.percentual.toFixed(1)}%
            </p>
          </div>
          <div className="mt-2">
            <p className="text-xs text-muted-foreground">
              {dashSettings.cmv_categories.length > 0
                ? `Categorias: ${dashSettings.cmv_categories.join(" + ")}`
                : "Nenhuma categoria selecionada"}: {formatCurrency(cmv.gastosCB)}
            </p>
            <p className="text-xs text-muted-foreground">
              Faturamento: {formatCurrency(faturamento)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">{monthLabel}</p>
          </div>
        </div>
        )}
      </div>
      )}
      {(dashSettings.show_top_foods || dashSettings.show_top_drinks) && (
      <div className={`grid grid-cols-1 ${dashSettings.show_top_foods && dashSettings.show_top_drinks ? "lg:grid-cols-2" : ""} gap-6`}>
        {dashSettings.show_top_foods && (
        <RankingList
          title={`${dashSettings.ranking_title} 1`}
          items={topFoods}
          emptyText="Nenhum item cadastrado para este mês"
        />
        )}
        {dashSettings.show_top_drinks && (
        <RankingList
          title={`${dashSettings.ranking_title_2} 2`}
          items={topDrinks}
          emptyText="Nenhum item cadastrado para este mês"
        />
        )}
      </div>
      )}

      {!isViewer && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Manual Product Entry */}
          <div className="rounded-xl bg-card border border-border p-5">
            <h3 className="font-display font-semibold text-base mb-4 flex items-center gap-2">
              <Plus className="w-4 h-4" /> Adicionar Produto
            </h3>

            <div className="space-y-3">
              <div>
                <Label>Nome *</Label>
                <Input
                  value={newProduct.nome}
                  onChange={(e) => setNewProduct((f) => ({ ...f, nome: e.target.value }))}
                  placeholder="Ex: Produto, Cliente, Item..."
                  className="mt-1"
                />
              </div>

              <div>
                <Label>Categoria</Label>
                <Select value={newProduct.tipo} onValueChange={(v) => setNewProduct((f) => ({ ...f, tipo: v as "comida" | "bebida" }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="comida">{dashSettings.ranking_title} 1</SelectItem>
                    <SelectItem value="bebida">{dashSettings.ranking_title_2} 2</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Qtd *</Label>
                  <Input
                    type="number"
                    min="1"
                    value={newProduct.quantidade}
                    onChange={(e) => setNewProduct((f) => ({ ...f, quantidade: e.target.value }))}
                    placeholder="0"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Valor Total *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newProduct.valorTotal}
                    onChange={(e) => setNewProduct((f) => ({ ...f, valorTotal: e.target.value }))}
                    placeholder="0,00"
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Mês</Label>
                  <Select value={String(newProduct.mes)} onValueChange={(v) => setNewProduct((f) => ({ ...f, mes: Number(v) }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MONTHS_PT.map((m, i) => (
                        <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Ano</Label>
                  <Input
                    type="number"
                    value={newProduct.ano}
                    onChange={(e) => setNewProduct((f) => ({ ...f, ano: Number(e.target.value) }))}
                    className="mt-1"
                  />
                </div>
              </div>

              <Button onClick={addProduct} className="w-full">
                <Plus className="w-4 h-4 mr-2" /> Adicionar
              </Button>
            </div>

            {/* Recent products for this month */}
            {filteredProducts.length > 0 && (
              <div className="mt-4 space-y-1.5 max-h-48 overflow-y-auto">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
                  Produtos do mês ({filteredProducts.length})
                </p>
                {filteredProducts.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-secondary/20 text-sm"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs text-muted-foreground flex-shrink-0">{p.tipo === "comida" ? `${dashSettings.ranking_title} 1` : `${dashSettings.ranking_title_2} 2`}</span>
                      <span className="truncate">{p.nome}</span>
                      <span className="text-xs text-muted-foreground">x{p.quantidade}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs font-medium">{formatCurrency(p.valorTotal)}</span>
                      <button onClick={() => removeProduct(p.id)} className="text-muted-foreground hover:text-expense">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* File Import (PDF + Images) */}
          <div className="rounded-xl bg-card border border-border p-5">
            <h3 className="font-display font-semibold text-base mb-2 flex items-center gap-2">
              <Upload className="w-4 h-4" /> Importar Arquivo
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Importe PDFs ou fotos de notas fiscais. A IA identifica os produtos automaticamente.
            </p>

            <div className="flex gap-2 mb-3">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 flex flex-col items-center justify-center h-24 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all"
              >
                <FileText className="w-8 h-8 text-muted-foreground mb-1" />
                <span className="text-xs font-medium">PDF</span>
                <input ref={fileInputRef} type="file" accept=".pdf" multiple className="hidden" onChange={handleFileUpload} />
              </button>
              <button
                onClick={() => imageInputRef.current?.click()}
                className="flex-1 flex flex-col items-center justify-center h-24 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all"
              >
                <Image className="w-8 h-8 text-muted-foreground mb-1" />
                <span className="text-xs font-medium">Foto</span>
                <input ref={imageInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileUpload} />
              </button>
            </div>

            {uploadedFiles.length > 0 && (
              <div className="mt-2 space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Arquivos importados</p>
                {uploadedFiles.map((f, idx) => (
                  <div key={idx} className="p-3 rounded-lg bg-secondary/30 border border-border/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        {f.file.type.startsWith("image/") ? <Image className="w-4 h-4 text-muted-foreground flex-shrink-0" /> : <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                        <span className="text-sm truncate">{f.name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {!f.results && !f.processing && (
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => processFileWithAI(idx)}>
                            Identificar com IA
                          </Button>
                        )}
                        {f.processing && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
                        <button onClick={() => removeFile(idx)} className="text-muted-foreground hover:text-expense p-1">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    {f.results && f.results.length > 0 && (
                      <div className="space-y-1">
                        {f.results.map((p, pIdx) => (
                          <div key={pIdx} className="flex items-center justify-between text-xs bg-secondary/20 rounded p-1.5">
                            <span>{p.nome} x{p.quantidade}</span>
                            <span className="font-medium">{formatCurrency(p.valorTotal)}</span>
                          </div>
                        ))}
                        <div className="flex gap-2 mt-2">
                          <Select
                            value={String(f.importMonth ?? (selectedMonths.length === 1 ? selectedMonths[0] + 1 : new Date().getMonth() + 1))}
                            onValueChange={(v) => setUploadedFiles((prev) => prev.map((uf, i) => i === idx ? { ...uf, importMonth: Number(v) } : uf))}
                          >
                            <SelectTrigger className="h-7 text-xs flex-1"><SelectValue placeholder="Mês" /></SelectTrigger>
                            <SelectContent>
                              {MONTHS_PT.map((m, i) => (
                                <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input
                            type="number"
                            className="h-7 text-xs w-20"
                            value={f.importYear ?? selectedYear}
                            onChange={(e) => setUploadedFiles((prev) => prev.map((uf, i) => i === idx ? { ...uf, importYear: Number(e.target.value) } : uf))}
                          />
                        </div>
                        <Button size="sm" className="w-full h-7 text-xs mt-1" onClick={() => confirmAIProducts(idx)}>
                          <Check className="w-3 h-3 mr-1" /> Confirmar {f.results.length} produtos
                        </Button>
                      </div>
                    )}
                    {f.results && f.results.length === 0 && (
                      <p className="text-xs text-muted-foreground italic">Nenhum produto identificado. Adicione manualmente.</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DadosView;
