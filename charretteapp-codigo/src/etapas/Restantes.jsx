import { useState } from 'react'
import { Link } from 'react-router-dom'
import Icone from '../components/Icone'
import { Arquivos } from '../components/Arquivos'
import { Campo, Salvo } from '../components/Campos'
import { useCampo, useLista, useRegistro } from '../lib/dados'

/* ---------------- Conteúdo: programa do workshop ---------------- */
export function Conteudo() {
  const prog = useLista('programa', { ordem: 'dia' })
  if (!prog.itens) return <div className="vazio">Carregando…</div>
  const itens = [...prog.itens].sort((a, b) => a.dia - b.dia || (a.hora || '').localeCompare(b.hora || '') || a.ordem - b.ordem)
  const dias = [...new Set(itens.map(i => i.dia))]

  return (
    <div className="stack">
      <div className="card">
        <div className="card-head"><div><h3>Programa do workshop</h3><p className="muted">O cronograma dos dias de charrette, com as ferramentas de cada atividade.</p></div></div>
        {itens.length === 0 && <div className="vazio">Nenhuma atividade ainda. Comece pelo primeiro dia.</div>}
        {dias.map(dia => (
          <div key={dia} className="dia-prog">
            <h4>Dia {dia}</h4>
            {itens.filter(i => i.dia === dia).map(i => <Atividade key={i.id} a={i} atualizar={prog.atualizar} remover={prog.remover} />)}
          </div>
        ))}
        <NovaAtividade adicionar={prog.adicionar} diaPadrao={dias[dias.length - 1] || 1} />
      </div>
      <Arquivos etapa="conteudo" titulo="Material do workshop" descricao="Apresentações, roteiros e materiais de apoio." />
    </div>
  )
}

function Atividade({ a, atualizar, remover }) {
  const titulo = useCampo(a.titulo, v => v.trim() && atualizar(a.id, { titulo: v.trim() }))
  const desc = useCampo(a.descricao || '', v => atualizar(a.id, { descricao: v.trim() || null }))
  const ferr = useCampo(a.ferramenta || '', v => atualizar(a.id, { ferramenta: v.trim() || null }))
  const link = useCampo(a.link || '', v => atualizar(a.id, { link: v.trim() || null }))
  return (
    <div className="atividade">
      <input className="cell hora" type="time" defaultValue={a.hora?.slice(0, 5) || ''} onBlur={e => e.target.value !== (a.hora?.slice(0, 5) || '') && atualizar(a.id, { hora: e.target.value || null })} aria-label="Hora" />
      <div className="atividade-tx">
        <div style={{ display: 'flex', alignItems: 'center' }}><input className="cell forte" {...titulo} aria-label="Atividade" />{a.dinamica_id && <span className="tag-dinamica">Toolbox</span>}</div>
        <input className="cell muted" placeholder="Descrição (opcional)" {...desc} />
        <div className="atividade-ferr">
          <input className="cell muted" placeholder="Ferramenta (Padlet, Mentimeter…)" {...ferr} />
          <input className="cell muted" placeholder="Link (opcional)" {...link} />
          {a.link && <a className="btn ghost sm" href={a.link} target="_blank" rel="noreferrer"><Icone nome="external" tamanho={14} /> Abrir</a>}
        </div>
        {a.resumo && <p className="resumo-atividade"><b>O que saiu:</b> {a.resumo}</p>}
      </div>
      <button className="icon-btn" onClick={() => remover(a.id)} aria-label="Apagar atividade"><Icone nome="trash" tamanho={16} /></button>
    </div>
  )
}

function NovaAtividade({ adicionar, diaPadrao }) {
  const [d, setD] = useState({ dia: diaPadrao, hora: '', titulo: '' })
  const set = k => e => setD(v => ({ ...v, [k]: e.target.value }))
  async function enviar(e) {
    e.preventDefault()
    if (!d.titulo.trim()) return
    if (await adicionar({ dia: Number(d.dia) || 1, hora: d.hora || null, titulo: d.titulo.trim() })) setD(v => ({ ...v, hora: '', titulo: '' }))
  }
  return (
    <form onSubmit={enviar} className="linha-add prog">
      <select className="input" value={d.dia} onChange={set('dia')} aria-label="Dia">
        {[1, 2, 3, 4, 5, 6, 7].map(n => <option key={n} value={n}>Dia {n}</option>)}
      </select>
      <input className="input" type="time" value={d.hora} onChange={set('hora')} aria-label="Hora" />
      <input className="input" placeholder="Nova atividade (ex.: Ideação com todas as áreas)" value={d.titulo} onChange={set('titulo')} />
      <button className="btn"><Icone nome="plus" cor="#fff" tamanho={18} /> Incluir</button>
    </form>
  )
}

