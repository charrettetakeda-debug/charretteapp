import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useSessao } from '../lib/contexto'
import '../publico.css'

export const urlCase = caminho => (caminho ? supabase.storage.from('cases').getPublicUrl(caminho).data.publicUrl : null)

export function useCases() {
  const [cases, setCases] = useState(null)
  useEffect(() => {
    supabase.from('cases').select('*').eq('publicado', true).order('ordem').order('created_at', { ascending: false })
      .then(({ data }) => setCases(data || []))
  }, [])
  return cases
}

function Topo() {
  const { sessao } = useSessao()
  return (
    <header className="site-topo">
      <Link to="/site" className="site-marca"><img src="/marca.png" alt="" width="34" /><b>Charrette</b></Link>
      <nav>
        <a href="/site#cases">Cases</a>
        <a href="/site#como-funciona">Como funciona</a>
        <Link className="btn terra sm" to={sessao ? '/' : '/entrar'}>{sessao ? 'Abrir o app' : 'Entrar'}</Link>
      </nav>
    </header>
  )
}

export function GradeCases({ cases }) {
  if (!cases) return <div className="vazio">Carregando cases…</div>
  if (!cases.length) return <div className="vazio">Os primeiros cases estão sendo preparados.</div>
  return (
    <div className="grade-cases">
      {cases.map(c => (
        <Link key={c.id} to={`/cases/${c.slug}`} className="case-card">
          <span className="case-capa" style={c.capa ? { backgroundImage: `url(${urlCase(c.capa)})` } : undefined} />
          <span className="case-info">
            {c.categoria && <span className="case-cat">{c.categoria}</span>}
            <b>{c.titulo}</b>
            <span className="muted">{[c.local, c.ano].filter(Boolean).join(' · ')}</span>
          </span>
        </Link>
      ))}
    </div>
  )
}

/** Página inicial pública */
export function Landing() {
  const cases = useCases()
  const { hash } = useLocation()
  useEffect(() => {
    if (!hash) return
    const t = setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth' }), 150)
    return () => clearTimeout(t)
  }, [hash, cases])
  return (
    <div className="site">
      <Topo />
      <section className="site-hero">
        <svg className="topo" viewBox="0 0 800 400" preserveAspectRatio="xMidYMid slice" fill="none" stroke="#5a5a5a" strokeWidth="1.2" aria-hidden="true">
          {Array.from({ length: 16 }, (_, i) => (
            <path key={i} d={`M-20 ${30 + i * 26} C 150 ${i * 26}, 260 ${80 + i * 24}, 420 ${40 + i * 26} S 700 ${i * 28}, 820 ${50 + i * 24}`} />
          ))}
        </svg>
        <div className="site-hero-txt">
          <div className="eyebrow">Metodologia Charrette</div>
          <h1>Várias áreas, uma mesa, um projeto possível.</h1>
          <p>Um processo colaborativo e intensivo que reúne proprietários, especialistas, poder público e comunidade para chegar a um conceito viável, do primeiro dado ao protótipo.</p>
          <div className="site-hero-acoes">
            <a className="btn terra" href="#cases">Ver cases</a>
            <Link className="btn ghost claro" to="/entrar">Área do cliente</Link>
          </div>
        </div>
      </section>

      <section className="site-secao" id="como-funciona">
        <h2>Como funciona</h2>
        <div className="fases-site">
          {[['01', 'Pré-charrette', 'Pesquisa da cidade e do mercado, coleta de dados técnicos, entrevista e definição do problema.'],
            ['02', 'Charrette', 'Dias de imersão com todas as áreas juntas: ideação, dinâmicas e esboços do projeto.'],
            ['03', 'Pós-entrega', 'O conceito consolidado e o protótipo, prontos para seguir adiante.']]
            .map(([n, t, d]) => (
              <div key={n} className="fase-site"><span>{n}</span><h3>{t}</h3><p>{d}</p></div>
            ))}
        </div>
      </section>

      <section className="site-secao" id="cases">
        <h2>Cases</h2>
        <GradeCases cases={cases} />
      </section>

      <section className="site-secao">
        <div className="site-parceiro">
          <div>
            <div className="eyebrow">Para consultores e especialistas</div>
            <h2>Seja parceiro de uma charrette</h2>
            <p>Urbanistas, engenheiros, advogados, especialistas em mercado e comunidade: cadastre-se para ser convidado pela equipe Charrette.</p>
          </div>
          <Link className="btn terra" to="/entrar?parceiro=1">Quero ser parceiro</Link>
        </div>
      </section>

      <footer className="site-rodape"><img src="/marca.png" alt="" width="22" /> Charrette</footer>
    </div>
  )
}

