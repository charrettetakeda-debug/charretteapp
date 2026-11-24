import FormCharrette from '../components/FormCharrette'
import { FASES } from '../lib/estrutura'
import { useAviso, useCharrette } from '../lib/contexto'

export default function MinhaCharrette() {
  const { atual, atualizar, desligadas, ligarEtapa } = useCharrette()
  const avisar = useAviso()

  async function salvar(dados) {
    await atualizar(dados)
    avisar('Dados salvos.')
  }

  return (
    <>
      <div className="pagehead">
        <div className="eyebrow">Configurações</div>
        <h1>Dados da charrette</h1>
        <p>Essas informações aparecem na tela inicial e na agenda.</p>
      </div>
      <div className="card" style={{ maxWidth: 720 }}>
        <FormCharrette key={`${atual.id}-${atual.tipo}`} inicial={atual} aoSalvar={salvar} />
      </div>
      <div className="card" style={{ maxWidth: 720, marginTop: 16 }}>
        <h3>Etapas desta charrette</h3>
        <p className="muted" style={{ marginBottom: 12 }}>O tipo de charrette já liga as etapas certas. Aqui dá para ajustar só esta charrette: etapas desligadas somem do menu e do progresso, mas o que foi preenchido fica guardado.</p>
        {FASES.map(f => (
          <div key={f.id} className="etapas-liga">
            <b>{f.num} · {f.nome}</b>
            {f.etapas.map(e => (
              <label key={e.id} className="liga-etapa">
                <input type="checkbox" checked={!desligadas.has(e.id)} onChange={async ev => {
                  try { await ligarEtapa(e.id, ev.target.checked) } catch { avisar('Não foi possível salvar.') }
                }} />
                <span>{e.titulo}<small className="muted"> · {e.descricao}</small></span>
              </label>
            ))}
          </div>
        ))}
      </div>
    </>
  )
}
