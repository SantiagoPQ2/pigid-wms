import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/layout/Layout'
import Modal from '../../components/ui/Modal'
import {
  PageHeader, Card, Button, Table, Tr, Td,
  EstadoBadge, Input, Select, Spinner
} from '../../components/ui'
import { Plus, RefreshCw } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export default function Pedidos() {
  const { profile } = useAuth()
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<any>(null)
  const [selectedItems, setSelectedItems] = useState<any[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [loadingModal, setLoadingModal] = useState(false)

  // Filters
  const [filtroCodigo, setFiltroCodigo] = useState('')
  const [filtroCliente, setFiltroCliente] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('Pendiente')
  const [filtroFechaDesde, setFiltroFechaDesde] = useState('')
  const [filtroFechaHasta, setFiltroFechaHasta] = useState('')

  const fetchData = async () => {
    if (!profile?.deposito_id) return
    setLoading(true)
    let q = supabase
      .from('pedidos')
      .select(`*, clientes(nombre, direccion, region)`)
      .eq('deposito_id', profile.deposito_id)
      .order('created_at', { ascending: false })
      .limit(100)

    if (filtroCodigo) q = q.ilike('numero', `%${filtroCodigo}%`)
    if (filtroEstado) q = q.eq('estado', filtroEstado)
    if (filtroFechaDesde) q = q.gte('fecha', filtroFechaDesde)
    if (filtroFechaHasta) q = q.lte('fecha', filtroFechaHasta)

    const { data } = await q
    setRows(data ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [profile])

  const openDetalle = async (pedido: any) => {
    setLoadingModal(true)
    setModalOpen(true)
    setSelected(pedido)
    const { data } = await supabase
      .from('pedido_items')
      .select(`*, articulos(codigo, nombre, peso, volumen)`)
      .eq('pedido_id', pedido.id)
    setSelectedItems(data ?? [])
    setLoadingModal(false)
  }

  return (
    <Layout>
      <PageHeader title="Pedidos">
        <Button onClick={fetchData} variant="secondary" size="sm">
          <RefreshCw className="w-4 h-4" />
        </Button>
        <Button size="sm"><Plus className="w-4 h-4" /> Nuevo</Button>
      </PageHeader>

      <Card>
        {/* Filtros */}
        <div className="p-4 border-b border-dark-600">
          <div className="flex gap-3 items-end flex-wrap">
            <div className="w-36">
              <Input label="Código Pedido" value={filtroCodigo}
                onChange={e => setFiltroCodigo(e.target.value)} placeholder="Código..." />
            </div>
            <div className="w-36">
              <Input label="Dirección/Cliente" value={filtroCliente}
                onChange={e => setFiltroCliente(e.target.value)} placeholder="Cliente..." />
            </div>
            <div className="w-44">
              <Select label="Estado" value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
                <option value="">Todos</option>
                <option value="Pendiente">Pendiente</option>
                <option value="EnPreparacion">En Preparación</option>
                <option value="Preparado">Preparado</option>
                <option value="Despachado">Despachado</option>
                <option value="Anulado">Anulado</option>
              </Select>
            </div>
            <div className="w-36">
              <Input label="Fecha Desde" type="date" value={filtroFechaDesde}
                onChange={e => setFiltroFechaDesde(e.target.value)} />
            </div>
            <div className="w-36">
              <Input label="Fecha Hasta" type="date" value={filtroFechaHasta}
                onChange={e => setFiltroFechaHasta(e.target.value)} />
            </div>
            <Button onClick={fetchData} size="sm">Buscar</Button>
          </div>
        </div>

        {loading ? <Spinner /> : (
          <Table headers={['Código', 'Estado', 'Cliente', 'Fecha', 'Fecha Entrega', 'Observación', 'Acción']}>
            {rows.map(row => (
              <Tr key={row.id}>
                <Td>
                  <button
                    onClick={() => openDetalle(row)}
                    className="text-primary-400 hover:text-primary-300 font-mono font-medium hover:underline"
                  >
                    {row.numero}
                  </button>
                </Td>
                <Td><EstadoBadge estado={row.estado} /></Td>
                <Td>{row.clientes?.nombre ?? '—'}</Td>
                <Td className="text-xs text-gray-500">{row.fecha}</Td>
                <Td className="text-xs text-gray-500">{row.fecha_entrega ?? '—'}</Td>
                <Td className="text-xs text-gray-500 max-w-xs truncate">{row.observacion ?? '—'}</Td>
                <Td>
                  <div className="flex gap-2">
                    <button className="text-xs text-yellow-400 hover:text-yellow-300">Editar</button>
                    <button className="text-xs text-red-400 hover:text-red-300">Eliminar</button>
                  </div>
                </Td>
              </Tr>
            ))}
            {rows.length === 0 && (
              <Tr><Td className="text-center text-gray-500 py-8"><span>Sin resultados</span></Td></Tr>
            )}
          </Table>
        )}
      </Card>

      {/* Modal detalle pedido */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} size="xl">
        {loadingModal || !selected ? <Spinner /> : (
          <div className="space-y-6">
            {/* Header */}
            <div className="grid grid-cols-4 gap-4 pb-6 border-b border-dark-600">
              <div>
                <p className="text-xl font-bold text-primary-400 font-mono">{selected.numero}</p>
                <p className="text-xs text-gray-500 mt-0.5">Código</p>
              </div>
              <div>
                <p className="text-white">{selected.fecha} {format(new Date(selected.created_at), 'HH:mm:ss')}</p>
                <p className="text-xs text-gray-500 mt-0.5">Fecha</p>
              </div>
              <div>
                <p className="text-white">{selected.fecha_entrega ?? '—'}</p>
                <p className="text-xs text-gray-500 mt-0.5">Fecha entrega</p>
              </div>
              <div>
                <EstadoBadge estado={selected.estado} />
                <p className="text-xs text-gray-500 mt-0.5">Estado</p>
              </div>
              <div>
                <p className="text-white">{selected.clientes?.nombre ?? '—'}</p>
                <p className="text-xs text-gray-500 mt-0.5">Descripción/Cliente</p>
              </div>
              <div className="col-span-2">
                <p className="text-primary-400">{selected.clientes?.nombre ?? '—'} — {selected.clientes?.region ?? ''}</p>
                <p className="text-xs text-gray-500 mt-0.5">Ubicación de Cliente</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">{selected.observacion ?? '—'}</p>
                <p className="text-xs text-gray-500 mt-0.5">Observación</p>
              </div>
            </div>

            {/* Ubicación */}
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Ubicación</h3>
              <div className="grid grid-cols-3 gap-4 p-4 bg-dark-700/50 rounded-xl">
                <div>
                  <p className="text-white font-medium">{selected.clientes?.direccion ?? '—'}</p>
                  <p className="text-xs text-gray-500">Dirección</p>
                </div>
                <div>
                  <p className="text-white">—</p>
                  <p className="text-xs text-gray-500">Localidad</p>
                </div>
                <div>
                  <p className="text-white">{selected.clientes?.region ?? '—'}</p>
                  <p className="text-xs text-gray-500">Provincia/Región</p>
                </div>
              </div>
            </div>

            {/* Información adicional */}
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Información adicional</h3>
              <div className="grid grid-cols-3 gap-4 p-4 bg-dark-700/50 rounded-xl">
                <div>
                  <p className="text-gray-400 text-sm">—</p>
                  <p className="text-xs text-gray-500">Código Vendedor</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">—</p>
                  <p className="text-xs text-gray-500">Vendedor</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">—</p>
                  <p className="text-xs text-gray-500">Importe</p>
                </div>
              </div>
            </div>

            {/* Detalle artículos */}
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Detalle</h3>
              <div className="rounded-xl border border-dark-600 overflow-hidden">
                <Table headers={['Código', 'Artículo', 'Lote', 'Vencimiento', 'Unidades', 'Satisfechas', 'Peso', 'Volumen']}>
                  {selectedItems.length === 0 ? (
                    <Tr><Td className="text-center text-gray-500 py-6"><span>Sin artículos</span></Td></Tr>
                  ) : selectedItems.map(item => (
                    <Tr key={item.id}>
                      <Td className="font-mono text-xs">{item.articulos?.codigo}</Td>
                      <Td className="text-primary-400 text-sm">{item.articulos?.nombre}</Td>
                      <Td className="text-xs text-gray-500">—</Td>
                      <Td className="text-xs text-gray-500">—</Td>
                      <Td>{item.cantidad_pedida}</Td>
                      <Td className={item.cantidad_pedida === item.cantidad_preparada ? 'text-green-400' : 'text-yellow-400'}>
                        {item.cantidad_preparada}
                      </Td>
                      <Td className="text-xs text-gray-500">{item.articulos?.peso ? `${item.articulos.peso} kg` : '—'}</Td>
                      <Td className="text-xs text-gray-500">{item.articulos?.volumen ? `${item.articulos.volumen} m³` : '—'}</Td>
                    </Tr>
                  ))}
                </Table>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </Layout>
  )
}
