-- =====================================================================
-- Área do parceiro, quadros incorporados (Padlet/Miro) e catálogo de
-- dinâmicas da Toolbox
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Ficha do parceiro: quem tem ficha é parceiro (o papel continua charretteiro)
-- ---------------------------------------------------------------------
-- Quem se cadastra como parceiro (tipo = parceiro nos metadados) já ganha a ficha.
-- Ninguém consegue se cadastrar como equipe por aqui: equipe só pela lista de e-mails.
create or replace function public.criar_perfil()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfis (id, nome, papel)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nome', split_part(new.email, '@', 1)),
    case
      when exists (select 1 from privado.emails_equipe e where lower(e.email) = lower(new.email)) then 'equipe'
      else 'charretteiro'
    end
  );
  if new.raw_user_meta_data ->> 'tipo' = 'parceiro' then
    insert into public.parceiro_ficha (id, area, email)
    values (new.id, nullif(new.raw_user_meta_data ->> 'area', ''), new.email)
    on conflict (id) do nothing;
  end if;
  return new;
end $$;
revoke execute on function public.criar_perfil() from public, anon, authenticated;

create table public.parceiro_ficha (
  id             uuid primary key references public.perfis (id) on delete cascade,
  area           text,
  empresa        text,
  cidade         text,
  uf             text,
  telefone       text,
  email          text,
  bio            text,
  especialidades text[] not null default '{}',
  portfolio      text,
  foto           text,           -- caminho no bucket charrette-arquivos (<uid>/perfil/…)
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create trigger parceiro_ficha_updated_at before update on public.parceiro_ficha
  for each row execute function public.set_updated_at();
alter table public.parceiro_ficha enable row level security;
create policy "ficha: ler" on public.parceiro_ficha for select to authenticated
  using (id = (select auth.uid()) or (select privado.is_equipe()));
create policy "ficha: criar a sua" on public.parceiro_ficha for insert to authenticated
  with check (id = (select auth.uid()));
create policy "ficha: editar" on public.parceiro_ficha for update to authenticated
  using (id = (select auth.uid()) or (select privado.is_equipe()))
  with check (id = (select auth.uid()) or (select privado.is_equipe()));

-- ---------------------------------------------------------------------
-- 2) Parceiros de cada charrette: convite pela equipe
-- ---------------------------------------------------------------------
alter table public.parceiros
  add column parceiro_id   uuid references public.perfis (id) on delete set null,
  add column email         text,
  add column mensagem      text,
  add column convite_token text unique default substr(md5(gen_random_uuid()::text), 1, 16),
  add column convidado_em  timestamptz,
  add column respondido_em timestamptz;
update public.parceiros set convite_token = substr(md5(gen_random_uuid()::text), 1, 16) where convite_token is null;
alter table public.parceiros alter column convite_token set not null;
create unique index parceiros_um_por_charrette on public.parceiros (charrette_id, parceiro_id) where parceiro_id is not null;
create index parceiros_parceiro_idx on public.parceiros (parceiro_id);

-- Só a equipe convida e muda a situação; o cliente apenas sugere nomes.
-- As funções de resposta do parceiro passam pela marca charrette.rpc.
create or replace function privado.proteger_parceiro()
returns trigger language plpgsql set search_path = public as $$
begin
  if privado.is_equipe() or current_setting('charrette.rpc', true) = '1' then return new; end if;
  if tg_op = 'INSERT' then
    new.status := 'a_convidar';
    new.parceiro_id := null;
    new.convidado_em := null;
    new.respondido_em := null;
  elsif new.status is distinct from old.status
     or new.parceiro_id is distinct from old.parceiro_id
     or new.convidado_em is distinct from old.convidado_em
     or new.respondido_em is distinct from old.respondido_em
     or new.convite_token is distinct from old.convite_token then
    raise exception 'Somente a equipe pode convidar parceiros';
  end if;
  return new;
end $$;
create trigger parceiros_proteger before insert or update on public.parceiros
  for each row execute function privado.proteger_parceiro();

-- (a política "dono da charrette" continua valendo para dono e equipe)
create policy "parceiros: o parceiro vê os seus" on public.parceiros for select to authenticated
  using (parceiro_id = (select auth.uid()));

