import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Icone from '../components/Icone'
import { supabase } from '../lib/supabase'
import { useCharrette } from '../lib/contexto'
import { formatarData } from '../lib/estrutura'
import '../conceptbook.css'

const ehImagem = a => /^image\//.test(a?.tipo || '')
const pedacos = (lista, n) => Array.from({ length: Math.ceil(lista.length / n) }, (_, i) => lista.slice(i * n, i * n + n))

const SECOES = [
  ['capa', 'Capa'], ['desafio', 'O desafio'], ['conceito', 'Conceito'], ['pilares', 'Pilares'],
  ['ideias', 'Ideias aprovadas'], ['imagens', 'Imagens'], ['ficha', 'Ficha técnica'], ['contracapa', 'Contracapa'],
]

function useDados() {
  const { atual } = useCharrette()
  const [d, setD] = useState(null)
  useEffect(() => {
    const cid = atual.id
    Promise.all([
      supabase.from('conceito').select('*').eq('charrette_id', cid).maybeSingle(),
      supabase.from('problema').select('*').eq('charrette_id', cid).maybeSingle(),
      supabase.from('conclusoes').select('*').eq('charrette_id', cid).order('ordem'),
      supabase.from('ideias').select('*').eq('charrette_id', cid).eq('status', 'aprovada').order('created_at'),
      supabase.from('arquivos').select('*').eq('charrette_id', cid).order('created_at'),
      supabase.from('parceiros').select('nome,area,status').eq('charrette_id', cid).eq('status', 'confirmado').order('nome'),
      supabase.from('programa').select('dia,titulo').eq('charrette_id', cid),
    ]).then(async ([co, pr, cl, id, ar, pa, pg]) => {
      const arquivos = (ar.data || []).filter(ehImagem)
      const urls = {}
      if (arquivos.length) {
        const { data } = await supabase.storage.from('charrette-arquivos').createSignedUrls(arquivos.map(a => a.caminho), 3600)
        ;(data || []).forEach((x, i) => { if (x.signedUrl) urls[arquivos[i].id] = x.signedUrl })
      }
      setD({
        conceito: co.data || {}, problema: pr.data || {}, insights: cl.data || [], ideias: id.data || [],
        arquivos: arquivos.map(a => ({ ...a, url: urls[a.id] })).filter(a => a.url),
        parceiros: pa.data || [], programa: pg.data || [],
      })
    })
  }, [atual.id])
  return d
}

