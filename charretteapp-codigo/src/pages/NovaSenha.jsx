import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useSessao } from '../lib/contexto'

export default function NovaSenha() {
  const { setRecuperando } = useSessao()
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function salvar(e) {
    e.preventDefault()
    setErro(''); setEnviando(true)
    const { error } = await supabase.auth.updateUser({ password: senha })
    setEnviando(false)
    if (error) return setErro(error.message)
    setRecuperando(false)
  }

  return (
    <div className="center-screen">
      <form onSubmit={salvar} className="card" style={{ width: 'min(400px, 92vw)' }}>
        <img src="/marca.png" alt="" width="40" />
        <h2 style={{ margin: '12px 0 6px' }}>Nova senha</h2>
        <p className="muted" style={{ marginBottom: 16 }}>Escolha uma senha com pelo menos 6 caracteres.</p>
        <label className="campo">Nova senha
          <input className="input" type="password" value={senha} onChange={e => setSenha(e.target.value)} minLength={6} required autoComplete="new-password" />
        </label>
        {erro && <div className="alerta erro">{erro}</div>}
        <button className="btn terra full" disabled={enviando}>{enviando ? 'Salvando…' : 'Salvar e entrar'}</button>
      </form>
    </div>
  )
}
