-- Cada dinâmica tem o seu Padlet: um modelo no catálogo e o quadro da charrette
alter table public.dinamicas add column padlet_url text;
alter table public.quadros add column dinamica_id uuid references public.dinamicas (id) on delete set null;
create index quadros_dinamica_idx on public.quadros (dinamica_id);
