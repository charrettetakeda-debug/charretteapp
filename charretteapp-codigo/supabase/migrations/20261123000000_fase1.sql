-- =====================================================================
-- Charrette — banco de dados da fase 1
-- Cada charretteiro só vê e edita as próprias charrettes.
-- O catálogo de consultores é mantido pela equipe Takeda (papel 'equipe').
-- =====================================================================

-- ---------------------------------------------------------------------
-- Utilitários
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------
-- Perfis (um por usuário do Supabase Auth)
-- ---------------------------------------------------------------------
create table public.perfis (
  id          uuid primary key references auth.users (id) on delete cascade,
  nome        text,
  papel       text not null default 'charretteiro'
              check (papel in ('charretteiro', 'equipe')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger perfis_updated_at before update on public.perfis
  for each row execute function public.set_updated_at();

-- Cria o perfil automaticamente quando alguém se cadastra
create or replace function public.criar_perfil()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfis (id, nome)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'nome', split_part(new.email, '@', 1)));
  return new;
end $$;
create trigger ao_criar_usuario after insert on auth.users
  for each row execute function public.criar_perfil();

create or replace function public.is_equipe()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfis where id = auth.uid() and papel = 'equipe');
$$;

-- ---------------------------------------------------------------------
-- Charrettes
-- ---------------------------------------------------------------------
create table public.charrettes (
  id            uuid primary key default gen_random_uuid(),
  dono_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nome          text not null,
  cidade        text,
  uf            text,
  descricao     text,
  data_evento   date,
  local_evento  text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index charrettes_dono_idx on public.charrettes (dono_id);
create trigger charrettes_updated_at before update on public.charrettes
  for each row execute function public.set_updated_at();

-- O usuário logado é dono desta charrette?
create or replace function public.is_dono(c uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.charrettes where id = c and dono_id = auth.uid());
$$;

-- ---------------------------------------------------------------------
-- Etapas do menu e seu status (alimenta o progresso)
-- ---------------------------------------------------------------------
create table public.etapas (
  charrette_id  uuid not null references public.charrettes (id) on delete cascade,
  etapa         text not null check (etapa in (
                  'pesquisa','coleta','entrevista','problema','briefing','parceiros',
                  'conteudo','dinamica','toolbox','projeto',
                  'conceito','prototipo')),
  status        text not null default 'a_fazer'
                check (status in ('a_fazer','em_andamento','concluido')),
  updated_at    timestamptz not null default now(),
  primary key (charrette_id, etapa)
);
create trigger etapas_updated_at before update on public.etapas
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Próximos passos (tarefas)
-- ---------------------------------------------------------------------
create table public.tarefas (
  id            uuid primary key default gen_random_uuid(),
  charrette_id  uuid not null references public.charrettes (id) on delete cascade,
  titulo        text not null,
  etapa         text,
  responsavel   text,
  prazo         date,
  feito         boolean not null default false,
  ordem         int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index tarefas_charrette_idx on public.tarefas (charrette_id);
create trigger tarefas_updated_at before update on public.tarefas
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Arquivos enviados (qualquer etapa) — os arquivos ficam no Storage
-- ---------------------------------------------------------------------
create table public.arquivos (
  id            uuid primary key default gen_random_uuid(),
  charrette_id  uuid not null references public.charrettes (id) on delete cascade,
  etapa         text not null,
  nome          text not null,
  caminho       text not null,          -- caminho no bucket "charrette-arquivos"
  tipo          text,                   -- tipo MIME
  tamanho       bigint,
  legenda       text,
  versao        int not null default 1,
  created_at    timestamptz not null default now()
);
create index arquivos_charrette_idx on public.arquivos (charrette_id, etapa);

-- ---------------------------------------------------------------------
-- Pré-charrette: Pesquisa
-- ---------------------------------------------------------------------
create table public.pesquisa (
  charrette_id      uuid primary key references public.charrettes (id) on delete cascade,
  populacao         int,
  crescimento_pct   numeric(6,2),
  renda_media       numeric(12,2),
  lotes_a_venda     int,
  preco_m2          numeric(12,2),
  anotacoes         text,
  fontes            text[] not null default '{}',
  updated_at        timestamptz not null default now()
);
create trigger pesquisa_updated_at before update on public.pesquisa
  for each row execute function public.set_updated_at();

create table public.concorrentes (
  id            uuid primary key default gen_random_uuid(),
  charrette_id  uuid not null references public.charrettes (id) on delete cascade,
  nome          text not null,
  bairro        text,
  area_lote_m2  numeric(10,2),
  lotes         int,
  preco_medio   numeric(12,2),
  velocidade    text check (velocidade in ('alta','media','baixa')),
  observacoes   text,
  created_at    timestamptz not null default now()
);
create index concorrentes_charrette_idx on public.concorrentes (charrette_id);

-- ---------------------------------------------------------------------
-- Pré-charrette: Coleta de informações (lista de documentos)
-- ---------------------------------------------------------------------
create table public.documentos (
  id            uuid primary key default gen_random_uuid(),
  charrette_id  uuid not null references public.charrettes (id) on delete cascade,
  titulo        text not null,
  categoria     text not null default 'outros'
                check (categoria in ('legislacao','topografia','projetos','fotos',
                                     'tecnico','infraestrutura','ambiental','cultural','outros')),
  arquivo_id    uuid references public.arquivos (id) on delete set null,
  observacoes   text,
  ordem         int not null default 0,
  created_at    timestamptz not null default now()
);
create index documentos_charrette_idx on public.documentos (charrette_id);

-- ---------------------------------------------------------------------
-- Pré-charrette: Definição do problema
-- ---------------------------------------------------------------------
create table public.problema (
  charrette_id  uuid primary key references public.charrettes (id) on delete cascade,
  desafio       text,
  updated_at    timestamptz not null default now()
);
create trigger problema_updated_at before update on public.problema
  for each row execute function public.set_updated_at();

create table public.conclusoes (
  id            uuid primary key default gen_random_uuid(),
  charrette_id  uuid not null references public.charrettes (id) on delete cascade,
  titulo        text not null,
  descricao     text,
  ordem         int not null default 0
);
create index conclusoes_charrette_idx on public.conclusoes (charrette_id);

-- ---------------------------------------------------------------------
-- Pré-charrette: Briefing e participantes
-- ---------------------------------------------------------------------
create table public.briefing (
  charrette_id  uuid primary key references public.charrettes (id) on delete cascade,
  data_reuniao  timestamptz,
  local         text,
  pauta         text,
  decisoes      text,
  updated_at    timestamptz not null default now()
);
create trigger briefing_updated_at before update on public.briefing
  for each row execute function public.set_updated_at();

create table public.participantes (
  id            uuid primary key default gen_random_uuid(),
  charrette_id  uuid not null references public.charrettes (id) on delete cascade,
  nome          text not null,
  papel         text,          -- ex.: família, arquiteto convidado, órgão público
  contato       text,
  created_at    timestamptz not null default now()
);
create index participantes_charrette_idx on public.participantes (charrette_id);

-- ---------------------------------------------------------------------
-- Pré-charrette: Seleção de parceiros (catálogo mantido pela equipe)
-- ---------------------------------------------------------------------
create table public.consultores (
  id              uuid primary key default gen_random_uuid(),
  nome            text not null,
  area            text not null,
  descricao       text,
  especialidades  text[] not null default '{}',
  contato         text,
  ativo           boolean not null default true,
  created_at      timestamptz not null default now()
);

create table public.charrette_parceiros (
  charrette_id  uuid not null references public.charrettes (id) on delete cascade,
  consultor_id  uuid not null references public.consultores (id) on delete cascade,
  status        text not null default 'convidado'
                check (status in ('convidado','confirmado','recusado')),
  created_at    timestamptz not null default now(),
  primary key (charrette_id, consultor_id)
);

-- ---------------------------------------------------------------------
-- Charrette: Conteúdo (programa do evento)
-- ---------------------------------------------------------------------
create table public.programa (
  id            uuid primary key default gen_random_uuid(),
  charrette_id  uuid not null references public.charrettes (id) on delete cascade,
  dia           int not null default 1,
  hora          time,
  titulo        text not null,
  descricao     text,
  ferramenta    text,        -- ex.: Padlet, Mentimeter
  link          text,
  ordem         int not null default 0
);
create index programa_charrette_idx on public.programa (charrette_id, dia, hora);

-- ---------------------------------------------------------------------
-- Pós-entrega: Conceito consolidado
-- ---------------------------------------------------------------------
create table public.conceito (
  charrette_id  uuid primary key references public.charrettes (id) on delete cascade,
  nome          text,          -- naming
  storytelling  text,
  pilares       jsonb not null default '[]',   -- [{ "titulo": "...", "descricao": "..." }]
  updated_at    timestamptz not null default now()
);
create trigger conceito_updated_at before update on public.conceito
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Ao criar uma charrette: cria as 12 etapas e a lista padrão de documentos
-- (lista baseada na metodologia: itens a providenciar antes do evento)
-- ---------------------------------------------------------------------
create or replace function public.preparar_charrette()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.etapas (charrette_id, etapa)
  select new.id, e from unnest(array[
    'pesquisa','coleta','entrevista','problema','briefing','parceiros',
    'conteudo','dinamica','toolbox','projeto','conceito','prototipo']) as e;

  insert into public.documentos (charrette_id, titulo, categoria, ordem) values
    (new.id, 'Levantamento planialtimétrico do terreno', 'topografia', 1),
    (new.id, 'Projetos arquitetônicos e urbanísticos existentes', 'projetos', 2),
    (new.id, 'Fotos do local', 'fotos', 3),
    (new.id, 'Legislação aplicável', 'legislacao', 4),
    (new.id, 'Estratigrafia cultural', 'cultural', 5);

  insert into public.pesquisa (charrette_id) values (new.id);
  insert into public.problema (charrette_id) values (new.id);
  insert into public.briefing (charrette_id) values (new.id);
  insert into public.conceito (charrette_id) values (new.id);
  return new;
end $$;
create trigger ao_criar_charrette after insert on public.charrettes
  for each row execute function public.preparar_charrette();

-- =====================================================================
-- Segurança (RLS)
-- =====================================================================
alter table public.perfis              enable row level security;
alter table public.charrettes          enable row level security;
alter table public.etapas              enable row level security;
alter table public.tarefas             enable row level security;
alter table public.arquivos            enable row level security;
alter table public.pesquisa            enable row level security;
alter table public.concorrentes        enable row level security;
alter table public.documentos          enable row level security;
alter table public.problema            enable row level security;
alter table public.conclusoes          enable row level security;
alter table public.briefing            enable row level security;
alter table public.participantes       enable row level security;
alter table public.consultores         enable row level security;
alter table public.charrette_parceiros enable row level security;
alter table public.programa            enable row level security;
alter table public.conceito            enable row level security;

-- Perfil: cada um lê e edita o seu (sem poder mudar o próprio papel)
create policy "perfil: ler o seu" on public.perfis
  for select to authenticated using (id = auth.uid());
create policy "perfil: editar o seu" on public.perfis
  for update to authenticated using (id = auth.uid())
  with check (id = auth.uid() and papel = (select p.papel from public.perfis p where p.id = auth.uid()));

-- Charrettes: só o dono
create policy "charrette: dono" on public.charrettes
  for all to authenticated
  using (dono_id = auth.uid())
  with check (dono_id = auth.uid());

-- Tabelas filhas: só o dono da charrette
do $$
declare t text;
begin
  foreach t in array array['etapas','tarefas','arquivos','pesquisa','concorrentes','documentos',
                           'problema','conclusoes','briefing','participantes',
                           'charrette_parceiros','programa','conceito']
  loop
    execute format(
      'create policy "dono da charrette" on public.%I for all to authenticated
         using (public.is_dono(charrette_id)) with check (public.is_dono(charrette_id))', t);
  end loop;
end $$;

-- Consultores: todos os logados consultam; só a equipe cadastra e edita
create policy "consultores: ler" on public.consultores
  for select to authenticated using (ativo or public.is_equipe());
create policy "consultores: equipe gerencia" on public.consultores
  for all to authenticated using (public.is_equipe()) with check (public.is_equipe());

-- =====================================================================
-- Armazenamento de arquivos
-- Caminho: <dono_id>/<charrette_id>/<etapa>/<arquivo>
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit)
values ('charrette-arquivos', 'charrette-arquivos', false, 52428800)   -- até 50 MB
on conflict (id) do nothing;

create policy "arquivos: dono lê" on storage.objects
  for select to authenticated
  using (bucket_id = 'charrette-arquivos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "arquivos: dono envia" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'charrette-arquivos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "arquivos: dono atualiza" on storage.objects
  for update to authenticated
  using (bucket_id = 'charrette-arquivos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "arquivos: dono apaga" on storage.objects
  for delete to authenticated
  using (bucket_id = 'charrette-arquivos' and (storage.foldername(name))[1] = auth.uid()::text);

-- =====================================================================
-- Funções internas não ficam expostas pela API
-- =====================================================================
revoke execute on function public.criar_perfil()       from public, anon, authenticated;
revoke execute on function public.preparar_charrette() from public, anon, authenticated;
revoke execute on function public.set_updated_at()     from public, anon, authenticated;
revoke execute on function public.is_dono(uuid)        from public, anon;
revoke execute on function public.is_equipe()          from public, anon;
grant  execute on function public.is_dono(uuid)        to authenticated;
grant  execute on function public.is_equipe()          to authenticated;
