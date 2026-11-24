-- Etapa Entrevista: link do formulário, data, entrevistados e resumo
create table public.entrevista (
  charrette_id     uuid primary key references public.charrettes (id) on delete cascade,
  link_formulario  text,
  data_entrevista  date,
  entrevistados    text,
  resumo           text,
  updated_at       timestamptz not null default now()
);
create trigger entrevista_updated_at before update on public.entrevista
  for each row execute function public.set_updated_at();
alter table public.entrevista enable row level security;
create policy "dono da charrette" on public.entrevista for all to authenticated
  using (privado.is_dono(charrette_id)) with check (privado.is_dono(charrette_id));
insert into public.entrevista (charrette_id) select id from public.charrettes on conflict do nothing;
-- preparar_charrette() passa a criar também a linha de entrevista (ver migração aplicada)
