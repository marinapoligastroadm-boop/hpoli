import type { BillingUnit } from "../types";
import { calculateNetPaidAmount } from "./taxCalculations";

export const HOL_TAX_RATES = {
  iss: 0.03,
  irrf: 0.015,
  pis: 0.0065,
  cofins: 0.03,
  csll: 0.01,
  ir: 0.0278,
} as const;

export const HOL_RETAINED_RATE = HOL_TAX_RATES.iss + HOL_TAX_RATES.irrf;
export const HOL_POLIGASTRO_RATE =
  HOL_TAX_RATES.pis +
  HOL_TAX_RATES.cofins +
  HOL_TAX_RATES.csll +
  HOL_TAX_RATES.ir;
export const HOL_TOTAL_DEDUCTION_RATE =
  HOL_RETAINED_RATE + HOL_POLIGASTRO_RATE;

const roundCurrency = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100;

export const calculateHolRateio = (baseAmount: number) => {
  const base = Number(baseAmount) || 0;
  const iss = roundCurrency(base * HOL_TAX_RATES.iss);
  const irrf = roundCurrency(base * HOL_TAX_RATES.irrf);
  const pis = roundCurrency(base * HOL_TAX_RATES.pis);
  const cofins = roundCurrency(base * HOL_TAX_RATES.cofins);
  const csll = roundCurrency(base * HOL_TAX_RATES.csll);
  const ir = roundCurrency(base * HOL_TAX_RATES.ir);
  const retainedTotal = roundCurrency(base * HOL_RETAINED_RATE);
  const depositedAmount = roundCurrency(base * (1 - HOL_RETAINED_RATE));
  const poligastroTaxTotal = roundCurrency(base * HOL_POLIGASTRO_RATE);
  const totalDeductions = roundCurrency(base * HOL_TOTAL_DEDUCTION_RATE);
  const rateioBase = roundCurrency(base * (1 - HOL_TOTAL_DEDUCTION_RATE));

  return {
    base,
    iss,
    irrf,
    pis,
    cofins,
    csll,
    ir,
    retainedTotal,
    depositedAmount,
    poligastroTaxTotal,
    totalDeductions,
    rateioBase,
  };
};

export const calculateRateioBase = (
  unit: BillingUnit,
  receivedAmount: number,
  taxRate: number,
) =>
  unit === "HOL"
    ? calculateHolRateio(receivedAmount).rateioBase
    : roundCurrency(
        calculateNetPaidAmount(
          Number(receivedAmount) || 0,
          Number(taxRate) || 0,
        ),
      );
