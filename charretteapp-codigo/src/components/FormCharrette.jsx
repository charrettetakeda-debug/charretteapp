import { useState } from 'react'
import { useTipos } from '../lib/tipos'

const UFS = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ')

export default function FormCharrette({ inicial = {}, rotulo = 'Salvar', aoSalvar }) {
  const [d, setD] = useState({
    nome: inicial.nome || '', cidade: inicial.cidade || '', uf: inicial.uf || '',
    descricao: inicial.descricao || '', data_evento: inicial.data_evento || '', local_evento: inicial.local_evento || '',
    tipo: inicial.tipo || '',
  })
  const [datas, setDatas] = useState(() => (Array.isArray(inicial.datas) ? inicial.datas : []).map(x => ({ titulo: x.titulo || '', data: x.data || '', local: x.local || '' })))
  const setData = (i, k) => e => setDatas(l => l.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)))
  const { tipos } = useTipos()
  const tipoEscolhido = tipos?.find(t => t.id === d.tipo)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const set = k => e => setD(v => ({ ...v, [k]: e.target.value }))

  async function enviar(e) {
    e.preventDefault()
    setEnviando(true); setErro('')
    try {
      if (inicial.id && (inicial.tipo || '') !== d.tipo && !window.confirm('Trocar o tipo liga e desliga as etapas conforme o novo modelo. Os dados já preenchidos continuam guardados. Continuar?')) { setEnviando(false); return }
      const limpas = datas.filter(x => x.titulo.trim() || x.data).map(x => ({ titulo: x.titulo.trim() || 'Data', data: x.data || null, local: x.local.trim() || null }))
        .sort((a, b) => (a.data || '9999').localeCompare(b.data || '9999'))
      const dados = { ...d, uf: d.uf || null, data_evento: d.data_evento || null, tipo: d.tipo || null, datas: limpas }
      if (inicial.id && (inicial.tipo || '') === d.tipo) delete dados.tipo
      await aoSalvar(dados)
    } catch (err) {
      setErro(err.message || 'Não foi possível salvar.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form onSubmit={enviar} className="form-grid">
      <label className="campo span-2">Nome do empreendimento ou projeto *
        <input className="input" value={d.nome} onChange={set('nome')} required placeholder="Ex.: Loteamento Vista Alegre" />
      </label>
      <label className="campo span-2">Tipo de charrette
        <select className="input" value={d.tipo} onChange={set('tipo')}>
          <option value="">Completa (todas as etapas)</option>
          {(tipos || []).filter(t => t.ativo || t.id === d.tipo).map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
        </select>
        {tipoEscolhido?.descricao && <span className="muted" style={{ fontSize: 13, fontWeight: 400 }}>{tipoEscolhido.descricao} {tipoEscolhido.etapas.length} de 12 etapas.</span>}
      </label>
      <label className="campo">Cidade
        <input className="input" value={d.cidade} onChange={set('cidade')} placeholder="Ex.: Pirenópolis" />
      </label>
      <label className="campo">Estado
        <select className="input" value={d.uf} onChange={set('uf')}>
          <option value="">—</option>
          {UFS.map(u => <option key={u}>{u}</option>)}
        </select>
      </label>
      <label className="campo span-2">Sobre o projeto
        <textarea className="input" rows={3} value={d.descricao} onChange={set('descricao')} placeholder="Uma ou duas frases sobre o que vai ser discutido na charrette" />
      </label>
      <label className="campo">Data do evento
        <input className="input" type="date" value={d.data_evento} onChange={set('data_evento')} />
      </label>
      <label className="campo">Local do evento
        <input className="input" value={d.local_evento} onChange={set('local_evento')} placeholder="Ex.: Pirenópolis ou Goiânia" />
      </label>
      <div className="campo span-2 datas-livres">
        <span>Outras datas</span>
        <span className="muted" style={{ fontSize: 13, fontWeight: 400 }}>Visita ao terreno, reuniões, segundo dia de workshop, entregas… Aparecem na Agenda da tela inicial.</span>
        {datas.map((x, i) => (
          <div key={i} className="data-livre">
            <input className="input" value={x.titulo} onChange={setData(i, 'titulo')} placeholder="O quê (ex.: Visita ao terreno)" aria-label="Nome da data" />
            <input className="input" type="date" value={x.data} onChange={setData(i, 'data')} aria-label="Data" />
            <input className="input" value={x.local} onChange={setData(i, 'local')} placeholder="Local (opcional)" aria-label="Local" />
            <button type="button" className="icon-btn" onClick={() => setDatas(l => l.filter((_, j) => j !== i))} aria-label="Tirar esta data">×</button>
          </div>
        ))}
        <div><button type="button" className="btn ghost sm" onClick={() => setDatas(l => [...l, { titulo: '', data: '', local: '' }])}>+ Adicionar data</button></div>
      </div>
      {erro && <div className="alerta erro span-2">{erro}</div>}
      <div className="span-2"><button className="btn terra" disabled={enviando}>{enviando ? 'Salvando…' : rotulo}</button></div>
    </form>
  )
}
