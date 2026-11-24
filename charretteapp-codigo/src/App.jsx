import { useEffect, useState } from 'react'
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { CharretteProvider, useAviso, useCharrette, useSessao } from './lib/contexto'
import { supabase } from './lib/supabase'
import Layout from './components/Layout'
import Entrar from './pages/Entrar'
import NovaSenha from './pages/NovaSenha'
import NovaCharrette from './pages/NovaCharrette'
import Inicio from './pages/Inicio'
import Fase from './pages/Fase'
import Etapa from './pages/Etapa'
import ProximosPassos from './pages/ProximosPassos'
import MinhaCharrette from './pages/MinhaCharrette'
import QuestionarioAdmin from './pages/QuestionarioAdmin'
import CasesAdmin from './pages/CasesAdmin'
import PanoramaAdmin from './pages/PanoramaAdmin'
import ParceirosAdmin from './pages/ParceirosAdmin'
import TiposAdmin from './pages/TiposAdmin'
import EnvioPublico from './pages/EnvioPublico'
import ConvitePagina, { CHAVE_CONVITE } from './pages/Convite'
import AreaParceiro from './pages/AreaParceiro'
import ConceptBook from './pages/ConceptBook'
import AoVivo from './pages/AoVivo'
import AoVivoPublico from './pages/AoVivoPublico'
import { CasePagina, Landing } from './pages/Publico'

export default function App() {
  return (
    <Routes>
      {/* páginas abertas, com ou sem login */}
      <Route path="/enviar/:codigo" element={<EnvioPublico />} />
      <Route path="/convite/:token" element={<ConvitePagina />} />
      <Route path="/ao-vivo/:codigo" element={<AoVivoPublico />} />
      <Route path="/cases/:slug" element={<CasePagina />} />
      <Route path="/site" element={<Landing />} />
      <Route path="*" element={<Principal />} />
    </Routes>
  )
}

function Principal() {
  const { sessao, recuperando } = useSessao()

  if (sessao === undefined) return <Carregando />
  if (recuperando) return <NovaSenha />
  if (!sessao) {
    return (
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/entrar" element={<Entrar />} />
        <Route path="*" element={<Navigate to="/entrar" replace />} />
      </Routes>
    )
  }

  return (
    <CharretteProvider key={sessao.user.id}>
      <AreaLogada />
    </CharretteProvider>
  )
}

// Quem abriu um link de convite antes de ter conta: liga o convite assim que entra
function useConvitePendente(pronto, recarregarPerfil) {
  const avisar = useAviso()
  const navigate = useNavigate()
  const [ok, setOk] = useState(false)
  useEffect(() => {
    if (!pronto) return
    let token = null
    try { token = localStorage.getItem(CHAVE_CONVITE) } catch { }
    if (!token) { setOk(true); return }
    supabase.rpc('vincular_convite', { p_token: token }).then(async ({ error }) => {
      try { localStorage.removeItem(CHAVE_CONVITE) } catch { }
      if (error) avisar(error.message)
      else { await recarregarPerfil(); avisar('Convite recebido. Responda abaixo.'); navigate('/parceiro') }
      setOk(true)
    })
  }, [pronto])
  return ok
}

function AreaLogada() {
  const { lista, atual, perfil, ehParceiro, recarregarPerfil } = useCharrette()
  const pronto = lista !== null && perfil !== null
  const convitesOk = useConvitePendente(pronto, recarregarPerfil)
  if (!pronto || !convitesOk) return <Carregando />


  return (
    <Routes>
      <Route path="/parceiro/*" element={<AreaParceiro />} />
      <Route path="/nova" element={<NovaCharrette />} />
      {!atual ? (
        <Route path="*" element={<Navigate to={ehParceiro ? '/parceiro' : '/nova'} replace />} />
      ) : (
        <>
          <Route path="/concept-book" element={<ConceptBook />} />
          <Route path="/ao-vivo" element={<AoVivo />} />
          <Route element={<Layout />}>
            <Route index element={<Inicio />} />
            <Route path="proximos-passos" element={<ProximosPassos />} />
            <Route path="minha-charrette" element={<MinhaCharrette />} />
            <Route path="fase/:faseId" element={<Fase />} />
            <Route path="etapa/:etapaId" element={<Etapa />} />
            <Route path="admin/questionario" element={<QuestionarioAdmin />} />
            <Route path="admin/cases" element={<CasesAdmin />} />
            <Route path="admin/charrettes" element={<PanoramaAdmin />} />
            <Route path="admin/parceiros" element={<ParceirosAdmin />} />
            <Route path="admin/tipos" element={<TiposAdmin />} />
            <Route path="entrar" element={<Navigate to="/" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </>
      )}
    </Routes>
  )
}

export function Carregando() {
  return (
    <div className="center-screen">
      <img src="/marca.png" alt="" width="54" className="pulse" />
    </div>
  )
}
