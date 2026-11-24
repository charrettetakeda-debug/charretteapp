import { useEffect, useMemo, useState } from 'react'
import Icone from '../components/Icone'
import { BotaoEnviar, abrirArquivo } from '../components/Arquivos'
import EnvioPublicoCard from '../components/EnvioPublicoCard'
import Quadros from '../components/Quadros'
import { apagarArquivo, linkArquivo } from '../lib/dados'
import { supabase } from '../lib/supabase'
import { useAviso, useCharrette } from '../lib/contexto'
import '../ideias.css'

export const STATUS_IDEIA = {
  a_avaliar: { rotulo: 'A avaliar', cor: 'amarelo' },
  aprovada: { rotulo: 'Aprovada', cor: 'verde' },
  em_duvida: { rotulo: 'Em dúvida', cor: 'laranja' },
  ja_existe: { rotulo: 'Já existe', cor: 'azul' },
  descartada: { rotulo: 'Descartada', cor: 'cinza' },
}

/** Mural de ideias da charrette: quadro por status e lista estilo planilha */
export default function Ideias({ comQuadros = true }) {
  const { atual, ehEquipe, podeGerir } = useCharrette()
  const avisar = useAviso()
  const [ideias, setIdeias] = useState(null)
  const [imagens, setImagens] = useState({})        // ideia_id -> [arquivos]
  const [visao, setVisao] = useState(() => { try { return localStorage.getItem('ideias:visao') || 'quadro' } catch { return 'quadro' } })
  const [busca, setBusca] = useState('')
  const [filtroResp, setFiltroResp] = useState('')
  const [aberta, setAberta] = useState(null)       // id da ideia aberta ou 'nova'

  async function carregar() {
    const [{ data: i, error }, { data: a }] = await Promise.all([
      supabase.from('ideias').select('*').eq('charrette_id', atual.id).order('created_at'),
      supabase.from('arquivos').select('*').eq('charrette_id', atual.id).not('ideia_id', 'is', null).order('created_at'),
    ])
    if (error) { avisar('Não foi possível carregar as ideias.'); setIdeias([]); return }
    setIdeias(i)
    const mapa = {}
    ;(a || []).forEach(x => { (mapa[x.ideia_id] ||= []).push(x) })
    setImagens(mapa)
  }
  useEffect(() => { carregar() }, [atual.id])

  function trocarVisao(v) { setVisao(v); try { localStorage.setItem('ideias:visao', v) } catch { /* sem armazenamento */ } }

  async function salvar(id, patch) {
    setIdeias(l => l.map(x => (x.id === id ? { ...x, ...patch } : x)))
    const { error } = await supabase.from('ideias').update(patch).eq('id', id)
    if (error) {
      avisar(/equipe/.test(error.message) ? 'Só a equipe pode mudar status e responsável.' : 'Não foi possível salvar.')
      carregar(); return false
    }
    return true
  }

  async function criar(dados) {
    const { data, error } = await supabase.from('ideias').insert({ ...dados, charrette_id: atual.id }).select().single()
    if (error) { avisar('Não foi possível criar a ideia.'); return null }
    setIdeias(l => [...l, data])
    return data
  }

  async function apagar(ideia) {
    if (!window.confirm(`Apagar a ideia "${ideia.titulo}"? As imagens dela também serão apagadas.`)) return
    for (const arq of imagens[ideia.id] || []) await apagarArquivo(arq).catch(() => {})
    const { error } = await supabase.from('ideias').delete().eq('id', ideia.id)
    if (error) return avisar('Não foi possível apagar.')
    setIdeias(l => l.filter(x => x.id !== ideia.id))
    setAberta(null)
    avisar('Ideia apagada.')
  }

  const filtradas = useMemo(() => {
    if (!ideias) return []
    const q = busca.trim().toLowerCase()
    return ideias.filter(i =>
      (!q || [i.titulo, i.descricao, i.comentarios, i.tema, i.autor_nome].some(t => t?.toLowerCase().includes(q))) &&
      (!filtroResp || (filtroResp === '_sem' ? !i.responsavel_nome : i.responsavel_nome === filtroResp)))
  }, [ideias, busca, filtroResp])

  if (!ideias) return <div className="vazio">Carregando ideias…</div>

  const responsaveis = [...new Set(ideias.map(i => i.responsavel_nome).filter(Boolean))].sort()
  const contagem = Object.fromEntries(Object.keys(STATUS_IDEIA).map(k => [k, ideias.filter(i => i.status === k).length]))
  const ideiaAberta = aberta && aberta !== 'nova' ? ideias.find(i => i.id === aberta) : null

  return (
    <div className="stack">
      <div className="card resumo-ideias">
        <div className="resumo-num"><b>{ideias.length}</b><span>ideias</span></div>
        {Object.entries(STATUS_IDEIA).map(([k, v]) => (
          <div key={k} className={`resumo-num st-${v.cor}`}><b>{contagem[k]}</b><span>{v.rotulo}</span></div>
        ))}
      </div>

      {comQuadros && <Quadros />}

      {podeGerir && <EnvioPublicoCard />}

      <div className="ideias-barra">
        <div className="tabs" style={{ margin: 0 }}>
          <button className={visao === 'quadro' ? 'on' : ''} onClick={() => trocarVisao('quadro')}>Quadro</button>
          <button className={visao === 'lista' ? 'on' : ''} onClick={() => trocarVisao('lista')}>Lista</button>
        </div>
        <input className="input busca" placeholder="Buscar ideia…" value={busca} onChange={e => setBusca(e.target.value)} />
        <select className="input filtro" value={filtroResp} onChange={e => setFiltroResp(e.target.value)}>
          <option value="">Todos os responsáveis</option>
          <option value="_sem">Sem responsável</option>
          {responsaveis.map(r => <option key={r}>{r}</option>)}
        </select>
        <button className="btn terra" onClick={() => setAberta('nova')}><Icone nome="plus" cor="#fff" tamanho={18} /> Nova ideia</button>
      </div>

      {visao === 'quadro'
        ? <Quadro ideias={filtradas} imagens={imagens} ehEquipe={ehEquipe} abrir={setAberta} mover={(id, status) => salvar(id, { status })} />
        : <Lista ideias={filtradas} imagens={imagens} ehEquipe={ehEquipe} abrir={setAberta} salvar={salvar} />}

      {aberta && (
        <DetalheIdeia
          key={aberta}
          ideia={ideiaAberta}
          imagens={ideiaAberta ? imagens[ideiaAberta.id] || [] : []}
          aoMudarImagens={(id, lista) => setImagens(m => ({ ...m, [id]: lista }))}
          salvar={salvar} criar={criar} apagar={apagar}
          fechar={() => setAberta(null)}
          abrirOutra={setAberta}
        />
      )}
    </div>
  )
}

