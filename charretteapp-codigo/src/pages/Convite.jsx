import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useSessao } from '../lib/contexto'
import { formatarData } from '../lib/estrutura'
import '../ideias.css'
import '../parceiros.css'

export const CHAVE_CONVITE = 'charrette:convite'

export default function ConvitePagina() {
  const { token } = useParams()
  const { sessao } = useSessao()
  const navigate = useNavigate()
  const [info, setInfo] = useState(undefined)
  const [modo, setModo] = useState('criar')
  const [d, setD] = useState({ nome: '', email: '', senha: '' })
  const [erro, setErro] = useState('')
  const [ok, setOk] = useState('')
  const [enviando, setEnviando] = useState(false)
  const set = k => e => setD(v => ({ ...v, [k]: e.target.value }))

  useEffect(() => {
    supabase.rpc('convite_info', { p_token: token }).then(({ data }) => {
      setInfo(data || null)
      if (data?.nome) setD(v => ({ ...v, nome: v.nome || data.nome }))
    })
  }, [token])

  async function vincular() {
    setEnviando(true); setErro('')
    const { error } = await supabase.rpc('vincular_convite', { p_token: token })
    setEnviando(false)
    if (error) return setErro(error.message)
    // recarrega para o app reconhecer o novo papel de parceiro
    window.location.href = '/parceiro'
  }

  async function enviar(e) {
    e.preventDefault()
    setErro(''); setOk(''); setEnviando(true)
    try { localStorage.setItem(CHAVE_CONVITE, token) } catch { }
    try {
      if (modo === 'criar') {
        const { data, error } = await supabase.auth.signUp({
          email: d.email, password: d.senha,
          options: { data: { nome: d.nome, tipo: 'parceiro' }, emailRedirectTo: `${window.location.origin}/parceiro` },
        })
        if (error) throw error
        if (!data.session) setOk('Conta criada! Confirme o seu e-mail pelo link que enviamos e depois entre aqui para ver o convite.')
        else navigate('/parceiro')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: d.email, password: d.senha })
        if (error) throw error
        navigate('/parceiro')
      }
    } catch (err) {
      const m = err.message || ''
      setErro(/invalid login/i.test(m) ? 'E-mail ou senha incorretos.'
        : /already registered/i.test(m) ? 'Este e-mail já tem conta. Use "Já tenho conta".'
          : /email not confirmed/i.test(m) ? 'Confirme seu e-mail antes de entrar.'
            : /at least/i.test(m) ? 'A senha precisa ter pelo menos 6 caracteres.' : m || 'Algo deu errado.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="publico">
      <header className="publico-topo"><img src="/marca.png" alt="" width="30" /><b>Charrette</b><span className="muted" style={{ color: '#bbb', marginLeft: 'auto', fontSize: 13 }}>Convite para parceiros</span></header>
      <main className="publico-corpo">
        {info === undefined && <div className="vazio">Carregando…</div>}
        {info === null && (
          <div className="card publico-card">
            <h1>Convite indisponível</h1>
            <p className="muted">Este convite não existe mais ou foi encerrado. Fale com a equipe Charrette.</p>
            <Link className="btn ghost" style={{ marginTop: 14 }} to="/">Ir para o site</Link>
          </div>
        )}
        {info && (
          <div className="card publico-card">
            <div className="eyebrow">Você foi convidado{info.nome ? `, ${info.nome.split(' ')[0]}` : ''}</div>
            <h1>{info.charrette}</h1>
            <div className="convite-dados">
              {(info.cidade || info.uf) && <span>{[info.cidade, info.uf].filter(Boolean).join(' / ')}</span>}
              {info.data_evento && <span>{formatarData(info.data_evento)}</span>}
              {info.local_evento && <span>{info.local_evento}</span>}
            </div>
            {info.mensagem && <p className="convite-msg">{info.mensagem}</p>}
            <p className="muted" style={{ margin: '12px 0 18px' }}>
              A equipe Charrette quer você como parceiro nesta charrette. Entre ou crie sua conta de parceiro para ver o resumo e responder ao convite.
            </p>

            {sessao ? (
              <>
                <p className="muted" style={{ marginBottom: 10 }}>Você está como <b className="ink">{sessao.user.email}</b>.</p>
                {erro && <div className="alerta erro">{erro}</div>}
                <button className="btn terra full" onClick={vincular} disabled={enviando}>{enviando ? 'Aguarde…' : 'Ver o convite'}</button>
              </>
            ) : (
              <form onSubmit={enviar}>
                <div className="tabs" style={{ marginBottom: 14 }}>
                  <button type="button" className={modo === 'criar' ? 'on' : ''} onClick={() => setModo('criar')}>Criar conta de parceiro</button>
                  <button type="button" className={modo === 'entrar' ? 'on' : ''} onClick={() => setModo('entrar')}>Já tenho conta</button>
                </div>
                {modo === 'criar' && (
                  <label className="campo">Seu nome<input className="input" value={d.nome} onChange={set('nome')} required autoComplete="name" /></label>
                )}
                <label className="campo">E-mail<input className="input" type="email" value={d.email} onChange={set('email')} required autoComplete="email" /></label>
                <label className="campo">Senha<input className="input" type="password" minLength={6} value={d.senha} onChange={set('senha')} required autoComplete={modo === 'criar' ? 'new-password' : 'current-password'} /></label>
                {erro && <div className="alerta erro">{erro}</div>}
                {ok && <div className="alerta ok">{ok}</div>}
                <button className="btn terra full" disabled={enviando}>{enviando ? 'Aguarde…' : modo === 'criar' ? 'Criar conta e ver convite' : 'Entrar e ver convite'}</button>
              </form>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
