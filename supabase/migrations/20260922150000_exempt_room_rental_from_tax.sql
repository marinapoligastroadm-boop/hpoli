create or replace function public.enforce_invoice_tax_exemption()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.insurers as insurer
    where insurer.id = new.insurer_id
      and upper(
        regexp_replace(btrim(insurer.name), '[[:space:]]+', ' ', 'g')
      ) = 'TX ALUGUEL DE SALA'
  ) then
    new.tax_rate := 0;
  end if;

  return new;
end;
$$;

drop trigger if exists invoices_enforce_tax_exemption on public.invoices;

create trigger invoices_enforce_tax_exemption
before insert or update of insurer_id, tax_rate
on public.invoices
for each row execute function public.enforce_invoice_tax_exemption();

update public.invoices as invoice
set tax_rate = 0,
    updated_at = now()
from public.insurers as insurer
where insurer.id = invoice.insurer_id
  and upper(
    regexp_replace(btrim(insurer.name), '[[:space:]]+', ' ', 'g')
  ) = 'TX ALUGUEL DE SALA'
  and invoice.tax_rate is distinct from 0;

revoke execute on function public.enforce_invoice_tax_exemption()
  from public, anon, authenticated;
