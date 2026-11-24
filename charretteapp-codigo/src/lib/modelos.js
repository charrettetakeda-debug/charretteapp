import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export function useModelos() {
  const [modelos, setModelos] = useState(null)
  const carregar = () => supabase.from('modelos_perguntas').select('*').order('ordem').order('created_at')
    .then(({ data }) => setModelos(data || []))
  useEffect(() => { carregar() }, [])
  return { modelos, setModelos, recarregar: carregar }
}

// Junta as perguntas de vários modelos, na ordem, sem repetir
export function juntarModelos(modelos, ids) {
  const lista = []
  for (const m of modelos.filter(x => ids.includes(x.id))) for (const p of m.perguntas || []) if (!lista.includes(p)) lista.push(p)
  return lista
}