export default function ConceptBook() {
  const { atual, pessoas } = useCharrette()
  const d = useDados()
  const [ligadas, setLigadas] = useState(() => Object.fromEntries(SECOES.map(([k]) => [k, true])))
  const [capaId, setCapaId] = useState(null)
  const [escolherCapa, setEscolherCapa] = useState(false)
  const [pronto, setPronto] = useState(false)

  const imagensIdeia = useMemo(() => {
    const m = {}
    ;(d?.arquivos || []).filter(a => a.ideia_id).forEach(a => { (m[a.ideia_id] ||= []).push(a) })
    return m
  }, [d])
  const galeria = useMemo(() => (d?.arquivos || []).filter(a => ['projeto', 'conceito'].includes(a.etapa)), [d])
  const candidatasCapa = useMemo(() => [...galeria, ...(d?.arquivos || []).filter(a => a.ideia_id)], [galeria, d])
  const capa = candidatasCapa.find(a => a.id === capaId) || galeria.find(a => a.etapa === 'conceito') || galeria[0] || candidatasCapa[0]

  // espera as imagens carregarem antes de liberar o PDF
  useEffect(() => {
    if (!d) return
    const urls = d.arquivos.map(a => a.url)
    if (!urls.length) { setPronto(true); return }
    let faltam = urls.length
    const fim = () => { if (--faltam <= 0) setPronto(true) }
    urls.forEach(u => { const i = new Image(); i.onload = fim; i.onerror = fim; i.src = u })
    const t = setTimeout(() => setPronto(true), 8000)
    return () => clearTimeout(t)
  }, [d])

  useEffect(() => {
    const t = document.title
    document.title = `Concept book · ${atual.nome}`
    return () => { document.title = t }
  }, [atual.nome])

  if (!d) return <div className="center-screen"><img src="/marca.png" alt="" width="54" className="pulse" /></div>

  const naming = d.conceito.nome || atual.nome
  const local = [atual.cidade, atual.uf].filter(Boolean).join(' / ')
  const pilares = Array.isArray(d.conceito.pilares) ? d.conceito.pilares : []
  const dias = new Set(d.programa.map(p => p.dia)).size
  const dono = pessoas?.[atual.dono_id]
  const cliente = dono && dono.papel !== 'equipe' ? dono.nome : null

  const paginas = []
  const add = (k, el) => paginas.push({ k, el })

  if (ligadas.capa) add('capa', (
    <section className="cb-pagina cb-capa" style={capa ? { backgroundImage: `linear-gradient(90deg,rgba(31,32,33,.92) 0%,rgba(31,32,33,.55) 55%,rgba(31,32,33,.15) 100%),url(${capa.url})` } : undefined}>
      <Topo />
      <div className="cb-capa-tx">
        <div className="cb-eyebrow">Concept book</div>
        <h1>{naming}</h1>
        {d.conceito.nome && <p className="cb-sub">{atual.nome}</p>}
        <p className="cb-local">{[local, atual.data_evento && formatarData(atual.data_evento)].filter(Boolean).join(' · ')}</p>
      </div>
      <div className="cb-marca"><img src="/marca.png" alt="" /> CHARRETTE</div>
    </section>
  ))

  if (ligadas.desafio && (d.problema.desafio || d.insights.length)) add('desafio', (
    <section className="cb-pagina cb-dupla">
      <div className="cb-col-escura">
        <div className="cb-eyebrow">01</div>
        <h2>O desafio</h2>
        <p className="cb-texto-claro">{d.problema.desafio || atual.descricao}</p>
      </div>
      <div className="cb-col">
        <div className="cb-eyebrow">Insights</div>
        <div className="cb-insights">
          {d.insights.slice(0, 6).map((x, i) => (
            <div key={x.id} className="cb-insight"><span>{String(i + 1).padStart(2, '0')}</span><div><b>{x.titulo}</b>{x.descricao && <p>{x.descricao}</p>}</div></div>
          ))}
          {!d.insights.length && <p className="cb-vazio">Os insights entram aqui (Definição do problema).</p>}
        </div>
      </div>
    </section>
  ))

  if (ligadas.conceito) add('conceito', (
    <section className="cb-pagina cb-conceito">
      <div className="cb-eyebrow">02 · O conceito</div>
      <h2 className="cb-naming">{naming}</h2>
      <div className={`cb-story ${(d.conceito.storytelling || '').length > 900 ? 'longo' : ''}`}>
        {(d.conceito.storytelling || 'O storytelling do conceito entra aqui (Conceito consolidado).').split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)}
      </div>
      <Rodape naming={naming} />
    </section>
  ))

  if (ligadas.pilares && pilares.length) pedacos(pilares, 6).forEach((grupo, gi) => add(`pilares-${gi}`, (
    <section className="cb-pagina cb-pilares">
      <div className="cb-eyebrow">03 · Pilares</div>
      <h2>O que sustenta o conceito</h2>
      <div className={`cb-pilares-grade n${grupo.length}`}>
        {grupo.map((p, i) => (
          <div key={i} className="cb-pilar"><span>{String(gi * 6 + i + 1).padStart(2, '0')}</span><b>{p.titulo}</b>{p.descricao && <p>{p.descricao}</p>}</div>
        ))}
      </div>
      <Rodape naming={naming} />
    </section>
  )))

  if (ligadas.ideias && d.ideias.length) pedacos(d.ideias, 6).forEach((grupo, gi) => add(`ideias-${gi}`, (
    <section className="cb-pagina cb-ideias">
      <div className="cb-eyebrow">04 · Ideias que ficam</div>
      <h2>{gi === 0 ? 'Ideias aprovadas na charrette' : 'Ideias aprovadas (cont.)'}</h2>
      <div className="cb-ideias-grade">
        {grupo.map(i => {
          const img = imagensIdeia[i.id]?.[0]
          return (
            <div key={i.id} className="cb-ideia">
              <div className="cb-ideia-img" style={img ? { backgroundImage: `url(${img.url})` } : undefined}>{!img && <img src="/marca.png" alt="" />}</div>
              {i.tema && <span className="cb-tema">{i.tema}</span>}
              <b>{i.titulo}</b>
            </div>
          )
        })}
      </div>
      <Rodape naming={naming} />
    </section>
  )))

  if (ligadas.imagens && galeria.length) pedacos(galeria, 4).forEach((grupo, gi) => add(`imagens-${gi}`, (
    <section className={`cb-pagina cb-imagens n${grupo.length}`}>
      {grupo.map(a => (
        <figure key={a.id} style={{ backgroundImage: `url(${a.url})` }}>
          {a.legenda && !['referencia', 'ia'].includes(a.legenda) && <figcaption>{a.legenda}</figcaption>}
        </figure>
      ))}
      <Rodape naming={naming} claro />
    </section>
  )))

  if (ligadas.ficha) add('ficha', (
    <section className="cb-pagina cb-dupla">
      <div className="cb-col">
        <div className="cb-eyebrow">05 · Ficha técnica</div>
        <h2>Quem construiu</h2>
        <dl className="cb-ficha">
          <dt>Projeto</dt><dd>{atual.nome}</dd>
          {cliente && <><dt>Cliente</dt><dd>{cliente}</dd></>}
          {local && <><dt>Local</dt><dd>{local}</dd></>}
          {atual.data_evento && <><dt>Charrette</dt><dd>{formatarData(atual.data_evento)}{atual.local_evento ? ` · ${atual.local_evento}` : ''}</dd></>}
          {dias > 0 && <><dt>Programa</dt><dd>{dias} dia{dias > 1 ? 's' : ''} · {d.programa.length} atividades</dd></>}
          <dt>Ideias</dt><dd>{d.ideias.length} aprovadas</dd>
        </dl>
      </div>
      <div className="cb-col cb-col-areia">
        <div className="cb-eyebrow">Parceiros</div>
        <div className="cb-parceiros">
          {d.parceiros.map((p, i) => <div key={i}><b>{p.nome}</b><span>{p.area}</span></div>)}
          {!d.parceiros.length && <p className="cb-vazio">Os parceiros confirmados aparecem aqui.</p>}
        </div>
      </div>
    </section>
  ))

  if (ligadas.contracapa) add('contracapa', (
    <section className="cb-pagina cb-contracapa">
      <img src="/marca.png" alt="" />
      <b>CHARRETTE</b>
      <span>Várias áreas, uma mesa, um projeto possível.</span>
    </section>
  ))

  return (
    <div className="cb">
      <div className="cb-barra">
        <Link to="/etapa/conceito" className="btn ghost sm"><Icone nome="back" tamanho={15} /> Voltar</Link>
        <b>Concept book</b>
        <div className="cb-secoes">
          {SECOES.map(([k, r]) => (
            <label key={k}><input type="checkbox" checked={ligadas[k]} onChange={e => setLigadas(v => ({ ...v, [k]: e.target.checked }))} /> {r}</label>
          ))}
        </div>
        {candidatasCapa.length > 1 && <button className="btn ghost sm" onClick={() => setEscolherCapa(v => !v)}>Imagem da capa</button>}
        <button className="btn terra sm" onClick={() => window.print()} disabled={!pronto}>
          <Icone nome="file" cor="#fff" tamanho={15} /> {pronto ? 'Baixar PDF' : 'Carregando imagens…'}
        </button>
      </div>
      {escolherCapa && (
        <div className="cb-capas">
          {candidatasCapa.map(a => (
            <button key={a.id} className={a.id === capa?.id ? 'on' : ''} style={{ backgroundImage: `url(${a.url})` }} onClick={() => { setCapaId(a.id); setEscolherCapa(false) }} aria-label={a.nome} />
          ))}
        </div>
      )}
      <p className="cb-dica">{paginas.length} páginas · A4 deitado. Em "Baixar PDF", escolha <b>Salvar como PDF</b> e deixe as margens em "Nenhuma".</p>
      <div className="cb-paginas">
        {paginas.map(p => <div key={p.k} className="cb-folha">{p.el}</div>)}
      </div>
    </div>
  )
}

function Topo() {
  return (
    <svg className="cb-topo" viewBox="0 0 800 560" preserveAspectRatio="xMidYMid slice" fill="none" stroke="#fff" strokeWidth="1" aria-hidden="true">
      {Array.from({ length: 18 }, (_, i) => (
        <path key={i} d={`M-20 ${30 + i * 30} C 150 ${i * 30}, 260 ${80 + i * 28}, 420 ${40 + i * 30} S 700 ${i * 32}, 820 ${50 + i * 28}`} />
      ))}
    </svg>
  )
}

function Rodape({ naming, claro }) {
  return <div className={`cb-rodape ${claro ? 'claro' : ''}`}><img src="/marca.png" alt="" /> CHARRETTE · {naming}</div>
}
