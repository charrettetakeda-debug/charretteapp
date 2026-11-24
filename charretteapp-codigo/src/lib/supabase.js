import { createClient } from '@supabase/supabase-js'

// A chave "publishable" é pública por natureza: a segurança fica nas regras (RLS) do banco.
const url = import.meta.env.VITE_SUPABASE_URL || 'https://hkiucqigomygfledqtcp.supabase.co'
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_vPtb9nzb8cEXI_enxyXizA_73-Uyert'

export const supabase = createClient(url, key)
