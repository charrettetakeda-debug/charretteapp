import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import Icone from '../components/Icone'
import { LinkConvite, MensagemConvite } from '../components/ConviteParceiro'
import { supabase } from '../lib/supabase'
import { useAviso, useCharrette } from '../lib/contexto'
import { STATUS_PARCEIRO, iniciaisDe } from '../lib/parceiros'
import '../parceiros.css'
import '../ideias.css'

// Parceiros cadastrados (papel parceiro) com a ficha e as charrettes de cada um
export function useCatalogo() {
  const [itens, setItens] = useState(null)
  const carregar = async () => {
    const [{ data: fichas }, { data: vinculos }] = await Promise.all([
      supabase.from('parceiro_ficha').select('*'),
      supabase.from('parceiros').select('id,charrette_id,parceiro_id,status').not('parceiro_id', 'is', null),
    ])
    const fichaDe = Object.fromEntries((fichas || []).map(f => [f.id, f]))
    const ids = new Set((fichas || []).map(f => f.id))
    const { data: perfis } = ids.size ? await supabase.from('perfis').select('id,nome').in('id', [...ids]) : { data: [] }
    const nomes = Object.fromEntries((perfis || []).map(p => [p.id, p]))
    setItens([...ids].map(id => ({
      id, nome: nomes[id]?.nome || fichaDe[id]?.email || 'Parceiro', ficha: fichaDe[id] || {},
      vinculos: (vinculos || []).filter(v => v.parceiro_id === id),
    })).sort((a, b) => a.nome.localeCompare(b.nome)))
  }
  useEffect(() => { carregar() }, [])
  return { itens, recarregar: carregar }
}

function useFiltro(itens) {
  const [busca, setBusca] = useState('')
  const [area, setArea] = useState('')
  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return (itens || []).filter(p =>
      (!area || p.ficha.area === area) &&
      (!q || [p.nome, p.ficha.area, p.ficha.empresa, p.ficha.cidade, p.ficha.bio, ...(p.ficha.especialidades || [])]
        .some(t => t?.toLowerCase().includes(q))))
  }, [itens, busca, area])
  const areas = [...new Set((itens || []).map(p => p.ficha.area).filter(Boolean))].sort()
  const barra = (
    <div className="ideias-barra" style={{ marginBottom: 12 }}>
      <input className="input busca" placeholder="Buscar por nome, área, cidade, especialidade…" value={busca} onChange={e => setBusca(e.target.value)} />
      <select className="input filtro" value={area} onChange={e => setArea(e.target.value)}>
        <option value="">Todas as áreas</option>{areas.map(a => <option key={a}>{a}</option>)}
      </select>
    </div>
  )
  return { filtrados, barra }
}

