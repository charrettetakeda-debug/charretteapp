-- Ajustes recomendados pelos avisos do Supabase

-- 1) Funções auxiliares das regras de acesso saem do esquema exposto pela API
create schema if not exists privado;
grant usage on schema privado to authenticated;
alter function public.is_dono(uuid) set schema privado;
alter function public.is_equipe()   set schema privado;
alter function privado.is_dono(uuid) set search_path = public;
alter function privado.is_equipe()   set search_path = public;

-- 2) auth.uid() avaliado uma vez por consulta (desempenho)
drop policy "perfil: ler o seu" on public.perfis;
drop policy "perfil: editar o seu" on public.perfis;
drop policy "charrette: dono" on public.charrettes;

create policy "perfil: ler o seu" on public.perfis
  for select to authenticated using (id = (select auth.uid()));
create policy "perfil: editar o seu" on public.perfis
  for update to authenticated using (id = (select auth.uid()))
  with check (id = (select auth.uid())
              and papel = (select p.papel from public.perfis p where p.id = (select auth.uid())));
create policy "charrette: dono" on public.charrettes
  for all to authenticated
  using (dono_id = (select auth.uid()))
  with check (dono_id = (select auth.uid()));

-- 3) Consultores: uma regra por ação
drop policy "consultores: ler" on public.consultores;
drop policy "consultores: equipe gerencia" on public.consultores;
create policy "consultores: ler" on public.consultores
  for select to authenticated using (ativo or (select privado.is_equipe()));
create policy "consultores: equipe cadastra" on public.consultores
  for insert to authenticated with check ((select privado.is_equipe()));
create policy "consultores: equipe edita" on public.consultores
  for update to authenticated using ((select privado.is_equipe())) with check ((select privado.is_equipe()));
create policy "consultores: equipe apaga" on public.consultores
  for delete to authenticated using ((select privado.is_equipe()));

-- 4) Índices nas chaves estrangeiras que faltavam
create index charrette_parceiros_consultor_idx on public.charrette_parceiros (consultor_id);
create index documentos_arquivo_idx on public.documentos (arquivo_id);