-- O usuário logado participa (convite aceito) desta charrette?
create or replace function privado.is_parceiro_ativo(c uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.parceiros
                 where charrette_id = c and parceiro_id = auth.uid() and status = 'confirmado');
$$;
create or replace function privado.is_parceiro_ativo_txt(cid text)
returns boolean language plpgsql stable security definer set search_path = public as $$
begin
  return privado.is_parceiro_ativo(cid::uuid);
exception when others then
  return false;
end $$;
grant execute on function privado.is_parceiro_ativo(uuid), privado.is_parceiro_ativo_txt(text) to authenticated;

-- Convites e charrettes do parceiro, com um resumo de cada uma
create or replace function public.minhas_participacoes()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id, 'status', p.status, 'convidado_em', p.convidado_em, 'respondido_em', p.respondido_em,
    'mensagem', p.mensagem, 'area', p.area,
    'charrette', jsonb_build_object(
      'id', c.id, 'nome', c.nome, 'cidade', c.cidade, 'uf', c.uf, 'descricao', c.descricao,
      'data_evento', c.data_evento, 'local_evento', c.local_evento,
      'envio_publico', false, 'codigo_publico', null,
      'cliente', d.nome, 'desafio', pr.desafio,
      'naming', co.nome)
  ) order by c.data_evento nulls last, p.created_at), '[]'::jsonb)
  from public.parceiros p
  join public.charrettes c on c.id = p.charrette_id
  left join public.perfis d on d.id = c.dono_id
  left join public.problema pr on pr.charrette_id = c.id
  left join public.conceito co on co.charrette_id = c.id
  where p.parceiro_id = auth.uid() and p.status in ('convidado', 'confirmado', 'recusado');
$$;

-- Parceiro aceita ou recusa o convite
create or replace function public.responder_convite(p_id uuid, p_aceitar boolean)
returns text language plpgsql security definer set search_path = public as $$
declare novo text := case when p_aceitar then 'confirmado' else 'recusado' end;
begin
  perform set_config('charrette.rpc', '1', true);
  update public.parceiros set status = novo, respondido_em = now()
  where id = p_id and parceiro_id = auth.uid() and status in ('convidado', 'confirmado', 'recusado');
  if not found then raise exception 'Convite não encontrado'; end if;
  return novo;
end $$;

-- Página aberta do link de convite (funciona sem login)
create or replace function public.convite_info(p_token text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'nome', p.nome, 'status', p.status, 'vinculado', p.parceiro_id is not null,
    'charrette', c.nome, 'cidade', c.cidade, 'uf', c.uf,
    'data_evento', c.data_evento, 'local_evento', c.local_evento, 'mensagem', p.mensagem)
  from public.parceiros p join public.charrettes c on c.id = p.charrette_id
  where p.convite_token = p_token and p.status in ('convidado', 'confirmado');
$$;

-- Liga o convite à conta de quem está logado
create or replace function public.vincular_convite(p_token text)
returns uuid language plpgsql security definer set search_path = public as $$
declare r public.parceiros;
begin
  if auth.uid() is null then raise exception 'Entre na sua conta para aceitar o convite'; end if;
  select * into r from public.parceiros where convite_token = p_token and status in ('convidado', 'confirmado');
  if not found then raise exception 'Convite inválido ou encerrado'; end if;
  if r.parceiro_id is not null and r.parceiro_id <> auth.uid() then
    raise exception 'Este convite já foi usado por outra conta';
  end if;
  if r.parceiro_id is null and exists (select 1 from public.parceiros
       where charrette_id = r.charrette_id and parceiro_id = auth.uid()) then
    raise exception 'Você já está nesta charrette';
  end if;

  perform set_config('charrette.rpc', '1', true);
  update public.parceiros set parceiro_id = auth.uid() where id = r.id;

  insert into public.parceiro_ficha (id, area, email)
  values (auth.uid(), r.area, (select email from auth.users where id = auth.uid()))
  on conflict (id) do nothing;
  return r.charrette_id;
end $$;

revoke execute on function public.minhas_participacoes(), public.responder_convite(uuid, boolean),
  public.convite_info(text), public.vincular_convite(text) from public;
grant execute on function public.minhas_participacoes(), public.responder_convite(uuid, boolean),
  public.vincular_convite(text) to authenticated;
