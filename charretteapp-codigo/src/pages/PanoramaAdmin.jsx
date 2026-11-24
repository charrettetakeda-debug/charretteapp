import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useCharrette } from '../lib/contexto'
import { TODAS_ETAPAS, formatarData, progresso } from '../lib/estrutura'
import { useTipos } from '../lib/tipos'

/** Visão geral de todas as charrettes, para a equipe */
export default function PanoramaAdmin() {
  const { ehEquipe, perfil, lista, pessoas, escolher } = useCharrette()
  const navigate = useNavigate()
  const { tipos } = useTipos()
  const [etapas, setEtapas] = useState(null)
  const [ideias, setIdeias] = useState({})
  const [busca, setBusca] = useState('')

  useEffect(() => {
    supabase.from('etapas').select('charrette_id,etapa,status,ativa').then(({ data }) => {
      const m = {}
      ;(data || []).forEach(e => { if (e.ativa !== false) (m[e.charrette_id] ||= {})[e.etapa] = e.status })
      setEtapas(m)
    })
    supabase.from('ideias').select('charrette_id,status').then(({ data }) => {
      const m = {}
      ;(data || []).forEach(i => {
        const x = (m[i.charrette_id] ||= { total: 0, a_avaliar: 0 })
        x.total++; if (i.status === 'a_avaliar') x.a_avaliar++
      })
      setIdeias(m)
    })
  }, [])

  if (perfil && !ehEquipe) return <Navigate to="/" replace />

  const q = busca.trim().toLowerCase()
  const linhas = (lista || []).filter(c => !q || [c.nome, c.cidade, pessoas[c.dono_id]?.nome].some(t => t?.toLowerCase().includes(q)))

  const nomeTipo = id => tipos?.find(t => t.id === id)?.nome

  function abrir(c) { escolher(c.id); navigate('/') }

  return (
    <>
      <div className="pagehead">
        <div className="eyebrow">Administração</div>
        <h1>Todas as charrettes</h1>
        <p>{lista?.length || 0} charrette{lista?.length === 1 ? '' : 's'}. Clique numa linha para abrir.</p>
      </div>
      <input className="input" style={{ maxWidth: 360, marginBottom: 14 }} placeholder="Buscar por nome, cidade ou cliente…" value={busca} onChange={e => setBusca(e.target.value)} />
      <div className="card" style={{ padding: 8 }}>
        <div className="table-wrap">
          <table className="tabela">
            <thead><tr><th>Charrette</th><th>Tipo</th><th>Cliente</th><th>Cidade</th><th>Evento</th><th>Progresso</th><th className="r">Ideias</th></tr></thead>
            <tbody>
              {linhas.map(c => {
                const st = etapas?.[c.id] || {}
                const p = progresso(TODAS_ETAPAS.map(e => e.id).filter(id => id in st), st)
                const id = ideias[c.id]
                return (
                  <tr key={c.id} className="linha-clicavel" onClick={() => abrir(c)}>
                    <td><b>{c.nome}</b></td>
                    <td>{nomeTipo(c.tipo) || <span className="muted">Completa</span>}</td>
                    <td>{pessoas[c.dono_id]?.papel !== 'equipe' && pessoas[c.dono_id]?.nome ? pessoas[c.dono_id].nome : <span className="muted">—</span>}</td>
                    <td>{[c.cidade, c.uf].filter(Boolean).join('/') || <span className="muted">—</span>}</td>
                    <td>{c.data_evento ? formatarData(c.data_evento) : <span className="muted">—</span>}</td>
                    <td style={{ minWidth: 140 }}><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><div className="bar" style={{ flex: 1 }}><i style={{ width: `${p}%` }} /></div><span className="muted">{p}%</span></div></td>
                    <td className="r">{id ? <>{id.total}{id.a_avaliar ? <span className="selo" style={{ marginLeft: 6 }}>{id.a_avaliar} a avaliar</span> : null}</> : <span className="muted">0</span>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {linhas.length === 0 && <div className="vazio">Nenhuma charrette encontrada.</div>}
        </div>
      </div>
    </>
  )
}
