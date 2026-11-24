import { useState } from 'react'
import Icone from '../components/Icone'
import { Campo, Salvo } from '../components/Campos'
import { useLista, useRegistro } from '../lib/dados'

const VELOCIDADE = { alta: 'Alta', media: 'Média', baixa: 'Baixa' }

export default function Pesquisa() {
  const { dados, salvar, salvoEm } = useRegistro('pesquisa')
  const conc = useLista('concorrentes')

  if (!dados) return <div className="vazio">Carregando…</div>

  return (
    <div className="stack">
      <div className="card">
        <div className="card-head"><div><h3>A cidade em números</h3><p className="muted">Dados que ajudam a entender o lugar e a demanda.</p></div><Salvo quando={salvoEm} /></div>
        <div className="grid-5">
          <Campo rotulo="População" tipo="number" valor={dados.populacao} aoSalvar={v => salvar({ populacao: v == null ? null : Math.round(v) })} placeholder="Ex.: 118000" />
          <Campo rotulo="Crescimento ao ano" tipo="number" sufixo="%" valor={dados.crescimento_pct} aoSalvar={v => salvar({ crescimento_pct: v })} placeholder="1,4" />
          <Campo rotulo="Renda média familiar" tipo="number" prefixo="R$" valor={dados.renda_media} aoSalvar={v => salvar({ renda_media: v })} placeholder="5200" />
          <Campo rotulo="Lotes à venda na região" tipo="number" valor={dados.lotes_a_venda} aoSalvar={v => salvar({ lotes_a_venda: v == null ? null : Math.round(v) })} placeholder="340" />
          <Campo rotulo="Preço médio do m²" tipo="number" prefixo="R$" valor={dados.preco_m2} aoSalvar={v => salvar({ preco_m2: v })} placeholder="410" />
        </div>
        <Fontes valor={dados.fontes || []} aoSalvar={fontes => salvar({ fontes })} />
      </div>

      <div className="card">
        <div className="card-head"><div><h3>Concorrentes</h3><p className="muted">Quem mais está vendendo produtos parecidos na região (ex.: lotes de 200 m²).</p></div></div>
        <TabelaConcorrentes {...conc} />
      </div>

      <div className="card">
        <Campo rotulo="Anotações da pesquisa" tipo="textarea" linhas={6} valor={dados.anotacoes} aoSalvar={v => salvar({ anotacoes: v })}
          placeholder="O que a pesquisa mostrou? Onde está a demanda, quais faixas de preço vendem mais, o que falta no mercado…" />
      </div>
    </div>
  )
}

function Fontes({ valor, aoSalvar }) {
  const [nova, setNova] = useState('')
  function adicionar(e) {
    e.preventDefault()
    const f = nova.trim()
    if (!f || valor.includes(f)) return setNova('')
    aoSalvar([...valor, f]); setNova('')
  }
  return (
    <div className="campo" style={{ marginBottom: 0 }}>
      Fontes consultadas
      <div className="chips">
        {valor.map(f => (
          <span className="chip" key={f}>{f}<button type="button" onClick={() => aoSalvar(valor.filter(x => x !== f))} aria-label={`Remover ${f}`}>×</button></span>
        ))}
        <form onSubmit={adicionar} className="chip-add">
          <input className="input" value={nova} onChange={e => setNova(e.target.value)} placeholder="IBGE, prefeitura, portais… (Enter)" />
        </form>
      </div>
    </div>
  )
}

