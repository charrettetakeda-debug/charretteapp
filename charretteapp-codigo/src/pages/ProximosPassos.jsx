import { ListaTarefas, NovaTarefa, useTarefas } from '../components/Tarefas'

export default function ProximosPassos() {
  const api = useTarefas()
  const pend = api.tarefas?.filter(t => !t.feito).length ?? 0
  return (
    <>
      <div className="pagehead">
        <div className="eyebrow">Acompanhamento</div>
        <h1>Próximos passos</h1>
        <p>{api.tarefas ? `${pend} pendente${pend === 1 ? '' : 's'}. ` : ''}Tudo o que precisa ser feito na sua charrette, com prazo e responsável.</p>
      </div>
      <div className="card tarefas-card" style={{ maxWidth: 820 }}>
        <NovaTarefa adicionar={api.adicionar} />
        <ListaTarefas {...api} />
      </div>
    </>
  )
}
