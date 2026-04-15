import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/layout/Layout'
import Modal from '../../components/ui/Modal'
import {
  PageHeader, Card, Button, Table, Tr, Td,
  EstadoBadge, Input, Select, Spinner, Badge
} from '../../components/ui'
import { Plus, RefreshCw, CheckSquare, Truck, Package } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export default function Despachos() {
  const { profile } = useAuth()
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<any>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [loadingModal, setLoadingModal] = useState(false)
  const [checkedRows, setCheckedRows] = useState<Set<string>>(new Set())

  const [filtroBuscador, setFiltroBuscador] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('NoDespachados')
  const [filtroFecha, setFiltroFecha] = useState('')
  const [filtroOrden, setFiltroOrden] = useState('NuevosPrimero')

  const fetchData = async () => {
    if (!profile?.deposito_id) return
    setLoading(true)
    let q = supabase
      .from('despachos')
      .select(`*, transportes(nombre), vehiculos(patente, tipo)`)
      .eq('deposito_id', profile.deposito_id)
      .order('created_at', { ascending: filtroOrden === 'AntiguosPrimero' })
      .limit(100)

    if (filtroBuscador) q = q.ilike('numero', `%${filtroBuscador}%`)
    if (filtroEstado === 'NoDespachados') q = q.neq('estado', 'Despachado')
    else if (filtroEstado) q = q.eq('estado', filtroEstado)

    const { data } = await q
    setRows(data ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [profile])

  const openDetalle = async (despacho: any) => {
    setLoadingModal(true)
    setModalOpen(true)
    setSelected(despacho)
    setLoadingModal(false)
  }

  const toggleCheck = (id: string) => {
    const next = new Set(checkedRows)
    next.has(id) ? next.delete(id) : next.add(id)
    setCheckedRows(next)
  }

  const toggleAll = () => {
    if (checkedRows.size === rows.length) setCheckedRows(new Set())
    else setCheckedRows(new Set(rows.map(r => r.id)))
  }

  const avanceColor = (pct: string) => {
    const n = parseFloat(pct)
    if (n >= 100) return 'text-green-400'
    if (n >= 80) return 'text-yellow-400'
    return 'text-red-400'
  }

  return (
    <Layout>
      <PageHeader title="Despachos">
        <Button variant="secondary" size="sm">
          <CheckSquare className="w-4 h-4" /> Crear todas las tareas
        </Button>
        <Button variant="secondary" size="sm">
          <Truck className="w-4 h-4" /> Finalizar despachos
        </Button>
        <Button variant="secondary" size="sm">
          <Package className="w-4 h-4" /> Bultos retornables
        </Button>
        <Button size="sm"><Plus className="w-4 h-4" /> Nuevo</Button>
      </PageHeader>

      <Card>
        {/* Filtros */}
        <div className="p-4 border-b border-dark-600">
          <div className="flex gap-3 items-end flex-wrap">
            <div className="w-52">
              <Input label="Buscador" placeholder="Descripción de despacho..."
                value={filtroBuscador} onChange={e => setFiltroBuscador(e.target.value)} />
            </div>
            <div className="w-36">
              <Input label="Fecha salida" type="date" value={filtroFecha}
                onChange={e => setFiltroFecha(e.target.value)} />
            </div>
            <div className="w-44">
              <Select label="Estado" value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
                <option value="NoDespachados">No Despachados</option>
                <option value="">Todos</option>
                <option value="Pendiente">Pendiente</option>
                <option value="EnCarga">En Carga</option>
                <option value="Despachado">Despachado</option>
                <option value="Anulado">Anulado</option>
              </Select>
            </div>
            <div className="w-44">
              <Select label="Orden" value={filtroOrden} onChange={e => setFiltroOrden(e.target.value)}>
                <option value="NuevosPrimero">Nuevos Primero</option>
                <option value="AntiguosPrimero">Antiguos Primero</option>
              </Select>
            </div>
            <Button onClick={fetchData} size="sm">Buscar</Button>
          </div>
        </div>

        {loading ? <Spinner /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dark-600">
                  <th className="px-4 py-3 w-10">
                    <input type="checkbox" checked={checkedRows.size === rows.length && rows.length > 0}
                      onChange={toggleAll}
                      className="rounded border-dark-500 bg-dark-700 text-primary-500" />
                  </th>
                  {['Descripción', 'Ubicación', 'Fecha estimada', 'Estado', 'P.', 'R.', 'S.', 'Prioridad', 'Avance', 'Acciones'].map(h => (
                    <th key={h} className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-700">
                {rows.map(row => (
                  <tr key={row.id} className="text-gray-300 hover:bg-dark-700/50 transition-colors">
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={checkedRows.has(row.id)}
                        onChange={() => toggleCheck(row.id)}
                        className="rounded border-dark-500 bg-dark-700 text-primary-500" />
                    </td>
                    <Td>
                      <button onClick={() => openDetalle(row)}
                        className="text-primary-400 hover:text-primary-300 font-medium hover:underline text-left">
                        {row.numero ?? row.id.slice(0, 10)}
                      </button>
                    </Td>
                    <Td className="text-xs text-gray-500 font-mono">—</Td>
                    <Td className="text-xs text-gray-500">{row.fecha}</Td>
                    <Td><EstadoBadge estado={row.estado} /></Td>
                    <Td className="text-xs">—</Td>
                    <Td className="text-xs">—</Td>
                    <Td className="text-xs">—</Td>
                    <Td className="text-xs">Media</Td>
                    <Td>
                      <span className={`font-mono text-sm font-semibold`}>—</span>
                    </Td>
                    <Td>
                      <div className="flex gap-2">
                        <button className="text-yellow-400 hover:text-yellow-300 text-xs">Editar</button>
                        <button className="text-blue-400 hover:text-blue-300 text-xs">Imprimir</button>
                        <button className="text-red-400 hover:text-red-300 text-xs">Eliminar</button>
                      </div>
                    </Td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <Tr><Td className="text-center text-gray-500 py-8"><span>Sin resultados</span></Td></Tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Modal detalle despacho */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} size="xl">
        {loadingModal || !selected ? <Spinner /> : (
          <div className="space-y-6">
            {/* Header */}
            <div className="grid grid-cols-4 gap-4 pb-6 border-b border-dark-600">
              <div>
                <p className="text-xl font-bold text-primary-400 font-mono">{selected.numero ?? '—'}</p>
                <p className="text-xs text-gray-500 mt-0.5">Código</p>
              </div>
              <div>
                <p className="text-white">Simple</p>
                <p className="text-xs text-gray-500 mt-0.5">Tipo</p>
              </div>
              <div>
                <p className="text-white">{selected.fecha}</p>
                <p className="text-xs text-gray-500 mt-0.5">Fecha y hora</p>
              </div>
              <div>
                <p className="text-primary-400 font-mono">—</p>
                <p className="text-xs text-gray-500 mt-0.5">Ubicación</p>
              </div>
              <div>
                <EstadoBadge estado={selected.estado} />
                <p className="text-xs text-gray-500 mt-0.5">Estado</p>
              </div>
              <div>
                <p className="text-white">{selected.transportes?.nombre ?? '—'}</p>
                <p className="text-xs text-gray-500 mt-0.5">Transporte</p>
              </div>
              <div>
                <p className="text-white">{selected.vehiculos?.patente ?? '—'}</p>
                <p className="text-xs text-gray-500 mt-0.5">Vehículo</p>
              </div>
              <div>
                <p className="text-white">{selected.observacion ?? '—'}</p>
                <p className="text-xs text-gray-500 mt-0.5">Observación</p>
              </div>
            </div>

            {/* Barras de capacidad */}
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Ocupado / capacidad del transporte
              </h3>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>Volumen</span>
                    <span>— / — m³</span>
                  </div>
                  <div className="h-5 bg-dark-600 rounded-full overflow-hidden">
                    <div className="h-full bg-red-500 rounded-full flex items-center justify-center text-xs text-white font-medium"
                      style={{ width: '30%' }}>
                      — m³
                    </div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>Peso</span>
                    <span>— / — kg</span>
                  </div>
                  <div className="h-5 bg-dark-600 rounded-full overflow-hidden">
                    <div className="h-full bg-red-500 rounded-full flex items-center justify-center text-xs text-white font-medium"
                      style={{ width: '50%' }}>
                      — kg
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Movimientos */}
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Movimientos</h3>
              <div className="rounded-xl border border-dark-600 overflow-hidden">
                <Table headers={['Fecha', 'Evento', 'Usuario']}>
                  <Tr><Td className="text-center text-gray-500 py-6"><span>Sin movimientos</span></Td></Tr>
                </Table>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </Layout>
  )
}
