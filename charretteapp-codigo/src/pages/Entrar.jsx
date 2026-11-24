import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import '../publico.css'
import { supabase } from '../lib/supabase'

const traduzir = (msg = '') => {
  if (/invalid login credentials/i.test(msg)) return 'E-mail ou senha incorretos.'
  if (/email not confirmed/i.test(msg)) return 'Confirme seu e-mail antes de entrar. Procure a mensagem na sua caixa de entrada.'
  if (/already registered/i.test(msg)) return 'Este e-mail já tem cadastro. Use "Entrar".'
  if (/password should be at least/i.test(msg)) return 'A senha precisa ter pelo menos 6 caracteres.'
  if (/rate limit/i.test(msg)) return 'Muitas tentativas em pouco tempo. Espere alguns minutos e tente de novo.'
  if (/valid email|invalid format/i.test(msg)) return 'Digite um e-mail válido.'
  return msg || 'Algo deu errado. Tente de novo.'
}

export default function Entrar() {
  const [params] = useSearchParams()
  const [modo, setModo] = useState(params.has('parceiro') ? 'criar' : 'entrar')
  const [tipo, setTipo] = useState(params.has('parceiro') ? 'parceiro' : 'cliente')
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [ok, setOk] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function enviar(e) {
    e.preventDefault()
    setErro(''); setOk(''); setEnviando(true)
    try {
      if (modo === 'entrar') {
        const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
        if (error) throw error
      } else if (modo === 'criar') {
        const { data, error } = await supabase.auth.signUp({
          email, password: senha,
          options: { data: { nome, ...(tipo === 'parceiro' ? { tipo: 'parceiro' } : {}) }, emailRedirectTo: window.location.origin },
        })
        if (error) throw error
        if (!data.session) setOk('Cadastro feito! Enviamos um e-mail de confirmação. Abra o link e depois entre aqui.')
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
        if (error) throw error
        setOk('Se esse e-mail tiver cadastro, você vai receber um link para criar uma nova senha.')
      }
    } catch (err) {
      setErro(traduzir(err.message))
    } finally {
      setEnviando(false)
    }
  }

  const trocar = m => { setModo(m); setErro(''); setOk('') }

  return (
    <div className="auth">
      <div className="auth-art">
        <svg className="topo" viewBox="0 0 800 600" preserveAspectRatio="xMidYMid slice" fill="none" stroke="#5a5a5a" strokeWidth="1.2">
          {Array.from({ length: 22 }, (_, i) => (
            <path key={i} d={`M-20 ${30 + i * 28} C 150 ${i * 28}, 260 ${80 + i * 26}, 420 ${40 + i * 28} S 700 ${i * 30}, 820 ${50 + i * 26}`} />
          ))}
        </svg>
        <div className="auth-art-txt">
          <img src="/marca.png" alt="" width="64" />
          <h1>Charrette</h1>
          <p>Do primeiro dado ao protótipo: tudo da sua charrette num lugar só.</p>
        </div>
      </div>

      <div className="auth-form">
        <form onSubmit={enviar} className="card">
          <img src="/marca.png" alt="" width="40" className="auth-logo-mobile" />
          <h2>{modo === 'entrar' ? 'Entrar' : modo === 'criar' ? 'Criar conta' : 'Recuperar senha'}</h2>
          <p className="muted" style={{ marginBottom: 18 }}>
            {modo === 'entrar' && 'Acesse a sua charrette.'}
            {modo === 'criar' && (tipo === 'parceiro' ? 'Cadastre-se para receber convites da equipe Charrette.' : 'Leva menos de um minuto.')}
            {modo === 'esqueci' && 'Digite seu e-mail e enviaremos um link para criar uma nova senha.'}
          </p>

          {modo === 'criar' && (
            <div className="tipo-conta" role="radiogroup" aria-label="Tipo de conta">
              <button type="button" className={tipo === 'cliente' ? 'on' : ''} onClick={() => setTipo('cliente')} role="radio" aria-checked={tipo === 'cliente'}>
                <b>Tenho uma charrette</b><span>Cliente que vai acompanhar o projeto</span>
              </button>
              <button type="button" className={tipo === 'parceiro' ? 'on' : ''} onClick={() => setTipo('parceiro')} role="radio" aria-checked={tipo === 'parceiro'}>
                <b>Sou parceiro</b><span>Consultor ou especialista convidado</span>
              </button>
            </div>
          )}
          {modo === 'criar' && (
            <label className="campo">Seu nome
              <input className="input" value={nome} onChange={e => setNome(e.target.value)} required autoComplete="name" />
            </label>
          )}
          <label className="campo">E-mail
            <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
          </label>
          {modo !== 'esqueci' && (
            <label className="campo">Senha
              <input className="input" type="password" value={senha} onChange={e => setSenha(e.target.value)} required minLength={6}
                autoComplete={modo === 'criar' ? 'new-password' : 'current-password'} />
            </label>
          )}

          {erro && <div className="alerta erro">{erro}</div>}
          {ok && <div className="alerta ok">{ok}</div>}

          <button className="btn terra full" disabled={enviando}>
            {enviando ? 'Aguarde…' : modo === 'entrar' ? 'Entrar' : modo === 'criar' ? 'Criar conta' : 'Enviar link'}
          </button>

          <Link to="/" className="voltar-site">← Voltar ao site</Link>
          <div className="auth-links">
            {modo === 'entrar' && <>
              <button type="button" onClick={() => trocar('esqueci')}>Esqueci minha senha</button>
              <button type="button" onClick={() => trocar('criar')}>Criar conta</button>
            </>}
            {modo !== 'entrar' && <button type="button" onClick={() => trocar('entrar')}>Já tenho conta</button>}
          </div>
        </form>
      </div>
    </div>
  )
}
