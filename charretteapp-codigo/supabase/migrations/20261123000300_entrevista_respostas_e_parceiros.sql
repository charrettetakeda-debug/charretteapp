-- Respostas do questionário da entrevista: { "pergunta_id": "resposta" }
alter table public.entrevista add column respostas jsonb not null default '{}';

-- Parceiros cadastrados pelo próprio charretteiro (independente do catálogo da equipe)
create table public.parceiros (
  id            uuid primary key default gen_random_uuid(),
  charrette_id  uuid not null references public.charrettes (id) on delete cascade,
  nome          text not null,
  area          text,
  contato       text,
  observacoes   text,
  status        text not null default 'a_convidar'
                check (status in ('a_convidar','convidado','confirmado','recusado')),
  created_at    timestamptz not null default now()
);
create index parceiros_charrette_idx on public.parceiros (charrette_id);
alter table public.parceiros enable row level security;
create policy "dono da charrette" on public.parceiros for all to authenticated
  using (privado.is_dono(charrette_id)) with check (privado.is_dono(charrette_id));
