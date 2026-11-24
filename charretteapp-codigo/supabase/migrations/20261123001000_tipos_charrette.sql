-- =====================================================================
-- Tipos de charrette: cada tipo liga só as etapas que fazem sentido e
-- escolhe as perguntas da entrevista. Ajuste fino por charrette.
-- =====================================================================

create table public.tipos_charrette (
  id          text primary key,
  nome        text not null,
  descricao   text,
  etapas      text[] not null default '{}',
  ordem       int not null default 0,
  ativo       boolean not null default true,
  created_at  timestamptz not null default now()
);
alter table public.tipos_charrette enable row level security;
create policy "tipos: ler" on public.tipos_charrette for select to authenticated using (true);
create policy "tipos: equipe cria" on public.tipos_charrette for insert to authenticated
  with check ((select privado.is_equipe()));
create policy "tipos: equipe edita" on public.tipos_charrette for update to authenticated
  using ((select privado.is_equipe())) with check ((select privado.is_equipe()));
create policy "tipos: equipe apaga" on public.tipos_charrette for delete to authenticated
  using ((select privado.is_equipe()));

insert into public.tipos_charrette (id, nome, descricao, etapas, ordem) values
('loteamento', 'Loteamento / bairro', 'Projeto urbano para loteadora ou incorporadora, com imersão de vários dias.',
 array['pesquisa','coleta','entrevista','problema','briefing','parceiros','conteudo','dinamica','toolbox','projeto','conceito','prototipo'], 1),
('espaco_publico', 'Espaço público', 'Praça, parque ou centro da cidade, com prefeitura e comunidade.',
 array['pesquisa','coleta','entrevista','problema','briefing','parceiros','conteudo','dinamica','toolbox','projeto','conceito','prototipo'], 2),
('produto', 'Produto / empreendimento', 'Conceito de produto imobiliário ou de negócio.',
 array['pesquisa','entrevista','problema','briefing','parceiros','conteudo','dinamica','toolbox','projeto','conceito','prototipo'], 3),
('charrette_day', 'Charrette Day (evento)', 'Workshop curto dentro de um evento, com participantes do público.',
 array['problema','briefing','parceiros','conteudo','dinamica','toolbox','conceito'], 4);

alter table public.charrettes add column tipo text references public.tipos_charrette (id) on delete set null;
create index charrettes_tipo_idx on public.charrettes (tipo);
alter table public.etapas add column ativa boolean not null default true;
alter table public.perguntas add column tipos text[];   -- vazio ou nulo = vale para todos os tipos

-- Ao escolher (ou trocar) o tipo, liga e desliga as etapas conforme o modelo
create or replace function privado.aplicar_tipo()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.tipo is not distinct from old.tipo then return new; end if;
  if new.tipo is null then
    update public.etapas set ativa = true where charrette_id = new.id;
  else
    update public.etapas e set ativa = (e.etapa = any (t.etapas))
    from public.tipos_charrette t
    where t.id = new.tipo and e.charrette_id = new.id;
  end if;
  return new;
end $$;
-- o nome começa depois de "ao_criar_charrette" para rodar depois que as etapas existem
create trigger ao_definir_tipo after insert or update of tipo on public.charrettes
  for each row execute function privado.aplicar_tipo();
