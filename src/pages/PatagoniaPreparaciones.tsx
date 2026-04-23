import { useState } from 'react'
import Layout from '../components/Layout'
import { Download, RefreshCw, Package, Truck, AlertCircle, ChevronDown, ChevronUp, GitCompare, X } from 'lucide-react'
import { supabase } from '../lib/supabase'

interface DetalleContenedor {
  ID: string
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

interface FilaComparacion {
  ID: string
  Transporte: string
  CodigoArticulo: string
  Descripcion: string
  BultosPlani: number
  BultosPat: number
  Diferencia: number
  Estado: 'ok' | 'falta_pat' | 'diferencia'
}

function exportarCSV(detalle: DetalleContenedor[], _pedidos: PedidoRow[], soloDetalle: DetalleContenedor[]) {
  const headers = 'ID;PreparacionId;PreparacionEstado;NumeroContenedor;CodigoArticulo;Articulo;Unidades;Lote;FechaVencimiento;PesoDeclarado;Fecha;IdReparto'
  const rows = soloDetalle.map(r =>
    [r.ID,r.PreparacionId,r.PreparacionEstado,r.NumeroContenedor,r.CodigoArticulo,
     r.Articulo,r.Unidades,r.Lote??'',r.FechaVencimiento??'',r.PesoDeclarado??'',r.Fecha??'',r.IdReparto??''].join(';')
  )
  const blob = new Blob(['\uFEFF'+headers+'\n'+rows.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url
  a.download = 'preparaciones_'+new Date().toISOString().split('T')[0]+'.csv'; a.click()
  URL.revokeObjectURL(url)
}

function exportarComparacionCSV(filas: FilaComparacion[], fecha: string) {
  const headers = 'ID;Transporte;CodigoArticulo;Descripcion;BultosPlani;BultosPat;Diferencia;Estado'
  const rows = filas.map(f => [f.ID,f.Transporte,f.CodigoArticulo,f.Descripcion,f.BultosPlani,f.BultosPat,f.Diferencia,f.Estado].join(';'))
  const blob = new Blob(['\uFEFF'+headers+'\n'+rows.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url
  a.download = 'comparacion_'+fecha.replace(/\//g,'-')+'.csv'; a.click()
  URL.revokeObjectURL(url)
}

function BadgeEstado({ estado }: { estado: string }) {
  const map: Record<string, string> = {
    'Completo': 'bg-green-500/20 text-green-400',
    'Completada': 'bg-green-500/20 text-green-400',
    'Pendiente': 'bg-yellow-500/20 text-yellow-400',
    'EnProceso': 'bg-blue-500/20 text-blue-400',
    'Cancelado': 'bg-red-500/20 text-red-400',
  }
  const cls = map[estado] ?? 'bg-dark-700 text-dark-300'
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{estado || '—'}</span>
}

function FiltroTexto({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative flex-1 max-w-sm">
      <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <input type="text" placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)}
        className="w-full bg-dark-800 border border-dark-600 hover:border-dark-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30 rounded-lg pl-9 pr-8 py-2 text-sm text-white placeholder-dark-500 outline-none transition-all" />
      {value && (
        <button onClick={() => onChange('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-white transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      )}
    </div>
  )
}

function FiltroSelect({ value, onChange, options, placeholder }: { value: string; onChange: (v: string) => void; options: string[]; placeholder: string }) {
  return (
    <div className="relative">
      <select value={value} onChange={e => onChange(e.target.value)}
        className="appearance-none bg-dark-800 border border-dark-600 hover:border-dark-500 focus:border-primary-500 rounded-lg pl-3 pr-8 py-2 text-sm text-white outline-none transition-all cursor-pointer">
        <option value="">{placeholder}</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      <svg className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  )
}

export default function PatagoniaPreparaciones() {
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const [stats, setStats] = useState<Stats | null>(null)
  const [detalle, setDetalle] = useState<DetalleContenedor[]>([])
  const [pedidos, setPedidos] = useState<PedidoRow[]>([])
  const [tab, setTab] = useState<'detalle' | 'pedidos'>('detalle')
  const [filtroTexto, setFiltroTexto] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroFecha, setFiltroFecha] = useState('')
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set())

  // Comparación
  const [mostrarComparacion, setMostrarComparacion] = useState(false)
  const [comparando, setComparando] = useState(false)
  const [planillasDisponibles, setPlanillasDisponibles] = useState<any[]>([])
  const [planillaSeleccionada, setPlanillaSeleccionada] = useState<any | null>(null)
  const [filasComparacion, setFilasComparacion] = useState<FilaComparacion[]>([])
  const [filtroComp, setFiltroComp] = useState<'todos' | 'falta_pat' | 'diferencia' | 'ok'>('diferencia')

  const SUPA_URL = import.meta.env.VITE_SUPABASE_URL
  const SUPA_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

  const fetchData = async () => {
    setCargando(true); setError(''); setStats(null); setDetalle([]); setPedidos([])
    setFiltroTexto(''); setFiltroEstado(''); setFiltroFecha('')
    try {
      const res = await fetch(SUPA_URL + '/functions/v1/patagonia-preparaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + SUPA_KEY, 'apikey': SUPA_KEY },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error ?? 'Error desconocido')
      setStats(data.stats)
      const detalleConId: DetalleContenedor[] = (data.detalle ?? []).map((r: any) => ({
        ...r,
        ID: (r.IdReparto ?? '') + String(r.CodigoArticulo ?? ''),
      }))
      setDetalle(detalleConId)
      setPedidos(data.pedidos ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setCargando(false)
    }
  }

  const opcionesEstado = [...new Set(detalle.map(r => r.PreparacionEstado).filter(Boolean))].sort()
  const opcionesFecha  = [...new Set(detalle.map(r => r.Fecha).filter(Boolean))].sort().reverse() as string[]

  const detalleAgrupado = detalle.reduce<Record<string, DetalleContenedor[]>>((acc, row) => {
    const id = String(row.PreparacionId ?? 'Sin ID')
    if (!acc[id]) acc[id] = []
    acc[id].push(row)
    return acc
  }, {})

  const prepIds = Object.keys(detalleAgrupado)

  const prepFiltradas = prepIds.filter(id => {
    const rows = detalleAgrupado[id]
    const primera = rows[0]
    if (filtroEstado && primera.PreparacionEstado !== filtroEstado) return false
    if (filtroFecha && primera.Fecha !== filtroFecha) return false
    if (filtroTexto) {
      const txt = filtroTexto.toLowerCase()
      return rows.some(r =>
        String(r.CodigoArticulo).includes(txt) || r.Articulo?.toLowerCase().includes(txt) ||
        id.toLowerCase().includes(txt) || r.IdReparto?.toLowerCase().includes(txt) ||
        r.NumeroContenedor?.toLowerCase().includes(txt) || r.ID?.toLowerCase().includes(txt)
      )
    }
    return true
  })

  const detalleFiltrado = prepFiltradas.flatMap(id => detalleAgrupado[id])

  const pedidosFiltrados = pedidos.filter(p => {
    if (!filtroTexto) return true
    const txt = filtroTexto.toLowerCase()
    return String(p.CodigoPedido).toLowerCase().includes(txt) ||
      String(p.CodigoClienteUbicacion).toLowerCase().includes(txt) ||
      p.IdReparto?.toLowerCase().includes(txt)
  })

  const toggleExpand = (id: string) => {
    setExpandidos(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const hayFiltros = filtroEstado || filtroFecha || filtroTexto

  const abrirComparacion = async () => {
    setMostrarComparacion(true)
    setPlanillaSeleccionada(null)
    setFilasComparacion([])
    const { data } = await supabase.from('planillas_carga').select('id, fecha, fecha_str, archivo_nombre').order('fecha', { ascending: false }).limit(30)
    if (data) setPlanillasDisponibles(data)
  }

  const compararConPlanilla = async (planilla: any) => {
    setPlanillaSeleccionada(planilla)
    setComparando(true)

    const { data } = await supabase.from('planillas_carga').select('resumen').eq('id', planilla.id).single()
    if (!data) { setComparando(false); return }
    const planillaItems: any[] = data.resumen

    // Filtrar Patagonia: SOLO Completada con la misma fecha
    const fechaPlanilla = planilla.fecha
    const patFiltrado = detalle.filter(row =>
      (row.PreparacionEstado === 'Completada' || row.PreparacionEstado === 'Completo') &&
      row.Fecha === fechaPlanilla
    )

    // Mapa Patagonia Completada: ID → Unidades
    const mapaPat = new Map<string, number>()
    for (const row of patFiltrado) {
      const key = (row.IdReparto ?? '') + String(row.CodigoArticulo ?? '')
      mapaPat.set(key, (mapaPat.get(key) ?? 0) + (row.Unidades || 0))
    }

    // Set de repartos con prep Completada — extraído desde IdReparto de Patagonia
    const repartosCompletados = new Set(patFiltrado.map(row => String(row.IdReparto ?? '')))

    // Mapa planilla: ID → item — filtrado por repartos que SÍ tienen Completada
    // El nroReparto viene del campo Transporte: "26 - FIORINO 261" → "26"
    const mapaPlani = new Map<string, any>()
    for (const item of planillaItems) {
      const nroReparto = String(item.Transporte ?? '').match(/^(\d+)/)?.[1] ?? ''
      if (repartosCompletados.has(nroReparto)) mapaPlani.set(item.ID, item)
    }

    const resultado: FilaComparacion[] = []

    // 1. Iterar sobre planilla filtrada (solo repartos con prep Completada)
    for (const [id, item] of mapaPlani) {
      const bPlani = item.Bultos ?? 0
      const bPat   = mapaPat.get(id) ?? 0
      const diff   = bPlani - bPat
      resultado.push({
        ID: id, Transporte: item.Transporte,
        CodigoArticulo: item.CodigoArticulo, Descripcion: item.Descripcion,
        BultosPlani: bPlani, BultosPat: bPat, Diferencia: diff,
        Estado: diff !== 0 ? 'diferencia' : 'ok',
      })
    }

    // 2. Patagonia completó algo que no estaba en planilla → falta_pat
    for (const [id, unidades] of mapaPat) {
      if (!mapaPlani.has(id)) {
        const row = patFiltrado.find(r => (r.IdReparto ?? '') + String(r.CodigoArticulo ?? '') === id)
        resultado.push({
          ID: id, Transporte: row?.IdReparto || '',
          CodigoArticulo: String(row?.CodigoArticulo || ''), Descripcion: row?.Articulo || '',
          BultosPlani: 0, BultosPat: unidades, Diferencia: -unidades, Estado: 'falta_pat',
        })
      }
    }

    resultado.sort((a, b) => {
      const orden: Record<string, number> = { diferencia: 0, falta_pat: 1, ok: 2 }
      return (orden[a.Estado] ?? 3) - (orden[b.Estado] ?? 3) || a.Transporte.localeCompare(b.Transporte)
    })

    setFilasComparacion(resultado)
    setComparando(false)
  }

  return (
    <Layout>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white">Patagonia WMS — Preparaciones</h1>
          <div className="flex gap-2">
            {detalle.length > 0 && (
              <button onClick={abrirComparacion}
                className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                <GitCompare className="w-4 h-4" />Comparación
              </button>
            )}
            {detalle.length > 0 && (
              <button onClick={() => exportarCSV(detalle, pedidos, detalleFiltrado)}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                <Download className="w-4 h-4" />
                Exportar CSV{hayFiltros ? ' (filtrado)' : ''}
              </button>
            )}
            <button onClick={fetchData} disabled={cargando}
              className="flex items-center gap-2 btn-primary px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50">
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
              <p className="text-red-400 font-semibold text-sm">Error</p>
              <p className="text-red-300 text-sm mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Loading */}
        {cargando && (
          <div className="card rounded-xl p-8 text-center">
            <RefreshCw className="w-8 h-8 text-primary-400 animate-spin mx-auto mb-3" />
            <p className="text-white font-medium">Consultando Patagonia WMS...</p>
          </div>
        )}

        {/* Stats */}
        {stats && !cargando && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="card rounded-xl p-4"><p className="text-2xl font-bold text-white">{stats.pedidos_totales}</p><p className="text-dark-400 text-sm">Pedidos totales</p></div>
            <div className="card rounded-xl p-4"><p className="text-2xl font-bold text-primary-400">{stats.preparaciones_unicas}</p><p className="text-dark-400 text-sm">Preparaciones</p></div>
            <div className="card rounded-xl p-4"><p className="text-2xl font-bold text-green-400">{stats.filas_detalle}</p><p className="text-dark-400 text-sm">Filas de detalle</p></div>
            <div className="card rounded-xl p-4"><p className="text-2xl font-bold text-yellow-400">{prepFiltradas.length}</p><p className="text-dark-400 text-sm">Mostrando</p></div>
          </div>
        )}

        {/* Contenido */}
        {(detalle.length > 0 || pedidos.length > 0) && !cargando && (
          <>
            {/* Tabs + filtros */}
            <div className="flex flex-wrap items-center gap-3 mb-3">
              <div className="flex gap-1 bg-dark-800 rounded-lg p-1">
                <button onClick={() => setTab('detalle')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab==='detalle'?'bg-primary-600 text-white':'text-dark-400 hover:text-white'}`}>
                  <Package className="w-3.5 h-3.5 inline mr-1.5" />Detalle ({detalle.length})
                </button>
                <button onClick={() => setTab('pedidos')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab==='pedidos'?'bg-primary-600 text-white':'text-dark-400 hover:text-white'}`}>
                  <Truck className="w-3.5 h-3.5 inline mr-1.5" />Pedidos ({pedidos.length})
                </button>
              </div>
              {tab === 'detalle' && (
                <>
                  <FiltroSelect value={filtroEstado} onChange={setFiltroEstado} options={opcionesEstado} placeholder="Estado" />
                  <FiltroSelect value={filtroFecha} onChange={setFiltroFecha} options={opcionesFecha} placeholder="Fecha" />
                </>
              )}
              <FiltroTexto value={filtroTexto} onChange={setFiltroTexto} placeholder="Buscar artículo, preparación, reparto..." />
              {hayFiltros && (
                <button onClick={() => { setFiltroTexto(''); setFiltroEstado(''); setFiltroFecha('') }}
                  className="text-xs text-dark-400 hover:text-white transition-colors whitespace-nowrap">
                  Limpiar filtros
                </button>
              )}
            </div>

            {/* Tab Detalle */}
            {tab === 'detalle' && (
              <div className="space-y-2">
                <div className="flex justify-end gap-2 mb-2">
                  <button onClick={() => setExpandidos(new Set(prepFiltradas))} className="text-xs text-dark-400 hover:text-white transition-colors">Expandir todo</button>
                  <span className="text-dark-600">·</span>
                  <button onClick={() => setExpandidos(new Set())} className="text-xs text-dark-400 hover:text-white transition-colors">Colapsar todo</button>
                </div>
                {prepFiltradas.length === 0 && (
                  <div className="card rounded-xl p-6 text-center text-dark-400">Sin resultados para los filtros aplicados</div>
                )}
                {prepFiltradas.map(prepId => {
                  const rows = detalleAgrupado[prepId]
                  const primera = rows[0]
                  const expanded = expandidos.has(prepId)
                  const totalUnidades = rows.reduce((s,r) => s + (r.Unidades||0), 0)
                  return (
                    <div key={prepId} className="card rounded-xl overflow-hidden">
                      <button onClick={() => toggleExpand(prepId)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-dark-700/50 transition-colors">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="text-white font-semibold font-mono text-sm">#{prepId}</span>
                          <BadgeEstado estado={primera.PreparacionEstado} />
                          {primera.IdReparto && <span className="text-xs text-blue-400 font-mono">Reparto: {primera.IdReparto}</span>}
                          {primera.Fecha && <span className="text-xs text-dark-400">{primera.Fecha}</span>}
                          <span className="text-xs text-dark-500">{rows.length} artículo{rows.length!==1?'s':''} · {totalUnidades} unidades</span>
                        </div>
                        {expanded ? <ChevronUp className="w-4 h-4 text-dark-500" /> : <ChevronDown className="w-4 h-4 text-dark-500" />}
                      </button>
                      {expanded && (
                        <div className="border-t border-dark-700 overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-dark-700">
                                <th className="text-left px-4 py-2 text-dark-400 text-xs uppercase">ID</th>
                                <th className="text-left px-4 py-2 text-dark-400 text-xs uppercase">Contenedor</th>
                                <th className="text-left px-4 py-2 text-dark-400 text-xs uppercase">Código</th>
                                <th className="text-left px-4 py-2 text-dark-400 text-xs uppercase">Artículo</th>
                                <th className="text-right px-4 py-2 text-dark-400 text-xs uppercase">Unidades</th>
                                <th className="text-left px-4 py-2 text-dark-400 text-xs uppercase">Lote</th>
                                <th className="text-left px-4 py-2 text-dark-400 text-xs uppercase">Vencimiento</th>
                                <th className="text-right px-4 py-2 text-dark-400 text-xs uppercase">Peso</th>
                              </tr>
                            </thead>
                            <tbody>
                              {rows.map((r,i) => (
                                <tr key={i} className="border-b border-dark-800 hover:bg-dark-800/40">
                                  <td className="px-4 py-2 text-dark-300 font-mono text-xs">{r.ID||'—'}</td>
                                  <td className="px-4 py-2 text-dark-300 font-mono text-xs">{r.NumeroContenedor||'—'}</td>
                                  <td className="px-4 py-2 text-primary-400 font-mono font-semibold">{r.CodigoArticulo}</td>
                                  <td className="px-4 py-2 text-white">{r.Articulo||'—'}</td>
                                  <td className="px-4 py-2 text-right text-white font-semibold">{r.Unidades}</td>
                                  <td className="px-4 py-2 text-dark-300 font-mono text-xs">{r.Lote||'—'}</td>
                                  <td className="px-4 py-2 text-dark-300 text-xs">{r.FechaVencimiento||'—'}</td>
                                  <td className="px-4 py-2 text-right text-dark-300 text-xs">{r.PesoDeclarado!=null?r.PesoDeclarado:'—'}</td>
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
                        <th className="text-left px-4 py-3 text-dark-400 text-xs uppercase">Código</th>
                        <th className="text-left px-4 py-3 text-dark-400 text-xs uppercase">Cliente/Ubic.</th>
                        <th className="text-left px-4 py-3 text-dark-400 text-xs uppercase">Estado</th>
                        <th className="text-left px-4 py-3 text-dark-400 text-xs uppercase">Fecha</th>
                        <th className="text-left px-4 py-3 text-dark-400 text-xs uppercase">Entrega</th>
                        <th className="text-right px-4 py-3 text-dark-400 text-xs uppercase">Importe</th>
                        <th className="text-left px-4 py-3 text-dark-400 text-xs uppercase">Despacho</th>
                        <th className="text-left px-4 py-3 text-dark-400 text-xs uppercase">Reparto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pedidosFiltrados.length===0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-dark-500">Sin resultados</td></tr>}
                      {pedidosFiltrados.map((p,i) => (
                        <tr key={i} className="border-b border-dark-800 hover:bg-dark-800/40">
                          <td className="px-4 py-2.5 text-primary-400 font-mono font-semibold">{p.CodigoPedido}</td>
                          <td className="px-4 py-2.5 text-dark-300 text-xs">{p.CodigoClienteUbicacion||'—'}</td>
                          <td className="px-4 py-2.5"><BadgeEstado estado={p.PedidoEstado} /></td>
                          <td className="px-4 py-2.5 text-dark-300 text-xs">{p.Fecha||'—'}</td>
                          <td className="px-4 py-2.5 text-dark-300 text-xs">{p.FechaEstimadaEntrega||'—'}</td>
                          <td className="px-4 py-2.5 text-right text-white font-mono text-xs">{p.Importe!=null?'$'+Number(p.Importe).toLocaleString():'—'}</td>
                          <td className="px-4 py-2.5 text-dark-300 text-xs font-mono">{p.CodigoDespacho||'—'}</td>
                          <td className="px-4 py-2.5 text-blue-400 text-xs font-mono">{p.IdReparto||'—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* Estado vacío */}
        {!cargando && !error && detalle.length===0 && pedidos.length===0 && (
          <div className="card rounded-xl p-12 text-center">
            <Package className="w-12 h-12 text-dark-600 mx-auto mb-4" />
            <p className="text-white font-semibold text-lg mb-2">Sin datos</p>
            <p className="text-dark-400 text-sm mb-6">Hacé click en "Traer datos" para consultar la API de Patagonia WMS</p>
            <button onClick={fetchData} className="btn-primary px-6 py-2.5 rounded-lg font-semibold">Traer datos ahora</button>
          </div>
        )}

        {/* Modal comparación */}
        {mostrarComparacion && (
          <div className="fixed inset-0 z-[200] bg-black/70 flex items-start justify-center pt-10 px-4">
            <div className="bg-dark-900 border border-dark-700 rounded-2xl w-full max-w-5xl max-h-[85vh] flex flex-col">
              <div className="flex items-center justify-between px-6 py-4 border-b border-dark-700">
                <div className="flex items-center gap-3">
                  <GitCompare className="w-5 h-5 text-purple-400" />
                  <h2 className="text-white font-bold text-lg">Comparación Planilla vs Patagonia</h2>
                </div>
                <button onClick={() => { setMostrarComparacion(false); setFilasComparacion([]); setPlanillaSeleccionada(null) }}
                  className="text-dark-400 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
              </div>

              {/* Selección de planilla */}
              {!planillaSeleccionada && (
                <div className="p-6 overflow-y-auto">
                  <p className="text-dark-400 text-sm mb-4">Seleccioná una planilla guardada para comparar con Patagonia (solo Completada de esa fecha):</p>
                  {planillasDisponibles.length===0 && <div className="text-center text-dark-500 py-8">No hay planillas guardadas.</div>}
                  <div className="space-y-2">
                    {planillasDisponibles.map(p => (
                      <button key={p.id} onClick={() => compararConPlanilla(p)}
                        className="w-full flex items-center justify-between px-4 py-3 bg-dark-800 hover:bg-dark-700 rounded-xl transition-colors text-left">
                        <div>
                          <p className="text-white font-semibold">{p.fecha_str}</p>
                          <p className="text-dark-400 text-xs">{p.archivo_nombre||'Sin nombre'}</p>
                        </div>
                        <span className="text-primary-400 text-sm">Comparar →</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Comparando */}
              {planillaSeleccionada && comparando && (
                <div className="flex-1 flex items-center justify-center p-8">
                  <div className="text-center">
                    <RefreshCw className="w-8 h-8 text-purple-400 animate-spin mx-auto mb-3" />
                    <p className="text-white font-medium">Comparando planilla {planillaSeleccionada.fecha_str} con Patagonia...</p>
                    <p className="text-dark-400 text-sm mt-1">Filtrando solo preparaciones Completada de esa fecha</p>
                  </div>
                </div>
              )}

              {/* Resultados */}
              {planillaSeleccionada && !comparando && filasComparacion.length > 0 && (
                <>
                  <div className="px-6 py-3 border-b border-dark-700 flex items-center gap-4 flex-wrap">
                    <span className="text-dark-400 text-sm">Planilla: <strong className="text-white">{planillaSeleccionada.fecha_str}</strong></span>
                    <span className="text-dark-400 text-xs">Patagonia filtrada: <strong className="text-white">Completada · {planillaSeleccionada.fecha_str}</strong></span>

                    <span className="bg-red-500/20 text-red-400 px-2 py-0.5 rounded text-xs font-medium">
                      {filasComparacion.filter(f => f.Estado==='diferencia').length} con diferencia
                    </span>
                    <span className="bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded text-xs font-medium">
                      {filasComparacion.filter(f => f.Estado==='falta_pat').length} falta en planilla
                    </span>
                    <span className="bg-green-500/20 text-green-400 px-2 py-0.5 rounded text-xs font-medium">
                      {filasComparacion.filter(f => f.Estado==='ok').length} coinciden
                    </span>
                    <div className="ml-auto flex gap-2">
                      <div className="flex gap-1 bg-dark-800 rounded-lg p-1">
                        {(['todos','diferencia','falta_pat','ok'] as const).map(f => (
                          <button key={f} onClick={() => setFiltroComp(f)}
                            className={'px-2 py-1 rounded text-xs font-medium transition-colors '+(filtroComp===f?'bg-purple-600 text-white':'text-dark-400 hover:text-white')}>
                            {f==='todos'?'Todos':f==='diferencia'?'Diferencia':f==='falta_pat'?'Falta Pat.':'Coinciden'}
                          </button>
                        ))}
                      </div>
                      <button onClick={() => exportarComparacionCSV(filasComparacion, planillaSeleccionada.fecha_str)}
                        className="flex items-center gap-1.5 bg-green-600 hover:bg-green-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">
                        <Download className="w-3.5 h-3.5" />CSV
                      </button>
                    </div>
                  </div>
                  <div className="overflow-auto flex-1">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-dark-900">
                        <tr className="border-b border-dark-700">
                          <th className="text-left px-4 py-2 text-dark-400 text-xs uppercase">ID</th>
                          <th className="text-left px-4 py-2 text-dark-400 text-xs uppercase">Transporte</th>
                          <th className="text-left px-4 py-2 text-dark-400 text-xs uppercase">Código</th>
                          <th className="text-left px-4 py-2 text-dark-400 text-xs uppercase">Descripción</th>
                          <th className="text-right px-4 py-2 text-dark-400 text-xs uppercase">Planilla</th>
                          <th className="text-right px-4 py-2 text-dark-400 text-xs uppercase">Patagonia</th>
                          <th className="text-right px-4 py-2 text-dark-400 text-xs uppercase">Dif.</th>
                          <th className="text-center px-4 py-2 text-dark-400 text-xs uppercase">Estado</th>
                          <th className="text-center px-4 py-2 text-dark-400 text-xs uppercase">Acción</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filasComparacion
                          .filter(f => filtroComp==='todos' || f.Estado===filtroComp)
                          .map((f, i) => {
                            const rowCls = f.Estado==='diferencia' ? 'bg-red-500/5 border-red-500/10' : f.Estado==='falta_pat' ? 'bg-orange-500/5 border-orange-500/10' : 'border-dark-800'
                            return (
                              <tr key={i} className={'border-b '+rowCls}>
                                <td className="px-4 py-2 text-dark-300 font-mono text-xs">{f.ID}</td>
                                <td className="px-4 py-2 text-blue-400 text-xs">{f.Transporte}</td>
                                <td className="px-4 py-2 text-primary-400 font-mono font-semibold">{f.CodigoArticulo}</td>
                                <td className="px-4 py-2 text-white text-xs max-w-xs truncate">{f.Descripcion}</td>
                                <td className="px-4 py-2 text-right font-semibold text-white">{f.BultosPlani}</td>
                                <td className="px-4 py-2 text-right font-semibold text-white">{f.BultosPat || <span className="text-dark-500">0</span>}</td>
                                <td className={'px-4 py-2 text-right font-bold '+(f.Diferencia>0?'text-red-400':f.Diferencia<0?'text-blue-400':'text-green-400')}>
                                  {f.Diferencia>0?'+':''}{f.Diferencia}
                                </td>
                                <td className="px-4 py-2 text-center">
                                  {f.Estado==='ok' && <span className="bg-green-500/20 text-green-400 px-2 py-0.5 rounded text-xs">OK</span>}
                                  {f.Estado==='diferencia' && <span className="bg-red-500/20 text-red-400 px-2 py-0.5 rounded text-xs">Diferencia</span>}
                                  {f.Estado==='falta_pat' && <span className="bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded text-xs">Falta Pat.</span>}
                                </td>
                                <td className="px-4 py-2 text-center">
                                  {f.Diferencia > 0 && <span className="bg-green-500/20 text-green-400 px-2 py-0.5 rounded text-xs font-medium">Agregar</span>}
                                  {f.Diferencia < 0 && <span className="bg-red-500/20 text-red-400 px-2 py-0.5 rounded text-xs font-medium">Quitar</span>}
                                  {f.Diferencia === 0 && <span className="text-dark-600 text-xs">—</span>}
                                </td>
                              </tr>
                            )
                          })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
