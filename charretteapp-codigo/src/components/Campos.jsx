import { useCampo } from '../lib/dados'

export function Campo({ rotulo, valor, aoSalvar, tipo = 'text', linhas = 4, placeholder, classe = '', dica, prefixo, sufixo }) {
  const conv = v => {
    if (tipo === 'number') {
      if (v.trim() === '') return null
      const n = Number(v.replace(/\./g, '').replace(',', '.'))
      return Number.isFinite(n) ? n : null
    }
    if (tipo === 'date' || tipo === 'datetime-local') return v || null
    return v.trim() === '' ? null : v
  }
  const mostrar = valor == null ? '' : tipo === 'number' ? String(valor).replace('.', ',') : String(valor)
  const campo = useCampo(mostrar, v => aoSalvar(conv(v)))
  const comum = { className: 'input', placeholder, ...campo }
  return (
    <label className={`campo ${classe}`}>
      {rotulo}
      {tipo === 'textarea'
        ? <textarea rows={linhas} {...comum} />
        : (prefixo || sufixo)
          ? <span className="input-grupo">{prefixo && <i>{prefixo}</i>}<input type={tipo === 'number' ? 'text' : tipo} inputMode={tipo === 'number' ? 'decimal' : undefined} {...comum} />{sufixo && <i>{sufixo}</i>}</span>
          : <input type={tipo === 'number' ? 'text' : tipo} inputMode={tipo === 'number' ? 'decimal' : undefined} {...comum} />}
      {dica && <small className="dica">{dica}</small>}
    </label>
  )
}

export function Salvo({ quando }) {
  if (!quando) return <span className="salvo muted">As alterações são salvas automaticamente.</span>
  return <span className="salvo muted">Salvo às {quando.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
}
