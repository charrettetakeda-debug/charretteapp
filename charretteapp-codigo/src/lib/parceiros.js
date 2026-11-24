import { formatarData } from './estrutura'

export const AREAS = ['Urbanismo', 'Arquitetura', 'Paisagismo', 'Engenharia', 'Ambiental', 'Jurídico', 'Mercado / vendas', 'Turismo', 'Patrimônio / cultura', 'Mobilidade', 'Sociologia / comunidade', 'Outra']

export const STATUS_PARCEIRO = {
  a_convidar: { rotulo: 'Sugerido', classe: 'todo' },
  convidado: { rotulo: 'Convidado', classe: 'doing' },
  confirmado: { rotulo: 'Confirmado', classe: 'done' },
  recusado: { rotulo: 'Recusou', classe: 'no' },
}

export const linkConvite = token => `${window.location.origin}/convite/${token}`

export function mensagemConvite(p, charrette) {
  const quando = charrette.data_evento ? ` em ${formatarData(charrette.data_evento)}` : ''
  const onde = [charrette.cidade, charrette.uf].filter(Boolean).join('/')
  return `Olá${p.nome ? `, ${p.nome.split(' ')[0]}` : ''}! A equipe Charrette quer você como parceiro na charrette "${charrette.nome}"${onde ? ` (${onde})` : ''}${quando}.`
    + `${p.mensagem ? `\n\n${p.mensagem}` : ''}\n\nVeja o resumo e responda pelo link: ${linkConvite(p.convite_token)}`
}

export const iniciaisDe = n => (n || '?').split(/\s+/).map(x => x[0]).slice(0, 2).join('').toUpperCase()
