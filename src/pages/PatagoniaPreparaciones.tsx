import { useState } from 'react'
import Layout from '../components/Layout'
import { Download, RefreshCw, Package, Truck, AlertCircle, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react'

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface DetalleContenedor {
  PreparacionId: string
  PreparacionEstado: string
  NumeroContenedor: string
  CodigoArticulo: number | string
  Articulo: string
  Unidades: number
  Lote: string | null
  FechaVencimiento: string | null
  PesoDeclarado: number | null
  Fecha: string | null
  IdReparto: string | null
}

interface PedidoRow {
  CodigoPedido: string
  CodigoClienteUbicacion: string
  PedidoEstado: string
  Fecha: string | null
  FechaEstimadaEntrega: string | null
  Observacion: string | null
  Importe: number | null
  CodigoDespacho: string | null
  CodigoDeEnvio: string | null
  ServicioDeEnvioTipo: string | null
  IdReparto: string | null
}

interface Stats {
  pedidos_totales: number
  codigos_unicos: number
  preparaciones_unicas: number
  filas_detalle: number
}

// ─── Helper: exportar a Excel (XLSX nativo sin librería) ──────────────────────
function exportarExcel(detalle: DetalleContenedor[], pedidos: PedidoRow[]) {
  // Generar CSV con separador punto y coma y descargarlo como .csv
  // (Excel lo abre directamente con doble click en Windows)
  const headers = [
    'PreparacionId','PreparacionEstado','NumeroContenedor','CodigoArticulo',
    'Articulo','Unidades','Lote','FechaVencimiento','PesoDeclarado','Fecha','IdReparto'
  ]
  const rows = detalle.map(r => [
    r.PreparacionId, r.PreparacionEstado, r.NumeroContenedor, r.CodigoArticulo,
    r.Articulo, r.Unidades, r.Lote ?? '', r.FechaVencimiento ?? '',
    r.PesoDeclarado ?? '', r.Fecha ?? '', r.IdReparto ?? ''
  ].join(';'))

  const csv = [headers.join(';'), ...rows].join('\n')
  const bom = '\uFEFF' // BOM para que Excel detecte UTF-8
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `preparaciones_${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Badge de estado ───────────────────────────────────────────────────────────
function BadgeEstado({ estado }: { estado: string }) {
  const map: Record<string, string> = {
    'Completo': 'bg-green-500/20 text-green-400',
    'Pendiente': 'bg-yellow-500/20 text-yellow-400',
    'EnProceso': 'bg-blue-500/20 text-blue-400',
    'Cancelado': 'bg-red-500/20 text-red-400',
  }
  const cls = map[estado] ?? 'bg-dark-700 text-dark-300'
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{estado || '—'}</span>
}

// ─── Componente principal ──────────────────────────────────────────────────────
export default function PatagoniaPreparaciones() {
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const [stats, setStats] = useState<Stats | null>(null)
  const [detalle, setDetalle] = useState<DetalleContenedor[]>([])
  const [pedidos, setPedidos] = useState<PedidoRow[]>([])
  const [tab, setTab] = useState<'detalle' | 'pedidos'>('detalle')
  const [filtro, setFiltro] = useState('')
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set())

  const SUPA_URL = import.meta.env.VITE_SUPABASE_URL
  const SUPA_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

  const fetchData = async () => {
    setCargando(true); setError(''); setStats(null); setDetalle([]); setPedidos([])
    try {
      const res = await fetch(`${SUPA_URL}/functions/v1/patagonia-preparaciones`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPA_KEY}`,
          'apikey': SUPA_KEY,
        },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error ?? 'Error desconocido')
      setStats(data.stats)
      setDetalle(data.detalle ?? [])
      setPedidos(data.pedidos ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setCargando(false)
    }
  }

  // Agrupar detalle por PreparacionId para mostrar colapsable
  const detalleAgrupado = detalle.reduce<Record<string, DetalleContenedor[]>>((acc, row) => {
    const id = String(row.PreparacionId ?? 'Sin ID')
    if (!acc[id]) acc[id] = []
    acc[id].push(row)
    return acc
  }, {})

  const prepIds = Object.keys(detalleAgrupado)
  const prepFiltradas = prepIds.filter(id => {
    if (!filtro) return true
    const rows = detalleAgrupado[id]
    const txt = filtro.toLowerCase()
    return rows.some(r =>
      String(r.CodigoArticulo).includes(txt) ||
      r.Articulo?.toLowerCase().includes(txt) ||
      id.toLowerCase().includes(txt) ||
      r.IdReparto?.toLowerCase().includes(txt) ||
      r.NumeroContenedor?.toLowerCase().includes(txt)
    )
  })

  const pedidosFiltrados = pedidos.filter(p => {
    if (!filtro) return true
    const txt = filtro.toLowerCase()
    return (
      String(p.CodigoPedido).toLowerCase().includes(txt) ||
      String(p.CodigoClienteUbicacion).toLowerCase().includes(txt) ||
      p.IdReparto?.toLowerCase().includes(txt)
    )
  })

  const toggleExpand = (id: string) => {
    setExpandidos(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const expandirTodos = () => setExpandidos(new Set(prepFiltradas))
  const colapsar = () => setExpandidos(new Set())

  return (
    <Layout>
      <div className="p-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Patagonia WMS — Preparaciones</h1>
            <p className="text-dark-400 text-sm mt-1">Pedidos y detalle de contenedores desde la API de Patagonia</p>
          </div>
          <div className="flex gap-2">
            {detalle.length > 0 && (
              <button
                onClick={() => exportarExcel(detalle, pedidos)}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <Download className="w-4 h-4" />
                Exportar CSV
              </button>
            )}
            <button
              onClick={fetchData}
              disabled={cargando}
              className="flex items-center gap-2 btn-primary px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${cargando ? 'animate-spin' : ''}`} />
              {cargando ? 'Consultando API...' : 'Traer datos'}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-4 flex gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-400 font-semibold text-sm">Error al consultar la API</p>
              <p className="text-red-300 text-sm mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Loading */}
        {cargando && (
          <div className="card rounded-xl p-8 text-center">
            <RefreshCw className="w-8 h-8 text-primary-400 animate-spin mx-auto mb-3" />
            <p className="text-white font-medium">Consultando Patagonia WMS...</p>
            <p className="text-dark-400 text-sm mt-1">Esto puede tardar unos segundos (trae preparaciones en paralelo)</p>
          </div>
        )}

        {/* Stats */}
        {stats && !cargando && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="card rounded-xl p-4">
              <p className="text-2xl font-bold text-white">{stats.pedidos_totales}</p>
              <p className="text-dark-400 text-sm">Pedidos totales</p>
            </div>
            <div className="card rounded-xl p-4">
              <p className="text-2xl font-bold text-primary-400">{stats.preparaciones_unicas}</p>
              <p className="text-dark-400 text-sm">Preparaciones</p>
            </div>
            <div className="card rounded-xl p-4">
              <p className="text-2xl font-bold text-green-400">{stats.filas_detalle}</p>
              <p className="text-dark-400 text-sm">Filas de detalle</p>
            </div>
            <div className="card rounded-xl p-4">
              <p className="text-2xl font-bold text-yellow-400">{prepFiltradas.length}</p>
              <p className="text-dark-400 text-sm">Mostrando</p>
            </div>
          </div>
        )}

        {/* Contenido principal */}
        {(detalle.length > 0 || pedidos.length > 0) && !cargando && (
          <>
            {/* Tabs + filtro */}
            <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
              <div className="flex gap-1 bg-dark-800 rounded-lg p-1">
                <button onClick={() => setTab('detalle')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab==='detalle' ? 'bg-primary-600 text-white' : 'text-dark-400 hover:text-white'}`}>
                  <Package className="w-3.5 h-3.5 inline mr-1.5" />
                  Detalle ({detalle.length})
                </button>
                <button onClick={() => setTab('pedidos')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab==='pedidos' ? 'bg-primary-600 text-white' : 'text-dark-400 hover:text-white'}`}>
                  <Truck className="w-3.5 h-3.5 inline mr-1.5" />
                  Pedidos ({pedidos.length})
                </button>
              </div>
              <div className="flex items-center gap-2 flex-1 max-w-sm">
                <input
                  type="text"
                  placeholder="Filtrar por artículo, preparación, reparto..."
                  value={filtro}
                  onChange={e => setFiltro(e.target.value)}
                  className="input-field flex-1 text-sm"
                />
              </div>
            </div>

            {/* Tab Detalle — agrupado por preparación */}
            {tab === 'detalle' && (
              <div className="space-y-2">
                <div className="flex justify-end gap-2 mb-2">
                  <button onClick={expandirTodos} className="text-xs text-dark-400 hover:text-white transition-colors">Expandir todo</button>
                  <span className="text-dark-600">·</span>
                  <button onClick={colapsar} className="text-xs text-dark-400 hover:text-white transition-colors">Colapsar todo</button>
                </div>
                {prepFiltradas.length === 0 && (
                  <div className="card rounded-xl p-6 text-center text-dark-400">No hay resultados para "{filtro}"</div>
                )}
                {prepFiltradas.map(prepId => {
                  const rows = detalleAgrupado[prepId]
                  const primera = rows[0]
                  const expanded = expandidos.has(prepId)
                  const totalUnidades = rows.reduce((s, r) => s + (r.Unidades || 0), 0)
                  return (
                    <div key={prepId} className="card rounded-xl overflow-hidden">
                      {/* Header de preparación */}
                      <button
                        onClick={() => toggleExpand(prepId)}
                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-dark-700/50 transition-colors"
                      >
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="text-white font-semibold font-mono text-sm">#{prepId}</span>
                          <BadgeEstado estado={primera.PreparacionEstado} />
                          {primera.IdReparto && (
                            <span className="text-xs text-blue-400 font-mono">Reparto: {primera.IdReparto}</span>
                          )}
                          {primera.Fecha && (
                            <span className="text-xs text-dark-400">{primera.Fecha}</span>
                          )}
                          <span className="text-xs text-dark-500">{rows.length} artículo{rows.length !== 1 ? 's' : ''} · {totalUnidades} unidades</span>
                        </div>
                        {expanded ? <ChevronUp className="w-4 h-4 text-dark-500" /> : <ChevronDown className="w-4 h-4 text-dark-500" />}
                      </button>

                      {/* Detalle expandido */}
                      {expanded && (
                        <div className="border-t border-dark-700 overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-dark-700">
                                <th className="text-left px-4 py-2 text-dark-400 font-medium text-xs uppercase">Contenedor</th>
                                <th className="text-left px-4 py-2 text-dark-400 font-medium text-xs uppercase">Código</th>
                                <th className="text-left px-4 py-2 text-dark-400 font-medium text-xs uppercase">Artículo</th>
                                <th className="text-right px-4 py-2 text-dark-400 font-medium text-xs uppercase">Unidades</th>
                                <th className="text-left px-4 py-2 text-dark-400 font-medium text-xs uppercase">Lote</th>
                                <th className="text-left px-4 py-2 text-dark-400 font-medium text-xs uppercase">Vencimiento</th>
                                <th className="text-right px-4 py-2 text-dark-400 font-medium text-xs uppercase">Peso</th>
                              </tr>
                            </thead>
                            <tbody>
                              {rows.map((r, i) => (
                                <tr key={i} className="border-b border-dark-800 hover:bg-dark-800/40">
                                  <td className="px-4 py-2 text-dark-300 font-mono text-xs">{r.NumeroContenedor || '—'}</td>
                                  <td className="px-4 py-2 text-primary-400 font-mono font-semibold">{r.CodigoArticulo}</td>
                                  <td className="px-4 py-2 text-white">{r.Articulo || '—'}</td>
                                  <td className="px-4 py-2 text-right text-white font-semibold">{r.Unidades}</td>
                                  <td className="px-4 py-2 text-dark-300 font-mono text-xs">{r.Lote || '—'}</td>
                                  <td className="px-4 py-2 text-dark-300 text-xs">{r.FechaVencimiento || '—'}</td>
                                  <td className="px-4 py-2 text-right text-dark-300 text-xs">{r.PesoDeclarado != null ? r.PesoDeclarado : '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Tab Pedidos */}
            {tab === 'pedidos' && (
              <div className="card rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-dark-700">
                        <th className="text-left px-4 py-3 text-dark-400 font-medium text-xs uppercase">Código</th>
                        <th className="text-left px-4 py-3 text-dark-400 font-medium text-xs uppercase">Cliente/Ubic.</th>
                        <th className="text-left px-4 py-3 text-dark-400 font-medium text-xs uppercase">Estado</th>
                        <th className="text-left px-4 py-3 text-dark-400 font-medium text-xs uppercase">Fecha</th>
                        <th className="text-left px-4 py-3 text-dark-400 font-medium text-xs uppercase">Entrega</th>
                        <th className="text-right px-4 py-3 text-dark-400 font-medium text-xs uppercase">Importe</th>
                        <th className="text-left px-4 py-3 text-dark-400 font-medium text-xs uppercase">Despacho</th>
                        <th className="text-left px-4 py-3 text-dark-400 font-medium text-xs uppercase">Reparto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pedidosFiltrados.length === 0 && (
                        <tr><td colSpan={8} className="px-4 py-8 text-center text-dark-500">No hay resultados</td></tr>
                      )}
                      {pedidosFiltrados.map((p, i) => (
                        <tr key={i} className="border-b border-dark-800 hover:bg-dark-800/40">
                          <td className="px-4 py-2.5 text-primary-400 font-mono font-semibold">{p.CodigoPedido}</td>
                          <td className="px-4 py-2.5 text-dark-300 text-xs">{p.CodigoClienteUbicacion || '—'}</td>
                          <td className="px-4 py-2.5"><BadgeEstado estado={p.PedidoEstado} /></td>
                          <td className="px-4 py-2.5 text-dark-300 text-xs">{p.Fecha || '—'}</td>
                          <td className="px-4 py-2.5 text-dark-300 text-xs">{p.FechaEstimadaEntrega || '—'}</td>
                          <td className="px-4 py-2.5 text-right text-white font-mono text-xs">{p.Importe != null ? '$'+Number(p.Importe).toLocaleString() : '—'}</td>
                          <td className="px-4 py-2.5 text-dark-300 text-xs font-mono">{p.CodigoDespacho || '—'}</td>
                          <td className="px-4 py-2.5 text-blue-400 text-xs font-mono">{p.IdReparto || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* Estado vacío inicial */}
        {!cargando && !error && detalle.length === 0 && pedidos.length === 0 && (
          <div className="card rounded-xl p-12 text-center">
            <Package className="w-12 h-12 text-dark-600 mx-auto mb-4" />
            <p className="text-white font-semibold text-lg mb-2">Sin datos</p>
            <p className="text-dark-400 text-sm mb-6">Hacé click en "Traer datos" para consultar la API de Patagonia WMS</p>
            <button onClick={fetchData} className="btn-primary px-6 py-2.5 rounded-lg font-semibold">
              Traer datos ahora
            </button>
          </div>
        )}

      </div>
    </Layout>
  )
}
