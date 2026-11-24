import { useEffect, useRef, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import Icone from '../components/Icone'
import { supabase } from '../lib/supabase'
import { useAviso, useCharrette } from '../lib/contexto'
import { urlCase } from './Publico'

const slugDe = t => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)
const nomeSeguro = n => n.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '-').slice(-60)

async function subirImagem(arquivo, pasta) {
  const caminho = `${pasta}/${Date.now()}-${nomeSeguro(arquivo.name)}`
  const { error } = await supabase.storage.from('cases').upload(caminho, arquivo, { contentType: arquivo.type })
  if (error) throw error
  return caminho
}

export default function CasesAdmin() {
  const { ehEquipe, perfil } = useCharrette()
  const avisar = useAviso()
  const [cases, setCases] = useState(null)
  const [editando, setEditando] = useState(null)

  async function carregar() {
    const { data } = await supabase.from('cases').select('*').order('ordem').order('created_at', { ascending: false })
    setCases(data || [])
  }
  useEffect(() => { carregar() }, [])

  if (perfil && !ehEquipe) return <Navigate to="/" replace />
  if (!cases) return <div className="vazio">Carregando…</div>

  async function novo() {
    const titulo = window.prompt('Nome do case:')
    if (!titulo?.trim()) return
    const { data, error } = await supabase.from('cases')
      .insert({ titulo: titulo.trim(), slug: `${slugDe(titulo)}-${Date.now().toString(36).slice(-4)}`, ordem: cases.length })
      .select().single()
    if (error) return avisar('Não foi possível criar.')
    await carregar(); setEditando(data.id)
  }

  async function publicar(c) {
    const { error } = await supabase.from('cases').update({ publicado: !c.publicado }).eq('id', c.id)
    if (error) return avisar('Não foi possível salvar.')
    avisar(c.publicado ? 'Case escondido do site.' : 'Case publicado no site.')
    carregar()
  }

  if (editando) return <EditorCase id={editando} voltar={() => { setEditando(null); carregar() }} />

  return (
    <>
      <div className="pagehead">
        <div className="eyebrow">Administração</div>
        <h1>Cases do site</h1>
        <p>Os cases publicados aparecem na página inicial pública. <Link to="/site#cases" target="_blank" style={{ color: 'var(--terra)', fontWeight: 600 }}>Ver o site</Link></p>
      </div>
      <div className="stack">
        {cases.length === 0 && <div className="card vazio">Nenhum case ainda.</div>}
        {cases.map(c => (
          <div className="card adm-case" key={c.id}>
            <span className="adm-case-capa" style={c.capa ? { backgroundImage: `url(${urlCase(c.capa)})` } : undefined} />
            <div className="adm-tx"><b>{c.titulo}</b><span className="muted">{[c.categoria, c.local, c.ano].filter(Boolean).join(' · ') || 'Sem detalhes ainda'}</span></div>
            <span className={`tag ${c.publicado ? 'done' : 'todo'}`}>{c.publicado ? 'Publicado' : 'Rascunho'}</span>
            <button className="btn ghost sm" onClick={() => publicar(c)}>{c.publicado ? 'Esconder' : 'Publicar'}</button>
            <button className="btn ghost sm" onClick={() => setEditando(c.id)}><Icone nome="pencil" tamanho={15} /> Editar</button>
          </div>
        ))}
        <div><button className="btn terra" onClick={novo}><Icone nome="plus" cor="#fff" tamanho={18} /> Novo case</button></div>
      </div>
    </>
  )
}

