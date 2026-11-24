import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Arquivos } from '../components/Arquivos'
import { Campo, Salvo } from '../components/Campos'
import { useCampo, useRegistro } from '../lib/dados'
import { supabase } from '../lib/supabase'
import { useCharrette } from '../lib/contexto'
import { useModelos, juntarModelos } from '../lib/modelos'
import { useTipos } from '../lib/tipos'
import { EditorPergunta, gerarIdPergunta } from '../components/EditorPergunta'
import Icone from '../components/Icone'
import '../ideias.css'

export function usePerguntas({ incluirInativas = false } = {}) {
  const [perguntas, setPerguntas] = useState(null)
  const carregar = () => {
    let q = supabase.from('perguntas').select('*').order('ordem')
    if (!incluirInativas) q = q.eq('ativo', true)
    return q.then(({ data }) => setPerguntas(data || []))
  }
  useEffect(() => { carregar() }, [])
  return { perguntas, setPerguntas, recarregar: carregar }
}

export function agruparPorBloco(perguntas) {
  const blocos = []
  for (const p of perguntas) {
    const ultimo = blocos[blocos.length - 1]
    if (ultimo && ultimo.titulo === p.bloco) ultimo.perguntas.push(p)
    else blocos.push({ titulo: p.bloco, perguntas: [p] })
  }
  return blocos
}

const respondida = v => (Array.isArray(v) ? v.length > 0 : v != null && String(v).trim() !== '')

