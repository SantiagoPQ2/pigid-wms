import { useState, useEffect } from 'react'
import Layout from '../../components/Layout'
import { supabase } from '../../lib/supabase'

type EstadoRepo = 'pendiente' | 'en_proceso' | 'completada' | 'cancelada'

interface ItemReposicion {
  id: string
  articulo_id: string
  articulo_codigo: string
  articulo_nombre: string
  ubicacion_picking_id: string
  ubicacion_picking_codigo: string
  ubicacion_reserva_id: string
  ubicacion_reserva_codigo: string
  cantidad_minima: number
  cantidad_actual: number
  cantidad_reponer: number
  stock_reserva: number
  estado: EstadoRepo
  prioridad: number
  asignado_a: string | null
  created_at: string
}

const PRIORIDAD_LABEL: Record<number, { label: string; color: string }> = {
  1: { label: 'Alta', color: 'bg-red-500/20 text-red-400' },
  2: { label: 'Media', color: 'bg-yellow-500/20 text-yellow-400' },
  3: { label: 'Baja', color: 'bg-dark-700 text-dark-400' },
}

const ESTADO_COLOR: Record<EstadoRepo, string> = {
  pendiente: 'bg-blue-500/20 text-blue-400',
  en_proceso: 'bg-yellow-500/20 text-yellow-400',
  completada: 'bg-green-500/20 text-green-400',
  cancelada: 'bg-dark-700 text-dark-400',
}

