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
import { Preparacion } from '../../types'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface PrepDetalle {
  preparacion: any
  items: any[]
  pedidos: any[]
  tareas: any[]
  contenedores: any[]
  controles: any[]
}

export default function Preparaciones() {
  const { profile } = useAuth()
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<PrepDetalle | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [loadingModal, setLoadingModal] = useState(false)

  // Filters
  const [filtroNumero, setFiltroNumero] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')

  const fetchData = async () => {
    if (!profile?.deposito_id) return
    setLoading(true)
    let q = supabase
      .from('preparaciones')
      .select(`*, pedidos(numero, clientes(nombre))`)
      .eq('deposito_id', profile.deposito_id)
      .order('created_at', { ascending: false })
      .limit(100)

    if (filtroNumero) q = q.ilike('numero', `%${filtroNumero}%`)
    if (filtroEstado) q = q.eq('estado', filtroEstado)

    const { data } = await q
    setRows(data ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [profile])

  const openDetalle = async (prep: any) => {
    setLoadingModal(true)
    setModalOpen(true)

    const [items, tareas] = await Promise.all([
      supabase.from('preparacion_items')
        .select(`*, articulos(codigo, nombre)`)
        .eq('preparacion_id', prep.id),
      supabase.from('tareas')
        .select('*')
        .eq('referencia_id', prep.id),
    ])

    setSelected({
      preparacion: prep,
      items: items.data ?? [],
      pedidos: prep.pedidos ? [prep.pedidos] : [],
      tareas: tareas.data ?? [],
      contenedores: [],
      controles: [],
    })
    setLoadingModal(false)
  }

  const estadoColor = (e: string) => {
    const m: Record<string, string> = {
      Pendiente: 'text-yellow-400', EnProceso: 'text-blue-400',
      Finalizado: 'text-green-400', Suspendido: 'text-orange-400', Anulado: 'text-red-400'
    }
    return m[e] ?? 'text-gray-400'
  }

  return (
    <Layout>
      <PageHeader title="Preparaciones">
        <Button onClick={fetchData} variant="secondary" size="sm">
          <RefreshCw className="w-4 h-4" />
        </Button>
        <Button size="sm"><Plus className="w-4 h-4" /> Nueva</Button>
      </PageHeader>

      <Card>
        {/* Filtros */}
        <div className="p-4 border-b border-dark-600">
          <div className="flex gap-3 items-end flex-wrap">
            <div className="w-36">
              <Input
                label="# Preparación"
                placeholder="Buscar..."
                value={filtroNumero}
                onChange={e => setFiltroNumero(e.target.value)}
              />
            </div>
            <div className="w-44">
              <Select label="Estado" value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
                <option value="">Todos</option>
                <option value="Pendiente">Pendiente</option>
                <option value="EnProceso">En Proceso</option>
                <option value="Finalizado">Finalizado</option>
                <option value="Suspendido">Suspendido</option>
                <option value="Anulado">Anulado</option>
              </Select>
            </div>
            <Button onClick={fetchData} size="sm">Buscar</Button>
          </div>
        </div>

        {loading ? <Spinner /> : (
          <Table headers={['#', 'Cliente', 'Pedido', 'Estado', 'Prioridad', 'Fecha', 'Acciones']}>
            {rows.map(row => (
              <Tr key={row.id}>
                <Td>
                  <button
                    onClick={() => openDetalle(row)}
                    className="text-primary-400 hover:text-primary-300 font-mono font-medium hover:underline"
                  >
                    {row.numero ?? row.id.slice(0, 8)}
                  </button>
                </Td>
                <Td>{row.pedidos?.clientes?.nombre ?? '—'}</Td>
                <Td className="font-mono text-xs">{row.pedidos?.numero ?? '—'}</Td>
                <Td><EstadoBadge estado={row.estado} /></Td>
                <Td>{row.prioridad}</Td>
                <Td className="text-xs text-gray-500">
                  {format(new Date(row.created_at), 'dd/MM/yy HH:mm', { locale: es })}
                </Td>
                <Td>
                  <div className="flex gap-2">
                    <button className="text-xs text-blue-400 hover:text-blue-300">Ver</button>
                    <button className="text-xs text-red-400 hover:text-red-300">Eliminar</button>
                  </div>
                </Td>
              </Tr>
            ))}
            {rows.length === 0 && (
              <Tr><Td className="text-center text-gray-500 py-8" ><span>Sin resultados</span></Td></Tr>
            )}
          </Table>
        )}
      </Card>

      {/* Modal detalle preparación */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} size="full">
        {loadingModal ? <Spinner /> : selected && (
          <div className="space-y-6">
            {/* Header del modal */}
            <div className="flex items-start justify-between">
              <div />
              <Button variant="secondary" size="sm">Desconsolidar</Button>
            </div>

            {/* Info principal - grid 3 cols */}
            <div className="grid grid-cols-3 gap-6 pb-6 border-b border-dark-600">
              <div>
                <p className="text-2xl font-bold text-primary-400 font-mono">
                  #{selected.preparacion.numero ?? selected.preparacion.id.slice(0, 8)}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">Número de preparación</p>
              </div>
              <div>
                <p className="text-white font-medium">
                  {format(new Date(selected.preparacion.created_at), "dd/MM/yyyy HH:mm", { locale: es })}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">Fecha / Hora</p>
              </div>
              <div>
                <p className={`font-semibold ${estadoColor(selected.preparacion.estado)}`}>
                  {selected.preparacion.estado}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">Estado</p>
              </div>
              <div>
                <p className="text-white">{selected.preparacion.usuario_id ?? '—'}</p>
                <p className="text-xs text-gray-500 mt-0.5">Usuario</p>
              </div>
              <div>
                <p className="text-primary-400 font-medium">
                  {selected.preparacion.pedidos?.numero ?? '—'}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">Pedido</p>
              </div>
              <div>
                <p className="text-white">
                  {selected.preparacion.pedidos?.clientes?.nombre ?? 'Sin cliente'}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">Cliente</p>
              </div>
            </div>

            {/* Sección 1: Preparación detalle */}
            <div>
              <h3 className="text-white font-semibold mb-3">Preparación detalle</h3>
              <div className="rounded-xl border border-dark-600 overflow-hidden">
                <Table headers={['Código', 'Artículo', 'Requeridas', 'Preparadas', 'Estado']}>
                  {selected.items.length === 0 ? (
                    <Tr><Td className="text-center text-gray-500 py-6"><span>Sin artículos</span></Td></Tr>
                  ) : selected.items.map((item: any) => (
                    <Tr key={item.id}>
                      <Td className="font-mono text-xs">{item.articulos?.codigo}</Td>
                      <Td className="text-primary-400">{item.articulos?.nombre}</Td>
                      <Td>{item.cantidad_requerida}</Td>
                      <Td>{item.cantidad_preparada}</Td>
                      <Td><EstadoBadge estado={item.estado} /></Td>
                    </Tr>
                  ))}
                </Table>
              </div>
            </div>

            {/* Sección 2: Pedidos asociados */}
            <div>
              <h3 className="text-white font-semibold mb-3">Pedidos Asociados</h3>
              <div className="rounded-xl border border-dark-600 overflow-hidden">
                <Table headers={['Código', 'Cliente', 'Fecha', 'Fecha Entrega', 'Estado']}>
                  {selected.pedidos.length === 0 ? (
                    <Tr><Td className="text-center text-gray-500 py-6"><span>Sin pedidos</span></Td></Tr>
                  ) : selected.pedidos.map((p: any, i: number) => (
                    <Tr key={i}>
                      <Td className="text-primary-400 font-mono">{p.numero}</Td>
                      <Td>{p.clientes?.nombre ?? '—'}</Td>
                      <Td className="text-xs">{p.fecha}</Td>
                      <Td className="text-xs">{p.fecha_entrega ?? '—'}</Td>
                      <Td><EstadoBadge estado={p.estado} /></Td>
                    </Tr>
                  ))}
                </Table>
              </div>
            </div>

            {/* Sección 3: Tareas asociadas */}
            <div>
              <h3 className="text-white font-semibold mb-3">Tareas asociadas</h3>
              <div className="rounded-xl border border-dark-600 overflow-hidden">
                <Table headers={['#', 'Tipo', 'Fecha', 'Estado', 'Prioridad']}>
                  {selected.tareas.length === 0 ? (
                    <Tr><Td className="text-center text-gray-500 py-6"><span>Sin tareas</span></Td></Tr>
                  ) : selected.tareas.map((t: any) => (
                    <Tr key={t.id}>
                      <Td className="font-mono text-xs text-primary-400">{t.id.slice(0, 8)}</Td>
                      <Td>{t.tipo}</Td>
                      <Td className="text-xs">{format(new Date(t.created_at), 'dd/MM HH:mm')}</Td>
                      <Td><EstadoBadge estado={t.estado} /></Td>
                      <Td>{t.prioridad}</Td>
                    </Tr>
                  ))}
                </Table>
              </div>
            </div>

            {/* Sección 4: Contenedores */}
            <div>
              <h3 className="text-white font-semibold mb-3">Contenedores</h3>
              <div className="rounded-xl border border-dark-600 overflow-hidden">
                <Table headers={['Número', 'Ubicación Actual', 'Tipo', 'Artículos', 'Bultos']}>
                  <Tr><Td className="text-center text-gray-500 py-6"><span>Sin contenedores</span></Td></Tr>
                </Table>
              </div>
            </div>

            {/* Sección 5: Controles */}
            <div>
              <h3 className="text-white font-semibold mb-3">Controles</h3>
              <div className="rounded-xl border border-dark-600 overflow-hidden">
                <Table headers={['#', 'Contenedor', 'Ubicación', 'Usuario', 'Fecha', 'Modo', 'Estado']}>
                  <Tr><Td className="text-center text-gray-500 py-6"><span>Sin controles</span></Td></Tr>
                </Table>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </Layout>
  )
}
