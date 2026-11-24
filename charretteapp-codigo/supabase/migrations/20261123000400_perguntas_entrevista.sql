-- Questionário da entrevista, editável pela equipe (papel 'equipe')
-- (versão aplicada no Supabase inclui as 16 perguntas iniciais; ver histórico de migrações)
create table public.perguntas (
  id          text primary key,
  bloco       text not null,
  texto       text not null,
  tipo        text not null default 'texto' check (tipo in ('curto','texto','opcoes','multi')),
  opcoes      text[] not null default '{}',
  ajuda       text,
  ordem       int not null default 0,
  ativo       boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index perguntas_ordem_idx on public.perguntas (ordem);
create trigger perguntas_updated_at before update on public.perguntas
  for each row execute function public.set_updated_at();
alter table public.perguntas enable row level security;
create policy "perguntas: ler" on public.perguntas
  for select to authenticated using (ativo or (select privado.is_equipe()));
create policy "perguntas: equipe cria" on public.perguntas
  for insert to authenticated with check ((select privado.is_equipe()));
create policy "perguntas: equipe edita" on public.perguntas
  for update to authenticated using ((select privado.is_equipe())) with check ((select privado.is_equipe()));
create policy "perguntas: equipe apaga" on public.perguntas
  for delete to authenticated using ((select privado.is_equipe()));
