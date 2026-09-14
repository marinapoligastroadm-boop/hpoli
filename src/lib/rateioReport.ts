import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import type {
  Distribution,
  Insurer,
  Invoice,
  Partner,
} from "../types";

type RateioReportOptions = {
  organizationName: string;
  periodKey: string;
  periodLabel: string;
  invoices: Invoice[];
  insurers: Insurer[];
  partners: Partner[];
  distributions: Distribution[];
};

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const dateFormatter = new Intl.DateTimeFormat("pt-BR");
const formatDate = (value: string | null) =>
  value
    ? dateFormatter.format(new Date(`${value.slice(0, 10)}T12:00:00`))
    : "—";

export function buildRateioReport({
  organizationName,
  periodLabel,
  invoices,
  insurers,
  partners,
  distributions,
}: RateioReportOptions) {
  const document = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });
  const pageWidth = document.internal.pageSize.getWidth();
  const insurerNames = new Map(
    insurers.map((insurer) => [insurer.id, insurer.name]),
  );
  const grouped = new Map<string, Distribution[]>();
  distributions.forEach((distribution) => {
    const current = grouped.get(distribution.invoice_id) || [];
    current.push(distribution);
    grouped.set(distribution.invoice_id, current);
  });
  const sortedPartners = [...partners].sort(
    (a, b) => a.sort_order - b.sort_order,
  );
  const totalReceived = invoices.reduce(
    (sum, invoice) => sum + Number(invoice.received_amount),
    0,
  );
  const partnerTotals = new Map(
    sortedPartners.map((partner) => [
      partner.id,
      invoices.reduce(
        (sum, invoice) =>
          sum +
          Number(
            (grouped.get(invoice.id) || []).find(
              (item) => item.partner_id === partner.id,
            )?.distributed_amount || 0,
          ),
        0,
      ),
    ]),
  );
  const totalDistributed = Array.from(partnerTotals.values()).reduce(
    (sum, value) => sum + value,
    0,
  );

  document.setProperties({
    title: `Relatório de rateio - ${periodLabel}`,
    subject: "Rateio mensal dos faturamentos recebidos",
    author: organizationName,
    creator: "Sistema HPOLI",
  });

  document.setFillColor(7, 47, 67);
  document.rect(0, 0, pageWidth, 31, "F");
  document.setFillColor(20, 147, 140);
  document.rect(0, 29, pageWidth, 2, "F");
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
  document.text("Rateio de Radiologia", pageWidth - 12, 12.5, {
    align: "right",
  });
  document.setFont("helvetica", "normal");
  document.setFontSize(9);
  document.text(periodLabel, pageWidth - 12, 18.2, { align: "right" });

  const summary = [
    ["TOTAL RECEBIDO", totalReceived, [17, 105, 138]],
    ["TOTAL RATEADO", totalDistributed, [10, 122, 117]],
    ["DIFERENÇA", totalReceived - totalDistributed, [194, 129, 36]],
  ] as const;
  const cardGap = 5;
  const cardWidth = (pageWidth - 24 - cardGap * 2) / 3;
  summary.forEach(([label, value, color], index) => {
    const x = 12 + index * (cardWidth + cardGap);
    document.setFillColor(248, 251, 252);
    document.setDrawColor(221, 229, 232);
    document.roundedRect(x, 37, cardWidth, 20, 2, 2, "FD");
    document.setFillColor(color[0], color[1], color[2]);
    document.roundedRect(x, 37, 2.2, 20, 1, 1, "F");
    document.setTextColor(99, 115, 124);
    document.setFont("helvetica", "bold");
    document.setFontSize(6.8);
    document.text(label, x + 6, 44);
    document.setTextColor(23, 35, 45);
    document.setFontSize(12);
    document.text(money.format(value), x + 6, 51.7);
  });

  const head = [
    "DATA DA BAIXA",
    "CONVÊNIO",
    "UNIDADE",
    "COMPETÊNCIA",
    "VALOR RECEBIDO",
    ...sortedPartners.map((partner) => partner.name.toUpperCase()),
    "TOTAL RATEADO",
  ];
  const body = invoices.map((invoice) => {
    const items = grouped.get(invoice.id) || [];
    const values = sortedPartners.map(
      (partner) =>
        Number(
          items.find((item) => item.partner_id === partner.id)
            ?.distributed_amount || 0,
        ),
    );
    return [
      formatDate(invoice.paid_at),
      insurerNames.get(invoice.insurer_id) || "Convênio",
      invoice.billing_unit,
      invoice.competence.slice(0, 7).split("-").reverse().join("/"),
      money.format(Number(invoice.received_amount)),
      ...values.map((value) => money.format(value)),
      money.format(values.reduce((sum, value) => sum + value, 0)),
    ];
  });
  const foot = [
    "TOTAL DO MÊS",
    "",
    "",
    "",
    money.format(totalReceived),
    ...sortedPartners.map((partner) =>
      money.format(partnerTotals.get(partner.id) || 0),
    ),
    money.format(totalDistributed),
  ];

  autoTable(document, {
    startY: 64,
    margin: { top: 18, right: 10, bottom: 18, left: 10 },
    head: [head],
    body,
    foot: [foot],
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 6.5,
      cellPadding: 2.2,
      lineColor: [221, 229, 232],
      lineWidth: 0.15,
      textColor: [69, 87, 98],
      valign: "middle",
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: [11, 79, 108],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 6.2,
      minCellHeight: 10,
      halign: "center",
    },
    footStyles: {
      fillColor: [223, 243, 241],
      textColor: [23, 35, 45],
      fontStyle: "bold",
      halign: "right",
    },
    alternateRowStyles: { fillColor: [249, 251, 252] },
    columnStyles: {
      0: { cellWidth: 24, halign: "center" },
      1: { cellWidth: 48, fontStyle: "bold" },
      2: { cellWidth: 18, halign: "center" },
      3: { cellWidth: 23, halign: "center" },
      4: { cellWidth: 30, halign: "right" },
    },
    didParseCell: (hookData) => {
      if (hookData.column.index >= 5) hookData.cell.styles.halign = "right";
    },
    willDrawPage: ({ pageNumber }) => {
      if (pageNumber === 1) return;
      document.setFillColor(7, 47, 67);
      document.rect(0, 0, pageWidth, 12, "F");
      document.setTextColor(255, 255, 255);
      document.setFont("helvetica", "bold");
      document.setFontSize(8);
      document.text("HPOLI - Rateio de Radiologia", 10, 8);
      document.setFont("helvetica", "normal");
      document.text(periodLabel, pageWidth - 10, 8, { align: "right" });
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
    document.line(10, pageHeight - 11, pageWidth - 10, pageHeight - 11);
    document.setTextColor(132, 145, 152);
    document.setFont("helvetica", "normal");
    document.setFontSize(6.8);
    document.text(`${organizationName} - Gerado em ${generatedAt}`, 10, pageHeight - 6);
    document.text(`Página ${page} de ${pageCount}`, pageWidth - 10, pageHeight - 6, {
      align: "right",
    });
  }

  return document;
}

export function downloadRateioReport(options: RateioReportOptions) {
  const document = buildRateioReport(options);
  document.save(`relatorio-rateio-${options.periodKey}.pdf`);
}
