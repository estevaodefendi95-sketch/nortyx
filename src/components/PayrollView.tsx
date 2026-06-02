import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/context/OrganizationContext";
import { useCategories } from "@/context/CategoriesContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Trash2, Users, Calendar, Check, RotateCcw, Loader2 } from "lucide-react";
import { formatCurrency } from "@/data/cashflow";

interface Employee {
  id: string;
  nome: string;
  salario: number;
  quinzena: number;
  extra_padrao: number;
  ativo: boolean;
}

interface PayrollRun {
  id: string;
  ano: number;
  mes: number;
  total: number;
  lancado_em: string;
}

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const lastDayBR = (ano: number, mes: number) => {
  const d = new Date(ano, mes, 0).getDate();
  return `${String(d).padStart(2, "0")}/${String(mes).padStart(2, "0")}/${ano}`;
};

export default function PayrollView() {
  const { organization } = useOrganization();
  const { categories } = useCategories();
  const { toast } = useToast();
  const orgId = organization?.id;

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);

  // form novo funcionário
  const [novoNome, setNovoNome] = useState("");
  const [novoSalario, setNovoSalario] = useState("");
  const [novoQuinzena, setNovoQuinzena] = useState("");
  const [novoExtra, setNovoExtra] = useState("");

  const now = new Date();
  const [ano, setAno] = useState(now.getFullYear());
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [extrasMes, setExtrasMes] = useState<Record<string, string>>({});
  const [categoria, setCategoria] = useState<string>("MO");

  const [toDelete, setToDelete] = useState<Employee | null>(null);
  const [toReverse, setToReverse] = useState<PayrollRun | null>(null);

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    const [empRes, runRes] = await Promise.all([
      supabase.from("payroll_employees").select("*").eq("organization_id", orgId).order("nome"),
      supabase.from("payroll_runs").select("*").eq("organization_id", orgId).order("ano", { ascending: false }).order("mes", { ascending: false }),
    ]);
    if (empRes.data) setEmployees(empRes.data as any);
    if (runRes.data) setRuns(runRes.data as any);
    setLoading(false);
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!orgId) return;
    const ch = supabase
      .channel(`payroll-${orgId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "payroll_employees" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "payroll_runs" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [orgId, load]);

  // Categoria default: tenta MO, senão a primeira saída
  useEffect(() => {
    if (!categoria && categories.length > 0) {
      const mo = categories.find((c) => c.code === "MO");
      setCategoria(mo?.code || categories[0].code);
    }
  }, [categories, categoria]);

  const addEmployee = async () => {
    if (!orgId || !novoNome.trim()) return;
    const salario = parseFloat(novoSalario.replace(",", ".")) || 0;
    const quinzena = parseFloat(novoQuinzena.replace(",", ".")) || 0;
    const extra_padrao = parseFloat(novoExtra.replace(",", ".")) || 0;
    const { error } = await supabase.from("payroll_employees").insert({
      organization_id: orgId,
      nome: novoNome.trim(),
      salario, quinzena, extra_padrao,
    } as any);
    if (error) { toast({ title: "Erro ao adicionar", description: error.message, variant: "destructive" }); return; }
    setNovoNome(""); setNovoSalario(""); setNovoQuinzena(""); setNovoExtra("");
    toast({ title: "Funcionário adicionado" });
  };

  const updateEmployee = async (id: string, patch: Partial<Employee>) => {
    setEmployees((prev) => prev.map((e) => e.id === id ? { ...e, ...patch } : e));
    await supabase.from("payroll_employees").update(patch as any).eq("id", id);
  };

  const deleteEmployee = async (id: string) => {
    setEmployees((prev) => prev.filter((e) => e.id !== id));
    await supabase.from("payroll_employees").delete().eq("id", id);
    toast({ title: "Funcionário removido" });
  };

  const currentRun = useMemo(
    () => runs.find((r) => r.ano === ano && r.mes === mes),
    [runs, ano, mes],
  );

  const ativos = useMemo(() => employees.filter((e) => e.ativo !== false), [employees]);

  const itensMes = useMemo(() => {
    return ativos.map((e) => {
      const extraStr = extrasMes[e.id];
      const extra = extraStr !== undefined ? (parseFloat(extraStr.replace(",", ".")) || 0) : Number(e.extra_padrao || 0);
      const total = Number(e.salario || 0) + Number(e.quinzena || 0) + extra;
      return { employee: e, extra, total };
    });
  }, [ativos, extrasMes]);

  const totalMes = useMemo(() => itensMes.reduce((s, i) => s + i.total, 0), [itensMes]);

  const lancarFolha = async () => {
    if (!orgId || currentRun || ativos.length === 0) return;
    setPosting(true);
    try {
      const dataBR = lastDayBR(ano, mes);
      const { data: runData, error: runErr } = await supabase
        .from("payroll_runs")
        .insert({ organization_id: orgId, ano, mes, total: totalMes } as any)
        .select()
        .single();
      if (runErr || !runData) throw runErr || new Error("Falha ao criar folha");

      for (const item of itensMes) {
        const { data: tx, error: txErr } = await supabase
          .from("transactions")
          .insert({
            organization_id: orgId,
            empresa: item.employee.nome,
            valor: item.total,
            data: dataBR,
            categoria,
            tipo: "saida",
            pago: false,
            agendado: true,
            observacao: `Folha de pagamento ${MESES[mes - 1]}/${ano}`,
          } as any)
          .select()
          .single();
        if (txErr) throw txErr;

        await supabase.from("payroll_run_items").insert({
          run_id: (runData as any).id,
          organization_id: orgId,
          employee_id: item.employee.id,
          nome_snapshot: item.employee.nome,
          salario: item.employee.salario,
          quinzena: item.employee.quinzena,
          extra: item.extra,
          total: item.total,
          transaction_id: (tx as any)?.id,
        } as any);
      }

      toast({ title: "Folha lançada", description: `${MESES[mes - 1]}/${ano} • ${formatCurrency(totalMes)}` });
      setExtrasMes({});
      await load();
    } catch (e: any) {
      toast({ title: "Erro ao lançar folha", description: e?.message || "Falha desconhecida", variant: "destructive" });
    } finally {
      setPosting(false);
    }
  };

  const estornar = async (run: PayrollRun) => {
    const { data: items } = await supabase.from("payroll_run_items").select("transaction_id").eq("run_id", run.id);
    const txIds = (items || []).map((i: any) => i.transaction_id).filter(Boolean);
    if (txIds.length > 0) {
      await supabase.from("transactions").delete().in("id", txIds);
    }
    await supabase.from("payroll_runs").delete().eq("id", run.id);
    toast({ title: "Folha estornada" });
    await load();
  };

  const anos = useMemo(() => {
    const set = new Set<number>([now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1]);
    runs.forEach((r) => set.add(r.ano));
    return Array.from(set).sort((a, b) => b - a);
  }, [runs, now]);

  return (
    <div className="space-y-6 rounded-xl border border-border bg-card p-4 sm:p-6">
      <div className="flex items-center gap-2">
        <Users className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Folha de Pagamento</h2>
        {currentRun && <Badge variant="secondary" className="ml-auto"><Check className="h-3 w-3 mr-1" /> Mês lançado</Badge>}
      </div>

      {/* Cadastro de funcionários */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground">Funcionários</h3>

        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
          <Input placeholder="Nome" value={novoNome} onChange={(e) => setNovoNome(e.target.value)} className="sm:col-span-2" />
          <Input placeholder="Salário" inputMode="decimal" value={novoSalario} onChange={(e) => setNovoSalario(e.target.value)} />
          <Input placeholder="Quinzena" inputMode="decimal" value={novoQuinzena} onChange={(e) => setNovoQuinzena(e.target.value)} />
          <div className="flex gap-2">
            <Input placeholder="Extra" inputMode="decimal" value={novoExtra} onChange={(e) => setNovoExtra(e.target.value)} />
            <Button onClick={addEmployee} size="icon" disabled={!novoNome.trim()}><Plus className="h-4 w-4" /></Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-6 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /></div>
        ) : employees.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Nenhum funcionário cadastrado.</p>
        ) : (
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="w-full text-sm min-w-[560px]">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="text-left p-2">Nome</th>
                  <th className="text-right p-2">Salário</th>
                  <th className="text-right p-2">Quinzena</th>
                  <th className="text-right p-2">Extra padrão</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {employees.map((e) => (
                  <tr key={e.id} className="border-b border-border/50">
                    <td className="p-2">
                      <Input value={e.nome} onChange={(ev) => updateEmployee(e.id, { nome: ev.target.value })} className="h-8" />
                    </td>
                    <td className="p-2 w-28">
                      <Input type="number" step="0.01" value={e.salario} onChange={(ev) => updateEmployee(e.id, { salario: parseFloat(ev.target.value) || 0 })} className="h-8 text-right" />
                    </td>
                    <td className="p-2 w-28">
                      <Input type="number" step="0.01" value={e.quinzena} onChange={(ev) => updateEmployee(e.id, { quinzena: parseFloat(ev.target.value) || 0 })} className="h-8 text-right" />
                    </td>
                    <td className="p-2 w-28">
                      <Input type="number" step="0.01" value={e.extra_padrao} onChange={(ev) => updateEmployee(e.id, { extra_padrao: parseFloat(ev.target.value) || 0 })} className="h-8 text-right" />
                    </td>
                    <td className="p-2 w-10">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setToDelete(e)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Lançamento do mês */}
      <div className="space-y-3 pt-4 border-t border-border">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium text-muted-foreground">Lançar folha do mês</h3>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {MESES.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {anos.map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={categoria} onValueChange={setCategoria}>
            <SelectTrigger className="col-span-2 sm:col-span-1"><SelectValue placeholder="Categoria" /></SelectTrigger>
            <SelectContent>
              {categories.map((c) => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="text-right self-center font-semibold col-span-2 sm:col-span-1">
            {formatCurrency(totalMes)}
          </div>
        </div>

        {ativos.length > 0 && !currentRun && (
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="w-full text-sm min-w-[480px]">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="text-left p-2">Funcionário</th>
                  <th className="text-right p-2">Salário</th>
                  <th className="text-right p-2">Quinzena</th>
                  <th className="text-right p-2 w-28">Extra</th>
                  <th className="text-right p-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {itensMes.map(({ employee, extra, total }) => (
                  <tr key={employee.id} className="border-b border-border/50">
                    <td className="p-2">{employee.nome}</td>
                    <td className="p-2 text-right">{formatCurrency(Number(employee.salario))}</td>
                    <td className="p-2 text-right">{formatCurrency(Number(employee.quinzena))}</td>
                    <td className="p-2">
                      <Input
                        inputMode="decimal"
                        value={extrasMes[employee.id] ?? String(employee.extra_padrao || "")}
                        onChange={(ev) => setExtrasMes((p) => ({ ...p, [employee.id]: ev.target.value }))}
                        className="h-8 text-right"
                      />
                    </td>
                    <td className="p-2 text-right font-medium">{formatCurrency(total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex justify-end">
          {currentRun ? (
            <Button variant="outline" onClick={() => setToReverse(currentRun)}>
              <RotateCcw className="h-4 w-4 mr-2" /> Estornar folha de {MESES[mes - 1]}
            </Button>
          ) : (
            <Button onClick={lancarFolha} disabled={posting || ativos.length === 0}>
              {posting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
              Lançar folha do mês
            </Button>
          )}
        </div>
      </div>

      {/* Histórico */}
      {runs.length > 0 && (
        <div className="space-y-2 pt-4 border-t border-border">
          <h3 className="text-sm font-medium text-muted-foreground">Histórico</h3>
          <div className="space-y-1">
            {runs.slice(0, 12).map((r) => (
              <div key={r.id} className="flex items-center justify-between text-sm py-2 px-3 rounded-md bg-muted/30">
                <span>{MESES[r.mes - 1]}/{r.ano}</span>
                <div className="flex items-center gap-3">
                  <span className="font-medium">{formatCurrency(Number(r.total))}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setToReverse(r)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover funcionário?</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete?.nome} será removido. Folhas já lançadas não serão alteradas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (toDelete) { deleteEmployee(toDelete.id); setToDelete(null); } }}>
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!toReverse} onOpenChange={(o) => !o && setToReverse(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Estornar folha?</AlertDialogTitle>
            <AlertDialogDescription>
              Todos os lançamentos de saída desta folha ({toReverse && `${MESES[toReverse.mes - 1]}/${toReverse.ano}`}) serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (toReverse) { estornar(toReverse); setToReverse(null); } }}>
              Estornar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
