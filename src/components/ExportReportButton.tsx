import { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useOrgBranding } from "@/hooks/useOrgBranding";
import { useReportData } from "@/hooks/useReportData";
import { exportFinancialReport } from "@/lib/pdfReport";

interface ExportReportButtonProps {
  selectedMonths: number[];
  selectedYear: number;
}

const ExportReportButton = ({ selectedMonths, selectedYear }: ExportReportButtonProps) => {
  const { toast } = useToast();
  const { logoUrl, companyName } = useOrgBranding();
  const data = useReportData(selectedMonths, selectedYear);
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportFinancialReport({
        companyName,
        logoUrl,
        periodLabel: data.periodLabel,
        totals: data.totals,
        expensesByCategory: data.expensesByCategory,
        incomesByClient: data.incomesByClient,
      });
      toast({ title: "Relatório gerado", description: "Download iniciado." });
    } catch (e) {
      console.error(e);
      toast({ title: "Erro ao gerar relatório", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={exporting}
      title="Exportar Relatório (PDF)"
      className="ml-auto flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-md text-xs font-medium border border-border bg-card text-foreground hover:bg-secondary transition-all whitespace-nowrap flex-shrink-0 disabled:opacity-60"
    >
      {exporting ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <FileDown className="w-3.5 h-3.5" />
      )}
      <span className="hidden sm:inline">Exportar PDF</span>
    </button>
  );
};

export default ExportReportButton;
