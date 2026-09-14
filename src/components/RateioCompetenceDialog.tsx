import { FormEvent, useEffect, useState } from "react";
import { CalendarDays, LoaderCircle, X } from "lucide-react";
import type { Invoice } from "../types";

type RateioCompetenceDialogProps = {
  invoice: Invoice | null;
  insurerName: string;
  defaultPeriod: string;
  saving: boolean;
  onClose: () => void;
  onSave: (period: string | null) => Promise<void>;
};

const receiptLabel = (invoice: Invoice) =>
  invoice.status === "received"
    ? "Recebido"
    : invoice.status === "partial"
      ? "Recebido parcialmente"
      : "Aguardando recebimento";

export function RateioCompetenceDialog({
  invoice,
  insurerName,
  defaultPeriod,
  saving,
  onClose,
  onSave,
}: RateioCompetenceDialogProps) {
  const [period, setPeriod] = useState(defaultPeriod);

  useEffect(() => {
    if (!invoice) return;
    setPeriod(invoice.rateio_competence?.slice(0, 7) || defaultPeriod);
  }, [defaultPeriod, invoice]);

  useEffect(() => {
    if (!invoice) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [invoice, onClose, saving]);

  if (!invoice) return null;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onSave(period);
  };

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="dialog-panel rateio-competence-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rateio-competence-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="dialog-header">
          <div>
            <span className="eyebrow">Rateio da produção</span>
            <h2 id="rateio-competence-title">Escolher competência</h2>
            <p>{insurerName}</p>
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

        <form onSubmit={submit}>
          <label className="field">
            <span>Mês de competência do rateio</span>
            <input
              type="month"
              value={period}
              onChange={(event) => setPeriod(event.target.value)}
              required
              autoFocus
            />
          </label>

          <div className="rateio-competence-info">
            <CalendarDays size={20} aria-hidden="true" />
            <div>
              <strong>{receiptLabel(invoice)}</strong>
              <span>
                A competência é independente da data de recebimento. O lançamento
                aparecerá na aba Rateio quando houver valor recebido.
              </span>
            </div>
          </div>

          <footer className="dialog-actions rateio-competence-actions">
            {invoice.rateio_competence ? (
              <button
                className="danger-link-button"
                type="button"
                onClick={() => onSave(null)}
                disabled={saving}
              >
                Remover competência
              </button>
            ) : null}
            <span className="dialog-action-spacer" />
            <button
              className="secondary-button"
              type="button"
              onClick={onClose}
              disabled={saving}
            >
              Cancelar
            </button>
            <button className="primary-button" disabled={saving || !period}>
              {saving ? <LoaderCircle className="spin" size={18} /> : null}
              Salvar competência
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
