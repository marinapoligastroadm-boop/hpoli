import type { BillingUnit } from "../types";

export const DEFAULT_TAX_RATE = 9.15;
export const HOL_BILLING_TAX_RATE = 4.5;

const normalizeInsurerName = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleUpperCase("pt-BR");

export const isTaxExemptInsurer = (name: string) =>
  normalizeInsurerName(name) === "TX ALUGUEL DE SALA";

export const taxRateForBilling = (unit: BillingUnit, insurerName: string) => {
  if (isTaxExemptInsurer(insurerName)) return 0;
  return unit === "HOL" ? HOL_BILLING_TAX_RATE : DEFAULT_TAX_RATE;
};

export const calculateTaxFromPaidAmount = (
  paidAmount: number,
  taxRate: number,
) => paidAmount * (taxRate / 100);

export const calculateNetPaidAmount = (
  paidAmount: number,
  taxRate: number,
) =>
  Math.max(
    0,
    paidAmount - calculateTaxFromPaidAmount(paidAmount, taxRate),
  );
