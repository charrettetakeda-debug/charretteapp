import { Link } from 'react-router-dom'
import Icone from './Icone'
import { useCharrette } from '../lib/contexto'
import '../aovivo.css'

export default function ChamadaAoVivo() {
  const { atual, podeGerir } = useCharrette()
  if (!podeGerir) return null
  const aoVivo = !!atual.ao_vivo_item
  return (
    <div className="card chamada-aovivo">
      <div className="icobox" style={{ background: '#B12C39' }}><Icone nome="spark" cor="#fff" /></div>
      <div style={{ flex: 1, minWidth: 220 }}>
        <h3>{aoVivo ? 'A charrette está ao vivo' : 'Modo ao vivo'}</h3>
        <p>{aoVivo
          ? 'O telão e os celulares estão acompanhando o roteiro. Volte para conduzir as dinâmicas.'
          : 'Conduza o dia no telão: roteiro, cronômetro e o Padlet de cada dinâmica. Participantes acompanham pelo celular com um QR code.'}</p>
      </div>
      <Link className="btn terra" to="/ao-vivo">{aoVivo ? 'Voltar ao telão' : 'Abrir modo ao vivo'} <Icone nome="arrow" cor="#fff" tamanho={16} /></Link>
    </div>
  )
}
