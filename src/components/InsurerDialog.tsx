import { type FormEvent, useEffect, useState } from "react";
import { Landmark, LoaderCircle, Trash2, X } from "lucide-react";
import type { Insurer, InsurerFormValues } from "../types";

type InsurerDialogProps = {
  open: boolean;
  insurer: Insurer | null;
  saving: boolean;
  onClose: () => void;
  onSave: (values: InsurerFormValues) => Promise<void>;
};

type InsurerDeleteDialogProps = {
  insurer: Insurer | null;
  invoiceCount: number;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
};

const blankForm = (): InsurerFormValues => ({
  name: "",
  registration_code: "",
  payment_term_days: "30",
  active: true,
});

const fromInsurer = (insurer: Insurer): InsurerFormValues => ({
  name: insurer.name,
  registration_code: insurer.registration_code || "",
  payment_term_days: String(insurer.payment_term_days),
  active: insurer.active,
});

export function InsurerDialog({
  open,
  insurer,
  saving,
  onClose,
  onSave,
}: InsurerDialogProps) {
  const [values, setValues] = useState<InsurerFormValues>(blankForm);

  useEffect(() => {
    if (!open) return;
    setValues(insurer ? fromInsurer(insurer) : blankForm());
  }, [insurer, open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open, saving]);

  if (!open) return null;

  const update = <K extends keyof InsurerFormValues>(
    field: K,
    value: InsurerFormValues[K],
  ) => setValues((current) => ({ ...current, [field]: value }));

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onSave(values);
  };

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="dialog-panel insurer-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="insurer-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="dialog-header">
          <div>
            <span className="eyebrow">Configuração de convênios</span>
            <h2 id="insurer-dialog-title">
              {insurer ? "Editar convênio" : "Novo convênio"}
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

        <form className="insurer-form" onSubmit={submit}>
          <div className="form-grid">
            <label className="field field-span-2">
              <span>Nome do convênio</span>
              <input
                value={values.name}
                onChange={(event) => update("name", event.target.value)}
                placeholder="Ex.: Bradesco Saúde"
                maxLength={120}
                required
                autoFocus
              />
            </label>

            <label className="field">
              <span>Código de registro</span>
              <input
                value={values.registration_code}
                onChange={(event) =>
                  update("registration_code", event.target.value)
                }
                placeholder="Opcional"
                maxLength={60}
              />
            </label>

            <label className="field">
              <span>Prazo de pagamento (dias)</span>
              <input
                type="number"
                inputMode="numeric"
                min="0"
                max="3650"
                step="1"
                value={values.payment_term_days}
                onChange={(event) =>
                  update("payment_term_days", event.target.value)
                }
                required
              />
            </label>

            <label className="field field-span-2">
              <span>Status</span>
              <select
                value={values.active ? "active" : "inactive"}
                onChange={(event) =>
                  update("active", event.target.value === "active")
                }
              >
                <option value="active">Ativo</option>
                <option value="inactive">Inativo</option>
              </select>
            </label>
          </div>

          <aside className="form-note">
            <Landmark size={19} aria-hidden="true" />
            <span>
              Convênios inativos permanecem no histórico, mas deixam de aparecer
              em novos faturamentos.
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
              {insurer ? "Salvar alterações" : "Cadastrar convênio"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

export function InsurerDeleteDialog({
  insurer,
  invoiceCount,
  deleting,
  onCancel,
  onConfirm,
}: InsurerDeleteDialogProps) {
  if (!insurer) return null;
  const isLinked = invoiceCount > 0;

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onCancel}>
      <section
        className="dialog-panel confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="insurer-delete-title"
        aria-describedby="insurer-delete-description"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <span className="danger-icon">
          <Trash2 size={23} />
        </span>
        <h2 id="insurer-delete-title">
          {isLinked ? "Convênio em uso" : "Excluir convênio?"}
        </h2>
        <p id="insurer-delete-description">
          {isLinked
            ? `${insurer.name} possui ${invoiceCount} ${
                invoiceCount === 1
                  ? "faturamento vinculado"
                  : "faturamentos vinculados"
              }. Para preservar o histórico, edite o convênio e altere o status para inativo.`
            : `${insurer.name} será excluído permanentemente. Esta ação não pode ser desfeita.`}
        </p>
        <div className="dialog-actions">
          <button
            className="secondary-button"
            type="button"
            onClick={onCancel}
            disabled={deleting}
          >
            {isLinked ? "Entendi" : "Cancelar"}
          </button>
          {!isLinked ? (
            <button
              className="danger-button"
              type="button"
              onClick={onConfirm}
              disabled={deleting}
            >
              {deleting ? <LoaderCircle className="spin" size={18} /> : null}
              Excluir convênio
            </button>
          ) : null}
        </div>
      </section>
    </div>
  );
}