export default function Entrevista() {
  const { dados, salvar, salvoEm } = useRegistro('entrevista')
  const { perguntas: todas } = usePerguntas()
  const { modelos } = useModelos()
  const { tipos } = useTipos()
  const { ehEquipe, atual } = useCharrette()
  const [ajustando, setAjustando] = useState(false)
  const [editando, setEditando] = useState(null)
  const [escolher, setEscolher] = useState(false)
  const respostasRef = useRef(null)
  if (!dados || !todas || !modelos || !tipos) return <div className="vazio">Carregando…</div>
  if (respostasRef.current === null) respostasRef.current = dados.respostas || {}

  // De onde vêm as perguntas: lista própria da charrette > modelo do tipo > regra antiga por tipo
  const extras = dados.perguntas_extras || []
  const porId = new Map([...todas.map(p => [p.id, p]), ...extras.map(p => [p.id, { ...p, extra: true }])])
  const tipo = tipos.find(t => t.id === atual.tipo)
  const modeloTipo = modelos.find(m => m.id === tipo?.modelo_id)
  const idsBase = dados.perguntas_ids
    ?? modeloTipo?.perguntas
    ?? todas.filter(p => !p.tipos?.length || !atual.tipo || p.tipos.includes(atual.tipo)).map(p => p.id)
  const perguntas = idsBase.map(id => porId.get(id)).filter(Boolean)
  const ids = perguntas.map(p => p.id)

  const origem = dados.perguntas_ids
    ? (dados.modelos?.length
      ? `${modelos.filter(m => dados.modelos.includes(m.id)).map(m => m.nome).join(' + ') || 'Modelo'}, ajustado para esta charrette`
      : 'Perguntas ajustadas para esta charrette')
    : modeloTipo ? `${modeloTipo.nome} (modelo do tipo de charrette)` : 'Todas as perguntas ativas'

  const respostas = dados.respostas || {}
  const feitas = perguntas.filter(p => respondida(respostas[p.id])).length
  const BLOCOS = agruparPorBloco(perguntas)
  const nomesBlocos = [...new Set([...perguntas.map(p => p.bloco), ...todas.map(p => p.bloco)])]

  function responder(id, valor) {
    respostasRef.current = { ...respostasRef.current, [id]: valor }
    salvar({ respostas: respostasRef.current })
  }

  // ---- ajustes da equipe (só nesta charrette)
  const gravar = (lista, novosExtras = extras, extra = {}) => {
    const usados = novosExtras.filter(x => lista.includes(x.id))
    return salvar({ perguntas_ids: lista, perguntas_extras: usados, modelos: dados.modelos?.length ? dados.modelos : (modeloTipo ? [modeloTipo.id] : []), ...extra })
  }
  function remover(p) {
    if (!window.confirm(`Tirar "${p.texto}" desta charrette? Se já tiver resposta, ela fica guardada.`)) return
    gravar(ids.filter(x => x !== p.id))
  }
  function mover(p, dir) {
    const i = ids.indexOf(p.id), j = i + dir
    if (j < 0 || j >= ids.length || porId.get(ids[j]).bloco !== p.bloco) return
    const l = [...ids];[l[i], l[j]] = [l[j], l[i]]
    gravar(l)
  }
  function posicaoNoBloco(lista, bloco) {
    let k = -1
    lista.forEach((id, i) => { if (porId.get(id)?.bloco === bloco) k = i })
    return k < 0 ? lista.length : k + 1
  }
  async function salvarEdicao(p, d) {
    if (p?.extra) {
      await gravar(ids, extras.map(x => (x.id === p.id ? { ...x, ...d } : x)))
    } else if (p) {
      // pergunta do banco: vira uma cópia só desta charrette, levando a resposta junto
      const nova = { id: gerarIdPergunta(d.texto, 'c_'), ...d }
      let lista = ids.map(x => (x === p.id ? nova.id : x))
      if (d.bloco !== p.bloco) { lista = lista.filter(x => x !== nova.id); lista.splice(posicaoNoBloco(lista, d.bloco), 0, nova.id) }
      if (respondida(respostas[p.id])) respostasRef.current = { ...respostasRef.current, [nova.id]: respostas[p.id] }
      porId.set(nova.id, { ...nova, extra: true })
      await gravar(lista, [...extras, nova], { respostas: respostasRef.current })
    } else {
      const nova = { id: gerarIdPergunta(d.texto, 'c_'), ...d }
      porId.set(nova.id, { ...nova, extra: true })
      const lista = [...ids]; lista.splice(posicaoNoBloco(lista, d.bloco), 0, nova.id)
      await gravar(lista, [...extras, nova])
    }
    setEditando(null)
  }
  function aplicarModelos(sel) {
    const base = juntarModelos(modelos, sel).filter(id => porId.has(id) && !porId.get(id).extra)
    let lista = [...base]
    for (const x of extras) if (ids.includes(x.id)) lista.splice(posicaoNoBloco(lista, x.bloco), 0, x.id)
    salvar({ perguntas_ids: lista, perguntas_extras: extras.filter(x => lista.includes(x.id)), modelos: sel })
    setEscolher(false)
  }
  function restaurar() {
    if (!window.confirm('Voltar para o modelo do tipo de charrette? Os ajustes desta charrette se perdem, mas as respostas já dadas ficam guardadas.')) return
    salvar({ perguntas_ids: null, perguntas_extras: [], modelos: [] })
  }

  return (
    <div className="stack">
      <div className="card">
        <div className="card-head">
          <div><h3>Sobre a entrevista</h3><p className="muted">Responda com calma. Cada resposta é salva sozinha, e dá para voltar depois.</p></div>
          <Salvo quando={salvoEm} />
        </div>
        <div className="form-grid">
          <Campo rotulo="Data da entrevista" tipo="date" valor={dados.data_entrevista} aoSalvar={v => salvar({ data_entrevista: v })} />
          <Campo rotulo="Quem participou" valor={dados.entrevistados} aoSalvar={v => salvar({ entrevistados: v })} placeholder="Ex.: Roberto (proprietário), Carla (sócia)" />
        </div>
        <div className="progresso-linha">
          <div className="bar" style={{ flex: 1 }}><i style={{ width: `${perguntas.length ? (100 * feitas) / perguntas.length : 0}%` }} /></div>
          <span className="muted"><b className="ink">{feitas}</b> de {perguntas.length} respondidas</span>
        </div>
        {ehEquipe && (
          <div className="modelo-linha">
            <span className="icobox" style={{ background: 'var(--terra-soft)', width: 34, height: 34 }}><Icone nome="mic" cor="var(--terra)" tamanho={17} /></span>
            <div style={{ flex: 1, minWidth: 200 }}><small>Perguntas desta charrette</small><b>{origem}</b></div>
            <button className="btn ghost sm" onClick={() => setEscolher(true)}><Icone nome="layers" tamanho={15} /> Trocar modelo</button>
            <button className={`btn sm ${ajustando ? 'terra' : 'ghost'}`} onClick={() => { setAjustando(a => !a); setEditando(null) }}>
              <Icone nome={ajustando ? 'check' : 'pencil'} tamanho={15} cor={ajustando ? '#fff' : undefined} /> {ajustando ? 'Concluir ajustes' : 'Ajustar perguntas'}
            </button>
          </div>
        )}
        {ajustando && (
          <div className="alerta" style={{ marginTop: 12 }}>
            Modo de ajuste: mude a ordem, edite, tire ou inclua perguntas. Vale só para esta charrette; o modelo original não muda.
            {dados.perguntas_ids && <> <button className="link-btn" onClick={restaurar}>Voltar ao modelo do tipo</button></>}
          </div>
        )}
      </div>

      {BLOCOS.map((b, i) => (
        <div className="card" key={`${b.titulo}-${i}`}>
          <div className="bloco-titulo"><span>{String(i + 1).padStart(2, '0')}</span><h3>{b.titulo}</h3></div>
          {b.perguntas.map(p => (
            editando === p.id
              ? <EditorPergunta key={p.id} inicial={p} blocos={nomesBlocos} aoCancelar={() => setEditando(null)} aoSalvar={d => salvarEdicao(p, d)}
                  aviso={p.extra ? null : 'A mudança vale só nesta charrette. A pergunta original continua igual no banco de perguntas.'} />
              : (
                <div key={p.id} className={ajustando ? 'q-ajuste' : undefined}>
                  {ajustando && (
                    <div className="q-ferr">
                      {p.extra && <span className="selo-extra">Só nesta charrette</span>}
                      <span style={{ flex: 1 }} />
                      <button className="icon-btn" onClick={() => mover(p, -1)} aria-label="Subir"><Icone nome="up" tamanho={16} /></button>
                      <button className="icon-btn" onClick={() => mover(p, 1)} aria-label="Descer"><Icone nome="down" tamanho={16} /></button>
                      <button className="icon-btn" onClick={() => setEditando(p.id)} aria-label="Editar"><Icone nome="pencil" tamanho={16} /></button>
                      <button className="icon-btn" onClick={() => remover(p)} aria-label="Tirar desta charrette"><Icone nome="trash" tamanho={16} /></button>
                    </div>
                  )}
                  <Pergunta p={p} valor={respostas[p.id]} aoResponder={v => responder(p.id, v)} />
                </div>
              )
          ))}
          {ajustando && (editando === `novo:${b.titulo}`
            ? <EditorPergunta novo inicial={{ bloco: b.titulo }} blocos={nomesBlocos} aoCancelar={() => setEditando(null)} aoSalvar={d => salvarEdicao(null, d)} />
            : <button className="btn ghost sm" style={{ marginTop: 12 }} onClick={() => setEditando(`novo:${b.titulo}`)}><Icone nome="plus" tamanho={15} /> Pergunta neste bloco</button>)}
        </div>
      ))}

      {ajustando && (
        <div className="card">
          {editando === 'novo'
            ? <EditorPergunta novo blocos={nomesBlocos} aoCancelar={() => setEditando(null)} aoSalvar={d => salvarEdicao(null, d)} />
            : <button className="btn terra" onClick={() => setEditando('novo')}><Icone nome="plus" cor="#fff" tamanho={18} /> Nova pergunta</button>}
        </div>
      )}

      <div className="card">
        <Campo rotulo="Resumo da entrevista" tipo="textarea" linhas={5} valor={dados.resumo} aoSalvar={v => salvar({ resumo: v })}
          placeholder="Os pontos mais importantes que apareceram na conversa." />
      </div>

      <Arquivos etapa="entrevista" titulo="Anexos da entrevista" descricao="Gravação, anotações ou documentos entregues pelo cliente." />

      {escolher && (
        <EscolherModelos modelos={modelos.filter(m => m.ativo)} todas={todas}
          inicial={dados.modelos?.length ? dados.modelos : (modeloTipo ? [modeloTipo.id] : [])}
          fechar={() => setEscolher(false)} aplicar={aplicarModelos} temAjustes={!!dados.perguntas_ids} />
      )}
    </div>
  )
}