export function EscolherDoCatalogo({ fechar, escolher, jaIncluidos = [] }) {
  const { itens } = useCatalogo()
  const { filtrados, barra } = useFiltro(itens)
  return (
    <div className="modal-fundo" onMouseDown={e => e.target === e.currentTarget && fechar()}>
      <div className="modal" style={{ width: 'min(720px,100%)' }}>
        <div className="modal-topo"><h3>Convidar do catálogo</h3><button type="button" className="icon-btn" onClick={fechar} aria-label="Fechar" style={{ fontSize: 22 }}>×</button></div>
        {barra}
        {!itens && <div className="vazio">Carregando…</div>}
        {itens?.length === 0 && <div className="vazio">Ninguém se cadastrou como parceiro ainda. Mande o link de cadastro (em Administração → Parceiros).</div>}
        <div className="catalogo-lista">
          {filtrados.map(p => {
            const ja = jaIncluidos.includes(p.id)
            return (
              <button key={p.id} className="catalogo-item" disabled={ja} onClick={() => escolher(p)}>
                <Foto ficha={p.ficha} nome={p.nome} />
                <span className="pessoa-tx"><b>{p.nome}</b><span className="muted">{[p.ficha.area, p.ficha.empresa, [p.ficha.cidade, p.ficha.uf].filter(Boolean).join('/')].filter(Boolean).join(' · ') || 'Cadastro incompleto'}</span></span>
                <span className="selo">{ja ? 'já incluído' : `${p.vinculos.filter(v => v.status === 'confirmado').length} charrettes`}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function Foto({ ficha, nome, grande }) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    if (ficha?.foto) supabase.storage.from('charrette-arquivos').createSignedUrl(ficha.foto, 3600).then(({ data }) => setUrl(data?.signedUrl || null))
  }, [ficha?.foto])
  return <span className={`avatar ${grande ? 'grande' : ''}`} style={url ? { backgroundImage: `url(${url})`, backgroundSize: 'cover', color: 'transparent' } : undefined}>{iniciaisDe(nome)}</span>
}

export default function ParceirosAdmin() {
  const { ehEquipe, perfil, lista } = useCharrette()
  const avisar = useAviso()
  const { itens, recarregar } = useCatalogo()
  const { filtrados, barra } = useFiltro(itens)
  const [aberto, setAberto] = useState(null)
  const [convidarPara, setConvidarPara] = useState(null)   // { pessoa, charretteId }
  const [convite, setConvite] = useState(null)

  if (perfil && !ehEquipe) return <Navigate to="/" replace />
  const linkCadastro = `${window.location.origin}/entrar?parceiro=1`
  const nomeCharrette = id => lista.find(c => c.id === id)?.nome || 'Charrette'

  async function convidar(mensagem) {
    const { pessoa, charretteId } = convidarPara
    const { data, error } = await supabase.from('parceiros').insert({
      charrette_id: charretteId, nome: pessoa.nome, area: pessoa.ficha.area || null,
      contato: pessoa.ficha.telefone || pessoa.ficha.email || null, email: pessoa.ficha.email || null,
      parceiro_id: pessoa.id, status: 'convidado', convidado_em: new Date().toISOString(), mensagem: mensagem?.trim() || null,
    }).select().single()
    if (error) return avisar(/duplicate|unique/.test(error.message) ? 'Essa pessoa já está nessa charrette.' : 'Não foi possível convidar.')
    setConvidarPara(null)
    setConvite({ p: data, charrette: lista.find(c => c.id === charretteId) })
    recarregar()
  }

  return (
    <>
      <div className="pagehead">
        <div className="eyebrow">Administração</div>
        <h1>Parceiros</h1>
        <p>O catálogo de consultores: cada um se cadastra pelo link abaixo e a equipe convida para as charrettes.</p>
      </div>
      <div className="card" style={{ marginBottom: 14 }}>
        <h3 style={{ marginBottom: 6 }}>Link de cadastro de parceiro</h3>
        <div className="envio-link">
          <code>{linkCadastro}</code>
          <button className="btn ghost sm" onClick={async () => { try { await navigator.clipboard.writeText(linkCadastro); avisar('Link copiado.') } catch { window.prompt('Copie:', linkCadastro) } }}><Icone nome="link" tamanho={15} /> Copiar</button>
        </div>
      </div>
      {barra}
      {!itens && <div className="vazio">Carregando…</div>}
      {itens?.length === 0 && <div className="card vazio">Ninguém se cadastrou como parceiro ainda.</div>}
      <div className="catalogo-grade">
        {filtrados.map(p => (
          <div key={p.id} className="card catalogo-cartao">
            <div className="catalogo-cab">
              <Foto ficha={p.ficha} nome={p.nome} grande />
              <div className="pessoa-tx">
                <b>{p.nome}</b>
                <span className="muted">{[p.ficha.area, p.ficha.empresa].filter(Boolean).join(' · ') || 'Cadastro incompleto'}</span>
                {(p.ficha.cidade || p.ficha.uf) && <span className="muted">{[p.ficha.cidade, p.ficha.uf].filter(Boolean).join(' / ')}</span>}
              </div>
            </div>
            {p.ficha.especialidades?.length > 0 && <div className="cartao-meta">{p.ficha.especialidades.map(e => <span key={e} className="selo">{e}</span>)}</div>}
            {p.ficha.bio && <p className={`muted catalogo-bio ${aberto === p.id ? 'aberta' : ''}`} onClick={() => setAberto(aberto === p.id ? null : p.id)}>{p.ficha.bio}</p>}
            <div className="catalogo-contatos">
              {p.ficha.email && <a href={`mailto:${p.ficha.email}`}>{p.ficha.email}</a>}
              {p.ficha.telefone && <span>{p.ficha.telefone}</span>}
              {p.ficha.portfolio && <a href={/^https?:/.test(p.ficha.portfolio) ? p.ficha.portfolio : `https://${p.ficha.portfolio}`} target="_blank" rel="noreferrer">portfólio</a>}
            </div>
            {p.vinculos.length > 0 && (
              <div className="catalogo-vinculos">
                {p.vinculos.map(v => <span key={v.id} className={`tag ${STATUS_PARCEIRO[v.status].classe}`}>{nomeCharrette(v.charrette_id)} · {STATUS_PARCEIRO[v.status].rotulo}</span>)}
              </div>
            )}
            <select className="input" value="" onChange={e => e.target.value && setConvidarPara({ pessoa: p, charretteId: e.target.value })}>
              <option value="">Convidar para uma charrette…</option>
              {lista.filter(c => !p.vinculos.some(v => v.charrette_id === c.id)).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
        ))}
      </div>
      {convidarPara && <MensagemConvite p={convidarPara.pessoa} fechar={() => setConvidarPara(null)} enviar={convidar} />}
      {convite && <LinkConvite p={convite.p} charrette={convite.charrette} fechar={() => setConvite(null)} />}
    </>
  )
}

