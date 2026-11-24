import { useEffect, useRef, useState } from 'react'

// Ordem do roteiro: dia, hora (sem hora vai para o fim do dia), ordem
export function ordenarPrograma(itens = []) {
  return [...itens].sort((a, b) => a.dia - b.dia
    || (a.hora || '99').localeCompare(b.hora || '99')
    || (a.ordem || 0) - (b.ordem || 0)
    || (a.titulo || '').localeCompare(b.titulo || ''))
}

// "20–30 min" → 20
export function minutosDe(texto) {
  const m = String(texto || '').match(/\d+/)
  return m ? Number(m[0]) : null
}

function useAgora(intervalo = 1000) {
  const [agora, setAgora] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), intervalo)
    return () => clearInterval(t)
  }, [intervalo])
  return agora
}

// Três bipes curtos quando o tempo acaba
export function tocarAlarme() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    ;[0, 0.35, 0.7].forEach(t => {
      const o = ctx.createOscillator(), g = ctx.createGain()
      o.frequency.value = 880
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t)
      g.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + t + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.25)
      o.connect(g).connect(ctx.destination)
      o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.3)
    })
  } catch { /* navegador sem áudio */ }
}

// Segundos já corridos, descontando a pausa
export function decorridoDe(inicio, pausa, agora = Date.now()) {
  if (!inicio) return 0
  const ref = pausa ? new Date(pausa).getTime() : agora
  return Math.max(0, Math.floor((ref - new Date(inicio).getTime()) / 1000))
}

export function Cronometro({ inicio, pausa, duracaoMin, classe = '', som = false }) {
  const agora = useAgora()
  const antes = useRef(null)
  const decorrido = decorridoDe(inicio, pausa, agora)
  const restante = duracaoMin ? duracaoMin * 60 - decorrido : null
  useEffect(() => {
    if (som && restante != null && antes.current != null && antes.current > 0 && restante <= 0) tocarAlarme()
    antes.current = restante
  }, [restante, som])
  if (!inicio) return null
  if (!duracaoMin) {
    return <span className={`cronometro ${classe} ${pausa ? 'pausado' : ''}`}><span className="cronometro-num">{formatar(decorrido)}</span>{pausa && <span className="cronometro-pausa">Pausado</span>}</span>
  }
  const estourou = restante < 0
  const pct = Math.min(100, (100 * decorrido) / (duracaoMin * 60))
  return (
    <span className={`cronometro ${classe} ${pausa ? 'pausado' : ''} ${estourou ? 'estourou' : restante < 120 ? 'acabando' : ''}`}>
      <span className="cronometro-num">{estourou ? '+' : ''}{formatar(Math.abs(restante))}</span>
      <span className="cronometro-barra"><i style={{ width: `${pct}%` }} /></span>
      {pausa && <span className="cronometro-pausa">Pausado</span>}
    </span>
  )
}

function formatar(seg) {
  const m = Math.floor(seg / 60)
  const s = seg % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
