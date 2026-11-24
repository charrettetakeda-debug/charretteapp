import { Link, Navigate, useParams } from 'react-router-dom'
import Icone from '../components/Icone'
import { STATUS, progresso } from '../lib/estrutura'
import { useCharrette } from '../lib/contexto'

const corIcone = { concluido: ['var(--green-soft)', 'var(--green)'], em_andamento: ['var(--gold-soft)', '#8a6418'], a_fazer: ['var(--sand)', 'var(--ink-2)'] }

export default function Fase() {
  const { faseId } = useParams()
  const { status, fases } = useCharrette()
  const f = fases.find(x => x.id === faseId)
  if (!f) return <Navigate to="/" replace />
  const p = progresso(f.etapas.map(e => e.id), status)

  return (
    <>
      <div className="pagehead">
        <div className="eyebrow">Fase {f.num}</div>
        <h1>{f.nome}</h1>
        <p>{f.descricao}</p>
      </div>
      <div className="card progress-card">
        <div style={{ flex: 1 }}><div className="bar"><i style={{ width: `${p}%` }} /></div></div>
        <b>{p}%</b>
      </div>
      <div className="steplist">
        {f.etapas.map(e => {
          const s = status[e.id] || 'a_fazer'
          const [bg, fg] = corIcone[s]
          return (
            <Link className="steprow" to={`/etapa/${e.id}`} key={e.id}>
              <div className="icobox" style={{ background: bg }}><Icone nome={e.icone} cor={fg} /></div>
              <div className="tx"><b>{e.titulo}</b><span className="muted">{e.descricao}</span></div>
              <span className={`tag ${STATUS[s].classe}`}>{STATUS[s].rotulo}</span>
            </Link>
          )
        })}
      </div>
    </>
  )
}
