import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import { useAviso, useCharrette } from './contexto'

export function useRegistro(tabela) {
  const { atual } = useCharrette()
  const avisar = useAviso()
  const [dados, setDados] = useState(null)
  const [salvoEm, setSalvoEm] = useState(null)

  useEffect(() => {
    let ativo = true
    supabase.from(tabela).select('*').eq('charrette_id', atual.id).maybeSingle()
      .then(async ({ data, error }) => {
        if (!ativo) return
        if (error) { avisar('Não foi possível carregar.'); setDados({}); return }
        if (!data) {
          const r = await supabase.from(tabela).insert({ charrette_id: atual.id }).select().single()
          if (ativo) setDados(r.data || {})
        } else setDados(data)
      })
    return () => { ativo = false }
  }, [tabela, atual.id])

  async function salvar(patch) {
    setDados(d => ({ ...d, ...patch }))
    const { error } = await supabase.from(tabela).update(patch).eq('charrette_id', atual.id)
    if (error) { avisar('Não foi possível salvar.'); return false }
    setSalvoEm(new Date())
    return true
  }

  return { dados, salvar, salvoEm }
}

export function useLista(tabela, { ordem = 'created_at', filtro } = {}) {
  const { atual } = useCharrette()
  const avisar = useAviso()
  const [itens, setItens] = useState(null)
  const filtroKey = JSON.stringify(filtro || {})

  const carregar = useCallback(async () => {
    let q = supabase.from(tabela).select('*').eq('charrette_id', atual.id)
    Object.entries(filtro || {}).forEach(([k, v]) => { q = q.eq(k, v) })
    const { data, error } = await q.order(ordem)
    if (error) { avisar('Não foi possível carregar.'); setItens([]); return }
    setItens(data)
  }, [tabela, atual.id, ordem, filtroKey])

  useEffect(() => { carregar() }, [carregar])

  async function adicionar(item) {
    const { data, error } = await supabase.from(tabela)
      .insert({ ...item, charrette_id: atual.id }).select().single()
    if (error) { avisar('Não foi possível salvar.'); return null }
    setItens(l => [...l, data])
    return data
  }
  async function atualizar(id, patch, chave = 'id') {
    setItens(l => l.map(x => (x[chave] === id ? { ...x, ...patch } : x)))
    const { error } = await supabase.from(tabela).update(patch).eq(chave, id).eq('charrette_id', atual.id)
    if (error) { avisar('Não foi possível salvar.'); carregar(); return false }
    return true
  }
  async function remover(id, chave = 'id') {
    setItens(l => l.filter(x => x[chave] !== id))
    const { error } = await supabase.from(tabela).delete().eq(chave, id).eq('charrette_id', atual.id)
    if (error) { avisar('Não foi possível apagar.'); carregar(); return false }
    return true
  }
  return { itens, adicionar, atualizar, remover, recarregar: carregar }
}

export function useCampo(valorInicial, aoSalvar) {
  const [valor, setValor] = useState(valorInicial ?? '')
  const ultimo = useRef(valorInicial ?? '')
  useEffect(() => { setValor(valorInicial ?? ''); ultimo.current = valorInicial ?? '' }, [valorInicial])
  function onBlur() {
    if (valor === ultimo.current) return
    ultimo.current = valor
    aoSalvar(valor)
  }
  return { value: valor, onChange: e => setValor(e.target.value), onBlur }
}

export const BUCKET = 'charrette-arquivos'

function nomeSeguro(nome) {
  return nome.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '-').slice(-80)
}

export async function enviarArquivo({ arquivo, charretteId, etapa, legenda }) {
  const { data: u } = await supabase.auth.getUser()
  const caminho = `${u.user.id}/${charretteId}/${etapa}/${Date.now()}-${nomeSeguro(arquivo.name)}`
  const up = await supabase.storage.from(BUCKET).upload(caminho, arquivo, { contentType: arquivo.type || undefined })
  if (up.error) throw up.error
  const { data, error } = await supabase.from('arquivos').insert({
    charrette_id: charretteId, etapa, nome: arquivo.name, caminho,
    tipo: arquivo.type || null, tamanho: arquivo.size, legenda: legenda || null,
  }).select().single()
  if (error) { await supabase.storage.from(BUCKET).remove([caminho]); throw error }
  return data
}

export async function apagarArquivo(arq) {
  await supabase.storage.from(BUCKET).remove([arq.caminho])
  await supabase.from('arquivos').delete().eq('id', arq.id)
}

export async function linkArquivo(arq, baixar = false) {
  const { data, error } = await supabase.storage.from(BUCKET)
    .createSignedUrl(arq.caminho, 60 * 60, baixar ? { download: arq.nome } : undefined)
  if (error) throw error
  return data.signedUrl
}

export function tamanhoLegivel(b) {
  if (!b && b !== 0) return ''
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${Math.round(b / 1024)} KB`
  return `${(b / 1024 / 1024).toFixed(1).replace('.', ',')} MB`
}

export const LIMITE_MB = 50
