import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export function useTipos() {
  const [tipos, setTipos] = useState(null)
  const carregar = () => supabase.from('tipos_charrette').select('*').order('ordem')
    .then(({ data }) => setTipos(data || []))
  useEffect(() => { carregar() }, [])
  return { tipos, recarregar: carregar }
}
