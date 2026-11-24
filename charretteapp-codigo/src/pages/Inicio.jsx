import { Link } from 'react-router-dom'
import Icone from '../components/Icone'
import { ListaTarefas, NovaTarefa, useTarefas } from '../components/Tarefas'
import { STATUS, formatarData, progresso } from '../lib/estrutura'
import { useCharrette } from '../lib/contexto'
import { GradeCases, useCases } from './Publico'

export function Topografia() {
  return (
    <svg className="topo" viewBox="0 0 800 300" preserveAspectRatio="xMidYMid slice" fill="none" stroke="#8A8A8A" strokeWidth="1.2">
      {Array.from({ length: 11 }, (_, i) => (
        <path key={i} d={`M-20 ${40 + i * 24} C 150 ${10 + i * 24}, 260 ${90 + i * 22}, 420 ${50 + i * 24} S 700 ${i * 26}, 820 ${60 + i * 22}`} />
      ))}
      <g transform="translate(640 90) rotate(45)" stroke="#B12C39" strokeWidth="1.6">
        <rect x="-46" y="-46" width="40" height="40" rx="5" /><rect x="6" y="-46" width="40" height="40" rx="5" />
        <rect x="-46" y="6" width="40" height="40" rx="5" /><rect x="6" y="6" width="40" height="40" rx="5" />
      </g>
    </svg>
  )
}

export default function Inicio() {
  const { atual, status, fases: FASES, todasEtapas: TODAS_ETAPAS } = useCharrette()
  const tarefasApi = useTarefas()
  const cases = useCases()

  const concluidas = TODAS_ETAPAS.filter(e => status[e.id] === 'concluido').length
  const proxima = TODAS_ETAPAS.find(e => status[e.id] === 'em_andamento') || TODAS_ETAPAS.find(e => status[e.id] !== 'concluido')
  const local = [atual.cidade, atual.uf].filter(Boolean).join('/')
  const agenda = [
    ...(atual.data_evento ? [{ titulo: 'Charrette', data: atual.data_evento, local: atual.local_evento || '', principal: true }] : []),
    ...(Array.isArray(atual.datas) ? atual.datas : []),
  ].sort((a, b) => (a.data || '9999').localeCompare(b.data || '9999'))


  return (
    <>
      <div className="hero">
        <Topografia />
        <div className="eyebrow">{[atual.nome, local].filter(Boolean).join(' · ')}</div>
        <h1>{concluidas === 0 ? 'Sua charrette começa aqui.' : concluidas === TODAS_ETAPAS.length ? 'Charrette concluída!' : 'Sua charrette, do primeiro dado ao protótipo.'}</h1>
        <p>{atual.descricao || 'Acompanhe cada etapa, guarde tudo num lugar só e saiba sempre qual é o próximo passo.'}</p>
        {proxima && (
          <div><Link className="btn terra" to={`/etapa/${proxima.id}`}>
            {status[proxima.id] === 'em_andamento' ? 'Continuar' : 'Começar'}: {proxima.titulo} <Icone nome="arrow" cor="#fff" tamanho={16} />
          </Link></div>
        )}
      </div>

      <div className="sec-title"><h2>Seu progresso</h2><span className="muted">{concluidas} de {TODAS_ETAPAS.length} etapas concluídas</span></div>
      <div className="grid-3">
        {FASES.map(f => {
          const p = progresso(f.etapas.map(e => e.id), status)
          return (
            <Link className="card phase" to={`/fase/${f.id}`} key={f.id}>
              <div className="phase-top"><span className="n">{f.num}</span><Icone nome={f.icone} cor="var(--ink-3)" /></div>
              <div><h3>{f.nome}</h3><p className="muted">{f.descricao}</p></div>
              <div className="bar"><i style={{ width: `${p}%` }} /></div>
              <span className="muted"><b className="ink">{p}%</b> · {f.etapas.length} etapas</span>
            </Link>
          )
        })}
      </div>

      <div className="split">
        <div>
          <div className="sec-title"><h2>Próximos passos</h2><Link className="muted" to="/proximos-passos">ver todos</Link></div>
          <div className="card tarefas-card">
            <NovaTarefa adicionar={tarefasApi.adicionar} />
            <ListaTarefas {...tarefasApi} limite={6} />
          </div>
        </div>
        <div>
          <div className="sec-title"><h2>Agenda</h2></div>
          <div className="card">
            {agenda.length ? (
              <div className="tl">
                {agenda.map((x, i) => (
                  <div className="it" key={i} style={i === agenda.length - 1 ? { paddingBottom: 0 } : undefined}>
                    <span className="h">{x.data ? formatarData(x.data) : 'Data a definir'}</span>
                    <b>{x.titulo}</b>
                    {x.local !== undefined && <span className="muted">{x.local || (x.principal ? 'Local a definir' : '')}</span>}
                  </div>
                ))}
                <Link className="muted" style={{ fontSize: 13 }} to="/minha-charrette">Editar datas</Link>
              </div>
            ) : (
              <div className="vazio" style={{ padding: '6px 0' }}>
                A data do evento ainda não foi definida. <Link to="/minha-charrette">Definir data</Link>
              </div>
            )}
          </div>
          <div className="sec-title"><h2>Etapas</h2></div>
          <div className="card etapas-mini">
            {TODAS_ETAPAS.map(e => {
              const s = STATUS[status[e.id] || 'a_fazer']
              return (
                <Link key={e.id} to={`/etapa/${e.id}`} className="etapa-mini">
                  <span>{e.titulo}</span><span className={`tag ${s.classe}`}>{s.rotulo}</span>
                </Link>
              )
            })}
          </div>
        </div>
      </div>

      {cases?.length > 0 && (
        <>
          <div className="sec-title"><h2>Cases</h2><a className="muted" href="/site#cases" target="_blank" rel="noreferrer">ver no site</a></div>
          <GradeCases cases={cases.slice(0, 6)} />
        </>
      )}
    </>
  )
}
