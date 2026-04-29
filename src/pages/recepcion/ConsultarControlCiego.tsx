import { useState } from 'react'
import Layout from '../../components/Layout'
import { Search, RefreshCw, AlertCircle, ChevronDown, ChevronUp, Download } from 'lucide-react'

const ESTADOS = ['sinControl','pendienteControl','enProcesoControl','controlado','verificado','guardado']

interface CCDetalleItem {
  Contenedor: string
  CodigoArticulo: string
  Articulo: string
  Lote: string | null
  FechaVencimiento: string | null
  Unidades: number
  // Del detalle completo via /v1/ControlCiego
  CantidadEsperada?: number
  CantidadContada?: number
  Diferencia?: number
  Descripcion?: string
  LoteRecibido?: string
  FechaVencimientoRecibido?: string | null
  CantidadBultosInformado?: number
  CantidadBultosRecibido?: number
}

interface DocRecepcion {
  Id: number
  Numero: string
  Fecha: string
  Proveedor: string
  OrdenCompra: string | null
  DocumentoRecepcionDetalle: {
    CodigoArticulo: string; Lote: string | null; FechaVencimiento: string | null
    Unidades: number; Linea: number
  }[]
}

interface CCItem {
  Id: number; Fecha: string; Estado: string; Ubicacion: string; Modo: string
  ControlCiegoDetalle: CCDetalleItem[]
  DocumentoRecepcion: DocRecepcion[]
}

function toISO(d: Date) { return d.toISOString().split('T')[0] }

