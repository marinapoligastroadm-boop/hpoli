import { FormEvent, useEffect, useMemo, useState } from "react";
import { CalendarRange, Download, LoaderCircle, X } from "lucide-react";
import type { BillingUnit } from "../types";

export type BillingReportStatus =
  | "all"
  | "pending"
  | "partial"
  | "received";

export type BillingReportFilters = {
  startPeriod: string;
  endPeriod: string;
  status: BillingReportStatus;
};

type BillingReportDialogProps = {
  open: boolean;
  unit: BillingUnit;
  defaultPeriod: string;
  generating: boolean;
  onClose: () => void;
  onGenerate: (filters: BillingReportFilters) => Promise<void>;
};

const periodIndex = (period: string) => {
  const [year, month] = period.split("-").map(Number);
  return year * 12 + month - 1;
};

const periodFromIndex = (index: number) => {
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  return year + "-" + String(month).padStart(2, "0");
};

const addMonths = (period: string, months: number) =>
  periodFromIndex(periodIndex(period) + months);

export function BillingReportDialog({
  open,
  unit,
  defaultPeriod,
  generating,
  onClose,
  onGenerate,
}: BillingReportDialogProps) {
  const [startPeriod, setStartPeriod] = useState(defaultPeriod);
  const [endPeriod, setEndPeriod] = useState(defaultPeriod);
  const [status, setStatus] = useState<BillingReportStatus>("all");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setStartPeriod(defaultPeriod);
    setEndPeriod(defaultPeriod);
    setStatus("all");
    setError("");
  }, [defaultPeriod, open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !generating) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [generating, onClose, open]);

  const rangeMonths = useMemo(() => {
    if (!startPeriod || !endPeriod) return 0;
    return periodIndex(endPeriod) - periodIndex(startPeriod) + 1;
  }, [endPeriod, startPeriod]);

  if (!open) return null;

  const maxEndPeriod = startPeriod ? addMonths(startPeriod, 5) : undefined;

  const updateStartPeriod = (nextStart: string) => {
    setStartPeriod(nextStart);
    setError("");
    if (!nextStart) return;
    const maximumEnd = addMonths(nextStart, 5);
    if (endPeriod < nextStart) setEndPeriod(nextStart);
    if (endPeriod > maximumEnd) setEndPeriod(maximumEnd);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (rangeMonths < 1) {
      setError("O mês final deve ser igual ou posterior ao mês inicial.");
      return;
    }
    if (rangeMonths > 6) {
      setError("Selecione um período máximo de 6 meses.");
      return;
    }
    await onGenerate({ startPeriod, endPeriod, status });
  };

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="dialog-panel billing-report-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="billing-report-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="dialog-header">
          <div>
            <span className="eyebrow">Faturamento {unit}</span>
            <h2 id="billing-report-title">Relatório por status</h2>
          </div>
          <button
            className="icon-button"
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            disabled={generating}
          >
            <X size={20} />
          </button>
        </header>

        <form className="billing-report-form" onSubmit={submit}>
          <div className="report-filter-grid">
            <label className="field field-span-2">
              <span>Status do faturamento</span>
              <select
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value as BillingReportStatus);
                  setError("");
                }}
                autoFocus
              >
                <option value="all">Todos</option>
                <option value="pending">Não recebidos</option>
                <option value="partial">Recebido parcialmente</option>
                <option value="received">Recebido</option>
              </select>
            </label>

            <label className="field">
              <span>Mês inicial</span>
              <input
                type="month"
                value={startPeriod}
                onChange={(event) => updateStartPeriod(event.target.value)}
                required
              />
            </label>

            <label className="field">
              <span>Mês final</span>
              <input
                type="month"
                value={endPeriod}
                min={startPeriod}
                max={maxEndPeriod}
                onChange={(event) => {
                  setEndPeriod(event.target.value);
                  setError("");
                }}
                required
              />
            </label>
          </div>

          <aside className="report-period-note">
            <CalendarRange size={20} aria-hidden="true" />
            <div>
              <strong>
                {rangeMonths === 1
                  ? "1 mês selecionado"
                  : String(rangeMonths) + " meses selecionados"}
              </strong>
              <span>
                O relatório aceita até 6 meses e será separado pela competência
                de faturamento.
              </span>
            </div>
          </aside>

          {error ? (
            <p className="report-filter-error" role="alert">
              {error}
            </p>
          ) : null}

          <footer className="dialog-actions">
            <button
              className="secondary-button"
              type="button"
              onClick={onClose}
              disabled={generating}
            >
              Cancelar
            </button>
            <button
              className="primary-button"
              disabled={generating || rangeMonths < 1 || rangeMonths > 6}
            >
              {generating ? (
                <LoaderCircle className="spin" size={18} />
              ) : (
                <Download size={18} />
              )}
              {generating ? "Gerando PDF..." : "Baixar relatório PDF"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
