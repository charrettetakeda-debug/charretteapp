import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Cronometro } from '../lib/aovivo'
import '../ideias.css'
import '../aovivo.css'

// Página do celular: acompanha a dinâmica do momento, sem login
export default function AoVivoPublico() {
  const { codigo } = useParams()
  const [info, setInfo] = useState(undefined)
  const [verPassos, setVerPassos] = useState(false)

  useEffect(() => {
    let ativo = true
    const buscar = () => supabase.rpc('ao_vivo_info', { codigo }).then(({ data }) => { if (ativo) setInfo(data || null) })
    buscar()
    const t = setInterval(buscar, 8000)
    const aoVoltar = () => document.visibilityState === 'visible' && buscar()
    document.addEventListener('visibilitychange', aoVoltar)
    return () => { ativo = false; clearInterval(t); document.removeEventListener('visibilitychange', aoVoltar) }
  }, [codigo])

  const agora = info?.agora
  useEffect(() => { setVerPassos(false) }, [agora?.id])

  return (
    <div className="publico av-publico">
      <header className="publico-topo"><img src="/marca.png" alt="" width="28" /><b>{info?.charrette || 'Charrette'}</b>
        {agora && <span className="av-selo" style={{ marginLeft: 'auto' }}><i /> AO VIVO</span>}</header>
      <main className="av-publico-corpo">
        {info === undefined && <div className="vazio">Carregando…</div>}
        {info === null && <div className="card publico-card"><h1>Link inválido</h1><p className="muted">Confira o QR code com a equipe da charrette.</p></div>}
        {info && !agora && (
          <div className="card publico-card">
            <h1>Aguardando a próxima dinâmica</h1>
            <p className="muted">Deixe esta página aberta: ela atualiza sozinha quando a equipe começar.</p>
            {info.envio_publico && <Link className="btn terra full" style={{ marginTop: 16 }} to={`/enviar/${codigo}`}>Mandar uma ideia ou foto</Link>}
          </div>
        )}
        {info && agora && (
          <>
            <div className="card av-publico-agora">
              <div className="av-publico-linha">
                <span className="av-eyebrow">Agora</span>
                <Cronometro inicio={agora.inicio} pausa={agora.pausa} duracaoMin={agora.duracao_min} />
              </div>
              <h1>{agora.titulo}</h1>
              {agora.descricao && <p className="muted">{agora.descricao}</p>}
              <div className="av-publico-acoes">
                {info.envio_publico && <Link className="btn terra" to={`/enviar/${codigo}`}>Mandar ideia ou foto</Link>}
                {agora.padlet && <a className="btn ghost" href={agora.padlet} target="_blank" rel="noreferrer">Abrir em tela cheia</a>}
                {agora.passos && <button className="btn ghost" onClick={() => setVerPassos(v => !v)}>{verPassos ? 'Esconder' : 'Como funciona'}</button>}
              </div>
              {verPassos && <div className="dinamica-passos" style={{ marginTop: 10 }}>{agora.passos.split('\n').map((l, i) => <p key={i}>{l}</p>)}</div>}
            </div>
            {agora.padlet && (
              <div className="av-publico-quadro">
                <iframe key={agora.padlet} src={agora.padlet} title={agora.titulo} allow="camera;microphone;clipboard-write" />
              </div>
            )}
            {info.proxima && <p className="muted" style={{ textAlign: 'center', fontSize: 13, margin: '12px 0 30px' }}>Depois: <b className="ink">{info.proxima}</b></p>}
          </>
        )}
      </main>
    </div>
  )
}
