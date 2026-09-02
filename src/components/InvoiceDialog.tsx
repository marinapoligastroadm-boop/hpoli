import { FormEvent, useEffect, useMemo, useState } from "react";
import { Calculator, LoaderCircle, X } from "lucide-react";
import type {
  BillingUnit,
  Insurer,
  Invoice,
  InvoiceFormValues,
  InvoiceStatus,
} from "../types";

type InvoiceDialogProps = {
  open: boolean;
  unit: BillingUnit;
  invoice: Invoice | null;
  insurers: Insurer[];
  saving: boolean;
  onClose: () => void;
  onSave: (values: InvoiceFormValues) => Promise<void>;
};

const today = () => new Date().toISOString().slice(0, 10);
const thisMonth = () => `${today().slice(0, 7)}-01`;

const addDays = (date: string, days: number) => {
  const parsed = new Date(`${date}T12:00:00`);
  parsed.setDate(parsed.getDate() + days);
  return parsed.toISOString().slice(0, 10);
};

const blankForm = (): InvoiceFormValues => ({
  invoice_number: "",
  insurer_id: "",
  competence: thisMonth(),
  issue_date: today(),
  due_date: today(),
  gross_amount: "",
  tax_rate: "0",
  glosa_amount: "0",
  received_amount: "0",
  status: "pending",
  paid_at: "",
  notes: "",
});

const fromInvoice = (invoice: Invoice): InvoiceFormValues => ({
  invoice_number: invoice.invoice_number,
  insurer_id: invoice.insurer_id,
  competence: invoice.competence,
  issue_date: invoice.issue_date,
  due_date: invoice.due_date,
  gross_amount: String(invoice.gross_amount),
  tax_rate: String(invoice.tax_rate),
  glosa_amount: String(invoice.glosa_amount),
  received_amount: String(invoice.received_amount),
  status: invoice.status,
  paid_at: invoice.paid_at || "",
  notes: invoice.notes || "",
});

const parseMoney = (value: string) => Number(value.replace(",", ".")) || 0;
const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const statusOptions: Array<{ value: InvoiceStatus; label: string }> = [
  { value: "draft", label: "Rascunho" },
  { value: "submitted", label: "Enviado" },
  { value: "pending", label: "Pendente" },
  { value: "partial", label: "Recebido parcialmente" },
  { value: "received", label: "Recebido" },
  { value: "cancelled", label: "Cancelado" },
];

