export type BillingUnit = "HPOLI" | "DIA" | "HOL";

export type InvoiceStatus =
  | "draft"
  | "submitted"
  | "pending"
  | "partial"
  | "received"
  | "cancelled";

export type Insurer = {
  id: string;
  organization_id: string;
  name: string;
  registration_code: string | null;
  payment_term_days: number;
  active: boolean;
};

export type Invoice = {
  id: string;
  organization_id: string;
  insurer_id: string;
  invoice_number: string;
  competence: string;
  issue_date: string;
  due_date: string;
  gross_amount: number;
  tax_rate: number;
  glosa_amount: number;
  received_amount: number;
  status: InvoiceStatus;
  paid_at: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  tax_amount: number;
  net_expected: number;
  outstanding_amount: number;
  billing_unit: BillingUnit;
  production_split_done: boolean;
};

export type Partner = {
  id: string;
  organization_id: string;
  name: string;
  share_percent: number;
  active: boolean;
  sort_order: number;
};

export type Membership = {
  organization_id: string;
  user_id: string;
  role: "admin" | "manager" | "operator" | "viewer";
};

export type InvoiceFormValues = {
  insurer_id: string;
  gross_amount: string;
  glosa_amount: string;
  received_amount: string;
  status: InvoiceStatus;
  production_split_done: boolean;
  notes: string;
};