function EditorCase({ id, voltar }) {
  const avisar = useAviso()
  const [c, setC] = useState(null)
  const [imgs, setImgs] = useState([])
  const [enviando, setEnviando] = useState(false)
  const capaInput = useRef(null)
  const imgInput = useRef(null)
  const [tipoNovo, setTipoNovo] = useState('render')

  useEffect(() => {
    supabase.from('cases').select('*').eq('id', id).single().then(({ data }) => setC(data))
    supabase.from('case_imagens').select('*').eq('case_id', id).order('ordem').order('created_at').then(({ data }) => setImgs(data || []))
  }, [id])

  if (!c) return <div className="vazio">Carregando…</div>
  const set = k => e => setC(v => ({ ...v, [k]: e.target.value }))

  async function salvar(e) {
    e?.preventDefault()
    const { titulo, local, categoria, area, resumo, descricao } = c
    const ano = c.ano ? parseInt(c.ano, 10) || null : null
    const slug = slugDe(c.slug || titulo) || c.slug
    const { error } = await supabase.from('cases').update({ titulo, local, categoria, area, resumo, descricao, ano, slug }).eq('id', id)
    if (error) return avisar(/duplicate|unique/.test(error.message) ? 'Esse endereço já é usado por outro case.' : 'Não foi possível salvar.')
    avisar('Case salvo.')
  }

  async function trocarCapa(e) {
    const f = e.target.files[0]; e.target.value = ''
    if (!f) return
    setEnviando(true)
    try {
      const caminho = await subirImagem(f, id)
      await supabase.from('cases').update({ capa: caminho }).eq('id', id)
      if (c.capa) supabase.storage.from('cases').remove([c.capa])
      setC(v => ({ ...v, capa: caminho }))
    } catch { avisar('Não foi possível enviar a imagem. Use JPG, PNG ou WebP de até 20 MB.') }
    setEnviando(false)
  }

  async function adicionarImagens(e) {
    const lista = [...e.target.files]; e.target.value = ''
    setEnviando(true)
    for (const f of lista) {
      try {
        const caminho = await subirImagem(f, id)
        const { data } = await supabase.from('case_imagens').insert({ case_id: id, caminho, tipo: tipoNovo, ordem: imgs.length }).select().single()
        if (data) setImgs(l => [...l, data])
      } catch { avisar(`Não foi possível enviar ${f.name}.`) }
    }
    setEnviando(false)
  }

  async function mudarImagem(img, patch) {
    setImgs(l => l.map(x => (x.id === img.id ? { ...x, ...patch } : x)))
    await supabase.from('case_imagens').update(patch).eq('id', img.id)
  }
  async function removerImagem(img) {
    if (!window.confirm('Apagar esta imagem?')) return
    await supabase.from('case_imagens').delete().eq('id', img.id)
    supabase.storage.from('cases').remove([img.caminho])
    setImgs(l => l.filter(x => x.id !== img.id))
  }
  async function apagarCase() {
    if (!window.confirm(`Apagar o case "${c.titulo}" e todas as imagens? Não dá para desfazer.`)) return
    const caminhos = [c.capa, ...imgs.map(i => i.caminho)].filter(Boolean)
    if (caminhos.length) await supabase.storage.from('cases').remove(caminhos)
    await supabase.from('cases').delete().eq('id', id)
    avisar('Case apagado.')
    voltar()
  }

  return (
    <>
      <div className="pagehead">
        <button className="link-btn muted" onClick={voltar}>← Voltar aos cases</button>
        <h1 style={{ marginTop: 8 }}>{c.titulo}</h1>
        {c.publicado && <p><a href={`/cases/${c.slug}`} target="_blank" rel="noreferrer" style={{ color: 'var(--terra)', fontWeight: 600 }}>Ver no site</a></p>}
      </div>
      <div className="split">
        <form className="card" onSubmit={salvar}>
          <div className="form-grid">
            <label className="campo span-2">Nome do case<input className="input" value={c.titulo || ''} onChange={set('titulo')} required /></label>
            <label className="campo">Local<input className="input" value={c.local || ''} onChange={set('local')} placeholder="Pirenópolis / GO" /></label>
            <label className="campo">Categoria<input className="input" value={c.categoria || ''} onChange={set('categoria')} placeholder="Loteamento, espaço público…" /></label>
            <label className="campo">Ano<input className="input" value={c.ano || ''} onChange={set('ano')} inputMode="numeric" /></label>
            <label className="campo">Área<input className="input" value={c.area || ''} onChange={set('area')} placeholder="12 ha" /></label>
            <label className="campo span-2">Resumo (aparece em destaque)<textarea className="input" rows={2} value={c.resumo || ''} onChange={set('resumo')} /></label>
            <label className="campo span-2">Descrição do projeto<textarea className="input" rows={6} value={c.descricao || ''} onChange={set('descricao')} placeholder="Deixe uma linha em branco entre os parágrafos." /></label>
            <label className="campo span-2">Endereço da página<span className="input-grupo"><i>/cases/</i><input className="input" value={c.slug || ''} onChange={set('slug')} /></span></label>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn terra">Salvar</button>
            <button type="button" className="btn ghost perigo" onClick={apagarCase}><Icone nome="trash" tamanho={16} /> Apagar case</button>
          </div>
        </form>

        <div className="stack">
          <div className="card">
            <h3>Imagem de capa</h3>
            <p className="muted" style={{ marginBottom: 10 }}>A thumbnail do case. Use a imagem mais impactante, de preferência na horizontal.</p>
            <div className="adm-capa" style={c.capa ? { backgroundImage: `url(${urlCase(c.capa)})` } : undefined}>{!c.capa && 'Sem capa'}</div>
            <input ref={capaInput} type="file" accept="image/*" hidden onChange={trocarCapa} />
            <button className="btn ghost sm" style={{ marginTop: 10 }} onClick={() => capaInput.current.click()} disabled={enviando}>
              <Icone nome="upload" tamanho={15} /> {c.capa ? 'Trocar capa' : 'Enviar capa'}
            </button>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-head">
          <div><h3>Renders e plantas</h3><p className="muted">Aparecem na página do case. Plantas ficam numa seção própria.</p></div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select className="input" style={{ width: 'auto' }} value={tipoNovo} onChange={e => setTipoNovo(e.target.value)}>
              <option value="render">Render</option><option value="planta">Planta</option><option value="foto">Foto</option>
            </select>
            <input ref={imgInput} type="file" accept="image/*" multiple hidden onChange={adicionarImagens} />
            <button className="btn ghost sm" onClick={() => imgInput.current.click()} disabled={enviando}><Icone nome="upload" tamanho={15} /> {enviando ? 'Enviando…' : 'Enviar imagens'}</button>
          </div>
        </div>
        {imgs.length === 0 && <div className="vazio">Nenhuma imagem ainda.</div>}
        <div className="adm-imgs">
          {imgs.map(i => (
            <figure key={i.id}>
              <img src={urlCase(i.caminho)} alt="" />
              <select className="cell-select" value={i.tipo} onChange={e => mudarImagem(i, { tipo: e.target.value })}>
                <option value="render">Render</option><option value="planta">Planta</option><option value="foto">Foto</option>
              </select>
              <input className="cell" placeholder="Legenda" defaultValue={i.legenda || ''} onBlur={e => e.target.value !== (i.legenda || '') && mudarImagem(i, { legenda: e.target.value || null })} />
              <button className="icon-btn" onClick={() => removerImagem(i)} aria-label="Apagar"><Icone nome="trash" tamanho={15} /></button>
            </figure>
          ))}
        </div>
      </div>
    </>
  )
}