export default function ReposicionPicking() {
  const [items, setItems] = useState<ItemReposicion[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroEstado, setFiltroEstado] = useState<EstadoRepo | ''>('')
  const [filtroPrioridad, setFiltroPrioridad] = useState<number | ''>('')
  const [showModal, setShowModal] = useState(false)
  const [seleccionado, setSeleccionado] = useState<ItemReposicion | null>(null)
  const [procesando, setProcesando] = useState<string | null>(null)
  const [showNuevo, setShowNuevo] = useState(false)
  const [articulosBajos, setArticulosBajos] = useState<any[]>([])
  const [generando, setGenerando] = useState(false)

  useEffect(() => { fetchItems() }, [])

  async function fetchItems() {
    setLoading(true)
    const { data } = await supabase
      .from('reposicion_picking')
      .select(`
        id, articulo_id, cantidad_minima, cantidad_actual, cantidad_reponer,
        stock_reserva, estado, prioridad, asignado_a, created_at,
        ubicacion_picking_id, ubicacion_reserva_id,
        articulos(codigo, nombre),
        ubicacion_picking:ubicaciones!ubicacion_picking_id(codigo),
        ubicacion_reserva:ubicaciones!ubicacion_reserva_id(codigo)
      `)
      .order('prioridad', { ascending: true })
      .order('created_at', { ascending: false })

    setItems((data || []).map((i: any) => ({
      ...i,
      articulo_codigo: i.articulos?.codigo || '',
      articulo_nombre: i.articulos?.nombre || '',
      ubicacion_picking_codigo: i.ubicacion_picking?.codigo || '',
      ubicacion_reserva_codigo: i.ubicacion_reserva?.codigo || '',
    })))
    setLoading(false)
  }

  async function detectarBajos() {
    setGenerando(true)
    let bajos: any[] = []
    try {
      const { data } = await supabase.rpc('get_ubicaciones_bajo_minimo')
      bajos = data || []
    } catch {
      // Fallback manual si la función RPC no existe aún
      const { data: stockBajo } = await supabase
        .from('stock')
        .select('*, articulos(codigo, nombre), ubicaciones!inner(codigo, tipo_ubicacion, stock_minimo)')
        .eq('ubicaciones.tipo_ubicacion', 'Picking')
      bajos = (stockBajo || []).filter((s: any) => s.cantidad <= (s.ubicaciones?.stock_minimo || 10))
    }
    setArticulosBajos(bajos)
    setGenerando(false)
    setShowNuevo(true)
  }

  async function cambiarEstado(item: ItemReposicion, nuevoEstado: EstadoRepo) {
    setProcesando(item.id)
    await supabase.from('reposicion_picking').update({ estado: nuevoEstado }).eq('id', item.id)
    if (nuevoEstado === 'completada') {
      try {
        await supabase.rpc('ejecutar_reposicion', { reposicion_id: item.id })
      } catch { /* RPC opcional */ }
    }
    await fetchItems()
    setProcesando(null)
  }

  async function crearReposicion(item: any) {
    await supabase.from('reposicion_picking').insert({
      articulo_id: item.articulo_id,
      ubicacion_picking_id: item.ubicacion_id,
      ubicacion_reserva_id: item.reserva_id || item.ubicacion_id,
      cantidad_minima: item.ubicaciones?.stock_minimo || 10,
      cantidad_actual: item.cantidad,
      cantidad_reponer: Math.max((item.ubicaciones?.stock_minimo || 10) * 2 - item.cantidad, 1),
      stock_reserva: item.stock_reserva || 0,
      estado: 'pendiente',
      prioridad: item.cantidad <= 0 ? 1 : item.cantidad <= 5 ? 2 : 3,
    })
    setShowNuevo(false)
    fetchItems()
  }

  const filtrados = items.filter(i => {
    if (filtroEstado && i.estado !== filtroEstado) return false
    if (filtroPrioridad !== '' && i.prioridad !== filtroPrioridad) return false
    return true
  })

  const pendientes = items.filter(i => i.estado === 'pendiente').length
  const enProceso = items.filter(i => i.estado === 'en_proceso').length
  const completadas = items.filter(i => i.estado === 'completada').length
  const criticos = items.filter(i => i.estado === 'pendiente' && i.cantidad_actual <= 0).length

  return (
    <Layout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Reposición de Picking</h1>
            <p className="text-dark-400 text-sm mt-1">Gestión de reposición desde reserva hacia picking</p>
          </div>
          <div className="flex gap-2">
            <button onClick={fetchItems} className="btn-secondary px-3 py-2 rounded-lg text-sm font-medium">↻ Actualizar</button>
            <button onClick={detectarBajos} disabled={generando} className="btn-primary px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
              {generando ? 'Detectando...' : '⚡ Detectar Faltantes'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Pendientes', value: pendientes, color: 'text-blue-400' },
            { label: 'En Proceso', value: enProceso, color: 'text-yellow-400' },
            { label: 'Completadas', value: completadas, color: 'text-green-400' },
            { label: 'Sin stock', value: criticos, color: 'text-red-400' },
          ].map(k => (
            <div key={k.label} className="card rounded-xl p-4">
              <p className={`text-3xl font-bold ${k.color}`}>{k.value}</p>
              <p className="text-dark-400 text-sm mt-1">{k.label}</p>
            </div>
          ))}
        </div>

        <div className="flex gap-3 mb-4">
          <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value as any)} className="input-dark rounded-lg px-3 py-2 text-sm">
            <option value="">Todos los estados</option>
            <option value="pendiente">Pendiente</option>
            <option value="en_proceso">En proceso</option>
            <option value="completada">Completada</option>
            <option value="cancelada">Cancelada</option>
          </select>
          <select value={filtroPrioridad} onChange={e => setFiltroPrioridad(e.target.value === '' ? '' : parseInt(e.target.value) as any)} className="input-dark rounded-lg px-3 py-2 text-sm">
            <option value="">Todas las prioridades</option>
            <option value="1">Alta</option>
            <option value="2">Media</option>
            <option value="3">Baja</option>
          </select>
          <span className="ml-auto text-dark-400 text-sm self-center">{filtrados.length} tareas</span>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-dark-500 border-t-primary-500 rounded-full animate-spin" /></div>
        ) : (
          <div className="card rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-700">
                  <th className="text-left px-4 py-3 text-dark-400 text-xs font-medium uppercase tracking-wider">Prioridad</th>
                  <th className="text-left px-4 py-3 text-dark-400 text-xs font-medium uppercase tracking-wider">Artículo</th>
                  <th className="text-left px-4 py-3 text-dark-400 text-xs font-medium uppercase tracking-wider">Picking ← Reserva</th>
                  <th className="text-right px-4 py-3 text-dark-400 text-xs font-medium uppercase tracking-wider">Stock actual</th>
                  <th className="text-right px-4 py-3 text-dark-400 text-xs font-medium uppercase tracking-wider">A reponer</th>
                  <th className="text-left px-4 py-3 text-dark-400 text-xs font-medium uppercase tracking-wider">Estado</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtrados.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-10 text-dark-400">
                    {items.length === 0 ? 'Usá "Detectar Faltantes" para generar tareas automáticamente' : 'No hay reposiciones con ese filtro'}
                  </td></tr>
                ) : filtrados.map(item => (
                  <tr key={item.id} className="border-b border-dark-800 hover:bg-dark-800/40 transition-colors">
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${PRIORIDAD_LABEL[item.prioridad]?.color || 'bg-dark-700 text-dark-400'}`}>
                        {PRIORIDAD_LABEL[item.prioridad]?.label || item.prioridad}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-white font-mono font-semibold">{item.articulo_codigo}</p>
                      <p className="text-dark-400 text-xs">{item.articulo_nombre}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-sm">
                        <span className="text-primary-400 font-mono">{item.ubicacion_picking_codigo || '—'}</span>
                        <span className="text-dark-600">←</span>
                        <span className="text-dark-300 font-mono">{item.ubicacion_reserva_codigo || '—'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-bold ${item.cantidad_actual <= 0 ? 'text-red-400' : item.cantidad_actual <= item.cantidad_minima ? 'text-yellow-400' : 'text-white'}`}>
                        {item.cantidad_actual}
                      </span>
                      <span className="text-dark-600 text-xs"> / {item.cantidad_minima} mín</span>
                    </td>
                    <td className="px-4 py-3 text-right text-white font-semibold">{item.cantidad_reponer}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${ESTADO_COLOR[item.estado]}`}>
                        {item.estado.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {item.estado === 'pendiente' && (
                          <button onClick={() => cambiarEstado(item, 'en_proceso')} disabled={procesando === item.id}
                            className="text-xs px-2 py-1 rounded bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 transition-colors disabled:opacity-40">
                            Iniciar
                          </button>
                        )}
                        {item.estado === 'en_proceso' && (
                          <>
                            <button onClick={() => cambiarEstado(item, 'completada')} disabled={procesando === item.id}
                              className="text-xs px-2 py-1 rounded bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors disabled:opacity-40">
                              Completar
                            </button>
                            <button onClick={() => { setSeleccionado(item); setShowModal(true) }}
                              className="text-xs text-dark-400 hover:text-white transition-colors">Ver</button>
                          </>
                        )}
                        {(item.estado === 'pendiente' || item.estado === 'en_proceso') && (
                          <button onClick={() => cambiarEstado(item, 'cancelada')} disabled={procesando === item.id}
                            className="text-xs text-dark-500 hover:text-red-400 transition-colors disabled:opacity-40">
                            Cancelar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {showModal && seleccionado && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="card rounded-xl w-full max-w-md p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-white font-bold">Detalle de Reposición</h2>
                <button onClick={() => setShowModal(false)} className="text-dark-400 hover:text-white">✕</button>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between"><span className="text-dark-400 text-sm">Artículo</span><span className="text-white font-mono font-semibold">{seleccionado.articulo_codigo}</span></div>
                <div className="flex justify-between"><span className="text-dark-400 text-sm">Descripción</span><span className="text-dark-300 text-sm">{seleccionado.articulo_nombre}</span></div>
                <hr className="border-dark-700" />
                <div className="flex justify-between"><span className="text-dark-400 text-sm">Ubicación Picking</span><span className="text-primary-400 font-mono">{seleccionado.ubicacion_picking_codigo}</span></div>
                <div className="flex justify-between"><span className="text-dark-400 text-sm">Ubicación Reserva</span><span className="text-dark-300 font-mono">{seleccionado.ubicacion_reserva_codigo}</span></div>
                <hr className="border-dark-700" />
                <div className="flex justify-between"><span className="text-dark-400 text-sm">Stock actual picking</span><span className={`font-bold ${seleccionado.cantidad_actual <= 0 ? 'text-red-400' : 'text-yellow-400'}`}>{seleccionado.cantidad_actual}</span></div>
                <div className="flex justify-between"><span className="text-dark-400 text-sm">Stock mínimo</span><span className="text-white">{seleccionado.cantidad_minima}</span></div>
                <div className="flex justify-between"><span className="text-dark-400 text-sm">Cantidad a reponer</span><span className="text-green-400 font-bold text-lg">{seleccionado.cantidad_reponer}</span></div>
                <div className="flex justify-between"><span className="text-dark-400 text-sm">Stock en reserva</span><span className="text-dark-300">{seleccionado.stock_reserva}</span></div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setShowModal(false)} className="flex-1 btn-secondary py-2 rounded-lg text-sm">Cerrar</button>
                <button onClick={() => { cambiarEstado(seleccionado, 'completada'); setShowModal(false) }}
                  className="flex-1 btn-primary py-2 rounded-lg text-sm font-medium">
                  ✓ Marcar Completada
                </button>
              </div>
            </div>
          </div>
        )}

        {showNuevo && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="card rounded-xl w-full max-w-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-white font-bold">Artículos por Reponer</h2>
                <button onClick={() => setShowNuevo(false)} className="text-dark-400 hover:text-white">✕</button>
              </div>
              {articulosBajos.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-green-400 text-lg font-semibold">✓ Todo el picking está abastecido</p>
                  <p className="text-dark-400 text-sm mt-2">No se detectaron ubicaciones bajo el mínimo</p>
                </div>
              ) : (
                <>
                  <p className="text-dark-400 text-sm mb-4">{articulosBajos.length} ubicaciones por reponer</p>
                  <div className="space-y-2 max-h-72 overflow-y-auto">
                    {articulosBajos.map((a: any, i: number) => (
                      <div key={i} className="card rounded-lg p-3 flex items-center justify-between">
                        <div>
                          <p className="text-white font-mono font-semibold text-sm">{a.articulos?.codigo || a.articulo_codigo}</p>
                          <p className="text-dark-400 text-xs">{a.ubicaciones?.codigo} · Stock: <span className="text-red-400 font-semibold">{a.cantidad}</span></p>
                        </div>
                        <button onClick={() => crearReposicion(a)}
                          className="text-xs px-3 py-1 rounded bg-primary-600 text-white hover:bg-primary-500 transition-colors">
                          Crear tarea
                        </button>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => articulosBajos.forEach(a => crearReposicion(a))}
                    className="w-full btn-primary py-2 rounded-lg text-sm font-medium mt-4">
                    Crear todas las tareas
                  </button>
                </>
              )}
              <button onClick={() => setShowNuevo(false)} className="w-full btn-secondary py-2 rounded-lg text-sm mt-2">Cerrar</button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
