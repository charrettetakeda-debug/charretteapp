-- =====================================================================
-- Equipe vê tudo, mural de ideias, envio público e cases públicos
-- =====================================================================

-- anon (visitante sem login) precisa conseguir chamar as funções auxiliares
grant usage on schema privado to anon;

-- ---------------------------------------------------------------------
-- 1) Equipe vê e edita todas as charrettes
-- ---------------------------------------------------------------------
create or replace function privado.is_dono(c uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.charrettes where id = c and dono_id = auth.uid())
      or privado.is_equipe();
$$;
grant execute on function privado.is_dono(uuid) to anon, authenticated;
grant execute on function privado.is_equipe() to anon, authenticated;

drop policy "charrette: dono" on public.charrettes;
create policy "charrette: dono ou equipe" on public.charrettes
  for all to authenticated
  using (dono_id = (select auth.uid()) or (select privado.is_equipe()))
  with check (dono_id = (select auth.uid()) or (select privado.is_equipe()));

-- equipe enxerga os perfis (para mostrar nomes de clientes e responsáveis)
drop policy "perfil: ler o seu" on public.perfis;
create policy "perfil: ler" on public.perfis
  for select to authenticated using (id = (select auth.uid()) or (select privado.is_equipe()));

-- arquivos no Storage: dono da pasta ou equipe
drop policy "arquivos: dono lê" on storage.objects;
drop policy "arquivos: dono envia" on storage.objects;
drop policy "arquivos: dono atualiza" on storage.objects;
drop policy "arquivos: dono apaga" on storage.objects;

-- ---------------------------------------------------------------------
-- 2) Envio público: link por charrette
-- ---------------------------------------------------------------------
alter table public.charrettes
  add column envio_publico boolean not null default false,
  add column codigo_publico text unique default substr(md5(gen_random_uuid()::text), 1, 10);
update public.charrettes set codigo_publico = substr(md5(gen_random_uuid()::text), 1, 10) where codigo_publico is null;
alter table public.charrettes alter column codigo_publico set not null;

-- A charrette (pelo id em texto) está com o envio público ligado?
create or replace function privado.envio_aberto(cid text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.charrettes where id::text = cid and envio_publico);
$$;
grant execute on function privado.envio_aberto(text) to anon, authenticated;

-- Dono da charrette cujo id vem como texto (sem erro se não for um uuid)
create or replace function privado.is_dono_txt(cid text)
returns boolean language plpgsql stable security definer set search_path = public as $$
begin
  return privado.is_dono(cid::uuid);
exception when others then
  return false;
end $$;
grant execute on function privado.is_dono_txt(text) to anon, authenticated;

create policy "arquivos: ler" on storage.objects for select to authenticated
  using (bucket_id = 'charrette-arquivos' and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or (select privado.is_equipe())
    or ((storage.foldername(name))[1] = 'publico' and privado.is_dono_txt((storage.foldername(name))[2]))
  ));
create policy "arquivos: enviar" on storage.objects for insert to authenticated
  with check (bucket_id = 'charrette-arquivos' and (
    (storage.foldername(name))[1] = (select auth.uid())::text or (select privado.is_equipe())
  ));
create policy "arquivos: atualizar" on storage.objects for update to authenticated
  using (bucket_id = 'charrette-arquivos' and (
    (storage.foldername(name))[1] = (select auth.uid())::text or (select privado.is_equipe())
  ));
create policy "arquivos: apagar" on storage.objects for delete to authenticated
  using (bucket_id = 'charrette-arquivos' and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or (select privado.is_equipe())
    or ((storage.foldername(name))[1] = 'publico' and privado.is_dono_txt((storage.foldername(name))[2]))
  ));
-- visitante sem login só envia para publico/<charrette>/… quando o link está ligado
create policy "arquivos: envio publico" on storage.objects for insert to anon
  with check (bucket_id = 'charrette-arquivos'
    and (storage.foldername(name))[1] = 'publico'
    and privado.envio_aberto((storage.foldername(name))[2]));

