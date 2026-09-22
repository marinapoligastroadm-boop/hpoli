import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import {
  BarChart3,
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Download,
  Edit3,
  FileText,
  Landmark,
  LoaderCircle,
  LogOut,
  Menu,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  TrendingUp,
  UserRound,
  UsersRound,
  WalletCards,
  X,
} from "lucide-react";
import { AuthView } from "./components/AuthView";
import {
  InsurerDeleteDialog,
  InsurerDialog,
} from "./components/InsurerDialog";
import { InvoiceDialog } from "./components/InvoiceDialog";
import {
  RateioDialog,
  type RateioEditValues,
} from "./components/RateioDialog";
import { RateioCompetenceDialog } from "./components/RateioCompetenceDialog";
import {
  calculateHolRateio,
  calculateRateioBase,
} from "./lib/rateioCalculations";
import { supabase } from "./lib/supabase";
import {
  calculateNetPaidAmount,
  calculateTaxFromPaidAmount,
  DEFAULT_TAX_RATE,
  taxRateForInsurer,
} from "./lib/taxCalculations";
import type {
  BillingUnit,
  Distribution,
  Insurer,
  InsurerFormValues,
  Invoice,
  InvoiceFormValues,
  InvoiceStatus,
  Membership,
  Partner,
} from "./types";

type Page = "overview" | BillingUnit | "insurers" | "partners";

type AppData = {
  membership: Membership;
  organizationName: string;
  fullName: string;
  insurers: Insurer[];
  invoices: Invoice[];
  partners: Partner[];
  distributions: Distribution[];
};

const monthNames = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

const fullMonthNames = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const rateioUnitLabels: Record<BillingUnit, string> = {
  HPOLI: "Rateio HPOLI",
  HOL: "Rateio HOL",
  DIA: "Rateio Clínica DIA",
};

const rateioUnits: BillingUnit[] = ["HPOLI", "HOL", "DIA"];

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const alphabetic = new Intl.Collator("pt-BR", { sensitivity: "base" });

const receiptLabel = (status: InvoiceStatus) => {
  if (status === "received") return "Sim";
  if (status === "partial") return "Parcial";
  return "Não";
};

const receiptStatusClass = (status: InvoiceStatus) =>
  status === "received" || status === "partial" ? status : "pending";

const receiptDateFormatter = new Intl.DateTimeFormat("pt-BR");
const formatReceiptDate = (value: string | null) => {
  if (!value) return "—";
  return receiptDateFormatter.format(new Date(`${value.slice(0, 10)}T12:00:00`));
};

const formatCompetenceMonth = (value: string | null) =>
  value ? value.slice(0, 7).split("-").reverse().join("/") : "Escolher mês";

const today = () => {
  const current = new Date();
  const local = new Date(current.getTime() - current.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
};

const addDays = (date: string, days: number) => {
  const parsed = new Date(`${date}T12:00:00`);
  parsed.setDate(parsed.getDate() + days);
  return parsed.toISOString().slice(0, 10);
};

const statusLabels: Record<InvoiceStatus, string> = {
  draft: "Rascunho",
  submitted: "Enviado",
  pending: "Pendente",
  partial: "Parcial",
  received: "Recebido",
  cancelled: "Cancelado",
};

const currentPeriod = () => {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() };
};

const periodKey = (year: number, month: number) =>
  `${year}-${String(month + 1).padStart(2, "0")}`;

function SplashScreen() {
  return (
    <main className="splash-screen">
      <span className="brand-symbol">H</span>
      <LoaderCircle className="spin" size={26} />
      <p>Preparando seu ambiente...</p>
    </main>
  );
}

function MonthSelector({
  year,
  month,
  onChange,
}: {
  year: number;
  month: number;
  onChange: (year: number, month: number) => void;
}) {
  return (
    <section className="month-selector" aria-label="Selecionar mês do faturamento">
      <div className="year-control">
        <button
          className="icon-button"
          type="button"
          onClick={() => onChange(year - 1, month)}
          aria-label={`Ano anterior: ${year - 1}`}
        >
          <ChevronLeft size={19} />
        </button>
        <strong>{year}</strong>
        <button
          className="icon-button"
          type="button"
          onClick={() => onChange(year + 1, month)}
          aria-label={`Próximo ano: ${year + 1}`}
        >
          <ChevronRight size={19} />
        </button>
      </div>
      <div className="month-buttons">
        {monthNames.map((name, index) => (
          <button
            type="button"
            key={name}
            className={month === index ? "active" : ""}
            aria-pressed={month === index}
            onClick={() => onChange(year, index)}
          >
            {name}
          </button>
        ))}
      </div>
    </section>
  );
}

function MetricCard({
  label,
  value,
  note,
  tone,
  icon,
}: {
  label: string;
  value: string;
  note: string;
  tone: "blue" | "teal" | "gold" | "slate";
  icon: React.ReactNode;
}) {
  return (
    <article className={`metric-card metric-${tone}`}>
      <div className="metric-icon">{icon}</div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{note}</small>
      </div>
    </article>
  );
}

function EmptyState({ unit }: { unit: BillingUnit }) {
  return (
    <div className="empty-state">
      <span>
        <FileText size={27} />
      </span>
      <h3>Nenhum faturamento neste mês</h3>
      <p>Cadastre o primeiro faturamento da unidade {unit}.</p>
    </div>
  );
}

