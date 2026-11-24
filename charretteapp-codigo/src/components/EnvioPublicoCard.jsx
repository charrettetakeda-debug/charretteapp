import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import Icone from './Icone'
import { useAviso, useCharrette } from '../lib/contexto'

/** Link aberto (sem login) para os participantes do evento mandarem ideias e imagens */
export default function EnvioPublicoCard() {
  const { atual, atualizar } = useCharrette()
  const avisar = useAviso()
  const [qr, setQr] = useState(null)
  const [aberto, setAberto] = useState(false)
  const link = `${window.location.origin}/enviar/${atual.codigo_publico}`

  useEffect(() => {
    QRCode.toDataURL(link, { width: 520, margin: 1, color: { dark: '#1F2021', light: '#FFFFFF' } }).then(setQr).catch(() => {})
  }, [link])

  async function alternar() {
    try {
      await atualizar({ envio_publico: !atual.envio_publico })
      avisar(atual.envio_publico ? 'Envio público desligado.' : 'Envio público ligado. Compartilhe o link ou o QR code.')
    } catch { avisar('Não foi possível mudar.') }
  }

  async function copiar() {
    try { await navigator.clipboard.writeText(link); avisar('Link copiado.') } catch { window.prompt('Copie o link:', link) }
  }

  return (
    <div className={`card envio-card ${atual.envio_publico ? 'ligado' : ''}`}>
      <div className="envio-topo">
        <div>
          <h3 style={{ marginBottom: 2 }}>Envio público</h3>
          <p className="muted">{atual.envio_publico
            ? 'Ligado: qualquer pessoa com o link ou o QR code pode mandar ideias e fotos, sem criar conta.'
            : 'Desligado. Ligue durante o evento para os participantes mandarem ideias e fotos pelo celular.'}</p>
        </div>
        <button className={`interruptor ${atual.envio_publico ? 'on' : ''}`} onClick={alternar} role="switch" aria-checked={atual.envio_publico} aria-label="Envio público">
          <span />
        </button>
      </div>
      {atual.envio_publico && (
        <div className="envio-detalhes">
          <div className="envio-link">
            <code>{link}</code>
            <button className="btn ghost sm" onClick={copiar}><Icone nome="link" tamanho={15} /> Copiar link</button>
            <a className="btn ghost sm" href={link} target="_blank" rel="noreferrer"><Icone nome="external" tamanho={15} /> Abrir</a>
            {qr && <button className="btn ghost sm" onClick={() => setAberto(true)}>Mostrar QR code</button>}
          </div>
        </div>
      )}
      {aberto && qr && (
        <div className="modal-fundo" onMouseDown={e => e.target === e.currentTarget && setAberto(false)}>
          <div className="modal qr-modal">
            <img src={qr} alt="QR code do envio público" />
            <h3>{atual.nome}</h3>
            <p className="muted">Aponte a câmera do celular para mandar sua ideia</p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 14 }}>
              <a className="btn ghost" href={qr} download={`qrcode-${atual.codigo_publico}.png`}>Baixar imagem</a>
              <button className="btn" onClick={() => setAberto(false)}>Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