export function InvoiceDialog({
  open,
  unit,
  invoice,
  insurers,
  saving,
  onClose,
  onSave,
}: InvoiceDialogProps) {
  const [values, setValues] = useState<InvoiceFormValues>(blankForm);

  useEffect(() => {
    if (!open) return;
    setValues(invoice ? fromInvoice(invoice) : blankForm());
  }, [invoice, open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open, saving]);

  const totals = useMemo(() => {
    const gross = parseMoney(values.gross_amount);
    const tax = (gross * parseMoney(values.tax_rate)) / 100;
    const net = Math.max(0, gross - tax - parseMoney(values.glosa_amount));
    const outstanding = Math.max(0, net - parseMoney(values.received_amount));
    return { tax, net, outstanding };
  }, [values.glosa_amount, values.gross_amount, values.received_amount, values.tax_rate]);

  if (!open) return null;

  const update = <K extends keyof InvoiceFormValues>(
    field: K,
    value: InvoiceFormValues[K],
  ) => setValues((current) => ({ ...current, [field]: value }));

  const handleInsurerChange = (insurerId: string) => {
    const insurer = insurers.find((item) => item.id === insurerId);
    setValues((current) => ({
      ...current,
      insurer_id: insurerId,
      due_date: insurer
        ? addDays(current.issue_date, insurer.payment_term_days)
        : current.due_date,
    }));
  };

  const handleIssueDateChange = (issueDate: string) => {
    const insurer = insurers.find((item) => item.id === values.insurer_id);
    setValues((current) => ({
      ...current,
      issue_date: issueDate,
      due_date: insurer
        ? addDays(issueDate, insurer.payment_term_days)
        : current.due_date,
    }));
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onSave(values);
  };

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="dialog-panel invoice-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="invoice-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="dialog-header">
          <div>
            <span className="eyebrow">Faturamento {unit}</span>
            <h2 id="invoice-dialog-title">
              {invoice ? "Editar faturamento" : "Novo faturamento"}
            </h2>
          </div>
          <button
            className="icon-button"
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            disabled={saving}
          >
            <X size={20} />
          </button>
        </header>

        <form className="invoice-form" onSubmit={submit}>
          <div className="form-grid">
            <label className="field">
              <span>Número da fatura / NF</span>
              <input
                value={values.invoice_number}
                onChange={(event) => update("invoice_number", event.target.value)}
                placeholder="Ex.: 00125"
                required
                autoFocus
              />
            </label>

            <label className="field">
              <span>Convênio</span>
              <select
                value={values.insurer_id}
                onChange={(event) => handleInsurerChange(event.target.value)}
                required
              >
                <option value="">Selecione</option>
                {insurers
                  .filter((insurer) => insurer.active)
                  .map((insurer) => (
                    <option key={insurer.id} value={insurer.id}>
                      {insurer.name}
                    </option>
                  ))}
              </select>
            </label>

            <label className="field">
              <span>Competência</span>
              <input
                type="month"
                value={values.competence.slice(0, 7)}
                onChange={(event) =>
                  update("competence", `${event.target.value}-01`)
                }
                required
              />
            </label>

            <label className="field">
              <span>Data de emissão</span>
              <input
                type="date"
                value={values.issue_date}
                onChange={(event) => handleIssueDateChange(event.target.value)}
                required
              />
            </label>

            <label className="field">
              <span>Vencimento</span>
              <input
                type="date"
                value={values.due_date}
                onChange={(event) => update("due_date", event.target.value)}
                required
              />
            </label>

            <label className="field">
              <span>Status</span>
              <select
                value={values.status}
                onChange={(event) =>
                  update("status", event.target.value as InvoiceStatus)
                }
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Valor bruto (R$)</span>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={values.gross_amount}
                onChange={(event) => update("gross_amount", event.target.value)}
                placeholder="0,00"
                required
              />
            </label>

            <label className="field">
              <span>Impostos (%)</span>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                max="100"
                step="0.01"
                value={values.tax_rate}
                onChange={(event) => update("tax_rate", event.target.value)}
              />
            </label>

            <label className="field">
              <span>Glosa (R$)</span>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={values.glosa_amount}
                onChange={(event) => update("glosa_amount", event.target.value)}
              />
            </label>

            <label className="field">
              <span>Valor recebido (R$)</span>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={values.received_amount}
                onChange={(event) =>
                  update("received_amount", event.target.value)
                }
              />
            </label>

            <label className="field">
              <span>Data do recebimento</span>
              <input
                type="date"
                value={values.paid_at}
                onChange={(event) => update("paid_at", event.target.value)}
              />
            </label>

            <label className="field field-span-2">
              <span>Observações</span>
              <textarea
                value={values.notes}
                onChange={(event) => update("notes", event.target.value)}
                placeholder="Informações adicionais"
                rows={3}
              />
            </label>
          </div>

          <aside className="calculation-strip" aria-label="Resumo calculado">
            <Calculator size={20} aria-hidden="true" />
            <span>
              Impostos <strong>{brl.format(totals.tax)}</strong>
            </span>
            <span>
              Líquido esperado <strong>{brl.format(totals.net)}</strong>
            </span>
            <span>
              Em aberto <strong>{brl.format(totals.outstanding)}</strong>
            </span>
          </aside>

          <footer className="dialog-actions">
            <button
              className="secondary-button"
              type="button"
              onClick={onClose}
              disabled={saving}
            >
              Cancelar
            </button>
            <button className="primary-button" disabled={saving}>
              {saving ? <LoaderCircle className="spin" size={18} /> : null}
              {invoice ? "Salvar alterações" : "Cadastrar faturamento"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
