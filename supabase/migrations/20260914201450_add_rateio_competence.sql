alter table public.invoices
  add column if not exists rateio_competence date;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'invoices_rateio_competence_first_day_check'
      and conrelid = 'public.invoices'::regclass
  ) then
    alter table public.invoices
      add constraint invoices_rateio_competence_first_day_check
      check (
        rateio_competence is null
        or extract(day from rateio_competence) = 1
      );
  end if;
end;
$$;

update public.invoices as invoice
set rateio_competence = date_trunc('month', invoice.paid_at)::date
where invoice.rateio_competence is null
  and invoice.paid_at is not null
  and exists (
    select 1
    from public.distributions as distribution
    where distribution.invoice_id = invoice.id
  );

create index if not exists invoices_org_rateio_competence_idx
  on public.invoices (organization_id, rateio_competence)
  where rateio_competence is not null;

create or replace function public.generate_invoice_distribution()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  should_sync boolean := false;
begin
  if new.status in ('received', 'partial')
     and new.received_amount > 0
     and new.rateio_competence is not null then
    if tg_op = 'INSERT' then
      should_sync := true;
    else
      should_sync := old.status is distinct from new.status
        or old.received_amount is distinct from new.received_amount
        or old.rateio_competence is distinct from new.rateio_competence;
    end if;

    if should_sync then
      insert into public.distributions (
        organization_id,
        invoice_id,
        partner_id,
        base_amount,
        share_percent,
        distributed_amount
      )
      select
        new.organization_id,
        new.id,
        partner.id,
        new.received_amount,
        partner.share_percent,
        round(new.received_amount * partner.share_percent / 100.0, 2)
      from public.partners as partner
      where partner.organization_id = new.organization_id
        and partner.active = true
      on conflict (invoice_id, partner_id) do update
      set base_amount = excluded.base_amount,
          share_percent = excluded.share_percent,
          distributed_amount = excluded.distributed_amount,
          generated_at = now();
    end if;

    update public.invoices
    set production_split_done = true
    where id = new.id
      and production_split_done = false;
  else
    delete from public.distributions
    where invoice_id = new.id;

    update public.invoices
    set production_split_done = false
    where id = new.id
      and production_split_done = true;
  end if;

  return new;
end;
$$;

drop trigger if exists invoices_generate_distribution_update on public.invoices;

create trigger invoices_generate_distribution_update
after update of status, received_amount, rateio_competence on public.invoices
for each row execute function public.generate_invoice_distribution();

revoke execute on function public.generate_invoice_distribution()
  from public, anon, authenticated;
