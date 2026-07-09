alter table public.rateio_claro
  add column if not exists franquia text,
  add column if not exists up text not null default 'nao';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'rateio_claro_franquia_check'
  ) then
    alter table public.rateio_claro
      add constraint rateio_claro_franquia_check
      check (
        franquia is null
        or lower(trim(franquia)) in ('mb', 'gb')
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'rateio_claro_up_check'
  ) then
    alter table public.rateio_claro
      add constraint rateio_claro_up_check
      check (lower(trim(up)) in ('sim', 'nao'));
  end if;
end $$;

update public.rateio_claro
set up = coalesce(nullif(lower(trim(up)), ''), 'nao')
where up is null or trim(up) = '';
