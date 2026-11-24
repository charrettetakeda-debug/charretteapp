import { useEffect, useMemo, useState } from 'react'
import Icone from '../components/Icone'
import { Arquivos } from '../components/Arquivos'
import { linkIncorporavel } from '../components/Quadros'
import { minutosDe } from '../lib/aovivo'
import { supabase } from '../lib/supabase'
import { useAviso, useCharrette } from '../lib/contexto'
import '../toolbox.css'
import '../ideias.css'

const ICONE_CATEGORIA = {
  Abertura: 'users', Entendimento: 'search', Empatia: 'heart', Ideação: 'bulb', Projeto: 'map',
  Compartilhar: 'grid', Priorização: 'target', Energia: 'spark', Fechamento: 'flag',
}

export default function Toolbox() {
  const { atual, ehEquipe, podeGerir } = useCharrette()
  const avisar = useAviso()
  const [dinamicas, setDinamicas] = useState(null)
  const [programa, setPrograma] = useState([])
  const [quadros, setQuadros] = useState([])
  const [categoria, setCategoria] = useState('')
  const [busca, setBusca] = useState('')
  const [aberta, setAberta] = useState(null)
  const [adicionando, setAdicionando] = useState(null)
  const [editando, setEditando] = useState(null)

  async function carregar() {
    const [{ data: d }, { data: p }, { data: q }] = await Promise.all([
      supabase.from('dinamicas').select('*').order('ordem').order('nome'),
      supabase.from('programa').select('id,dia,hora,dinamica_id').eq('charrette_id', atual.id).not('dinamica_id', 'is', null),
      supabase.from('quadros').select('*').eq('charrette_id', atual.id).not('dinamica_id', 'is', null),
    ])
    setDinamicas(d || [])
    setPrograma(p || [])
    setQuadros(q || [])
  }
  useEffect(() => { carregar() }, [atual.id])

  const categorias = useMemo(() => [...new Set((dinamicas || []).map(d => d.categoria).filter(Boolean))], [dinamicas])
  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return (dinamicas || []).filter(d => (!categoria || d.categoria === categoria)
      && (!q || [d.nome, d.objetivo, d.categoria, d.passos].some(t => t?.toLowerCase().includes(q))))
  }, [dinamicas, categoria, busca])

  if (!dinamicas) return <div className="vazio">Carregando dinâmicas…</div>

  async function adicionar(d, { dia, hora }) {
    const { error } = await supabase.from('programa').insert({
      charrette_id: atual.id, dia: Number(dia) || 1, hora: hora || null, titulo: d.nome,
      descricao: d.objetivo, ferramenta: [d.padlet_url ? 'Padlet' : 'Dinâmica', d.duracao].filter(Boolean).join(' · '),
      link: d.padlet_url || d.fonte_url || null, dinamica_id: d.id, duracao_min: minutosDe(d.duracao),
    })
    if (error) return avisar('Não foi possível adicionar.')
    // o Padlet modelo da dinâmica vira o quadro desta charrette
    if (d.padlet_url && !quadros.some(q => q.dinamica_id === d.id)) {
      await supabase.from('quadros').insert({ charrette_id: atual.id, titulo: d.nome, url: linkIncorporavel(d.padlet_url), dinamica_id: d.id })
    }
    avisar(`"${d.nome}" entrou no programa (Conteúdo).`)
    setAdicionando(null)
    carregar()
  }

  async function salvarPadlet(d, entrada) {
    const existente = quadros.find(q => q.dinamica_id === d.id)
    const url = entrada.trim() ? linkIncorporavel(entrada) : null
    const r = !url
      ? (existente ? await supabase.from('quadros').delete().eq('id', existente.id) : { error: null })
      : existente
        ? await supabase.from('quadros').update({ url }).eq('id', existente.id)
        : await supabase.from('quadros').insert({ charrette_id: atual.id, titulo: d.nome, url, dinamica_id: d.id })
    if (r.error) return avisar('Não foi possível salvar o Padlet.')
    avisar(url ? 'Padlet salvo. Ele também aparece em Dinâmica.' : 'Padlet removido desta charrette.')
    carregar()
  }

  async function salvarDinamica(dados) {
    const r = dados.id
      ? await supabase.from('dinamicas').update(dados).eq('id', dados.id)
      : await supabase.from('dinamicas').insert({ ...dados, ordem: dinamicas.length + 1 })
    if (r.error) return avisar('Não foi possível salvar.')
    avisar('Dinâmica salva.')
    setEditando(null)
    carregar()
  }

  return (
    <div className="stack">
      <div className="card">
        <div className="card-head">
          <div>
            <h3>Dinâmicas disponíveis</h3>
            <p className="muted">Escolha as dinâmicas da charrette. Ao adicionar, elas entram no programa do workshop, em Conteúdo.</p>
          </div>
          {ehEquipe && <button className="btn ghost sm" onClick={() => setEditando({})}><Icone nome="plus" tamanho={15} /> Nova dinâmica</button>}
        </div>
        <div className="ideias-barra" style={{ marginBottom: 12 }}>
          <input className="input busca" placeholder="Buscar dinâmica…" value={busca} onChange={e => setBusca(e.target.value)} />
        </div>
        <div className="opts" style={{ marginBottom: 14 }}>
          <button className={`opt ${!categoria ? 'on' : ''}`} onClick={() => setCategoria('')}>Todas ({dinamicas.length})</button>
          {categorias.map(c => <button key={c} className={`opt ${categoria === c ? 'on' : ''}`} onClick={() => setCategoria(c)}>{c}</button>)}
        </div>
        {filtradas.length === 0 && <div className="vazio">Nenhuma dinâmica encontrada.</div>}
        <div className="dinamicas-grade">
          {filtradas.map(d => {
            const noPrograma = programa.filter(p => p.dinamica_id === d.id)
            return (
              <div key={d.id} className={`card-dinamica ${d.ativo ? '' : 'inativa'}`}>
                <PreviaPadlet url={quadros.find(q => q.dinamica_id === d.id)?.url || (d.padlet_url && linkIncorporavel(d.padlet_url))} abrir={() => setAberta(d.id)} />
                <button className="card-dinamica-corpo" onClick={() => setAberta(d.id)}>
                  <span className="card-dinamica-topo">
                    <span className="icobox" style={{ background: 'var(--terra-soft)' }}><Icone nome={ICONE_CATEGORIA[d.categoria] || 'tool'} cor="var(--terra)" /></span>
                    <span className="dinamica-cat">{d.categoria}{!d.ativo ? ' · desativada' : ''}</span>
                  </span>
                  <b>{d.nome}</b>
                  <span className="muted">{d.objetivo}</span>
                  <span className="dinamica-meta">
                    {d.duracao && <span><Icone nome="clock" tamanho={13} /> {d.duracao}</span>}
                    {d.pessoas && <span><Icone nome="users" tamanho={13} /> {d.pessoas}</span>}
                  </span>
                </button>
                <div className="card-dinamica-pe">
                  {noPrograma.length
                    ? <span className="selo verde">No programa · Dia {noPrograma[0].dia}{noPrograma[0].hora ? ` ${noPrograma[0].hora.slice(0, 5)}` : ''}</span>
                    : <button className="link-btn muted" onClick={() => setAberta(d.id)}>Ver passo a passo</button>}
                  {podeGerir && <button className="btn terra sm" onClick={() => setAdicionando(d)}><Icone nome="plus" cor="#fff" tamanho={14} /> Adicionar</button>}
                </div>
              </div>
            )
          })}
        </div>
      </div>
      <Arquivos etapa="toolbox" titulo="Modelos e materiais" descricao="PDFs e planilhas das ferramentas, para baixar e usar no workshop." />

      {aberta && (() => {
        const d = dinamicas.find(x => x.id === aberta)
        return d && <DetalheDinamica d={d} noPrograma={programa.filter(p => p.dinamica_id === d.id)} fechar={() => setAberta(null)}
          quadro={quadros.find(q => q.dinamica_id === d.id)} salvarPadlet={podeGerir ? url => salvarPadlet(d, url) : null}
          adicionar={podeGerir ? () => { setAberta(null); setAdicionando(d) } : null}
          editar={ehEquipe ? () => { setAberta(null); setEditando(d) } : null} />
      })()}
      {adicionando && <AdicionarAoPrograma d={adicionando} fechar={() => setAdicionando(null)} confirmar={x => adicionar(adicionando, x)} />}
      {editando && <EditorDinamica d={editando} categorias={categorias} fechar={() => setEditando(null)} salvar={salvarDinamica} />}
    </div>
  )
}

