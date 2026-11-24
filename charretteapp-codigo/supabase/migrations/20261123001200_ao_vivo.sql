-- =====================================================================
-- Modo ao vivo: roteiro conduzido no telão e acompanhado no celular
-- =====================================================================
alter table public.programa
  add column duracao_min  int,
  add column resumo       text,
  add column iniciado_em  timestamptz,
  add column concluido_em timestamptz;

alter table public.charrettes
  add column ao_vivo_item   uuid references public.programa (id) on delete set null,
  add column ao_vivo_inicio timestamptz;
create index charrettes_ao_vivo_idx on public.charrettes (ao_vivo_item);

-- O que está acontecendo agora (página aberta do celular, sem login)
create or replace function public.ao_vivo_info(codigo text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'charrette', c.nome,
    'envio_publico', c.envio_publico,
    'ao_vivo', c.ao_vivo_item is not null,
    'agora', case when p.id is null then null else jsonb_build_object(
      'id', p.id, 'titulo', p.titulo, 'descricao', p.descricao, 'dia', p.dia,
      'duracao_min', p.duracao_min, 'inicio', c.ao_vivo_inicio,
      'padlet', coalesce(
        (select q.url from public.quadros q where q.charrette_id = c.id and p.dinamica_id is not null and q.dinamica_id = p.dinamica_id limit 1),
        case when p.link ilike '%padlet.com%' or p.link ilike '%miro.com%' or p.link ilike '%menti%' then p.link end),
      'passos', (select d.passos from public.dinamicas d where d.id = p.dinamica_id)) end,
    'proxima', (select n.titulo from public.programa n
                where n.charrette_id = c.id and p.id is not null and n.id <> p.id
                  and (n.dia, coalesce(n.hora, '23:59'::time), n.ordem) > (p.dia, coalesce(p.hora, '23:59'::time), p.ordem)
                order by n.dia, n.hora nulls last, n.ordem limit 1))
  from public.charrettes c
  left join public.programa p on p.id = c.ao_vivo_item
  where c.codigo_publico = codigo;
$$;
revoke execute on function public.ao_vivo_info(text) from public;
grant execute on function public.ao_vivo_info(text) to anon, authenticated;

-- Parceiro com convite aceito recebe o código para acompanhar ao vivo
create or replace function public.minhas_participacoes()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id, 'status', p.status, 'convidado_em', p.convidado_em, 'respondido_em', p.respondido_em,
    'mensagem', p.mensagem, 'area', p.area,
    'charrette', jsonb_build_object(
      'id', c.id, 'nome', c.nome, 'cidade', c.cidade, 'uf', c.uf, 'descricao', c.descricao,
      'data_evento', c.data_evento, 'local_evento', c.local_evento,
      'envio_publico', false,
      'codigo_publico', case when p.status = 'confirmado' then c.codigo_publico end,
      'ao_vivo', p.status = 'confirmado' and c.ao_vivo_item is not null,
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
