set search_path = public;

drop policy if exists parque_parametros_base_read on public.parque_parametros_base;

create policy parque_parametros_base_read
on public.parque_parametros_base
for select
to authenticated
using (
  has_module_access('parque_tecnologico')
  or has_module_access('custos_clinicas')
);
