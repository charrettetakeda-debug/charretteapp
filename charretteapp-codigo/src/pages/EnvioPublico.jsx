import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import '../ideias.css'

const LIMITE_MB = 15

function nomeSeguro(nome) {
  return nome.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '-').slice(-60)
}

/** Página aberta (sem login) para participantes mandarem ideias e fotos */
export default function EnvioPublico() {
  const { codigo } = useParams()
  const [info, setInfo] = useState(undefined)   // undefined carregando, null fechado
  const [d, setD] = useState({ titulo: '', descricao: '', referencia: '', nome: '', contato: '' })
  const [fotos, setFotos] = useState([])
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const [enviadas, setEnviadas] = useState(0)
  const [ok, setOk] = useState(false)
  const input = useRef(null)
  const set = k => e => setD(v => ({ ...v, [k]: e.target.value }))

  useEffect(() => {
    try { const n = localStorage.getItem('envio:nome'); if (n) setD(v => ({ ...v, nome: n })) } catch { /* sem armazenamento */ }
    supabase.rpc('envio_info', { codigo }).then(({ data }) => setInfo(data?.[0] || null))
  }, [codigo])

  function escolherFotos(e) {
    const lista = [...e.target.files]
    e.target.value = ''
    const grandes = lista.filter(f => f.size > LIMITE_MB * 1024 * 1024)
    if (grandes.length) setErro(`A foto ${grandes[0].name} passa de ${LIMITE_MB} MB.`)
    setFotos(f => [...f, ...lista.filter(x => x.size <= LIMITE_MB * 1024 * 1024)].slice(0, 6))
  }

  async function enviar(e) {
    e.preventDefault()
    if (!d.titulo.trim()) return setErro('Escreva a sua ideia.')
    setErro(''); setEnviando(true)
    try {
      try { if (d.nome.trim()) localStorage.setItem('envio:nome', d.nome.trim()) } catch { /* sem armazenamento */ }
      const { data: ideiaId, error } = await supabase.rpc('envio_ideia', {
        codigo, p_titulo: d.titulo.trim(), p_descricao: d.descricao.trim() || null, p_referencia: d.referencia.trim() || null,
        p_autor_nome: d.nome.trim() || null, p_autor_contato: d.contato.trim() || null,
      })
      if (error) throw error
      let falhas = 0
      for (const f of fotos) {
        const caminho = `publico/${info.id}/${ideiaId}/${Date.now()}-${nomeSeguro(f.name)}`
        const up = await supabase.storage.from('charrette-arquivos').upload(caminho, f, { contentType: f.type || undefined })
        if (up.error) { falhas++; continue }
        const r = await supabase.rpc('envio_arquivo', { codigo, p_ideia: ideiaId, p_caminho: caminho, p_nome: f.name, p_tipo: f.type || null, p_tamanho: f.size })
        if (r.error) falhas++
      }
      if (falhas) setErro(`A ideia foi enviada, mas ${falhas} foto(s) não subiram.`)
      setEnviadas(n => n + 1)
      setOk(true)
      setD(v => ({ ...v, titulo: '', descricao: '', referencia: '' }))
      setFotos([])
    } catch (err) {
      setErro(/fechado|inválido/.test(err.message || '') ? 'O envio de ideias foi encerrado.' : 'Não foi possível enviar. Tente de novo.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="publico">
      <header className="publico-topo"><img src="/marca.png" alt="" width="30" /><b>Charrette</b></header>
      <main className="publico-corpo">
        {info === undefined && <div className="vazio">Carregando…</div>}
        {info === null && (
          <div className="card publico-card">
            <h1>Envio encerrado</h1>
            <p className="muted">Este link não está recebendo ideias no momento. Fale com a equipe da charrette.</p>
          </div>
        )}
        {info && ok && (
          <div className="card publico-card">
            <div className="ok-icone">✓</div>
            <h1>Ideia enviada!</h1>
            <p className="muted">Obrigado por participar. {enviadas > 1 ? `Você já mandou ${enviadas} ideias.` : ''}</p>
            {erro && <div className="alerta erro" style={{ marginTop: 12 }}>{erro}</div>}
            <button className="btn terra full" style={{ marginTop: 18 }} onClick={() => { setOk(false); setErro('') }}>Mandar outra ideia</button>
          </div>
        )}
        {info && !ok && (
          <form className="card publico-card" onSubmit={enviar}>
            <div className="eyebrow">{[info.cidade, info.uf].filter(Boolean).join(' / ') || 'Charrette'}</div>
            <h1>{info.nome}</h1>
            <p className="muted" style={{ marginBottom: 18 }}>Mande a sua ideia para a equipe. Pode incluir fotos e referências.</p>

            <label className="campo">Sua ideia *
              <textarea className="input" rows={3} value={d.titulo} onChange={set('titulo')} required placeholder="Ex.: Praça com sombra e bancos perto do ponto de ônibus" />
            </label>
            <label className="campo">Explique melhor (opcional)
              <textarea className="input" rows={3} value={d.descricao} onChange={set('descricao')} />
            </label>
            <label className="campo">Link de referência (opcional)
              <input className="input" value={d.referencia} onChange={set('referencia')} placeholder="https://…" inputMode="url" />
            </label>

            <div className="campo">
              Fotos (até 6)
              <input ref={input} type="file" accept="image/*" multiple hidden onChange={escolherFotos} />
              <div className="fotos-envio">
                {fotos.map((f, i) => (
                  <div key={i} className="foto-envio" style={{ backgroundImage: `url(${URL.createObjectURL(f)})` }}>
                    <button type="button" onClick={() => setFotos(l => l.filter((_, j) => j !== i))} aria-label="Remover foto">×</button>
                  </div>
                ))}
                {fotos.length < 6 && <button type="button" className="foto-add" onClick={() => input.current.click()}>+ Foto</button>}
              </div>
            </div>

            <div className="form-grid">
              <label className="campo">Seu nome (opcional)
                <input className="input" value={d.nome} onChange={set('nome')} autoComplete="name" />
              </label>
              <label className="campo">Contato (opcional)
                <input className="input" value={d.contato} onChange={set('contato')} placeholder="E-mail ou telefone" />
              </label>
            </div>

            {erro && <div className="alerta erro">{erro}</div>}
            <button className="btn terra full" disabled={enviando}>{enviando ? 'Enviando…' : 'Enviar ideia'}</button>
            <p className="muted" style={{ marginTop: 12, fontSize: 12 }}>Seu nome e contato são vistos só pelos organizadores da charrette.</p>
          </form>
        )}
      </main>
    </div>
  )
}