function BadgeEstado({ estado }: { estado: string }) {
  const map: Record<string, string> = {
    sinControl: 'bg-dark-700 text-dark-400',
    pendienteControl: 'bg-yellow-500/20 text-yellow-400',
    enProcesoControl: 'bg-blue-500/20 text-blue-400',
    controlado: 'bg-green-500/20 text-green-400',
    verificado: 'bg-primary-500/20 text-primary-400',
    guardado: 'bg-green-700/20 text-green-300',
    Guardado: 'bg-green-700/20 text-green-300',
  }
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${map[estado] ?? 'bg-dark-700 text-dark-400'}`}>{estado}</span>
}

function exportarCSV(items: CCItem[]) {
  const rows = ['Id;Fecha;Estado;Ubicacion;Modo;Contenedor;Codigo;Articulo;LoteInformado;LoteRecibido;VencInformado;VencRecibido;CantInformada;BultosInformados;CantRecibida;BultosRecibidos;DifCantidad;Diferencia']
  for (const item of items) {
    // Construir mapa de datos informados desde DocumentoRecepcion
    const mapaInformado = new Map<string, any>()
    for (const doc of (item.DocumentoRecepcion || [])) {
      for (const det of (doc.DocumentoRecepcionDetalle || [])) {
        mapaInformado.set(det.CodigoArticulo, det)
      }
    }
    for (const d of (item.ControlCiegoDetalle || [])) {
      const inf = mapaInformado.get(d.CodigoArticulo)
      rows.push([
        item.Id, item.Fecha?.split('T')[0] ?? '', item.Estado, item.Ubicacion ?? '', item.Modo ?? '',
        d.Contenedor ?? '', d.CodigoArticulo, d.Articulo ?? d.Descripcion ?? '',
        inf?.Lote ?? '', d.Lote ?? '',
        inf?.FechaVencimiento?.split('T')[0] ?? '', d.FechaVencimiento?.split('T')[0] ?? '',
        inf?.Unidades ?? '', '',
        d.Unidades ?? '', '',
        '', ''
      ].join(';'))
    }
  }
  const blob = new Blob(['\uFEFF' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = 'control_ciego.csv'; a.click()
  URL.revokeObjectURL(url)
}

export default function ConsultarControlCiego() {
  const [filtros, setFiltros] = useState({ DocumentoNumero: '', CodigoProveedor: '', Estado: '', OrdenCompra: '' })
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const [items, setItems] = useState<CCItem[]>([])
  const [expandidos, setExpandidos] = useState<Set<number>>(new Set())
  const [fechaRango, setFechaRango] = useState('')

  const SUPA_URL = import.meta.env.VITE_SUPABASE_URL
  const SUPA_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY


  const consultar = async () => {
    setCargando(true); setError(''); setItems([])
    const hoy = new Date()
    const ayer = new Date(hoy); ayer.setDate(ayer.getDate() - 1)
    setFechaRango(toISO(ayer) + ' → ' + toISO(hoy))
    try {
      const res = await fetch(SUPA_URL + '/functions/v1/control-ciego', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + SUPA_KEY, 'apikey': SUPA_KEY },
        body: JSON.stringify({
          fechas: [toISO(hoy), toISO(ayer)],
          ...(filtros.DocumentoNumero && { DocumentoNumero: filtros.DocumentoNumero }),
          ...(filtros.CodigoProveedor && { CodigoProveedor: filtros.CodigoProveedor }),
          ...(filtros.Estado          && { Estado: filtros.Estado }),
          ...(filtros.OrdenCompra     && { OrdenCompra: filtros.OrdenCompra }),
        })
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error ?? 'Error desconocido')
      setItems(data.items ?? [])
      if (!data.items?.length) setError('No se encontraron controles ciegos en los últimos 2 días.')
    } catch (e) {
      setError('Error al consultar: ' + String(e))
    } finally {
      setCargando(false)
    }
  }

  const toggle = (id: number) => setExpandidos(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n
  })
  const setF = (k: string, v: string) => setFiltros(f => ({ ...f, [k]: v }))

  return (
    <Layout>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Control Ciego — Últimos 2 días</h1>
            {fechaRango && <p className="text-dark-400 text-sm mt-1">{fechaRango}</p>}
          </div>
          <div className="flex gap-2">
            {items.length > 0 && (
              <button onClick={() => exportarCSV(items)}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                <Download className="w-4 h-4" />Exportar CSV
              </button>
            )}
            <button onClick={consultar} disabled={cargando}
              className="flex items-center gap-2 btn-primary px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50">
              {cargando ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              {cargando ? 'Consultando...' : 'Consultar'}
            </button>
          </div>
        </div>

        {/* Filtros opcionales */}
        <div className="card rounded-xl p-4 mb-5">
          <p className="text-dark-400 text-xs uppercase font-medium mb-3">Filtros opcionales</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="text-dark-500 text-xs mb-1 block">Nro. Documento</label>
              <input type="text" value={filtros.DocumentoNumero} onChange={e => setF('DocumentoNumero', e.target.value)}
                placeholder="Ej: 00001234"
                className="w-full bg-dark-800 border border-dark-600 focus:border-primary-500 rounded-lg px-3 py-2 text-sm text-white outline-none" />
            </div>
            <div>
              <label className="text-dark-500 text-xs mb-1 block">Código Proveedor</label>
              <input type="text" value={filtros.CodigoProveedor} onChange={e => setF('CodigoProveedor', e.target.value)}
                placeholder="Código"
                className="w-full bg-dark-800 border border-dark-600 focus:border-primary-500 rounded-lg px-3 py-2 text-sm text-white outline-none" />
            </div>
            <div>
              <label className="text-dark-500 text-xs mb-1 block">Estado</label>
              <div className="relative">
                <select value={filtros.Estado} onChange={e => setF('Estado', e.target.value)}
                  className="w-full appearance-none bg-dark-800 border border-dark-600 focus:border-primary-500 rounded-lg pl-3 pr-8 py-2 text-sm text-white outline-none">
                  <option value="">Todos</option>
                  {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
                <svg className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
            <div>
              <label className="text-dark-500 text-xs mb-1 block">Orden de Compra</label>
              <input type="text" value={filtros.OrdenCompra} onChange={e => setF('OrdenCompra', e.target.value)}
                placeholder="Número de OC"
                className="w-full bg-dark-800 border border-dark-600 focus:border-primary-500 rounded-lg px-3 py-2 text-sm text-white outline-none" />
            </div>
          </div>
        </div>

        {cargando && (
          <div className="card rounded-xl p-8 text-center">
            <RefreshCw className="w-8 h-8 text-primary-400 animate-spin mx-auto mb-3" />
            <p className="text-white font-medium">Consultando controles ciegos...</p>
          </div>
        )}

        {error && !cargando && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-4 flex gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

        {items.length > 0 && !cargando && (
          <div className="flex items-center gap-4 mb-3">
            <span className="text-dark-400 text-sm">{items.length} control{items.length !== 1 ? 'es' : ''}</span>
            <button onClick={() => setExpandidos(new Set(items.map(i => i.Id)))} className="text-xs text-dark-400 hover:text-white transition-colors">Expandir todo</button>
            <span className="text-dark-600">·</span>
            <button onClick={() => setExpandidos(new Set())} className="text-xs text-dark-400 hover:text-white transition-colors">Colapsar todo</button>
          </div>
        )}

        {!cargando && items.length === 0 && !error && (
          <div className="card rounded-xl p-16 text-center">
            <svg className="w-14 h-14 mx-auto mb-4 text-dark-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-white font-semibold text-lg mb-2">Consultá los controles ciegos</p>
            <p className="text-dark-400 text-sm">Hacé click en "Consultar" para traer los últimos 2 días</p>
          </div>
        )}

        {!cargando && items.length > 0 && (
          <div className="space-y-2">
            {items.map(item => {
              const expanded = expandidos.has(item.Id)
              const detalle = item.ControlCiegoDetalle || []
              const docs = item.DocumentoRecepcion || []
              // Construir mapa de datos INFORMADOS desde DocumentoRecepcion
              const mapaInf = new Map<string, any>()
              for (const doc of docs) {
                for (const d of (doc.DocumentoRecepcionDetalle || [])) {
                  if (!mapaInf.has(d.CodigoArticulo)) mapaInf.set(d.CodigoArticulo, {...d, Unidades: 0})
                  mapaInf.get(d.CodigoArticulo).Unidades += (d.Unidades || 0)
                }
              }
              // Agrupar detalle RECIBIDO por CodigoArticulo (sumar todos los contenedores)
              const mapaRec = new Map<string, any>()
              for (const d of detalle) {
                if (!mapaRec.has(d.CodigoArticulo)) {
                  mapaRec.set(d.CodigoArticulo, { ...d, Unidades: 0, Contenedores: [] as string[] })
                }
                const entry = mapaRec.get(d.CodigoArticulo)
                entry.Unidades += (d.Unidades || 0)
                if (d.Contenedor) entry.Contenedores.push(d.Contenedor)
              }
              const totalArticulos = mapaRec.size
              return (
                <div key={item.Id} className="card rounded-xl overflow-hidden">
                  <button onClick={() => toggle(item.Id)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-dark-700/50 transition-colors">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-white font-semibold font-mono text-sm">#{item.Id}</span>
                      <BadgeEstado estado={item.Estado} />
                      <span className="text-dark-400 text-xs">{item.Fecha?.split('T')[0] ?? '—'}</span>
                      {item.Ubicacion && <span className="text-xs text-blue-400">{item.Ubicacion}</span>}
                      {item.Modo && <span className="text-xs text-dark-500 capitalize">{item.Modo}</span>}
                      <span className="text-xs text-dark-500">{totalArticulos} artículo{totalArticulos !== 1 ? 's' : ''} · {detalle.length} contenedor{detalle.length !== 1 ? 'es' : ''}</span>
                      {docs.length > 0 && <span className="text-xs text-primary-400">{docs.map(d => d.Numero).join(', ')}</span>}
                    </div>
                    {expanded ? <ChevronUp className="w-4 h-4 text-dark-500" /> : <ChevronDown className="w-4 h-4 text-dark-500" />}
                  </button>
                  {expanded && (
                    <div className="border-t border-dark-700 overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-dark-700 bg-dark-800/60">
                            <th className="text-left px-4 py-3 text-dark-400 text-xs font-semibold uppercase tracking-wider">Código</th>
                            <th className="text-left px-4 py-3 text-dark-400 text-xs font-semibold uppercase tracking-wider">Artículo</th>
                            <th className="text-left px-4 py-3 text-dark-400 text-xs font-semibold uppercase tracking-wider">Lote Inf.</th>
                            <th className="text-left px-4 py-3 text-dark-400 text-xs font-semibold uppercase tracking-wider">Lote Rec.</th>
                            <th className="text-left px-4 py-3 text-dark-400 text-xs font-semibold uppercase tracking-wider">Venc. Inf.</th>
                            <th className="text-left px-4 py-3 text-dark-400 text-xs font-semibold uppercase tracking-wider">Venc. Rec.</th>
                            <th className="text-right px-4 py-3 text-dark-400 text-xs font-semibold uppercase tracking-wider">Cant. Inf.</th>
                            <th className="text-right px-4 py-3 text-dark-400 text-xs font-semibold uppercase tracking-wider">Cant. Rec.</th>
                            <th className="text-right px-4 py-3 text-dark-400 text-xs font-semibold uppercase tracking-wider">Diferencia</th>
                            <th className="text-center px-4 py-3 text-dark-400 text-xs font-semibold uppercase tracking-wider">Contenedores</th>
                          </tr>
                        </thead>
                        <tbody>
                          {mapaRec.size === 0 && (
                            <tr><td colSpan={10} className="px-3 py-4 text-center text-dark-500">Sin detalle</td></tr>
                          )}
                          {Array.from(mapaRec.values()).map((d, i) => {
                            const inf = mapaInf.get(d.CodigoArticulo)
                            const cantInf = inf?.Unidades ?? null
                            const cantRec = d.Unidades ?? null
                            const dif = cantInf != null && cantRec != null ? cantRec - cantInf : null
                            return (
                              <tr key={i} className={`border-b border-dark-800 hover:bg-dark-800/40 transition-colors ${dif !== null && dif !== 0 ? 'bg-red-500/5' : ''}`}>
                                <td className="px-4 py-3 text-primary-400 font-mono font-semibold text-sm">{d.CodigoArticulo}</td>
                                <td className="px-4 py-3 text-white font-medium">{d.Articulo || d.Descripcion || '—'}</td>
                                <td className="px-4 py-3 text-dark-400 font-mono text-xs">{inf?.Lote || <span className="text-dark-600">—</span>}</td>
                                <td className="px-4 py-3 text-dark-400 font-mono text-xs">{d.Lote || <span className="text-dark-600">—</span>}</td>
                                <td className="px-4 py-3 text-dark-400 text-xs">{inf?.FechaVencimiento?.split('T')[0] || <span className="text-dark-600">—</span>}</td>
                                <td className="px-4 py-3 text-dark-400 text-xs">{d.FechaVencimiento?.split('T')[0] || <span className="text-dark-600">—</span>}</td>
                                <td className="px-4 py-3 text-right text-white font-bold">{cantInf?.toLocaleString() ?? <span className="text-dark-500">—</span>}</td>
                                <td className="px-4 py-3 text-right text-white font-bold">{cantRec?.toLocaleString() ?? <span className="text-dark-500">—</span>}</td>
                                <td className="px-4 py-3 text-right">
                                  {dif === null ? <span className="text-dark-600">—</span>
                                    : dif === 0 ? <span className="bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-0.5 rounded-full text-xs font-medium">✓ Satisfactorio</span>
                                    : <span className={`font-bold text-sm ${dif > 0 ? 'text-green-400' : 'text-red-400'}`}>{dif > 0 ? '+' : ''}{dif.toLocaleString()}</span>
                                  }
                                </td>
                                <td className="px-4 py-3 text-center text-dark-400 text-xs">{d.Contenedores?.length ?? '—'}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Layout>
  )
}
