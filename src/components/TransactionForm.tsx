import { useState, useRef, useEffect, useCallback } from "react";
import { formatCurrency, type CategoryCode, type TransactionType, type FormaPagamento, type RecurrenceType } from "@/data/cashflow";
import { useTransactions } from "@/context/TransactionsContext";
import { useOrganization } from "@/context/OrganizationContext";
import { useCategories } from "@/context/CategoriesContext";
import { useSubcategories } from "@/context/SubcategoriesContext";
import { supabase } from "@/integrations/supabase/client";
import { Plus, ArrowUp, ArrowDown, FileText, Camera, Image, X, Loader2, Check, Pencil, Upload, Building2, Tag, Sparkles, Trash2, CreditCard, QrCode, Copy, Repeat, UserPlus, Mail, Phone, ChevronsUpDown } from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { parseFile, extractPDFText, parsePDFText, type ParsedBankEntry } from "@/lib/bankParser";
import { uploadChargeAttachment, validateAttachment } from "@/lib/billingAttachments";
import { Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";

interface NewTransaction {
  empresa: string;
  valor: string;
  data: string;
  categoria: CategoryCode;
  subcategoria: string;
  tipo: TransactionType;
  pago: boolean;
  forma_pagamento: FormaPagamento;
  pix_code: string;
  recurrence_type: RecurrenceType;
}

interface Fornecedor {
  id: string;
  nome: string;
  forma_pagamento: FormaPagamento | null;
  pix_code: string | null;
  categoria: CategoryCode | null;
}

interface ImportedEntry {
  id: number;
  empresa: string;
  valor: string;
  data: string;
  categoria: CategoryCode;
  tipo: TransactionType;
  pago: boolean;
  approved: boolean;
  fileName: string;
}

const TransactionForm = () => {
  const { transactions, dailyIncomes, addTransaction, addDailyIncome, deleteTransactionsByDateRange, deleteDailyIncomesByDateRange, reassignCategory, updateTransaction, deleteDailyIncome } = useTransactions();
  const { organization } = useOrganization();
  const { categories, addCategory, deleteCategory, findCategoryByKeyword, addMapping } = useCategories();
  const { subcategories, addSubcategory, getSubcategoriesByCategory } = useSubcategories();
  const { toast } = useToast();
  const [newCategoryName, setNewCategoryName] = useState("");
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [activeSection, setActiveSection] = useState<"form" | "import" | "bank">("form");
  const [uploadedImages, setUploadedImages] = useState<{ file: File; preview: string }[]>([]);
  const [importedEntries, setImportedEntries] = useState<ImportedEntry[]>([]);
  const [editingImportId, setEditingImportId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [ddaProcessing, setDdaProcessing] = useState(false);
  
  // Load fornecedores from DB
  useEffect(() => {
    const loadFornecedores = async () => {
      const { data } = await supabase.from("fornecedores").select("*");
      if (data) setFornecedores(data.map((f: any) => ({ id: f.id, nome: f.nome, forma_pagamento: f.forma_pagamento || null, pix_code: f.pix_code || null, categoria: f.categoria || null })));
    };
    loadFornecedores();
  }, []);

  const saveFornecedor = useCallback(async (nome: string, forma_pagamento: FormaPagamento | null, pix_code: string | null, categoria: CategoryCode | null) => {
    if (!nome.trim()) return;
    const upsertData: any = { nome: nome.trim() };
    if (forma_pagamento) upsertData.forma_pagamento = forma_pagamento;
    if (pix_code) upsertData.pix_code = pix_code;
    if (categoria) upsertData.categoria = categoria;

    const { data, error } = await supabase
      .from("fornecedores")
      .upsert(upsertData, { onConflict: "nome" })
      .select()
      .single();

    if (error) {
      console.error("Erro ao salvar fornecedor:", error);
      return;
    }
    if (data) {
      setFornecedores(prev => {
        const exists = prev.some(f => f.id === data.id);
        const mapped = { id: data.id, nome: data.nome, forma_pagamento: (data.forma_pagamento as FormaPagamento) || null, pix_code: data.pix_code || null, categoria: (data as any).categoria || null };
        return exists ? prev.map(f => f.id === data.id ? mapped : f) : [...prev, mapped];
      });
    }
  }, []);

  const [form, setForm] = useState<NewTransaction>({
    empresa: "",
    valor: "",
    data: "",
    categoria: "C",
    subcategoria: "",
    tipo: "saida",
    pago: false,
    forma_pagamento: "",
    pix_code: "",
    recurrence_type: null,
  });

  // Billing client state (for "entrada" type)
  const [showBilling, setShowBilling] = useState(false);
  const [billingClient, setBillingClient] = useState({
    nome: "",
    email: "",
    telefone: "",
    forma_cobranca: "",
    recorrente: false,
    meses_recorrencia: 12,
  });
  const [existingClients, setExistingClients] = useState<{ id: string; nome: string; email: string; telefone: string | null; forma_cobranca: string | null }[]>([]);
  const [clientPopoverOpen, setClientPopoverOpen] = useState(false);
  const [boletoFile, setBoletoFile] = useState<File | null>(null);
  const [nfFile, setNfFile] = useState<File | null>(null);

  // Doc reader (boleto/NF → preencher cobrança)
  const [readerOpen, setReaderOpen] = useState(false);
  const [readerBoleto, setReaderBoleto] = useState<File | null>(null);
  const [readerNf, setReaderNf] = useState<File | null>(null);
  const [readerLoading, setReaderLoading] = useState(false);
  const [readerExtracted, setReaderExtracted] = useState<{
    cliente_nome: string;
    cliente_email: string;
    cliente_telefone: string;
    valor: string;
    data_vencimento: string;
    descricao: string;
    forma_cobranca: string;
    matched: boolean;
  } | null>(null);

  // Fetch existing billing clients (scoped to active organization) when billing section opens
  useEffect(() => {
    if (!showBilling || !organization?.id) return;
    const orgId = organization.id;
    const fetchClients = async () => {
      const { data } = await supabase
        .from("billing_clients")
        .select("id, nome, email, telefone, forma_cobranca")
        .eq("organization_id", orgId);
      if (data) setExistingClients(data);
    };
    fetchClients();
  }, [showBilling, organization?.id]);
  const [recentEntries, setRecentEntries] = useState<NewTransaction[]>([]);
  const [bankEntries, setBankEntries] = useState<ParsedBankEntry[]>([]);
  const bankInputRef = useRef<HTMLInputElement>(null);

  const [bankFileLoading, setBankFileLoading] = useState(false);
  const [bankFileName, setBankFileName] = useState<string | null>(null);

  // Import mode dialog state
  const [showImportModeDialog, setShowImportModeDialog] = useState(false);
  const [pendingParsedEntries, setPendingParsedEntries] = useState<ParsedBankEntry[]>([]);
  const [pendingImportPeriod, setPendingImportPeriod] = useState<{ start: string; end: string } | null>(null);
  const [importFilter, setImportFilter] = useState<"all" | "entrada" | "saida">("all");

  // Date-change approval dialog state
  type DateChangeCandidate = {
    key: string;
    kind: "move" | "reschedule";
    existingId: number;
    empresa: string;
    valor: number;
    oldDate: string; // BR dd/mm/yyyy
    newDate: string; // BR dd/mm/yyyy
    categoria: CategoryCode;
    subcategoria: string | null;
    entryId?: number;
  };
  const [showDateApprovalDialog, setShowDateApprovalDialog] = useState(false);
  const [dateCandidates, setDateCandidates] = useState<DateChangeCandidate[]>([]);
  const [approvedKeys, setApprovedKeys] = useState<Set<string>>(new Set());
  const [pendingCommit, setPendingCommit] = useState<{
    enriched: ParsedBankEntry[];
    scheduledUnpaid: Array<{ id: number; empresa: string; valor: number; data: string; categoria: string; subcategoria: string | null }>;
  } | null>(null);

  // Match approval dialog state (cobranças/agendados identificados)
  const [showMatchApprovalDialog, setShowMatchApprovalDialog] = useState(false);
  const [pendingMatchEntries, setPendingMatchEntries] = useState<ParsedBankEntry[]>([]);
  const [pendingMatchReschedules, setPendingMatchReschedules] = useState<Array<{ id: number; empresa: string; valor: number; data: string; categoria: string; subcategoria: string | null }>>([]);
  const [approvedMatchIds, setApprovedMatchIds] = useState<Set<number>>(new Set());
  const [availableCharges, setAvailableCharges] = useState<Array<{ id: string; valor: number; data_cobranca: string; client_id: string; client_nome: string }>>([]);
  const [openChargePopoverId, setOpenChargePopoverId] = useState<number | null>(null);

  const handleChangeChargeLink = (entryId: number, newChargeId: string | null) => {
    let displacedEntryId: number | null = null;
    setPendingMatchEntries((prev) => prev.map((e) => {
      // Desvincular qualquer outra entry que esteja usando essa cobrança (transferência)
      if (newChargeId !== null && e.id !== entryId && e.matchedChargeId === newChargeId) {
        displacedEntryId = e.id;
        const { matchedChargeId, matchedChargeClient, matchedFrom, ...rest } = e;
        return rest as ParsedBankEntry;
      }
      if (e.id !== entryId) return e;
      if (newChargeId === null) {
        const { matchedChargeId, matchedChargeClient, matchedFrom, ...rest } = e;
        return rest as ParsedBankEntry;
      }
      const ch = availableCharges.find((c) => c.id === newChargeId);
      if (!ch) return e;
      return {
        ...e,
        matchedChargeId: newChargeId,
        matchedChargeClient: ch.client_nome,
        matchedFrom: `Cobrança vinculada manualmente: ${ch.client_nome}`,
      };
    }));
    setApprovedMatchIds((prev) => {
      const next = new Set(prev);
      if (newChargeId === null) next.delete(entryId);
      else next.add(entryId);
      if (displacedEntryId !== null) next.delete(displacedEntryId);
      return next;
    });
    setOpenChargePopoverId(null);
  };


  const getDateRange = (entries: ParsedBankEntry[]): { start: string; end: string } => {
    const dates = entries.map((e) => e.data).sort();
    return { start: dates[0], end: dates[dates.length - 1] };
  };

  const isoToBR = (iso: string) => {
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  };
  const brToISO = (br: string) => {
    const [d, m, y] = br.split("/");
    return `${y}-${m}-${d}`;
  };

  const commitImport = (
    finalEntries: ParsedBankEntry[],
    scheduledUnpaidToReschedule: Array<{ id: number; empresa: string; valor: number; data: string; categoria: string; subcategoria: string | null }>,
  ) => {
    if (scheduledUnpaidToReschedule.length > 0) {
      scheduledUnpaidToReschedule.forEach((t) => {
        const [day, month, year] = t.data.split("/").map(Number);
        const nextDay = new Date(year, month - 1, day + 1);
        const newDate = `${String(nextDay.getDate()).padStart(2, "0")}/${String(nextDay.getMonth() + 1).padStart(2, "0")}/${nextDay.getFullYear()}`;
        addTransaction({
          empresa: t.empresa,
          valor: t.valor,
          data: newDate,
          categoria: t.categoria as CategoryCode,
          subcategoria: t.subcategoria || null,
          pago: false,
          agendado: true,
          tipo: "saida",
        });
      });
      toast({
        title: `${scheduledUnpaidToReschedule.length} conta(s) reagendada(s)`,
        description: "Contas agendadas não pagas foram transferidas para o dia seguinte.",
      });
    }

    setBankEntries((prev) => [...prev, ...finalEntries]);
    setShowImportModeDialog(false);
    setPendingParsedEntries([]);
    setPendingImportPeriod(null);
    setImportFilter("all");
  };

  const detectMatches = async (entries: ParsedBankEntry[]): Promise<Array<{ id: string; valor: number; data_cobranca: string; client_id: string; client_nome: string }>> => {
    const orgId = organization?.id;
    if (!orgId) return [];
    let chargesOut: Array<{ id: string; valor: number; data_cobranca: string; client_id: string; client_nome: string }> = [];

    // Charges: entradas vs billing_charges pendentes/atrasados
    const entradas = entries.filter((e) => e.tipo === "entrada");
    if (entradas.length > 0) {
      const { data: charges } = await supabase
        .from("billing_charges")
        .select("id, valor, data_cobranca, client_id, status")
        .eq("organization_id", orgId)
        .in("status", ["pendente", "atrasado"]);

      if (charges && charges.length > 0) {
        const clientIds = Array.from(new Set(charges.map((c: any) => c.client_id)));
        const { data: clients } = await supabase
          .from("billing_clients")
          .select("id, nome")
          .in("id", clientIds);
        const clientMap = new Map<string, string>((clients || []).map((c: any) => [c.id, c.nome]));

        chargesOut = (charges as any[]).map((c) => ({
          id: c.id,
          valor: Number(c.valor),
          data_cobranca: c.data_cobranca,
          client_id: c.client_id,
          client_nome: clientMap.get(c.client_id) || "cliente",
        }));
        setAvailableCharges(chargesOut);

        const usedCharges = new Set<string>();
        for (const e of entradas) {
          const entryTs = new Date(e.data).getTime();
          const cands = (charges as any[])
            .filter((c) => !usedCharges.has(c.id) && Math.abs(Number(c.valor) - e.valor) < 0.01)
            .map((c) => {
              const cISO = c.data_cobranca && /^\d{4}-\d{2}-\d{2}$/.test(c.data_cobranca)
                ? c.data_cobranca
                : c.data_cobranca && /^\d{2}\/\d{2}\/\d{4}$/.test(c.data_cobranca)
                  ? brToISO(c.data_cobranca)
                  : null;
              const diff = cISO ? Math.abs(new Date(cISO).getTime() - entryTs) : Number.MAX_SAFE_INTEGER;
              return { c, diff };
            })
            .sort((a, b) => a.diff - b.diff);
          if (cands.length > 0) {
            const c = cands[0].c;
            usedCharges.add(c.id);
            e.matchedChargeId = c.id;
            e.matchedChargeClient = clientMap.get(c.client_id) || "cliente";
            e.matchedFrom = `Cobrança identificada: ${e.matchedChargeClient}`;
          }
        }
      } else {
        setAvailableCharges([]);
      }
    }

    // Scheduled unpaid: saidas vs transactions agendado=true pago=false
    const saidas = entries.filter((e) => e.tipo === "saida" && !e.matchedTransactionId);
    if (saidas.length > 0) {
      const usedTx = new Set<number>();
      for (const e of saidas) {
        const entryTs = new Date(e.data).getTime();
        const cands = transactions
          .filter(
            (t) =>
              t.tipo === "saida" &&
              t.agendado &&
              !t.pago &&
              !usedTx.has(t.id) &&
              Math.abs(t.valor - e.valor) < 0.01,
          )
          .map((t) => ({ t, diff: Math.abs(new Date(brToISO(t.data)).getTime() - entryTs) }))
          .filter((x) => x.diff <= 30 * 86400000)
          .sort((a, b) => a.diff - b.diff);
        if (cands.length > 0) {
          const t = cands[0].t;
          usedTx.add(t.id);
          e.matchedTransactionId = t.id;
          e.matchedTransactionEmpresa = t.empresa;
          e.matchedTransactionDate = t.data;
          if (!e.matchedFrom) e.matchedFrom = `Agendado identificado: ${t.empresa} (${t.data})`;
        }
      }
    }
    return chargesOut;
  };

  const finalizeImport = async (
    enriched: ParsedBankEntry[],
    scheduledUnpaidToReschedule: Array<{ id: number; empresa: string; valor: number; data: string; categoria: string; subcategoria: string | null }>,
    skipEntryIds: Set<number> = new Set(),
  ) => {
    const finalEntries = skipEntryIds.size > 0 ? enriched.filter((e) => !skipEntryIds.has(e.id)) : enriched;

    // Detect matches against billing_charges + scheduled unpaid transactions
    const chargesList = await detectMatches(finalEntries);

    const matched = finalEntries.filter((e) => e.matchedChargeId || e.matchedTransactionId);
    const unmatchedEntradas = finalEntries.filter((e) => e.tipo === "entrada" && !e.matchedChargeId);
    const hasLinkableCharges = unmatchedEntradas.length > 0 && chargesList.length > 0;
    if (matched.length > 0 || hasLinkableCharges) {
      setPendingMatchEntries(finalEntries);
      setPendingMatchReschedules(scheduledUnpaidToReschedule);
      setApprovedMatchIds(new Set(matched.map((e) => e.id)));
      setShowMatchApprovalDialog(true);
      return;
    }

    commitImport(finalEntries, scheduledUnpaidToReschedule);
  };

  const applyImportEntries = (entries: ParsedBankEntry[], mode: "add" | "replace") => {
    // Filter entries based on importFilter
    const filtered = importFilter === "all" ? entries : entries.filter((e) => e.tipo === importFilter);
    if (filtered.length === 0) {
      toast({ title: "Nenhuma transação para importar", description: "Nenhuma transação corresponde ao filtro selecionado.", variant: "destructive" });
      setShowImportModeDialog(false);
      return;
    }

    // Save existing transactions before replacing, for smart matching
    let existingTxForPeriod: typeof transactions = [];
    if (mode === "replace" && pendingImportPeriod) {
      existingTxForPeriod = transactions.filter((t) => {
        const iso = brToISO(t.data);
        return iso >= pendingImportPeriod.start && iso <= pendingImportPeriod.end;
      });

      if (importFilter === "all" || importFilter === "saida") {
        deleteTransactionsByDateRange(pendingImportPeriod.start, pendingImportPeriod.end);
      }
      if (importFilter === "all" || importFilter === "entrada") {
        deleteDailyIncomesByDateRange(pendingImportPeriod.start, pendingImportPeriod.end);
      }
      toast({ title: "Período limpo", description: "As transações antigas foram removidas. Revise e aprove os novos lançamentos abaixo." });
    } else if (mode === "add") {
      // For "add" mode, look at all existing saidas to detect possible date moves
      existingTxForPeriod = transactions.filter((t) => t.tipo === "saida");
    }

    // Detect candidates needing approval (date change scenarios)
    const candidates: DateChangeCandidate[] = [];
    const usedExistingIds = new Set<number>();
    const enriched = filtered.map((entry) => {
      let matchedExisting: (typeof transactions)[0] | undefined;
      if (entry.tipo === "saida" && existingTxForPeriod.length > 0) {
        if (mode === "replace") {
          matchedExisting = existingTxForPeriod.find(
            (t) => t.tipo === "saida" && Math.abs(t.valor - entry.valor) < 0.01 && !usedExistingIds.has(t.id),
          );
        } else {
          // add mode: require matching value AND similar empresa AND date within ±15 days
          const entryISO = entry.data;
          const entryDate = new Date(entryISO);
          const entryDescLower = entry.empresa.toLowerCase().trim();
          matchedExisting = existingTxForPeriod.find((t) => {
            if (Math.abs(t.valor - entry.valor) > 0.01) return false;
            if (usedExistingIds.has(t.id)) return false;
            const tISO = brToISO(t.data);
            if (tISO === entryISO) return false; // same date = treat as duplicate, not a move
            const tDate = new Date(tISO);
            const diffDays = Math.abs((tDate.getTime() - entryDate.getTime()) / 86400000);
            if (diffDays > 15) return false;
            const tDescLower = t.empresa.toLowerCase().trim();
            return tDescLower.includes(entryDescLower) || entryDescLower.includes(tDescLower) || tDescLower === entryDescLower;
          });
        }
        if (matchedExisting) {
          usedExistingIds.add(matchedExisting.id);
        }
      }

      if (matchedExisting) {
        const oldISO = brToISO(matchedExisting.data);
        // If dates differ, register an approval candidate
        if (oldISO !== entry.data) {
          candidates.push({
            key: `move-${matchedExisting.id}-${entry.id}`,
            kind: "move",
            existingId: matchedExisting.id,
            empresa: matchedExisting.empresa,
            valor: matchedExisting.valor,
            oldDate: matchedExisting.data,
            newDate: isoToBR(entry.data),
            categoria: matchedExisting.categoria as CategoryCode,
            subcategoria: matchedExisting.subcategoria || null,
            entryId: entry.id,
          });
        }
        return {
          ...entry,
          empresa: matchedExisting.empresa,
          categoria: matchedExisting.categoria as CategoryCode,
          pago: matchedExisting.pago,
          matchedFrom: `Sugestão: ${matchedExisting.empresa} (lançamento anterior)`,
        };
      }

      const matchedCat = findCategoryByKeyword(entry.empresa);
      return matchedCat ? { ...entry, categoria: matchedCat } : entry;
    });

    // Detect scheduled unpaid bills not in extract → reschedule candidates
    const scheduledUnpaid =
      mode === "replace" && pendingImportPeriod
        ? existingTxForPeriod.filter(
            (t) => t.agendado && !t.pago && t.tipo === "saida" && !usedExistingIds.has(t.id),
          )
        : [];

    scheduledUnpaid.forEach((t) => {
      const [day, month, year] = t.data.split("/").map(Number);
      const nextDay = new Date(year, month - 1, day + 1);
      const newDate = `${String(nextDay.getDate()).padStart(2, "0")}/${String(nextDay.getMonth() + 1).padStart(2, "0")}/${nextDay.getFullYear()}`;
      candidates.push({
        key: `resched-${t.id}`,
        kind: "reschedule",
        existingId: t.id,
        empresa: t.empresa,
        valor: t.valor,
        oldDate: t.data,
        newDate,
        categoria: t.categoria as CategoryCode,
        subcategoria: t.subcategoria || null,
      });
    });

    const scheduledForCommit = scheduledUnpaid.map((t) => ({
      id: t.id,
      empresa: t.empresa,
      valor: t.valor,
      data: t.data,
      categoria: t.categoria,
      subcategoria: t.subcategoria || null,
    }));

    if (candidates.length > 0) {
      // Pause: ask user for approval before applying date changes
      setDateCandidates(candidates);
      setApprovedKeys(new Set(candidates.map((c) => c.key))); // default: all approved
      setPendingCommit({ enriched, scheduledUnpaid: scheduledForCommit });
      setShowDateApprovalDialog(true);
      return;
    }

    finalizeImport(enriched, scheduledForCommit);
  };

  const handleBankFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    const ext = file.name.toLowerCase().split(".").pop();

    if (ext === "pdf") {
      setBankFileName(file.name);
      setBankFileLoading(true);
      try {
        const text = await extractPDFText(file);
        const parsed = parsePDFText(text);
        if (parsed.length === 0) {
          toast({ title: "Nenhuma transação encontrada", description: "O PDF pode não ser um extrato bancário compatível.", variant: "destructive" });
          setBankFileLoading(false);
          setBankFileName(null);
          return;
        }
        // Show dialog asking add or replace
        const period = getDateRange(parsed);
        setPendingParsedEntries(parsed);
        setPendingImportPeriod(period);
        setShowImportModeDialog(true);
      } catch (err) {
        console.error("PDF parse error:", err);
        toast({ title: "Erro ao ler PDF", description: "Não foi possível processar este arquivo.", variant: "destructive" });
      }
      setBankFileLoading(false);
      return;
    }

    // OFX/CSV: text-based
    const reader = new FileReader();
    reader.onload = () => {
      const content = reader.result as string;
      const parsed = parseFile(file.name, content);
      if (parsed.length === 0) {
        toast({ title: "Nenhuma transação encontrada", description: "Verifique se o formato do arquivo é OFX, CSV ou PDF.", variant: "destructive" });
        return;
      }
      const period = getDateRange(parsed);
      setPendingParsedEntries(parsed);
      setPendingImportPeriod(period);
      setShowImportModeDialog(true);
      setBankFileName(file.name);
    };
    reader.readAsText(file);
  };

  const updateBankEntry = (id: number, field: keyof ParsedBankEntry, value: any) => {
    setBankEntries((prev) => prev.map((e) => (e.id === id ? { ...e, [field]: value } : e)));
  };

  const approveBankEntry = async (id: number) => {
    const entry = bankEntries.find((e) => e.id === id);
    if (!entry || !entry.empresa || entry.valor <= 0) {
      toast({ title: "Preencha descrição e valor antes de aprovar", variant: "destructive" });
      return;
    }
    const [y, m, d] = entry.data.split("-");
    const dataBR = `${d}/${m}/${y}`;
    let saved = false;

    // If matched a scheduled unpaid transaction → mark it paid (no duplicate)
    if (entry.tipo === "saida" && entry.matchedTransactionId) {
      try {
        await updateTransaction(entry.matchedTransactionId, { pago: true, data: dataBR });
        saved = true;
      } catch (err) {
        console.error("Erro ao marcar agendado como pago:", err);
      }
    } else if (entry.tipo === "entrada" && entry.matchedChargeId) {
      // Cobrança vinculada → marcar paga e ajustar data_cobranca para o dia da entrada (sem duplicar lançamento)
      const { error } = await supabase
        .from("billing_charges")
        .update({ status: "paga", data_cobranca: dataBR })
        .eq("id", entry.matchedChargeId);
      if (!error) {
        saved = true;
        updateBankEntry(id, "approved", true);
        toast({
          title: "Cobrança quitada",
          description: `${entry.empresa} — ${formatCurrency(entry.valor)} | Cobrança de ${entry.matchedChargeClient || "cliente"} marcada como paga em ${dataBR} (sem duplicar lançamento)`,
        });
        return;
      }
    } else if (entry.tipo === "entrada") {
      saved = await addDailyIncome({ data: dataBR, valor: entry.valor });
    } else {
      saved = await addTransaction({ empresa: entry.empresa, valor: entry.valor, data: dataBR, categoria: entry.categoria, subcategoria: entry.subcategoria || null, pago: true, agendado: false, tipo: "saida" });
    }

    if (!saved) {
      toast({ title: "Erro ao salvar lançamento", description: "A aprovação não foi concluída.", variant: "destructive" });
      return;
    }

    updateBankEntry(id, "approved", true);
    if (entry.tipo === "saida" && entry.empresa && !entry.matchedTransactionId) {
      addMapping(entry.empresa, entry.categoria);
    }


    if (entry.tipo === "saida" && entry.matchedTransactionId) {
      toast({
        title: "Conta agendada quitada",
        description: `${entry.matchedTransactionEmpresa || entry.empresa} — ${formatCurrency(entry.valor)} marcada como paga.`,
      });
      return;
    }

    toast({ title: "Lançamento aprovado", description: `${entry.empresa} — ${formatCurrency(entry.valor)}` });
  };

  const approveAllBankEntries = async () => {
    const pending = bankEntries.filter((e) => !e.approved && e.empresa && e.valor > 0);
    // Deduplicate fornecedores (apenas para itens sem match agendado)
    const uniqueSuppliers = new Map<string, typeof pending[0]>();
    for (const entry of pending) {
      if (entry.tipo === "saida" && entry.empresa && !entry.matchedTransactionId) {
        uniqueSuppliers.set(entry.empresa.toLowerCase(), entry);
      }
    }
    for (const entry of uniqueSuppliers.values()) {
      await saveFornecedor(entry.empresa, null, null, entry.categoria as CategoryCode);
      addMapping(entry.empresa, entry.categoria);
    }

    const approvedIds = new Set<number>();
    let chargesMarked = 0;
    let scheduledMarked = 0;
    for (const entry of pending) {
      const [y, m, d] = entry.data.split("-");
      const dataBR = `${d}/${m}/${y}`;
      let saved = false;

      if (entry.tipo === "saida" && entry.matchedTransactionId) {
        try {
          await updateTransaction(entry.matchedTransactionId, { pago: true, data: dataBR });
          saved = true;
          scheduledMarked++;
        } catch (err) {
          console.error(err);
        }
      } else if (entry.tipo === "entrada" && entry.matchedChargeId) {
        // Cobrança vinculada → marcar paga e ajustar data_cobranca para o dia da entrada (sem duplicar)
        const { error } = await supabase
          .from("billing_charges")
          .update({ status: "paga", data_cobranca: dataBR })
          .eq("id", entry.matchedChargeId);
        if (!error) {
          saved = true;
          chargesMarked++;
        }
      } else if (entry.tipo === "entrada") {
        saved = await addDailyIncome({ data: dataBR, valor: entry.valor });
      } else {
        saved = await addTransaction({ empresa: entry.empresa, valor: entry.valor, data: dataBR, categoria: entry.categoria, subcategoria: entry.subcategoria || null, pago: true, agendado: false, tipo: "saida" });
      }

      if (saved) {
        approvedIds.add(entry.id);
      }
    }
    setBankEntries((prev) => prev.map((e) => approvedIds.has(e.id) ? { ...e, approved: true } : e));
    const extras: string[] = [];
    if (chargesMarked > 0) extras.push(`${chargesMarked} cobrança(s) quitada(s)`);
    if (scheduledMarked > 0) extras.push(`${scheduledMarked} agendado(s) marcado(s) como pago`);
    toast({
      title: `${approvedIds.size} lançamentos aprovados`,
      description: [
        approvedIds.size !== pending.length ? "Alguns itens não foram salvos e permaneceram pendentes." : null,
        extras.join(" · ") || null,
      ].filter(Boolean).join(" · ") || undefined,
      variant: approvedIds.size === pending.length ? undefined : "destructive",
    });
  };

  const handleCreateCategory = () => {
    if (!newCategoryName.trim()) return;
    const newCat = addCategory(newCategoryName.trim());
    setNewCategoryName("");
    setShowNewCategory(false);
    toast({ title: "Categoria criada", description: newCat.name });
    return newCat;
  };

  // Convert YYYY-MM-DD to DD/MM/YYYY
  const formatDateToBR = (dateStr: string) => {
    if (!dateStr) return dateStr;
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) return dateStr;
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const [y, m, d] = dateStr.split("-");
      return `${d}/${m}/${y}`;
    }
    return dateStr;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.empresa || !form.valor || !form.data) {
      toast({ title: "Preencha todos os campos obrigatórios", variant: "destructive" });
      return;
    }

    const valor = parseFloat(form.valor);
    const dataBR = formatDateToBR(form.data);
    const recurrenceGroupId = form.recurrence_type ? crypto.randomUUID() : null;

    const generateRecurringDates = (startDate: string, type: RecurrenceType): string[] => {
      if (!type) return [formatDateToBR(startDate)];
      const [y, m, d] = startDate.split("-").map(Number);
      const dates: string[] = [];
      const baseDate = new Date(y, m - 1, d);
      
      // Generate 12 occurrences for monthly, 4 weeks for weekly, 30 days for daily
      const count = type === "monthly" ? 12 : type === "weekly" ? 12 : 30;
      
      for (let i = 0; i < count; i++) {
        const date = new Date(baseDate);
        if (type === "daily") date.setDate(date.getDate() + i);
        else if (type === "weekly") date.setDate(date.getDate() + i * 7);
        else if (type === "monthly") date.setMonth(date.getMonth() + i);
        
        const dd = String(date.getDate()).padStart(2, "0");
        const mm = String(date.getMonth() + 1).padStart(2, "0");
        const yyyy = date.getFullYear();
        dates.push(`${dd}/${mm}/${yyyy}`);
      }
      return dates;
    };

    if (form.tipo === "entrada") {
      // If user enabled billing link but didn't fill required fields, block save
      if (showBilling && (!billingClient.nome.trim() || !billingClient.email.trim())) {
        toast({
          title: "Dados do cliente incompletos",
          description: "Preencha nome e e-mail do cliente, ou desmarque 'Vincular cliente para cobrança'.",
          variant: "destructive",
        });
        return;
      }

      // If billing is enabled, create client + charges FIRST so failures don't leave orphan income
      if (showBilling && billingClient.nome && billingClient.email) {
        if (!organization?.id) {
          toast({ title: "Empresa não carregada", description: "Aguarde a organização ser carregada e tente novamente.", variant: "destructive" });
          return;
        }
        const orgId = organization.id;

        try {
          // Look up existing client BY EMAIL within this organization
          const { data: existingInOrg } = await supabase
            .from("billing_clients")
            .select("id")
            .eq("email", billingClient.email.trim())
            .eq("organization_id", orgId)
            .limit(1);

          let clientId: string;

          if (existingInOrg && existingInOrg.length > 0) {
            clientId = existingInOrg[0].id;
            await supabase.from("billing_clients").update({
              nome: billingClient.nome.trim(),
              telefone: billingClient.telefone.trim() || null,
              forma_cobranca: billingClient.forma_cobranca || null,
            }).eq("id", clientId);
          } else {
            const { data: clientData, error: clientError } = await supabase
              .from("billing_clients")
              .insert({
                nome: billingClient.nome.trim(),
                email: billingClient.email.trim(),
                telefone: billingClient.telefone.trim() || null,
                forma_cobranca: billingClient.forma_cobranca || null,
                organization_id: orgId,
              })
              .select()
              .single();
            if (clientError) throw clientError;
            clientId = clientData.id;
          }

          // Create charges - use configurable months for recurring
          const chargeCount = billingClient.recorrente ? billingClient.meses_recorrencia : 1;
          const [d, m, y] = dataBR.split("/").map(Number);
          const chargesData = [];
          for (let i = 0; i < chargeCount; i++) {
            const chargeDate = new Date(y, m - 1 + i, d);
            const dd = String(chargeDate.getDate()).padStart(2, "0");
            const mm = String(chargeDate.getMonth() + 1).padStart(2, "0");
            const yyyy = chargeDate.getFullYear();
            chargesData.push({
              client_id: clientId,
              valor,
              data_cobranca: `${dd}/${mm}/${yyyy}`,
              recorrente: billingClient.recorrente,
              status: "pendente",
              email_enviado: false,
              meses_restantes: billingClient.recorrente ? chargeCount - i : null,
              organization_id: orgId,
            });
          }
          const { data: insertedCharges, error: chargesError } = await supabase
            .from("billing_charges")
            .insert(chargesData)
            .select("id, data_cobranca");
          if (chargesError) throw chargesError;

          // Upload attachments to the FIRST charge (chronologically earliest)
          if (insertedCharges && insertedCharges.length && (boletoFile || nfFile)) {
            const sorted = [...insertedCharges].sort((a, b) => {
              const [da, ma, ya] = (a.data_cobranca as string).split("/").map(Number);
              const [db, mb, yb] = (b.data_cobranca as string).split("/").map(Number);
              return new Date(ya, ma - 1, da).getTime() - new Date(yb, mb - 1, db).getTime();
            });
            const firstId = sorted[0].id as string;
            try {
              if (boletoFile) await uploadChargeAttachment(orgId, firstId, "boleto", boletoFile);
              if (nfFile) await uploadChargeAttachment(orgId, firstId, "nf", nfFile);
            } catch (upErr: any) {
              console.error("Erro ao subir anexo:", upErr);
              toast({ title: "Cobrança criada, mas anexo falhou", description: upErr?.message || "Tente anexar novamente na área de Clientes.", variant: "destructive" });
            }
          }

          toast({ title: "Cliente vinculado à cobrança", description: `${billingClient.nome} — ${chargeCount} cobrança(s) criada(s).` });
          setBoletoFile(null);
          setNfFile(null);
        } catch (err: any) {
          console.error("Erro ao salvar cliente de cobrança:", err);
          toast({
            title: "Erro ao cadastrar cobrança",
            description: err?.message || "Não foi possível vincular a cobrança. A entrada não foi salva.",
            variant: "destructive",
          });
          return;
        }
      } else {
        // Plain income (no billing link) — save as daily_income
        const saved = await addDailyIncome({ data: dataBR, valor });
        if (!saved) {
          toast({ title: "Erro ao salvar entrada", description: "Tente novamente.", variant: "destructive" });
          return;
        }
      }
    } else {
      const dates = generateRecurringDates(form.data, form.recurrence_type);
      let savedCount = 0;
      for (const dateStr of dates) {
        const saved = await addTransaction({
          empresa: form.empresa,
          valor,
          data: dateStr,
          categoria: form.categoria,
          subcategoria: form.subcategoria || null,
          pago: form.pago,
          agendado: false,
          tipo: "saida",
          forma_pagamento: form.forma_pagamento || null,
          pix_code: form.forma_pagamento === "pix" ? (form.pix_code || null) : null,
          recurrence_type: form.recurrence_type,
          recurrence_group_id: recurrenceGroupId,
        });
        if (saved) savedCount += 1;
      }

      if (savedCount === 0) {
        toast({ title: "Erro ao salvar lançamento", description: "Nenhum lançamento foi salvo.", variant: "destructive" });
        return;
      }

      // Save mapping for future imports
      addMapping(form.empresa, form.categoria);
      // Save fornecedor payment preferences + category
      await saveFornecedor(form.empresa, form.forma_pagamento || null, form.forma_pagamento === "pix" ? form.pix_code || null : null, form.categoria);
    }

    setRecentEntries((prev) => [form, ...prev].slice(0, 20));
    const recLabel = form.recurrence_type ? ` (recorrente: ${form.recurrence_type === "daily" ? "diário" : form.recurrence_type === "weekly" ? "semanal" : "mensal"})` : "";
    toast({
      title: `${form.tipo === "entrada" ? "Entrada" : "Saída"} registrada${recLabel}`,
      description: `${form.empresa} — ${formatCurrency(valor)}`,
    });
    setForm({ empresa: "", valor: "", data: "", categoria: "C", subcategoria: "", tipo: form.tipo, pago: false, forma_pagamento: "", pix_code: "", recurrence_type: null });
    setShowBilling(false);
    setBillingClient({ nome: "", email: "", telefone: "", forma_cobranca: "", recorrente: false, meses_recorrencia: 12 });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newImages = Array.from(files).map((file) => ({
      file,
      preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : "",
    }));
    setUploadedImages((prev) => [...prev, ...newImages]);
    e.target.value = "";
  };

  const processDDAFiles = async () => {
    if (uploadedImages.length === 0) return;
    setDdaProcessing(true);

    try {
      for (const img of uploadedImages) {
        const file = img.file;

        if (file.type === "application/pdf") {
          // Extract text from PDF and send to AI
          const text = await extractPDFText(file);
          const { data, error } = await supabase.functions.invoke("extract-dda", {
            body: { text, fornecedores },
          });

          if (error) throw error;

          const entries = (data?.entries || []) as Array<{
            empresa: string;
            valor: number;
            data: string;
            boleto?: string;
            categoria?: string;
            forma_pagamento?: string;
          }>;

          if (entries.length === 0) {
            // Fallback: create blank entry for manual fill
            setImportedEntries((prev) => [...prev, {
              id: Date.now() + Math.random() * 10000,
              empresa: "",
              valor: "",
              data: new Date().toISOString().split("T")[0],
              categoria: "C" as CategoryCode,
              tipo: "saida" as TransactionType,
              pago: false,
              approved: false,
              fileName: file.name,
            }]);
            toast({ title: "Nenhum título encontrado", description: "Preencha manualmente os dados do DDA.", variant: "destructive" });
          } else {
            const newEntries: ImportedEntry[] = entries.map((entry, idx) => ({
              id: Date.now() + idx + Math.random() * 10000,
              empresa: entry.empresa || "",
              valor: String(entry.valor || ""),
              data: entry.data || new Date().toISOString().split("T")[0],
              categoria: (entry.categoria || "O") as CategoryCode,
              tipo: "saida" as TransactionType,
              pago: false,
              approved: false,
              fileName: file.name,
            }));
            // Filter out duplicates before showing
            const uniqueEntries = newEntries.filter(e => {
              const valor = parseFloat(String(e.valor).replace(",", ".")) || 0;
              const dataBR = e.data.includes("/") ? e.data : e.data.split("-").reverse().join("/");
              return !transactions.some(t =>
                t.empresa.toLowerCase().trim() === e.empresa.toLowerCase().trim() &&
                t.data === dataBR &&
                Math.abs(t.valor - valor) < 0.01
              );
            });
            const skipped = newEntries.length - uniqueEntries.length;
            if (skipped > 0) {
              toast({ title: `${skipped} lançamento(s) duplicado(s) ignorado(s)`, description: "Já existem no sistema.", variant: "destructive" });
            }
            setImportedEntries((prev) => [...prev, ...uniqueEntries]);

            // Save fornecedores with AI-detected categories
            for (const entry of entries) {
              if (entry.empresa && entry.categoria) {
                await saveFornecedor(
                  entry.empresa,
                  (entry.forma_pagamento || "boleto") as FormaPagamento,
                  null,
                  (entry.categoria || "O") as CategoryCode
                );
              }
            }

            toast({ title: `${entries.length} conta(s) identificada(s)`, description: "Revise e aprove os lançamentos abaixo." });
          }
        } else {
          // Image file - send as base64 for AI vision processing
          const base64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const result = reader.result as string;
              resolve(result.split(",")[1] || "");
            };
            reader.readAsDataURL(file);
          });

          const { data, error } = await supabase.functions.invoke("extract-dda", {
            body: { imageBase64: base64, mimeType: file.type, fornecedores },
          });

          if (error) throw error;

          const entries = (data?.entries || []) as Array<{
            empresa: string;
            valor: number;
            data: string;
            boleto?: string;
            categoria?: string;
            forma_pagamento?: string;
          }>;

          if (entries.length === 0) {
            setImportedEntries((prev) => [...prev, {
              id: Date.now() + Math.random() * 10000,
              empresa: "",
              valor: "",
              data: new Date().toISOString().split("T")[0],
              categoria: "C" as CategoryCode,
              tipo: "saida" as TransactionType,
              pago: false,
              approved: false,
              fileName: file.name,
            }]);
            toast({ title: "Nenhum título encontrado na imagem", description: "Preencha manualmente os dados.", variant: "destructive" });
          } else {
            const newEntries: ImportedEntry[] = entries.map((entry, idx) => ({
              id: Date.now() + idx + Math.random() * 10000,
              empresa: entry.empresa || "",
              valor: String(entry.valor || ""),
              data: entry.data || new Date().toISOString().split("T")[0],
              categoria: (entry.categoria || "O") as CategoryCode,
              tipo: "saida" as TransactionType,
              pago: false,
              approved: false,
              fileName: file.name,
            }));
            // Filter out duplicates before showing
            const uniqueEntries = newEntries.filter(e => {
              const valor = parseFloat(String(e.valor).replace(",", ".")) || 0;
              const dataBR = e.data.includes("/") ? e.data : e.data.split("-").reverse().join("/");
              return !transactions.some(t =>
                t.empresa.toLowerCase().trim() === e.empresa.toLowerCase().trim() &&
                t.data === dataBR &&
                Math.abs(t.valor - valor) < 0.01
              );
            });
            const skippedImg = newEntries.length - uniqueEntries.length;
            if (skippedImg > 0) {
              toast({ title: `${skippedImg} lançamento(s) duplicado(s) ignorado(s)`, description: "Já existem no sistema.", variant: "destructive" });
            }
            setImportedEntries((prev) => [...prev, ...uniqueEntries]);

            for (const entry of entries) {
              if (entry.empresa && entry.categoria) {
                await saveFornecedor(
                  entry.empresa,
                  (entry.forma_pagamento || "boleto") as FormaPagamento,
                  null,
                  (entry.categoria || "O") as CategoryCode
                );
              }
            }

            toast({ title: `${entries.length} conta(s) identificada(s) na imagem`, description: "Revise e aprove os lançamentos abaixo." });
          }
        }
      }
    } catch (err) {
      console.error("DDA processing error:", err);
      toast({ title: "Erro ao processar arquivo", description: "Tente novamente.", variant: "destructive" });
    }

    setDdaProcessing(false);
  };

  const removeImage = (idx: number) => {
    setUploadedImages((prev) => {
      const removed = prev[idx];
      if (removed.preview) URL.revokeObjectURL(removed.preview);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const updateImportedEntry = (id: number, field: keyof ImportedEntry, value: any) => {
    setImportedEntries((prev) => prev.map((e) => (e.id === id ? { ...e, [field]: value } : e)));
  };

  // Check if a transaction already exists for the same empresa+data+valor
  const isDuplicateTransaction = useCallback((empresa: string, data: string, valor: number): boolean => {
    return transactions.some(t => 
      t.empresa.toLowerCase().trim() === empresa.toLowerCase().trim() &&
      t.data === data &&
      Math.abs(t.valor - valor) < 0.01
    );
  }, [transactions]);

  const approveEntry = async (id: number) => {
    const entry = importedEntries.find((e) => e.id === id);
    if (!entry || !entry.empresa || !entry.valor) {
      toast({ title: "Preencha empresa e valor antes de aprovar", variant: "destructive" });
      return;
    }
    const valor = parseFloat(entry.valor);
    const dataBR = formatDateToBR(entry.data);

    // Check for duplicate before saving
    if (entry.tipo === "saida" && isDuplicateTransaction(entry.empresa, dataBR, valor)) {
      toast({ title: "Lançamento duplicado", description: `${entry.empresa} já possui um lançamento de ${formatCurrency(valor)} em ${dataBR}. Ignorado.`, variant: "destructive" });
      updateImportedEntry(id, "approved", true);
      return;
    }

    let saved = false;
    if (entry.tipo === "entrada") {
      saved = await addDailyIncome({ data: dataBR, valor });
    } else {
      // Foto/PDF imports always save as pendente (pago=false)
      saved = await addTransaction({
        empresa: entry.empresa,
        valor,
        data: dataBR,
        categoria: entry.categoria,
        pago: false,
        agendado: false,
        tipo: "saida",
      });
    }

    if (!saved) {
      toast({ title: "Erro ao salvar lançamento", description: "A aprovação não foi concluída.", variant: "destructive" });
      return;
    }

    if (entry.tipo === "saida") {
      addMapping(entry.empresa, entry.categoria);
      await saveFornecedor(entry.empresa, "boleto", null, entry.categoria);
    }

    updateImportedEntry(id, "approved", true);
    toast({
      title: "Lançamento aprovado",
      description: `${entry.empresa} — ${formatCurrency(valor)}`,
    });
  };

  const approveAllImportedEntries = async () => {
    const pending = importedEntries.filter((e) => !e.approved && e.empresa && e.valor);
    // Deduplicate fornecedores
    const uniqueSuppliers = new Map<string, typeof pending[0]>();
    for (const entry of pending) {
      if (entry.tipo === "saida" && entry.empresa) {
        uniqueSuppliers.set(entry.empresa.toLowerCase(), entry);
      }
    }
    // Save fornecedores first (deduped)
    for (const entry of uniqueSuppliers.values()) {
      await saveFornecedor(entry.empresa, "boleto", null, entry.categoria);
      addMapping(entry.empresa, entry.categoria);
    }
    // Then save transactions sequentially, checking for duplicates
    const approvedIds = new Set<number>();
    let skippedCount = 0;
    for (const entry of pending) {
      const valor = parseFloat(entry.valor);
      const dataBR = formatDateToBR(entry.data);

      // Skip duplicates
      if (entry.tipo === "saida" && isDuplicateTransaction(entry.empresa, dataBR, valor)) {
        approvedIds.add(entry.id);
        skippedCount++;
        continue;
      }

      let saved = false;
      if (entry.tipo === "entrada") {
        saved = await addDailyIncome({ data: dataBR, valor });
      } else {
        // Foto/PDF imports always save as pendente (pago=false)
        saved = await addTransaction({
          empresa: entry.empresa,
          valor,
          data: dataBR,
          categoria: entry.categoria,
          pago: false,
          agendado: false,
          tipo: "saida",
        });
      }
      if (saved) approvedIds.add(entry.id);
    }
    setImportedEntries((prev) => prev.map((e) => approvedIds.has(e.id) ? { ...e, approved: true } : e));
    const savedCount = approvedIds.size - skippedCount;
    const desc = skippedCount > 0 ? `${skippedCount} duplicado(s) ignorado(s).` : undefined;
    toast({
      title: `${savedCount} lançamento(s) aprovado(s)`,
      description: desc || (approvedIds.size !== pending.length ? "Alguns itens não foram salvos." : undefined),
      variant: approvedIds.size === pending.length ? undefined : "destructive",
    });
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Toggle */}
      <div className="flex gap-1 bg-secondary/50 rounded-lg p-1 w-full sm:w-fit">
        <button
          onClick={() => setActiveSection("form")}
          className={`flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition-all flex-1 sm:flex-none ${
            activeSection === "form" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Manual</span>
        </button>
        <button
          onClick={() => setActiveSection("import")}
          className={`flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition-all flex-1 sm:flex-none ${
            activeSection === "import" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Camera className="w-4 h-4" /> <span className="hidden sm:inline">Foto / PDF</span>
        </button>
        <button
          onClick={() => setActiveSection("bank")}
          className={`flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition-all flex-1 sm:flex-none ${
            activeSection === "bank" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Building2 className="w-4 h-4" /> <span className="hidden sm:inline">Extrato</span>
        </button>
      </div>

      {activeSection === "form" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Form */}
          <div className="rounded-xl bg-card border border-border p-4 sm:p-6">
            <h2 className="font-display font-semibold text-lg mb-4">Novo Lançamento</h2>

            {/* Type toggle */}
            <div className="flex gap-2 mb-5">
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, tipo: "entrada" }))}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-medium transition-all border ${
                  form.tipo === "entrada"
                    ? "bg-income/15 border-income/40 text-income"
                    : "bg-secondary/40 border-transparent text-muted-foreground hover:bg-secondary/70"
                }`}
              >
                <ArrowUp className="w-4 h-4" /> Entrada
              </button>
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, tipo: "saida" }))}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-medium transition-all border ${
                  form.tipo === "saida"
                    ? "bg-expense/15 border-expense/40 text-expense"
                    : "bg-secondary/40 border-transparent text-muted-foreground hover:bg-secondary/70"
                }`}
              >
                <ArrowDown className="w-4 h-4" /> Saída
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="empresa">Empresa / Descrição *</Label>
                <Input
                  id="empresa"
                  value={form.empresa}
                  onChange={(e) => setForm((f) => ({ ...f, empresa: e.target.value }))}
                  onBlur={() => {
                    if (form.empresa.trim()) {
                      const match = fornecedores.find(f => f.nome.toLowerCase() === form.empresa.trim().toLowerCase());
                      if (match) {
                        setForm(f => ({
                          ...f,
                          forma_pagamento: match.forma_pagamento || f.forma_pagamento,
                          pix_code: match.pix_code || f.pix_code,
                          categoria: match.categoria || f.categoria,
                        }));
                      }
                    }
                  }}
                  placeholder="Ex: Rizatti, Salário..."
                  className="mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="valor">Valor (R$) *</Label>
                  <Input
                    id="valor"
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.valor}
                    onChange={(e) => setForm((f) => ({ ...f, valor: e.target.value }))}
                    placeholder="0,00"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="data">Data *</Label>
                  <Input
                    id="data"
                    type="date"
                    value={form.data}
                    onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))}
                    className="mt-1"
                  />
                </div>
              </div>

              {form.tipo === "saida" && (<>
                <div>
                  <Label>Categoria</Label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {categories.map((cat) => (
                      <ContextMenu key={cat.code}>
                        <ContextMenuTrigger asChild>
                          <button
                            type="button"
                            onClick={() => setForm((f) => ({ ...f, categoria: cat.code }))}
                            className={`text-left px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
                              form.categoria === cat.code
                                ? "bg-primary/15 border-primary/40 text-primary"
                                : "bg-secondary/40 border-transparent text-muted-foreground hover:bg-secondary/70"
                            }`}
                          >
                            {cat.name}
                          </button>
                        </ContextMenuTrigger>
                        <ContextMenuContent>
                          <ContextMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => {
                              reassignCategory(cat.code, "O");
                              deleteCategory(cat.code);
                              if (form.categoria === cat.code) {
                                setForm((f) => ({ ...f, categoria: categories[0]?.code || "O" }));
                              }
                              toast({ title: "Categoria excluída", description: `${cat.name} — transações movidas para Outros` });
                            }}
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-2" />
                            Excluir categoria
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>
                    ))}
                    {showNewCategory ? (
                      <div className="col-span-2 flex gap-2">
                        <Input
                          value={newCategoryName}
                          onChange={(e) => setNewCategoryName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              const cat = handleCreateCategory();
                              if (cat) setForm((f) => ({ ...f, categoria: cat.code }));
                            }
                            if (e.key === "Escape") setShowNewCategory(false);
                          }}
                          placeholder="Nome da nova categoria"
                          className="h-8 text-xs"
                          autoFocus
                        />
                        <Button type="button" size="sm" className="h-8 text-xs" onClick={() => {
                          const cat = handleCreateCategory();
                          if (cat) setForm((f) => ({ ...f, categoria: cat.code }));
                        }}>
                          <Check className="w-3 h-3" />
                        </Button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowNewCategory(true)}
                        className="text-left px-3 py-2 rounded-lg text-xs font-medium transition-all border border-dashed border-border text-muted-foreground hover:border-primary/50 hover:text-primary flex items-center gap-1"
                      >
                        <Tag className="w-3 h-3" /> Nova categoria
                      </button>
                    )}
                  </div>
                </div>

                {/* Subcategory selector */}
                {(() => {
                  const subs = getSubcategoriesByCategory(form.categoria);
                  if (subs.length === 0) return null;
                  return (
                    <div>
                      <Label>Subcategoria</Label>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        <button
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, subcategoria: "" }))}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all border ${
                            !form.subcategoria
                              ? "bg-primary/15 border-primary/40 text-primary"
                              : "bg-secondary/40 border-transparent text-muted-foreground hover:bg-secondary/70"
                          }`}
                        >
                          Geral
                        </button>
                        {subs.map((sub) => (
                          <button
                            key={sub.id}
                            type="button"
                            onClick={() => setForm((f) => ({ ...f, subcategoria: sub.id }))}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all border ${
                              form.subcategoria === sub.id
                                ? "bg-primary/15 border-primary/40 text-primary"
                                : "bg-secondary/40 border-transparent text-muted-foreground hover:bg-secondary/70"
                            }`}
                          >
                            {sub.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })()}
                </>)}

              {/* Billing client fields for "entrada" */}
              {form.tipo === "entrada" && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="showBilling"
                      checked={showBilling}
                      onChange={(e) => setShowBilling(e.target.checked)}
                      className="rounded"
                    />
                    <Label htmlFor="showBilling" className="cursor-pointer flex items-center gap-1.5">
                      <UserPlus className="w-3.5 h-3.5" /> Vincular cliente para cobrança
                    </Label>
                  </div>

                  {showBilling && (
                    <div className="rounded-lg border border-border bg-secondary/20 p-3 space-y-3">
                      <div className="flex items-center justify-between gap-2 pb-2 border-b border-border/40">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Sparkles className="w-3.5 h-3.5 text-primary" />
                          Preencher automaticamente a partir de boleto/NF
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => {
                            setReaderBoleto(boletoFile);
                            setReaderNf(nfFile);
                            setReaderExtracted(null);
                            setReaderOpen(true);
                          }}
                        >
                          <Upload className="w-3 h-3 mr-1" /> Ler arquivos
                        </Button>
                      </div>
                      <div>
                        <Label htmlFor="clientNome" className="text-xs">Nome do cliente *</Label>
                        <Popover open={clientPopoverOpen} onOpenChange={setClientPopoverOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={clientPopoverOpen}
                              className="w-full justify-between mt-1 text-sm font-normal h-9"
                            >
                              {billingClient.nome || "Selecione ou digite..."}
                              <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-full p-0" align="start">
                            <Command>
                              <CommandInput
                                placeholder="Buscar cliente..."
                                value={billingClient.nome}
                                onValueChange={(v) => setBillingClient((b) => ({ ...b, nome: v }))}
                              />
                              <CommandList>
                                <CommandEmpty>
                                  <span className="text-xs text-muted-foreground">Nenhum cliente encontrado — será criado como novo</span>
                                </CommandEmpty>
                                <CommandGroup>
                                  {existingClients
                                    .filter((c) => c.nome.toLowerCase().includes(billingClient.nome.toLowerCase()))
                                    .map((c) => (
                                      <CommandItem
                                        key={c.id}
                                        value={c.nome}
                                        onSelect={() => {
                                          setBillingClient((b) => ({
                                            ...b,
                                            nome: c.nome,
                                            email: c.email,
                                            telefone: c.telefone || "",
                                            forma_cobranca: c.forma_cobranca || "",
                                          }));
                                          setClientPopoverOpen(false);
                                        }}
                                      >
                                        <div className="flex flex-col">
                                          <span className="text-sm">{c.nome}</span>
                                          <span className="text-xs text-muted-foreground">{c.email}</span>
                                        </div>
                                      </CommandItem>
                                    ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div>
                        <Label htmlFor="clientEmail" className="text-xs flex items-center gap-1">
                          <Mail className="w-3 h-3" /> E-mail *
                        </Label>
                        <Input
                          id="clientEmail"
                          type="email"
                          value={billingClient.email}
                          onChange={(e) => setBillingClient((b) => ({ ...b, email: e.target.value }))}
                          placeholder="email@exemplo.com"
                          className="mt-1 text-sm"
                        />
                      </div>
                      <div>
                        <Label htmlFor="clientTelefone" className="text-xs flex items-center gap-1">
                          <Phone className="w-3 h-3" /> Telefone
                        </Label>
                        <Input
                          id="clientTelefone"
                          value={billingClient.telefone}
                          onChange={(e) => setBillingClient((b) => ({ ...b, telefone: e.target.value }))}
                          placeholder="(00) 00000-0000"
                          className="mt-1 text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Forma de cobrança</Label>
                        <div className="grid grid-cols-3 gap-2 mt-1.5">
                          {(["boleto", "pix", "transferencia"] as const).map((opt) => (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => setBillingClient((b) => ({ ...b, forma_cobranca: b.forma_cobranca === opt ? "" : opt }))}
                              className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                                billingClient.forma_cobranca === opt
                                  ? "bg-primary/15 border-primary/40 text-primary"
                                  : "bg-secondary/40 border-transparent text-muted-foreground hover:bg-secondary/70"
                              }`}
                            >
                              {opt === "boleto" ? "Boleto" : opt === "pix" ? "PIX" : "Transferência"}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          id="billingRecorrente"
                          checked={billingClient.recorrente}
                          onChange={(e) => setBillingClient((b) => ({ ...b, recorrente: e.target.checked }))}
                          className="rounded"
                        />
                        <Label htmlFor="billingRecorrente" className="cursor-pointer text-xs flex items-center gap-1.5">
                          <Repeat className="w-3 h-3" /> Repetir cobrança mensalmente
                        </Label>
                      </div>
                      {billingClient.recorrente && (
                        <div>
                          <Label htmlFor="mesesRecorrencia" className="text-xs">Número de meses</Label>
                          <Input
                            id="mesesRecorrencia"
                            type="number"
                            min={1}
                            max={60}
                            value={billingClient.meses_recorrencia}
                            onChange={(e) => setBillingClient((b) => ({ ...b, meses_recorrencia: Math.max(1, Math.min(60, parseInt(e.target.value) || 1)) }))}
                            className="mt-1 text-sm w-24"
                          />
                          <p className="text-[10px] text-muted-foreground mt-0.5">Mín. 1, máx. 60 meses</p>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/40">
                        {(["boleto", "nf"] as const).map((kind) => {
                          const file = kind === "boleto" ? boletoFile : nfFile;
                          const setter = kind === "boleto" ? setBoletoFile : setNfFile;
                          const label = kind === "boleto" ? "Boleto" : "Nota fiscal";
                          return (
                            <div key={kind}>
                              <Label className="text-xs flex items-center gap-1.5">
                                <Paperclip className="w-3 h-3" /> {label}
                                {billingClient.recorrente && <span className="text-[9px] text-muted-foreground">(1ª cobrança)</span>}
                              </Label>
                              <label className="mt-1 flex items-center gap-2 text-xs cursor-pointer rounded-md border border-input px-2 py-1.5 hover:bg-accent/40">
                                <Upload className="w-3 h-3" />
                                <span className="truncate flex-1">{file?.name || "Selecionar arquivo (PDF, JPG, PNG)"}</span>
                                <input
                                  type="file"
                                  accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                                  className="hidden"
                                  onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (!f) return;
                                    const err = validateAttachment(f);
                                    if (err) {
                                      toast({ title: "Arquivo inválido", description: err, variant: "destructive" });
                                      e.target.value = "";
                                      return;
                                    }
                                    setter(f);
                                  }}
                                />
                              </label>
                              {file && (
                                <button type="button" className="text-[10px] text-muted-foreground hover:text-destructive mt-0.5" onClick={() => setter(null)}>
                                  Remover
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {form.tipo === "saida" && (
                <div>
                  <Label className="flex items-center gap-1.5"><CreditCard className="w-3.5 h-3.5" /> Forma de Pagamento</Label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {([
                      { value: "boleto" as FormaPagamento, label: "Boleto" },
                      { value: "pix" as FormaPagamento, label: "PIX" },
                      { value: "transferencia" as FormaPagamento, label: "Transferência" },
                      { value: "cartao" as FormaPagamento, label: "Cartão" },
                    ]).map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, forma_pagamento: f.forma_pagamento === opt.value ? "" : opt.value }))}
                        className={`text-left px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
                          form.forma_pagamento === opt.value
                            ? "bg-primary/15 border-primary/40 text-primary"
                            : "bg-secondary/40 border-transparent text-muted-foreground hover:bg-secondary/70"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  {form.forma_pagamento === "pix" && (
                    <div className="mt-2">
                      <Label htmlFor="pix_code" className="flex items-center gap-1.5 text-xs">
                        <QrCode className="w-3 h-3" /> Chave/Código PIX
                      </Label>
                      <div className="flex gap-2 mt-1">
                        <Input
                          id="pix_code"
                          value={form.pix_code}
                          onChange={(e) => setForm((f) => ({ ...f, pix_code: e.target.value }))}
                          placeholder="Cole a chave PIX aqui"
                          className="text-xs"
                        />
                        {form.pix_code && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              navigator.clipboard.writeText(form.pix_code);
                              toast({ title: "Chave PIX copiada!" });
                            }}
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Recurrence */}
              {form.tipo === "saida" && (
                <div>
                  <Label className="flex items-center gap-1.5"><Repeat className="w-3.5 h-3.5" /> Repetir</Label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {([
                      { value: null, label: "Não repetir" },
                      { value: "daily" as RecurrenceType, label: "Todo dia" },
                      { value: "weekly" as RecurrenceType, label: "Toda semana" },
                      { value: "monthly" as RecurrenceType, label: "Todo mês" },
                    ]).map((opt) => (
                      <button
                        key={opt.label}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, recurrence_type: f.recurrence_type === opt.value ? null : opt.value }))}
                        className={`text-left px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
                          form.recurrence_type === opt.value
                            ? "bg-primary/15 border-primary/40 text-primary"
                            : "bg-secondary/40 border-transparent text-muted-foreground hover:bg-secondary/70"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  {form.recurrence_type && (
                    <p className="text-[10px] text-muted-foreground mt-1.5">
                      {form.recurrence_type === "daily" ? "Serão criados 30 lançamentos diários" :
                       form.recurrence_type === "weekly" ? "Serão criados 12 lançamentos semanais" :
                       "Serão criados 12 lançamentos mensais"}
                    </p>
                  )}
                </div>
              )}

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="pago"
                  checked={form.pago}
                  onChange={(e) => setForm((f) => ({ ...f, pago: e.target.checked }))}
                  className="rounded"
                />
                <Label htmlFor="pago" className="cursor-pointer">Já pago / recebido</Label>
              </div>

              <Button type="submit" className="w-full">
                <Plus className="w-4 h-4 mr-2" />
                Registrar {form.tipo === "entrada" ? "Entrada" : "Saída"}
              </Button>
            </form>
          </div>

          {/* Recent entries */}
          <div className="rounded-xl bg-card border border-border p-4 sm:p-6">
            <h2 className="font-display font-semibold text-lg mb-4">Lançamentos Recentes</h2>
            {recentEntries.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-12">
                <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4">
                  <span className="text-2xl">📝</span>
                </div>
                <p className="text-muted-foreground text-sm">Nenhum lançamento registrado nesta sessão</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {recentEntries.map((entry, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/30"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {entry.tipo === "entrada" ? (
                        <ArrowUp className="w-4 h-4 text-income flex-shrink-0" />
                      ) : (
                        <ArrowDown className="w-4 h-4 text-expense flex-shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{entry.empresa}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{entry.data}</span>
                          {entry.tipo === "saida" && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              {categories.find(c => c.code === entry.categoria)?.name}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <span className={`text-sm font-semibold ml-2 flex-shrink-0 ${entry.tipo === "entrada" ? "text-income" : "text-expense"}`}>
                      {entry.tipo === "entrada" ? "+" : "-"}{formatCurrency(parseFloat(entry.valor))}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeSection === "import" && (
        /* DDA Import */
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="rounded-xl bg-card border border-border p-4 sm:p-6">
              <h2 className="font-display font-semibold text-lg mb-2">Importar DDA / Nota Fiscal</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Envie fotos ou PDFs do DDA. A IA identifica as contas automaticamente.
              </p>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <button
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all"
                >
                  <Camera className="w-8 h-8 text-muted-foreground mb-2" />
                  <span className="text-xs font-medium">Tirar Foto</span>
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handleImageUpload}
                  />
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all"
                >
                  <Image className="w-8 h-8 text-muted-foreground mb-2" />
                  <span className="text-xs font-medium">Galeria / PDF</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,.pdf"
                    multiple
                    className="hidden"
                    onChange={handleImageUpload}
                  />
                </button>
              </div>

              {/* Uploaded files preview */}
              {uploadedImages.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Arquivos carregados</p>
                  <div className="grid grid-cols-3 gap-2">
                    {uploadedImages.map((img, idx) => (
                      <div key={idx} className="relative group rounded-lg overflow-hidden border border-border">
                        {img.file.type.startsWith("image/") ? (
                          <img src={img.preview} alt={img.file.name} className="w-full h-24 object-cover" />
                        ) : (
                          <div className="w-full h-24 flex items-center justify-center bg-secondary">
                            <FileText className="w-8 h-8 text-muted-foreground" />
                          </div>
                        )}
                        <button
                          onClick={() => removeImage(idx)}
                          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-background/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                        <p className="text-[10px] text-muted-foreground truncate px-1 py-0.5">{img.file.name}</p>
                      </div>
                    ))}
                  </div>

                  {/* Confirm button */}
                  <Button
                    onClick={processDDAFiles}
                    disabled={ddaProcessing}
                    className="w-full gap-2"
                  >
                    {ddaProcessing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Processando com IA...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Confirmar e Identificar Contas
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>

            {/* Instructions */}
              <div className="rounded-xl bg-card border border-border p-4 sm:p-6">
              <h2 className="font-display font-semibold text-lg mb-4">Como funciona</h2>
              <div className="space-y-4">
                {[
                  { step: "1", title: "Envie o arquivo", desc: "Tire uma foto ou faça upload do PDF do DDA" },
                  { step: "2", title: "Confirme o envio", desc: "Clique em 'Confirmar' para a IA identificar as contas automaticamente" },
                  { step: "3", title: "Revise e aprove", desc: "Confira os dados, ajuste categorias e aprove cada lançamento" },
                ].map((item) => (
                  <div key={item.step} className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-primary">{item.step}</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-lg bg-secondary/50 p-4">
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Formatos suportados:</span> JPG, PNG (fotos), PDF (DDA bancário)
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  <span className="font-medium text-foreground">Dica:</span> A IA memoriza categorias e formas de pagamento dos fornecedores para próximas importações
                </p>
              </div>
            </div>
          </div>

          {/* Pending approval entries from DDA */}
          {importedEntries.filter(e => !e.approved).length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display font-semibold text-lg">
                  Contas identificadas ({importedEntries.filter(e => !e.approved).length} pendentes)
                </h2>
                <Button size="sm" onClick={approveAllImportedEntries} className="gap-1.5">
                  <Check className="w-3.5 h-3.5" /> Aprovar todas
                </Button>
              </div>
              <div className="space-y-3">
              {importedEntries.filter(e => !e.approved).map((entry) => (
                <div key={entry.id} className="rounded-xl bg-card border border-border p-3 sm:p-4">
                  <div className="flex items-center gap-2 sm:gap-3 mb-3">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-expense/15 flex items-center justify-center flex-shrink-0">
                      <ArrowDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-expense" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <Input
                        value={entry.empresa}
                        onChange={(e) => updateImportedEntry(entry.id, "empresa", e.target.value)}
                        placeholder="Empresa / Descrição"
                        className="h-8 text-xs sm:text-sm"
                      />
                    </div>
                    <span className="text-xs sm:text-sm font-bold text-expense flex-shrink-0">
                      -{formatCurrency(parseFloat(entry.valor) || 0)}
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Input
                        type="number"
                        step="0.01"
                        value={entry.valor}
                        onChange={(e) => updateImportedEntry(entry.id, "valor", e.target.value)}
                        placeholder="Valor"
                        className="h-7 text-xs w-24"
                      />
                      <Input
                        type="date"
                        value={entry.data}
                        onChange={(e) => updateImportedEntry(entry.id, "data", e.target.value)}
                        className="h-7 text-xs w-full sm:w-36"
                      />
                      <select
                        value={entry.categoria}
                        onChange={(e) => updateImportedEntry(entry.id, "categoria", e.target.value)}
                        className="h-7 text-xs rounded-md border border-border bg-background px-2 w-full sm:w-auto"
                      >
                        {categories.map((cat) => (
                          <option key={cat.code} value={cat.code}>{cat.name}</option>
                        ))}
                      </select>
                      {(() => {
                        const subs = getSubcategoriesByCategory(entry.categoria);
                        if (subs.length === 0) return null;
                        return (
                          <select
                            value="_none"
                            onChange={(e) => updateImportedEntry(entry.id, "categoria", e.target.value === "_none" ? entry.categoria : entry.categoria)}
                            className="h-7 text-xs rounded-md border border-border bg-background px-2 w-full sm:w-auto"
                          >
                            <option value="_none">Geral</option>
                            {subs.map((s) => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                          </select>
                        );
                      })()}
                    </div>
                    <div className="flex items-center gap-2 justify-end">
                      <Button size="sm" variant="outline" onClick={() => setImportedEntries((prev) => prev.filter((e) => e.id !== entry.id))} className="h-7 text-xs">
                        <X className="w-3 h-3" />
                      </Button>
                      <Button size="sm" onClick={() => approveEntry(entry.id)} className="h-7 text-xs gap-1">
                        <Check className="w-3 h-3" /> Aprovar
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              </div>
            </div>
          )}

          {/* Approved entries */}
          {importedEntries.filter(e => e.approved).length > 0 && (
            <div className="rounded-xl bg-card border border-border p-5">
              <h3 className="font-display font-semibold text-sm mb-3 text-income flex items-center gap-2">
                <Check className="w-4 h-4" /> {importedEntries.filter(e => e.approved).length} lançamento(s) aprovado(s)
              </h3>
              <div className="space-y-2">
                {importedEntries.filter(e => e.approved).map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between p-3 rounded-lg bg-income/5 border border-income/20">
                    <div className="flex items-center gap-3 min-w-0">
                      <ArrowDown className="w-4 h-4 text-expense flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{entry.empresa}</p>
                        <span className="text-xs text-muted-foreground">{entry.data} · {entry.fileName}</span>
                      </div>
                    </div>
                    <span className="text-sm font-semibold ml-2 flex-shrink-0 text-expense">
                      {formatCurrency(parseFloat(entry.valor))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeSection === "bank" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="rounded-xl bg-card border border-border p-4 sm:p-6">
              <h2 className="font-display font-semibold text-lg mb-2">Importar Extrato Bancário</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Importe arquivos PDF, OFX ou CSV do seu banco para registrar as transações automaticamente.
              </p>

              <button
                onClick={() => bankInputRef.current?.click()}
                disabled={bankFileLoading}
                className="w-full flex flex-col items-center justify-center h-36 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all disabled:opacity-50 disabled:cursor-wait"
              >
                {bankFileLoading ? (
                  <>
                    <Loader2 className="w-10 h-10 text-primary mb-3 animate-spin" />
                    <span className="text-sm font-medium">Processando PDF...</span>
                    <span className="text-xs text-muted-foreground mt-1">Lendo transações do extrato</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-10 h-10 text-muted-foreground mb-3" />
                    <span className="text-sm font-medium">Selecionar extrato bancário</span>
                    <span className="text-xs text-muted-foreground mt-1">Formatos: PDF, OFX, CSV</span>
                  </>
                )}
                <input
                  ref={bankInputRef}
                  type="file"
                  accept=".ofx,.ofc,.csv,.txt,.pdf,application/pdf"
                  className="hidden"
                  onChange={handleBankFileUpload}
                />
              </button>
              {bankFileName && (
                <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                  <FileText className="w-4 h-4" />
                  <span className="truncate">{bankFileName}</span>
                </div>
              )}
            </div>

            <div className="rounded-xl bg-card border border-border p-4 sm:p-6">
              <h2 className="font-display font-semibold text-lg mb-4">Como funciona</h2>
              <div className="space-y-4">
                {[
                  { step: "1", title: "Exporte o extrato", desc: "Baixe o extrato do seu banco em PDF, OFX ou CSV" },
                  { step: "2", title: "Importe aqui", desc: "Faça upload do arquivo — o sistema lê e identifica as movimentações" },
                  { step: "3", title: "Revise e aprove", desc: "Confira os lançamentos, ajuste categorias e aprove" },
                ].map((item) => (
                  <div key={item.step} className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-primary">{item.step}</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-lg bg-secondary/50 p-4">
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Formatos suportados:</span> PDF (extrato bancário), OFX, CSV
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  <span className="font-medium text-foreground">Bancos compatíveis:</span> Sicoob, Itaú, Bradesco, Banco do Brasil, Santander, Nubank, Inter, C6 e outros.
                </p>
              </div>
            </div>
          </div>

          {/* Pending bank entries */}
          {bankEntries.filter((e) => !e.approved).length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display font-semibold text-lg">
                  Transações importadas ({bankEntries.filter((e) => !e.approved).length} pendentes)
                </h2>
                <Button size="sm" onClick={approveAllBankEntries} className="gap-1.5">
                  <Check className="w-3.5 h-3.5" /> Aprovar todas
                </Button>
              </div>
              <div className="space-y-3">
                {bankEntries.filter((e) => !e.approved).map((entry) => (
                  <div key={entry.id} className="rounded-xl bg-card border border-border p-3 sm:p-4 relative">
                    {entry.matchedFrom && (
                      <div className="mb-2 flex items-center gap-1.5 text-[11px] text-primary bg-primary/5 rounded-lg px-2.5 py-1.5 border border-primary/20">
                        <Sparkles className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>{entry.matchedFrom}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 sm:gap-3 mb-3">
                      {entry.tipo === "entrada" ? (
                        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-income/15 flex items-center justify-center flex-shrink-0">
                          <ArrowUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-income" />
                        </div>
                      ) : (
                        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-expense/15 flex items-center justify-center flex-shrink-0">
                          <ArrowDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-expense" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <Input
                          value={entry.empresa}
                          onChange={(e) => updateBankEntry(entry.id, "empresa", e.target.value)}
                          placeholder="Descrição"
                          className="h-8 text-xs sm:text-sm"
                        />
                      </div>
                      <span className={`text-xs sm:text-sm font-bold flex-shrink-0 ${entry.tipo === "entrada" ? "text-income" : "text-expense"}`}>
                        {entry.tipo === "entrada" ? "+" : "-"}{formatCurrency(entry.valor)}
                      </span>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Input
                          type="date"
                          value={entry.data}
                          onChange={(e) => updateBankEntry(entry.id, "data", e.target.value)}
                          className="h-7 text-xs w-full sm:w-36"
                        />
                        {entry.tipo === "saida" && (
                          <>
                            <select
                              value={entry.categoria}
                              onChange={(e) => updateBankEntry(entry.id, "categoria", e.target.value)}
                              className="h-7 text-xs rounded-md border border-border bg-background px-2 w-full sm:w-auto"
                            >
                              {categories.map((cat) => (
                                <option key={cat.code} value={cat.code}>{cat.name}</option>
                              ))}
                            </select>
                            {(() => {
                              const subs = getSubcategoriesByCategory(entry.categoria);
                              if (subs.length === 0) return null;
                              return (
                                <select
                                  value={entry.subcategoria || "_none"}
                                  onChange={(e) => updateBankEntry(entry.id, "subcategoria", e.target.value === "_none" ? null : e.target.value)}
                                  className="h-7 text-xs rounded-md border border-border bg-background px-2 w-full sm:w-auto"
                                >
                                  <option value="_none">Geral</option>
                                  {subs.map((s) => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                  ))}
                                </select>
                              );
                            })()}
                          </>
                        )}
                        <button
                          onClick={() => updateBankEntry(entry.id, "tipo", entry.tipo === "entrada" ? "saida" : "entrada")}
                          className="h-7 px-2 text-xs rounded-md border border-border bg-secondary/40 text-muted-foreground hover:bg-secondary/70 whitespace-nowrap"
                        >
                          {entry.tipo === "entrada" ? "→ Saída" : "→ Entrada"}
                        </button>
                      </div>
                      <div className="flex items-center gap-2 justify-end">
                        <Button size="sm" variant="outline" onClick={() => setBankEntries((prev) => prev.filter((e) => e.id !== entry.id))} className="h-7 text-xs">
                          <X className="w-3 h-3" />
                        </Button>
                        <Button size="sm" onClick={() => approveBankEntry(entry.id)} className="h-7 text-xs gap-1">
                          <Check className="w-3 h-3" /> Aprovar
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Approved bank entries */}
          {bankEntries.filter((e) => e.approved).length > 0 && (
            <div className="rounded-xl bg-card border border-border p-5">
              <h3 className="font-display font-semibold text-sm mb-3 text-income flex items-center gap-2">
                <Check className="w-4 h-4" /> {bankEntries.filter((e) => e.approved).length} lançamentos aprovados do extrato
              </h3>
              <div className="space-y-2">
                {bankEntries.filter((e) => e.approved).map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between p-3 rounded-lg bg-income/5 border border-income/20">
                    <div className="flex items-center gap-3 min-w-0">
                      {entry.tipo === "entrada" ? (
                        <ArrowUp className="w-4 h-4 text-income flex-shrink-0" />
                      ) : (
                        <ArrowDown className="w-4 h-4 text-expense flex-shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{entry.empresa}</p>
                        <span className="text-xs text-muted-foreground">{entry.data}</span>
                      </div>
                    </div>
                    <span className={`text-sm font-semibold ml-2 flex-shrink-0 ${entry.tipo === "entrada" ? "text-income" : "text-expense"}`}>
                      {formatCurrency(entry.valor)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      {/* Import Mode Dialog */}
      <AlertDialog open={showImportModeDialog} onOpenChange={(open) => { setShowImportModeDialog(open); if (!open) setImportFilter("all"); }}>
        <AlertDialogContent className="max-w-[calc(100%-2rem)] sm:max-w-md mx-auto text-center">
          <AlertDialogHeader className="text-center">
            <AlertDialogTitle className="text-center">Como deseja importar?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-center">
                {pendingImportPeriod && (
                  <>
                    <p className="mb-3">
                      Foram encontradas <strong>{pendingParsedEntries.length}</strong> transações no período de{" "}
                      <strong>{pendingImportPeriod.start.split("-").reverse().join("/")}</strong> a{" "}
                      <strong>{pendingImportPeriod.end.split("-").reverse().join("/")}</strong>.
                    </p>
                    <p className="mb-3">
                      ({pendingParsedEntries.filter(e => e.tipo === "entrada").length} entradas · {pendingParsedEntries.filter(e => e.tipo === "saida").length} saídas)
                    </p>
                  </>
                )}

                {/* Filter: what to import */}
                <div className="mb-2">
                  <p className="text-sm font-medium text-foreground mb-2">O que importar?</p>
                  <div className="flex gap-1.5 sm:gap-2 justify-center">
                    {([["all", "Tudo"], ["entrada", "Entradas"], ["saida", "Saídas"]] as const).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setImportFilter(value)}
                        className={`flex-1 px-2 sm:px-3 py-2 rounded-lg text-[11px] sm:text-xs font-medium transition-all border whitespace-nowrap ${
                          importFilter === value
                            ? "bg-primary/15 border-primary/40 text-primary"
                            : "bg-secondary/40 border-transparent text-muted-foreground hover:bg-secondary/70"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2 sm:justify-center">
            <AlertDialogCancel className="mt-0">Cancelar</AlertDialogCancel>
            <Button
              onClick={() => applyImportEntries(pendingParsedEntries, "add")}
              variant="default"
              size="sm"
              className="text-xs sm:text-sm px-3"
            >
              Adicionar ao existente
            </Button>
            <Button
              onClick={() => applyImportEntries(pendingParsedEntries, "replace")}
              variant="destructive"
              size="sm"
              className="text-xs sm:text-sm px-3"
            >
              Substituir período
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Date-change Approval Dialog */}
      <AlertDialog open={showDateApprovalDialog} onOpenChange={(open) => {
        if (!open) {
          setShowDateApprovalDialog(false);
          setDateCandidates([]);
          setApprovedKeys(new Set());
          setPendingCommit(null);
          setShowImportModeDialog(false);
          setPendingParsedEntries([]);
          setPendingImportPeriod(null);
          setImportFilter("all");
        }
      }}>
        <AlertDialogContent className="max-w-[calc(100%-2rem)] sm:max-w-lg mx-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Aprovar mudanças de data</AlertDialogTitle>
            <AlertDialogDescription>
              Estas contas já estão lançadas em outra data. Marque para mover (atualizar a data do lançamento existente) ou desmarque para manter como está e criar uma entrada nova a partir do extrato.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="max-h-[50vh] overflow-y-auto space-y-2 my-2">
            {dateCandidates.map((c) => {
              const checked = approvedKeys.has(c.key);
              return (
                <label
                  key={c.key}
                  className="flex items-start gap-3 p-3 rounded-lg border bg-secondary/30 cursor-pointer hover:bg-secondary/50"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      setApprovedKeys((prev) => {
                        const next = new Set(prev);
                        if (e.target.checked) next.add(c.key);
                        else next.delete(c.key);
                        return next;
                      });
                    }}
                    className="mt-1"
                  />
                  <div className="flex-1 text-left text-sm">
                    <div className="font-medium">{c.empresa}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatCurrency(c.valor)} · {c.kind === "move" ? "Mover do extrato" : "Reagendar (não pago)"}
                    </div>
                    <div className="text-xs mt-1">
                      <span className="line-through text-muted-foreground">{c.oldDate}</span>
                      {" → "}
                      <span className="font-semibold text-primary">{c.newDate}</span>
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="mt-0">Cancelar importação</AlertDialogCancel>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (!pendingCommit) return;
                finalizeImport(pendingCommit.enriched, []);
                setShowDateApprovalDialog(false);
                setDateCandidates([]);
                setApprovedKeys(new Set());
                setPendingCommit(null);
              }}
            >
              Manter datas originais
            </Button>
            <Button
              size="sm"
              onClick={() => {
                if (!pendingCommit) return;
                const skipEntryIds = new Set<number>();
                dateCandidates
                  .filter((c) => c.kind === "move" && approvedKeys.has(c.key))
                  .forEach((c) => {
                    updateTransaction(c.existingId, { data: c.newDate, pago: true });
                    if (c.entryId !== undefined) skipEntryIds.add(c.entryId);
                  });
                const approvedReschedules = pendingCommit.scheduledUnpaid.filter((t) =>
                  approvedKeys.has(`resched-${t.id}`),
                );
                finalizeImport(pendingCommit.enriched, approvedReschedules, skipEntryIds);
                setShowDateApprovalDialog(false);
                setDateCandidates([]);
                setApprovedKeys(new Set());
                setPendingCommit(null);
              }}
            >
              Aplicar selecionadas ({approvedKeys.size})
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Match approval: cobranças e contas agendadas identificadas */}
      <AlertDialog open={showMatchApprovalDialog} onOpenChange={(open) => {
        if (!open) {
          setShowMatchApprovalDialog(false);
          setPendingMatchEntries([]);
          setPendingMatchReschedules([]);
          setApprovedMatchIds(new Set());
        }
      }}>
        <AlertDialogContent className="max-w-[calc(100%-2rem)] sm:max-w-2xl mx-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Correspondências identificadas no extrato</AlertDialogTitle>
            <AlertDialogDescription>
              Encontramos lançamentos do extrato que batem com cobranças pendentes ou contas agendadas. Marque os que devem atualizar o status (cobrança → paga, agendado → pago). Itens desmarcados serão importados como lançamentos novos.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {(() => {
            const matched = pendingMatchEntries.filter((e) => e.matchedChargeId || e.matchedTransactionId);
            const charges = matched.filter((e) => e.matchedChargeId);
            const scheduled = matched.filter((e) => e.matchedTransactionId);
            const unlinkedEntradas = pendingMatchEntries.filter((e) => e.tipo === "entrada" && !e.matchedChargeId);
            const usedChargeIds = new Set(
              pendingMatchEntries.map((e) => e.matchedChargeId).filter(Boolean) as string[]
            );

            const chargeMonthKey = (c: { data_cobranca: string }) => {
              const s = c.data_cobranca || "";
              if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s.slice(0, 7);
              if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
                const [, mm, yyyy] = s.split("/");
                return `${yyyy}-${mm}`;
              }
              return "";
            };
            const entryMonthKey = (iso: string) => (iso || "").slice(0, 7);

            const renderChargePicker = (entry: ParsedBankEntry, mode: "change" | "link") => {
              if (availableCharges.length === 0) return null;
              const isOpen = openChargePopoverId === entry.id;
              const eMonth = entryMonthKey(entry.data);
              const sorted = [...availableCharges].sort((a, b) => {
                const aMonth = chargeMonthKey(a) === eMonth ? 0 : 1;
                const bMonth = chargeMonthKey(b) === eMonth ? 0 : 1;
                if (aMonth !== bMonth) return aMonth - bMonth;
                const aMatch = Math.abs(a.valor - entry.valor) < 0.01 ? 0 : 1;
                const bMatch = Math.abs(b.valor - entry.valor) < 0.01 ? 0 : 1;
                if (aMatch !== bMatch) return aMatch - bMatch;
                return a.client_nome.localeCompare(b.client_nome);
              });
              return (
                <Popover open={isOpen} onOpenChange={(o) => setOpenChargePopoverId(o ? entry.id : null)}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      onClick={(ev) => ev.stopPropagation()}
                      className="text-xs text-primary hover:underline mt-1"
                    >
                      {mode === "change" ? "Alterar cliente" : "Vincular cliente"}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[320px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar cliente ou valor..." />
                      <CommandList>
                        <CommandEmpty>Nenhuma cobrança pendente.</CommandEmpty>
                        <CommandGroup>
                          {mode === "change" && (
                            <CommandItem
                              value="__remove__"
                              onSelect={() => handleChangeChargeLink(entry.id, null)}
                              className="text-destructive"
                            >
                              Remover vinculação
                            </CommandItem>
                          )}
                          {sorted.map((c) => {
                            const usedByOther = pendingMatchEntries.find(
                              (pe) => pe.matchedChargeId === c.id && pe.id !== entry.id,
                            );
                            const sameValue = Math.abs(c.valor - entry.valor) < 0.01;
                            const sameMonth = chargeMonthKey(c) === eMonth;
                            return (
                              <CommandItem
                                key={c.id}
                                value={`${c.client_nome} ${c.valor} ${c.data_cobranca}`}
                                onSelect={() => handleChangeChargeLink(entry.id, c.id)}
                                className="flex flex-col items-stretch gap-1 py-2"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="flex-1 text-sm font-medium truncate">{c.client_nome}</span>
                                  {c.id === entry.matchedChargeId && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                                </div>
                                <div className="flex items-center gap-1.5 flex-wrap text-xs text-muted-foreground">
                                  <span>{formatCurrency(c.valor)} · {c.data_cobranca}</span>
                                  {sameMonth && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">mesmo mês</Badge>}
                                  {sameValue && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">mesmo valor</Badge>}
                                  {usedByOther && (
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-warning border-warning/40">
                                      transferir de {usedByOther.empresa}
                                    </Badge>
                                  )}
                                </div>
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              );
            };


            return (
              <div className="max-h-[55vh] overflow-y-auto space-y-4 my-2">
                {charges.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-semibold uppercase text-income">Cobranças identificadas ({charges.length})</h3>
                      <button
                        type="button"
                        className="text-xs text-primary hover:underline"
                        onClick={() => setApprovedMatchIds((prev) => {
                          const next = new Set(prev);
                          const allOn = charges.every((e) => next.has(e.id));
                          if (allOn) charges.forEach((e) => next.delete(e.id));
                          else charges.forEach((e) => next.add(e.id));
                          return next;
                        })}
                      >
                        {charges.every((e) => approvedMatchIds.has(e.id)) ? "Desmarcar todos" : "Marcar todos"}
                      </button>
                    </div>
                    {charges.map((e) => {
                      const checked = approvedMatchIds.has(e.id);
                      return (
                        <div key={e.id} className="flex items-start gap-3 p-3 rounded-lg border bg-secondary/30">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(ev) => setApprovedMatchIds((prev) => {
                              const next = new Set(prev);
                              if (ev.target.checked) next.add(e.id);
                              else next.delete(e.id);
                              return next;
                            })}
                            className="mt-1"
                          />
                          <div className="flex-1 text-left text-sm min-w-0">
                            <div className="font-medium truncate">{e.empresa}</div>
                            <div className="text-xs text-muted-foreground">
                              {formatCurrency(e.valor)} · {isoToBR(e.data)}
                            </div>
                            <div className="text-xs mt-1 text-income">
                              → Cobrança de <span className="font-semibold">{e.matchedChargeClient}</span>
                            </div>
                            {renderChargePicker(e, "change")}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {unlinkedEntradas.length > 0 && availableCharges.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold uppercase text-muted-foreground">
                      Entradas sem cobrança vinculada ({unlinkedEntradas.length})
                    </h3>
                    {unlinkedEntradas.map((e) => {
                      const eMonth = entryMonthKey(e.data);
                      const monthAvail = availableCharges.filter(
                        (c) => chargeMonthKey(c) === eMonth,
                      ).length;
                      return (
                        <div key={e.id} className="flex items-start gap-3 p-3 rounded-lg border bg-secondary/20">
                          <div className="flex-1 text-left text-sm min-w-0">
                            <div className="font-medium truncate">{e.empresa}</div>
                            <div className="text-xs text-muted-foreground">
                              {formatCurrency(e.valor)} · {isoToBR(e.data)}
                            </div>
                            {monthAvail > 0 && (
                              <div className="text-xs mt-1 text-muted-foreground">
                                {monthAvail} cobrança{monthAvail > 1 ? "s" : ""} do mês disponíve{monthAvail > 1 ? "is" : "l"}
                              </div>
                            )}
                            {renderChargePicker(e, "link")}
                          </div>
                        </div>
                      );
                    })}

                  </div>
                )}
                {scheduled.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-semibold uppercase text-expense">Contas agendadas identificadas ({scheduled.length})</h3>
                      <button
                        type="button"
                        className="text-xs text-primary hover:underline"
                        onClick={() => setApprovedMatchIds((prev) => {
                          const next = new Set(prev);
                          const allOn = scheduled.every((e) => next.has(e.id));
                          if (allOn) scheduled.forEach((e) => next.delete(e.id));
                          else scheduled.forEach((e) => next.add(e.id));
                          return next;
                        })}
                      >
                        {scheduled.every((e) => approvedMatchIds.has(e.id)) ? "Desmarcar todos" : "Marcar todos"}
                      </button>
                    </div>
                    {scheduled.map((e) => {
                      const checked = approvedMatchIds.has(e.id);
                      return (
                        <label key={e.id} className="flex items-start gap-3 p-3 rounded-lg border bg-secondary/30 cursor-pointer hover:bg-secondary/50">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(ev) => setApprovedMatchIds((prev) => {
                              const next = new Set(prev);
                              if (ev.target.checked) next.add(e.id);
                              else next.delete(e.id);
                              return next;
                            })}
                            className="mt-1"
                          />
                          <div className="flex-1 text-left text-sm">
                            <div className="font-medium truncate">{e.empresa}</div>
                            <div className="text-xs text-muted-foreground">
                              {formatCurrency(e.valor)} · {isoToBR(e.data)}
                            </div>
                            <div className="text-xs mt-1 text-expense">
                              → Agendado: <span className="font-semibold">{e.matchedTransactionEmpresa}</span> ({e.matchedTransactionDate})
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}

          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="mt-0">Cancelar importação</AlertDialogCancel>
            <Button
              size="sm"
              onClick={() => {
                const cleaned = pendingMatchEntries.map((e) => {
                  if ((e.matchedChargeId || e.matchedTransactionId) && !approvedMatchIds.has(e.id)) {
                    const { matchedChargeId, matchedChargeClient, matchedTransactionId, matchedTransactionEmpresa, matchedTransactionDate, matchedFrom, ...rest } = e;
                    return rest as ParsedBankEntry;
                  }
                  return e;
                });
                const reschedules = pendingMatchReschedules;
                setShowMatchApprovalDialog(false);
                setPendingMatchEntries([]);
                setPendingMatchReschedules([]);
                setApprovedMatchIds(new Set());
                commitImport(cleaned, reschedules);
              }}
            >
              Confirmar ({approvedMatchIds.size} aprovado{approvedMatchIds.size === 1 ? "" : "s"})
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reader: boleto/NF → preencher cobrança */}
      <Dialog open={readerOpen} onOpenChange={setReaderOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" /> Ler boleto / NF
            </DialogTitle>
            <DialogDescription className="text-xs">
              Envie o boleto e/ou a nota fiscal. A IA identifica o cliente e os dados da cobrança para você aprovar.
            </DialogDescription>
          </DialogHeader>

          {!readerExtracted ? (
            <div className="space-y-3">
              {(["boleto", "nf"] as const).map((kind) => {
                const file = kind === "boleto" ? readerBoleto : readerNf;
                const setter = kind === "boleto" ? setReaderBoleto : setReaderNf;
                const label = kind === "boleto" ? "Boleto" : "Nota fiscal";
                return (
                  <div key={kind}>
                    <Label className="text-xs flex items-center gap-1.5">
                      <Paperclip className="w-3 h-3" /> {label}
                    </Label>
                    <label className="mt-1 flex items-center gap-2 text-xs cursor-pointer rounded-md border border-input px-2 py-2 hover:bg-accent/40">
                      <Upload className="w-3 h-3" />
                      <span className="truncate flex-1">{file?.name || "Selecionar arquivo (PDF, JPG, PNG)"}</span>
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          const err = validateAttachment(f);
                          if (err) {
                            toast({ title: "Arquivo inválido", description: err, variant: "destructive" });
                            e.target.value = "";
                            return;
                          }
                          setter(f);
                        }}
                      />
                    </label>
                    {file && (
                      <button type="button" className="text-[10px] text-muted-foreground hover:text-destructive mt-0.5" onClick={() => setter(null)}>
                        Remover
                      </button>
                    )}
                  </div>
                );
              })}
              <DialogFooter>
                <Button type="button" variant="outline" size="sm" onClick={() => setReaderOpen(false)}>Cancelar</Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={readerLoading || (!readerBoleto && !readerNf)}
                  onClick={async () => {
                    setReaderLoading(true);
                    try {
                      const fileToB64 = (f: File) => new Promise<{ base64: string; mimeType: string }>((resolve, reject) => {
                        const r = new FileReader();
                        r.onload = () => {
                          const result = String(r.result || "");
                          const base64 = result.split(",")[1] || "";
                          resolve({ base64, mimeType: f.type || "application/octet-stream" });
                        };
                        r.onerror = () => reject(r.error);
                        r.readAsDataURL(f);
                      });
                      const payload: any = { knownClients: existingClients.map((c) => ({ nome: c.nome, email: c.email })) };
                      if (readerBoleto) payload.boleto = await fileToB64(readerBoleto);
                      if (readerNf) payload.nf = await fileToB64(readerNf);

                      const { data, error } = await supabase.functions.invoke("read-billing-doc", { body: payload });
                      if (error) throw error;
                      const ext = (data as any)?.extracted || {};
                      const matched = !!(data as any)?.matchedClientHint;
                      setReaderExtracted({
                        cliente_nome: ext.cliente_nome || "",
                        cliente_email: ext.cliente_email || "",
                        cliente_telefone: ext.cliente_telefone || "",
                        valor: ext.valor ? String(ext.valor) : "",
                        data_vencimento: ext.data_vencimento || "",
                        descricao: ext.descricao || "",
                        forma_cobranca: ext.forma_cobranca || "",
                        matched,
                      });
                    } catch (err: any) {
                      console.error(err);
                      toast({ title: "Falha ao ler documento", description: err?.message || "Tente novamente", variant: "destructive" });
                    } finally {
                      setReaderLoading(false);
                    }
                  }}
                >
                  {readerLoading ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Lendo...</> : <><Sparkles className="w-3 h-3 mr-1" /> Ler com IA</>}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                {readerExtracted.matched ? (
                  <Badge variant="secondary" className="bg-primary/15 text-primary border-primary/30">Cliente existente</Badge>
                ) : (
                  <Badge variant="outline">Novo cliente</Badge>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2">
                  <Label className="text-xs">Nome do cliente</Label>
                  <Input className="mt-1 text-sm" value={readerExtracted.cliente_nome} onChange={(e) => setReaderExtracted((s) => s && { ...s, cliente_nome: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">E-mail</Label>
                  <Input className="mt-1 text-sm" value={readerExtracted.cliente_email} onChange={(e) => setReaderExtracted((s) => s && { ...s, cliente_email: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Telefone</Label>
                  <Input className="mt-1 text-sm" value={readerExtracted.cliente_telefone} onChange={(e) => setReaderExtracted((s) => s && { ...s, cliente_telefone: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Valor</Label>
                  <Input type="number" step="0.01" className="mt-1 text-sm" value={readerExtracted.valor} onChange={(e) => setReaderExtracted((s) => s && { ...s, valor: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Vencimento</Label>
                  <Input type="date" className="mt-1 text-sm" value={readerExtracted.data_vencimento} onChange={(e) => setReaderExtracted((s) => s && { ...s, data_vencimento: e.target.value })} />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Descrição</Label>
                  <Input className="mt-1 text-sm" value={readerExtracted.descricao} onChange={(e) => setReaderExtracted((s) => s && { ...s, descricao: e.target.value })} />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Forma de cobrança</Label>
                  <div className="grid grid-cols-3 gap-2 mt-1.5">
                    {(["boleto", "pix", "transferencia"] as const).map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setReaderExtracted((s) => s && { ...s, forma_cobranca: s.forma_cobranca === opt ? "" : opt })}
                        className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                          readerExtracted.forma_cobranca === opt
                            ? "bg-primary/15 border-primary/40 text-primary"
                            : "bg-secondary/40 border-transparent text-muted-foreground hover:bg-secondary/70"
                        }`}
                      >
                        {opt === "boleto" ? "Boleto" : opt === "pix" ? "PIX" : "Transferência"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" size="sm" onClick={() => setReaderExtracted(null)}>Voltar</Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    if (!readerExtracted) return;
                    setBillingClient((b) => ({
                      ...b,
                      nome: readerExtracted.cliente_nome || b.nome,
                      email: readerExtracted.cliente_email || b.email,
                      telefone: readerExtracted.cliente_telefone || b.telefone,
                      forma_cobranca: readerExtracted.forma_cobranca || b.forma_cobranca,
                    }));
                    setForm((f) => ({
                      ...f,
                      empresa: readerExtracted.descricao || readerExtracted.cliente_nome || f.empresa,
                      valor: readerExtracted.valor || f.valor,
                      data: readerExtracted.data_vencimento || f.data,
                      tipo: "entrada",
                    }));
                    if (readerBoleto) setBoletoFile(readerBoleto);
                    if (readerNf) setNfFile(readerNf);
                    setShowBilling(true);
                    setReaderOpen(false);
                    setReaderExtracted(null);
                    toast({ title: "Dados preenchidos", description: "Revise e clique em Salvar para confirmar." });
                  }}
                >
                  <Check className="w-3 h-3 mr-1" /> Aprovar e preencher
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TransactionForm;
