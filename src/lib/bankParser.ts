import type { CategoryCode, TransactionType } from "@/data/cashflow";
import * as pdfjsLib from "pdfjs-dist";

// Configure worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.9.155/pdf.worker.min.mjs`;

export interface ParsedBankEntry {
  id: number;
  empresa: string;
  valor: number;
  data: string; // YYYY-MM-DD
  tipo: TransactionType;
  categoria: CategoryCode;
  subcategoria: string | null;
  pago: boolean;
  approved: boolean;
  matchedFrom?: string; // suggestion from existing transaction
}

/**
 * Extract text from a PDF file using pdf.js
 */
export async function extractPDFText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((item: any) => item.str)
      .join(" ");
    pages.push(text);
  }

  return pages.join("\n");
}

/**
 * Parse bank statement text extracted from PDF
 * Supports Sicoob and similar Brazilian bank statement formats
 */
export function parsePDFText(text: string): ParsedBankEntry[] {
  const entries: ParsedBankEntry[] = [];

  // Try to find year from header (e.g., "PERÍODO: 01/03/2026 - 11/03/2026" or "Data: 11/03/2026")
  let year = new Date().getFullYear().toString();
  const yearMatch = text.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (yearMatch) {
    year = yearMatch[3];
  }

  // Current month tracking - updated when we see date patterns
  let currentMonth = yearMatch ? yearMatch[2] : (new Date().getMonth() + 1).toString().padStart(2, "0");

  // Pattern 1: "DD/MM ... VALUE[D|C]" - most common in Sicoob statements
  // Match lines like: "02/03 PIX EMIT.OUTRA IF 40,00D"
  // or: "02/03 PIX RECEB.OUTRA IF 173,14C"
  const txnRegex = /(\d{2})\/(\d{2})\s+([\s\S]*?)\s+(\d{1,3}(?:\.\d{3})*,\d{2})\s*([DC])/g;

  let match;
  const seenIds = new Set<string>();

  while ((match = txnRegex.exec(text)) !== null) {
    const day = match[1];
    const month = match[2];
    let desc = match[3].trim();
    const rawValue = match[4];
    const type = match[5]; // D = debit, C = credit

    // Skip non-transaction lines
    if (/SALDO (ANTERIOR|DO DIA|BLOQ)/i.test(desc)) continue;

    // Clean up description - remove extra spaces
    desc = desc.replace(/\s+/g, " ").trim();

    // Skip empty or very short descriptions
    if (desc.length < 2) continue;

    // Parse value: "1.310,01" → 1310.01
    const valor = parseFloat(rawValue.replace(/\./g, "").replace(",", "."));
    if (isNaN(valor) || valor === 0) continue;

    const data = `${year}-${month}-${day}`;
    const tipo: TransactionType = type === "C" ? "entrada" : "saida";

    // Create a dedup key
    const dedupKey = `${data}-${desc}-${valor}-${tipo}`;
    if (seenIds.has(dedupKey)) continue;
    seenIds.add(dedupKey);

    entries.push({
      id: Date.now() + Math.random() * 100000,
      empresa: desc,
      valor,
      data,
      tipo,
      categoria: "O",
      subcategoria: null,
      pago: true,
      approved: false,
    });
  }

  return entries;
}

/**
 * Parse OFX (Open Financial Exchange) file content
 */
