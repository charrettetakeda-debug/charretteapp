import { Link, useNavigate } from 'react-router-dom'
import FormCharrette from '../components/FormCharrette'
import { useCharrette } from '../lib/contexto'
import { supabase } from '../lib/supabase'

export default function NovaCharrette() {
  const { criar, atual } = useCharrette()
  const navigate = useNavigate()

  async function salvar(dados) {
    await criar(dados)
    navigate('/')
  }

  return (
    <div className="center-screen scroll">
      <div className="card nova">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <img src="/marca.png" alt="" width="36" />
          <b className="serif" style={{ fontSize: 20 }}>Charrette</b>
        </div>
        <h1 className="serif" style={{ fontSize: 28 }}>{atual ? 'Nova charrette' : 'Vamos começar a sua charrette'}</h1>
        <p className="muted" style={{ margin: '6px 0 20px' }}>
          Conte o básico. Dá para mudar tudo depois. Ao criar, já preparamos as 12 etapas e a lista de documentos da pré-charrette.
        </p>
        <FormCharrette rotulo="Criar charrette" aoSalvar={salvar} />
        <div style={{ marginTop: 16, display: 'flex', gap: 16 }}>
          {atual && <Link className="muted" to="/">Voltar</Link>}
          {!atual && <button className="link-btn muted" onClick={() => supabase.auth.signOut()}>Sair</button>}
        </div>
      </div>
    </div>
  )
}
