import { useState, useEffect } from 'react'
import Layout from '../../components/Layout'
import { Search, RefreshCw, AlertCircle, ChevronDown, ChevronUp, Download } from 'lucide-react'

const API_KEY = '45124045-32f8-4a32-b201-e252d7aa06aa'
const BASE_URL = 'http://api.patagoniawms.com'
const HEADERS = { 'X-API-KEY': API_KEY, 'Accept': 'application/json' }
const ESTADOS = ['sinControl','pendienteControl','enProcesoControl','controlado','verificado','guardado']

interface CCDetalle {
  Contenedor: string; CodigoArticulo: string; Lote: string; Descripcion: string
  CantidadEsperada: number; CantidadContada: number; Diferencia: number; FechaVencimiento: string | null
}
interface CCItem {
  Id: number; Fecha: string; Estado: string; Ubicacion: string; Modo: string
  ControlCiegoDetalle: CCDetalle[]; DocumentoRecepcion: any[]
}

function toISO(d: Date) {
  return d.toISOString().split('T')[0]
}

function BadgeEstado({ estado }: { estado: string }) {
  const map: Record<string, string> = {
    sinControl: 'bg-dark-700 text-dark-400',
    pendienteControl: 'bg-yellow-500/20 text-yellow-400',
    enProcesoControl: 'bg-blue-500/20 text-blue-400',
    controlado: 'bg-green-500/20 text-green-400',
    verificado: 'bg-primary-500/20 text-primary-400',
    guardado: 'bg-green-700/20 text-green-300',
  }
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${map[estado] ?? 'bg-dark-700 text-dark-400'}`}>{estado}</span>
}

function exportarCSV(items: CCItem[]) {
  const rows = ['Id;Fecha;Estado;Ubicacion;Modo;Contenedor;CodigoArticulo;Descripcion;Lote;CantEsperada;CantContada;Diferencia;FechaVencimiento']
  for (const item of items)
    for (const d of (item.ControlCiegoDetalle || []))
      rows.push([
        item.Id, item.Fecha?.split('T')[0] ?? '', item.Estado, item.Ubicacion ?? '', item.Modo ?? '',
        d.Contenedor ?? '', d.CodigoArticulo ?? '', d.Descripcion ?? '', d.Lote ?? '',
        d.CantidadEsperada ?? '', d.CantidadContada ?? '', d.Diferencia ?? '', d.FechaVencimiento?.split('T')[0] ?? ''
      ].join(';'))
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

  // Consultar automáticamente al montar
  useEffect(() => { consultar() }, [])

  const consultar = async () => {
    setCargando(true); setError(''); setItems([])

    // Calcular últimos 2 días: hoy y ayer
    const hoy = new Date()
    const ayer = new Date(hoy); ayer.setDate(ayer.getDate() - 1)
    const fechaHoy = toISO(hoy)
    const fechaAyer = toISO(ayer)
    setFechaRango(fechaAyer + ' → ' + fechaHoy)

    try {
      // Consultar ambos días en paralelo
      const fetchDia = async (fecha: string) => {
        const params = new URLSearchParams()
        params.set('Fecha', fecha)
        if (filtros.DocumentoNumero) params.set('DocumentoNumero', filtros.DocumentoNumero)
        if (filtros.CodigoProveedor) params.set('CodigoProveedor', filtros.CodigoProveedor)
        if (filtros.Estado)          params.set('Estado', filtros.Estado)
        if (filtros.OrdenCompra)     params.set('OrdenCompra', filtros.OrdenCompra)
        const res = await fetch(`${BASE_URL}/v1/ControlCiego/List?${params}`, { headers: HEADERS })
        if (!res.ok) return []
        const data = await res.json()
        return Array.isArray(data) ? data : (data.data || data.items || [])
      }

      const [itemsHoy, itemsAyer] = await Promise.all([fetchDia(fechaHoy), fetchDia(fechaAyer)])
      const todos: CCItem[] = [...itemsHoy, ...itemsAyer]

      // Deduplicar por Id
      const vistos = new Set<number>()
      const deduplicados = todos.filter(i => { if (vistos.has(i.Id)) return false; vistos.add(i.Id); return true })

      // Ordenar por fecha desc
      deduplicados.sort((a, b) => b.Fecha?.localeCompare(a.Fecha ?? '') ?? 0)

      setItems(deduplicados)
      if (!deduplicados.length) setError('No se encontraron controles ciegos en los últimos 2 días.')
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
      <div className="p-6 max-w-6xl mx-auto">
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
                className="w-full bg-dark-800 border border-dark-600 focus:border-primary-500 rounded-lg px-3 py-2 text-sm text-white outline-none transition-all" />
            </div>
            <div>
              <label className="text-dark-500 text-xs mb-1 block">Código Proveedor</label>
              <input type="text" value={filtros.CodigoProveedor} onChange={e => setF('CodigoProveedor', e.target.value)}
                placeholder="Código"
                className="w-full bg-dark-800 border border-dark-600 focus:border-primary-500 rounded-lg px-3 py-2 text-sm text-white outline-none transition-all" />
            </div>
            <div>
              <label className="text-dark-500 text-xs mb-1 block">Estado</label>
              <div className="relative">
                <select value={filtros.Estado} onChange={e => setF('Estado', e.target.value)}
                  className="w-full appearance-none bg-dark-800 border border-dark-600 focus:border-primary-500 rounded-lg pl-3 pr-8 py-2 text-sm text-white outline-none transition-all">
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
                className="w-full bg-dark-800 border border-dark-600 focus:border-primary-500 rounded-lg px-3 py-2 text-sm text-white outline-none transition-all" />
            </div>
          </div>
        </div>

        {/* Loading */}
        {cargando && (
          <div className="card rounded-xl p-8 text-center">
            <RefreshCw className="w-8 h-8 text-primary-400 animate-spin mx-auto mb-3" />
            <p className="text-white font-medium">Consultando controles ciegos...</p>
          </div>
        )}

        {/* Error */}
        {error && !cargando && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-4 flex gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

        {/* Stats */}
        {items.length > 0 && !cargando && (
          <div className="flex items-center gap-4 mb-3">
            <span className="text-dark-400 text-sm">{items.length} control{items.length !== 1 ? 'es' : ''} encontrado{items.length !== 1 ? 's' : ''}</span>
            <button onClick={() => setExpandidos(new Set(items.map(i => i.Id)))} className="text-xs text-dark-400 hover:text-white transition-colors">Expandir todo</button>
            <span className="text-dark-600">·</span>
            <button onClick={() => setExpandidos(new Set())} className="text-xs text-dark-400 hover:text-white transition-colors">Colapsar todo</button>
          </div>
        )}

        {/* Resultados */}
        {!cargando && (
          <div className="space-y-2">
            {items.map(item => {
              const expanded = expandidos.has(item.Id)
              const detalle = item.ControlCiegoDetalle || []
              const docs = item.DocumentoRecepcion || []
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
                      <span className="text-xs text-dark-500">{detalle.length} artículo{detalle.length !== 1 ? 's' : ''}</span>
                      {docs.length > 0 && <span className="text-xs text-primary-400">{docs.length} doc. recepción</span>}
                    </div>
                    {expanded ? <ChevronUp className="w-4 h-4 text-dark-500" /> : <ChevronDown className="w-4 h-4 text-dark-500" />}
                  </button>
                  {expanded && detalle.length > 0 && (
                    <div className="border-t border-dark-700 overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-dark-700 bg-dark-800/50">
                            <th className="text-left px-4 py-2 text-dark-400 text-xs uppercase">Contenedor</th>
                            <th className="text-left px-4 py-2 text-dark-400 text-xs uppercase">Código</th>
                            <th className="text-left px-4 py-2 text-dark-400 text-xs uppercase">Descripción</th>
                            <th className="text-left px-4 py-2 text-dark-400 text-xs uppercase">Lote</th>
                            <th className="text-right px-4 py-2 text-dark-400 text-xs uppercase">Esperada</th>
                            <th className="text-right px-4 py-2 text-dark-400 text-xs uppercase">Contada</th>
                            <th className="text-right px-4 py-2 text-dark-400 text-xs uppercase">Diferencia</th>
                            <th className="text-left px-4 py-2 text-dark-400 text-xs uppercase">Vencimiento</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detalle.map((d, i) => (
                            <tr key={i} className={`border-b border-dark-800 hover:bg-dark-800/40 ${d.Diferencia !== 0 ? 'bg-yellow-500/5' : ''}`}>
                              <td className="px-4 py-2 text-dark-300 font-mono text-xs">{d.Contenedor || '—'}</td>
                              <td className="px-4 py-2 text-primary-400 font-mono font-semibold">{d.CodigoArticulo}</td>
                              <td className="px-4 py-2 text-white text-xs">{d.Descripcion || '—'}</td>
                              <td className="px-4 py-2 text-dark-300 font-mono text-xs">{d.Lote || '—'}</td>
                              <td className="px-4 py-2 text-right text-white font-semibold">{d.CantidadEsperada ?? '—'}</td>
                              <td className="px-4 py-2 text-right text-white font-semibold">{d.CantidadContada ?? '—'}</td>
                              <td className={`px-4 py-2 text-right font-bold ${d.Diferencia > 0 ? 'text-green-400' : d.Diferencia < 0 ? 'text-red-400' : 'text-dark-500'}`}>
                                {d.Diferencia > 0 ? '+' : ''}{d.Diferencia ?? '—'}
                              </td>
                              <td className="px-4 py-2 text-dark-300 text-xs">{d.FechaVencimiento?.split('T')[0] || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {expanded && detalle.length === 0 && (
                    <div className="border-t border-dark-700 px-4 py-3 text-dark-500 text-sm">Sin detalle disponible</div>
                  )}
                  {expanded && docs.length > 0 && (
                    <div className="border-t border-dark-700 px-4 py-2 bg-dark-800/20">
                      <p className="text-dark-400 text-xs mb-1">Documentos de recepción:</p>
                      <div className="flex flex-wrap gap-2">
                        {docs.map((doc: any, i: number) => (
                          <span key={i} className="bg-primary-500/10 text-primary-400 px-2 py-0.5 rounded text-xs font-mono">
                            {doc.Numero || doc.Id || String(doc)}
                          </span>
                        ))}
                      </div>
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
