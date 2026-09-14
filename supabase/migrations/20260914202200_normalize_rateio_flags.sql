update public.invoices as invoice
set production_split_done = exists (
  select 1
  from public.distributions as distribution
  where distribution.invoice_id = invoice.id
)
where invoice.production_split_done is distinct from exists (
  select 1
  from public.distributions as distribution
  where distribution.invoice_id = invoice.id
);
