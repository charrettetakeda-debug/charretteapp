import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import Icone from '../components/Icone'
import Quadros from '../components/Quadros'
import { Arquivos } from '../components/Arquivos'
import Ideias from '../etapas/Ideias'
import { supabase } from '../lib/supabase'
import { CharretteCtx, useAviso, useCharrette, useSessao } from '../lib/contexto'
import { formatarData } from '../lib/estrutura'
import { AREAS, iniciaisDe } from '../lib/parceiros'
import '../parceiros.css'

const CONTATO_EQUIPE = 'charrette.takeda@gmail.com'

export default function AreaParceiro() {
  const { perfil, lista } = useCharrette()
  const { sessao } = useSessao()
  const navigate = useNavigate()
  async function sair() { await supabase.auth.signOut(); navigate('/') }
  const temCharrettePropria = lista?.length > 0

  return (
    <div className="parc-shell">
      <header className="parc-topo">
        <Link to="/parceiro" className="parc-marca"><img src="/marca.png" alt="" width="30" /><b>Charrette</b><span>Parceiros</span></Link>
        <nav>
          <NavLink end to="/parceiro">Minhas charrettes</NavLink>
          <NavLink to="/parceiro/cadastro">Meu cadastro</NavLink>
          {temCharrettePropria && <Link to="/">Área do cliente</Link>}
          <button onClick={sair} title={sessao?.user?.email}><Icone nome="logout" tamanho={16} /> Sair</button>
        </nav>
      </header>
      <main className="parc-corpo">
        <Routes>
          <Route index element={<InicioParceiro nome={perfil?.nome} />} />
          <Route path="cadastro" element={<FichaParceiro />} />
          <Route path=":id" element={<CharretteParceiro />} />
          <Route path="*" element={<Navigate to="/parceiro" replace />} />
        </Routes>
      </main>
    </div>
  )
}

function useFicha() {
  const { uid } = useCharrette()
  const [ficha, setFicha] = useState(undefined)
  useEffect(() => {
    if (!uid) return
    supabase.from('parceiro_ficha').select('*').eq('id', uid).maybeSingle().then(({ data }) => setFicha(data || null))
  }, [uid])
  return [ficha, setFicha]
}

function InicioParceiro({ nome }) {
  const { parcerias, recarregarPerfil } = useCharrette()
  const avisar = useAviso()
  const [ficha] = useFicha()
  const [respondendo, setRespondendo] = useState(null)

  useEffect(() => { recarregarPerfil() }, [])

  async function responder(p, aceitar) {
    if (!aceitar && !window.confirm(`Recusar o convite para "${p.charrette.nome}"?`)) return
    setRespondendo(p.id)
    const { error } = await supabase.rpc('responder_convite', { p_id: p.id, p_aceitar: aceitar })
    setRespondendo(null)
    if (error) return avisar('Não foi possível responder. Tente de novo.')
    avisar(aceitar ? 'Convite aceito! A charrette já está liberada para você.' : 'Convite recusado.')
    recarregarPerfil()
  }

  const convites = parcerias.filter(p => p.status === 'convidado')
  const ativas = parcerias.filter(p => p.status === 'confirmado')
  const recusadas = parcerias.filter(p => p.status === 'recusado')
  const fichaIncompleta = ficha !== undefined && (!ficha || !ficha.area || !ficha.bio)

  return (
    <div className="stack">
      <div className="parc-hero">
        <div className="eyebrow">Área do parceiro</div>
        <h1>Olá{nome ? `, ${nome.split(' ')[0]}` : ''}.</h1>
        <p>Aqui ficam os convites da equipe Charrette e as charrettes de que você participa.</p>
      </div>

      {fichaIncompleta && (
        <Link to="/parceiro/cadastro" className="card aviso-ficha">
          <Icone nome="users" cor="var(--terra)" />
          <div><b>Complete o seu cadastro</b><span className="muted">Área, empresa e uma mini bio ajudam a equipe a chamar você para as charrettes certas.</span></div>
          <Icone nome="arrow" />
        </Link>
      )}

      <section>
        <div className="sec-title"><h2>Convites</h2><span className="muted">{convites.length ? `${convites.length} aguardando resposta` : ''}</span></div>
        {convites.length === 0 && <div className="card vazio">Nenhum convite novo por enquanto.</div>}
        <div className="parc-grade">
          {convites.map(p => (
            <CartaoCharrette key={p.id} p={p}>
              <div className="parc-acoes">
                <button className="btn terra" disabled={respondendo === p.id} onClick={() => responder(p, true)}><Icone nome="check" cor="#fff" tamanho={16} /> Aceitar</button>
                <button className="btn ghost" disabled={respondendo === p.id} onClick={() => responder(p, false)}>Recusar</button>
              </div>
            </CartaoCharrette>
          ))}
        </div>
      </section>

      <section>
        <div className="sec-title"><h2>Charrettes ativas</h2></div>
        {ativas.length === 0 && <div className="card vazio">Quando você aceitar um convite, a charrette aparece aqui.</div>}
        <div className="parc-grade">
          {ativas.map(p => (
            <CartaoCharrette key={p.id} p={p}>
              <Link className="btn" to={`/parceiro/${p.charrette.id}`}>Abrir charrette <Icone nome="arrow" cor="#fff" tamanho={16} /></Link>
            </CartaoCharrette>
          ))}
        </div>
      </section>

      {recusadas.length > 0 && (
        <details className="card parc-recusadas">
          <summary>Convites recusados ({recusadas.length})</summary>
          {recusadas.map(p => (
            <div key={p.id} className="parc-recusada">
              <span><b>{p.charrette.nome}</b> <span className="muted">{[p.charrette.cidade, p.charrette.uf].filter(Boolean).join('/')}</span></span>
              <button className="btn ghost sm" onClick={() => responder(p, true)}>Aceitar agora</button>
            </div>
          ))}
        </details>
      )}

      <p className="muted" style={{ fontSize: 13 }}>Dúvidas? Fale com a equipe: <a href={`mailto:${CONTATO_EQUIPE}`}>{CONTATO_EQUIPE}</a></p>
    </div>
  )
}

