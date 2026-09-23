create or replace function public.enforce_invoice_tax_exemption()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  insurer_name text;
begin
  select upper(
    regexp_replace(btrim(insurer.name), '[[:space:]]+', ' ', 'g')
  )
  into insurer_name
  from public.insurers as insurer
  where insurer.id = new.insurer_id;

  if insurer_name = 'TX ALUGUEL DE SALA' then
    new.tax_rate := 0;
  elsif new.billing_unit = 'HOL' then
    new.tax_rate := 4.5;
  end if;

  return new;
end;
$$;

drop trigger if exists invoices_enforce_tax_exemption on public.invoices;

create trigger invoices_enforce_tax_exemption
before insert or update of insurer_id, tax_rate, billing_unit
on public.invoices
for each row execute function public.enforce_invoice_tax_exemption();

update public.invoices as invoice
set tax_rate = case
      when upper(
        regexp_replace(btrim(insurer.name), '[[:space:]]+', ' ', 'g')
      ) = 'TX ALUGUEL DE SALA' then 0
      else 4.5
    end,
    updated_at = now()
from public.insurers as insurer
where insurer.id = invoice.insurer_id
  and invoice.billing_unit = 'HOL'
  and invoice.tax_rate is distinct from case
    when upper(
      regexp_replace(btrim(insurer.name), '[[:space:]]+', ' ', 'g')
    ) = 'TX ALUGUEL DE SALA' then 0
    else 4.5
  end;

revoke execute on function public.enforce_invoice_tax_exemption()
  from public, anon, authenticated;
