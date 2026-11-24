import { useCallback, useEffect, useState } from 'react'
import Icone from './Icone'
import { supabase } from '../lib/supabase'
import { ETAPAS, TODAS_ETAPAS, formatarData } from '../lib/estrutura'
import { useAviso, useCharrette } from '../lib/contexto'

export function useTarefas(filtroEtapa) {
  const { atual } = useCharrette()
  const [tarefas, setTarefas] = useState(null)
  const avisar = useAviso()

  const carregar = useCallback(async () => {
    let q = supabase.from('tarefas').select('*').eq('charrette_id', atual.id)
    if (filtroEtapa) q = q.eq('etapa', filtroEtapa)
    const { data, error } = await q.order('feito').order('prazo', { nullsFirst: false }).order('created_at')
    if (error) { avisar('Não foi possível carregar os próximos passos.'); setTarefas([]); return }
    setTarefas(data)
  }, [atual.id, filtroEtapa])

  useEffect(() => { carregar() }, [carregar])

  async function adicionar(t) {
    const { data, error } = await supabase.from('tarefas')
      .insert({ ...t, charrette_id: atual.id }).select().single()
    if (error) { avisar('Não foi possível salvar.'); return false }
    setTarefas(l => [...l, data])
    return true
  }
  async function alternar(t) {
    setTarefas(l => l.map(x => (x.id === t.id ? { ...x, feito: !x.feito } : x)))
    const { error } = await supabase.from('tarefas').update({ feito: !t.feito }).eq('id', t.id)
    if (error) { avisar('Não foi possível salvar.'); carregar() }
  }
  async function remover(t) {
    setTarefas(l => l.filter(x => x.id !== t.id))
    const { error } = await supabase.from('tarefas').delete().eq('id', t.id)
    if (error) { avisar('Não foi possível apagar.'); carregar() }
  }
  return { tarefas, adicionar, alternar, remover }
}

function situacaoPrazo(prazo, feito) {
  if (!prazo || feito) return ''
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  const p = new Date(prazo + 'T00:00:00')
  if (p < hoje) return 'atrasado'
  if (p.getTime() === hoje.getTime()) return 'hoje'
  return ''
}

export function ListaTarefas({ tarefas, alternar, remover, limite, mostrarEtapa = true }) {
  if (tarefas === null) return <div className="vazio">Carregando…</div>
  const pendentes = tarefas.filter(t => !t.feito)
  const feitas = tarefas.filter(t => t.feito)
  const visiveis = limite ? pendentes.slice(0, limite) : [...pendentes, ...feitas]

  if (!visiveis.length) {
    return <div className="vazio">{feitas.length ? 'Tudo em dia. Nenhum passo pendente.' : 'Nenhum próximo passo ainda. Adicione o primeiro.'}</div>
  }

  return (
    <div>
      {visiveis.map(t => {
        const sit = situacaoPrazo(t.prazo, t.feito)
        return (
          <div key={t.id} className={`todo ${t.feito ? 'on' : ''}`}>
            <button className={`check ${t.feito ? 'on' : ''}`} onClick={() => alternar(t)} aria-label={t.feito ? 'Marcar como não feito' : 'Marcar como feito'}>
              {t.feito && <Icone nome="check" cor="#fff" tamanho={14} />}
            </button>
            <div className="todo-tx">
              <div className="tt">{t.titulo}</div>
              <span className="muted">
                {[mostrarEtapa && t.etapa && ETAPAS[t.etapa]?.titulo, t.responsavel].filter(Boolean).join(' · ')}
                {t.prazo && <span className={`prazo ${sit}`}>{(mostrarEtapa && t.etapa) || t.responsavel ? ' · ' : ''}
                  {sit === 'atrasado' ? 'atrasado · ' : sit === 'hoje' ? 'hoje · ' : 'até '}{formatarData(t.prazo)}</span>}
              </span>
            </div>
            <button className="icon-btn" onClick={() => remover(t)} aria-label="Apagar"><Icone nome="trash" tamanho={17} /></button>
          </div>
        )
      })}
    </div>
  )
}

export function NovaTarefa({ adicionar, etapaFixa }) {
  const [titulo, setTitulo] = useState('')
  const [etapa, setEtapa] = useState(etapaFixa || '')
  const [prazo, setPrazo] = useState('')
  const [responsavel, setResponsavel] = useState('')
  const [aberto, setAberto] = useState(false)

  async function enviar(e) {
    e.preventDefault()
    if (!titulo.trim()) return
    const ok = await adicionar({ titulo: titulo.trim(), etapa: etapa || null, prazo: prazo || null, responsavel: responsavel.trim() || null })
    if (ok) { setTitulo(''); setPrazo(''); setResponsavel(''); if (!etapaFixa) setEtapa('') }
  }

  return (
    <form onSubmit={enviar} className="nova-tarefa">
      <div className="linha">
        <input className="input" placeholder="Novo próximo passo…" value={titulo} onChange={e => setTitulo(e.target.value)} onFocus={() => setAberto(true)} />
        <button className="btn" aria-label="Adicionar"><Icone nome="plus" cor="#fff" tamanho={18} /></button>
      </div>
      {aberto && (
        <div className="extras">
          {!etapaFixa && (
            <select className="input" value={etapa} onChange={e => setEtapa(e.target.value)}>
              <option value="">Etapa (opcional)</option>
              {TODAS_ETAPAS.map(x => <option key={x.id} value={x.id}>{x.titulo}</option>)}
            </select>
          )}
          <input className="input" placeholder="Responsável (opcional)" value={responsavel} onChange={e => setResponsavel(e.target.value)} />
          <label className="prazo-campo"><Icone nome="clock" tamanho={16} />
            <input className="input" type="date" value={prazo} onChange={e => setPrazo(e.target.value)} aria-label="Prazo" />
          </label>
        </div>
      )}
    </form>
  )
}