function CartaoCharrette({ p, children }) {
  const c = p.charrette
  return (
    <div className={`card parc-cartao st-${p.status}`}>
      <div className="parc-cartao-topo">
        <span className={`tag ${p.status === 'confirmado' ? 'done' : p.status === 'convidado' ? 'doing' : 'todo'}`}>
          {p.status === 'confirmado' ? 'Participando' : p.status === 'convidado' ? 'Convite' : 'Recusado'}
        </span>
        {c.data_evento && <span className="parc-data"><Icone nome="calendar" tamanho={15} /> {formatarData(c.data_evento)}</span>}
      </div>
      <h3>{c.naming || c.nome}</h3>
      {c.naming && <span className="muted">{c.nome}</span>}
      <dl className="parc-resumo">
        {(c.cidade || c.uf) && <><dt>Onde</dt><dd>{[c.cidade, c.uf].filter(Boolean).join(' / ')}{c.local_evento ? ` · ${c.local_evento}` : ''}</dd></>}
        {c.cliente && <><dt>Cliente</dt><dd>{c.cliente}</dd></>}
        {p.area && <><dt>Seu papel</dt><dd>{p.area}</dd></>}
        {(c.desafio || c.descricao) && <><dt>O desafio</dt><dd className="parc-desafio">{c.desafio || c.descricao}</dd></>}
      </dl>
      {p.mensagem && <p className="convite-msg">{p.mensagem}</p>}
      {children}
    </div>
  )
}

function CharretteParceiro() {
  const { id } = useParams()
  const base = useCharrette()
  const p = base.parcerias.find(x => x.charrette.id === id && x.status === 'confirmado')
  const [aba, setAba] = useState('resumo')
  if (!p) return <Navigate to="/parceiro" replace />
  const c = p.charrette

  // A charrette do parceiro usa as mesmas telas do app, sem poder de gestão
  const valor = { ...base, atual: c, ehEquipe: false, equipe: [], podeGerir: false, status: {}, atualizar: async () => {} }

  return (
    <CharretteCtx.Provider value={valor}>
      <Link to="/parceiro" className="link-btn muted">← Minhas charrettes</Link>
      <div className="pagehead" style={{ marginTop: 6 }}>
        <div className="eyebrow">{[c.cidade, c.uf].filter(Boolean).join(' / ')}{c.data_evento ? ` · ${formatarData(c.data_evento)}` : ''}</div>
        <h1>{c.naming || c.nome}</h1>
        {c.cliente && <p>Cliente: {c.cliente}</p>}
      </div>
      <div className="tabs parc-abas">
        {[['resumo', 'Resumo'], ['programa', 'Programa'], ['mural', 'Mural de ideias'], ['quadros', 'Quadros'], ['materiais', 'Materiais']].map(([k, r]) => (
          <button key={k} className={aba === k ? 'on' : ''} onClick={() => setAba(k)}>{r}</button>
        ))}
      </div>
      {c.codigo_publico && (
        <a className={`btn ${c.ao_vivo ? 'terra' : 'ghost'} sm`} style={{ marginBottom: 14 }} href={`/ao-vivo/${c.codigo_publico}`} target="_blank" rel="noreferrer">
          <Icone nome="spark" cor={c.ao_vivo ? '#fff' : undefined} tamanho={15} /> {c.ao_vivo ? 'Acompanhar ao vivo agora' : 'Página ao vivo da charrette'}
        </a>
      )}
      {aba === 'resumo' && <ResumoParceiro p={p} />}
      {aba === 'programa' && <ProgramaLeitura charretteId={c.id} />}
      {aba === 'mural' && <Ideias comQuadros={false} />}
      {aba === 'quadros' && <QuadrosOuVazio />}
      {aba === 'materiais' && (
        <div className="stack">
          <Arquivos etapa="conteudo" titulo="Material do workshop" descricao="Apresentações e roteiros da charrette." somenteLeitura />
          <Arquivos etapa="toolbox" titulo="Ferramentas" descricao="Modelos das dinâmicas." somenteLeitura />
        </div>
      )}
    </CharretteCtx.Provider>
  )
}

