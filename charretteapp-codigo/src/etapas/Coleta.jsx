import { useEffect, useState } from 'react'
import Icone from '../components/Icone'
import { Arquivos, BotaoEnviar, LinhaArquivo } from '../components/Arquivos'
import { apagarArquivo, useLista } from '../lib/dados'
import { supabase } from '../lib/supabase'
import { useAviso, useCharrette } from '../lib/contexto'

export const CATEGORIAS = {
  topografia: 'Topografia', projetos: 'Projetos existentes', fotos: 'Fotos', legislacao: 'Legislação',
  cultural: 'Cultural', tecnico: 'Técnico', infraestrutura: 'Infraestrutura', ambiental: 'Ambiental', outros: 'Outros',
}

export default function Coleta() {
  const avisar = useAviso()
  const docs = useLista('documentos', { ordem: 'ordem' })
  const [arquivos, setArquivos] = useState({})

  useEffect(() => {
    const ids = (docs.itens || []).map(d => d.arquivo_id).filter(Boolean).filter(id => !arquivos[id])
    if (!ids.length) return
    supabase.from('arquivos').select('*').in('id', ids).then(({ data }) => {
      if (data) setArquivos(a => ({ ...a, ...Object.fromEntries(data.map(x => [x.id, x])) }))
    })
  }, [docs.itens])

  async function anexar(doc, [arq]) {
    const anterior = doc.arquivo_id && arquivos[doc.arquivo_id]
    setArquivos(a => ({ ...a, [arq.id]: arq }))
    await docs.atualizar(doc.id, { arquivo_id: arq.id })
    if (anterior) apagarArquivo(anterior).catch(() => {})
  }

  async function desanexar(doc) {
    const arq = arquivos[doc.arquivo_id]
    if (!window.confirm(`Remover o arquivo "${arq?.nome}" deste documento?`)) return
    await docs.atualizar(doc.id, { arquivo_id: null })
    if (arq) apagarArquivo(arq).then(() => avisar('Arquivo removido.')).catch(() => {})
  }

  async function apagarDoc(doc) {
    if (!window.confirm(`Tirar "${doc.titulo}" da lista?${doc.arquivo_id ? ' O arquivo anexado também será apagado.' : ''}`)) return
    const arq = arquivos[doc.arquivo_id]
    await docs.remover(doc.id)
    if (arq) apagarArquivo(arq).catch(() => {})
  }

  if (!docs.itens) return <div className="vazio">Carregando…</div>
  const anexados = docs.itens.filter(d => d.arquivo_id).length

  return (
    <div className="stack">
      <div className="card">
        <div className="card-head">
          <div><h3>Documentos a providenciar</h3><p className="muted">{anexados} de {docs.itens.length} anexados. Itens que precisam estar prontos antes do evento.</p></div>
        </div>
        <div className="bar" style={{ marginBottom: 16 }}><i style={{ width: `${docs.itens.length ? (100 * anexados) / docs.itens.length : 0}%` }} /></div>
        <div className="docs">
          {docs.itens.map(d => {
            const arq = d.arquivo_id && arquivos[d.arquivo_id]
            return (
              <div className="doc" key={d.id}>
                <div className="doc-top">
                  <span className={`tag ${d.arquivo_id ? 'done' : 'todo'}`}>{d.arquivo_id ? 'Anexado' : 'Pendente'}</span>
                  <span className="muted">{CATEGORIAS[d.categoria]}</span>
                  <button className="icon-btn" style={{ marginLeft: 'auto' }} onClick={() => apagarDoc(d)} aria-label="Tirar da lista"><Icone nome="trash" tamanho={15} /></button>
                </div>
                <b className="doc-titulo">{d.titulo}</b>
                {arq
                  ? <LinhaArquivo arq={arq} compacto aoApagar={() => desanexar(d)} />
                  : d.arquivo_id ? <div className="muted">Carregando…</div> : null}
                <BotaoEnviar etapa="coleta" multiplo={false} rotulo={d.arquivo_id ? 'Trocar arquivo' : 'Enviar arquivo'} aoEnviar={l => anexar(d, l)} />
              </div>
            )
          })}
        </div>
        <NovoDocumento adicionar={docs.adicionar} ordem={docs.itens.length + 1} />
      </div>

      <Arquivos etapa="coleta-outros" titulo="Outros arquivos" descricao="Fotos extras, planilhas, mapas e qualquer material de apoio." galeria />
    </div>
  )
}

function NovoDocumento({ adicionar, ordem }) {
  const [titulo, setTitulo] = useState('')
  const [categoria, setCategoria] = useState('outros')
  async function enviar(e) {
    e.preventDefault()
    if (!titulo.trim()) return
    if (await adicionar({ titulo: titulo.trim(), categoria, ordem })) { setTitulo(''); setCategoria('outros') }
  }
  return (
    <form onSubmit={enviar} className="linha-add">
      <input className="input" placeholder="Incluir outro documento na lista (ex.: Sondagem do solo)" value={titulo} onChange={e => setTitulo(e.target.value)} />
      <select className="input" value={categoria} onChange={e => setCategoria(e.target.value)}>
        {Object.entries(CATEGORIAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
      <button className="btn"><Icone nome="plus" cor="#fff" tamanho={18} /> Incluir</button>
    </form>
  )
}
