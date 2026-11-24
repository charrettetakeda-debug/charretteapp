import { Link, Navigate, useParams } from 'react-router-dom'
import Icone from '../components/Icone'
import { ListaTarefas, NovaTarefa, useTarefas } from '../components/Tarefas'
import { ETAPAS, STATUS } from '../lib/estrutura'
import { useAviso, useCharrette } from '../lib/contexto'
import '../etapas.css'
import Pesquisa from '../etapas/Pesquisa'
import Coleta from '../etapas/Coleta'
import Entrevista from '../etapas/Entrevista'
import Problema from '../etapas/Problema'
import Briefing from '../etapas/Briefing'
import Parceiros from '../etapas/Parceiros'
import Ideias from '../etapas/Ideias'
import { Conceito, Conteudo, Projeto, Prototipo } from '../etapas/Restantes'
import Toolbox from '../etapas/Toolbox'
import ChamadaAoVivo from '../components/ChamadaAoVivo'
import '../toolbox.css'

// Conteúdo próprio de cada etapa (as que ainda não estão aqui mostram o aviso "em breve")
const CONTEUDO = {
  pesquisa: Pesquisa, coleta: Coleta, entrevista: Entrevista, problema: Problema, briefing: Briefing, parceiros: Parceiros,
  conteudo: Conteudo, dinamica: Ideias, toolbox: Toolbox, projeto: Projeto, conceito: Conceito, prototipo: Prototipo,
}
const TITULO_TAREFAS = { briefing: 'Encaminhamentos' }

export default function Etapa() {
  const { etapaId } = useParams()
  const e = ETAPAS[etapaId]
  if (!e) return <Navigate to="/" replace />
  return <EtapaConteudo key={etapaId} e={e} />
}

function EtapaConteudo({ e }) {
  const { status, mudarStatus, todasEtapas: TODAS_ETAPAS, desligadas, ligarEtapa } = useCharrette()
  const avisar = useAviso()
  const tarefasApi = useTarefas(e.id)
  const s = status[e.id] || 'a_fazer'
  const i = TODAS_ETAPAS.findIndex(x => x.id === e.id)
  const proxima = TODAS_ETAPAS[i + 1]
  const Conteudo = CONTEUDO[e.id]

  async function trocar(novo) {
    try { await mudarStatus(e.id, novo) } catch { avisar('Não foi possível salvar o status.') }
  }

  const tarefas = (
    <div className="card tarefas-card">
      <h3 style={{ marginBottom: 4 }}>{TITULO_TAREFAS[e.id] || 'Próximos passos desta etapa'}</h3>
      <p className="muted" style={{ marginBottom: 10 }}>{TITULO_TAREFAS[e.id] ? 'Quem faz o quê, e até quando.' : 'O que falta fazer aqui. Também aparece na tela inicial.'}</p>
      <NovaTarefa adicionar={tarefasApi.adicionar} etapaFixa={e.id} />
      <ListaTarefas {...tarefasApi} mostrarEtapa={false} />
    </div>
  )

  return (
    <>
      <div className="pagehead">
        <div className="eyebrow">{e.fase.num} · {e.fase.nome}</div>
        <h1>{e.titulo}</h1>
        <p>{e.descricao}</p>
        {desligadas.has(e.id) && (
          <div className="alerta erro" style={{ margin: '10px 0', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            Esta etapa está desligada nesta charrette (não aparece no menu nem no progresso).
            <button className="btn ghost sm" onClick={() => ligarEtapa(e.id, true).catch(() => avisar('Não foi possível ligar.'))}>Ligar etapa</button>
          </div>
        )}
        <div className="status-seg" role="group" aria-label="Status da etapa">
          {Object.entries(STATUS).map(([k, v]) => (
            <button key={k} className={`${v.classe} ${s === k ? 'on' : ''}`} onClick={() => trocar(k)}>{v.rotulo}</button>
          ))}
        </div>
      </div>

      {Conteudo ? (
        <>
          {['conteudo', 'dinamica', 'toolbox'].includes(e.id) && <ChamadaAoVivo />}
          <Conteudo />
          <div style={{ marginTop: 18 }}>{tarefas}</div>
        </>
      ) : (
        <div className="split">
          <div className="card em-breve">
            <div className="icobox" style={{ background: 'var(--sand)' }}><Icone nome={e.icone} cor="var(--ink-2)" /></div>
            <h3>Conteúdo desta etapa</h3>
            <p className="muted">Os campos de {e.titulo.toLowerCase()} entram nas próximas atualizações. Por enquanto, use os próximos passos ao lado para organizar o que precisa ser feito.</p>
          </div>
          <div>{tarefas}</div>
        </div>
      )}

      {s !== 'concluido' && Conteudo && (
        <div className="concluir">
          <span className="muted">Terminou esta etapa?</span>
          <button className="btn ghost" onClick={() => trocar('concluido')}><Icone nome="check" tamanho={16} /> Marcar como concluída</button>
        </div>
      )}

      {proxima && (
        <div className="next-step">
          <Link className="btn ghost" to={`/etapa/${proxima.id}`}>Próxima etapa: {proxima.titulo} <Icone nome="arrow" tamanho={16} /></Link>
        </div>
      )}
    </>
  )
}
