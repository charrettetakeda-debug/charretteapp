import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import Icone from '../components/Icone'
import { supabase } from '../lib/supabase'
import { useAviso, useCharrette } from '../lib/contexto'
import { agruparPorBloco, usePerguntas } from '../etapas/Entrevista'
import { EditorPergunta, TIPOS_RESPOSTA as TIPOS, gerarIdPergunta as gerarId } from '../components/EditorPergunta'
import { useModelos } from '../lib/modelos'
import { useTipos } from '../lib/tipos'
import '../toolbox.css'

export default function QuestionarioAdmin() {
  const { ehEquipe, perfil } = useCharrette()
  const avisar = useAviso()
  const { perguntas, setPerguntas, recarregar } = usePerguntas({ incluirInativas: true })
  const [editando, setEditando] = useState(null)
  const [aba, setAba] = useState('modelos')

  if (perfil && !ehEquipe) return <Navigate to="/" replace />
  if (!perguntas) return <div className="vazio">Carregando…</div>

  const blocos = agruparPorBloco(perguntas)
  const nomesBlocos = [...new Set(perguntas.map(p => p.bloco))]

  async function salvar(p, patch) {
    const { error } = await supabase.from('perguntas').update(patch).eq('id', p.id)
    if (error) { avisar('Não foi possível salvar.'); return false }
    setPerguntas(l => l.map(x => (x.id === p.id ? { ...x, ...patch } : x)))
    avisar('Pergunta salva.')
    return true
  }

  async function criar(dados) {
    const ultimaDoBloco = [...perguntas].reverse().find(p => p.bloco === dados.bloco)
    const ordem = ultimaDoBloco ? ultimaDoBloco.ordem + 1 : Math.max(0, ...perguntas.map(p => p.ordem)) + 10
    const { error } = await supabase.from('perguntas').insert({ ...dados, id: gerarId(dados.texto), ordem })
    if (error) { avisar('Não foi possível criar.'); return false }
    await recarregar()
    avisar('Pergunta criada. Inclua nos modelos que devem usá-la, na aba Modelos.')
    return true
  }

  async function mover(p, direcao) {
    const i = perguntas.findIndex(x => x.id === p.id)
    const j = i + direcao
    if (j < 0 || j >= perguntas.length) return
    const outra = perguntas[j]
    if (outra.bloco !== p.bloco) {
      await salvar(p, { bloco: outra.bloco, ordem: outra.ordem + (direcao > 0 ? 1 : -1) })
      return recarregar()
    }
    const a = { ordem: outra.ordem }, b = { ordem: p.ordem }
    await Promise.all([
      supabase.from('perguntas').update(a).eq('id', p.id),
      supabase.from('perguntas').update(b).eq('id', outra.id),
    ])
    recarregar()
  }

  async function renomearBloco(antigo) {
    const novo = window.prompt('Novo nome do bloco:', antigo)
    if (!novo || novo.trim() === antigo) return
    const { error } = await supabase.from('perguntas').update({ bloco: novo.trim() }).eq('bloco', antigo)
    if (error) return avisar('Não foi possível renomear.')
    recarregar()
  }

  const ativas = perguntas.filter(p => p.ativo).length

  return (
    <>
      <div className="pagehead">
        <div className="eyebrow">Administração</div>
        <h1>Questionário da entrevista</h1>
        <p>{aba === 'modelos'
          ? 'Modelos são listas prontas de perguntas (ex.: Urbanismo, Loteamento). Cada tipo de charrette já começa com um modelo, e a equipe pode trocar, juntar modelos ou ajustar as perguntas em cada charrette.'
          : `${ativas} perguntas ativas. O banco de perguntas alimenta os modelos. Perguntas desativadas somem de todos os modelos, mas as respostas já dadas continuam guardadas.`}</p>
        <div className="tabs" style={{ marginTop: 14 }}>
          <button className={aba === 'modelos' ? 'on' : ''} onClick={() => setAba('modelos')}>Modelos de perguntas</button>
          <button className={aba === 'perguntas' ? 'on' : ''} onClick={() => setAba('perguntas')}>Banco de perguntas</button>
        </div>
      </div>

      {aba === 'modelos' ? <ModelosAdmin perguntas={perguntas.filter(p => p.ativo)} /> : (
      <div className="stack">
        {blocos.map(b => (
          <div className="card" key={b.titulo}>
            <div className="card-head">
              <h3>{b.titulo}</h3>
              <button className="btn ghost sm" onClick={() => renomearBloco(b.titulo)}><Icone nome="pencil" tamanho={15} /> Renomear bloco</button>
            </div>
            {b.perguntas.map(p => (
              editando === p.id
                ? <EditorPergunta key={p.id} inicial={p} blocos={nomesBlocos} aoCancelar={() => setEditando(null)}
                    aoSalvar={async d => { if (await salvar(p, d)) setEditando(null) }} />
                : (
                  <div className={`adm-q ${p.ativo ? '' : 'inativa'}`} key={p.id}>
                    <div className="adm-ordem">
                      <button className="icon-btn" onClick={() => mover(p, -1)} aria-label="Subir"><Icone nome="up" tamanho={16} /></button>
                      <button className="icon-btn" onClick={() => mover(p, 1)} aria-label="Descer"><Icone nome="down" tamanho={16} /></button>
                    </div>
                    <div className="adm-tx">
                      <b>{p.texto}</b>
                      <span className="muted">{TIPOS[p.tipo]}{p.opcoes?.length ? ` · ${p.opcoes.join(' / ')}` : ''}{!p.ativo ? ' · desativada' : ''}</span>
                    </div>
                    <button className="btn ghost sm" onClick={() => salvar(p, { ativo: !p.ativo })}>{p.ativo ? 'Desativar' : 'Reativar'}</button>
                    <button className="btn ghost sm" onClick={() => setEditando(p.id)}><Icone nome="pencil" tamanho={15} /> Editar</button>
                  </div>
                )
            ))}
          </div>
        ))}

        <div className="card">
          {editando === 'nova'
            ? <EditorPergunta blocos={nomesBlocos} novo aoCancelar={() => setEditando(null)}
                aoSalvar={async d => { if (await criar(d)) setEditando(null) }} />
            : <button className="btn terra" onClick={() => setEditando('nova')}><Icone nome="plus" cor="#fff" tamanho={18} /> Nova pergunta</button>}
        </div>
      </div>
      )}
    </>
  )
}