const vazio = { nome: '', bairro: '', area_lote_m2: '', lotes: '', preco_medio: '', velocidade: '' }
export const num = v => {
  if (v === '' || v == null) return null
  const n = Number(String(v).replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function TabelaConcorrentes({ itens, adicionar, atualizar, remover }) {
  const [novo, setNovo] = useState(vazio)
  const set = k => e => setNovo(v => ({ ...v, [k]: e.target.value }))

  async function incluir(e) {
    e.preventDefault()
    if (!novo.nome.trim()) return
    const ok = await adicionar({
      nome: novo.nome.trim(), bairro: novo.bairro.trim() || null, area_lote_m2: num(novo.area_lote_m2),
      lotes: num(novo.lotes), preco_medio: num(novo.preco_medio), velocidade: novo.velocidade || null,
    })
    if (ok) setNovo(vazio)
  }

  if (!itens) return <div className="vazio">Carregando…</div>
  return (
    <div className="table-wrap">
      <table className="tabela">
        <thead><tr><th>Empreendimento</th><th>Bairro</th><th className="r">Lote (m²)</th><th className="r">Lotes</th><th className="r">Preço médio (R$)</th><th>Venda</th><th /></tr></thead>
        <tbody>
          {itens.map(c => (
            <tr key={c.id}>
              <td><Celula valor={c.nome} aoSalvar={v => v && atualizar(c.id, { nome: v })} forte /></td>
              <td><Celula valor={c.bairro} aoSalvar={v => atualizar(c.id, { bairro: v || null })} /></td>
              <td className="r"><Celula valor={c.area_lote_m2} num aoSalvar={v => atualizar(c.id, { area_lote_m2: num(v) })} /></td>
              <td className="r"><Celula valor={c.lotes} num aoSalvar={v => atualizar(c.id, { lotes: num(v) })} /></td>
              <td className="r"><Celula valor={c.preco_medio} num aoSalvar={v => atualizar(c.id, { preco_medio: num(v) })} /></td>
              <td>
                <select className={`cell-select vel-${c.velocidade || 'x'}`} value={c.velocidade || ''} onChange={e => atualizar(c.id, { velocidade: e.target.value || null })}>
                  <option value="">—</option>{Object.entries(VELOCIDADE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </td>
              <td className="r"><button className="icon-btn" onClick={() => remover(c.id)} aria-label="Apagar concorrente"><Icone nome="trash" tamanho={16} /></button></td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="nova-linha">
            <td><input form="novo-conc" className="input" placeholder="Novo concorrente" value={novo.nome} onChange={set('nome')} /></td>
            <td><input form="novo-conc" className="input" placeholder="Bairro" value={novo.bairro} onChange={set('bairro')} /></td>
            <td><input form="novo-conc" className="input r" inputMode="decimal" placeholder="200" value={novo.area_lote_m2} onChange={set('area_lote_m2')} /></td>
            <td><input form="novo-conc" className="input r" inputMode="numeric" placeholder="120" value={novo.lotes} onChange={set('lotes')} /></td>
            <td><input form="novo-conc" className="input r" inputMode="decimal" placeholder="79000" value={novo.preco_medio} onChange={set('preco_medio')} /></td>
            <td>
              <select form="novo-conc" className="input" value={novo.velocidade} onChange={set('velocidade')}>
                <option value="">—</option>{Object.entries(VELOCIDADE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </td>
            <td><form id="novo-conc" onSubmit={incluir}><button className="btn" aria-label="Adicionar concorrente"><Icone nome="plus" cor="#fff" tamanho={18} /></button></form></td>
          </tr>
        </tfoot>
      </table>
      {itens.length === 0 && <p className="muted" style={{ marginTop: 8 }}>Nenhum concorrente ainda. Preencha a linha acima e clique em +.</p>}
    </div>
  )
}

function Celula({ valor, aoSalvar, num: ehNum, forte }) {
  const formatar = x => (x == null ? '' : ehNum ? Number(x).toLocaleString('pt-BR') : String(x))
  const [editando, setEditando] = useState(false)
  const [v, setV] = useState('')
  return (
    <input className={`cell ${forte ? 'forte' : ''} ${ehNum ? 'r' : ''}`}
      value={editando ? v : formatar(valor)}
      placeholder="—" inputMode={ehNum ? 'decimal' : undefined}
      onFocus={() => { setEditando(true); setV(valor == null ? '' : String(valor).replace('.', ehNum ? ',' : '.')) }}
      onChange={e => setV(e.target.value)}
      onBlur={() => {
        setEditando(false)
        const novo = v.trim()
        const antigo = valor == null ? '' : String(valor).replace('.', ehNum ? ',' : '.')
        if (novo !== antigo) aoSalvar(novo)
      }} />
  )
}
