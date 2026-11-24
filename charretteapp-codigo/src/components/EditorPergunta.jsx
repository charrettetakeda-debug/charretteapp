import { useState } from 'react'

export const TIPOS_RESPOSTA = { curto: 'Resposta curta', texto: 'Texto longo', opcoes: 'Escolha única', multi: 'Múltipla escolha' }

export function gerarIdPergunta(texto, prefixo = '') {
  const base = texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40) || 'pergunta'
  return `${prefixo}${base}_${Date.now().toString(36)}`
}

export function EditorPergunta({ inicial = {}, blocos, aoSalvar, aoCancelar, novo, titulo, aviso }) {
  const [d, setD] = useState({
    texto: inicial.texto || '', ajuda: inicial.ajuda || '', tipo: inicial.tipo || 'texto',
    opcoes: (inicial.opcoes || []).join('\n'), bloco: inicial.bloco || blocos[0] || '',
  })
  const [blocoNovo, setBlocoNovo] = useState(!blocos.length)
  const set = k => e => setD(v => ({ ...v, [k]: e.target.value }))
  const temOpcoes = d.tipo === 'opcoes' || d.tipo === 'multi'

  function enviar(e) {
    e.preventDefault()
    const opcoes = temOpcoes ? d.opcoes.split('\n').map(o => o.trim()).filter(Boolean) : []
    if (!d.texto.trim() || !d.bloco.trim()) return
    if (temOpcoes && opcoes.length < 2) return window.alert('Coloque pelo menos duas opções, uma por linha.')
    aoSalvar({ texto: d.texto.trim(), ajuda: d.ajuda.trim() || null, tipo: d.tipo, opcoes, bloco: d.bloco.trim() })
  }

  return (
    <form className="adm-editor" onSubmit={enviar}>
      <h3>{titulo || (novo ? 'Nova pergunta' : 'Editar pergunta')}</h3>
      {aviso && <p className="muted" style={{ fontSize: 13, marginTop: -6, marginBottom: 10 }}>{aviso}</p>}
      <label className="campo">Pergunta
        <input className="input" value={d.texto} onChange={set('texto')} required autoFocus />
      </label>
      <label className="campo">Texto de ajuda (opcional)
        <input className="input" value={d.ajuda} onChange={set('ajuda')} placeholder="Aparece em cinza embaixo da pergunta" />
      </label>
      <div className="form-grid">
        <label className="campo">Tipo de resposta
          <select className="input" value={d.tipo} onChange={set('tipo')}>
            {Object.entries(TIPOS_RESPOSTA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label className="campo">Bloco
          {blocoNovo
            ? <input className="input" value={d.bloco} onChange={set('bloco')} placeholder="Nome do novo bloco" />
            : (
              <select className="input" value={d.bloco} onChange={e => (e.target.value === '__novo' ? (setBlocoNovo(true), setD(v => ({ ...v, bloco: '' }))) : set('bloco')(e))}>
                {blocos.map(b => <option key={b}>{b}</option>)}
                <option value="__novo">+ Criar bloco novo…</option>
              </select>
            )}
        </label>
      </div>
      {temOpcoes && (
        <label className="campo">Opções (uma por linha)
          <textarea className="input" rows={5} value={d.opcoes} onChange={set('opcoes')} />
        </label>
      )}
      {!novo && inicial.tipo && inicial.tipo !== d.tipo && <div className="alerta erro">Atenção: mudar o tipo pode deixar respostas antigas fora do formato novo.</div>}
      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn terra">Salvar</button>
        <button type="button" className="btn ghost" onClick={aoCancelar}>Cancelar</button>
      </div>
    </form>
  )
}