grant execute on function public.convite_info(text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 3) O que o parceiro com convite aceito enxerga
-- ---------------------------------------------------------------------
create policy "programa: parceiro lê" on public.programa for select to authenticated
  using (privado.is_parceiro_ativo(charrette_id));

create policy "ideias: parceiro lê" on public.ideias for select to authenticated
  using (privado.is_parceiro_ativo(charrette_id));
create policy "ideias: parceiro cria" on public.ideias for insert to authenticated
  with check (privado.is_parceiro_ativo(charrette_id));
create policy "ideias: parceiro edita as suas" on public.ideias for update to authenticated
  using (criado_por = (select auth.uid()) and privado.is_parceiro_ativo(charrette_id))
  with check (criado_por = (select auth.uid()) and privado.is_parceiro_ativo(charrette_id));

create policy "arquivos: parceiro lê" on public.arquivos for select to authenticated
  using (etapa in ('conteudo', 'toolbox', 'ideias') and privado.is_parceiro_ativo(charrette_id));
create policy "arquivos: parceiro envia imagem de ideia" on public.arquivos for insert to authenticated
  with check (etapa = 'ideias' and split_part(caminho, '/', 1) = (select auth.uid())::text
              and privado.is_parceiro_ativo(charrette_id));
create policy "arquivos: parceiro edita os seus" on public.arquivos for update to authenticated
  using (etapa = 'ideias' and split_part(caminho, '/', 1) = (select auth.uid())::text
         and privado.is_parceiro_ativo(charrette_id))
  with check (etapa = 'ideias' and split_part(caminho, '/', 1) = (select auth.uid())::text
              and privado.is_parceiro_ativo(charrette_id));
create policy "arquivos: parceiro apaga os seus" on public.arquivos for delete to authenticated
  using (etapa = 'ideias' and split_part(caminho, '/', 1) = (select auth.uid())::text
         and privado.is_parceiro_ativo(charrette_id));

create policy "arquivos: parceiro baixa" on storage.objects for select to authenticated
  using (bucket_id = 'charrette-arquivos'
    and privado.is_parceiro_ativo_txt((storage.foldername(name))[2])
    and ((storage.foldername(name))[1] = 'publico'
         or (storage.foldername(name))[3] in ('conteudo', 'toolbox', 'ideias')));

-- ---------------------------------------------------------------------
-- 4) Quadros incorporados (Padlet, Miro, Mentimeter…) da dinâmica
-- ---------------------------------------------------------------------
create table public.quadros (
  id            uuid primary key default gen_random_uuid(),
  charrette_id  uuid not null references public.charrettes (id) on delete cascade,
  titulo        text not null,
  url           text not null,
  ordem         int not null default 0,
  created_at    timestamptz not null default now()
);
create index quadros_charrette_idx on public.quadros (charrette_id);
alter table public.quadros enable row level security;
create policy "quadros: dono ou equipe" on public.quadros for all to authenticated
  using (privado.is_dono(charrette_id)) with check (privado.is_dono(charrette_id));
create policy "quadros: parceiro lê" on public.quadros for select to authenticated
  using (privado.is_parceiro_ativo(charrette_id));

-- ---------------------------------------------------------------------
-- 5) Catálogo de dinâmicas (Toolbox), mantido pela equipe
-- ---------------------------------------------------------------------
create table public.dinamicas (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  categoria   text,
  objetivo    text,
  duracao     text,
  pessoas     text,
  materiais   text,
  passos      text,
  fonte       text,
  fonte_url   text,
  ativo       boolean not null default true,
  ordem       int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger dinamicas_updated_at before update on public.dinamicas
  for each row execute function public.set_updated_at();
alter table public.dinamicas enable row level security;
create policy "dinamicas: ler" on public.dinamicas for select to authenticated
  using (ativo or (select privado.is_equipe()));
create policy "dinamicas: equipe cria" on public.dinamicas for insert to authenticated
  with check ((select privado.is_equipe()));
create policy "dinamicas: equipe edita" on public.dinamicas for update to authenticated
  using ((select privado.is_equipe())) with check ((select privado.is_equipe()));
create policy "dinamicas: equipe apaga" on public.dinamicas for delete to authenticated
  using ((select privado.is_equipe()));

alter table public.programa add column dinamica_id uuid references public.dinamicas (id) on delete set null;
create index programa_dinamica_idx on public.programa (dinamica_id);