function EscolherModelos({ modelos, todas, inicial, fechar, aplicar, temAjustes }) {
  const [sel, setSel] = useState(inicial)
  const ativas = new Set(todas.map(p => p.id))
  const total = juntarModelos(modelos, sel).filter(id => ativas.has(id)).length
  const alternar = id => setSel(s => (s.includes(id) ? s.filter(x => x !== id) : [...s, id]))
  return (
    <div className="modal-fundo" onMouseDown={e => e.target === e.currentTarget && fechar()}>
      <div className="modal" style={{ width: 'min(560px,100%)' }}>
        <div className="modal-topo"><h3>Modelo de perguntas</h3><button className="icon-btn" onClick={fechar} aria-label="Fechar" style={{ fontSize: 22 }}>×</button></div>
        <p className="muted" style={{ marginBottom: 12 }}>Escolha um modelo ou junte mais de um: as perguntas se somam, sem repetir. As respostas já dadas ficam guardadas.</p>
        <div className="stack" style={{ gap: 8 }}>
          {modelos.map(m => (
            <label key={m.id} className={`modelo-opcao ${sel.includes(m.id) ? 'on' : ''}`}>
              <input type="checkbox" checked={sel.includes(m.id)} onChange={() => alternar(m.id)} />
              <span><b>{m.nome}</b>{m.descricao && <small>{m.descricao}</small>}<small>{m.perguntas.filter(id => ativas.has(id)).length} perguntas</small></span>
            </label>
          ))}
          {!modelos.length && <p className="muted">Nenhum modelo cadastrado. Crie em Administração → Questionário.</p>}
        </div>
        {temAjustes && <p className="muted" style={{ fontSize: 13, marginTop: 12 }}>Perguntas criadas só para esta charrette continuam na lista.</p>}
        <div className="modal-acoes">
          <Link to="/admin/questionario" className="btn ghost sm">Editar os modelos</Link>
          <span style={{ flex: 1 }} />
          <button className="btn ghost" onClick={fechar}>Cancelar</button>
          <button className="btn terra" disabled={!sel.length} onClick={() => aplicar(sel)}>Usar {total} perguntas</button>
        </div>
      </div>
    </div>
  )
}

