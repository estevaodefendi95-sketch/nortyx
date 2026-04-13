import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/data/cashflow";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, ChevronUp, Check, Pencil, X, Mail, Phone, CreditCard, Repeat, Trash2, Send } from "lucide-react";

const MONTHS_FULL = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

interface BillingClient {
  id: string;
  nome: string;
  email: string;
  telefone: string | null;
  forma_cobranca: string | null;
}

interface BillingCharge {
  id: string;
  client_id: string;
  valor: number;
  data_cobranca: string;
  recorrente: boolean;
  status: string;
  email_enviado: boolean;
  meses_restantes: number | null;
}

interface ClientsViewProps {
  selectedMonths: number[];
  selectedYear: number;
  isViewer?: boolean;
}

const ClientsView = ({ selectedMonths, selectedYear, isViewer = false }: ClientsViewProps) => {
  const { toast } = useToast();
  const [clients, setClients] = useState<BillingClient[]>([]);
  const [charges, setCharges] = useState<BillingCharge[]>([]);
  const [expandedClient, setExpandedClient] = useState<string | null>(null);
  const [editingClient, setEditingClient] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<BillingClient>>({});
  const [editingCharge, setEditingCharge] = useState<string | null>(null);
  const [chargeEditForm, setChargeEditForm] = useState<{ valor: string; data_cobranca: string; status: string; recorrente: boolean; meses_restantes: string }>({ valor: "", data_cobranca: "", status: "", recorrente: false, meses_restantes: "" });
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; recorrente: boolean } | null>(null);
  const isAllSelected = selectedMonths.length === 0;

  useEffect(() => {
    const load = async () => {
      const [{ data: c }, { data: ch }] = await Promise.all([
        supabase.from("billing_clients").select("*"),
        supabase.from("billing_charges").select("*"),
      ]);
      if (c) setClients(c);
      if (ch) setCharges(ch);
    };
    load();
  }, []);

  const filteredCharges = useMemo(() => {
    return charges.filter((ch) => {
      const parts = ch.data_cobranca.split("/");
      if (parts.length < 3) return false;
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      if (year !== selectedYear) return false;
      if (isAllSelected) return true;
      return selectedMonths.includes(month);
    });
  }, [charges, selectedMonths, selectedYear, isAllSelected]);

  const clientsWithCharges = useMemo(() => {
    const map = new Map<string, BillingCharge[]>();
    filteredCharges.forEach((ch) => {
      const list = map.get(ch.client_id) || [];
      list.push(ch);
      map.set(ch.client_id, list);
    });
    return clients
      .filter((c) => map.has(c.id))
      .map((c) => ({ ...c, charges: map.get(c.id)! }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [clients, filteredCharges]);

  const totals = useMemo(() => {
    const total = filteredCharges.reduce((s, c) => s + c.valor, 0);
    const received = filteredCharges.filter((c) => c.status === "paga").reduce((s, c) => s + c.valor, 0);
    return { total, received, pending: total - received };
  }, [filteredCharges]);

  const monthLabel = useMemo(() => {
    if (isAllSelected) return `${selectedYear}`;
    if (selectedMonths.length === 1) return `${MONTHS_FULL[selectedMonths[0]]} ${selectedYear}`;
    return `${selectedMonths.map((m) => MONTHS_FULL[m]).join(", ")} ${selectedYear}`;
  }, [selectedMonths, selectedYear, isAllSelected]);

  const handleMarkPaid = useCallback(async (chargeId: string) => {
    const { error } = await supabase.from("billing_charges").update({ status: "paga" }).eq("id", chargeId);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    setCharges((prev) => prev.map((c) => (c.id === chargeId ? { ...c, status: "paga" } : c)));
    toast({ title: "Cobrança marcada como paga" });
  }, [toast]);

  const startChargeEdit = (charge: BillingCharge) => {
    setEditingCharge(charge.id);
    setChargeEditForm({
      valor: String(charge.valor),
      data_cobranca: charge.data_cobranca,
      status: charge.status,
      recorrente: charge.recorrente,
      meses_restantes: charge.meses_restantes != null ? String(charge.meses_restantes) : "",
    });
  };

  const saveChargeEdit = async () => {
    if (!editingCharge) return;
    const original = charges.find((c) => c.id === editingCharge);
    if (!original) return;

    const newValor = parseFloat(chargeEditForm.valor);
    if (isNaN(newValor) || newValor <= 0) {
      toast({ title: "Valor inválido", variant: "destructive" });
      return;
    }

    const mesesRestantes = chargeEditForm.meses_restantes ? parseInt(chargeEditForm.meses_restantes) : null;

    const { error } = await supabase
      .from("billing_charges")
      .update({
        valor: newValor,
        data_cobranca: chargeEditForm.data_cobranca,
        status: chargeEditForm.status,
        recorrente: chargeEditForm.recorrente,
        meses_restantes: mesesRestantes,
      })
      .eq("id", editingCharge);

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }

    // If recurrence was turned off, ask about deleting future charges
    if (original.recorrente && !chargeEditForm.recorrente) {
      const [d, m, y] = original.data_cobranca.split("/").map(Number);
      const currentDate = new Date(y, m - 1, d);
      const futureCharges = charges.filter(
        (c) =>
          c.client_id === original.client_id &&
          c.id !== editingCharge &&
          c.recorrente &&
          c.status === "pendente" &&
          (() => {
            const [fd, fm, fy] = c.data_cobranca.split("/").map(Number);
            return new Date(fy, fm - 1, fd) > currentDate;
          })()
      );
      if (futureCharges.length > 0) {
        const ids = futureCharges.map((c) => c.id);
        await supabase.from("billing_charges").delete().in("id", ids);
        setCharges((prev) => prev.filter((c) => !ids.includes(c.id)));
        toast({ title: `${ids.length} cobrança(s) futura(s) excluída(s)` });
      }
    }

    setCharges((prev) =>
      prev.map((c) =>
        c.id === editingCharge
          ? { ...c, valor: newValor, data_cobranca: chargeEditForm.data_cobranca, status: chargeEditForm.status, recorrente: chargeEditForm.recorrente, meses_restantes: mesesRestantes }
          : c
      )
    );
    setEditingCharge(null);
    toast({ title: "Cobrança atualizada" });
  };

  const deleteCharge = async (chargeId: string, deleteFuture: boolean) => {
    const charge = charges.find((c) => c.id === chargeId);
    if (!charge) return;

    const idsToDelete = [chargeId];

    if (deleteFuture && charge.recorrente) {
      const [d, m, y] = charge.data_cobranca.split("/").map(Number);
      const currentDate = new Date(y, m - 1, d);
      charges.forEach((c) => {
        if (c.client_id === charge.client_id && c.id !== chargeId && c.recorrente && c.status === "pendente") {
          const [fd, fm, fy] = c.data_cobranca.split("/").map(Number);
          if (new Date(fy, fm - 1, fd) > currentDate) {
            idsToDelete.push(c.id);
          }
        }
      });
    }

    const { error } = await supabase.from("billing_charges").delete().in("id", idsToDelete);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    setCharges((prev) => prev.filter((c) => !idsToDelete.includes(c.id)));
    setDeleteConfirm(null);
    toast({ title: `${idsToDelete.length} cobrança(s) excluída(s)` });
  };

  const sendBillingEmail = async (chargeId: string) => {
    toast({ title: "Enviando e-mail..." });
    const { data, error } = await supabase.functions.invoke("send-billing-email", {
      body: { charge_id: chargeId },
    });
    if (error) {
      toast({ title: "Erro ao enviar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "E-mail processado", description: data?.message || "Cobrança processada" });
    // Refresh charge status
    setCharges((prev) => prev.map((c) => (c.id === chargeId ? { ...c, email_enviado: true, status: "enviada" } : c)));
  };

  const startEdit = (client: BillingClient) => {
    setEditingClient(client.id);
    setEditForm({ nome: client.nome, email: client.email, telefone: client.telefone, forma_cobranca: client.forma_cobranca });
  };

  const saveEdit = async () => {
    if (!editingClient) return;
    const { error } = await supabase
      .from("billing_clients")
      .update({
        nome: editForm.nome,
        email: editForm.email,
        telefone: editForm.telefone || null,
        forma_cobranca: editForm.forma_cobranca || null,
      })
      .eq("id", editingClient);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    setClients((prev) =>
      prev.map((c) => (c.id === editingClient ? { ...c, ...editForm } as BillingClient : c))
    );
    setEditingClient(null);
    toast({ title: "Cliente atualizado" });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paga":
        return <Badge variant="default" className="bg-income/20 text-income border-income/30 text-[10px]">Pago</Badge>;
      case "enviada":
        return <Badge variant="secondary" className="text-[10px]">Enviada</Badge>;
      case "atrasado":
        return <Badge variant="destructive" className="text-[10px]">Atrasado</Badge>;
      default:
        return <Badge variant="outline" className="text-warning border-warning/30 text-[10px]">Pendente</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="rounded-xl bg-card border border-border p-4 sm:p-6">
        <h2 className="font-display font-semibold text-lg mb-1">Clientes — {monthLabel}</h2>
        <div className="flex gap-4 mt-2 flex-wrap text-sm">
          <span className="text-muted-foreground">
            Total: <span className="font-semibold text-foreground">{formatCurrency(totals.total)}</span>
          </span>
          <span className="text-muted-foreground">
            Recebido: <span className="font-semibold text-income">{formatCurrency(totals.received)}</span>
          </span>
          <span className="text-muted-foreground">
            Pendente: <span className="font-semibold text-warning">{formatCurrency(totals.pending)}</span>
          </span>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80">
          <div className="bg-card border border-border rounded-xl p-6 max-w-sm w-full mx-4 space-y-4">
            <h3 className="font-semibold">Excluir cobrança</h3>
            <p className="text-sm text-muted-foreground">Tem certeza que deseja excluir esta cobrança?</p>
            <div className="flex flex-col gap-2">
              <Button variant="destructive" size="sm" onClick={() => deleteCharge(deleteConfirm.id, false)}>
                Excluir apenas esta
              </Button>
              {deleteConfirm.recorrente && (
                <Button variant="destructive" size="sm" onClick={() => deleteCharge(deleteConfirm.id, true)}>
                  Excluir esta e futuras
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => setDeleteConfirm(null)}>
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Client list */}
      {clientsWithCharges.length === 0 ? (
        <div className="rounded-xl bg-card border border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">Nenhum cliente com cobranças neste período.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {clientsWithCharges.map((client) => {
            const isExpanded = expandedClient === client.id;
            const isEditing = editingClient === client.id;
            const clientTotal = client.charges.reduce((s, c) => s + c.valor, 0);
            const allPaid = client.charges.every((c) => c.status === "paga");
            const hasRecurring = client.charges.some((c) => c.recorrente);

            return (
              <div key={client.id} className="rounded-lg border border-border bg-card overflow-hidden">
                {/* Header */}
                <button
                  onClick={() => setExpandedClient(isExpanded ? null : client.id)}
                  className="w-full flex items-center justify-between p-3 sm:p-4 text-left hover:bg-secondary/30 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-primary">{client.nome.charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{client.nome}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {hasRecurring && <Repeat className="w-3 h-3 text-muted-foreground" />}
                        <span className="text-xs text-muted-foreground">{client.charges.length} cobrança(s)</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-sm font-semibold ${allPaid ? "text-income" : "text-foreground"}`}>
                      {formatCurrency(clientTotal)}
                    </span>
                    {allPaid ? (
                      <Check className="w-4 h-4 text-income" />
                    ) : isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                </button>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="border-t border-border px-3 sm:px-4 py-3 space-y-3">
                    {/* Client info */}
                    {isEditing ? (
                      <div className="space-y-2 p-3 rounded-lg bg-secondary/30">
                        <div>
                          <Label className="text-xs">Nome</Label>
                          <Input value={editForm.nome || ""} onChange={(e) => setEditForm((p) => ({ ...p, nome: e.target.value }))} className="h-8 text-sm" />
                        </div>
                        <div>
                          <Label className="text-xs">E-mail</Label>
                          <Input type="email" value={editForm.email || ""} onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))} className="h-8 text-sm" />
                        </div>
                        <div>
                          <Label className="text-xs">Telefone</Label>
                          <Input value={editForm.telefone || ""} onChange={(e) => setEditForm((p) => ({ ...p, telefone: e.target.value }))} className="h-8 text-sm" />
                        </div>
                        <div>
                          <Label className="text-xs">Forma de cobrança</Label>
                          <Input value={editForm.forma_cobranca || ""} onChange={(e) => setEditForm((p) => ({ ...p, forma_cobranca: e.target.value }))} className="h-8 text-sm" />
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={saveEdit} className="gap-1"><Check className="w-3 h-3" /> Salvar</Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingClient(null)}><X className="w-3 h-3" /></Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {client.email}</span>
                        {client.telefone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {client.telefone}</span>}
                        {client.forma_cobranca && <span className="flex items-center gap-1"><CreditCard className="w-3 h-3" /> {client.forma_cobranca}</span>}
                        {!isViewer && (
                          <button onClick={() => startEdit(client)} className="flex items-center gap-1 text-primary hover:underline">
                            <Pencil className="w-3 h-3" /> Editar
                          </button>
                        )}
                      </div>
                    )}

                    {/* Charges */}
                    <div className="space-y-1.5">
                      {client.charges
                        .sort((a, b) => {
                          const [dA, mA, yA] = a.data_cobranca.split("/").map(Number);
                          const [dB, mB, yB] = b.data_cobranca.split("/").map(Number);
                          return new Date(yA, mA - 1, dA).getTime() - new Date(yB, mB - 1, dB).getTime();
                        })
                        .map((charge) => {
                          const isEditingThis = editingCharge === charge.id;

                          if (isEditingThis) {
                            return (
                              <div key={charge.id} className="p-3 rounded-lg bg-secondary/30 space-y-2">
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <Label className="text-xs">Valor</Label>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      value={chargeEditForm.valor}
                                      onChange={(e) => setChargeEditForm((p) => ({ ...p, valor: e.target.value }))}
                                      className="h-8 text-sm"
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-xs">Data</Label>
                                    <Input
                                      value={chargeEditForm.data_cobranca}
                                      onChange={(e) => setChargeEditForm((p) => ({ ...p, data_cobranca: e.target.value }))}
                                      placeholder="DD/MM/AAAA"
                                      className="h-8 text-sm"
                                    />
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <Label className="text-xs">Status</Label>
                                    <Select value={chargeEditForm.status} onValueChange={(v) => setChargeEditForm((p) => ({ ...p, status: v }))}>
                                      <SelectTrigger className="h-8 text-sm">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="pendente">Pendente</SelectItem>
                                        <SelectItem value="atrasado">Atrasado</SelectItem>
                                        <SelectItem value="paga">Pago</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="flex items-end gap-2">
                                    <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={chargeEditForm.recorrente}
                                        onChange={(e) => setChargeEditForm((p) => ({ ...p, recorrente: e.target.checked }))}
                                        className="rounded"
                                      />
                                      Recorrente
                                    </label>
                                  </div>
                                </div>
                                {chargeEditForm.recorrente && (
                                  <div>
                                    <Label className="text-xs">Meses restantes</Label>
                                    <Input
                                      type="number"
                                      min={0}
                                      max={60}
                                      value={chargeEditForm.meses_restantes}
                                      onChange={(e) => setChargeEditForm((p) => ({ ...p, meses_restantes: e.target.value }))}
                                      className="h-8 text-sm w-24"
                                    />
                                  </div>
                                )}
                                <div className="flex gap-2">
                                  <Button size="sm" onClick={saveChargeEdit} className="gap-1"><Check className="w-3 h-3" /> Salvar</Button>
                                  <Button size="sm" variant="outline" onClick={() => setEditingCharge(null)}><X className="w-3 h-3" /></Button>
                                </div>
                              </div>
                            );
                          }

                          return (
                            <div key={charge.id} className="flex items-center justify-between py-1.5 px-2 rounded bg-secondary/20">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">{charge.data_cobranca}</span>
                                {getStatusBadge(charge.status)}
                                {charge.recorrente && <Repeat className="w-3 h-3 text-muted-foreground" />}
                                {charge.recorrente && charge.meses_restantes != null && charge.meses_restantes > 0 && (
                                  <Badge variant="outline" className="text-[9px] px-1.5 py-0">{charge.meses_restantes} {charge.meses_restantes === 1 ? "mês" : "meses"}</Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm font-medium">{formatCurrency(charge.valor)}</span>
                                {!isViewer && (
                                  <>
                                    {charge.status !== "paga" && (
                                      <>
                                        <Button size="sm" variant="ghost" className="h-6 px-1.5 text-xs" onClick={() => handleMarkPaid(charge.id)} title="Marcar como pago">
                                          <Check className="w-3 h-3" />
                                        </Button>
                                        <Button size="sm" variant="ghost" className="h-6 px-1.5 text-xs" onClick={() => sendBillingEmail(charge.id)} title="Enviar e-mail">
                                          <Send className="w-3 h-3" />
                                        </Button>
                                      </>
                                    )}
                                    <Button size="sm" variant="ghost" className="h-6 px-1.5 text-xs" onClick={() => startChargeEdit(charge)} title="Editar">
                                      <Pencil className="w-3 h-3" />
                                    </Button>
                                    <Button size="sm" variant="ghost" className="h-6 px-1.5 text-xs text-destructive" onClick={() => setDeleteConfirm({ id: charge.id, recorrente: charge.recorrente })} title="Excluir">
                                      <Trash2 className="w-3 h-3" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ClientsView;