-- ---------------------------------------------------------------------
-- 3) Mural de ideias
-- ---------------------------------------------------------------------
create table public.ideias (
  id               uuid primary key default gen_random_uuid(),
  charrette_id     uuid not null references public.charrettes (id) on delete cascade,
  titulo           text not null,
  descricao        text,
  referencia       text,
  comentarios      text,
  obs              text,
  tema             text,
  status           text not null default 'a_avaliar'
                   check (status in ('a_avaliar','aprovada','em_duvida','ja_existe','descartada')),
  responsavel_id   uuid references public.perfis (id) on delete set null,
  responsavel_nome text,
  origem           text not null default 'app' check (origem in ('app','publico')),
  autor_nome       text,
  autor_contato    text,
  criado_por       uuid default auth.uid() references auth.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index ideias_charrette_idx on public.ideias (charrette_id, status);
create index ideias_responsavel_idx on public.ideias (responsavel_id);
create index ideias_criado_por_idx on public.ideias (criado_por);
create trigger ideias_updated_at before update on public.ideias
  for each row execute function public.set_updated_at();

-- Só a equipe decide status e responsável
create or replace function privado.proteger_ideia()
returns trigger language plpgsql set search_path = public as $$
begin
  if privado.is_equipe() then return new; end if;
  if tg_op = 'INSERT' then
    new.status := 'a_avaliar';
    new.responsavel_id := null;
    new.responsavel_nome := null;
  elsif new.status is distinct from old.status
     or new.responsavel_id is distinct from old.responsavel_id
     or new.responsavel_nome is distinct from old.responsavel_nome then
    raise exception 'Somente a equipe pode mudar o status ou o responsável da ideia';
  end if;
  return new;
end $$;
create trigger ideias_proteger before insert or update on public.ideias
  for each row execute function privado.proteger_ideia();

alter table public.ideias enable row level security;
create policy "ideias: ler" on public.ideias for select to authenticated
  using (privado.is_dono(charrette_id));
create policy "ideias: criar" on public.ideias for insert to authenticated
  with check (privado.is_dono(charrette_id));
create policy "ideias: editar" on public.ideias for update to authenticated
  using (privado.is_dono(charrette_id)) with check (privado.is_dono(charrette_id));
create policy "ideias: apagar" on public.ideias for delete to authenticated
  using ((select privado.is_equipe()) or criado_por = (select auth.uid()));

-- imagens das ideias ficam na tabela de arquivos
alter table public.arquivos add column ideia_id uuid references public.ideias (id) on delete cascade;
create index arquivos_ideia_idx on public.arquivos (ideia_id);

-- Funções do envio público (visitante sem login)
create or replace function public.envio_info(codigo text)
returns table (id uuid, nome text, cidade text, uf text)
language sql stable security definer set search_path = public as $$
  select c.id, c.nome, c.cidade, c.uf from public.charrettes c
  where c.codigo_publico = codigo and c.envio_publico;
$$;

create or replace function public.envio_ideia(codigo text, p_titulo text, p_descricao text default null,
  p_referencia text default null, p_autor_nome text default null, p_autor_contato text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare cid uuid; nova uuid;
begin
  select id into cid from public.charrettes where codigo_publico = codigo and envio_publico;
  if cid is null then raise exception 'Envio fechado ou link inválido'; end if;
  if coalesce(trim(p_titulo), '') = '' then raise exception 'Escreva a ideia'; end if;
  insert into public.ideias (charrette_id, titulo, descricao, referencia, autor_nome, autor_contato, origem, criado_por)
  values (cid, left(trim(p_titulo), 300), left(p_descricao, 4000), left(p_referencia, 1000),
          left(p_autor_nome, 120), left(p_autor_contato, 160), 'publico', null)
  returning id into nova;
  return nova;
end $$;

create or replace function public.envio_arquivo(codigo text, p_ideia uuid, p_caminho text,
  p_nome text, p_tipo text, p_tamanho bigint)
returns void language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  select id into cid from public.charrettes where codigo_publico = codigo and envio_publico;
  if cid is null then raise exception 'Envio fechado ou link inválido'; end if;
  if not exists (select 1 from public.ideias where id = p_ideia and charrette_id = cid
                 and origem = 'publico' and created_at > now() - interval '2 hours') then
    raise exception 'Ideia não encontrada';
  end if;
  if p_caminho not like 'publico/' || cid::text || '/' || p_ideia::text || '/%' then
    raise exception 'Caminho inválido';
  end if;
  insert into public.arquivos (charrette_id, etapa, ideia_id, nome, caminho, tipo, tamanho, legenda)
  values (cid, 'ideias', p_ideia, left(p_nome, 200), p_caminho, p_tipo, p_tamanho, 'referencia');
end $$;

revoke execute on function public.envio_info(text) from public;
revoke execute on function public.envio_ideia(text, text, text, text, text, text) from public;
revoke execute on function public.envio_arquivo(text, uuid, text, text, text, bigint) from public;
grant execute on function public.envio_info(text) to anon, authenticated;
grant execute on function public.envio_ideia(text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.envio_arquivo(text, uuid, text, text, text, bigint) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 4) Cases públicos
-- ---------------------------------------------------------------------
create table public.cases (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  titulo      text not null,
  local       text,
  categoria   text,
  ano         int,
  area        text,
  resumo      text,
  descricao   text,
  capa        text,                 -- caminho no bucket "cases"
  publicado   boolean not null default false,
  ordem       int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger cases_updated_at before update on public.cases
  for each row execute function public.set_updated_at();

create table public.case_imagens (
  id         uuid primary key default gen_random_uuid(),
  case_id    uuid not null references public.cases (id) on delete cascade,
  caminho    text not null,
  legenda    text,
  tipo       text not null default 'render' check (tipo in ('render','planta','foto')),
  ordem      int not null default 0,
  created_at timestamptz not null default now()
);
create index case_imagens_case_idx on public.case_imagens (case_id, ordem);

alter table public.cases enable row level security;
alter table public.case_imagens enable row level security;
create policy "cases: ler" on public.cases for select to anon, authenticated
  using (publicado or (select privado.is_equipe()));
create policy "cases: equipe cria" on public.cases for insert to authenticated with check ((select privado.is_equipe()));
create policy "cases: equipe edita" on public.cases for update to authenticated
  using ((select privado.is_equipe())) with check ((select privado.is_equipe()));
create policy "cases: equipe apaga" on public.cases for delete to authenticated using ((select privado.is_equipe()));

create policy "case_imagens: ler" on public.case_imagens for select to anon, authenticated
  using (exists (select 1 from public.cases c where c.id = case_id and (c.publicado or (select privado.is_equipe()))));
create policy "case_imagens: equipe cria" on public.case_imagens for insert to authenticated with check ((select privado.is_equipe()));
create policy "case_imagens: equipe edita" on public.case_imagens for update to authenticated
  using ((select privado.is_equipe())) with check ((select privado.is_equipe()));
create policy "case_imagens: equipe apaga" on public.case_imagens for delete to authenticated using ((select privado.is_equipe()));

-- imagens dos cases: pasta pública (qualquer um vê pelo link), só a equipe envia
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cases', 'cases', true, 20971520, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do nothing;
create policy "cases: equipe envia" on storage.objects for insert to authenticated
  with check (bucket_id = 'cases' and (select privado.is_equipe()));
create policy "cases: equipe atualiza" on storage.objects for update to authenticated
  using (bucket_id = 'cases' and (select privado.is_equipe()));
create policy "cases: equipe apaga" on storage.objects for delete to authenticated
  using (bucket_id = 'cases' and (select privado.is_equipe()));