function PreviaPadlet({ url, abrir }) {
  if (!url) return null
  return (
    <div className="card-dinamica-previa">
      <iframe src={url} title="Prévia do Padlet" tabIndex={-1} />
      <button className="quadro-tile-capa" onClick={abrir} aria-label="Abrir dinâmica"><span><Icone nome="grid" tamanho={14} cor="#fff" /> Padlet</span></button>
    </div>
  )
}

function DetalheDinamica({ d, noPrograma, fechar, adicionar, editar, quadro, salvarPadlet }) {
  const [link, setLink] = useState(quadro?.url || '')
  const padlet = quadro?.url || (d.padlet_url && linkIncorporavel(d.padlet_url))
  return (
    <div className="modal-fundo" onMouseDown={e => e.target === e.currentTarget && fechar()}>
      <div className="modal" style={{ width: 'min(620px,100%)' }}>
        <div className="modal-topo">
          <div><div className="dinamica-cat">{d.categoria}</div><h3>{d.nome}</h3></div>
          <button type="button" className="icon-btn" onClick={fechar} aria-label="Fechar" style={{ fontSize: 22 }}>×</button>
        </div>
        <p style={{ lineHeight: 1.55 }}>{d.objetivo}</p>
        <div className="dinamica-meta" style={{ margin: '10px 0' }}>
          {d.duracao && <span><Icone nome="clock" tamanho={13} /> {d.duracao}</span>}
          {d.pessoas && <span><Icone nome="users" tamanho={13} /> {d.pessoas}</span>}
          {noPrograma.map(p => <span key={p.id} className="selo verde">No programa · Dia {p.dia}{p.hora ? ` ${p.hora.slice(0, 5)}` : ''}</span>)}
        </div>
        {padlet && (
          <div className="detalhe-padlet">
            <div className="detalhe-padlet-topo">
              <b>{quadro ? 'Padlet desta charrette' : 'Padlet modelo'}</b>
              <a className="btn ghost sm" href={padlet} target="_blank" rel="noreferrer"><Icone nome="external" tamanho={14} /> Abrir no Padlet</a>
            </div>
            <div className="quadro-frame" style={{ height: '46vh' }}><iframe src={padlet} title={`Padlet de ${d.nome}`} allow="clipboard-write;fullscreen" allowFullScreen /></div>
          </div>
        )}
        {salvarPadlet && (
          <form className="padlet-charrette" onSubmit={e => { e.preventDefault(); salvarPadlet(link) }}>
            <label className="campo" style={{ flex: 1, margin: 0 }}>Padlet desta dinâmica nesta charrette
              <input className="input" value={link} onChange={e => setLink(e.target.value)} placeholder={d.padlet_url ? 'Deixe vazio para usar o modelo, ou cole o link do Padlet da charrette' : 'Cole o link do Padlet que será usado nesta dinâmica'} />
            </label>
            <button className="btn sm">Salvar</button>
          </form>
        )}
        {d.materiais && <p style={{ marginBottom: 8 }}><b>Materiais:</b> {d.materiais}</p>}
        {d.passos && <div className="dinamica-passos">{d.passos.split('\n').map((l, i) => <p key={i}>{l}</p>)}</div>}
        {(d.fonte || d.fonte_url) && (
          <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>Fonte: {d.fonte_url ? <a href={d.fonte_url} target="_blank" rel="noreferrer">{d.fonte || 'ver original'}</a> : d.fonte}</p>
        )}
        <div className="modal-acoes">
          {editar && <button className="btn ghost" onClick={editar}><Icone nome="pencil" tamanho={15} /> Editar</button>}
          <span style={{ flex: 1 }} />
          <button className="btn ghost" onClick={fechar}>Fechar</button>
          {adicionar && <button className="btn terra" onClick={adicionar}><Icone nome="plus" cor="#fff" tamanho={15} /> Adicionar à charrette</button>}
        </div>
      </div>
    </div>
  )
}

