import { useEffect, useRef, useState } from 'react'
import Icone from './Icone'
import { useLista } from '../lib/dados'
import { useCharrette } from '../lib/contexto'
import ImportarPadlet from './ImportarPadlet'
import '../parceiros.css'

// Aceita o link normal do Padlet/Miro ou o código de incorporação inteiro
export function linkIncorporavel(entrada = '') {
  let url = entrada.trim()
  const src = url.match(/src=["']([^"']+)["']/i)
  if (src) url = src[1]
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./, '')
    if (host.endsWith('padlet.com') && !u.pathname.startsWith('/embed/')) {
      const partes = u.pathname.split('/').filter(Boolean)
      const chave = partes[partes.length - 1]?.split('-').pop()
      if (chave) return `https://padlet.com/embed/${chave}`
    }
    if (host === 'miro.com') {
      const m = u.pathname.match(/\/app\/board\/([^/]+)/)
      if (m) return `https://miro.com/app/live-embed/${m[1]}/`
    }
    if (host === 'canva.com' && /\/design\//.test(u.pathname) && !u.searchParams.has('embed')) {
      return `${u.origin}${u.pathname.replace(/\/edit$/, '/view')}?embed`
    }
    return u.toString()
  } catch {
    return url
  }
}

const nomeServico = url => (/padlet/.test(url) ? 'Padlet' : /miro/.test(url) ? 'Miro' : /menti/.test(url) ? 'Mentimeter' : /canva/.test(url) ? 'Canva' : 'site')

export default function Quadros({ titulo = 'Quadros da dinâmica', descricao, importar = true }) {
  const { podeGerir } = useCharrette()
  const q = useLista('quadros', { ordem: 'ordem' })
  const [novo, setNovo] = useState({ titulo: '', url: '' })
  const [abrirForm, setAbrirForm] = useState(false)
  const [ampliado, setAmpliado] = useState(null)
  const [importando, setImportando] = useState(false)
  const caixa = useRef(null)

  useEffect(() => {
    if (!ampliado) return
    const esc = e => e.key === 'Escape' && setAmpliado(null)
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [ampliado])

  if (!q.itens) return null
  const itens = q.itens
  if (!itens.length && !podeGerir) return null

  async function incluir(e) {
    e.preventDefault()
    if (!novo.url.trim()) return
    const url = linkIncorporavel(novo.url)
    const criado = await q.adicionar({ titulo: novo.titulo.trim() || nomeServico(url), url, ordem: itens.length })
    if (criado) { setNovo({ titulo: '', url: '' }); setAbrirForm(false) }
  }

  function telaCheia() {
    const el = caixa.current
    if (el?.requestFullscreen) el.requestFullscreen()
  }

  const aberto = itens.find(x => x.id === ampliado)

  return (
    <div className="card quadros-card">
      <div className="card-head">
        <div>
          <h3>{titulo}</h3>
          <p className="muted">{descricao || 'Padlet, Miro ou Mentimeter da charrette, abertos aqui dentro. Clique em um quadro para ampliar.'}</p>
        </div>
        {podeGerir && importar && (
          <button className="btn ghost sm" onClick={() => setImportando(true)}><Icone nome="upload" tamanho={15} /> Importar ideias do Padlet</button>
        )}
      </div>
      {importando && <ImportarPadlet fechar={() => setImportando(false)} />}

      <div className="quadros-grade">
        {itens.map(x => (
          <div key={x.id} className="quadro-tile">
            <div className="quadro-tile-topo">
              <b>{x.titulo}</b>
              <span className="quadro-servico">{nomeServico(x.url)}</span>
              {podeGerir && (
                <button className="icon-btn" onClick={() => window.confirm(`Tirar "${x.titulo}" do app? O quadro original não é apagado.`) && q.remover(x.id)} aria-label={`Remover ${x.titulo}`}><Icone nome="trash" tamanho={15} /></button>
              )}
            </div>
            <div className="quadro-tile-frame">
              <iframe src={x.url} title={x.titulo} tabIndex={-1} />
              <button className="quadro-tile-capa" onClick={() => setAmpliado(x.id)} aria-label={`Ampliar ${x.titulo}`}>
                <span><Icone nome="external" tamanho={15} cor="#fff" /> Ampliar</span>
              </button>
            </div>
          </div>
        ))}

        {podeGerir && (abrirForm || !itens.length ? (
          <form onSubmit={incluir} className="quadro-tile quadro-novo-form">
            <b>Novo quadro</b>
            <input className="input" placeholder="Nome (ex.: Ideias da mobilidade)" value={novo.titulo} onChange={e => setNovo(v => ({ ...v, titulo: e.target.value }))} />
            <input className="input" placeholder="Link do Padlet (ou o código de incorporação)" value={novo.url} onChange={e => setNovo(v => ({ ...v, url: e.target.value }))} required autoFocus={itens.length > 0} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn terra sm"><Icone nome="plus" cor="#fff" tamanho={15} /> Incluir</button>
              {itens.length > 0 && <button type="button" className="btn ghost sm" onClick={() => setAbrirForm(false)}>Cancelar</button>}
            </div>
            <p className="muted ajuda">No Padlet: Compartilhar → Incorporar no blog ou site → copiar o código. O link normal do quadro também funciona. O quadro precisa estar aberto para quem tem o link.</p>
          </form>
        ) : (
          <button className="quadro-tile quadro-novo" onClick={() => setAbrirForm(true)}>
            <Icone nome="plus" tamanho={26} cor="var(--ink-3)" />
            <span>Novo quadro</span>
          </button>
        ))}
      </div>

      {aberto && (
        <div className="modal-fundo quadro-modal-fundo" onMouseDown={e => e.target === e.currentTarget && setAmpliado(null)}>
          <div className="quadro-modal">
            <div className="quadro-modal-topo">
              <b>{aberto.titulo}</b>
              <span style={{ flex: 1 }} />
              <button className="btn ghost sm" onClick={telaCheia}><Icone nome="external" tamanho={15} /> <span className="so-desktop">Tela cheia</span></button>
              <a className="btn ghost sm" href={aberto.url} target="_blank" rel="noreferrer"><Icone nome="link" tamanho={15} /> <span className="so-desktop">Abrir no {nomeServico(aberto.url)}</span></a>
              <button className="icon-btn" onClick={() => setAmpliado(null)} aria-label="Fechar" style={{ fontSize: 24, lineHeight: 1 }}>×</button>
            </div>
            <div className="quadro-frame" ref={caixa}>
              <iframe key={aberto.id} src={aberto.url} title={aberto.titulo} allow="camera;microphone;geolocation;clipboard-write;fullscreen" allowFullScreen />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
