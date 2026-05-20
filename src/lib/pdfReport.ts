import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { renderPieChartPNG } from "@/lib/pieChartCanvas";

export interface ExpenseCategoryRow {
  code: string;
  label: string;
  color: string; // any CSS color
  total: number;
  count: number;
  sampleDescriptions: string[];
}

export interface ClientIncomeRow {
  name: string;
  total: number;
  status: "Recebido" | "Parcial" | "Pendente" | "Sem cobranças";
}

export interface FinancialReportInput {
  companyName: string;
  logoUrl?: string | null;
  periodLabel: string;
  totals: { income: number; expenses: number; balance: number };
  expensesByCategory: ExpenseCategoryRow[];
  incomesByClient: ClientIncomeRow[];
}

const COLOR_TEXT = "#111827";
const COLOR_MUTED = "#6b7280";
const COLOR_LINE = "#e5e7eb";
const COLOR_SOFT_BG = "#f9fafb";
const COLOR_HEADER_BG = "#f3f4f6";

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Convert any CSS color (hex / hsl / rgb) to [r,g,b]
function cssColorToRGB(css: string): [number, number, number] {
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return [120, 120, 120];
  ctx.fillStyle = "#000";
  ctx.fillStyle = css;
  const v = ctx.fillStyle as string;
  if (v.startsWith("#")) {
    const h = v.slice(1);
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return [r, g, b];
  }
  const m = v.match(/\d+(\.\d+)?/g);
  if (m && m.length >= 3) return [Number(m[0]), Number(m[1]), Number(m[2])];
  return [120, 120, 120];
}

async function loadImageDataURL(
  url: string,
): Promise<{ dataUrl: string; w: number; h: number } | null> {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    const dataUrl: string = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
    const dim = await new Promise<{ w: number; h: number }>((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => resolve({ w: 0, h: 0 });
      img.src = dataUrl;
    });
    if (!dim.w || !dim.h) return null;
    return { dataUrl, w: dim.w, h: dim.h };
  } catch {
    return null;
  }
}