function QuadrosOuVazio() {
  const [tem, setTem] = useState(null)
  const { atual } = useCharrette()
  useEffect(() => {
    supabase.from('quadros').select('id', { count: 'exact', head: true }).eq('charrette_id', atual.id).then(({ count }) => setTem((count || 0) > 0))
  }, [atual.id])
  if (tem === null) return <div className="vazio">Carregando…</div>
  return tem ? <Quadros /> : <div className="card vazio">A equipe ainda não abriu nenhum quadro (Padlet, Miro…) nesta charrette.</div>
}

function ResumoParceiro({ p }) {
  const c = p.charrette
  return (
    <div className="split">
      <div className="card">
        <h3>O desafio</h3>
        <p className="texto-longo">{c.desafio || c.descricao || 'A equipe ainda vai detalhar o desafio desta charrette.'}</p>
        {c.desafio && c.descricao && <><h3 style={{ marginTop: 16 }}>Sobre o projeto</h3><p className="texto-longo">{c.descricao}</p></>}
      </div>
      <div className="stack">
        <div className="card">
          <h3>Quando e onde</h3>
          <dl className="parc-resumo">
            <dt>Data</dt><dd>{c.data_evento ? formatarData(c.data_evento) : 'A definir'}</dd>
            <dt>Local</dt><dd>{c.local_evento || 'A definir'}</dd>
            <dt>Cidade</dt><dd>{[c.cidade, c.uf].filter(Boolean).join(' / ') || '—'}</dd>
          </dl>
        </div>
        <div className="card">
          <h3>Contato da equipe</h3>
          <p className="muted"><a href={`mailto:${CONTATO_EQUIPE}`}>{CONTATO_EQUIPE}</a></p>
        </div>
      </div>
    </div>
  )
}

