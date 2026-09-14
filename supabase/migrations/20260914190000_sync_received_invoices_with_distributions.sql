create or replace function public.generate_invoice_distribution()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status in ('received', 'partial') and new.received_amount > 0 then
    if tg_op = 'INSERT'
       or old.status is distinct from new.status
       or old.received_amount is distinct from new.received_amount then
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
        p.id,
        new.received_amount,
        p.share_percent,
        round(new.received_amount * p.share_percent / 100.0, 2)
      from public.partners p
      where p.organization_id = new.organization_id
        and p.active = true
      on conflict (invoice_id, partner_id) do update
      set base_amount = excluded.base_amount,
          share_percent = excluded.share_percent,
          distributed_amount = excluded.distributed_amount,
          generated_at = now();

      update public.invoices
      set production_split_done = true
      where id = new.id
        and production_split_done = false;
    end if;
  elsif tg_op = 'UPDATE'
        and old.status in ('received', 'partial')
        and new.status not in ('received', 'partial') then
    delete from public.distributions where invoice_id = new.id;

    update public.invoices
    set production_split_done = false
    where id = new.id
      and production_split_done = true;
  end if;

  return new;
end;
$$;

drop trigger if exists invoices_generate_distribution on public.invoices;
drop trigger if exists invoices_generate_distribution_insert on public.invoices;
drop trigger if exists invoices_generate_distribution_update on public.invoices;

create trigger invoices_generate_distribution_insert
after insert on public.invoices
for each row execute function public.generate_invoice_distribution();

create trigger invoices_generate_distribution_update
after update of status, received_amount on public.invoices
for each row execute function public.generate_invoice_distribution();

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'distributions'
      and policyname = 'distributions_update_member'
  ) then
    create policy distributions_update_member
      on public.distributions
      for update
      using (
        exists (
          select 1
          from public.memberships m
          where m.organization_id = distributions.organization_id
            and m.user_id = auth.uid()
        )
      )
      with check (
        exists (
          select 1
          from public.memberships m
          where m.organization_id = distributions.organization_id
            and m.user_id = auth.uid()
        )
      );
  end if;
end;
$$;

insert into public.distributions (
  organization_id,
  invoice_id,
  partner_id,
  base_amount,
  share_percent,
  distributed_amount
)
select
  i.organization_id,
  i.id,
  p.id,
  i.received_amount,
  p.share_percent,
  round(i.received_amount * p.share_percent / 100.0, 2)
from public.invoices i
join public.partners p
  on p.organization_id = i.organization_id
 and p.active = true
where i.status in ('received', 'partial')
  and i.received_amount > 0
on conflict (invoice_id, partner_id) do nothing;

update public.invoices i
set production_split_done = true
where i.status in ('received', 'partial')
  and i.received_amount > 0
  and exists (
    select 1
    from public.distributions d
    where d.invoice_id = i.id
  );
