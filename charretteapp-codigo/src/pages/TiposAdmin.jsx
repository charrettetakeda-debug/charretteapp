import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import Icone from '../components/Icone'
import { supabase } from '../lib/supabase'
import { useAviso, useCharrette } from '../lib/contexto'
import { FASES } from '../lib/estrutura'
import { useTipos } from '../lib/tipos'
import { useModelos } from '../lib/modelos'
import '../toolbox.css'

const slugDe = t => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40)

export default function TiposAdmin() {
  const { ehEquipe, perfil } = useCharrette()
  const avisar = useAviso()
  const { tipos, recarregar } = useTipos()
  const { modelos } = useModelos()
  const [aberto, setAberto] = useState(null)

  if (perfil && !ehEquipe) return <Navigate to="/" replace />
  if (!tipos || !modelos) return <div className="vazio">Carregando…</div>

  async function salvarTipo(id, patch) {
    const { error } = await supabase.from('tipos_charrette').update(patch).eq('id', id)
    if (error) return avisar('Não foi possível salvar.')
    recarregar()
  }

  async function novoTipo() {
    const nome = window.prompt('Nome do novo tipo de charrette:')
    if (!nome?.trim()) return
    const id = `${slugDe(nome)}_${Date.now().toString(36).slice(-3)}`
    const { error } = await supabase.from('tipos_charrette').insert({
      id, nome: nome.trim(), etapas: FASES.flatMap(f => f.etapas.map(e => e.id)), ordem: tipos.length + 1,
    })
    if (error) return avisar('Não foi possível criar.')
    await recarregar()
    setAberto(id)
  }

  return (
    <>
      <div className="pagehead">
        <div className="eyebrow">Administração</div>
        <h1>Tipos de charrette</h1>
        <p>Cada tipo é um modelo: liga as etapas que fazem sentido e sugere um modelo de perguntas para a entrevista. Ao criar uma charrette, o cliente ou a equipe escolhe o tipo. Dá para ajustar cada charrette depois, em Dados da charrette.</p>
      </div>
      <div className="stack">
        {tipos.map(t => {
          const exp = aberto === t.id
          const modelo = modelos.find(m => m.id === t.modelo_id)
          return (
            <div key={t.id} className={`dinamica ${exp ? 'aberta' : ''} ${t.ativo ? '' : 'inativa'}`}>
              <button className="dinamica-cab" onClick={() => setAberto(exp ? null : t.id)} aria-expanded={exp}>
                <span className="icobox" style={{ background: 'var(--terra-soft)' }}><Icone nome="layers" cor="var(--terra)" /></span>
                <span className="dinamica-tx">
                  <b>{t.nome}{!t.ativo ? ' (desativado)' : ''}</b>
                  <span className="muted">{t.descricao}</span>
                  <span className="dinamica-meta"><span>{t.etapas.length} de 12 etapas</span><span>{modelo ? `Perguntas: ${modelo.nome}` : 'Sem modelo de perguntas'}</span></span>
                </span>
                <Icone nome={exp ? 'up' : 'down'} cor="var(--ink-3)" />
              </button>
              {exp && (
                <div className="dinamica-corpo" style={{ paddingLeft: 14 }}>
                  <div className="form-grid">
                    <label className="campo">Nome<input className="input" defaultValue={t.nome} onBlur={e => e.target.value.trim() && e.target.value !== t.nome && salvarTipo(t.id, { nome: e.target.value.trim() })} /></label>
                    <label className="campo" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'end' }}>
                      <input type="checkbox" checked={t.ativo} onChange={e => salvarTipo(t.id, { ativo: e.target.checked })} /> Disponível para novas charrettes
                    </label>
                    <label className="campo span-2">Descrição<input className="input" defaultValue={t.descricao || ''} onBlur={e => e.target.value !== (t.descricao || '') && salvarTipo(t.id, { descricao: e.target.value.trim() || null })} /></label>
                  </div>

                  <h4 style={{ marginTop: 6 }}>Etapas</h4>
                  <p className="muted" style={{ fontSize: 13 }}>Vale para as próximas charrettes deste tipo (e para as que trocarem para ele).</p>
                  {FASES.map(f => (
                    <div key={f.id} className="etapas-liga">
                      <b>{f.num} · {f.nome}</b>
                      {f.etapas.map(e => (
                        <label key={e.id} className="liga-etapa">
                          <input type="checkbox" checked={t.etapas.includes(e.id)}
                            onChange={ev => salvarTipo(t.id, { etapas: ev.target.checked ? [...t.etapas, e.id] : t.etapas.filter(x => x !== e.id) })} />
                          <span>{e.titulo}</span>
                        </label>
                      ))}
                    </div>
                  ))}

                  <h4 style={{ marginTop: 10 }}>Perguntas da entrevista</h4>
                  <label className="campo" style={{ maxWidth: 420 }}>Modelo de perguntas
                    <select className="input" value={t.modelo_id || ''} onChange={e => salvarTipo(t.id, { modelo_id: e.target.value || null })}>
                      <option value="">Nenhum (todas as perguntas ativas)</option>
                      {modelos.map(m => <option key={m.id} value={m.id}>{m.nome}{m.ativo ? '' : ' (desativado)'}</option>)}
                    </select>
                  </label>
                  <p className="muted" style={{ fontSize: 13 }}>Cada charrette deste tipo começa com esse modelo; a equipe pode trocar ou ajustar na própria Entrevista. <Link to="/admin/questionario">Editar os modelos</Link></p>
                </div>
              )}
            </div>
          )
        })}
        <div><button className="btn terra" onClick={novoTipo}><Icone nome="plus" cor="#fff" tamanho={18} /> Novo tipo</button></div>
      </div>
    </>
  )
}