export async function exportFinancialReport(input: FinancialReportInput) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;

  const logo = input.logoUrl ? await loadImageDataURL(input.logoUrl) : null;

  const drawHeader = () => {
    const top = margin - 12;
    // Logo (left)
    const logoH = 36;
    if (logo) {
      const ratio = logo.w / logo.h;
      const logoW = Math.min(120, logoH * ratio);
      doc.addImage(logo.dataUrl, "PNG", margin, top, logoW, logoH, undefined, "FAST");
    } else {
      // Initials block
      const initials = input.companyName
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((s) => s[0]?.toUpperCase() ?? "")
        .join("") || "•";
      doc.setFillColor(243, 244, 246);
      doc.roundedRect(margin, top, logoH, logoH, 4, 4, "F");
      doc.setTextColor(75, 85, 99);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text(initials, margin + logoH / 2, top + logoH / 2 + 5, { align: "center" });
    }

    // Title block (right)
    doc.setTextColor(31, 41, 55);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text("Relatório de Desempenho Financeiro", pageW - margin, top + 14, {
      align: "right",
    });
    doc.setTextColor(107, 114, 128);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.text(input.periodLabel, pageW - margin, top + 30, { align: "right" });

    // Divider
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.5);
    doc.line(margin, top + logoH + 12, pageW - margin, top + logoH + 12);
  };

  const drawFooter = (pageNum: number, totalPages: number) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(156, 163, 175);
    const now = new Date();
    const dateStr = `${String(now.getDate()).padStart(2, "0")}/${String(
      now.getMonth() + 1,
    ).padStart(2, "0")}/${now.getFullYear()}`;
    doc.text(`Emitido em ${dateStr}`, margin, pageH - 24);
    doc.text(`${pageNum} / ${totalPages}`, pageW - margin, pageH - 24, {
      align: "right",
    });
  };

  // Reusable header content area starts at:
  const contentTop = margin + 48; // after header divider
  let cursorY = contentTop;

  drawHeader();

  // --- Summary cards ---
  const cardH = 60;
  const cardGap = 12;
  const cardW = (pageW - margin * 2 - cardGap * 2) / 3;
  const cards: { label: string; value: string; color: [number, number, number] }[] = [
    { label: "Entradas", value: fmtBRL(input.totals.income), color: [4, 120, 87] },
    { label: "Saídas", value: fmtBRL(input.totals.expenses), color: [185, 28, 28] },
    {
      label: "Saldo",
      value: fmtBRL(input.totals.balance),
      color: input.totals.balance >= 0 ? [4, 120, 87] : [185, 28, 28],
    },
  ];
  cards.forEach((c, i) => {
    const x = margin + i * (cardW + cardGap);
    doc.setFillColor(249, 250, 251);
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.5);
    doc.roundedRect(x, cursorY, cardW, cardH, 6, 6, "FD");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(107, 114, 128);
    doc.text(c.label.toUpperCase(), x + 14, cursorY + 18);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(c.color[0], c.color[1], c.color[2]);
    doc.text(c.value, x + 14, cursorY + 42);
  });
  cursorY += cardH + 28;

  // --- Pie chart + legend ---
  const sectionTitle = (title: string) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11.5);
    doc.setTextColor(17, 24, 39);
    doc.text(title, margin, cursorY);
    cursorY += 8;
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.5);
    doc.line(margin, cursorY, pageW - margin, cursorY);
    cursorY += 16;
  };

  sectionTitle("Distribuição de Despesas por Categoria");

  const totalExpenses = input.expensesByCategory.reduce((s, c) => s + c.total, 0);
  const pieSize = 200;
  const pieX = margin;
  const pieY = cursorY;

  if (input.expensesByCategory.length === 0 || totalExpenses === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    doc.setTextColor(107, 114, 128);
    doc.text("Sem despesas no período selecionado.", margin, cursorY + 10);
    cursorY += 30;
  } else {
    // Ensure pie fits
    if (pieY + pieSize > pageH - 80) {
      doc.addPage();
      drawHeader();
      cursorY = contentTop;
    }
    const png = renderPieChartPNG(
      input.expensesByCategory.map((c) => ({
        label: c.label,
        value: c.total,
        color: c.color,
      })),
      900,
    );
    if (png) {
      doc.addImage(png, "PNG", pieX, cursorY, pieSize, pieSize, undefined, "FAST");
    }

    // Legend on the right
    const legX = pieX + pieSize + 24;
    let legY = cursorY + 6;
    const rowH = 16;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    const maxLegendRows = Math.min(input.expensesByCategory.length, Math.floor(pieSize / rowH));
    for (let i = 0; i < maxLegendRows; i++) {
      const c = input.expensesByCategory[i];
      const pct = (c.total / totalExpenses) * 100;
      const [r, g, b] = cssColorToRGB(c.color);
      doc.setFillColor(r, g, b);
      doc.circle(legX + 4, legY + 4, 3.5, "F");
      doc.setTextColor(17, 24, 39);
      doc.text(c.label, legX + 14, legY + 7);
      doc.setTextColor(107, 114, 128);
      const pctStr = `${pct.toFixed(1)}%`;
      const valStr = fmtBRL(c.total);
      doc.text(`${valStr}  ·  ${pctStr}`, pageW - margin, legY + 7, { align: "right" });
      legY += rowH;
    }
    if (input.expensesByCategory.length > maxLegendRows) {
      doc.setTextColor(156, 163, 175);
      doc.text(
        `+ ${input.expensesByCategory.length - maxLegendRows} categorias na tabela abaixo`,
        legX,
        legY + 6,
      );
    }
    cursorY += pieSize + 24;
  }

  // --- Table: expenses by category ---
  if (input.expensesByCategory.length > 0) {
    autoTable(doc, {
      startY: cursorY,
      margin: { left: margin, right: margin, top: contentTop, bottom: 48 },
      head: [["Categoria", "Lançamentos", "Total", "%"]],
      body: input.expensesByCategory.map((c) => {
        const pct = totalExpenses > 0 ? (c.total / totalExpenses) * 100 : 0;
        const sample = c.sampleDescriptions.slice(0, 3).join(", ");
        const desc = sample
          ? `${c.count} lançamento${c.count > 1 ? "s" : ""} — ${sample}`
          : `${c.count} lançamento${c.count > 1 ? "s" : ""}`;
        return [c.label, desc, fmtBRL(c.total), `${pct.toFixed(1)}%`];
      }),
      styles: {
        font: "helvetica",
        fontSize: 9.5,
        cellPadding: 8,
        textColor: COLOR_TEXT,
        lineColor: COLOR_LINE,
        lineWidth: 0.5,
      },
      headStyles: {
        fillColor: COLOR_HEADER_BG,
        textColor: COLOR_TEXT,
        fontStyle: "bold",
        fontSize: 9.5,
        lineColor: COLOR_LINE,
        lineWidth: 0.5,
      },
      alternateRowStyles: { fillColor: [255, 255, 255] },
      columnStyles: {
        0: { cellWidth: 110, fontStyle: "bold" },
        1: { cellWidth: "auto", textColor: COLOR_MUTED },
        2: { cellWidth: 90, halign: "right" },
        3: { cellWidth: 50, halign: "right", textColor: COLOR_MUTED },
      },
      theme: "plain",
      didDrawPage: () => {
        drawHeader();
      },
    });
    cursorY = (doc as any).lastAutoTable.finalY + 28;
  }

  // --- Table: incomes by client ---
  // Force new page if low room
  if (cursorY > pageH - 200) {
    doc.addPage();
    drawHeader();
    cursorY = contentTop;
  }

  sectionTitle("Entradas por Cliente");

  if (input.incomesByClient.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    doc.setTextColor(107, 114, 128);
    doc.text("Nenhum cliente com cobranças no período.", margin, cursorY + 6);
  } else {
    autoTable(doc, {
      startY: cursorY,
      margin: { left: margin, right: margin, top: contentTop, bottom: 48 },
      head: [["Cliente", "Total no Período", "Status"]],
      body: input.incomesByClient.map((c) => [c.name, fmtBRL(c.total), c.status]),
      styles: {
        font: "helvetica",
        fontSize: 9.5,
        cellPadding: 8,
        textColor: COLOR_TEXT,
        lineColor: COLOR_LINE,
        lineWidth: 0.5,
      },
      headStyles: {
        fillColor: COLOR_HEADER_BG,
        textColor: COLOR_TEXT,
        fontStyle: "bold",
        fontSize: 9.5,
        lineColor: COLOR_LINE,
        lineWidth: 0.5,
      },
      columnStyles: {
        0: { cellWidth: "auto", fontStyle: "bold" },
        1: { cellWidth: 130, halign: "right" },
        2: { cellWidth: 90, halign: "right" },
      },
      theme: "plain",
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 2) {
          const v = String(data.cell.raw);
          if (v === "Recebido") data.cell.styles.textColor = [4, 120, 87];
          else if (v === "Parcial") data.cell.styles.textColor = [180, 83, 9];
          else if (v === "Pendente") data.cell.styles.textColor = [185, 28, 28];
          else data.cell.styles.textColor = [156, 163, 175];
        }
      },
      didDrawPage: () => {
        drawHeader();
      },
    });
  }

  // Footers on every page
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    drawFooter(i, pageCount);
  }

  const safeName = input.companyName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const safePeriod = input.periodLabel
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  doc.save(`relatorio-${safeName || "empresa"}-${safePeriod || "periodo"}.pdf`);
}