/** Página de um case: capa, renders, plantas e descrição */
export function CasePagina() {
  const { slug } = useParams()
  const [c, setC] = useState(undefined)
  const [imgs, setImgs] = useState([])
  const [zoom, setZoom] = useState(null)

  useEffect(() => {
    supabase.from('cases').select('*').eq('slug', slug).maybeSingle().then(async ({ data }) => {
      setC(data || null)
      if (data) {
        const { data: i } = await supabase.from('case_imagens').select('*').eq('case_id', data.id).order('ordem').order('created_at')
        setImgs(i || [])
      }
    })
  }, [slug])

  const renders = imgs.filter(i => i.tipo !== 'planta')
  const plantas = imgs.filter(i => i.tipo === 'planta')

  return (
    <div className="site">
      <Topo />
      {c === undefined && <div className="vazio" style={{ padding: 40 }}>Carregando…</div>}
      {c === null && <div className="site-secao"><h2>Case não encontrado</h2><Link to="/site">Voltar ao início</Link></div>}
      {c && (
        <>
          <section className="case-hero" style={c.capa ? { backgroundImage: `url(${urlCase(c.capa)})` } : undefined}>
            <div className="case-hero-txt">
              {c.categoria && <div className="eyebrow">{c.categoria}</div>}
              <h1>{c.titulo}</h1>
              <p>{[c.local, c.ano, c.area].filter(Boolean).join(' · ')}</p>
            </div>
          </section>
          <section className="site-secao case-texto">
            {c.resumo && <p className="case-resumo">{c.resumo}</p>}
            {c.descricao && c.descricao.split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)}
          </section>
          {renders.length > 0 && (
            <section className="site-secao">
              <h2>Imagens</h2>
              <div className="galeria-case">
                {renders.map(i => (
                  <figure key={i.id}><button onClick={() => setZoom(i)}><img src={urlCase(i.caminho)} alt={i.legenda || c.titulo} loading="lazy" /></button>
                    {i.legenda && <figcaption>{i.legenda}</figcaption>}</figure>
                ))}
              </div>
            </section>
          )}
          {plantas.length > 0 && (
            <section className="site-secao">
              <h2>Planta</h2>
              <div className="plantas-case">
                {plantas.map(i => (
                  <figure key={i.id}><button onClick={() => setZoom(i)}><img src={urlCase(i.caminho)} alt={i.legenda || 'Planta'} loading="lazy" /></button>
                    {i.legenda && <figcaption>{i.legenda}</figcaption>}</figure>
                ))}
              </div>
            </section>
          )}
          <section className="site-secao"><Link className="btn ghost" to="/site#cases">← Ver todos os cases</Link></section>
        </>
      )}
      {zoom && (
        <div className="zoom" onClick={() => setZoom(null)} role="dialog" aria-label="Imagem ampliada">
          <img src={urlCase(zoom.caminho)} alt={zoom.legenda || ''} />
          {zoom.legenda && <p>{zoom.legenda}</p>}
        </div>
      )}
      <footer className="site-rodape"><img src="/marca.png" alt="" width="22" /> Charrette</footer>
    </div>
  )
}