function ProgramaLeitura({ charretteId }) {
  const [itens, setItens] = useState(null)
  useEffect(() => {
    supabase.from('programa').select('*').eq('charrette_id', charretteId).order('dia').order('hora').order('ordem')
      .then(({ data }) => setItens(data || []))
  }, [charretteId])
  if (!itens) return <div className="vazio">Carregando…</div>
  if (!itens.length) return <div className="card vazio">O programa ainda não foi publicado.</div>
  const dias = [...new Set(itens.map(i => i.dia))]
  return (
    <div className="card">
      {dias.map(dia => (
        <div key={dia} className="dia-prog">
          <h4>Dia {dia}</h4>
          {itens.filter(i => i.dia === dia).map(i => (
            <div key={i.id} className="prog-leitura">
              <span className="hora">{i.hora?.slice(0, 5) || '—'}</span>
              <div>
                <b>{i.titulo}</b>
                {i.descricao && <p className="muted">{i.descricao}</p>}
                {(i.ferramenta || i.link) && (
                  <p className="muted" style={{ fontSize: 13 }}>{i.ferramenta}{i.link && <> · <a href={i.link} target="_blank" rel="noreferrer">abrir</a></>}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

export function FichaParceiro() {
  const { uid, perfil, recarregarPerfil } = useCharrette()
  const avisar = useAviso()
  const [ficha, setFicha] = useFicha()
  const [nome, setNome] = useState('')
  const [d, setD] = useState(null)
  const [foto, setFoto] = useState(null)
  const input = useRef(null)

  useEffect(() => {
    if (ficha === undefined) return
    const f = ficha || {}
    setNome(perfil?.nome || '')
    setD({
      area: f.area || '', empresa: f.empresa || '', cidade: f.cidade || '', uf: f.uf || '', telefone: f.telefone || '',
      email: f.email || '', bio: f.bio || '', especialidades: (f.especialidades || []).join(', '), portfolio: f.portfolio || '',
    })
    if (f.foto) supabase.storage.from('charrette-arquivos').createSignedUrl(f.foto, 3600).then(({ data }) => setFoto(data?.signedUrl || null))
  }, [ficha])

  if (!d) return <div className="vazio">Carregando…</div>
  const set = k => e => setD(v => ({ ...v, [k]: e.target.value }))

  async function salvar(e) {
    e.preventDefault()
    const dados = {
      ...Object.fromEntries(Object.entries(d).map(([k, v]) => [k, typeof v === 'string' ? v.trim() || null : v])),
      especialidades: d.especialidades.split(',').map(x => x.trim()).filter(Boolean),
    }
    const r = ficha
      ? await supabase.from('parceiro_ficha').update(dados).eq('id', uid).select().single()
      : await supabase.from('parceiro_ficha').insert({ ...dados, id: uid }).select().single()
    if (r.error) return avisar('Não foi possível salvar.')
    if (nome.trim() && nome.trim() !== perfil?.nome) await supabase.from('perfis').update({ nome: nome.trim() }).eq('id', uid)
    setFicha(r.data)
    recarregarPerfil()
    avisar('Cadastro salvo.')
  }

  async function trocarFoto(e) {
    const f = e.target.files[0]; e.target.value = ''
    if (!f) return
    const caminho = `${uid}/perfil/${Date.now()}.${(f.name.split('.').pop() || 'jpg').toLowerCase()}`
    const up = await supabase.storage.from('charrette-arquivos').upload(caminho, f, { contentType: f.type })
    if (up.error) return avisar('Não foi possível enviar a foto.')
    const r = ficha
      ? await supabase.from('parceiro_ficha').update({ foto: caminho }).eq('id', uid).select().single()
      : await supabase.from('parceiro_ficha').insert({ id: uid, foto: caminho }).select().single()
    if (r.error) return avisar('Não foi possível salvar a foto.')
    if (ficha?.foto) supabase.storage.from('charrette-arquivos').remove([ficha.foto])
    setFicha(r.data)
  }

  return (
    <>
      <div className="pagehead">
        <div className="eyebrow">Área do parceiro</div>
        <h1>Meu cadastro</h1>
        <p>É assim que a equipe Charrette conhece você e decide para quais charrettes convidar.</p>
      </div>
      <form className="card" onSubmit={salvar}>
        <div className="ficha-topo">
          <button type="button" className="ficha-foto" onClick={() => input.current.click()} style={foto ? { backgroundImage: `url(${foto})` } : undefined} aria-label="Trocar foto">
            {!foto && iniciaisDe(nome)}
          </button>
          <input ref={input} type="file" accept="image/*" hidden onChange={trocarFoto} />
          <label className="campo" style={{ flex: 1 }}>Nome<input className="input" value={nome} onChange={e => setNome(e.target.value)} required /></label>
        </div>
        <div className="form-grid">
          <label className="campo">Área de atuação
            <select className="input" value={d.area} onChange={set('area')}>
              <option value="">Escolha</option>{AREAS.map(a => <option key={a}>{a}</option>)}
              {d.area && !AREAS.includes(d.area) && <option>{d.area}</option>}
            </select>
          </label>
          <label className="campo">Empresa ou escritório<input className="input" value={d.empresa} onChange={set('empresa')} /></label>
          <label className="campo">Cidade<input className="input" value={d.cidade} onChange={set('cidade')} /></label>
          <label className="campo">UF<input className="input" value={d.uf} onChange={set('uf')} maxLength={2} /></label>
          <label className="campo">Telefone / WhatsApp<input className="input" value={d.telefone} onChange={set('telefone')} inputMode="tel" /></label>
          <label className="campo">E-mail de contato<input className="input" type="email" value={d.email} onChange={set('email')} /></label>
          <label className="campo span-2">Especialidades (separe por vírgula)<input className="input" value={d.especialidades} onChange={set('especialidades')} placeholder="Ex.: loteamentos, drenagem, legislação urbana" /></label>
          <label className="campo span-2">Mini bio<textarea className="input" rows={4} value={d.bio} onChange={set('bio')} placeholder="Sua formação, experiência e o tipo de projeto em que você mais contribui." /></label>
          <label className="campo span-2">Portfólio ou site<input className="input" value={d.portfolio} onChange={set('portfolio')} placeholder="https://…" /></label>
        </div>
        <button className="btn terra">Salvar cadastro</button>
      </form>
    </>
  )
}