function AdicionarAoPrograma({ d, fechar, confirmar }) {
  const [v, setV] = useState({ dia: 1, hora: '' })
  return (
    <div className="modal-fundo" onMouseDown={e => e.target === e.currentTarget && fechar()}>
      <form className="modal" style={{ width: 'min(440px,100%)' }} onSubmit={e => { e.preventDefault(); confirmar(v) }}>
        <div className="modal-topo"><h3>Adicionar "{d.nome}"</h3><button type="button" className="icon-btn" onClick={fechar} aria-label="Fechar" style={{ fontSize: 22 }}>×</button></div>
        <div className="form-grid">
          <label className="campo">Dia
            <select className="input" value={v.dia} onChange={e => setV(x => ({ ...x, dia: e.target.value }))}>
              {[1, 2, 3, 4, 5, 6, 7].map(n => <option key={n} value={n}>Dia {n}</option>)}
            </select>
          </label>
          <label className="campo">Horário (opcional)<input className="input" type="time" value={v.hora} onChange={e => setV(x => ({ ...x, hora: e.target.value }))} /></label>
        </div>
        <div className="modal-acoes"><span style={{ flex: 1 }} /><button type="button" className="btn ghost" onClick={fechar}>Cancelar</button><button className="btn terra">Adicionar ao programa</button></div>
      </form>
    </div>
  )
}

