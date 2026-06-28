import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/layout/Layout'
import {
  PageHeader, Card, Button, Table, Tr, Td, Input, Spinner
} from '../../components/ui'
import { Download, Search } from 'lucide-react'
import { format } from 'date-fns'

export function Movimientos() {
  const { profile } = useAuth()
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [articulo, setArticulo] = useState('')

  const consultar = async () => {
    if (!profile?.deposito_id) return
    setLoading(true)
    let q = supabase.from('movimientos')
      .select(`*, articulos(codigo, nombre), ubicaciones_origen:ubicacion_origen_id(codigo), ubicaciones_destino:ubicacion_destino_id(codigo)`)
      .eq('deposito_id', profile.deposito_id)
      .order('created_at', { ascending: false })
      .limit(200)

    if (fechaDesde) q = q.gte('created_at', fechaDesde)
    if (fechaHasta) q = q.lte('created_at', fechaHasta + 'T23:59:59')

    const { data } = await q
    setRows(data ?? [])
    setLoading(false)
  }

  return (
    <Layout>
      <PageHeader title="Movimientos" />
      <Card>
        <div className="p-4 border-b border-dark-600">
          <div className="bg-yellow-900/20 border border-yellow-700/30 rounded-lg px-4 py-2 mb-4 text-xs text-yellow-400">
            Si solo necesitas los datos, podés descargarlos directamente sin realizar una consulta previa.
          </div>
          <div className="flex gap-3 items-end flex-wrap">
            <div className="w-40">
              <Input label="Fecha Desde" type="date" value={fechaDesde}
                onChange={e => setFechaDesde(e.target.value)} />
            </div>
            <div className="w-40">
              <Input label="Fecha Hasta" type="date" value={fechaHasta}
                onChange={e => setFechaHasta(e.target.value)} />
            </div>
            <div className="w-56">
              <Input label="Artículo" placeholder="Seleccione por código o descripción"
                value={articulo} onChange={e => setArticulo(e.target.value)} />
            </div>
            <Button variant="secondary" size="sm">Avanzados</Button>
            <Button variant="secondary" size="sm"><Download className="w-4 h-4" /> Descargar</Button>
            <Button onClick={consultar} size="sm"><Search className="w-4 h-4" /> Consultar</Button>
          </div>
        </div>

        {loading ? <Spinner /> : (
          <Table headers={['Id', 'Movimiento', 'Fecha', 'Usuario', 'Origen', 'Destino', 'Código', 'Artículo', 'Unidades', 'Lote', 'Serie', 'Tipo']}>
            {rows.map(row => (
              <Tr key={row.id}>
                <Td className="font-mono text-xs text-gray-500">{row.id.slice(0, 8)}</Td>
                <Td>{row.tipo}</Td>
                <Td className="text-xs">{format(new Date(row.created_at), 'dd/MM HH:mm')}</Td>
                <Td className="text-xs">{row.usuario_id?.slice(0, 8) ?? '—'}</Td>
                <Td className="font-mono text-xs text-primary-400">{row.ubicaciones_origen?.codigo ?? '—'}</Td>
                <Td className="font-mono text-xs text-primary-400">{row.ubicaciones_destino?.codigo ?? '—'}</Td>
                <Td className="font-mono text-xs">{row.articulos?.codigo}</Td>
                <Td className="text-sm">{row.articulos?.nombre}</Td>
                <Td>{row.cantidad}</Td>
                <Td className="text-xs text-gray-500">{row.lote ?? '—'}</Td>
                <Td className="text-xs text-gray-500">—</Td>
                <Td className="text-xs">{row.referencia_tipo ?? '—'}</Td>
              </Tr>
            ))}
            {rows.length === 0 && (
              <Tr><Td className="text-center text-gray-500 py-8"><span>Ingresá los filtros y presioná Consultar</span></Td></Tr>
            )}
          </Table>
        )}
      </Card>
    </Layout>
  )
}

export function Ajustes() {
  const { profile } = useAuth()
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [articulo, setArticulo] = useState('')
  const [mostrarFiltros, setMostrarFiltros] = useState(false)

  const consultar = async () => {
    if (!profile?.deposito_id) return
    setLoading(true)
    let q = supabase.from('ajustes')
      .select(`*, articulos(codigo, nombre), ubicaciones(codigo), motivos_ajuste(nombre)`)
      .eq('deposito_id', profile.deposito_id)
      .order('created_at', { ascending: false })
      .limit(200)

    if (fechaDesde) q = q.gte('created_at', fechaDesde)
    if (fechaHasta) q = q.lte('created_at', fechaHasta + 'T23:59:59')

    const { data } = await q
    setRows(data ?? [])
    setLoading(false)
  }

  return (
    <Layout>
      <PageHeader title="Ajuste" />
      <Card>
        <div className="p-4 border-b border-dark-600">
          <div className="flex gap-3 items-end flex-wrap">
            <div className="w-40">
              <Input label="Fecha Desde" type="datetime-local" value={fechaDesde}
                onChange={e => setFechaDesde(e.target.value)} />
            </div>
            <div className="w-40">
              <Input label="Fecha Hasta" type="datetime-local" value={fechaHasta}
                onChange={e => setFechaHasta(e.target.value)} />
            </div>
            <div className="w-56">
              <Input label="Artículo" placeholder="Seleccione por código o descripción"
                value={articulo} onChange={e => setArticulo(e.target.value)} />
            </div>
            <Button variant="secondary" size="sm" onClick={() => setMostrarFiltros(f => !f)}>
              Desplegar más filtros
            </Button>
            <Button variant="secondary" size="sm"><Download className="w-4 h-4" /> Descargar</Button>
            <Button onClick={consultar} size="sm"><Search className="w-4 h-4" /> Consultar</Button>
          </div>

          {mostrarFiltros && (
            <div className="mt-3 pt-3 border-t border-dark-600 flex gap-3 flex-wrap">
              <div className="w-40">
                <Input label="Usuario" placeholder="Nombre de usuario..." />
              </div>
              <div className="w-40">
                <Input label="Ubicación" placeholder="Código de ubicación..." />
              </div>
            </div>
          )}
        </div>

        {loading ? <Spinner /> : (
          <Table headers={['Fecha', 'Tipo', 'Artículo', 'Código', 'Ubicación', 'Cantidad', 'Motivo', 'Observación']}>
            {rows.map(row => (
              <Tr key={row.id}>
                <Td className="text-xs">{format(new Date(row.created_at), 'dd/MM HH:mm')}</Td>
                <Td>
                  <span className={row.tipo === 'Entrada' ? 'text-green-400' : 'text-red-400'}>
                    {row.tipo}
                  </span>
                </Td>
                <Td>{row.articulos?.nombre}</Td>
                <Td className="font-mono text-xs">{row.articulos?.codigo}</Td>
                <Td className="font-mono text-xs text-primary-400">{row.ubicaciones?.codigo ?? '—'}</Td>
                <Td className="font-mono">{row.cantidad}</Td>
                <Td className="text-xs text-gray-500">{row.motivos_ajuste?.nombre ?? '—'}</Td>
                <Td className="text-xs text-gray-500 max-w-xs truncate">{row.observacion ?? '—'}</Td>
              </Tr>
            ))}
            {rows.length === 0 && (
              <Tr><Td className="text-center text-gray-500 py-8"><span>Ingresá los filtros y presioná Consultar</span></Td></Tr>
            )}
          </Table>
        )}
      </Card>
    </Layout>
  )
}
