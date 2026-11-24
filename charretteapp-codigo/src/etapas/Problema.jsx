import { useState } from 'react'
import { Link } from 'react-router-dom'
import Icone from '../components/Icone'
import { Campo, Salvo } from '../components/Campos'
import { useCampo, useLista, useRegistro } from '../lib/dados'

export default function Problema() {
  const { dados, salvar, salvoEm } = useRegistro('problema')
  const concl = useLista('conclusoes', { ordem: 'ordem' })
  if (!dados) return <div className="vazio">Carregando…</div>

  return (
    <div className="split">
      <div className="stack">
        <div className="card">
          <div className="card-head"><div><h3>O desafio da charrette</h3><p className="muted">Uma frase que resume o problema a ser resolvido no workshop.</p></div><Salvo quando={salvoEm} /></div>
          <Campo tipo="textarea" linhas={3} classe="campo-desafio" valor={dados.desafio} aoSalvar={v => salvar({ desafio: v })}
            placeholder="Como podemos criar um loteamento de lotes de 200 m² que venda rápido para famílias jovens, num terreno com declive acentuado?" />
          <p className="dica">Dica: comece com “Como podemos…” e inclua o público, o produto e a principal restrição.</p>
        </div>

        <div className="card">
          <h3>Conclusões da pré-charrette</h3>
          <p className="muted" style={{ marginBottom: 8 }}>O que a pesquisa, a coleta e a entrevista mostraram.</p>
          {concl.itens?.length === 0 && <div className="vazio">Nenhuma conclusão ainda.</div>}
          {concl.itens?.map(c => <Conclusao key={c.id} c={c} atualizar={concl.atualizar} remover={concl.remover} />)}
          <NovaConclusao adicionar={concl.adicionar} ordem={(concl.itens?.length || 0) + 1} />
        </div>
      </div>

      <div className="card insights">
        <div className="card-head" style={{ marginBottom: 8 }}><div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Icone nome="spark" cor="#3E6A8F" /><h3 style={{ margin: 0 }}>Insights</h3></div><span className="tag ai">Em breve</span></div>
        <p className="muted" style={{ lineHeight: 1.6 }}>
          Aqui vão aparecer insights automáticos a partir do que foi preenchido na pesquisa, na coleta e na entrevista.
        </p>
        <p className="muted" style={{ lineHeight: 1.6, marginTop: 10 }}>Enquanto isso, quanto mais completas estiverem essas etapas, melhores serão os insights:</p>
        <div className="atalhos">
          <Link to="/etapa/pesquisa">Pesquisa <Icone nome="arrow" tamanho={14} /></Link>
          <Link to="/etapa/coleta">Coleta de informações <Icone nome="arrow" tamanho={14} /></Link>
          <Link to="/etapa/entrevista">Entrevista <Icone nome="arrow" tamanho={14} /></Link>
        </div>
      </div>
    </div>
  )
}

function Conclusao({ c, atualizar, remover }) {
  const titulo = useCampo(c.titulo, v => v.trim() && atualizar(c.id, { titulo: v.trim() }))
  const desc = useCampo(c.descricao || '', v => atualizar(c.id, { descricao: v.trim() || null }))
  return (
    <div className="conclusao">
      <span className="check on"><Icone nome="check" cor="#fff" tamanho={14} /></span>
      <div style={{ flex: 1 }}>
        <input className="cell forte" {...titulo} />
        <input className="cell muted" placeholder="Detalhe (opcional)" {...desc} />
      </div>
      <button className="icon-btn" onClick={() => remover(c.id)} aria-label="Apagar conclusão"><Icone nome="trash" tamanho={16} /></button>
    </div>
  )
}

function NovaConclusao({ adicionar, ordem }) {
  const [t, setT] = useState('')
  async function enviar(e) {
    e.preventDefault()
    if (!t.trim()) return
    if (await adicionar({ titulo: t.trim(), ordem })) setT('')
  }
  return (
    <form onSubmit={enviar} className="nova-tarefa" style={{ marginTop: 10 }}>
      <div className="linha">
        <input className="input" placeholder="Nova conclusão (ex.: O preço é o fator decisivo)" value={t} onChange={e => setT(e.target.value)} />
        <button className="btn" aria-label="Adicionar"><Icone nome="plus" cor="#fff" tamanho={18} /></button>
      </div>
    </form>
  )
}
