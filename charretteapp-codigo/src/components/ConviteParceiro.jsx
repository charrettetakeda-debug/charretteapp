import { useState } from 'react'
import Icone from './Icone'
import { useAviso } from '../lib/contexto'
import { linkConvite, mensagemConvite } from '../lib/parceiros'

export function MensagemConvite({ p, fechar, enviar }) {
  const [msg, setMsg] = useState(p.mensagem || '')
  return (
    <div className="modal-fundo" onMouseDown={e => e.target === e.currentTarget && fechar()}>
      <form className="modal" style={{ width: 'min(520px,100%)' }} onSubmit={e => { e.preventDefault(); enviar(msg) }}>
        <div className="modal-topo"><h3>Convidar {p.nome}</h3><button type="button" className="icon-btn" onClick={fechar} aria-label="Fechar" style={{ fontSize: 22 }}>×</button></div>
        <label className="campo">Recado para o parceiro (opcional)
          <textarea className="input" rows={4} value={msg} onChange={e => setMsg(e.target.value)} placeholder="Ex.: Queremos sua visão de drenagem para o loteamento. O evento dura 2 dias." />
        </label>
        <p className="muted" style={{ fontSize: 13 }}>O parceiro vê o recado junto com o resumo da charrette e aceita ou recusa pelo app.</p>
        <div className="modal-acoes"><span style={{ flex: 1 }} /><button type="button" className="btn ghost" onClick={fechar}>Cancelar</button><button className="btn terra">Gerar convite</button></div>
      </form>
    </div>
  )
}

export function LinkConvite({ p, charrette, fechar }) {
  const avisar = useAviso()
  const link = linkConvite(p.convite_token)
  const texto = mensagemConvite(p, charrette)
  const fone = (p.contato || '').replace(/\D/g, '')
  const whats = `https://wa.me/${fone.length >= 10 ? (fone.length <= 11 ? `55${fone}` : fone) : ''}?text=${encodeURIComponent(texto)}`
  const email = p.email || (/@/.test(p.contato || '') ? p.contato : '')
  async function copiar(t, m) { try { await navigator.clipboard.writeText(t); avisar(m) } catch { window.prompt('Copie:', t) } }
  return (
    <div className="modal-fundo" onMouseDown={e => e.target === e.currentTarget && fechar()}>
      <div className="modal" style={{ width: 'min(560px,100%)' }}>
        <div className="modal-topo"><h3>Convite pronto</h3><button type="button" className="icon-btn" onClick={fechar} aria-label="Fechar" style={{ fontSize: 22 }}>×</button></div>
        <p className="muted" style={{ marginBottom: 12 }}>
          {p.parceiro_id
            ? `${p.nome} já tem cadastro: o convite aparece na área dele assim que ele entrar. Mande o aviso abaixo também.`
            : `Mande o link para ${p.nome}. Ao abrir, ele cria a conta de parceiro e responde ao convite.`}
        </p>
        <div className="envio-link" style={{ marginBottom: 12 }}><code>{link}</code><button className="btn ghost sm" onClick={() => copiar(link, 'Link copiado.')}><Icone nome="link" tamanho={15} /> Copiar link</button></div>
        <textarea className="input" rows={6} readOnly value={texto} />
        <div className="modal-acoes">
          <button className="btn ghost" onClick={() => copiar(texto, 'Mensagem copiada.')}>Copiar mensagem</button>
          <a className="btn ghost" href={whats} target="_blank" rel="noreferrer">WhatsApp</a>
          {email && <a className="btn ghost" href={`mailto:${email}?subject=${encodeURIComponent(`Convite: charrette ${charrette.nome}`)}&body=${encodeURIComponent(texto)}`}>E-mail</a>}
          <span style={{ flex: 1 }} />
          <button className="btn" onClick={fechar}>Pronto</button>
        </div>
        <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>Quando o domínio de e-mail estiver configurado, o convite também sai por e-mail automaticamente.</p>
      </div>
    </div>
  )
}

