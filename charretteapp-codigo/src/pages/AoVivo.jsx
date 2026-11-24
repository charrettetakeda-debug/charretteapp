import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import QRCode from 'qrcode'
import Icone from '../components/Icone'
import { linkIncorporavel } from '../components/Quadros'
import { supabase } from '../lib/supabase'
import { useAviso, useCharrette } from '../lib/contexto'
import { Cronometro, decorridoDe, ordenarPrograma } from '../lib/aovivo'
import '../aovivo.css'

export default function AoVivo() {
  const { atual, atualizar, podeGerir } = useCharrette()
  const avisar = useAviso()
  const navigate = useNavigate()
  const [programa, setPrograma] = useState(null)
  const [quadros, setQuadros] = useState([])
  const [passos, setPassos] = useState({})
  const [qtdIdeias, setQtdIdeias] = useState(0)
  const [qr, setQr] = useState(null)
  const [verQr, setVerQr] = useState(false)
  const [encerrando, setEncerrando] = useState(false)
  const [verPassos, setVerPassos] = useState(false)
  const [roteiroAberto, setRoteiroAberto] = useState(true)
  const [soTempo, setSoTempo] = useState(false)
  const [som, setSom] = useState(() => { try { return localStorage.getItem('charrette:som') !== '0' } catch { return true } })
  const linkPublico = `${window.location.origin}/ao-vivo/${atual.codigo_publico}`

  async function carregar() {
    const [{ data: p }, { data: q }] = await Promise.all([
      supabase.from('programa').select('*').eq('charrette_id', atual.id),
      supabase.from('quadros').select('*').eq('charrette_id', atual.id),
    ])
    setPrograma(ordenarPrograma(p || []))
    setQuadros(q || [])
    const ids = [...new Set((p || []).map(x => x.dinamica_id).filter(Boolean))]
    if (ids.length) {
      const { data: d } = await supabase.from('dinamicas').select('id,passos,materiais').in('id', ids)
      setPassos(Object.fromEntries((d || []).map(x => [x.id, x])))
    }
  }
  useEffect(() => { carregar() }, [atual.id])

  useEffect(() => {
    QRCode.toDataURL(linkPublico, { width: 640, margin: 1, color: { dark: '#1F2021', light: '#FFFFFF' } }).then(setQr).catch(() => {})
  }, [linkPublico])

  // ideias que chegaram durante a dinâmica atual
  useEffect(() => {
    if (!atual.ao_vivo_inicio) { setQtdIdeias(0); return }
    const contar = () => supabase.from('ideias').select('id', { count: 'exact', head: true })
      .eq('charrette_id', atual.id).gte('created_at', atual.ao_vivo_inicio)
      .then(({ count }) => setQtdIdeias(count || 0))
    contar()
    const t = setInterval(contar, 15000)
    return () => clearInterval(t)
  }, [atual.id, atual.ao_vivo_inicio])

  const agora = programa?.find(i => i.id === atual.ao_vivo_item)
  const idx = programa && agora ? programa.indexOf(agora) : -1
  const proxima = programa && idx >= 0 ? programa[idx + 1] : null
  const padlet = useMemo(() => {
    if (!agora) return null
    const q = agora.dinamica_id && quadros.find(x => x.dinamica_id === agora.dinamica_id)
    if (q) return q.url
    return agora.link && /padlet\.com|miro\.com|menti/.test(agora.link) ? linkIncorporavel(agora.link) : null
  }, [agora, quadros])

  if (!programa) return <div className="center-screen"><img src="/marca.png" alt="" width="54" className="pulse" /></div>

  async function iniciar(item) {
    const inicio = new Date().toISOString()
    if (!item.iniciado_em) await supabase.from('programa').update({ iniciado_em: inicio }).eq('id', item.id)
    try { await atualizar({ ao_vivo_item: item.id, ao_vivo_inicio: inicio, ao_vivo_pausa: null }) } catch { return avisar('Não foi possível mudar a dinâmica.') }
    setProgramaItem(item.id, { iniciado_em: item.iniciado_em || inicio })
    setVerPassos(false)
  }
  function setProgramaItem(id, patch) { setPrograma(l => l.map(x => (x.id === id ? { ...x, ...patch } : x))) }

  async function encerrar(resumo) {
    const fim = new Date().toISOString()
    const { error } = await supabase.from('programa').update({ resumo: resumo.trim() || agora.resumo || null, concluido_em: fim }).eq('id', agora.id)
    if (error) return avisar('Não foi possível salvar o resumo.')
    setProgramaItem(agora.id, { resumo: resumo.trim() || agora.resumo || null, concluido_em: fim })
    setEncerrando(false)
    if (proxima) iniciar(proxima)
    else {
      await atualizar({ ao_vivo_item: null, ao_vivo_inicio: null, ao_vivo_pausa: null })
      avisar('Roteiro concluído!')
    }
  }

  async function ajustarTempo(delta) {
    const novo = Math.max(1, (agora.duracao_min || 0) + delta)
    setProgramaItem(agora.id, { duracao_min: novo })
    await supabase.from('programa').update({ duracao_min: novo }).eq('id', agora.id)
  }
  async function definirTempo() {
    const r = window.prompt('Quantos minutos faltam para acabar esta dinâmica?', '10')
    const falta = Number(String(r || '').replace(',', '.'))
    if (!falta || falta <= 0) return
    const corridos = decorridoDe(atual.ao_vivo_inicio, atual.ao_vivo_pausa) / 60
    const novo = Math.max(1, Math.round(corridos + falta))
    setProgramaItem(agora.id, { duracao_min: novo })
    await supabase.from('programa').update({ duracao_min: novo }).eq('id', agora.id)
  }
  function pausar() {
    if (atual.ao_vivo_pausa) {
      const parado = Date.now() - new Date(atual.ao_vivo_pausa).getTime()
      const inicio = new Date(new Date(atual.ao_vivo_inicio).getTime() + parado).toISOString()
      return atualizar({ ao_vivo_inicio: inicio, ao_vivo_pausa: null })
    }
    return atualizar({ ao_vivo_pausa: new Date().toISOString() })
  }
  function recomecar() { return atualizar({ ao_vivo_inicio: new Date().toISOString(), ao_vivo_pausa: null }) }
  function alternarSom() {
    setSom(s => { try { localStorage.setItem('charrette:som', s ? '0' : '1') } catch { /* sem armazenamento */ } return !s })
  }

  async function salvarPadlet(entrada) {
    const url = linkIncorporavel(entrada)
    const r = agora.dinamica_id
      ? await supabase.from('quadros').insert({ charrette_id: atual.id, titulo: agora.titulo, url, dinamica_id: agora.dinamica_id })
      : await supabase.from('programa').update({ link: url }).eq('id', agora.id)
    if (r.error) return avisar('Não foi possível salvar o Padlet.')
    carregar()
  }

  async function pararAoVivo() {
    if (!window.confirm('Sair do modo ao vivo? Os celulares deixam de mostrar a dinâmica atual.')) return
    await atualizar({ ao_vivo_item: null, ao_vivo_inicio: null, ao_vivo_pausa: null })
  }

  function telaCheia() {
    if (document.fullscreenElement) document.exitFullscreen()
    else document.documentElement.requestFullscreen?.()
  }

  const dias = [...new Set(programa.map(i => i.dia))]
  const info = agora?.dinamica_id ? passos[agora.dinamica_id] : null

  return (
    <div className="aovivo">
      <header className="av-topo">
        <button className="av-marca" onClick={() => setRoteiroAberto(v => !v)} aria-label="Mostrar ou esconder o roteiro">
          <img src="/marca.png" alt="" width="26" /><b>{atual.nome}</b>
        </button>
        {agora && <span className="av-selo"><i /> AO VIVO</span>}
        <span style={{ flex: 1 }} />
        <button className="av-btn" onClick={() => setVerQr(true)}><Icone nome="grid" tamanho={16} cor="#fff" /> QR para celulares</button>
        <button className="av-btn so-desktop" onClick={telaCheia}><Icone nome="external" tamanho={16} cor="#fff" /> Tela cheia</button>
        {agora && podeGerir && <button className="av-btn" onClick={pararAoVivo}>Parar</button>}
        <button className="av-btn" onClick={() => navigate('/etapa/dinamica')} aria-label="Sair"><Icone nome="logout" tamanho={16} cor="#fff" /></button>
      </header>

      <div className={`av-corpo ${roteiroAberto ? '' : 'sem-roteiro'}`}>
        <aside className="av-roteiro">
          <h3>Roteiro</h3>
          {programa.length === 0 && (
            <p className="muted">Nenhuma atividade no programa. Monte o roteiro em <Link to="/etapa/conteudo">Conteúdo</Link> ou adicione dinâmicas pela <Link to="/etapa/toolbox">Toolbox</Link>.</p>
          )}
          {dias.map(dia => (
            <div key={dia} className="av-dia">
              <span className="av-dia-tit">Dia {dia}</span>
              {programa.filter(i => i.dia === dia).map(i => {
                const estado = i.id === agora?.id ? 'agora' : i.concluido_em ? 'feito' : 'proximo'
                return (
                  <button key={i.id} className={`av-item ${estado}`} onClick={() => podeGerir && i.id !== agora?.id && window.confirm(`Ir para "${i.titulo}"?`) && iniciar(i)} disabled={!podeGerir}>
                    <span className="av-item-ico">{estado === 'feito' ? '✓' : estado === 'agora' ? '●' : ''}</span>
                    <span className="av-item-tx">
                      <b>{i.titulo}</b>
                      <small>{[i.hora?.slice(0, 5), i.duracao_min && `${i.duracao_min} min`].filter(Boolean).join(' · ')}</small>
                      {i.resumo && <small className="av-resumo">{i.resumo}</small>}
                    </span>
                  </button>
                )
              })}
            </div>
          ))}
        </aside>

        <main className="av-palco">
          {!agora ? (
            <div className="av-inicio">
              <img src="/marca.png" alt="" width="56" />
              <h1>{programa.some(i => i.concluido_em) ? 'Roteiro pausado' : 'Pronto para começar?'}</h1>
              <p>O telão mostra a dinâmica do momento, o Padlet e o cronômetro. Os participantes acompanham pelo celular com o QR code.</p>
              {programa.length > 0 && podeGerir && (
                <button className="btn terra" onClick={() => iniciar(programa.find(i => !i.concluido_em) || programa[0])}>
                  Começar: {(programa.find(i => !i.concluido_em) || programa[0]).titulo} <Icone nome="arrow" cor="#fff" tamanho={16} />
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="av-cab">
                <div className="av-cab-tx">
                  <span className="av-eyebrow">Agora · Dia {agora.dia}{agora.hora ? ` · ${agora.hora.slice(0, 5)}` : ''}</span>
                  <h1>{agora.titulo}</h1>
                  {agora.descricao && <p>{agora.descricao}</p>}
                </div>
                <div className="av-tempo">
                  <Cronometro inicio={atual.ao_vivo_inicio} pausa={atual.ao_vivo_pausa} duracaoMin={agora.duracao_min} classe="grande" som={som && !soTempo} />
                  {podeGerir && <ControlesTempo {...{ pausado: !!atual.ao_vivo_pausa, pausar, ajustarTempo, definirTempo, recomecar, som, alternarSom }} abrirTela={() => setSoTempo(true)} teclas={!soTempo} />}
                </div>
              </div>

              <div className="av-quadro">
                {padlet
                  ? <iframe key={padlet} src={padlet} title={agora.titulo} allow="camera;microphone;clipboard-write;fullscreen" allowFullScreen />
                  : <SemPadlet podeGerir={podeGerir} salvar={salvarPadlet} info={info} />}
                {verPassos && info?.passos && (
                  <div className="av-passos">
                    <div className="av-passos-topo"><b>Passo a passo</b><button className="icon-btn" onClick={() => setVerPassos(false)} aria-label="Fechar">×</button></div>
                    {info.materiais && <p><b>Materiais:</b> {info.materiais}</p>}
                    {info.passos.split('\n').map((l, i) => <p key={i}>{l}</p>)}
                  </div>
                )}
              </div>

              <div className="av-rodape">
                {info?.passos && padlet && <button className="btn ghost sm" onClick={() => setVerPassos(v => !v)}>Passo a passo</button>}
                <Link className="av-ideias" to="/etapa/dinamica"><b>{qtdIdeias}</b> ideia{qtdIdeias === 1 ? '' : 's'} no mural desde o início desta dinâmica</Link>
                <span style={{ flex: 1 }} />
                {proxima && <span className="muted so-desktop">Próxima: <b className="ink">{proxima.titulo}</b></span>}
                {podeGerir && (
                  <button className="btn terra" onClick={() => setEncerrando(true)}>
                    {proxima ? 'Encerrar e ir para a próxima' : 'Encerrar roteiro'} <Icone nome="arrow" cor="#fff" tamanho={16} />
                  </button>
                )}
              </div>
            </>
          )}
        </main>
      </div>

      {verQr && (
        <div className="modal-fundo" onMouseDown={e => e.target === e.currentTarget && setVerQr(false)}>
          <div className="modal av-qr">
            {qr && <img src={qr} alt="QR code para acompanhar ao vivo" />}
            <h2>Acompanhe pelo celular</h2>
            <p className="muted">Aponte a câmera para o QR code. A página mostra a dinâmica do momento e o Padlet, e muda sozinha quando a dinâmica muda.</p>
            {!atual.envio_publico && <p className="alerta erro" style={{ marginTop: 10 }}>O envio público de ideias está desligado. Ligue em Dinâmica para os participantes mandarem ideias e fotos.</p>}
            <code>{linkPublico}</code>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 14 }}>
              <a className="btn ghost" href={qr} download="qrcode-ao-vivo.png">Baixar QR code</a>
              <button className="btn" onClick={() => setVerQr(false)}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {encerrando && <EncerrarDinamica item={agora} proxima={proxima} fechar={() => setEncerrando(false)} confirmar={encerrar} />}
      {soTempo && agora && (
        <div className="av-so-tempo" onDoubleClick={() => setSoTempo(false)}>
          <button className="av-so-tempo-fechar" onClick={() => setSoTempo(false)} aria-label="Fechar">×</button>
          <span className="av-eyebrow">Agora</span>
          <h2>{agora.titulo}</h2>
          <Cronometro inicio={atual.ao_vivo_inicio} pausa={atual.ao_vivo_pausa} duracaoMin={agora.duracao_min} classe="gigante" som={som} />
          {podeGerir && <ControlesTempo {...{ pausado: !!atual.ao_vivo_pausa, pausar, ajustarTempo, definirTempo, recomecar, som, alternarSom }} />}
          {proxima && <p className="av-so-tempo-prox">Depois: {proxima.titulo}</p>}
        </div>
      )}
    </div>
  )
}

function ControlesTempo({ pausado, pausar, ajustarTempo, definirTempo, recomecar, som, alternarSom, abrirTela, teclas = true }) {
  useEffect(() => {
    if (!teclas) return
    const tecla = e => {
      if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.target.isContentEditable) return
      if (e.code === 'Space') { e.preventDefault(); pausar() }
      else if (e.key === '+' || e.key === '=') ajustarTempo(1)
      else if (e.key === '-') ajustarTempo(-1)
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  })
  return (
    <div className="av-tempo-acoes">
      <button className={`av-pausa ${pausado ? 'on' : ''}`} onClick={pausar} title="Pausar ou continuar (barra de espaço)">{pausado ? '▶ Continuar' : '❚❚ Pausar'}</button>
      <button onClick={() => ajustarTempo(-5)} title="Tirar 5 minutos">−5</button>
      <button onClick={() => ajustarTempo(-1)} title="Tirar 1 minuto (tecla −)">−1</button>
      <button onClick={() => ajustarTempo(1)} title="Somar 1 minuto (tecla +)">+1</button>
      <button onClick={() => ajustarTempo(5)} title="Somar 5 minutos">+5</button>
      <button onClick={definirTempo} title="Dizer quanto tempo falta">Definir</button>
      <button onClick={recomecar} title="Recomeçar o tempo do zero">↺</button>
      <button onClick={alternarSom} title={som ? 'Alarme ligado: toca quando o tempo acaba' : 'Alarme desligado'} aria-pressed={som}>{som ? '🔔' : '🔕'}</button>
      {abrirTela && <button onClick={abrirTela} title="Mostrar só o cronômetro, grande">⛶ Só o tempo</button>}
    </div>
  )
}

function SemPadlet({ podeGerir, salvar, info }) {
  const [link, setLink] = useState('')
  return (
    <div className="av-sem-padlet">
      {info?.passos ? (
        <div className="av-passos-fixo">
          <b>Passo a passo</b>
          {info.materiais && <p><b>Materiais:</b> {info.materiais}</p>}
          {info.passos.split('\n').map((l, i) => <p key={i}>{l}</p>)}
        </div>
      ) : <p className="muted">Esta atividade não tem Padlet.</p>}
      {podeGerir && (
        <form onSubmit={e => { e.preventDefault(); if (link.trim()) salvar(link) }} className="av-padlet-form">
          <input className="input" value={link} onChange={e => setLink(e.target.value)} placeholder="Cole aqui o link do Padlet desta dinâmica" />
          <button className="btn">Usar Padlet</button>
        </form>
      )}
    </div>
  )
}

function EncerrarDinamica({ item, proxima, fechar, confirmar }) {
  const [resumo, setResumo] = useState(item.resumo || '')
  const [salvando, setSalvando] = useState(false)
  return (
    <div className="modal-fundo" onMouseDown={e => e.target === e.currentTarget && fechar()}>
      <form className="modal" style={{ width: 'min(560px,100%)' }} onSubmit={async e => { e.preventDefault(); setSalvando(true); await confirmar(resumo); setSalvando(false) }}>
        <div className="modal-topo"><h3>Encerrar "{item.titulo}"</h3><button type="button" className="icon-btn" onClick={fechar} aria-label="Fechar" style={{ fontSize: 22 }}>×</button></div>
        <label className="campo">O que saiu desta dinâmica? (opcional)
          <textarea className="input" rows={5} value={resumo} onChange={e => setResumo(e.target.value)} autoFocus
            placeholder="Principais conclusões, ideias mais fortes, combinados. Fica guardado no roteiro e entra no concept book." />
        </label>
        <p className="muted" style={{ fontSize: 13 }}>Lembrete: aprove as melhores ideias no mural, para elas entrarem no concept book.</p>
        <div className="modal-acoes">
          <span style={{ flex: 1 }} />
          <button type="button" className="btn ghost" onClick={fechar}>Voltar</button>
          <button className="btn terra" disabled={salvando}>{proxima ? `Encerrar e começar "${proxima.titulo}"` : 'Encerrar roteiro'}</button>
        </div>
      </form>
    </div>
  )
}
