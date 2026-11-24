import { useState } from 'react'
import Icone from '../components/Icone'
import { useLista } from '../lib/dados'
import { supabase } from '../lib/supabase'
import { useAviso, useCharrette } from '../lib/contexto'
import { AREAS, STATUS_PARCEIRO, iniciaisDe } from '../lib/parceiros'
import { LinkConvite, MensagemConvite } from '../components/ConviteParceiro'
import { EscolherDoCatalogo } from '../pages/ParceirosAdmin'
import '../parceiros.css'
import '../ideias.css'

export { STATUS_PARCEIRO }

export default function Parceiros() {
  const { atual, ehEquipe } = useCharrette()
  const avisar = useAviso()
  const parc = useLista('parceiros')
  const [filtro, setFiltro] = useState('todos')
  const [convite, setConvite] = useState(null)      // linha para mostrar o link
  const [convidando, setConvidando] = useState(null) // linha para escrever a mensagem
  const [catalogo, setCatalogo] = useState(false)

  if (!parc.itens) return <div className="vazio">Carregando…</div>
  const contagem = Object.fromEntries(Object.keys(STATUS_PARCEIRO).map(k => [k, parc.itens.filter(p => p.status === k).length]))
  const visiveis = filtro === 'todos' ? parc.itens : parc.itens.filter(p => p.status === filtro)

  async function convidar(p, mensagem) {
    const patch = { status: 'convidado', convidado_em: new Date().toISOString(), mensagem: mensagem?.trim() || null }
    if (!(await parc.atualizar(p.id, patch))) return
    setConvidando(null)
    setConvite({ ...p, ...patch })
  }

  async function doCatalogo(pessoa) {
    if (parc.itens.some(x => x.parceiro_id === pessoa.id)) return avisar('Essa pessoa já está nesta charrette.')
    const { data, error } = await supabase.from('parceiros').insert({
      charrette_id: atual.id, nome: pessoa.nome || 'Parceiro', area: pessoa.ficha?.area || null,
      contato: pessoa.ficha?.telefone || pessoa.ficha?.email || null, email: pessoa.ficha?.email || null,
      parceiro_id: pessoa.id, status: 'a_convidar',
    }).select().single()
    if (error) return avisar('Não foi possível incluir.')
    await parc.recarregar()
    setCatalogo(false)
    setConvidando(data)
  }

  return (
    <div className="stack">
      <div className="card">
        <div className="card-head">
          <div>
            <h3>Parceiros da charrette</h3>
            <p className="muted">{ehEquipe
              ? 'Consultores e especialistas desta charrette. Convide do catálogo ou por link.'
              : 'Consultores e especialistas desta charrette. Sugira nomes: a equipe Charrette cuida dos convites.'}</p>
          </div>
          {ehEquipe && <button className="btn terra sm" onClick={() => setCatalogo(true)}><Icone nome="users" cor="#fff" tamanho={15} /> Convidar do catálogo</button>}
        </div>
        <div className="opts" style={{ marginBottom: 14 }}>
          <button className={`opt ${filtro === 'todos' ? 'on' : ''}`} onClick={() => setFiltro('todos')}>Todos ({parc.itens.length})</button>
          {Object.entries(STATUS_PARCEIRO).map(([k, v]) => (
            <button key={k} className={`opt ${filtro === k ? 'on' : ''}`} onClick={() => setFiltro(k)}>{v.rotulo} ({contagem[k]})</button>
          ))}
        </div>
        {visiveis.length === 0 && <div className="vazio">{parc.itens.length ? 'Nenhum parceiro nesta situação.' : ehEquipe ? 'Nenhum parceiro ainda. Convide do catálogo ou inclua pelo nome.' : 'Nenhum parceiro ainda. Sugira o primeiro abaixo.'}</div>}
        <div className="parceiros">
          {visiveis.map(p => (
            <div className="parceiro" key={p.id}>
              <span className="avatar">{iniciaisDe(p.nome)}</span>
              <div className="pessoa-tx">
                <b>{p.nome} {p.parceiro_id && <span className="selo" title="Tem cadastro de parceiro no app">cadastrado</span>}</b>
                <span className="muted">{[p.area, p.contato].filter(Boolean).join(' · ')}</span>
              </div>
              {ehEquipe ? (
                <div className="parceiro-acoes">
                  {p.status === 'a_convidar' && <button className="btn sm" onClick={() => setConvidando(p)}>Convidar</button>}
                  {p.status === 'convidado' && <button className="btn ghost sm" onClick={() => setConvite(p)}><Icone nome="link" tamanho={14} /> Link do convite</button>}
                  <select className={`status-select ${STATUS_PARCEIRO[p.status].classe}`} value={p.status} onChange={e => parc.atualizar(p.id, { status: e.target.value })} aria-label="Situação">
                    {Object.entries(STATUS_PARCEIRO).map(([k, v]) => <option key={k} value={k}>{v.rotulo}</option>)}
                  </select>
                  <button className="icon-btn" onClick={() => window.confirm(`Tirar ${p.nome} desta charrette?`) && parc.remover(p.id)} aria-label={`Remover ${p.nome}`}><Icone nome="trash" tamanho={16} /></button>
                </div>
              ) : (
                <div className="parceiro-acoes">
                  <span className={`tag ${STATUS_PARCEIRO[p.status].classe}`}>{STATUS_PARCEIRO[p.status].rotulo}</span>
                  {p.status === 'a_convidar' && <button className="icon-btn" onClick={() => window.confirm(`Remover a sugestão ${p.nome}?`) && parc.remover(p.id)} aria-label={`Remover ${p.nome}`}><Icone nome="trash" tamanho={16} /></button>}
                </div>
              )}
            </div>
          ))}
        </div>
        <NovoParceiro adicionar={parc.adicionar} rotulo={ehEquipe ? 'Incluir' : 'Sugerir'} />
      </div>

      {!ehEquipe && (
        <div className="card catalogo">
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}><Icone nome="users" cor="var(--ink-3)" /><h3 style={{ margin: 0 }}>Como funciona</h3></div>
          <p className="muted" style={{ marginTop: 6 }}>A equipe Charrette tem um catálogo de consultores. Ela convida os parceiros certos para a sua charrette, incluindo os que você sugerir. Quem aceita aparece aqui como confirmado.</p>
        </div>
      )}

      {catalogo && <EscolherDoCatalogo fechar={() => setCatalogo(false)} escolher={doCatalogo} jaIncluidos={parc.itens.map(x => x.parceiro_id).filter(Boolean)} />}
      {convidando && <MensagemConvite p={convidando} fechar={() => setConvidando(null)} enviar={m => convidar(convidando, m)} />}
      {convite && <LinkConvite p={convite} charrette={atual} fechar={() => setConvite(null)} />}
    </div>
  )
}

function NovoParceiro({ adicionar, rotulo }) {
  const [d, setD] = useState({ nome: '', area: '', contato: '' })
  const set = k => e => setD(v => ({ ...v, [k]: e.target.value }))
  async function enviar(e) {
    e.preventDefault()
    if (!d.nome.trim()) return
    const contato = d.contato.trim() || null
    if (await adicionar({ nome: d.nome.trim(), area: d.area || null, contato, email: contato && /@/.test(contato) ? contato : null })) setD({ nome: '', area: '', contato: '' })
  }
  return (
    <form onSubmit={enviar} className="linha-add tres">
      <input className="input" placeholder="Nome do parceiro" value={d.nome} onChange={set('nome')} />
      <select className="input" value={d.area} onChange={set('area')}>
        <option value="">Área (opcional)</option>{AREAS.map(a => <option key={a}>{a}</option>)}
      </select>
      <input className="input" placeholder="E-mail ou telefone (opcional)" value={d.contato} onChange={set('contato')} />
      <button className="btn"><Icone nome="plus" cor="#fff" tamanho={18} /> {rotulo}</button>
    </form>
  )
}
