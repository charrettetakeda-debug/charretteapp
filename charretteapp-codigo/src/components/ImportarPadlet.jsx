import { useState } from 'react'
import Icone from './Icone'
import { supabase } from '../lib/supabase'
import { useAviso, useCharrette } from '../lib/contexto'

// Lê CSV com aspas, quebras de linha dentro de campos e separador , ou ;
export function lerCSV(texto) {
  texto = texto.replace(/^﻿/, '')
  const primeira = texto.split(/\r?\n/)[0] || ''
  const sep = (primeira.match(/;/g) || []).length > (primeira.match(/,/g) || []).length ? ';' : ','
  const linhas = []
  let linha = [], campo = '', aspas = false
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i]
    if (aspas) {
      if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++ }
      else if (c === '"') aspas = false
      else campo += c
    } else if (c === '"') aspas = true
    else if (c === sep) { linha.push(campo); campo = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++
      linha.push(campo); linhas.push(linha); linha = []; campo = ''
    } else campo += c
  }
  if (campo !== '' || linha.length) { linha.push(campo); linhas.push(linha) }
  return linhas.filter(l => l.some(x => x.trim() !== ''))
}

const semAcento = t => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
const PISTAS = {
  titulo: ['subject', 'title', 'titulo', 'assunto', 'headline'],
  texto: ['body', 'content', 'text', 'texto', 'corpo', 'conteudo', 'description', 'descricao', 'message'],
  autor: ['author', 'autor', 'creator', 'criador', 'name', 'nome', 'user'],
  link: ['attachment', 'anexo', 'url', 'link'],
  secao: ['section', 'secao', 'column', 'coluna', 'group', 'grupo'],
}
function adivinhar(cab) {
  const n = cab.map(semAcento)
  const r = {}
  for (const [k, pistas] of Object.entries(PISTAS)) {
    const i = n.findIndex(h => pistas.some(p => h === p || h.startsWith(p + ' ') || h.includes(p)))
    r[k] = i >= 0 && !Object.values(r).includes(i) ? i : -1
  }
  return r
}
const limparHtml = t => {
  if (!/[<&]/.test(t || '')) return (t || '').trim()
  const d = new DOMParser().parseFromString(t.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n'), 'text/html')
  return (d.body.textContent || '').replace(/\n{3,}/g, '\n\n').trim()
}
function chave(t) {
  let h = 5381
  for (let i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) >>> 0
  return `padlet:${h.toString(36)}`
}

export default function ImportarPadlet({ fechar, temaSugerido = '' }) {
  const { atual } = useCharrette()
  const avisar = useAviso()
  const [cab, setCab] = useState(null)
  const [linhas, setLinhas] = useState([])
  const [mapa, setMapa] = useState({})
  const [tema, setTema] = useState(temaSugerido)
  const [usarSecao, setUsarSecao] = useState(true)
  const [fora, setFora] = useState(new Set())
  const [existentes, setExistentes] = useState(new Set())
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')

  async function abrirArquivo(f) {
    setErro('')
    if (!f) return
    if (!/\.csv$/i.test(f.name) && !/csv/.test(f.type)) return setErro('Escolha o arquivo .csv exportado do Padlet. (Planilha Excel não funciona aqui: no Padlet, use "Salvar como CSV".)')
    const l = lerCSV(await f.text())
    if (l.length < 2) return setErro('O arquivo não tem posts. Confira se é o CSV exportado do Padlet.')
    setCab(l[0]); setLinhas(l.slice(1)); setMapa(adivinhar(l[0])); setFora(new Set())
    const { data } = await supabase.from('ideias').select('externo_id').eq('charrette_id', atual.id).like('externo_id', 'padlet:%')
    setExistentes(new Set((data || []).map(x => x.externo_id)))
  }

  const col = (l, k) => (mapa[k] >= 0 ? (l[mapa[k]] || '').trim() : '')
  const posts = linhas.map((l, i) => {
    const texto = limparHtml(col(l, 'texto'))
    let titulo = limparHtml(col(l, 'titulo'))
    let descricao = texto
    if (!titulo) { titulo = texto.split('\n')[0].slice(0, 140); descricao = texto.length > titulo.length ? texto : '' }
    const autor = col(l, 'autor')
    return { i, titulo, descricao, autor, link: col(l, 'link'), secao: col(l, 'secao'), id: chave(`${titulo}|${texto}|${autor}`) }
  }).filter(p => p.titulo)
  const repetidos = posts.filter(p => existentes.has(p.id)).length
  const escolhidos = posts.filter(p => !fora.has(p.i) && !existentes.has(p.id))

  async function importar() {
    if (!escolhidos.length) return
    setEnviando(true)
    const registros = escolhidos.map(p => ({
      charrette_id: atual.id,
      titulo: p.titulo.slice(0, 300),
      descricao: p.descricao || null,
      referencia: /^https?:\/\//i.test(p.link) ? p.link : null,
      tema: (usarSecao && mapa.secao >= 0 && p.secao) ? p.secao : (tema.trim() || null),
      origem: 'publico',
      autor_nome: p.autor || 'Padlet',
      externo_id: p.id,
    }))
    const { error } = await supabase.from('ideias').insert(registros)
    setEnviando(false)
    if (error) return setErro('Não foi possível importar. Tente de novo; se continuar, avise a equipe.')
    avisar(`${registros.length} ideias importadas do Padlet.`)
    setTimeout(() => window.location.reload(), 900)
  }

  const Mapa = ({ k, rotulo }) => (
    <label className="campo">{rotulo}
      <select className="input" value={mapa[k] ?? -1} onChange={e => setMapa(m => ({ ...m, [k]: Number(e.target.value) }))}>
        <option value={-1}>(nenhuma)</option>
        {cab.map((h, i) => <option key={i} value={i}>{h || `Coluna ${i + 1}`}</option>)}
      </select>
    </label>
  )

  return (
    <div className="modal-fundo" onMouseDown={e => e.target === e.currentTarget && fechar()}>
      <div className="modal" style={{ width: 'min(760px,100%)' }}>
        <div className="modal-topo"><h3>Importar ideias do Padlet</h3><button className="icon-btn" onClick={fechar} aria-label="Fechar" style={{ fontSize: 22 }}>×</button></div>

        {!cab ? (
          <>
            <ol className="passos-import">
              <li>No Padlet, clique em <b>Compartilhar</b> e desça até <b>Exportar</b>.</li>
              <li>Escolha <b>Salvar como CSV</b> e baixe o arquivo.</li>
              <li>Escolha o arquivo aqui. Cada post vira uma ideia <b>A avaliar</b> no mural, com o nome de quem postou.</li>
            </ol>
            <label className="btn terra" style={{ cursor: 'pointer' }}>
              <Icone nome="upload" cor="#fff" tamanho={17} /> Escolher o arquivo CSV
              <input type="file" accept=".csv,text/csv" hidden onChange={e => abrirArquivo(e.target.files[0])} />
            </label>
            <p className="muted" style={{ fontSize: 13, marginTop: 12 }}>Pode importar o mesmo Padlet de novo no fim do dia: posts que já entraram são ignorados.</p>
          </>
        ) : (
          <>
            <details className="mapa-import">
              <summary>Colunas do arquivo (ajuste se algo vier trocado)</summary>
              <div className="form-grid" style={{ marginTop: 10 }}>
                {Mapa({ k: 'titulo', rotulo: 'Título do post' })}
                {Mapa({ k: 'texto', rotulo: 'Texto do post' })}
                {Mapa({ k: 'autor', rotulo: 'Autor' })}
                {Mapa({ k: 'link', rotulo: 'Link ou anexo' })}
                {Mapa({ k: 'secao', rotulo: 'Seção / coluna' })}
              </div>
            </details>
            <div className="form-grid" style={{ marginTop: 12 }}>
              <label className="campo">Tema das ideias
                <input className="input" value={tema} onChange={e => setTema(e.target.value)} placeholder="Ex.: Mobilidade" />
              </label>
              {mapa.secao >= 0 && (
                <label className="campo" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'end' }}>
                  <input type="checkbox" checked={usarSecao} onChange={e => setUsarSecao(e.target.checked)} /> Usar a seção do Padlet como tema
                </label>
              )}
            </div>
            <div className="lista-import">
              {posts.map(p => {
                const ja = existentes.has(p.id)
                return (
                  <label key={p.i} className={`item-import ${ja ? 'ja' : ''}`}>
                    <input type="checkbox" disabled={ja} checked={!ja && !fora.has(p.i)}
                      onChange={() => setFora(s => { const n = new Set(s); n.has(p.i) ? n.delete(p.i) : n.add(p.i); return n })} />
                    <span>
                      <b>{p.titulo}</b>
                      <small>{[p.autor || 'sem autor', usarSecao && p.secao, ja && 'já importada'].filter(Boolean).join(' · ')}</small>
                    </span>
                  </label>
                )
              })}
              {!posts.length && <p className="muted">Nenhum post com texto. Confira as colunas acima.</p>}
            </div>
            {repetidos > 0 && <p className="muted" style={{ fontSize: 13 }}>{repetidos} {repetidos === 1 ? 'post já estava' : 'posts já estavam'} no mural e não {repetidos === 1 ? 'entra' : 'entram'} de novo.</p>}
          </>
        )}
        {erro && <div className="alerta erro" style={{ marginTop: 12 }}>{erro}</div>}
        <div className="modal-acoes">
          {cab && <button className="btn ghost sm" onClick={() => { setCab(null); setLinhas([]) }}>Outro arquivo</button>}
          <span style={{ flex: 1 }} />
          <button className="btn ghost" onClick={fechar}>Cancelar</button>
          {cab && <button className="btn terra" disabled={!escolhidos.length || enviando} onClick={importar}>{enviando ? 'Importando…' : `Importar ${escolhidos.length} ideias`}</button>}
        </div>
      </div>
    </div>
  )
}