export function parseOFX(content: string): ParsedBankEntry[] {
  const entries: ParsedBankEntry[] = [];
  const txnBlocks = content.match(/<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi) || [];

  for (const block of txnBlocks) {
    const getTag = (tag: string) => {
      const match = block.match(new RegExp(`<${tag}>([^<\\n]+)`, "i"));
      return match ? match[1].trim() : "";
    };

    const amount = parseFloat(getTag("TRNAMT").replace(",", ".")) || 0;
    const rawDate = getTag("DTPOSTED");
    const name = getTag("NAME").replace(/\s+/g, " ").trim();
    const memo = getTag("MEMO").replace(/\s+/g, " ").trim();

    // Prefer NAME (payee) over MEMO (transaction type description)
    // Combine both if available for richer context
    let empresa = "Transação bancária";
    if (name && memo) {
      empresa = `${name} - ${memo}`;
    } else if (name) {
      empresa = name;
    } else if (memo) {
      empresa = memo;
    }

    let data = new Date().toISOString().split("T")[0];
    if (rawDate.length >= 8) {
      const y = rawDate.substring(0, 4);
      const m = rawDate.substring(4, 6);
      const d = rawDate.substring(6, 8);
      data = `${y}-${m}-${d}`;
    }

    // Use TRNTYPE for more accurate type detection
    const trnType = getTag("TRNTYPE").toUpperCase();
    const tipo: TransactionType = 
      trnType === "CREDIT" || amount > 0 ? "entrada" : "saida";

    entries.push({
      id: Date.now() + Math.random() * 10000,
      empresa,
      valor: Math.abs(amount),
      data,
      tipo,
      categoria: "O",
      subcategoria: null,
      pago: true,
      approved: false,
    });
  }

  return entries;
}

/**
 * Parse CSV bank statement
 */
export function parseCSV(content: string): ParsedBankEntry[] {
  const lines = content.trim().split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  const separator = lines[0].includes(";") ? ";" : ",";
  const header = lines[0].toLowerCase().split(separator).map((h) => h.trim().replace(/"/g, ""));

  const dateCol = header.findIndex((h) => /data|date|dt/i.test(h));
  const descCol = header.findIndex((h) => /descri|memo|hist|name|detail/i.test(h));
  const amountCol = header.findIndex((h) => /valor|amount|vlr|quantia/i.test(h));
  const debitCol = header.findIndex((h) => /d[eé]bito|debit|sa[ií]da/i.test(h));
  const creditCol = header.findIndex((h) => /cr[eé]dito|credit|entrada/i.test(h));

  const entries: ParsedBankEntry[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(separator).map((c) => c.trim().replace(/^"|"$/g, ""));

    const rawDate = dateCol >= 0 ? cols[dateCol] : "";
    const desc = descCol >= 0 ? cols[descCol] : cols[1] || "Transação";

    let amount = 0;
    if (amountCol >= 0) {
      amount = parseFloat(cols[amountCol].replace(/[^\d.,-]/g, "").replace(",", ".")) || 0;
    } else if (debitCol >= 0 || creditCol >= 0) {
      const debit = debitCol >= 0 ? parseFloat(cols[debitCol]?.replace(/[^\d.,-]/g, "").replace(",", ".")) || 0 : 0;
      const credit = creditCol >= 0 ? parseFloat(cols[creditCol]?.replace(/[^\d.,-]/g, "").replace(",", ".")) || 0 : 0;
      amount = credit > 0 ? credit : -debit;
    }

    if (amount === 0 && !desc) continue;

    let data = new Date().toISOString().split("T")[0];
    if (rawDate) {
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(rawDate)) {
        const [d, m, y] = rawDate.split("/");
        data = `${y}-${m}-${d}`;
      } else if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
        data = rawDate;
      } else if (/^\d{2}-\d{2}-\d{4}$/.test(rawDate)) {
        const [d, m, y] = rawDate.split("-");
        data = `${y}-${m}-${d}`;
      }
    }

    entries.push({
      id: Date.now() + i + Math.random() * 10000,
      empresa: desc,
      valor: Math.abs(amount),
      data,
      tipo: amount >= 0 ? "entrada" : "saida",
      categoria: "O",
      subcategoria: null,
      pago: true,
      approved: false,
    });
  }

  return entries;
}

export function parseFile(fileName: string, content: string): ParsedBankEntry[] {
  const ext = fileName.toLowerCase().split(".").pop();
  if (ext === "ofx" || ext === "ofc") return parseOFX(content);
  if (ext === "csv" || ext === "txt") return parseCSV(content);
  return [];
}
