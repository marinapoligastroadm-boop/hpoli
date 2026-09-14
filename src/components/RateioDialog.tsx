import { FormEvent, useEffect, useMemo, useState } from "react";
import { Calculator, LoaderCircle, X } from "lucide-react";
import type { Distribution, Invoice, Partner } from "../types";

export type RateioEditValues = {
  rateio_competence: string;
  items: Array<{
    id: string;
    share_percent: number;
    distributed_amount: number;
  }>;
};

type RateioDialogProps = {
  invoice: Invoice | null;
  insurerName: string;
  distributions: Distribution[];
  partners: Partner[];
  saving: boolean;
  onClose: () => void;
  onSave: (values: RateioEditValues) => Promise<void>;
};

type EditRow = {
  id: string;
  partner_id: string;
  share_percent: string;
  distributed_amount: string;
};

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const parseNumber = (value: string) => Number(value.replace(",", ".")) || 0;

export function RateioDialog({
  invoice,
  insurerName,
  distributions,
  partners,
  saving,
  onClose,
  onSave,
}: RateioDialogProps) {
  const [rateioCompetence, setRateioCompetence] = useState("");
  const [rows, setRows] = useState<EditRow[]>([]);

  useEffect(() => {
    if (!invoice) return;
    const order = new Map(partners.map((partner, index) => [partner.id, index]));
    setRateioCompetence(invoice.rateio_competence?.slice(0, 7) || "");
    setRows(
      [...distributions]
        .sort(
          (a, b) =>
            (order.get(a.partner_id) ?? Number.MAX_SAFE_INTEGER) -
            (order.get(b.partner_id) ?? Number.MAX_SAFE_INTEGER),
        )
        .map((distribution) => ({
          id: distribution.id,
          partner_id: distribution.partner_id,
          share_percent: String(distribution.share_percent),
          distributed_amount: Number(distribution.distributed_amount).toFixed(2),
        })),
    );
  }, [distributions, invoice, partners]);

  const partnerNames = useMemo(
    () => new Map(partners.map((partner) => [partner.id, partner.name])),
    [partners],
  );
  const total = useMemo(
    () =>
      rows.reduce(
        (sum, row) => sum + parseNumber(row.distributed_amount),
        0,
      ),
    [rows],
  );

  if (!invoice) return null;

  const updatePercent = (id: string, value: string) => {
    const base = Number(invoice.received_amount);
    setRows((current) =>
      current.map((row) =>
        row.id === id
          ? {
              ...row,
              share_percent: value,
              distributed_amount: (
                Math.round(
                  (base * (parseNumber(value) / 100) + Number.EPSILON) * 100,
                ) / 100
              ).toFixed(2),
            }
          : row,
      ),
    );
  };

  const updateAmount = (id: string, value: string) => {
    setRows((current) =>
      current.map((row) =>
        row.id === id ? { ...row, distributed_amount: value } : row,
      ),
    );
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onSave({
      rateio_competence: rateioCompetence,
      items: rows.map((row) => ({
        id: row.id,
        share_percent: parseNumber(row.share_percent),
        distributed_amount: parseNumber(row.distributed_amount),
      })),
    });
  };

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="dialog-panel rateio-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rateio-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="dialog-header">
          <div>
            <span className="eyebrow">Ajuste manual</span>
            <h2 id="rateio-dialog-title">Editar rateio</h2>
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
          <div className="form-grid">
            <label className="field">
              <span>Competência do rateio</span>
              <input
                type="month"
                value={rateioCompetence}
                onChange={(event) => setRateioCompetence(event.target.value)}
                required
              />
            </label>
          </div>

          <div className="rateio-dialog-summary">
            <span>Valor recebido do faturamento</span>
            <strong>{brl.format(Number(invoice.received_amount))}</strong>
          </div>

          <div className="table-wrap">
            <table className="rateio-edit-table">
              <thead>
                <tr>
                  <th>Sócio</th>
                  <th>Percentual</th>
                  <th>Valor rateado</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <strong>
                        {partnerNames.get(row.partner_id) || "Sócio"}
                      </strong>
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.0001"
                        value={row.share_percent}
                        onChange={(event) =>
                          updatePercent(row.id, event.target.value)
                        }
                        aria-label="Percentual do sócio"
                        required
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={row.distributed_amount}
                        onChange={(event) =>
                          updateAmount(row.id, event.target.value)
                        }
                        aria-label="Valor rateado para o sócio"
                        required
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rateio-edit-total">
            <Calculator size={19} />
            <span>Total rateado</span>
            <strong>{brl.format(total)}</strong>
          </div>

          <footer className="dialog-actions">
            <button
              className="secondary-button"
              type="button"
              onClick={onClose}
              disabled={saving}
            >
              Cancelar
            </button>
            <button className="primary-button" disabled={saving || !rows.length}>
              {saving ? <LoaderCircle className="spin" size={18} /> : null}
              Salvar alterações
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
