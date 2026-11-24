// Estrutura do menu: 3 fases e 12 etapas (mesmos ids da tabela "etapas")
export const FASES = [
  {
    id: 'pre', num: '01', nome: 'Pré-charrette', aba: 'Pré', icone: 'search',
    descricao: 'Entender o lugar, o mercado e o problema antes de reunir todo mundo.',
    etapas: [
      { id: 'pesquisa', titulo: 'Pesquisa', descricao: 'Cidade, população e mercado', icone: 'search' },
      { id: 'coleta', titulo: 'Coleta de informações', descricao: 'Legislação, topografia e dados técnicos', icone: 'layers' },
      { id: 'entrevista', titulo: 'Entrevista', descricao: 'Formulário aplicado pela equipe', icone: 'mic' },
      { id: 'problema', titulo: 'Definição do problema', descricao: 'Conclusões e insights', icone: 'spark' },
      { id: 'briefing', titulo: 'Briefing', descricao: 'Ata da reunião', icone: 'doc' },
      { id: 'parceiros', titulo: 'Seleção de parceiros', descricao: 'Catálogo de consultores', icone: 'users' },
    ],
  },
  {
    id: 'charrette', num: '02', nome: 'Charrette', aba: 'Charrette', icone: 'bulb',
    descricao: 'O workshop: várias áreas juntas, gerando e lapidando ideias.',
    etapas: [
      { id: 'conteudo', titulo: 'Conteúdo', descricao: 'Programa e cronograma do workshop', icone: 'calendar' },
      { id: 'toolbox', titulo: 'Toolbox', descricao: 'Escolha das ferramentas e dinâmicas', icone: 'tool' },
      { id: 'dinamica', titulo: 'Dinâmica', descricao: 'Mural de ideias da charrette', icone: 'bulb' },
      { id: 'projeto', titulo: 'Projeto', descricao: 'Esboços e conceitos', icone: 'pencil' },
    ],
  },
  {
    id: 'pos', num: '03', nome: 'Pós-entrega', aba: 'Final', icone: 'flag',
    descricao: 'O resultado consolidado, pronto para seguir adiante.',
    etapas: [
      { id: 'conceito', titulo: 'Conceito consolidado', descricao: 'Naming, storytelling e pilares', icone: 'target' },
      { id: 'prototipo', titulo: 'Protótipo', descricao: 'Envio do PDF final', icone: 'file' },
    ],
  },
]

export const ETAPAS = Object.fromEntries(
  FASES.flatMap(f => f.etapas.map(e => [e.id, { ...e, fase: f }]))
)
export const TODAS_ETAPAS = FASES.flatMap(f => f.etapas)
export const FASE = Object.fromEntries(FASES.map(f => [f.id, f]))

export const STATUS = {
  a_fazer: { rotulo: 'A fazer', classe: 'todo' },
  em_andamento: { rotulo: 'Em andamento', classe: 'doing' },
  concluido: { rotulo: 'Concluído', classe: 'done' },
}

// Progresso: concluído conta 1, em andamento conta meio
export function progresso(etapasIds, statusPorEtapa) {
  if (!etapasIds.length) return 0
  const soma = etapasIds.reduce((acc, id) => {
    const s = statusPorEtapa[id]
    return acc + (s === 'concluido' ? 1 : s === 'em_andamento' ? 0.5 : 0)
  }, 0)
  return Math.round((100 * soma) / etapasIds.length)
}

export function formatarData(iso) {
  if (!iso) return ''
  const [a, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${a}`
}
