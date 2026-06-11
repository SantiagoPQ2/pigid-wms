import { useState, useEffect, useCallback } from 'react'
import Layout from '../../components/layout/Layout'
import { supabase } from '../../lib/supabase'
import {
  Truck, Plus, RefreshCw, Save, ChevronDown, ChevronUp,
  MapPin, Package, AlertTriangle, CheckCircle, X, Search,
  ArrowRight, Loader2, Info
} from 'lucide-react'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Transporte {
  id: number
  nomcli: string
  chapa: string
  modelo: string
  propio: boolean
  maxpeso: number
  maxpdvs: number
}

interface Reparto {
  idreparto: number
  idtransp: number
  dstransp: string
  totcnt: number
  totpes: number
  totval: number
  totpdv: number
  bloqueada: boolean
}

interface PtoEntrega {
  cpbte: string
  idreparto: number
  idtransp: number
  dstransp: string
  dscliente: string
  calle: string
  altura: string
  dslocalidad: string
  ruta: number
  rutadis: number
  d_ruta: string
  totcnt: number
  totpes: number
  totval: number
  xcoord: string
  ycoord: string
}

interface Reasignacion {
  cpbte: string
  idreparto: number
  idtransp: number
}

// ─── Edge Function helper ─────────────────────────────────────────────────────

async function callEdge(accion: string, extra: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke('ruteo-chess', {
    body: { accion, iddepo: 1, identorno: 1, ...extra },
  })
  if (error) throw new Error(error.message)
  if (data?.error) throw new Error(data.error)
  return data
}

// ─── Utilidades ──────────────────────────────────────────────────────────────

function hoy() {
  return new Date().toISOString().slice(0, 10)
}

function fmtPeso(n: number) {
  return n.toLocaleString('es-AR', { maximumFractionDigits: 1 }) + ' kg'
}

function fmtImporte(n: number) {
  return '$' + n.toLocaleString('es-AR', { maximumFractionDigits: 0 })
}

// ─── Subcomponente: tarjeta de camión ────────────────────────────────────────