function EditorDinamica({ d, categorias, fechar, salvar }) {
  const [v, setV] = useState({
    nome: d.nome || '', categoria: d.categoria || '', objetivo: d.objetivo || '', duracao: d.duracao || '', pessoas: d.pessoas || '',
    materiais: d.materiais || '', passos: d.passos || '', fonte: d.fonte || '', fonte_url: d.fonte_url || '', ativo: d.ativo ?? true,
    padlet_url: d.padlet_url || '',
  })
  const set = k => e => setV(x => ({ ...x, [k]: e.target.value }))
  function enviar(e) {
    e.preventDefault()
    if (!v.nome.trim()) return
    const limpo = Object.fromEntries(Object.entries(v).map(([k, x]) => [k, typeof x === 'string' ? x.trim() || null : x]))
    salvar(d.id ? { ...limpo, id: d.id } : limpo)
  }
  return (
    <div className="modal-fundo" onMouseDown={e => e.target === e.currentTarget && fechar()}>
      <form className="modal" onSubmit={enviar}>
        <div className="modal-topo"><h3>{d.id ? 'Editar dinâmica' : 'Nova dinâmica'}</h3><button type="button" className="icon-btn" onClick={fechar} aria-label="Fechar" style={{ fontSize: 22 }}>×</button></div>
        <div className="form-grid">
          <label className="campo span-2">Nome<input className="input" value={v.nome} onChange={set('nome')} required /></label>
          <label className="campo">Categoria
            <input className="input" list="cats-dinamica" value={v.categoria} onChange={set('categoria')} placeholder="Ideação, Empatia…" />
            <datalist id="cats-dinamica">{categorias.map(c => <option key={c} value={c} />)}</datalist>
          </label>
          <label className="campo">Duração<input className="input" value={v.duracao} onChange={set('duracao')} placeholder="20–30 min" /></label>
          <label className="campo span-2">Objetivo<textarea className="input" rows={2} value={v.objetivo} onChange={set('objetivo')} /></label>
          <label className="campo">Pessoas<input className="input" value={v.pessoas} onChange={set('pessoas')} placeholder="4–12" /></label>
          <label className="campo">Materiais<input className="input" value={v.materiais} onChange={set('materiais')} /></label>
          <label className="campo span-2">Padlet modelo da dinâmica
            <input className="input" value={v.padlet_url} onChange={set('padlet_url')} placeholder="Link do Padlet usado nesta dinâmica (cada charrette pode trocar pelo seu)" />
          </label>
          <label className="campo span-2">Passo a passo (uma linha por passo)<textarea className="input" rows={6} value={v.passos} onChange={set('passos')} /></label>
          <label className="campo">Fonte (nome)<input className="input" value={v.fonte} onChange={set('fonte')} placeholder="Hyper Island Toolbox" /></label>
          <label className="campo">Link da fonte<input className="input" value={v.fonte_url} onChange={set('fonte_url')} placeholder="https://…" /></label>
        </div>
        <label className="campo" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" checked={v.ativo} onChange={e => setV(x => ({ ...x, ativo: e.target.checked }))} /> Visível para os clientes
        </label>
        <div className="modal-acoes"><span style={{ flex: 1 }} /><button type="button" className="btn ghost" onClick={fechar}>Cancelar</button><button className="btn terra">Salvar</button></div>
      </form>
    </div>
  )
}
