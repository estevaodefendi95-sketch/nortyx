## Exportação de Relatório Financeiro em PDF

### 1. Biblioteca

Usar **jsPDF** + **jspdf-autotable** (tabelas com quebra de página nativa, sem cortes) e renderizar o gráfico de pizza via **Canvas 2D** em alta resolução (2x DPI), inserido como imagem PNG no PDF. Evita html2canvas (gera fontes embaçadas e quebras imprecisas).

```
bun add jspdf jspdf-autotable
```

### 2. Novo arquivo: `src/lib/pdfReport.ts`

Função `exportFinancialReport({ organization, periodLabel, expensesByCategory, incomesByClient, transactions })` que:

- Cria documento A4 retrato, margens 48pt, fundo branco.
- **Header (todas as páginas)**:
  - Logo do cliente (esquerda, 40pt altura) — de `organization.logo_url`, convertida para dataURL preservando resolução; fallback: iniciais do `companyName` em quadrado cinza claro.
  - Título "Relatório de Desempenho Financeiro" (direita, 16pt, cinza #1f2937, semibold).
  - Subtítulo `Período: dd/mm/aaaa a dd/mm/aaaa` (10pt, cinza #6b7280).
  - Linha divisória fina #e5e7eb sob o header.
- **Resumo** (cards minimalistas): Entrada, Saída, Saldo do período.
- **Seção Distribuição de Despesas**:
  - Pie chart desenhado em canvas 600×600 (donut sutil, cores da paleta do app), inserido em ~300×300pt no PDF.
  - Legenda lateral: bolinha + categoria + percentual.
- **Tabela "Gastos por Categoria"** (autoTable): Categoria | Lançamentos (top 3 descrições) | Total | % do total. Header cinza #f3f4f6, divisórias #e5e7eb 0.5pt, padding generoso.
- **Tabela "Entradas por Cliente"** (autoTable, nova página se faltar espaço): Cliente | Total no Período | Status (Recebido / Parcial / Pendente, cores sutis).
- **Footer**: número da página "x / y" + data de emissão, 8pt #9ca3af.

Quebras de página: autoTable evita cortar linhas; antes do pie chart, checar espaço e `doc.addPage()` se necessário.

### 3. Agregação de dados — `src/hooks/useReportData.ts`

A partir de `transactions`, `dailyIncomes`, `billing_charges`, `clients`, `categories` filtrados por `selectedMonths`/`selectedYear`:

- `expensesByCategory`: `[{ code, label, color, total, count, sampleDescriptions[] }]` ordenado desc.
- `incomesByClient`: agrupando `billing_charges` por `client_id` → `[{ name, total, status }]`.
- `periodLabel`: primeiro dia do menor mês ao último dia do maior (ou "Ano todo" se Todos).

### 4. Botão "Exportar Relatório (PDF)"

Em `src/pages/Index.tsx`, na linha do seletor de ano/meses (à direita, fora do scroll horizontal):

- `Button` outline sm com ícone `FileDown`, label "Exportar PDF" em ≥sm.
- Estado `exporting` desabilita e mostra spinner.
- `doc.save("relatorio-<empresa>-<periodo>.pdf")`.

### 5. Detalhes técnicos

- Conversão da logo: `fetch → blob → FileReader.readAsDataURL`; medir dimensões com `Image` para preservar proporção.
- Cores do gráfico: `DEFAULT_COLORS` do CategoriesContext + fallback HSL determinístico.
- Fontes: Helvetica embutida do jsPDF.

### Arquivos afetados

- `src/lib/pdfReport.ts` (novo)
- `src/lib/pieChartCanvas.ts` (novo)
- `src/hooks/useReportData.ts` (novo)
- `src/components/ExportReportButton.tsx` (novo)
- `src/pages/Index.tsx` (botão na linha de filtros)
- `package.json` (jspdf, jspdf-autotable)
