import { useState } from 'react'
import Icone from '../components/Icone'
import { Arquivos } from '../components/Arquivos'
import { Campo, Salvo } from '../components/Campos'
import { useLista, useRegistro } from '../lib/dados'

const PAPEIS = ['Família / proprietário', 'Equipe Takeda Design', 'Representante local', 'Órgão público', 'Empresário local',
  'Incorporador convidado', 'Arquiteto / urbanista do projeto', 'Arquiteto / urbanista convidado', 'Especialista', 'Outro']

const paraInputDataHora = iso => (iso ? new Date(iso).toLocaleString('sv-SE', { hour12: false }).slice(0, 16).replace(' ', 'T') : '')

export default function Briefing() {
  const { dados, salvar, salvoEm } = useRegistro('briefing')
  const part = useLista('participantes')
  if (!dados) return <div className="vazio">Carregando…</div>

  return (
    <div className="stack">
      <div className="card">
        <div className="card-head"><div><h3>Ata da reunião de briefing</h3><p className="muted">O registro do que foi combinado antes do evento.</p></div><Salvo quando={salvoEm} /></div>
        <div className="form-grid">
          <Campo rotulo="Data e hora" tipo="datetime-local" valor={paraInputDataHora(dados.data_reuniao)}
            aoSalvar={v => salvar({ data_reuniao: v ? new Date(v).toISOString() : null })} />
          <Campo rotulo="Local" valor={dados.local} aoSalvar={v => salvar({ local: v })} placeholder="Online, escritório, no terreno…" />
          <Campo rotulo="Pauta" tipo="textarea" linhas={3} classe="span-2" valor={dados.pauta} aoSalvar={v => salvar({ pauta: v })}
            placeholder="O que foi discutido" />
          <Campo rotulo="Decisões" tipo="textarea" linhas={5} classe="span-2" valor={dados.decisoes} aoSalvar={v => salvar({ decisoes: v })}
            placeholder="O que ficou decidido (uma decisão por linha)" />
        </div>
        <p className="muted">Os <b className="ink">encaminhamentos</b> (quem faz o quê e até quando) ficam nos próximos passos desta etapa, mais abaixo.</p>
      </div>

      <div className="card">
        <div className="card-head"><div><h3>Participantes da charrette</h3><p className="muted">Quem vai estar no evento. {part.itens ? `${part.itens.length} pessoa${part.itens.length === 1 ? '' : 's'}.` : ''}</p></div></div>
        {part.itens?.length === 0 && <div className="vazio">Nenhum participante ainda.</div>}
        <div className="pessoas">
          {part.itens?.map(p => (
            <div className="pessoa" key={p.id}>
              <span className="avatar">{p.nome.split(' ').map(x => x[0]).slice(0, 2).join('').toUpperCase()}</span>
              <div className="pessoa-tx"><b>{p.nome}</b><span className="muted">{[p.papel, p.contato].filter(Boolean).join(' · ')}</span></div>
              <button className="icon-btn" onClick={() => part.remover(p.id)} aria-label={`Remover ${p.nome}`}><Icone nome="trash" tamanho={16} /></button>
            </div>
          ))}
        </div>
        <NovoParticipante adicionar={part.adicionar} />
      </div>

      <Arquivos etapa="briefing" titulo="Anexos do briefing" descricao="Ata em PDF, gravação ou apresentação da reunião." />
    </div>
  )
}

function NovoParticipante({ adicionar }) {
  const [d, setD] = useState({ nome: '', papel: '', contato: '' })
  const set = k => e => setD(v => ({ ...v, [k]: e.target.value }))
  async function enviar(e) {
    e.preventDefault()
    if (!d.nome.trim()) return
    if (await adicionar({ nome: d.nome.trim(), papel: d.papel || null, contato: d.contato.trim() || null })) setD({ nome: '', papel: '', contato: '' })
  }
  return (
    <form onSubmit={enviar} className="linha-add tres">
      <input className="input" placeholder="Nome" value={d.nome} onChange={set('nome')} />
      <select className="input" value={d.papel} onChange={set('papel')}>
        <option value="">Papel (opcional)</option>{PAPEIS.map(p => <option key={p}>{p}</option>)}
      </select>
      <input className="input" placeholder="E-mail ou telefone (opcional)" value={d.contato} onChange={set('contato')} />
      <button className="btn"><Icone nome="plus" cor="#fff" tamanho={18} /> Incluir</button>
    </form>
  )
}
