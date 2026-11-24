import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'
import { FASES } from './estrutura'

/* ---------------- Sessão (login) ---------------- */
const SessaoCtx = createContext(null)

export function SessaoProvider({ children }) {
  const [sessao, setSessao] = useState(undefined) // undefined = carregando
  const [recuperando, setRecuperando] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSessao(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((evento, s) => {
      if (evento === 'PASSWORD_RECOVERY') setRecuperando(true)
      setSessao(s)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  return (
    <SessaoCtx.Provider value={{ sessao, recuperando, setRecuperando }}>
      {children}
    </SessaoCtx.Provider>
  )
}
export const useSessao = () => useContext(SessaoCtx)

/* ---------------- Charrette atual ---------------- */
export const CharretteCtx = createContext(null)
const CHAVE_ATUAL = 'charrette:atual'

export function CharretteProvider({ children }) {
  const [lista, setLista] = useState(null)      // null = carregando
  const [atualId, setAtualId] = useState(() => {
    try { return localStorage.getItem(CHAVE_ATUAL) } catch { return null }
  })
  const [status, setStatus] = useState({})      // { etapaId: 'a_fazer' | 'em_andamento' | 'concluido' }
  const [desligadas, setDesligadas] = useState(() => new Set())
  const [erro, setErro] = useState(null)
  const [perfil, setPerfil] = useState(null)

  const [pessoas, setPessoas] = useState({})   // id -> perfil (a equipe enxerga todos)

  const [uid, setUid] = useState(null)
  const [parcerias, setParcerias] = useState([])   // convites e charrettes em que sou parceiro
  const [temFicha, setTemFicha] = useState(false)  // quem tem ficha de parceiro é parceiro

  const carregarPerfil = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser()
    setUid(u.user?.id || null)
    const [{ data }, r, f] = await Promise.all([
      supabase.from('perfis').select('*'),
      supabase.rpc('minhas_participacoes'),
      supabase.from('parceiro_ficha').select('id').eq('id', u.user?.id || '').maybeSingle(),
    ])
    const mapa = Object.fromEntries((data || []).map(p => [p.id, p]))
    setPessoas(mapa)
    setParcerias(Array.isArray(r.data) ? r.data : [])
    setTemFicha(!!f.data)
    setPerfil(mapa[u.user?.id] || {})
  }, [])
  useEffect(() => { carregarPerfil() }, [carregarPerfil])
  const ehEquipe = perfil?.papel === 'equipe'
  const equipe = Object.values(pessoas).filter(p => p.papel === 'equipe')

  const carregarLista = useCallback(async () => {
    const { data, error } = await supabase
      .from('charrettes').select('*').order('created_at', { ascending: true })
    if (error) { setErro(error.message); setLista([]); return [] }
    setLista(data)
    return data
  }, [])

  useEffect(() => { carregarLista() }, [carregarLista])

  const atual = lista?.find(c => c.id === atualId) || lista?.[0] || null

  const carregarStatus = useCallback(async () => {
    if (!atual) { setStatus({}); return }
    const { data, error } = await supabase
      .from('etapas').select('etapa,status,ativa').eq('charrette_id', atual.id)
    if (error) { setErro(error.message); return }
    setStatus(Object.fromEntries(data.map(e => [e.etapa, e.status])))
    setDesligadas(new Set(data.filter(e => e.ativa === false).map(e => e.etapa)))
  }, [atual?.id])

  useEffect(() => { carregarStatus() }, [carregarStatus])

  // Etapas ligadas nesta charrette (cada tipo de charrette usa um conjunto)
  const fases = useMemo(() => FASES.map(f => ({ ...f, etapas: f.etapas.filter(e => !desligadas.has(e.id)) }))
    .filter(f => f.etapas.length), [desligadas])
  const todasEtapas = useMemo(() => fases.flatMap(f => f.etapas), [fases])

  async function ligarEtapa(etapa, ativa) {
    setDesligadas(d => { const n = new Set(d); if (ativa) n.delete(etapa); else n.add(etapa); return n })
    const { error } = await supabase.from('etapas').update({ ativa }).eq('charrette_id', atual.id).eq('etapa', etapa)
    if (error) { carregarStatus(); throw error }
  }

  function escolher(id) {
    setAtualId(id)
    try { localStorage.setItem(CHAVE_ATUAL, id) } catch { /* sem armazenamento local */ }
  }

  async function mudarStatus(etapa, novo) {
    const anterior = status[etapa]
    setStatus(s => ({ ...s, [etapa]: novo }))
    const { error } = await supabase
      .from('etapas').update({ status: novo })
      .eq('charrette_id', atual.id).eq('etapa', etapa)
    if (error) { setStatus(s => ({ ...s, [etapa]: anterior })); throw error }
  }

  async function criar(dados) {
    const { data, error } = await supabase.from('charrettes').insert(dados).select().single()
    if (error) throw error
    await carregarLista()
    escolher(data.id)
    return data
  }

  async function atualizar(dados) {
    const { error } = await supabase.from('charrettes').update(dados).eq('id', atual.id)
    if (error) throw error
    await carregarLista()
    if ('tipo' in dados) await carregarStatus()
  }

  return (
    <CharretteCtx.Provider value={{
      lista, atual, status, erro, perfil, ehEquipe, pessoas, equipe, uid, parcerias, ehParceiro: temFicha || parcerias.length > 0, recarregarPerfil: carregarPerfil, podeGerir: true, fases, todasEtapas, desligadas, ligarEtapa, recarregarStatus: carregarStatus, escolher, mudarStatus, criar, atualizar, recarregar: carregarLista,
    }}>
      {children}
    </CharretteCtx.Provider>
  )
}
export const useCharrette = () => useContext(CharretteCtx)

/* ---------------- Avisos rápidos (toast) ---------------- */
const AvisoCtx = createContext(() => {})

export function AvisoProvider({ children }) {
  const [msg, setMsg] = useState(null)
  useEffect(() => {
    if (!msg) return
    const t = setTimeout(() => setMsg(null), 2800)
    return () => clearTimeout(t)
  }, [msg])
  return (
    <AvisoCtx.Provider value={setMsg}>
      {children}
      <div className={`toast ${msg ? 'show' : ''}`} role="status">{msg}</div>
    </AvisoCtx.Provider>
  )
}
export const useAviso = () => useContext(AvisoCtx)