/* ---------------- Quadro (colunas por status) ---------------- */
function Quadro({ ideias, imagens, ehEquipe, abrir, mover }) {
  const [sobre, setSobre] = useState(null)
  return (
    <div className="quadro">
      {Object.entries(STATUS_IDEIA).map(([k, v]) => {
        const doStatus = ideias.filter(i => i.status === k)
        return (
          <div key={k} className={`coluna st-${v.cor} ${sobre === k ? 'sobre' : ''}`}
            onDragOver={ehEquipe ? e => { e.preventDefault(); setSobre(k) } : undefined}
            onDragLeave={() => setSobre(null)}
            onDrop={ehEquipe ? e => { e.preventDefault(); setSobre(null); const id = e.dataTransfer.getData('text/plain'); if (id) mover(id, k) } : undefined}>
            <div className="coluna-topo"><span className="bolinha" />{v.rotulo}<span className="qtd">{doStatus.length}</span></div>
            <div className="coluna-cartoes">
              {doStatus.map(i => <Cartao key={i.id} ideia={i} imgs={imagens[i.id]} arrastavel={ehEquipe} abrir={() => abrir(i.id)} />)}
              {doStatus.length === 0 && <div className="coluna-vazia">{ehEquipe ? 'Arraste ideias para cá' : 'Nenhuma ideia'}</div>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function useMiniatura(arq) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    if (!arq || !/^image\//.test(arq.tipo || '')) return
    linkArquivo(arq).then(setUrl).catch(() => {})
  }, [arq?.id])
  return url
}

function Cartao({ ideia, imgs = [], arrastavel, abrir }) {
  const capa = imgs.find(a => /^image\//.test(a.tipo || ''))
  const url = useMiniatura(capa)
  const qtdIA = imgs.filter(a => a.legenda === 'ia').length
  return (
    <button className="cartao" onClick={abrir} draggable={arrastavel}
      onDragStart={e => e.dataTransfer.setData('text/plain', ideia.id)}>
      {url && <span className="cartao-img" style={{ backgroundImage: `url(${url})` }} />}
      <span className="cartao-corpo">
        {ideia.tema && <span className="cartao-tema">{ideia.tema}</span>}
        <b>{ideia.titulo}</b>
        <span className="cartao-meta">
          {ideia.origem === 'publico' && <span className="selo publico">Participante{ideia.autor_nome ? `: ${ideia.autor_nome}` : ''}</span>}
          {imgs.length > 0 && <span className="selo">{imgs.length} img{qtdIA ? ` · ${qtdIA} IA` : ''}</span>}
          {ideia.comentarios && <span className="selo">comentário</span>}
        </span>
        {ideia.responsavel_nome && <span className="cartao-resp"><span className="mini-avatar">{iniciais(ideia.responsavel_nome)}</span>{ideia.responsavel_nome}</span>}
      </span>
    </button>
  )
}

export const iniciais = n => (n || '?').split(/\s+/).map(x => x[0]).slice(0, 2).join('').toUpperCase()

/* ---------------- Lista (estilo planilha) ---------------- */
function Lista({ ideias, imagens, ehEquipe, abrir, salvar }) {
  const { equipe } = useCharrette()
  if (!ideias.length) return <div className="card vazio">Nenhuma ideia encontrada.</div>
  return (
    <div className="card" style={{ padding: 8 }}>
      <div className="table-wrap">
        <table className="tabela tabela-ideias">
          <thead><tr><th>Ideia</th><th>Referência</th><th>Imagens</th><th>Comentários</th><th>Obs</th><th>Status</th><th>Responsável</th></tr></thead>
          <tbody>
            {ideias.map(i => {
              const imgs = imagens[i.id] || []
              return (
                <tr key={i.id} className={`linha st-${STATUS_IDEIA[i.status].cor}`}>
                  <td className="col-ideia"><button className="link-ideia" onClick={() => abrir(i.id)}>{i.titulo}</button>
                    {i.origem === 'publico' && <span className="selo publico" style={{ marginLeft: 6 }}>Participante</span>}</td>
                  <td className="col-texto">{i.referencia ? (/^https?:\/\//.test(i.referencia) ? <a href={i.referencia} target="_blank" rel="noreferrer">abrir link</a> : i.referencia) : <span className="muted">—</span>}</td>
                  <td>{imgs.length ? <span className="selo">{imgs.length}{imgs.some(a => a.legenda === 'ia') ? ' · IA' : ''}</span> : <span className="muted">—</span>}</td>
                  <td className="col-texto">{i.comentarios || <span className="muted">—</span>}</td>
                  <td className="col-texto">{i.obs || <span className="muted">—</span>}</td>
                  <td>
                    {ehEquipe
                      ? <select className={`status-ideia st-${STATUS_IDEIA[i.status].cor}`} value={i.status} onChange={e => salvar(i.id, { status: e.target.value })}>
                          {Object.entries(STATUS_IDEIA).map(([k, v]) => <option key={k} value={k}>{v.rotulo}</option>)}
                        </select>
                      : <span className={`status-ideia st-${STATUS_IDEIA[i.status].cor}`}>{STATUS_IDEIA[i.status].rotulo}</span>}
                  </td>
                  <td>
                    {ehEquipe
                      ? <SeletorResponsavel ideia={i} equipe={equipe} salvar={salvar} compacto />
                      : (i.responsavel_nome || <span className="muted">—</span>)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SeletorResponsavel({ ideia, equipe, salvar, compacto }) {
  const nomes = equipe.map(p => ({ id: p.id, nome: p.nome || 'Sem nome' }))
  const atualNaLista = nomes.some(n => n.id === ideia.responsavel_id)
  return (
    <select className={compacto ? 'cell-select' : 'input'} value={ideia.responsavel_id || (ideia.responsavel_nome ? '_outro' : '')}
      onChange={e => {
        const v = e.target.value
        if (v === '') return salvar(ideia.id, { responsavel_id: null, responsavel_nome: null })
        if (v === '_digitar') {
          const nome = window.prompt('Nome do responsável:')
          if (nome?.trim()) salvar(ideia.id, { responsavel_id: null, responsavel_nome: nome.trim() })
          return
        }
        const p = nomes.find(n => n.id === v)
        salvar(ideia.id, { responsavel_id: p.id, responsavel_nome: p.nome })
      }}>
      <option value="">{compacto ? '—' : 'Sem responsável'}</option>
      {nomes.map(n => <option key={n.id} value={n.id}>{n.nome}</option>)}
      {!atualNaLista && ideia.responsavel_nome && <option value="_outro">{ideia.responsavel_nome}</option>}
      <option value="_digitar">Outra pessoa…</option>
    </select>
  )
}

/* ---------------- Detalhe / edição da ideia ---------------- */
function DetalheIdeia({ ideia, imagens, aoMudarImagens, salvar, criar, apagar, fechar, abrirOutra }) {
  const { ehEquipe, equipe, podeGerir, uid } = useCharrette()
  const avisar = useAviso()
  const nova = !ideia
  const editavel = nova || ehEquipe || podeGerir || ideia.criado_por === uid
  const [d, setD] = useState({
    titulo: ideia?.titulo || '', descricao: ideia?.descricao || '', tema: ideia?.tema || '',
    referencia: ideia?.referencia || '', comentarios: ideia?.comentarios || '', obs: ideia?.obs || '',
  })
  const [tipoImg, setTipoImg] = useState('referencia')
  const set = k => e => setD(v => ({ ...v, [k]: e.target.value }))

  useEffect(() => {
    const esc = e => e.key === 'Escape' && fechar()
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [])

  async function salvarTudo(e) {
    e?.preventDefault()
    if (!d.titulo.trim()) return avisar('Escreva a ideia.')
    const limpo = Object.fromEntries(Object.entries(d).map(([k, v]) => [k, v.trim() || null]))
    if (nova) {
      const criada = await criar(limpo)
      if (criada) { avisar('Ideia criada. Agora dá para anexar imagens.'); abrirOutra(criada.id) }
    } else if (await salvar(ideia.id, limpo)) { avisar('Ideia salva.'); fechar() }
  }

  async function marcarTipo(arq, legenda) {
    await supabase.from('arquivos').update({ legenda }).eq('id', arq.id)
    aoMudarImagens(ideia.id, imagens.map(a => (a.id === arq.id ? { ...a, legenda } : a)))
  }
  async function removerImagem(arq) {
    if (!window.confirm(`Apagar "${arq.nome}"?`)) return
    await apagarArquivo(arq).catch(() => {})
    aoMudarImagens(ideia.id, imagens.filter(a => a.id !== arq.id))
  }

  return (
    <div className="modal-fundo" onMouseDown={e => e.target === e.currentTarget && fechar()}>
      <form className="modal" onSubmit={salvarTudo}>
        <div className="modal-topo">
          <h3>{nova ? 'Nova ideia' : 'Ideia'}</h3>
          <button type="button" className="icon-btn" onClick={fechar} aria-label="Fechar" style={{ fontSize: 22, lineHeight: 1 }}>×</button>
        </div>

        {ideia?.origem === 'publico' && (
          <div className="alerta ok" style={{ marginBottom: 12 }}>
            Enviada por participante{ideia.autor_nome ? `: ${ideia.autor_nome}` : ''}{ideia.autor_contato ? ` (${ideia.autor_contato})` : ''}.
          </div>
        )}

        <fieldset className="sem-borda" disabled={!editavel}>
        <label className="campo">Ideia
          <textarea className="input" rows={2} value={d.titulo} onChange={set('titulo')} required autoFocus={nova} placeholder="Ex.: Calçadas arborizadas com faixa livre e bancos para descanso" />
        </label>
        <div className="form-grid">
          <label className="campo">Tema (opcional)
            <input className="input" value={d.tema} onChange={set('tema')} placeholder="Mobilidade, praças, acessibilidade…" />
          </label>
          <label className="campo">Referência (link ou texto)
            <input className="input" value={d.referencia} onChange={set('referencia')} placeholder="https://…" />
          </label>
        </div>
        <label className="campo">Detalhes
          <textarea className="input" rows={3} value={d.descricao} onChange={set('descricao')} />
        </label>
        <label className="campo">Comentários
          <textarea className="input" rows={3} value={d.comentarios} onChange={set('comentarios')} placeholder="Por que a ideia é boa, para quem, o que resolve" />
        </label>
        <label className="campo">Obs
          <input className="input" value={d.obs} onChange={set('obs')} />
        </label>
        </fieldset>

        {!nova && (
          <div className="form-grid">
            <label className="campo">Status
              {ehEquipe
                ? <select className="input" value={ideia.status} onChange={e => salvar(ideia.id, { status: e.target.value })}>
                    {Object.entries(STATUS_IDEIA).map(([k, v]) => <option key={k} value={k}>{v.rotulo}</option>)}
                  </select>
                : <span className={`status-ideia st-${STATUS_IDEIA[ideia.status].cor}`} style={{ alignSelf: 'flex-start' }}>{STATUS_IDEIA[ideia.status].rotulo}</span>}
            </label>
            <label className="campo">Responsável
              {ehEquipe
                ? <SeletorResponsavel ideia={ideia} equipe={equipe} salvar={salvar} />
                : <span>{ideia.responsavel_nome || '—'}</span>}
            </label>
          </div>
        )}

        {!nova && (
          <div className="campo">
            Imagens
            <div className="imgs-ideia">
              {imagens.map(a => <ImagemIdeia key={a.id} arq={a} marcarTipo={marcarTipo} remover={removerImagem} editavel={editavel} />)}
              {!imagens.length && !editavel && <span className="muted">Sem imagens.</span>}
            </div>
            {editavel && <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
              <select className="input" style={{ width: 'auto' }} value={tipoImg} onChange={e => setTipoImg(e.target.value)}>
                <option value="referencia">Imagem de referência</option>
                <option value="ia">Imagem IA</option>
              </select>
              <BotaoEnviar etapa="ideias" aceitar="image/*,application/pdf" rotulo="Enviar imagens"
                aoEnviar={async novos => {
                  await supabase.from('arquivos').update({ ideia_id: ideia.id, legenda: tipoImg }).in('id', novos.map(n => n.id))
                  aoMudarImagens(ideia.id, [...imagens, ...novos.map(n => ({ ...n, ideia_id: ideia.id, legenda: tipoImg }))])
                }} />
            </div>}
          </div>
        )}

        <div className="modal-acoes">
          {!nova && editavel && <button type="button" className="btn ghost perigo" onClick={() => apagar(ideia)}><Icone nome="trash" tamanho={16} /> Apagar</button>}
          <span style={{ flex: 1 }} />
          <button type="button" className="btn ghost" onClick={fechar}>{editavel ? 'Cancelar' : 'Fechar'}</button>
          {editavel && <button className="btn terra">{nova ? 'Criar ideia' : 'Salvar'}</button>}
        </div>
      </form>
    </div>
  )
}

function ImagemIdeia({ arq, marcarTipo, remover, editavel = true }) {
  const avisar = useAviso()
  const url = useMiniatura(arq)
  return (
    <figure className="img-ideia">
      <button type="button" className="thumb-img" style={url ? { backgroundImage: `url(${url})` } : undefined} onClick={() => abrirArquivo(arq, avisar)} aria-label={`Abrir ${arq.nome}`}>
        {!url && <span className="ext-grande">{(arq.nome.split('.').pop() || '').toUpperCase()}</span>}
      </button>
      <figcaption>
        {editavel ? (
          <>
            <select className="cell-select" value={arq.legenda === 'ia' ? 'ia' : 'referencia'} onChange={e => marcarTipo(arq, e.target.value)}>
              <option value="referencia">Referência</option>
              <option value="ia">IA</option>
            </select>
            <button type="button" className="icon-btn" onClick={() => remover(arq)} aria-label="Apagar imagem"><Icone nome="trash" tamanho={14} /></button>
          </>
        ) : <span className="muted" style={{ fontSize: 12 }}>{arq.legenda === 'ia' ? 'Imagem IA' : 'Referência'}</span>}
      </figcaption>
    </figure>
  )
}
