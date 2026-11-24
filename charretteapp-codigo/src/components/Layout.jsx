import { useEffect, useRef } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import Icone from './Icone'
import { ETAPAS, FASE } from '../lib/estrutura'
import { useCharrette, useSessao } from '../lib/contexto'
import { supabase } from '../lib/supabase'
import '../admin.css'

const corDot = { concluido: 'done', em_andamento: 'doing', a_fazer: '' }

export default function Layout() {
  const { atual, lista, status, escolher, ehEquipe, perfil, parcerias, fases: FASES } = useCharrette()
  const { sessao } = useSessao()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const mainRef = useRef(null)

  useEffect(() => { mainRef.current?.scrollTo(0, 0) }, [pathname])

  const etapaId = pathname.startsWith('/etapa/') ? pathname.split('/')[2] : null
  const faseId = pathname.startsWith('/fase/') ? pathname.split('/')[2] : etapaId ? ETAPAS[etapaId]?.fase.id : null
  const etapa = etapaId ? ETAPAS[etapaId] : null
  const fase = faseId ? FASE[faseId] : null
  const tituloPagina = etapa?.titulo
    || (pathname.startsWith('/fase/') && fase?.nome)
    || (pathname === '/proximos-passos' && 'Próximos passos')
    || (pathname === '/minha-charrette' && 'Minha charrette')
    || (pathname === '/admin/questionario' && 'Questionário')
    || (pathname === '/admin/cases' && 'Cases do site')
    || (pathname === '/admin/charrettes' && 'Todas as charrettes')
    || (pathname === '/admin/parceiros' && 'Parceiros')
    || (pathname === '/admin/tipos' && 'Tipos de charrette')
    || 'Charrette'
  const voltarPara = etapa ? `/fase/${etapa.fase.id}` : pathname === '/' ? null : '/'

  async function sair() {
    await supabase.auth.signOut()
    navigate('/')
  }

  const nomeLogado = perfil?.nome?.trim()
  const iniciais = nomeLogado
    ? nomeLogado.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase()
    : (sessao?.user?.email || '?').slice(0, 2).toUpperCase()

  return (
    <div className="shell">
      <aside className="side">
        <Link to="/" className="brand"><img src="/marca.png" alt="" /><span>Charrette</span></Link>

        <div className="proj">
          <small>Minha charrette</small>
          {lista.length > 1 ? (
            <select value={atual.id} onChange={e => { escolher(e.target.value); navigate('/') }}>
              {lista.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          ) : <span className="proj-nome">{atual.nome}</span>}
          <div className="proj-acoes">
            <Link to="/minha-charrette"><Icone nome="gear" tamanho={14} /> Dados</Link>
            <Link to="/nova"><Icone nome="plus" tamanho={14} /> Nova</Link>
          </div>
        </div>

        <NavLink end to="/" className="navlink"><Icone nome="home" />Início</NavLink>
        <NavLink to="/proximos-passos" className="navlink"><Icone nome="check" />Próximos passos</NavLink>
        {FASES.map(f => (
          <div className="navgroup" key={f.id}>
            <NavLink to={`/fase/${f.id}`} className="navlink"><span className="num">{f.num}</span>{f.nome}</NavLink>
            <div className="sub">
              {f.etapas.map(e => (
                <NavLink key={e.id} to={`/etapa/${e.id}`} className="navlink">
                  <span className={`dot ${corDot[status[e.id]] || ''}`} />{e.titulo}
                </NavLink>
              ))}
            </div>
          </div>
        ))}

        {ehEquipe && (
          <div className="navgroup">
            <div className="navlink nav-titulo"><span className="num">ADM</span>Administração</div>
            <div className="sub">
              <NavLink to="/admin/charrettes" className="navlink"><Icone nome="grid" tamanho={16} />Todas as charrettes</NavLink>
              <NavLink to="/admin/parceiros" className="navlink"><Icone nome="users" tamanho={16} />Parceiros</NavLink>
              <NavLink to="/admin/tipos" className="navlink"><Icone nome="layers" tamanho={16} />Tipos de charrette</NavLink>
              <NavLink to="/admin/questionario" className="navlink"><Icone nome="mic" tamanho={16} />Questionário</NavLink>
              <NavLink to="/admin/cases" className="navlink"><Icone nome="globe" tamanho={16} />Cases do site</NavLink>
            </div>
          </div>
        )}

        {parcerias?.length > 0 && (
          <NavLink to="/parceiro" className="navlink"><Icone nome="users" />Área do parceiro</NavLink>
        )}

        <div className="foot">
          <span className="email">{nomeLogado && <b style={{ display: 'block', color: '#fff' }}>{nomeLogado}</b>}{sessao?.user?.email}{ehEquipe ? ' · equipe' : ''}</span>
          <a href="/site" target="_blank" rel="noreferrer" className="sair"><Icone nome="globe" tamanho={16} /> Ver o site</a>
          <button onClick={sair} className="sair"><Icone nome="logout" tamanho={16} /> Sair</button>
        </div>
      </aside>

      <header className="top">
        {voltarPara
          ? <Link className="back" to={voltarPara} aria-label="Voltar"><Icone nome="back" /></Link>
          : <img src="/marca.png" alt="" width="32" />}
        <span className="t">{tituloPagina}</span>
        {!voltarPara && (
          <details className="menu-user">
            <summary className="avatar">{iniciais}</summary>
            <div className="menu-pop">
              <Link to="/minha-charrette">Dados da charrette</Link>
              <Link to="/nova">Nova charrette</Link>
              {ehEquipe && <Link to="/admin/charrettes">Todas as charrettes</Link>}
              {ehEquipe && <Link to="/admin/parceiros">Parceiros</Link>}
              {ehEquipe && <Link to="/admin/tipos">Tipos de charrette</Link>}
              {ehEquipe && <Link to="/admin/questionario">Questionário (admin)</Link>}
              {parcerias?.length > 0 && <Link to="/parceiro">Área do parceiro</Link>}
              {ehEquipe && <Link to="/admin/cases">Cases do site</Link>}
              <button onClick={sair}>Sair</button>
            </div>
          </details>
        )}
      </header>

      <main ref={mainRef}>
        {(etapa || fase || pathname !== '/') && (
          <div className="crumb">
            <Link to="/">Início</Link>
            {fase && <> / <Link to={`/fase/${fase.id}`}>{fase.nome}</Link></>}
            {etapa && <> / {etapa.titulo}</>}
            {!fase && pathname !== '/' && <> / {tituloPagina}</>}
          </div>
        )}
        <div className="view"><Outlet /></div>
      </main>

      <nav className="tabbar">
        <NavLink end to="/"><Icone nome="home" />Início</NavLink>
        {FASES.map(f => (
          <NavLink key={f.id} to={`/fase/${f.id}`} className={() => (faseId === f.id ? 'active' : '')}>
            <Icone nome={f.icone} />{f.aba}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