function ModelosAdmin({ perguntas }) {
  const avisar = useAviso()
  const { modelos, setModelos, recarregar } = useModelos()
  const { tipos } = useTipos()
  const [aberto, setAberto] = useState(null)
  if (!modelos || !tipos) return <div className="vazio">Carregando…</div>

  const ordemDe = new Map(perguntas.map((p, i) => [p.id, i]))
  const ordenar = ids => [...ids].sort((a, b) => (ordemDe.get(a) ?? 9999) - (ordemDe.get(b) ?? 9999))

  async function salvar(m, patch) {
    setModelos(l => l.map(x => (x.id === m.id ? { ...x, ...patch } : x)))
    const { error } = await supabase.from('modelos_perguntas').update(patch).eq('id', m.id)
    if (error) { avisar('Não foi possível salvar.'); recarregar() }
  }

  async function criar(base) {
    const nome = window.prompt(base ? `Nome da cópia de "${base.nome}":` : 'Nome do novo modelo (ex.: Urbanismo):', base ? `${base.nome} (cópia)` : '')
    if (!nome?.trim()) return
    const { data, error } = await supabase.from('modelos_perguntas')
      .insert({ nome: nome.trim(), descricao: base?.descricao || null, perguntas: base?.perguntas || [], ordem: modelos.length + 1 })
      .select().single()
    if (error) return avisar('Não foi possível criar.')
    await recarregar()
    setAberto(data.id)
  }

  async function apagar(m) {
    const usam = tipos.filter(t => t.modelo_id === m.id).map(t => t.nome)
    const extra = usam.length ? ` Os tipos ${usam.join(', ')} ficam sem modelo.` : ''
    if (!window.confirm(`Apagar o modelo "${m.nome}"?${extra} As charrettes que já usam essas perguntas não mudam.`)) return
    const { error } = await supabase.from('modelos_perguntas').delete().eq('id', m.id)
    if (error) return avisar('Não foi possível apagar.')
    recarregar()
  }

  function marcar(m, p, usar) {
    const lista = usar ? ordenar([...new Set([...m.perguntas, p.id])]) : m.perguntas.filter(x => x !== p.id)
    salvar(m, { perguntas: lista })
  }
  function marcarBloco(m, b, usar) {
    const ids = b.perguntas.map(p => p.id)
    const lista = usar ? ordenar([...new Set([...m.perguntas, ...ids])]) : m.perguntas.filter(x => !ids.includes(x))
    salvar(m, { perguntas: lista })
  }

  return (
    <div className="stack">
      {modelos.map(m => {
        const exp = aberto === m.id
        const usados = m.perguntas.filter(id => ordemDe.has(id)).length
        const tiposDoModelo = tipos.filter(t => t.modelo_id === m.id)
        return (
          <div key={m.id} className={`dinamica ${exp ? 'aberta' : ''} ${m.ativo ? '' : 'inativa'}`}>
            <button className="dinamica-cab" onClick={() => setAberto(exp ? null : m.id)} aria-expanded={exp}>
              <span className="icobox" style={{ background: 'var(--terra-soft)' }}><Icone nome="mic" cor="var(--terra)" /></span>
              <span className="dinamica-tx">
                <b>{m.nome}{!m.ativo ? ' (desativado)' : ''}</b>
                {m.descricao && <span className="muted">{m.descricao}</span>}
                <span className="dinamica-meta">
                  <span>{usados} de {perguntas.length} perguntas</span>
                  {tiposDoModelo.length > 0 && <span>Padrão de: {tiposDoModelo.map(t => t.nome).join(', ')}</span>}
                </span>
              </span>
              <Icone nome={exp ? 'up' : 'down'} cor="var(--ink-3)" />
            </button>
            {exp && (
              <div className="dinamica-corpo" style={{ paddingLeft: 14 }}>
                <div className="form-grid">
                  <label className="campo">Nome<input className="input" defaultValue={m.nome} onBlur={e => e.target.value.trim() && e.target.value !== m.nome && salvar(m, { nome: e.target.value.trim() })} /></label>
                  <label className="campo" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'end' }}>
                    <input type="checkbox" checked={m.ativo} onChange={e => salvar(m, { ativo: e.target.checked })} /> Disponível para escolher nas charrettes
                  </label>
                  <label className="campo span-2">Descrição<input className="input" defaultValue={m.descricao || ''} placeholder="Para que tipo de projeto serve" onBlur={e => e.target.value !== (m.descricao || '') && salvar(m, { descricao: e.target.value.trim() || null })} /></label>
                </div>
                <h4 style={{ marginTop: 6 }}>Perguntas deste modelo</h4>
                <p className="muted" style={{ fontSize: 13 }}>Mudanças valem para as charrettes que usam este modelo sem ajustes. Charrettes com perguntas ajustadas guardam a própria lista. Para criar ou reescrever perguntas, use a aba Banco de perguntas.</p>
                {agruparPorBloco(perguntas).map(b => {
                  const todas = b.perguntas.every(p => m.perguntas.includes(p.id))
                  return (
                    <div key={b.titulo} className="etapas-liga">
                      <label className="liga-etapa" style={{ paddingLeft: 0 }}>
                        <input type="checkbox" checked={todas} onChange={ev => marcarBloco(m, b, ev.target.checked)} />
                        <b style={{ fontSize: 12, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--terra)' }}>{b.titulo}</b>
                      </label>
                      {b.perguntas.map(p => (
                        <label key={p.id} className="liga-etapa" style={{ paddingLeft: 24 }}>
                          <input type="checkbox" checked={m.perguntas.includes(p.id)} onChange={ev => marcar(m, p, ev.target.checked)} />
                          <span>{p.texto}</span>
                        </label>
                      ))}
                    </div>
                  )
                })}
                <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
                  <button className="btn ghost sm" onClick={() => criar(m)}><Icone nome="plus" tamanho={15} /> Duplicar modelo</button>
                  <button className="btn ghost sm" onClick={() => apagar(m)}><Icone nome="trash" tamanho={15} /> Apagar modelo</button>
                </div>
              </div>
            )}
          </div>
        )
      })}
      <div><button className="btn terra" onClick={() => criar(null)}><Icone nome="plus" cor="#fff" tamanho={18} /> Novo modelo</button></div>
    </div>
  )
}