function TarjetaCamion({
  reparto,
  ptos,
  seleccionado,
  onClick,
  onQuitarPto,
}: {
  reparto: Reparto
  ptos: PtoEntrega[]
  seleccionado: boolean
  onClick: () => void
  onQuitarPto: (cpbte: string) => void
}) {
  const [expandido, setExpandido] = useState(false)
  const ptosDelReparto = ptos.filter(p => p.idreparto === reparto.idreparto)

  return (
    <div
      className={`rounded-xl border transition-all cursor-pointer
        ${seleccionado
          ? 'border-primary-500 bg-primary-900/20 ring-1 ring-primary-500/40'
          : 'border-dark-600 bg-dark-800 hover:border-dark-500'
        }`}
    >
      {/* Header tarjeta */}
      <div className="p-3 flex items-center gap-3" onClick={onClick}>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0
          ${seleccionado ? 'bg-primary-600' : 'bg-dark-700'}`}>
          <Truck className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">{reparto.dstransp}</p>
          <p className="text-xs text-dark-400">
            Reparto #{reparto.idreparto} · {ptosDelReparto.length} PDE
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs text-dark-400">{fmtPeso(reparto.totpes)}</p>
          <p className="text-xs text-green-400">{fmtImporte(reparto.totval)}</p>
        </div>
        <button
          className="text-dark-500 hover:text-white ml-1 p-1"
          onClick={e => { e.stopPropagation(); setExpandido(v => !v) }}
        >
          {expandido ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Lista de pedidos asignados */}
      {expandido && (
        <div className="border-t border-dark-700 divide-y divide-dark-700/50">
          {ptosDelReparto.length === 0 && (
            <p className="text-xs text-dark-500 px-4 py-3 text-center">Sin pedidos asignados</p>
          )}
          {ptosDelReparto.map(p => (
            <div key={p.cpbte} className="flex items-center gap-2 px-4 py-2">
              <MapPin className="w-3 h-3 text-dark-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white truncate">{p.dscliente}</p>
                <p className="text-xs text-dark-500 truncate">{p.cpbte} · {p.calle} {p.altura}, {p.dslocalidad}</p>
              </div>
              <button
                onClick={e => { e.stopPropagation(); onQuitarPto(p.cpbte) }}
                className="text-dark-600 hover:text-red-400 transition-colors p-0.5 shrink-0"
                title="Quitar de este reparto"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function RuteoAutomatico() {
  const [fecha, setFecha] = useState(hoy())

  // Data de Chess
  const [transportesDisp, setTransportesDisp] = useState<Transporte[]>([])
  const [repartos, setRepartos] = useState<Reparto[]>([])
  const [ptosEntrega, setPtosEntrega] = useState<PtoEntrega[]>([])

  // Reasignaciones pendientes (en memoria, aún no guardadas)
  const [reasignaciones, setReasignaciones] = useState<Map<string, Reasignacion>>(new Map())

  // UI state
  const [cargando, setCargando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [exito, setExito] = useState('')
  const [repartoSelec, setRepartoSelec] = useState<number | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [modalTransporte, setModalTransporte] = useState(false)
  const [busqTransporte, setBusqTransporte] = useState('')
  const [agregandoTransp, setAgregandoTransp] = useState<number | null>(null)

  // ── Cargar distribución del día ──
  const cargarDistribucion = useCallback(async () => {
    setCargando(true)
    setError('')
    try {
      const data = await callEdge('get_distribucion', { fecha })
      setRepartos(data.repartos ?? [])
      // Aplicar reasignaciones pendientes sobre los ptos frescos
      const ptosFrescos: PtoEntrega[] = data.ptos_entrega ?? []
      setPtosEntrega(ptosFrescos)
      setReasignaciones(new Map()) // reset pendientes al recargar
      setRepartoSelec(null)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setCargando(false)
    }
  }, [fecha])

  // ── Cargar transportes disponibles ──
  const cargarTransportes = useCallback(async () => {
    try {
      const data = await callEdge('get_transportes')
      setTransportesDisp(data.transportes ?? [])
    } catch (e: any) {
      setError(e.message)
    }
  }, [])

  useEffect(() => {
    cargarDistribucion()
    cargarTransportes()
  }, [cargarDistribucion, cargarTransportes])

  // ── Agregar transporte nuevo ──
  const agregarTransporte = async (idtransporte: number) => {
    setAgregandoTransp(idtransporte)
    setError('')
    try {
      const data = await callEdge('agregar_transporte', { idtransporte })
      // Agregar el nuevo reparto a la lista local
      setRepartos(prev => [...prev, data.reparto])
      setModalTransporte(false)
      setExito(`Transporte ${data.reparto.dstransp} agregado con reparto #${data.reparto.idreparto}`)
      setTimeout(() => setExito(''), 4000)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setAgregandoTransp(null)
    }
  }

  // ── Asignar pedido seleccionado al reparto activo ──
  const asignarPto = (pto: PtoEntrega) => {
    if (repartoSelec === null) return
    const reparto = repartos.find(r => r.idreparto === repartoSelec)
    if (!reparto) return

    // Actualizar vista local
    setPtosEntrega(prev =>
      prev.map(p =>
        p.cpbte === pto.cpbte
          ? { ...p, idreparto: reparto.idreparto, idtransp: reparto.idtransp, dstransp: reparto.dstransp }
          : p
      )
    )

    // Registrar reasignación pendiente
    setReasignaciones(prev => {
      const next = new Map(prev)
      next.set(pto.cpbte, { cpbte: pto.cpbte, idreparto: reparto.idreparto, idtransp: reparto.idtransp })
      return next
    })
  }

  // ── Quitar pedido (vuelve a sin asignar — idreparto 0) ──
  const quitarPto = (cpbte: string) => {
    setPtosEntrega(prev =>
      prev.map(p =>
        p.cpbte === cpbte ? { ...p, idreparto: 0, idtransp: 0, dstransp: 'Sin asignar' } : p
      )
    )
    setReasignaciones(prev => {
      const next = new Map(prev)
      next.set(cpbte, { cpbte, idreparto: 0, idtransp: 0 })
      return next
    })
  }

  // ── Guardar en Chess ──
  const guardar = async () => {
    if (reasignaciones.size === 0) return
    setGuardando(true)
    setError('')
    try {
      const lista = Array.from(reasignaciones.values())
      const data = await callEdge('guardar_distribucion', { fecha, reasignaciones: lista })
      setReasignaciones(new Map())
      setExito(`✅ Guardado: ${data.reasignados} pedidos reasignados correctamente`)
      setTimeout(() => setExito(''), 5000)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setGuardando(false)
    }
  }

  // ── Filtros ──
  const ptosFiltrados = ptosEntrega.filter(p => {
    if (!busqueda) return true
    const q = busqueda.toLowerCase()
    return (
      p.dscliente?.toLowerCase().includes(q) ||
      p.cpbte?.toLowerCase().includes(q) ||
      p.dslocalidad?.toLowerCase().includes(q) ||
      p.dstransp?.toLowerCase().includes(q)
    )
  })

  const transportesFiltrados = transportesDisp.filter(t => {
    if (!busqTransporte) return true
    const q = busqTransporte.toLowerCase()
    return (
      t.nomcli?.toLowerCase().includes(q) ||
      t.chapa?.toLowerCase().includes(q) ||
      t.modelo?.toLowerCase().includes(q)
    )
  })

  // Transportes que ya tienen reparto activo
  const idsConReparto = new Set(repartos.map(r => r.idtransp))
  const transportesNuevos = transportesFiltrados.filter(t => !idsConReparto.has(t.id))

  const hayPendientes = reasignaciones.size > 0

  return (
    <Layout>
      <div className="max-w-screen-xl mx-auto px-4 py-6">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Truck className="w-5 h-5 text-primary-400" />
              Ruteo Automático
            </h1>
            <p className="text-sm text-dark-400 mt-0.5">
              Asignación de pedidos a transportes — Chess ERP
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Fecha */}
            <input
              type="date"
              value={fecha}
              onChange={e => setFecha(e.target.value)}
              className="bg-dark-700 border border-dark-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-primary-500"
            />

            {/* Recargar */}
            <button
              onClick={cargarDistribucion}
              disabled={cargando}
              className="flex items-center gap-2 bg-dark-700 hover:bg-dark-600 text-white text-sm px-3 py-2 rounded-lg border border-dark-600 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${cargando ? 'animate-spin' : ''}`} />
              Recargar
            </button>

            {/* Agregar transporte */}
            <button
              onClick={() => setModalTransporte(true)}
              className="flex items-center gap-2 bg-dark-700 hover:bg-dark-600 text-white text-sm px-3 py-2 rounded-lg border border-dark-600 transition-colors"
            >
              <Plus className="w-4 h-4 text-primary-400" />
              Transporte
            </button>

            {/* Guardar */}
            <button
              onClick={guardar}
              disabled={!hayPendientes || guardando}
              className={`flex items-center gap-2 text-sm px-4 py-2 rounded-lg font-medium transition-colors
                ${hayPendientes
                  ? 'bg-primary-600 hover:bg-primary-500 text-white'
                  : 'bg-dark-700 text-dark-500 border border-dark-600 cursor-not-allowed'
                }`}
            >
              {guardando
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</>
                : <><Save className="w-4 h-4" /> Guardar{hayPendientes ? ` (${reasignaciones.size})` : ''}</>
              }
            </button>
          </div>
        </div>

        {/* ── Alertas ── */}
        {error && (
          <div className="mb-4 flex items-start gap-2 bg-red-900/20 border border-red-700/40 text-red-300 text-sm px-4 py-3 rounded-xl">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
            <button onClick={() => setError('')} className="ml-auto"><X className="w-4 h-4" /></button>
          </div>
        )}
        {exito && (
          <div className="mb-4 flex items-center gap-2 bg-green-900/20 border border-green-700/40 text-green-300 text-sm px-4 py-3 rounded-xl">
            <CheckCircle className="w-4 h-4" />
            <span>{exito}</span>
          </div>
        )}
        {hayPendientes && (
          <div className="mb-4 flex items-center gap-2 bg-yellow-900/20 border border-yellow-700/40 text-yellow-300 text-sm px-4 py-3 rounded-xl">
            <Info className="w-4 h-4" />
            <span>{reasignaciones.size} cambio{reasignaciones.size !== 1 ? 's' : ''} pendiente{reasignaciones.size !== 1 ? 's' : ''} sin guardar en Chess</span>
          </div>
        )}

        {/* ── Hint de selección ── */}
        {repartoSelec !== null && (
          <div className="mb-4 flex items-center gap-2 bg-primary-900/20 border border-primary-700/40 text-primary-300 text-sm px-4 py-3 rounded-xl">
            <ArrowRight className="w-4 h-4" />
            <span>
              Reparto seleccionado: <strong>{repartos.find(r => r.idreparto === repartoSelec)?.dstransp}</strong>.
              Hacé click en un pedido de la lista derecha para asignarlo.
            </span>
            <button onClick={() => setRepartoSelec(null)} className="ml-auto text-primary-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ── Layout principal: 2 columnas ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* ── Columna izquierda: camiones ── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-dark-300 uppercase tracking-wider">
                Transportes ({repartos.length})
              </h2>
              <p className="text-xs text-dark-500">Click para seleccionar destino</p>
            </div>

            {cargando && repartos.length === 0 ? (
              <div className="flex items-center justify-center py-16 text-dark-500">
                <Loader2 className="w-6 h-6 animate-spin mr-2" />
                Cargando distribución...
              </div>
            ) : (
              <div className="space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
                {repartos.map(r => (
                  <TarjetaCamion
                    key={r.idreparto}
                    reparto={r}
                    ptos={ptosEntrega}
                    seleccionado={repartoSelec === r.idreparto}
                    onClick={() => setRepartoSelec(prev => prev === r.idreparto ? null : r.idreparto)}
                    onQuitarPto={quitarPto}
                  />
                ))}
                {repartos.length === 0 && !cargando && (
                  <div className="text-center py-12 text-dark-500">
                    <Truck className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No hay transportes para esta fecha</p>
                    <p className="text-xs mt-1">Usá + Transporte para agregar uno</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Columna derecha: pedidos ── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-dark-300 uppercase tracking-wider">
                Pedidos ({ptosFiltrados.length})
              </h2>
            </div>

            {/* Buscador */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
              <input
                type="text"
                placeholder="Buscar por cliente, comprobante, localidad..."
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                className="w-full bg-dark-800 border border-dark-600 text-white text-sm rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:border-primary-500"
              />
            </div>

            <div className="space-y-1.5 max-h-[calc(100vh-320px)] overflow-y-auto pr-1">
              {ptosFiltrados.map(p => {
                const pendiente = reasignaciones.has(p.cpbte)
                const sinAsignar = !p.idreparto || p.idreparto === 0
                const asignable = repartoSelec !== null

                return (
                  <div
                    key={p.cpbte}
                    onClick={() => asignable && asignarPto(p)}
                    className={`rounded-lg border px-3 py-2.5 transition-all
                      ${asignable ? 'cursor-pointer' : 'cursor-default'}
                      ${pendiente
                        ? 'border-yellow-600/50 bg-yellow-900/10'
                        : sinAsignar
                        ? 'border-red-700/30 bg-red-900/10'
                        : 'border-dark-700 bg-dark-800'
                      }
                      ${asignable ? 'hover:border-primary-500/60 hover:bg-primary-900/10' : ''}
                    `}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-medium text-white truncate">{p.dscliente}</span>
                          {pendiente && (
                            <span className="text-xs bg-yellow-800/50 text-yellow-300 px-1.5 py-0.5 rounded">
                              pendiente
                            </span>
                          )}
                          {sinAsignar && (
                            <span className="text-xs bg-red-800/50 text-red-300 px-1.5 py-0.5 rounded">
                              sin asignar
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-dark-500 mt-0.5">{p.cpbte} · {p.calle} {p.altura}, {p.dslocalidad}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-dark-400">{fmtImporte(p.totval)}</p>
                        <p className="text-xs text-dark-500 mt-0.5 truncate max-w-[100px]">{p.dstransp}</p>
                      </div>
                    </div>
                  </div>
                )
              })}

              {ptosFiltrados.length === 0 && !cargando && (
                <div className="text-center py-12 text-dark-500">
                  <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No hay pedidos{busqueda ? ' que coincidan' : ' para esta fecha'}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Modal: agregar transporte ── */}
      {modalTransporte && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setModalTransporte(false)} />
          <div className="relative w-full max-w-lg bg-dark-800 rounded-2xl border border-dark-600 shadow-2xl flex flex-col max-h-[80vh]">

            <div className="flex items-center justify-between px-5 py-4 border-b border-dark-700">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <Plus className="w-4 h-4 text-primary-400" />
                Agregar transporte
              </h3>
              <button onClick={() => setModalTransporte(false)} className="text-dark-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-5 py-3 border-b border-dark-700">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
                <input
                  type="text"
                  placeholder="Buscar por nombre, chapa, modelo..."
                  value={busqTransporte}
                  onChange={e => setBusqTransporte(e.target.value)}
                  className="w-full bg-dark-700 border border-dark-600 text-white text-sm rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:border-primary-500"
                  autoFocus
                />
              </div>
            </div>

            <div className="overflow-y-auto flex-1 divide-y divide-dark-700/50">
              {transportesNuevos.length === 0 && (
                <p className="text-center text-dark-500 text-sm py-8">
                  {busqTransporte ? 'Sin resultados' : 'Todos los transportes ya están agregados'}
                </p>
              )}
              {transportesNuevos.map(t => (
                <div
                  key={t.id}
                  className="flex items-center justify-between px-5 py-3 hover:bg-dark-700/50 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-white">{t.id} — {t.nomcli}</p>
                    <p className="text-xs text-dark-500">{t.chapa} · {t.modelo} · {t.propio ? 'Propio' : 'Externo'}</p>
                  </div>
                  <button
                    onClick={() => agregarTransporte(t.id)}
                    disabled={agregandoTransp === t.id}
                    className="flex items-center gap-1.5 bg-primary-600 hover:bg-primary-500 disabled:opacity-50 text-white text-xs px-3 py-1.5 rounded-lg transition-colors"
                  >
                    {agregandoTransp === t.id
                      ? <Loader2 className="w-3 h-3 animate-spin" />
                      : <Plus className="w-3 h-3" />
                    }
                    Agregar
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
