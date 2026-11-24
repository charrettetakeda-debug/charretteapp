-- Modelos de perguntas da entrevista (ideia da Leticia) e importação do Padlet.
-- Só acrescenta: nada é apagado.

create table if not exists public.modelos_perguntas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  descricao text,
  perguntas text[] not null default '{}',   -- ids de public.perguntas, na ordem
  ordem integer not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.modelos_perguntas enable row level security;
create policy "modelos: ler" on public.modelos_perguntas for select to authenticated using (true);
create policy "modelos: equipe cria" on public.modelos_perguntas for insert to authenticated with check ((select privado.is_equipe()));
create policy "modelos: equipe edita" on public.modelos_perguntas for update to authenticated using ((select privado.is_equipe())) with check ((select privado.is_equipe()));
create policy "modelos: equipe apaga" on public.modelos_perguntas for delete to authenticated using ((select privado.is_equipe()));
grant select, insert, update, delete on public.modelos_perguntas to authenticated;

-- cada tipo de charrette sugere um modelo
alter table public.tipos_charrette add column if not exists modelo_id uuid references public.modelos_perguntas(id) on delete set null;

-- perguntas desta charrette (null = usa o modelo do tipo)
alter table public.entrevista
  add column if not exists perguntas_ids text[],
  add column if not exists perguntas_extras jsonb not null default '[]'::jsonb,
  add column if not exists modelos uuid[] not null default '{}';

-- só a equipe ajusta as perguntas de uma charrette
create or replace function privado.proteger_entrevista() returns trigger
language plpgsql set search_path = public as $$
begin
  if privado.is_equipe() then return new; end if;
  if tg_op = 'UPDATE' then
    new.perguntas_ids := old.perguntas_ids;
    new.perguntas_extras := old.perguntas_extras;
    new.modelos := old.modelos;
  else
    new.perguntas_ids := null;
    new.perguntas_extras := '[]'::jsonb;
    new.modelos := '{}';
  end if;
  return new;
end $$;
create trigger proteger_entrevista before insert or update on public.entrevista
  for each row execute function privado.proteger_entrevista();

-- um modelo por tipo, com as mesmas perguntas que cada tipo usa hoje
do $$
declare t record; novo uuid;
begin
  for t in select * from public.tipos_charrette order by ordem loop
    insert into public.modelos_perguntas (nome, descricao, perguntas, ordem)
    values (
      t.nome,
      'Modelo inicial, com as perguntas que o tipo "' || t.nome || '" já usava.',
      coalesce((select array_agg(p.id order by p.ordem) from public.perguntas p
                where p.ativo and (p.tipos is null or cardinality(p.tipos) = 0 or t.id = any(p.tipos))), '{}'),
      t.ordem)
    returning id into novo;
    update public.tipos_charrette set modelo_id = novo where id = t.id;
  end loop;
end $$;

-- importação do Padlet: evita importar o mesmo post duas vezes
alter table public.ideias add column if not exists externo_id text;
create unique index if not exists ideias_externo_uk on public.ideias (charrette_id, externo_id) where externo_id is not null;
