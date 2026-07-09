alter table public.rateio_claro
  drop constraint if exists rateio_claro_franquia_check;

alter table public.rateio_claro
  add constraint rateio_claro_franquia_check
  check (
    franquia is null
    or trim(franquia) = ''
    or lower(trim(franquia)) ~ '^[0-9]+[[:space:]]*(mb|gb)$'
  );

update public.rateio_claro
set franquia = null
where franquia is not null and trim(franquia) = '';
