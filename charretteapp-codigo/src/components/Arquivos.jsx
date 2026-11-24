import { useEffect, useRef, useState } from 'react'
import Icone from './Icone'
import { LIMITE_MB, apagarArquivo, enviarArquivo, linkArquivo, tamanhoLegivel } from '../lib/dados'
import { supabase } from '../lib/supabase'
import { useAviso, useCharrette } from '../lib/contexto'

export function extensao(nome = '') {
  const p = nome.split('.')
  return p.length > 1 ? p.pop().slice(0, 4).toUpperCase() : 'ARQ'
}
const ehImagem = a => /^image\//.test(a?.tipo || '')

export function BotaoEnviar({ etapa, multiplo = true, aceitar, aoEnviar, rotulo = 'Enviar arquivo', classe = 'btn ghost sm' }) {
  const { atual } = useCharrette()
  const avisar = useAviso()
  const input = useRef(null)
  const [enviando, setEnviando] = useState(false)

  async function escolher(e) {
    const lista = [...e.target.files]
    e.target.value = ''
    if (!lista.length) return
    const grandes = lista.filter(f => f.size > LIMITE_MB * 1024 * 1024)
    if (grandes.length) { avisar(`Arquivo acima de ${LIMITE_MB} MB: ${grandes[0].name}`); return }
    setEnviando(true)
    const enviados = []
    for (const arquivo of lista) {
      try {
        enviados.push(await enviarArquivo({ arquivo, charretteId: atual.id, etapa }))
      } catch (err) {
        avisar(`Não foi possível enviar ${arquivo.name}.`)
      }
    }
    setEnviando(false)
    if (enviados.length) {
      avisar(enviados.length === 1 ? 'Arquivo enviado.' : `${enviados.length} arquivos enviados.`)
      aoEnviar?.(enviados)
    }
  }

  return (
    <>
      <input ref={input} type="file" hidden multiple={multiplo} accept={aceitar} onChange={escolher} />
      <button type="button" className={classe} onClick={() => input.current.click()} disabled={enviando}>
        <Icone nome="upload" tamanho={16} /> {enviando ? 'Enviando…' : rotulo}
      </button>
    </>
  )
}

export async function abrirArquivo(arq, avisar) {
  const janela = window.open('', '_blank')
  try {
    const url = await linkArquivo(arq)
    if (janela) janela.location = url; else window.location.href = url
  } catch {
    janela?.close()
    avisar?.('Não foi possível abrir o arquivo.')
  }
}

export function LinhaArquivo({ arq, aoApagar, compacto }) {
  const avisar = useAviso()
  return (
    <div className={`file ${compacto ? 'compacto' : ''}`}>
      <div className="ext">{extensao(arq.nome)}</div>
      <button className="tx" onClick={() => abrirArquivo(arq, avisar)} title="Abrir">
        <b>{arq.nome}</b>
        <span className="muted">{tamanhoLegivel(arq.tamanho)}{arq.created_at ? ` · ${new Date(arq.created_at).toLocaleDateString('pt-BR')}` : ''}</span>
      </button>
      {aoApagar && (
        <button className="icon-btn" onClick={() => aoApagar(arq)} aria-label="Apagar arquivo"><Icone nome="trash" tamanho={17} /></button>
      )}
    </div>
  )
}

export function Arquivos({ etapa, titulo = 'Arquivos', descricao, aceitar, galeria = false, somenteLeitura = false }) {
  const { atual } = useCharrette()
  const avisar = useAviso()
  const [itens, setItens] = useState(null)
  const [miniaturas, setMiniaturas] = useState({})

  useEffect(() => {
    supabase.from('arquivos').select('*').eq('charrette_id', atual.id).eq('etapa', etapa)
      .order('created_at', { ascending: false })
      .then(({ data }) => setItens(data || []))
  }, [atual.id, etapa])

  useEffect(() => {
    if (!galeria || !itens) return
    itens.filter(ehImagem).filter(a => !miniaturas[a.id]).forEach(async a => {
      try {
        const url = await linkArquivo(a)
        setMiniaturas(m => ({ ...m, [a.id]: url }))
      } catch { }
    })
  }, [itens, galeria])

  async function apagar(arq) {
    if (!window.confirm(`Apagar "${arq.nome}"? Essa ação não pode ser desfeita.`)) return
    setItens(l => l.filter(x => x.id !== arq.id))
    try { await apagarArquivo(arq); avisar('Arquivo apagado.') } catch { avisar('Não foi possível apagar.') }
  }

  const imagens = galeria ? (itens || []).filter(ehImagem) : []
  const outros = galeria ? (itens || []).filter(a => !ehImagem(a)) : (itens || [])

  return (
    <div className="card">
      <div className="card-head">
        <div><h3>{titulo}</h3>{descricao && <p className="muted">{descricao}</p>}</div>
        {!somenteLeitura && <BotaoEnviar etapa={etapa} aceitar={aceitar} aoEnviar={novos => setItens(l => [...novos, ...l])} />}
      </div>
      {itens === null && <div className="vazio">Carregando…</div>}
      {itens?.length === 0 && <div className="vazio">{somenteLeitura ? 'Nada por aqui ainda.' : 'Nenhum arquivo ainda.'}</div>}
      {imagens.length > 0 && (
        <div className="galeria">
          {imagens.map(a => (
            <figure key={a.id} className="thumb">
              <button onClick={() => abrirArquivo(a, avisar)} className="thumb-img" style={miniaturas[a.id] ? { backgroundImage: `url(${miniaturas[a.id]})` } : undefined} aria-label={`Abrir ${a.nome}`} />
              <figcaption><span>{a.nome}</span>{!somenteLeitura && <button className="icon-btn" onClick={() => apagar(a)} aria-label="Apagar"><Icone nome="trash" tamanho={15} /></button>}</figcaption>
            </figure>
          ))}
        </div>
      )}
      {outros.length > 0 && <div className="files">{outros.map(a => <LinhaArquivo key={a.id} arq={a} aoApagar={somenteLeitura ? null : apagar} />)}</div>}
    </div>
  )
}
