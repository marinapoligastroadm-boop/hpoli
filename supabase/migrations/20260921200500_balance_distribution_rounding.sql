create or replace function public.generate_invoice_distribution()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  should_sync boolean := false;
  rateio_base numeric(14, 2);
begin
  rateio_base := case
    when new.billing_unit = 'HOL'
      then round(new.received_amount * 0.8807, 2)
    else new.received_amount
  end;

  if new.status in ('received', 'partial')
     and new.received_amount > 0
     and new.rateio_competence is not null then
    if tg_op = 'INSERT' then
      should_sync := true;
    else
      should_sync := old.status is distinct from new.status
        or old.received_amount is distinct from new.received_amount
        or old.billing_unit is distinct from new.billing_unit
        or old.rateio_competence is null
        or not exists (
          select 1
          from public.distributions as distribution
          where distribution.invoice_id = new.id
        );
    end if;

    if should_sync then
      with active_partners as (
        select
          partner.id,
          partner.share_percent,
          row_number() over (
            order by partner.sort_order, partner.id
          ) as partner_order,
          count(*) over () as partner_count
        from public.partners as partner
        where partner.organization_id = new.organization_id
          and partner.active = true
      ), calculated as (
        select
          active_partner.*,
          round(
            rateio_base * active_partner.share_percent / 100.0,
            2
          ) as rounded_amount
        from active_partners as active_partner
      ), balanced as (
        select
          calculated.*,
          case
            when calculated.partner_order = calculated.partner_count then
              rateio_base - coalesce(
                sum(calculated.rounded_amount) over (
                  order by calculated.partner_order
                  rows between unbounded preceding and 1 preceding
                ),
                0
              )
            else calculated.rounded_amount
          end as distributed_amount
        from calculated
      )
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
        balanced.id,
        rateio_base,
        balanced.share_percent,
        balanced.distributed_amount
      from balanced
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

with hol_distributions as (
  select
    distribution.id,
    distribution.invoice_id,
    round(invoice.received_amount * 0.8807, 2) as rateio_base,
    distribution.share_percent,
    row_number() over (
      partition by distribution.invoice_id
      order by partner.sort_order, partner.id
    ) as partner_order,
    count(*) over (
      partition by distribution.invoice_id
    ) as partner_count
  from public.distributions as distribution
  join public.invoices as invoice
    on invoice.id = distribution.invoice_id
  join public.partners as partner
    on partner.id = distribution.partner_id
  where invoice.billing_unit = 'HOL'
), calculated as (
  select
    hol_distribution.*,
    round(
      hol_distribution.rateio_base
        * hol_distribution.share_percent / 100.0,
      2
    ) as rounded_amount
  from hol_distributions as hol_distribution
), balanced as (
  select
    calculated.*,
    case
      when calculated.partner_order = calculated.partner_count then
        calculated.rateio_base - coalesce(
          sum(calculated.rounded_amount) over (
            partition by calculated.invoice_id
            order by calculated.partner_order
            rows between unbounded preceding and 1 preceding
          ),
          0
        )
      else calculated.rounded_amount
    end as distributed_amount
  from calculated
)
update public.distributions as distribution
set base_amount = balanced.rateio_base,
    distributed_amount = balanced.distributed_amount,
    generated_at = now()
from balanced
where balanced.id = distribution.id;

revoke execute on function public.generate_invoice_distribution()
  from public, anon, authenticated;