export function Projeto() {
  return (
    <div className="stack">
      <Arquivos etapa="projeto" titulo="Esboços e conceitos" descricao="Fotos dos esboços do workshop, croquis, diagramas e estudos." galeria />
    </div>
  )
}

/* ---------------- Conceito consolidado ---------------- */
export function Conceito() {
  const { dados, salvar, salvoEm } = useRegistro('conceito')
  const [novo, setNovo] = useState({ titulo: '', descricao: '' })
  if (!dados) return <div className="vazio">Carregando…</div>
  const pilares = Array.isArray(dados.pilares) ? dados.pilares : []

  function mudarPilar(i, patch) { salvar({ pilares: pilares.map((p, j) => (j === i ? { ...p, ...patch } : p)) }) }
  function addPilar(e) {
    e.preventDefault()
    if (!novo.titulo.trim()) return
    salvar({ pilares: [...pilares, { titulo: novo.titulo.trim(), descricao: novo.descricao.trim() }] })
    setNovo({ titulo: '', descricao: '' })
  }

  return (
    <div className="stack">
      <div className="card">
        <div className="card-head"><div><h3>O conceito</h3><p className="muted">A ideia final, em poucas palavras: nome, história e pilares.</p></div><Salvo quando={salvoEm} /></div>
        <Campo rotulo="Nome do conceito (naming)" valor={dados.nome} aoSalvar={v => salvar({ nome: v })} placeholder="Ex.: Bairro Mirante" classe="campo-naming" />
        <Campo rotulo="Storytelling" tipo="textarea" linhas={6} valor={dados.storytelling} aoSalvar={v => salvar({ storytelling: v })}
          placeholder="A história que explica o projeto: de onde vem, para quem é e o que o torna único." />
      </div>
      <div className="card">
        <h3>Pilares</h3>
        <p className="muted" style={{ marginBottom: 10 }}>Os princípios que sustentam o conceito.</p>
        <div className="pilares">
          {pilares.map((p, i) => (
            <div key={`${i}-${p.titulo}`} className="pilar">
              <span className="pilar-num">{String(i + 1).padStart(2, '0')}</span>
              <input className="cell forte" defaultValue={p.titulo} onBlur={e => e.target.value.trim() && e.target.value !== p.titulo && mudarPilar(i, { titulo: e.target.value.trim() })} />
              <textarea className="cell muted" rows={2} defaultValue={p.descricao} onBlur={e => e.target.value !== p.descricao && mudarPilar(i, { descricao: e.target.value })} />
              <button className="icon-btn" onClick={() => salvar({ pilares: pilares.filter((_, j) => j !== i) })} aria-label="Apagar pilar"><Icone nome="trash" tamanho={15} /></button>
            </div>
          ))}
        </div>
        <form onSubmit={addPilar} className="linha-add" style={{ gridTemplateColumns: '1fr 1.4fr auto' }}>
          <input className="input" placeholder="Novo pilar (ex.: Terreno a favor)" value={novo.titulo} onChange={e => setNovo(v => ({ ...v, titulo: e.target.value }))} />
          <input className="input" placeholder="Descrição (opcional)" value={novo.descricao} onChange={e => setNovo(v => ({ ...v, descricao: e.target.value }))} />
          <button className="btn"><Icone nome="plus" cor="#fff" tamanho={18} /> Incluir</button>
        </form>
      </div>
      <ChamadaConceptBook />
      <Arquivos etapa="conceito" titulo="Concept book e imagens" descricao="O caderno de conceito e as imagens que representam o projeto." galeria />
    </div>
  )
}

/* ---------------- Protótipo ---------------- */
export function Prototipo() {
  return (
    <div className="stack">
      <div className="card" style={{ background: 'var(--sand)', boxShadow: 'none' }}>
        <p className="muted" style={{ lineHeight: 1.6 }}>Envie aqui as versões do protótipo em PDF. A mais recente aparece primeiro.
          A metodologia prevê duas entregas: a primeira com concept book, storytelling, naming e protótipo; a segunda com tabela de áreas, faseamento e o ajuste final.</p>
      </div>
      <ChamadaConceptBook />
      <Arquivos etapa="prototipo" titulo="Versões do protótipo" descricao="PDFs com até 50 MB." aceitar="application/pdf,image/*" />
    </div>
  )
}

export function ChamadaConceptBook() {
  return (
    <div className="card chamada-cb">
      <div className="icobox" style={{ background: 'var(--terra)' }}><Icone nome="doc" cor="#fff" /></div>
      <div style={{ flex: 1 }}>
        <h3>Gerar o concept book</h3>
        <p className="muted">Monta um PDF com a identidade Charrette usando o que já está no app: conceito, pilares, desafio, insights, ideias aprovadas, esboços e parceiros.</p>
      </div>
      <Link className="btn terra" to="/concept-book">Abrir concept book <Icone nome="arrow" cor="#fff" tamanho={16} /></Link>
    </div>
  )
}
