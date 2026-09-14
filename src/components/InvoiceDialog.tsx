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

const blankForm = (): InvoiceFormValues => ({
  insurer_id: "",
  gross_amount: "",
  glosa_amount: "0",
  received_amount: "0",
  status: "pending",
  paid_at: "",
  production_split_done: false,
  notes: "",
});

const fromInvoice = (invoice: Invoice): InvoiceFormValues => ({
  insurer_id: invoice.insurer_id,
  gross_amount: String(invoice.gross_amount),
  glosa_amount: String(invoice.glosa_amount),
  received_amount: String(invoice.received_amount),
  status:
    invoice.status === "received" || invoice.status === "partial"
      ? invoice.status
      : "pending",
  paid_at: invoice.paid_at ? invoice.paid_at.slice(0, 10) : "",
  production_split_done: invoice.production_split_done,
  notes: invoice.notes || "",
});

const parseMoney = (value: string) => Number(value.replace(",", ".")) || 0;
const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const todayInputValue = () => {
  const current = new Date();
  const local = new Date(
    current.getTime() - current.getTimezoneOffset() * 60_000,
  );
  return local.toISOString().slice(0, 10);
};

const statusOptions: Array<{ value: InvoiceStatus; label: string }> = [
  { value: "pending", label: "Não" },
  { value: "partial", label: "Parcial" },
  { value: "received", label: "Sim" },
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
    const paid = parseMoney(values.received_amount);
    const tax = paid * 0.0915;
    return { tax, net: Math.max(0, paid - tax) };
  }, [values.received_amount]);

  if (!open) return null;

  const update = <K extends keyof InvoiceFormValues>(
    field: K,
    value: InvoiceFormValues[K],
  ) => setValues((current) => ({ ...current, [field]: value }));

  const updateStatus = (status: InvoiceStatus) => {
    setValues((current) => ({
      ...current,
      status,
      paid_at:
        status === "received" || status === "partial"
          ? current.paid_at || todayInputValue()
          : "",
    }));
  };

  const updateBillingAmount = (
    field: "gross_amount" | "glosa_amount",
    value: string,
  ) => {
    setValues((current) => {
      const nextValues = { ...current, [field]: value };
      if (invoice) return nextValues;

      const calculatedPaid = Math.max(
        0,
        parseMoney(nextValues.gross_amount) -
          parseMoney(nextValues.glosa_amount),
      );
      return {
        ...nextValues,
        received_amount: (
          Math.round((calculatedPaid + Number.EPSILON) * 100) / 100
        ).toFixed(2),
      };
    });
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
              <span>Convênio</span>
              <select
                value={values.insurer_id}
                onChange={(event) => update("insurer_id", event.target.value)}
                required
                autoFocus
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
              <span>Produção (R$)</span>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={values.gross_amount}
                onChange={(event) =>
                  updateBillingAmount("gross_amount", event.target.value)
                }
                placeholder="0,00"
                required
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
                onChange={(event) =>
                  updateBillingAmount("glosa_amount", event.target.value)
                }
              />
            </label>

            <label className="field">
              <span>Valor pago (R$)</span>
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
              <span>Recebido?</span>
              <select
                value={values.status}
                onChange={(event) =>
                  updateStatus(event.target.value as InvoiceStatus)
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
              <span>Data de recebimento</span>
              <input
                type="date"
                value={values.paid_at}
                onChange={(event) => update("paid_at", event.target.value)}
                disabled={
                  values.status !== "received" && values.status !== "partial"
                }
                required={
                  values.status === "received" || values.status === "partial"
                }
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
              Imposto 9,15% <strong>{brl.format(totals.tax)}</strong>
            </span>
            <span>
              Valor líquido <strong>{brl.format(totals.net)}</strong>
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
