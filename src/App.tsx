import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import {
  BarChart3,
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
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
import { InvoiceDialog } from "./components/InvoiceDialog";
import { supabase } from "./lib/supabase";
import type {
  BillingUnit,
  Insurer,
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

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const TAX_RATE = 9.15;

const taxFromPaidAmount = (amount: number) => amount * (TAX_RATE / 100);

const receiptLabel = (status: InvoiceStatus) => {
  if (status === "received") return "Sim";
  if (status === "partial") return "Parcial";
  return "Não";
};

const receiptStatusClass = (status: InvoiceStatus) =>
  status === "received" || status === "partial" ? status : "pending";

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
  onEdit,
  onDelete,
}: {
  invoices: Invoice[];
  insurers: Insurer[];
  editable: boolean;
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
            <th>Imposto 9,15%</th>
            <th>Valor líquido</th>
            <th>Recebido</th>
            <th>Rateio feito na prod.</th>
            {editable ? <th className="actions-column">Ações</th> : null}
          </tr>
        </thead>
        <tbody>
          {invoices.map((invoice) => {
            const insurerName =
              insurerNames.get(invoice.insurer_id) || "Convênio";
            const tax = taxFromPaidAmount(Number(invoice.received_amount));
            const net = Math.max(0, Number(invoice.received_amount) - tax);

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
                <td data-label="Imposto 9,15%">{brl.format(tax)}</td>
                <td data-label="Valor líquido">{brl.format(net)}</td>
                <td data-label="Recebido">
                  <span
                    className={`status-pill status-${receiptStatusClass(invoice.status)}`}
                  >
                    {receiptLabel(invoice.status)}
                  </span>
                </td>
                <td data-label="Rateio feito na produção">
                  <span
                    className={`status-pill status-${
                      invoice.production_split_done ? "received" : "pending"
                    }`}
                  >
                    {invoice.production_split_done ? "Sim" : "Não"}
                  </span>
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
  const [deleteInvoice, setDeleteInvoice] = useState<Invoice | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const selectedPeriod = periodKey(year, month);
  const unitInvoices = useMemo(
    () =>
      data.invoices
        .filter(
          (invoice) =>
            invoice.billing_unit === unit &&
            invoice.competence.slice(0, 7) === selectedPeriod,
        )
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
    [data.invoices, selectedPeriod, unit],
  );

  const filteredInvoices = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    const insurerNames = new Map(
      data.insurers.map((insurer) => [insurer.id, insurer.name]),
    );
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
  }, [data.insurers, search, status, unitInvoices]);

  const totals = useMemo(
    () =>
      unitInvoices.reduce(
        (accumulator, invoice) => ({
          production: accumulator.production + Number(invoice.gross_amount),
          glosa: accumulator.glosa + Number(invoice.glosa_amount),
          paid: accumulator.paid + Number(invoice.received_amount),
          net:
            accumulator.net +
            Math.max(
              0,
              Number(invoice.received_amount) -
                taxFromPaidAmount(Number(invoice.received_amount)),
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
        tax_rate: TAX_RATE,
        glosa_amount: glosa,
        received_amount: received,
        status: values.status,
        paid_at:
          values.status === "received" || values.status === "partial"
            ? editingInvoice?.paid_at || today()
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
        {editable ? (
          <button className="primary-button" type="button" onClick={openNew}>
            <Plus size={19} /> Novo faturamento
          </button>
        ) : null}
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
          note="Após imposto de 9,15%"
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

function InsurersPage({ insurers }: { insurers: Insurer[] }) {
  return (
    <>
      <div className="page-heading-row">
        <div>
          <span className="eyebrow">Cadastros</span>
          <h1>Convênios</h1>
          <p>Condições utilizadas no cálculo dos vencimentos.</p>
        </div>
      </div>
      <section className="directory-grid">
        {insurers.map((insurer) => (
          <article className="directory-card" key={insurer.id}>
            <span className="directory-icon">
              <Landmark size={21} />
            </span>
            <div>
              <h2>{insurer.name}</h2>
              <p>Prazo de pagamento</p>
            </div>
            <strong>{insurer.payment_term_days} dias</strong>
          </article>
        ))}
      </section>
    </>
  );
}

function PartnersPage({ partners }: { partners: Partner[] }) {
  return (
    <>
      <div className="page-heading-row">
        <div>
          <span className="eyebrow">Configuração</span>
          <h1>Sócios e rateio</h1>
          <p>Percentuais aplicados aos faturamentos recebidos.</p>
        </div>
      </div>
      <section className="directory-grid partner-grid">
        {partners.map((partner) => (
          <article className="partner-card" key={partner.id}>
            <span className="avatar-circle">
              <UserRound size={24} />
            </span>
            <h2>{partner.name}</h2>
            <strong>{Number(partner.share_percent).toFixed(2)}%</strong>
            <span className={partner.active ? "active-label" : "inactive-label"}>
              {partner.active ? "Ativo" : "Inativo"}
            </span>
          </article>
        ))}
      </section>
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

    const [organizationResult, profileResult, insurersResult, invoicesResult, partnersResult] =
      await Promise.all([
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
      ]);

    const firstError = [
      organizationResult.error,
      profileResult.error,
      insurersResult.error,
      invoicesResult.error,
      partnersResult.error,
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
    { id: "partners", label: "Sócios e rateio", icon: <UsersRound size={19} /> },
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
            <InsurersPage insurers={data.insurers} />
          ) : page === "partners" ? (
            <PartnersPage partners={data.partners} />
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
