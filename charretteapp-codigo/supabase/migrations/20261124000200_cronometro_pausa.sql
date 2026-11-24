-- Pausar o cronômetro do modo ao vivo (telão e celulares)
alter table public.charrettes add column if not exists ao_vivo_pausa timestamptz;
-- ao_vivo_info passa a devolver 'pausa' (ver função completa em 20261123001200_ao_vivo.sql)
