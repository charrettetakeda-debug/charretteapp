-- Datas livres da charrette: [{titulo, data, local}]
alter table public.charrettes add column if not exists datas jsonb not null default '[]'::jsonb;