function InvoiceTable({
  invoices,
  insurers,
  editable,
  onSetRateioCompetence,
  onEdit,
  onDelete,
}: {
  invoices: Invoice[];
  insurers: Insurer[];
  editable: boolean;
  onSetRateioCompetence: (invoice: Invoice) => void;
  onEdit: (invoice: Invoice) => void;
  onDelete: (invoice: Invoice) => void;
}) {
  const insurerNames = useMemo(
    () => new Map(insurers.map((insurer) => [insurer.id, insurer.name])),
    [insurers],
  );

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Convênio</th>
            <th>Produção</th>
            <th>Glosa</th>
            <th>Valor pago</th>
            <th>Imposto</th>
            <th>Valor líquido</th>
            <th>Recebido</th>
            <th>Data de recebimento</th>
            <th>Rateio feito na prod.</th>
            {editable ? <th className="actions-column">Ações</th> : null}
          </tr>
        </thead>
        <tbody>
          {invoices.map((invoice) => {
            const insurerName =
              insurerNames.get(invoice.insurer_id) || "Convênio";
            const paid = Number(invoice.received_amount);
            const tax = calculateTaxFromPaidAmount(
              paid,
              Number(invoice.tax_rate),
            );
            const net = calculateNetPaidAmount(
              paid,
              Number(invoice.tax_rate),
            );

            return (
              <tr key={invoice.id}>
                <td data-label="Convênio">
                  <strong>{insurerName}</strong>
                </td>
                <td data-label="Produção">
                  {brl.format(invoice.gross_amount)}
                </td>
                <td data-label="Glosa">{brl.format(invoice.glosa_amount)}</td>
                <td data-label="Valor pago">
                  {brl.format(invoice.received_amount)}
                </td>
                <td data-label="Imposto">
                  {Number(invoice.tax_rate) === 0 ? "Isento · " : ""}
                  {brl.format(tax)}
                </td>
                <td data-label="Valor líquido">{brl.format(net)}</td>
                <td data-label="Recebido">
                  <span
                    className={`status-pill status-${receiptStatusClass(invoice.status)}`}
                  >
                    {receiptLabel(invoice.status)}
                  </span>
                </td>
                <td data-label="Data de recebimento">
                  {formatReceiptDate(invoice.paid_at)}
                </td>
                <td data-label="Rateio feito na produção">
                  <button
                    className={`rateio-month-button${
                      invoice.rateio_competence ? " selected" : ""
                    }`}
                    type="button"
                    onClick={() => onSetRateioCompetence(invoice)}
                    disabled={!editable}
                    aria-label={`Escolher competência do rateio de ${insurerName}`}
                    title="Escolher competência do rateio"
                  >
                    <CalendarDays size={15} aria-hidden="true" />
                    {formatCompetenceMonth(invoice.rateio_competence)}
                  </button>
                  {invoice.rateio_competence &&
                  !invoice.production_split_done ? (
                    <small className="rateio-month-hint">
                      Aguardando recebimento
                    </small>
                  ) : null}
                </td>
                {editable ? (
                  <td className="row-actions" data-label="Ações">
                    <button
                      className="icon-button edit"
                      type="button"
                      onClick={() => onEdit(invoice)}
                      aria-label={`Editar faturamento de ${insurerName}`}
                      title="Editar faturamento"
                    >
                      <Edit3 size={17} />
                    </button>
                    <button
                      className="icon-button danger"
                      type="button"
                      onClick={() => onDelete(invoice)}
                      aria-label={`Excluir faturamento de ${insurerName}`}
                      title="Excluir faturamento"
                    >
                      <Trash2 size={17} />
                    </button>
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ConfirmDialog({
  invoice,
  deleting,
  onCancel,
  onConfirm,
}: {
  invoice: Invoice | null;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}) {
  if (!invoice) return null;
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onCancel}>
      <section
        className="dialog-panel confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-description"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <span className="danger-icon">
          <Trash2 size={23} />
        </span>
        <h2 id="confirm-title">Excluir faturamento?</h2>
        <p id="confirm-description">
          Este faturamento será excluído junto com os registros de recebimento e
          rateio relacionados. Esta ação não pode ser desfeita.
        </p>
        <div className="dialog-actions">
          <button
            className="secondary-button"
            type="button"
            onClick={onCancel}
            disabled={deleting}
          >
            Cancelar
          </button>
          <button
            className="danger-button"
            type="button"
            onClick={onConfirm}
            disabled={deleting}
          >
            {deleting ? <LoaderCircle className="spin" size={18} /> : null}
            Excluir faturamento
          </button>
        </div>
      </section>
    </div>
  );
}

function BillingPage({
  unit,
  data,
  user,
  onReload,
  notify,
}: {
  unit: BillingUnit;
  data: AppData;
  user: User;
  onReload: () => Promise<void>;
  notify: (type: "success" | "error", message: string) => void;
}) {
  const initial = currentPeriod();
  const [year, setYear] = useState(initial.year);
  const [month, setMonth] = useState(initial.month);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<InvoiceStatus | "all">("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [rateioInvoice, setRateioInvoice] = useState<Invoice | null>(null);
  const [deleteInvoice, setDeleteInvoice] = useState<Invoice | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingRateioCompetence, setSavingRateioCompetence] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const selectedPeriod = periodKey(year, month);
  const insurerNames = useMemo(
    () => new Map(data.insurers.map((insurer) => [insurer.id, insurer.name])),
    [data.insurers],
  );
  const unitInvoices = useMemo(
    () =>
      data.invoices
        .filter(
          (invoice) =>
            invoice.billing_unit === unit &&
            invoice.competence.slice(0, 7) === selectedPeriod,
        )
        .sort((a, b) => {
          const byInsurer = alphabetic.compare(
            insurerNames.get(a.insurer_id) || "",
            insurerNames.get(b.insurer_id) || "",
          );
          return byInsurer || b.updated_at.localeCompare(a.updated_at);
        }),
    [data.invoices, insurerNames, selectedPeriod, unit],
  );

  const filteredInvoices = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    return unitInvoices.filter((invoice) => {
      const matchesStatus =
        status === "all" ||
        (status === "pending"
          ? invoice.status !== "partial" && invoice.status !== "received"
          : invoice.status === status);
      const matchesSearch =
        !term ||
        (insurerNames.get(invoice.insurer_id) || "")
          .toLocaleLowerCase("pt-BR")
          .includes(term);
      return matchesStatus && matchesSearch;
    });
  }, [insurerNames, search, status, unitInvoices]);

  const totals = useMemo(
    () =>
      unitInvoices.reduce(
        (accumulator, invoice) => ({
          production: accumulator.production + Number(invoice.gross_amount),
          glosa: accumulator.glosa + Number(invoice.glosa_amount),
          paid: accumulator.paid + Number(invoice.received_amount),
          net:
            accumulator.net +
            calculateNetPaidAmount(
              Number(invoice.received_amount),
              Number(invoice.tax_rate),
            ),
        }),
        { production: 0, glosa: 0, paid: 0, net: 0 },
      ),
    [unitInvoices],
  );

  const editable = data.membership.role !== "viewer";

  const openNew = () => {
    setEditingInvoice(null);
    setDialogOpen(true);
  };

  const openEdit = (invoice: Invoice) => {
    setEditingInvoice(invoice);
    setDialogOpen(true);
  };

  const downloadPdf = async () => {
    if (!unitInvoices.length) {
      notify("error", "Não há faturamentos neste mês para gerar o relatório.");
      return;
    }

    setExportingPdf(true);
    try {
      const { downloadBillingReport } = await import("./lib/billingReport");
      downloadBillingReport({
        organizationName: data.organizationName,
        unit,
        periodKey: selectedPeriod,
        periodLabel: `${fullMonthNames[month]} de ${year}`,
        invoices: unitInvoices,
        insurers: data.insurers,
      });
      notify("success", "Relatório em PDF gerado com sucesso.");
    } catch (error) {
      notify(
        "error",
        error instanceof Error
          ? error.message
          : "Não foi possível gerar o relatório em PDF.",
      );
    } finally {
      setExportingPdf(false);
    }
  };

  const saveInvoice = async (values: InvoiceFormValues) => {
    setSaving(true);
    try {
      const gross = Number(values.gross_amount.replace(",", ".")) || 0;
      const glosa = Number(values.glosa_amount.replace(",", ".")) || 0;
      const received = Number(values.received_amount.replace(",", ".")) || 0;
      const issueDate = editingInvoice?.issue_date || today();
      const insurer = data.insurers.find(
        (item) => item.id === values.insurer_id,
      );

      const payload = {
        organization_id: data.membership.organization_id,
        insurer_id: values.insurer_id,
        invoice_number:
          editingInvoice?.invoice_number ||
          `AUTO-${unit}-${selectedPeriod.replace("-", "")}-${crypto.randomUUID()
            .slice(0, 8)
            .toUpperCase()}`,
        competence: editingInvoice?.competence || `${selectedPeriod}-01`,
        issue_date: issueDate,
        due_date:
          editingInvoice?.due_date ||
          addDays(issueDate, insurer?.payment_term_days || 0),
        gross_amount: gross,
        tax_rate: insurer
          ? taxRateForInsurer(insurer.name)
          : DEFAULT_TAX_RATE,
        glosa_amount: glosa,
        received_amount: received,
        status: values.status,
        paid_at:
          values.status === "received" || values.status === "partial"
            ? values.paid_at || today()
            : null,
        production_split_done: values.production_split_done,
        notes: values.notes.trim() || null,
        billing_unit: unit,
      };

      if (editingInvoice) {
        const { error } = await supabase
          .from("invoices")
          .update(payload)
          .eq("id", editingInvoice.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("invoices").insert({
          ...payload,
          created_by: user.id,
        });
        if (error) throw error;
      }

      await onReload();
      setDialogOpen(false);
      setEditingInvoice(null);
      notify(
        "success",
        editingInvoice
          ? "Faturamento atualizado com sucesso."
          : "Faturamento cadastrado com sucesso.",
      );
    } catch (error) {
      notify(
        "error",
        error instanceof Error
          ? error.message
          : "Não foi possível salvar o faturamento.",
      );
    } finally {
      setSaving(false);
    }
  };

  const saveRateioCompetence = async (period: string | null) => {
    if (!rateioInvoice) return;
    setSavingRateioCompetence(true);
    try {
      const { error } = await supabase
        .from("invoices")
        .update({
          rateio_competence: period ? `${period}-01` : null,
        })
        .eq("id", rateioInvoice.id);
      if (error) throw error;

      await onReload();
      setRateioInvoice(null);
      notify(
        "success",
        period
          ? "Competência do rateio salva com sucesso."
          : "Competência do rateio removida.",
      );
    } catch (error) {
      notify(
        "error",
        error instanceof Error
          ? error.message
          : "Não foi possível salvar a competência do rateio.",
      );
    } finally {
      setSavingRateioCompetence(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteInvoice) return;
    setDeleting(true);
    try {
      const [paymentsResult, distributionsResult] = await Promise.all([
        supabase.from("payments").delete().eq("invoice_id", deleteInvoice.id),
        supabase
          .from("distributions")
          .delete()
          .eq("invoice_id", deleteInvoice.id),
      ]);
      if (paymentsResult.error) throw paymentsResult.error;
      if (distributionsResult.error) throw distributionsResult.error;

      const { error } = await supabase
        .from("invoices")
        .delete()
        .eq("id", deleteInvoice.id);
      if (error) throw error;

      await onReload();
      setDeleteInvoice(null);
      notify("success", "Faturamento excluído com sucesso.");
    } catch (error) {
      notify(
        "error",
        error instanceof Error
          ? error.message
          : "Não foi possível excluir o faturamento.",
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <div className="page-heading-row">
        <div>
          <span className="eyebrow">Unidade {unit}</span>
          <h1>Faturamento {unit}</h1>
          <p>
            {fullMonthNames[month]} de {year} · {unitInvoices.length}{" "}
            {unitInvoices.length === 1 ? "registro" : "registros"}
          </p>
        </div>
        <div className="page-heading-actions">
          <button
            className="secondary-button report-button"
            type="button"
            onClick={downloadPdf}
            disabled={!unitInvoices.length || exportingPdf}
          >
            {exportingPdf ? (
              <LoaderCircle className="spin" size={18} />
            ) : (
              <Download size={18} />
            )}
            {exportingPdf ? "Gerando PDF..." : "Baixar relatório PDF"}
          </button>
          {editable ? (
            <button className="primary-button" type="button" onClick={openNew}>
              <Plus size={19} /> Novo faturamento
            </button>
          ) : null}
        </div>
      </div>

      <MonthSelector
        year={year}
        month={month}
        onChange={(nextYear, nextMonth) => {
          setYear(nextYear);
          setMonth(nextMonth);
        }}
      />

      <section className="metrics-grid">
        <MetricCard
          label="Produção"
          value={brl.format(totals.production)}
          note="Produção total do mês"
          tone="blue"
          icon={<FileText size={21} />}
        />
        <MetricCard
          label="Glosa"
          value={brl.format(totals.glosa)}
          note="Glosas informadas"
          tone="gold"
          icon={<WalletCards size={21} />}
        />
        <MetricCard
          label="Valor pago"
          value={brl.format(totals.paid)}
          note="Valores pagos no mês"
          tone="teal"
          icon={<CircleDollarSign size={21} />}
        />
        <MetricCard
          label="Valor líquido"
          value={brl.format(totals.net)}
          note="Após os impostos aplicáveis"
          tone="slate"
          icon={<TrendingUp size={21} />}
        />
      </section>

      <section className="content-card">
        <div className="content-card-header table-toolbar">
          <div>
            <h2>Faturamentos do mês</h2>
            <p>Acompanhe produção, pagamentos, impostos e rateios.</p>
          </div>
          <div className="toolbar-controls">
            <label className="search-control">
              <Search size={17} aria-hidden="true" />
              <span className="sr-only">Buscar faturamento</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar convênio"
              />
            </label>
            <select
              className="status-filter"
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as InvoiceStatus | "all")
              }
              aria-label="Filtrar por status"
            >
              <option value="all">Todos</option>
              <option value="pending">Não recebido</option>
              <option value="partial">Recebido parcialmente</option>
              <option value="received">Recebido</option>
            </select>
          </div>
        </div>

        {filteredInvoices.length ? (
          <InvoiceTable
            invoices={filteredInvoices}
            insurers={data.insurers}
            editable={editable}
            onSetRateioCompetence={setRateioInvoice}
            onEdit={openEdit}
            onDelete={setDeleteInvoice}
          />
        ) : (
          <EmptyState unit={unit} />
        )}
      </section>

      <InvoiceDialog
        open={dialogOpen}
        unit={unit}
        invoice={editingInvoice}
        insurers={data.insurers}
        saving={saving}
        onClose={() => {
          if (!saving) {
            setDialogOpen(false);
            setEditingInvoice(null);
          }
        }}
        onSave={saveInvoice}
      />

      <RateioCompetenceDialog
        invoice={rateioInvoice}
        insurerName={
          rateioInvoice
            ? insurerNames.get(rateioInvoice.insurer_id) || "Convênio"
            : ""
        }
        defaultPeriod={selectedPeriod}
        saving={savingRateioCompetence}
        onClose={() =>
          !savingRateioCompetence && setRateioInvoice(null)
        }
        onSave={saveRateioCompetence}
      />

      <ConfirmDialog
        invoice={deleteInvoice}
        deleting={deleting}
        onCancel={() => !deleting && setDeleteInvoice(null)}
        onConfirm={confirmDelete}
      />
    </>
  );
}

function OverviewPage({ data }: { data: AppData }) {
  const current = currentPeriod();
  const selectedPeriod = periodKey(current.year, current.month);
  const monthInvoices = data.invoices.filter(
    (invoice) => invoice.competence.slice(0, 7) === selectedPeriod,
  );
  const totals = monthInvoices.reduce(
    (accumulator, invoice) => ({
      gross: accumulator.gross + Number(invoice.gross_amount),
      received: accumulator.received + Number(invoice.received_amount),
      outstanding:
        accumulator.outstanding + Number(invoice.outstanding_amount),
    }),
    { gross: 0, received: 0, outstanding: 0 },
  );
  const insurerNames = new Map(
    data.insurers.map((insurer) => [insurer.id, insurer.name]),
  );
  const recent = [...data.invoices]
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .slice(0, 5);

  return (
    <>
      <div className="page-heading-row overview-heading">
        <div>
          <span className="eyebrow">Visão geral</span>
          <h1>Olá, {data.fullName.split(" ")[0]}</h1>
          <p>
            Resumo financeiro de {fullMonthNames[current.month]} de {current.year}.
          </p>
        </div>
        <div className="date-badge">
          <CalendarDays size={18} />
          {fullMonthNames[current.month]} {current.year}
        </div>
      </div>

      <section className="metrics-grid overview-metrics">
        <MetricCard
          label="Faturamento total"
          value={brl.format(totals.gross)}
          note={`${monthInvoices.length} registros no mês`}
          tone="blue"
          icon={<BarChart3 size={21} />}
        />
        <MetricCard
          label="Total recebido"
          value={brl.format(totals.received)}
          note="Consolidado das unidades"
          tone="teal"
          icon={<CircleDollarSign size={21} />}
        />
        <MetricCard
          label="Saldo em aberto"
          value={brl.format(totals.outstanding)}
          note="Previsto para receber"
          tone="gold"
          icon={<WalletCards size={21} />}
        />
      </section>

      <section className="unit-summary-grid">
        {(["HPOLI", "DIA", "HOL"] as BillingUnit[]).map((unit) => {
          const items = monthInvoices.filter(
            (invoice) => invoice.billing_unit === unit,
          );
          const amount = items.reduce(
            (sum, invoice) => sum + Number(invoice.gross_amount),
            0,
          );
          const percentage = totals.gross > 0 ? (amount / totals.gross) * 100 : 0;
          return (
            <article className="unit-card" key={unit}>
              <div className="unit-card-top">
                <span className={`unit-badge unit-${unit.toLowerCase()}`}>
                  {unit}
                </span>
                <small>{items.length} registros</small>
              </div>
              <strong>{brl.format(amount)}</strong>
              <div className="progress-track" aria-hidden="true">
                <span style={{ width: `${percentage}%` }} />
              </div>
              <p>{percentage.toFixed(0)}% do faturamento mensal</p>
            </article>
          );
        })}
      </section>

      <section className="content-card recent-card">
        <div className="content-card-header">
          <div>
            <h2>Movimentações recentes</h2>
            <p>Últimos faturamentos atualizados no sistema.</p>
          </div>
        </div>
        {recent.length ? (
          <div className="recent-list">
            {recent.map((invoice) => (
              <article key={invoice.id}>
                <span className={`recent-unit unit-${invoice.billing_unit.toLowerCase()}`}>
                  {invoice.billing_unit}
                </span>
                <div>
                  <strong>
                    {insurerNames.get(invoice.insurer_id) || "Convênio"}
                  </strong>
                  <small>
                    Competência {invoice.competence.slice(0, 7).split("-").reverse().join("/")}
                  </small>
                </div>
                <strong>{brl.format(invoice.gross_amount)}</strong>
                <span className={`status-pill status-${invoice.status}`}>
                  {statusLabels[invoice.status]}
                </span>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state compact">
            <p>Nenhuma movimentação cadastrada.</p>
          </div>
        )}
      </section>
    </>
  );
}

function InsurersPage({
  data,
  onReload,
  notify,
}: {
  data: AppData;
  onReload: () => Promise<void>;
  notify: (type: "success" | "error", message: string) => void;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingInsurer, setEditingInsurer] = useState<Insurer | null>(null);
  const [deleteInsurer, setDeleteInsurer] = useState<Insurer | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const editable = data.membership.role !== "viewer";

  const invoiceCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const invoice of data.invoices) {
      counts.set(invoice.insurer_id, (counts.get(invoice.insurer_id) || 0) + 1);
    }
    return counts;
  }, [data.invoices]);

  const openNew = () => {
    setEditingInsurer(null);
    setDialogOpen(true);
  };

  const openEdit = (insurer: Insurer) => {
    setEditingInsurer(insurer);
    setDialogOpen(true);
  };

  const saveInsurer = async (values: InsurerFormValues) => {
    const name = values.name.trim();
    const paymentTermDays = Number(values.payment_term_days);

    if (!name) {
      notify("error", "Informe o nome do convênio.");
      return;
    }
    if (
      !Number.isInteger(paymentTermDays) ||
      paymentTermDays < 0 ||
      paymentTermDays > 3650
    ) {
      notify("error", "Informe um prazo de pagamento válido.");
      return;
    }

    const normalizedName = name.toLocaleLowerCase("pt-BR");
    const duplicate = data.insurers.some(
      (insurer) =>
        insurer.id !== editingInsurer?.id &&
        insurer.name.trim().toLocaleLowerCase("pt-BR") === normalizedName,
    );
    if (duplicate) {
      notify("error", "Já existe um convênio com esse nome.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name,
        registration_code: values.registration_code.trim() || null,
        payment_term_days: paymentTermDays,
        active: values.active,
      };

      if (editingInsurer) {
        const { error } = await supabase
          .from("insurers")
          .update(payload)
          .eq("id", editingInsurer.id)
          .select("id")
          .single();
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("insurers")
          .insert({
            ...payload,
            organization_id: data.membership.organization_id,
          })
          .select("id")
          .single();
        if (error) throw error;
      }

      await onReload();
      setDialogOpen(false);
      setEditingInsurer(null);
      notify(
        "success",
        editingInsurer
          ? "Convênio atualizado com sucesso."
          : "Convênio cadastrado com sucesso.",
      );
    } catch (error) {
      const code =
        typeof error === "object" && error && "code" in error
          ? String(error.code)
          : "";
      notify(
        "error",
        code === "23505"
          ? "Já existe um convênio com esse nome."
          : error instanceof Error
            ? error.message
            : "Não foi possível salvar o convênio.",
      );
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteInsurer) return;
    if ((invoiceCounts.get(deleteInsurer.id) || 0) > 0) {
      notify(
        "error",
        "Este convênio possui faturamentos vinculados e não pode ser excluído.",
      );
      return;
    }

    setDeleting(true);
    try {
      const { error } = await supabase
        .from("insurers")
        .delete()
        .eq("id", deleteInsurer.id)
        .select("id")
        .single();
      if (error) throw error;

      await onReload();
      setDeleteInsurer(null);
      notify("success", "Convênio excluído com sucesso.");
    } catch (error) {
      const code =
        typeof error === "object" && error && "code" in error
          ? String(error.code)
          : "";
      notify(
        "error",
        code === "23503"
          ? "Este convênio possui faturamentos vinculados e não pode ser excluído."
          : error instanceof Error
            ? error.message
            : "Não foi possível excluir o convênio.",
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <div className="page-heading-row">
        <div>
          <span className="eyebrow">Configuração</span>
          <h1>Convênios</h1>
          <p>Cadastre e mantenha os convênios utilizados nos faturamentos.</p>
        </div>
        {editable ? (
          <button className="primary-button" type="button" onClick={openNew}>
            <Plus size={19} /> Novo convênio
          </button>
        ) : null}
      </div>

      {data.insurers.length ? (
        <section className="directory-grid insurer-grid">
          {data.insurers.map((insurer) => {
            const invoiceCount = invoiceCounts.get(insurer.id) || 0;
            return (
              <article className="directory-card insurer-card" key={insurer.id}>
                <span className="directory-icon">
                  <Landmark size={21} />
                </span>
                <div className="insurer-card-copy">
                  <div className="insurer-title-line">
                    <h2>{insurer.name}</h2>
                    <span
                      className={insurer.active ? "active-label" : "inactive-label"}
                    >
                      {insurer.active ? "Ativo" : "Inativo"}
                    </span>
                  </div>
                  <p>
                    {insurer.registration_code
                      ? `Código ${insurer.registration_code} · `
                      : ""}
                    Prazo de {insurer.payment_term_days} dias
                  </p>
                  <small>
                    {invoiceCount} {invoiceCount === 1 ? "faturamento" : "faturamentos"}
                  </small>
                </div>
                {editable ? (
                  <div className="directory-actions">
                    <button
                      className="icon-button edit"
                      type="button"
                      onClick={() => openEdit(insurer)}
                      aria-label={`Editar convênio ${insurer.name}`}
                      title="Editar convênio"
                    >
                      <Edit3 size={17} />
                    </button>
                    <button
                      className="icon-button danger"
                      type="button"
                      onClick={() => setDeleteInsurer(insurer)}
                      aria-label={`Excluir convênio ${insurer.name}`}
                      title="Excluir convênio"
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                ) : null}
              </article>
            );
          })}
        </section>
      ) : (
        <section className="content-card">
          <div className="empty-state">
            <span>
              <Landmark size={27} />
            </span>
            <h3>Nenhum convênio cadastrado</h3>
            <p>Use “Novo convênio” para começar.</p>
          </div>
        </section>
      )}

      <InsurerDialog
        open={dialogOpen}
        insurer={editingInsurer}
        saving={saving}
        onClose={() => {
          if (!saving) {
            setDialogOpen(false);
            setEditingInsurer(null);
          }
        }}
        onSave={saveInsurer}
      />

      <InsurerDeleteDialog
        insurer={deleteInsurer}
        invoiceCount={deleteInsurer ? invoiceCounts.get(deleteInsurer.id) || 0 : 0}
        deleting={deleting}
        onCancel={() => !deleting && setDeleteInsurer(null)}
        onConfirm={confirmDelete}
      />
    </>
  );
}

function RateioPage({
  data,
  onReload,
  notify,
}: {
  data: AppData;
  onReload: () => Promise<void>;
  notify: (type: "success" | "error", message: string) => void;
}) {
  const initial = currentPeriod();
  const [year, setYear] = useState(initial.year);
  const [month, setMonth] = useState(initial.month);
  const [selectedUnit, setSelectedUnit] = useState<BillingUnit>("HPOLI");
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [deleteInvoice, setDeleteInvoice] = useState<Invoice | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const selectedPeriod = periodKey(year, month);
  const insurerNames = useMemo(
    () => new Map(data.insurers.map((insurer) => [insurer.id, insurer.name])),
    [data.insurers],
  );
  const distributionsByInvoice = useMemo(() => {
    const grouped = new Map<string, Distribution[]>();
    data.distributions.forEach((distribution) => {
      const current = grouped.get(distribution.invoice_id) || [];
      current.push(distribution);
      grouped.set(distribution.invoice_id, current);
    });
    return grouped;
  }, [data.distributions]);
  const partners = useMemo(
    () => [...data.partners].sort((a, b) => a.sort_order - b.sort_order),
    [data.partners],
  );
  const monthInvoices = useMemo(
    () =>
      data.invoices
        .filter(
          (invoice) =>
            invoice.billing_unit === selectedUnit &&
            (invoice.status === "received" || invoice.status === "partial") &&
            invoice.rateio_competence?.slice(0, 7) === selectedPeriod &&
            distributionsByInvoice.has(invoice.id),
        )
        .sort((a, b) => {
          const byInsurer = alphabetic.compare(
            insurerNames.get(a.insurer_id) || "",
            insurerNames.get(b.insurer_id) || "",
          );
          return byInsurer || (b.paid_at || "").localeCompare(a.paid_at || "");
        }),
    [
      data.invoices,
      distributionsByInvoice,
      insurerNames,
      selectedPeriod,
      selectedUnit,
    ],
  );

  const totals = useMemo(() => {
    const received = monthInvoices.reduce(
      (sum, invoice) => sum + Number(invoice.received_amount),
      0,
    );
    const rateioBase = monthInvoices.reduce(
      (sum, invoice) =>
        sum +
        calculateRateioBase(
          invoice.billing_unit,
          Number(invoice.received_amount),
        ),
      0,
    );
    const distributed = monthInvoices.reduce(
      (sum, invoice) =>
        sum +
        (distributionsByInvoice.get(invoice.id) || []).reduce(
          (subtotal, item) => subtotal + Number(item.distributed_amount),
          0,
        ),
      0,
    );
    return {
      received,
      rateioBase,
      deductions: received - rateioBase,
      distributed,
      difference: rateioBase - distributed,
    };
  }, [distributionsByInvoice, monthInvoices]);

  const holTaxTotals = useMemo(
    () =>
      monthInvoices.reduce(
        (totals, invoice) => {
          const calculation = calculateHolRateio(
            Number(invoice.received_amount),
          );
          return {
            iss: totals.iss + calculation.iss,
            irrf: totals.irrf + calculation.irrf,
            depositedAmount:
              totals.depositedAmount + calculation.depositedAmount,
            pis: totals.pis + calculation.pis,
            cofins: totals.cofins + calculation.cofins,
            csll: totals.csll + calculation.csll,
            ir: totals.ir + calculation.ir,
            poligastroTaxTotal:
              totals.poligastroTaxTotal + calculation.poligastroTaxTotal,
          };
        },
        {
          iss: 0,
          irrf: 0,
          depositedAmount: 0,
          pis: 0,
          cofins: 0,
          csll: 0,
          ir: 0,
          poligastroTaxTotal: 0,
        },
      ),
    [monthInvoices],
  );

  const partnerTotals = useMemo(
    () =>
      new Map(
        partners.map((partner) => [
          partner.id,
          monthInvoices.reduce(
            (sum, invoice) =>
              sum +
              Number(
                (distributionsByInvoice.get(invoice.id) || []).find(
                  (item) => item.partner_id === partner.id,
                )?.distributed_amount || 0,
              ),
            0,
          ),
        ]),
      ),
    [distributionsByInvoice, monthInvoices, partners],
  );

  const editable = data.membership.role !== "viewer";

  const downloadPdf = async () => {
    if (!monthInvoices.length) {
      notify("error", "Não há rateios neste mês para gerar o relatório.");
      return;
    }
    setExportingPdf(true);
    try {
      const { downloadRateioReport } = await import("./lib/rateioReport");
      downloadRateioReport({
        organizationName: data.organizationName,
        unit: selectedUnit,
        periodKey: selectedPeriod,
        periodLabel: `${fullMonthNames[month]} de ${year}`,
        invoices: monthInvoices,
        insurers: data.insurers,
        partners,
        distributions: data.distributions,
      });
      notify("success", "Relatório de rateio em PDF gerado com sucesso.");
    } catch (error) {
      notify(
        "error",
        error instanceof Error
          ? error.message
          : "Não foi possível gerar o relatório de rateio.",
      );
    } finally {
      setExportingPdf(false);
    }
  };

  const saveRateio = async (values: RateioEditValues) => {
    if (!editingInvoice) return;
    setSaving(true);
    try {
      const invoiceResult = await supabase
        .from("invoices")
        .update({
          rateio_competence: `${values.rateio_competence}-01`,
        })
        .eq("id", editingInvoice.id);
      if (invoiceResult.error) throw invoiceResult.error;

      const updates = await Promise.all(
        values.items.map((item) =>
          supabase
            .from("distributions")
            .update({
              share_percent: item.share_percent,
              distributed_amount: item.distributed_amount,
              generated_at: new Date().toISOString(),
            })
            .eq("id", item.id),
        ),
      );
      const firstError = updates.map((result) => result.error).find(Boolean);
      if (firstError) throw firstError;

      await onReload();
      setEditingInvoice(null);
      notify("success", "Rateio atualizado com sucesso.");
    } catch (error) {
      notify(
        "error",
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar o rateio.",
      );
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteInvoice) return;
    setDeleting(true);
    try {
      const invoiceResult = await supabase
        .from("invoices")
        .update({ rateio_competence: null })
        .eq("id", deleteInvoice.id);
      if (invoiceResult.error) throw invoiceResult.error;

      await onReload();
      setDeleteInvoice(null);
      notify("success", "Rateio excluído. O faturamento foi preservado.");
    } catch (error) {
      notify(
        "error",
        error instanceof Error
          ? error.message
          : "Não foi possível excluir o rateio.",
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <div className="page-heading-row">
        <div>
          <span className="eyebrow">Rateio por unidade</span>
          <h1>{rateioUnitLabels[selectedUnit]}</h1>
          <p>
            Competência de rateio: {fullMonthNames[month]} de {year}.
          </p>
        </div>
        <button
          className="secondary-button report-button"
          type="button"
          onClick={downloadPdf}
          disabled={exportingPdf || !monthInvoices.length}
        >
          {exportingPdf ? (
            <LoaderCircle className="spin" size={18} />
          ) : (
            <Download size={18} />
          )}
          Baixar relatório PDF
        </button>
      </div>

      <div
        className="rateio-unit-tabs"
        role="tablist"
        aria-label="Selecionar unidade do rateio"
      >
        {rateioUnits.map((unit) => (
          <button
            key={unit}
            type="button"
            role="tab"
            aria-selected={selectedUnit === unit}
            className={selectedUnit === unit ? "active" : ""}
            onClick={() => setSelectedUnit(unit)}
          >
            {rateioUnitLabels[unit]}
          </button>
        ))}
      </div>

      <MonthSelector
        year={year}
        month={month}
        onChange={(nextYear, nextMonth) => {
          setYear(nextYear);
          setMonth(nextMonth);
        }}
      />

      <section className="metrics-grid rateio-metrics">
        <MetricCard
          label={selectedUnit === "HOL" ? "Valor-base HOL" : "Total recebido"}
          value={brl.format(totals.received)}
          note={
            selectedUnit === "HOL"
              ? "Base antes das deduções"
              : "Recebimentos vinculados à competência"
          }
          tone="blue"
          icon={<CircleDollarSign size={24} />}
        />
        <MetricCard
          label={selectedUnit === "HOL" ? "Deduções fiscais" : "Total rateado"}
          value={brl.format(
            selectedUnit === "HOL" ? totals.deductions : totals.distributed,
          )}
          note={
            selectedUnit === "HOL"
              ? "11,93% sobre o valor-base"
              : "Distribuído entre os sócios"
          }
          tone={selectedUnit === "HOL" ? "gold" : "teal"}
          icon={
            selectedUnit === "HOL" ? (
              <WalletCards size={24} />
            ) : (
              <UsersRound size={24} />
            )
          }
        />
        <MetricCard
          label={selectedUnit === "HOL" ? "Valor para ratear" : "Diferença"}
          value={brl.format(
            selectedUnit === "HOL" ? totals.rateioBase : totals.difference,
          )}
          note={
            selectedUnit === "HOL"
              ? "88,07% após os impostos"
              : "Recebido menos rateado"
          }
          tone={selectedUnit === "HOL" ? "teal" : "gold"}
          icon={
            selectedUnit === "HOL" ? (
              <UsersRound size={24} />
            ) : (
              <WalletCards size={24} />
            )
          }
        />
        <MetricCard
          label={selectedUnit === "HOL" ? "Total rateado" : "Rateios"}
          value={
            selectedUnit === "HOL"
              ? brl.format(totals.distributed)
              : String(monthInvoices.length)
          }
          note={
            selectedUnit === "HOL"
              ? `${monthInvoices.length} faturamento(s) no rateio`
              : "Faturamentos no rateio"
          }
          tone="slate"
          icon={<CalendarDays size={24} />}
        />
      </section>

      {selectedUnit === "HOL" && monthInvoices.length ? (
        <section className="hol-tax-card" aria-label="Deduções de impostos HOL">
          <div className="hol-tax-heading">
            <div>
              <span className="eyebrow">Cálculo conforme demonstrativo HOL</span>
              <h2>Deduções de impostos</h2>
            </div>
            <strong>Total: {brl.format(totals.deductions)}</strong>
          </div>
          <div className="hol-tax-groups">
            <div>
              <h3>Descontos retidos</h3>
              <dl>
                <div><dt>ISS 3%</dt><dd>{brl.format(holTaxTotals.iss)}</dd></div>
                <div><dt>IRRF 1,5%</dt><dd>{brl.format(holTaxTotals.irrf)}</dd></div>
                <div className="tax-subtotal"><dt>Valor depositado</dt><dd>{brl.format(holTaxTotals.depositedAmount)}</dd></div>
              </dl>
            </div>
            <div>
              <h3>Impostos pagos pela Poligastro</h3>
              <dl>
                <div><dt>PIS 0,65%</dt><dd>{brl.format(holTaxTotals.pis)}</dd></div>
                <div><dt>COFINS 3%</dt><dd>{brl.format(holTaxTotals.cofins)}</dd></div>
                <div><dt>CSLL 1%</dt><dd>{brl.format(holTaxTotals.csll)}</dd></div>
                <div><dt>IR 2,78%</dt><dd>{brl.format(holTaxTotals.ir)}</dd></div>
                <div className="tax-subtotal"><dt>Total</dt><dd>{brl.format(holTaxTotals.poligastroTaxTotal)}</dd></div>
              </dl>
            </div>
          </div>
          <div className="hol-rateio-result">
            <span>Valor para ratear após todas as deduções</span>
            <strong>{brl.format(totals.rateioBase)}</strong>
          </div>
        </section>
      ) : null}

      {partners.length ? (
        <section className="rateio-partner-grid" aria-label="Totais por sócio">
          {partners.map((partner) => (
            <article className="rateio-partner-card" key={partner.id}>
              <span className="avatar-circle">
                <UserRound size={20} />
              </span>
              <div>
                <span>{partner.name}</span>
                <small>{Number(partner.share_percent).toFixed(2)}% padrão</small>
              </div>
              <strong>{brl.format(partnerTotals.get(partner.id) || 0)}</strong>
            </article>
          ))}
        </section>
      ) : null}

      <section className="content-card rateio-card">
        <div className="card-heading">
          <div>
            <h2>{rateioUnitLabels[selectedUnit]} do mês</h2>
            <p>Organizados pela competência escolhida no faturamento.</p>
          </div>
        </div>
        {monthInvoices.length ? (
          <div className="table-wrap rateio-table-wrap">
            <table
              className={`rateio-table${
                selectedUnit === "HOL" ? " hol-rateio-table" : ""
              }`}
            >
              <thead>
                <tr>
                  <th>Competência do rateio</th>
                  <th>Data da baixa</th>
                  <th>Convênio</th>
                  <th>Unidade</th>
                  <th>Competência do faturamento</th>
                  <th>{selectedUnit === "HOL" ? "Valor-base" : "Valor recebido"}</th>
                  {selectedUnit === "HOL" ? (
                    <>
                      <th>Deduções 11,93%</th>
                      <th>Valor para ratear</th>
                    </>
                  ) : null}
                  {partners.map((partner) => (
                    <th className="partner-column" key={partner.id}>
                      {partner.name}
                    </th>
                  ))}
                  <th>Total rateado</th>
                  {editable ? <th className="actions-column">Ações</th> : null}
                </tr>
              </thead>
              <tbody>
                {monthInvoices.map((invoice) => {
                  const items = distributionsByInvoice.get(invoice.id) || [];
                  const holCalculation = calculateHolRateio(
                    Number(invoice.received_amount),
                  );
                  const rowTotal = items.reduce(
                    (sum, item) => sum + Number(item.distributed_amount),
                    0,
                  );
                  const insurerName =
                    insurerNames.get(invoice.insurer_id) || "Convênio";
                  return (
                    <tr key={invoice.id}>
                      <td data-label="Competência do rateio">
                        {formatCompetenceMonth(invoice.rateio_competence)}
                      </td>
                      <td data-label="Data da baixa">
                        {formatReceiptDate(invoice.paid_at)}
                      </td>
                      <td data-label="Convênio">
                        <strong>{insurerName}</strong>
                      </td>
                      <td data-label="Unidade">{invoice.billing_unit}</td>
                      <td data-label="Competência do faturamento">
                        {formatCompetenceMonth(invoice.competence)}
                      </td>
                      <td data-label={selectedUnit === "HOL" ? "Valor-base" : "Valor recebido"}>
                        {brl.format(Number(invoice.received_amount))}
                      </td>
                      {selectedUnit === "HOL" ? (
                        <>
                          <td data-label="Deduções 11,93%">
                            {brl.format(holCalculation.totalDeductions)}
                          </td>
                          <td data-label="Valor para ratear">
                            <strong>{brl.format(holCalculation.rateioBase)}</strong>
                          </td>
                        </>
                      ) : null}
                      {partners.map((partner) => {
                        const distribution = items.find(
                          (item) => item.partner_id === partner.id,
                        );
                        return (
                          <td
                            className="partner-value"
                            data-label={partner.name}
                            key={partner.id}
                          >
                            {distribution
                              ? brl.format(Number(distribution.distributed_amount))
                              : "—"}
                          </td>
                        );
                      })}
                      <td data-label="Total rateado">
                        <strong>{brl.format(rowTotal)}</strong>
                      </td>
                      {editable ? (
                        <td className="row-actions" data-label="Ações">
                          <button
                            className="icon-button edit"
                            type="button"
                            onClick={() => setEditingInvoice(invoice)}
                            aria-label={`Editar rateio de ${insurerName}`}
                            title="Editar rateio"
                          >
                            <Edit3 size={17} />
                          </button>
                          <button
                            className="icon-button danger"
                            type="button"
                            onClick={() => setDeleteInvoice(invoice)}
                            aria-label={`Excluir rateio de ${insurerName}`}
                            title="Excluir rateio"
                          >
                            <Trash2 size={17} />
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={5}>TOTAL DO MÊS</td>
                  <td>{brl.format(totals.received)}</td>
                  {selectedUnit === "HOL" ? (
                    <>
                      <td>{brl.format(totals.deductions)}</td>
                      <td>{brl.format(totals.rateioBase)}</td>
                    </>
                  ) : null}
                  {partners.map((partner) => (
                    <td key={partner.id}>
                      {brl.format(partnerTotals.get(partner.id) || 0)}
                    </td>
                  ))}
                  <td>{brl.format(totals.distributed)}</td>
                  {editable ? <td /> : null}
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <span>
              <UsersRound size={27} />
            </span>
            <h3>Nenhum rateio neste mês</h3>
            <p>
              Escolha a competência na coluna “Rateio feito na prod.” do
              Faturamento {selectedUnit}. Após o recebimento, o rateio aparecerá
              automaticamente neste mês.
            </p>
          </div>
        )}
      </section>

      <RateioDialog
        invoice={editingInvoice}
        insurerName={
          editingInvoice
            ? insurerNames.get(editingInvoice.insurer_id) || "Convênio"
            : ""
        }
        distributions={
          editingInvoice ? distributionsByInvoice.get(editingInvoice.id) || [] : []
        }
        partners={partners}
        saving={saving}
        onClose={() => !saving && setEditingInvoice(null)}
        onSave={saveRateio}
      />

      {deleteInvoice ? (
        <div
          className="dialog-backdrop"
          role="presentation"
          onMouseDown={() => !deleting && setDeleteInvoice(null)}
        >
          <section
            className="dialog-panel confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-rateio-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <span className="danger-icon">
              <Trash2 size={23} />
            </span>
            <h2 id="delete-rateio-title">Excluir este rateio?</h2>
            <p>
              O rateio será removido da competência selecionada, mas o faturamento
              e o recebimento continuarão cadastrados.
            </p>
            <div className="dialog-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => setDeleteInvoice(null)}
                disabled={deleting}
              >
                Cancelar
              </button>
              <button
                className="danger-button"
                type="button"
                onClick={confirmDelete}
                disabled={deleting}
              >
                {deleting ? <LoaderCircle className="spin" size={18} /> : null}
                Excluir rateio
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

function Dashboard({ session }: { session: Session }) {
  const [page, setPage] = useState<Page>("overview");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<AppData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const notify = useCallback(
    (type: "success" | "error", message: string) => setToast({ type, message }),
    [],
  );

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const loadData = useCallback(async () => {
    setLoadError(null);
    const { data: membership, error: membershipError } = await supabase
      .from("memberships")
      .select("organization_id,user_id,role")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (membershipError) throw membershipError;
    if (!membership) {
      throw new Error("Seu usuário ainda não está vinculado à organização HPOLI.");
    }

    const [
      organizationResult,
      profileResult,
      insurersResult,
      invoicesResult,
      partnersResult,
      distributionsResult,
    ] = await Promise.all([
        supabase
          .from("organizations")
          .select("name")
          .eq("id", membership.organization_id)
          .single(),
        supabase
          .from("profiles")
          .select("full_name")
          .eq("id", session.user.id)
          .maybeSingle(),
        supabase
          .from("insurers")
          .select("*")
          .eq("organization_id", membership.organization_id)
          .order("name"),
        supabase
          .from("invoices")
          .select("*")
          .eq("organization_id", membership.organization_id)
          .order("competence", { ascending: false }),
        supabase
          .from("partners")
          .select("*")
          .eq("organization_id", membership.organization_id)
          .order("sort_order"),
        supabase
          .from("distributions")
          .select("*")
          .eq("organization_id", membership.organization_id)
          .order("generated_at", { ascending: false }),
      ]);

    const firstError = [
      organizationResult.error,
      profileResult.error,
      insurersResult.error,
      invoicesResult.error,
      partnersResult.error,
      distributionsResult.error,
    ].find(Boolean);
    if (firstError) throw firstError;

    setData({
      membership: membership as Membership,
      organizationName: organizationResult.data?.name || "HPOLI Centro Médico",
      fullName:
        profileResult.data?.full_name ||
        session.user.email?.split("@")[0] ||
        "Usuário",
      insurers: (insurersResult.data || []) as Insurer[],
      invoices: (invoicesResult.data || []) as Invoice[],
      partners: (partnersResult.data || []) as Partner[],
      distributions: (distributionsResult.data || []) as Distribution[],
    });
  }, [session.user.email, session.user.id]);

  useEffect(() => {
    loadData()
      .catch((error) =>
        setLoadError(
          error instanceof Error ? error.message : "Não foi possível carregar os dados.",
        ),
      )
      .finally(() => setLoading(false));
  }, [loadData]);

  const reload = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadData();
    } finally {
      setRefreshing(false);
    }
  }, [loadData]);

  const navigate = (nextPage: Page) => {
    setPage(nextPage);
    setMobileMenuOpen(false);
  };

  const navItems: Array<{
    id: Page;
    label: string;
    icon: React.ReactNode;
  }> = [
    { id: "overview", label: "Visão geral", icon: <BarChart3 size={19} /> },
    { id: "HPOLI", label: "Faturamento HPOLI", icon: <FileText size={19} /> },
    { id: "DIA", label: "Faturamento DIA", icon: <FileText size={19} /> },
    { id: "HOL", label: "Faturamento HOL", icon: <FileText size={19} /> },
    { id: "insurers", label: "Convênios", icon: <Building2 size={19} /> },
    { id: "partners", label: "Rateio", icon: <UsersRound size={19} /> },
  ];

  if (loading) return <SplashScreen />;

  return (
    <div className="app-shell">
      <button
        type="button"
        className={`mobile-overlay ${mobileMenuOpen ? "visible" : ""}`}
        onClick={() => setMobileMenuOpen(false)}
        aria-label="Fechar menu"
      />
      <aside className={`sidebar ${mobileMenuOpen ? "open" : ""}`}>
        <div className="sidebar-brand">
          <div className="brand-lockup brand-lockup-light">
            <span className="brand-symbol" aria-hidden="true">
              H
            </span>
            <span>
              <strong>HPOLI</strong>
              <small>Centro Médico</small>
            </span>
          </div>
          <button
            className="mobile-close"
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Fechar menu"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="sidebar-nav" aria-label="Menu principal">
          <span className="nav-section-label">Gestão</span>
          {navItems.slice(0, 4).map((item) => (
            <button
              type="button"
              key={item.id}
              className={page === item.id ? "active" : ""}
              onClick={() => navigate(item.id)}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
          <span className="nav-section-label nav-second">Configurações</span>
          {navItems.slice(4).map((item) => (
            <button
              type="button"
              key={item.id}
              className={page === item.id ? "active" : ""}
              onClick={() => navigate(item.id)}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-user">
          <span className="user-avatar">
            {data?.fullName.slice(0, 1).toUpperCase() || "U"}
          </span>
          <span className="user-copy">
            <strong>{data?.fullName || "Usuário"}</strong>
            <small>{session.user.email}</small>
          </span>
          <button
            className="logout-button"
            type="button"
            onClick={() => supabase.auth.signOut()}
            aria-label="Sair"
            title="Sair"
          >
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      <div className="main-column">
        <header className="topbar">
          <button
            className="menu-button"
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Abrir menu"
          >
            <Menu size={22} />
          </button>
          <div>
            <strong>{data?.organizationName || "HPOLI Centro Médico"}</strong>
            <small>Sistema de faturamento</small>
          </div>
          <button
            className="refresh-button"
            type="button"
            onClick={() => reload().catch(() => notify("error", "Não foi possível atualizar."))}
            disabled={refreshing}
          >
            <RefreshCw className={refreshing ? "spin" : ""} size={17} />
            <span>Atualizar</span>
          </button>
        </header>

        <main className="workspace">
          {loadError || !data ? (
            <section className="load-error">
              <span>
                <RefreshCw size={25} />
              </span>
              <h1>Não foi possível carregar o painel</h1>
              <p>{loadError || "Tente novamente em alguns instantes."}</p>
              <button className="primary-button" type="button" onClick={reload}>
                Tentar novamente
              </button>
            </section>
          ) : page === "overview" ? (
            <OverviewPage data={data} />
          ) : page === "insurers" ? (
            <InsurersPage data={data} onReload={loadData} notify={notify} />
          ) : page === "partners" ? (
            <RateioPage data={data} onReload={loadData} notify={notify} />
          ) : (
            <BillingPage
              key={page}
              unit={page}
              data={data}
              user={session.user}
              onReload={loadData}
              notify={notify}
            />
          )}
        </main>
      </div>

      {toast ? (
        <div className={`toast toast-${toast.type}`} role="status">
          <span>{toast.message}</span>
          <button type="button" onClick={() => setToast(null)} aria-label="Fechar">
            <X size={17} />
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [recoveryMode, setRecoveryMode] = useState(
    () =>
      window.location.search.includes("recovery=1") ||
      window.location.hash.includes("type=recovery"),
  );

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => setSession(data.session))
      .finally(() => setLoading(false));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === "PASSWORD_RECOVERY") setRecoveryMode(true);
      setSession(nextSession);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) return <SplashScreen />;
  if (recoveryMode) {
    return (
      <AuthView
        recoveryMode
        onRecoveryComplete={() => setRecoveryMode(false)}
      />
    );
  }
  if (!session) return <AuthView />;
  return <Dashboard session={session} />;
}