function Pergunta({ p, valor, aoResponder }) {
  return (
    <div className="q">
      <div className="q-texto">{p.texto}{p.ajuda && <small className="dica">{p.ajuda}</small>}</div>
      {p.tipo === 'opcoes' && <Opcoes opcoes={p.opcoes} valor={valor ? [valor] : []} aoMudar={l => aoResponder(l[0] ?? null)} unica />}
      {p.tipo === 'multi' && <Opcoes opcoes={p.opcoes} valor={Array.isArray(valor) ? valor : []} aoMudar={aoResponder} />}
      {(p.tipo === 'texto' || p.tipo === 'curto') && <Texto valor={valor} aoSalvar={aoResponder} curto={p.tipo === 'curto'} />}
    </div>
  )
}

function Opcoes({ opcoes, valor, aoMudar, unica }) {
  function alternar(o) {
    if (unica) return aoMudar(valor[0] === o ? [] : [o])
    aoMudar(valor.includes(o) ? valor.filter(x => x !== o) : [...valor, o])
  }
  return (
    <div className="opts">
      {opcoes.map(o => (
        <button type="button" key={o} className={`opt ${valor.includes(o) ? 'on' : ''}`} onClick={() => alternar(o)} aria-pressed={valor.includes(o)}>{o}</button>
      ))}
    </div>
  )
}

function Texto({ valor, aoSalvar, curto }) {
  const campo = useCampo(valor ?? '', v => aoSalvar(v.trim() === '' ? null : v))
  return curto
    ? <input className="input" {...campo} />
    : <textarea className="input" rows={3} {...campo} />
}
