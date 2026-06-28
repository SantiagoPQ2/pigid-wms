import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/layout/Layout'
import Modal from '../../components/ui/Modal'
import {
  PageHeader, Card, Button, Table, Tr, Td,
  EstadoBadge, Input, Select, Spinner
} from '../../components/ui'
import { Plus, RefreshCw, Eye } from 'lucide-react'

export default function RecepcionDocumentos() {
  const { profile } = useAuth()
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<any>(null)
  const [selectedItems, setSelectedItems] = useState<any[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [loadingModal, setLoadingModal] = useState(false)
  const [nuevoModalOpen, setNuevoModalOpen] = useState(false)

  const [filtroProveedor, setFiltroProveedor] = useState('')
  const [filtroTipoDoc, setFiltroTipoDoc] = useState('')
  const [filtroTipoRec, setFiltroTipoRec] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('PendienteArribo')

  const [proveedores, setProveedores] = useState<any[]>([])

  const fetchProveedores = async () => {
    if (!profile?.negocio_id) return
    const { data } = await supabase.from('proveedores').select('id,nombre')
      .eq('negocio_id', profile.negocio_id).eq('activo', true)
    setProveedores(data ?? [])
  }

  const fetchData = async () => {
    if (!profile?.deposito_id) return
    setLoading(true)
    let q = supabase
      .from('recepciones')
      .select(`*, proveedores(nombre)`)
      .eq('deposito_id', profile.deposito_id)
      .order('created_at', { ascending: false })
      .limit(100)

    if (filtroProveedor) q = q.eq('proveedor_id', filtroProveedor)
    if (filtroTipoDoc) q = q.eq('tipo_documento', filtroTipoDoc)
    if (filtroTipoRec) q = q.eq('tipo_recepcion', filtroTipoRec)
    if (filtroEstado) q = q.eq('estado', filtroEstado)

    const { data } = await q
    setRows(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    fetchProveedores()
    fetchData()
  }, [profile])

  const openDetalle = async (rec: any) => {
    setLoadingModal(true)
    setModalOpen(true)
    setSelected(rec)
    const { data } = await supabase
      .from('recepcion_items')
      .select(`*, articulos(codigo, nombre)`)
      .eq('recepcion_id', rec.id)
    setSelectedItems(data ?? [])
    setLoadingModal(false)
  }

  return (
    <Layout>
      <PageHeader title="Documento de Recepcion">
        <Button onClick={() => setNuevoModalOpen(true)} size="sm">
          <Plus className="w-4 h-4" /> Nuevo Documento
        </Button>
      </PageHeader>

      <Card>
        <div className="p-4 border-b border-dark-600">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Recepción Pendientes</p>
          <div className="flex gap-3 items-end flex-wrap">
            <div className="w-32">
              <Input label="Buscador" placeholder="Buscar..."
                value={filtroProveedor} onChange={e => setFiltroProveedor(e.target.value)} />
            </div>
            <div className="w-48">
              <Select label="Proveedor" value={filtroProveedor} onChange={e => setFiltroProveedor(e.target.value)}>
                <option value="">Seleccione un proveedor</option>
                {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </Select>
            </div>
            <div className="w-44">
              <Select label="Tipo documento" value={filtroTipoDoc} onChange={e => setFiltroTipoDoc(e.target.value)}>
                <option value="">Seleccione un tipo</option>
                <option value="Factura">Factura</option>
                <option value="Remito">Remito</option>
                <option value="OrdenCompra">Orden de Compra</option>
                <option value="Otro">Otro</option>
              </Select>
            </div>
            <div className="w-44">
              <Select label="Tipo recepción" value={filtroTipoRec} onChange={e => setFiltroTipoRec(e.target.value)}>
                <option value="">Seleccione un tipo</option>
                <option value="Normal">Normal</option>
                <option value="ControlCiego">Control Ciego</option>
                <option value="Devolucion">Devolución</option>
              </Select>
            </div>
            <div className="w-44">
              <Select label="Estado" value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
                <option value="PendienteArribo">Pendiente de arribo</option>
                <option value="">Todos</option>
                <option value="EnRecepcion">En Recepción</option>
                <option value="Finalizado">Finalizado</option>
                <option value="Anulado">Anulado</option>
              </Select>
            </div>
            <Button onClick={fetchData} size="sm">Buscar</Button>
          </div>
        </div>

        {loading ? <Spinner /> : (
          <Table headers={['#', 'Tipo Recepcion', 'Tipo de documento', 'Número Documento', 'Fecha', 'Proveedor', 'Estado', 'Observación', 'Orden de Compra', 'Acciones']}>
            {rows.map(row => (
              <Tr key={row.id}>
                <Td>
                  <button onClick={() => openDetalle(row)}
                    className="text-primary-400 hover:text-primary-300 font-mono font-medium hover:underline">
                    {row.id.slice(0, 8)}
                  </button>
                </Td>
                <Td>{row.tipo_recepcion ?? '—'}</Td>
                <Td>{row.tipo_documento ?? '—'}</Td>
                <Td className="font-mono text-xs">{row.numero_documento ?? '—'}</Td>
                <Td className="text-xs text-gray-500">{row.fecha}</Td>
                <Td>{row.proveedores?.nombre ?? '—'}</Td>
                <Td><EstadoBadge estado={row.estado} /></Td>
                <Td className="text-xs text-gray-500 max-w-xs truncate">{row.observacion ?? '—'}</Td>
                <Td className="font-mono text-xs">{row.orden_compra ?? '—'}</Td>
                <Td>
                  <div className="flex gap-2">
                    <button onClick={() => openDetalle(row)}
                      className="text-blue-400 hover:text-blue-300"><Eye className="w-4 h-4" /></button>
                    <button className="text-yellow-400 hover:text-yellow-300 text-xs">Editar</button>
                    <button className="text-red-400 hover:text-red-300 text-xs">Eliminar</button>
                  </div>
                </Td>
              </Tr>
            ))}
            {rows.length === 0 && (
              <Tr><Td className="text-center text-gray-500 py-8"><span>0 resultados</span></Td></Tr>
            )}
          </Table>
        )}

        <div className="p-4 border-t border-dark-600">
          <Button variant="secondary" size="sm">
            Generar control ciego
          </Button>
        </div>
      </Card>

      {/* Modal detalle recepción */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} size="xl">
        {loadingModal || !selected ? <Spinner /> : (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4 pb-6 border-b border-dark-600">
              <div>
                <p className="text-xl font-bold text-primary-400 font-mono">{selected.id.slice(0, 8)}</p>
                <p className="text-xs text-gray-500 mt-0.5">Número</p>
              </div>
              <div>
                <p className="text-white">{selected.fecha}</p>
                <p className="text-xs text-gray-500 mt-0.5">Fecha</p>
              </div>
              <div>
                <EstadoBadge estado={selected.estado} />
                <p className="text-xs text-gray-500 mt-0.5">Estado</p>
              </div>
              <div>
                <p className="text-white">{selected.proveedores?.nombre ?? '—'}</p>
                <p className="text-xs text-gray-500 mt-0.5">Proveedor</p>
              </div>
              <div>
                <p className="text-white">{selected.tipo_documento ?? '—'}</p>
                <p className="text-xs text-gray-500 mt-0.5">Tipo Documento</p>
              </div>
              <div>
                <p className="text-white font-mono">{selected.numero_documento ?? '—'}</p>
                <p className="text-xs text-gray-500 mt-0.5">Número Documento</p>
              </div>
              <div>
                <p className="text-white">{selected.tipo_recepcion ?? '—'}</p>
                <p className="text-xs text-gray-500 mt-0.5">Tipo Recepción</p>
              </div>
              <div>
                <p className="text-white font-mono">{selected.orden_compra ?? '—'}</p>
                <p className="text-xs text-gray-500 mt-0.5">Orden de Compra</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">{selected.observacion ?? '—'}</p>
                <p className="text-xs text-gray-500 mt-0.5">Observación</p>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Artículos</h3>
              <div className="rounded-xl border border-dark-600 overflow-hidden">
                <Table headers={['Código', 'Artículo', 'Cant. Esperada', 'Cant. Recibida', 'Lote', 'Vencimiento', 'Ubicación']}>
                  {selectedItems.length === 0 ? (
                    <Tr><Td className="text-center text-gray-500 py-6"><span>Sin artículos</span></Td></Tr>
                  ) : selectedItems.map(item => (
                    <Tr key={item.id}>
                      <Td className="font-mono text-xs">{item.articulos?.codigo}</Td>
                      <Td className="text-primary-400">{item.articulos?.nombre}</Td>
                      <Td>{item.cantidad_esperada ?? '—'}</Td>
                      <Td className={
                        item.cantidad_recibida >= item.cantidad_esperada ? 'text-green-400' : 'text-yellow-400'
                      }>{item.cantidad_recibida}</Td>
                      <Td className="text-xs text-gray-500">{item.lote ?? '—'}</Td>
                      <Td className="text-xs text-gray-500">{item.vencimiento ?? '—'}</Td>
                      <Td className="text-xs font-mono text-primary-400">{item.ubicacion_id ? item.ubicacion_id.slice(0,8) : '—'}</Td>
                    </Tr>
                  ))}
                </Table>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal nuevo documento */}
      <Modal open={nuevoModalOpen} onClose={() => setNuevoModalOpen(false)} title="Nuevo Documento de Recepción" size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Select label="Proveedor">
              <option value="">Seleccione...</option>
              {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </Select>
            <Select label="Tipo de documento">
              <option value="">Seleccione...</option>
              <option value="Factura">Factura</option>
              <option value="Remito">Remito</option>
              <option value="OrdenCompra">Orden de Compra</option>
              <option value="Otro">Otro</option>
            </Select>
            <Input label="Número de documento" placeholder="Ej: 0001-00012345" />
            <Input label="Orden de compra" placeholder="Número de OC..." />
            <Input label="Fecha" type="date" />
            <Select label="Tipo de recepción">
              <option value="Normal">Normal</option>
              <option value="ControlCiego">Control Ciego</option>
              <option value="Devolucion">Devolución</option>
            </Select>
          </div>
          <Input label="Observación" placeholder="Observaciones..." />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setNuevoModalOpen(false)}>Cancelar</Button>
            <Button>Guardar</Button>
          </div>
        </div>
      </Modal>
    </Layout>
  )
}
