import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import type { BillingUnit, Insurer, Invoice, InvoiceStatus } from "../types";

type BillingReportOptions = {
  organizationName: string;
  unit: BillingUnit;
  periodKey: string;
  periodLabel: string;
  invoices: Invoice[];
  insurers: Insurer[];
};

const TAX_RATE = 9.15;
const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const alphabetic = new Intl.Collator("pt-BR", { sensitivity: "base" });

const receivedLabels: Record<InvoiceStatus, string> = {
  draft: "Não",
  submitted: "Não",
  pending: "Não",
  partial: "Parcial",
  received: "Sim",
  cancelled: "Cancelado",
};

const calculateTax = (paid: number) => paid * (TAX_RATE / 100);

export function buildBillingReport({
  organizationName,
  unit,
  periodKey,
  periodLabel,
  invoices,
  insurers,
}: BillingReportOptions) {
  const document = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });
  const pageWidth = document.internal.pageSize.getWidth();
  const insurerNames = new Map(
    insurers.map((insurer) => [insurer.id, insurer.name]),
  );
  const sortedInvoices = [...invoices].sort((a, b) => {
    const byName = alphabetic.compare(
      insurerNames.get(a.insurer_id) || "",
      insurerNames.get(b.insurer_id) || "",
    );
    return byName || b.updated_at.localeCompare(a.updated_at);
  });
  const totals = sortedInvoices.reduce(
    (result, invoice) => {
      const paid = Number(invoice.received_amount);
      const tax = calculateTax(paid);
      result.production += Number(invoice.gross_amount);
      result.glosa += Number(invoice.glosa_amount);
      result.paid += paid;
      result.tax += tax;
      result.net += Math.max(0, paid - tax);
      return result;
    },
    { production: 0, glosa: 0, paid: 0, tax: 0, net: 0 },
  );

  document.setProperties({
    title: `Relatório de faturamento ${unit} - ${periodLabel}`,
    subject: `Faturamento mensal da unidade ${unit}`,
    author: organizationName,
    creator: "Sistema HPOLI",
  });

  document.setFillColor(7, 47, 67);
  document.rect(0, 0, pageWidth, 31, "F");
  document.setFillColor(20, 147, 140);
  document.rect(0, 29, pageWidth, 2, "F");

  document.setFillColor(20, 147, 140);
  document.roundedRect(12, 7, 13, 13, 2.5, 2.5, "F");
  document.setTextColor(255, 255, 255);
  document.setFont("helvetica", "bold");
  document.setFontSize(11);
  document.text("H", 18.5, 15.7, { align: "center" });
  document.setFontSize(13);
  document.text("HPOLI", 30, 12);
  document.setFont("helvetica", "normal");
  document.setFontSize(7.5);
  document.text("CENTRO MÉDICO", 30, 17);

  document.setFont("helvetica", "bold");
  document.setFontSize(16);
  document.text(`Faturamento ${unit}`, pageWidth - 12, 12.5, {
    align: "right",
  });
  document.setFont("helvetica", "normal");
  document.setFontSize(9);
  document.text(periodLabel, pageWidth - 12, 18.2, { align: "right" });

  const summaryItems = [
    { label: "PRODUÇÃO", value: totals.production, color: [17, 105, 138] },
    { label: "GLOSA", value: totals.glosa, color: [194, 129, 36] },
    { label: "VALOR PAGO", value: totals.paid, color: [10, 122, 117] },
    { label: "VALOR LÍQUIDO", value: totals.net, color: [69, 87, 98] },
  ] as const;
  const cardGap = 4;
  const cardWidth = (pageWidth - 24 - cardGap * 3) / 4;

  summaryItems.forEach((item, index) => {
    const x = 12 + index * (cardWidth + cardGap);
    document.setFillColor(248, 251, 252);
    document.setDrawColor(221, 229, 232);
    document.roundedRect(x, 37, cardWidth, 20, 2, 2, "FD");
    document.setFillColor(item.color[0], item.color[1], item.color[2]);
    document.roundedRect(x, 37, 2.2, 20, 1, 1, "F");
    document.setTextColor(99, 115, 124);
    document.setFont("helvetica", "bold");
    document.setFontSize(6.8);
    document.text(item.label, x + 6, 44);
    document.setTextColor(23, 35, 45);
    document.setFontSize(12);
    document.text(money.format(item.value), x + 6, 51.7);
  });

  autoTable(document, {
    startY: 64,
    margin: { top: 18, right: 12, bottom: 18, left: 12 },
    head: [
      [
        "CONVÊNIO",
        "PRODUÇÃO",
        "GLOSA",
        "VALOR PAGO",
        "IMPOSTO 9,15%",
        "VALOR LÍQUIDO",
        "RECEBIDO",
        "RATEIO",
      ],
    ],
    body: sortedInvoices.map((invoice) => {
      const paid = Number(invoice.received_amount);
      const tax = calculateTax(paid);
      return [
        insurerNames.get(invoice.insurer_id) || "Convênio não identificado",
        money.format(Number(invoice.gross_amount)),
        money.format(Number(invoice.glosa_amount)),
        money.format(paid),
        money.format(tax),
        money.format(Math.max(0, paid - tax)),
        receivedLabels[invoice.status],
        invoice.production_split_done ? "Sim" : "Não",
      ];
    }),
    foot: [
      [
        "TOTAL",
        money.format(totals.production),
        money.format(totals.glosa),
        money.format(totals.paid),
        money.format(totals.tax),
        money.format(totals.net),
        "",
        "",
      ],
    ],
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 7.2,
      cellPadding: 2.5,
      lineColor: [221, 229, 232],
      lineWidth: 0.15,
      textColor: [69, 87, 98],
      valign: "middle",
    },
    headStyles: {
      fillColor: [11, 79, 108],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 6.7,
      minCellHeight: 9,
    },
    footStyles: {
      fillColor: [223, 243, 241],
      textColor: [23, 35, 45],
      fontStyle: "bold",
    },
    alternateRowStyles: { fillColor: [249, 251, 252] },
    columnStyles: {
      0: { cellWidth: 60, fontStyle: "bold" },
      1: { cellWidth: 33, halign: "right" },
      2: { cellWidth: 30, halign: "right" },
      3: { cellWidth: 33, halign: "right" },
      4: { cellWidth: 32, halign: "right" },
      5: { cellWidth: 34, halign: "right" },
      6: { cellWidth: 25, halign: "center" },
      7: { cellWidth: 26, halign: "center" },
    },
    willDrawPage: ({ pageNumber }) => {
      if (pageNumber === 1) return;
      document.setFillColor(7, 47, 67);
      document.rect(0, 0, pageWidth, 12, "F");
      document.setTextColor(255, 255, 255);
      document.setFont("helvetica", "bold");
      document.setFontSize(8);
      document.text(`HPOLI - Faturamento ${unit}`, 12, 8);
      document.setFont("helvetica", "normal");
      document.text(periodLabel, pageWidth - 12, 8, { align: "right" });
    },
  });

  const generatedAt = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date());
  const pageCount = document.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    document.setPage(page);
    const pageHeight = document.internal.pageSize.getHeight();
    document.setDrawColor(221, 229, 232);
    document.line(12, pageHeight - 11, pageWidth - 12, pageHeight - 11);
    document.setTextColor(132, 145, 152);
    document.setFont("helvetica", "normal");
    document.setFontSize(6.8);
    document.text(`${organizationName} - Gerado em ${generatedAt}`, 12, pageHeight - 6);
    document.text(`Página ${page} de ${pageCount}`, pageWidth - 12, pageHeight - 6, {
      align: "right",
    });
  }

  return document;
}

export function downloadBillingReport(options: BillingReportOptions) {
  const document = buildBillingReport(options);
  const filename = `relatorio-faturamento-${options.unit.toLowerCase()}-${
    options.periodKey
  }.pdf`;
  document.save(filename);
}
