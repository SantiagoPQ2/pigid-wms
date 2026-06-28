import { useState, useEffect } from 'react'
import Layout from '../../components/Layout'
import { supabase } from '../../lib/supabase'

interface StockItem {
  id: string
  articulo_id: string
  articulo_codigo: string
  articulo_nombre: string
  ubicacion_id: string
  ubicacion_codigo: string
  area_nombre: string
  cantidad: number
  lote: string
  fecha_vencimiento: string | null
  updated_at: string
}

interface Articulo { id: string; codigo: string; nombre: string }
interface Area { id: string; nombre: string }

export default function ConsultarStock() {
  const [stock, setStock] = useState<StockItem[]>([])
  const [articulos, setArticulos] = useState<Articulo[]>([])
  const [areas, setAreas] = useState<Area[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtroArea, setFiltroArea] = useState('')
  const [filtroArticulo, setFiltroArticulo] = useState('')
  const [soloConStock, setSoloConStock] = useState(true)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: st }, { data: ar }, { data: ar2 }] = await Promise.all([
      supabase.from('stock').select(`
        id, articulo_id, ubicacion_id, cantidad, lote, fecha_vencimiento, updated_at,
        articulos(codigo, nombre),
        ubicaciones(codigo, areas(nombre))
      `).order('updated_at', { ascending: false }),
      supabase.from('articulos').select('id, codigo, nombre').order('codigo'),
      supabase.from('areas').select('id, nombre').order('nombre')
    ])
    setStock((st || []).map((s: any) => ({
      ...s,
      articulo_codigo: s.articulos?.codigo || '',
      articulo_nombre: s.articulos?.nombre || '',
      ubicacion_codigo: s.ubicaciones?.codigo || '',
      area_nombre: s.ubicaciones?.areas?.nombre || ''
    })))
    setArticulos(ar || [])
    setAreas(ar2 || [])
    setLoading(false)
  }

  const filtrado = stock.filter(s => {
    if (soloConStock && s.cantidad <= 0) return false
    if (filtroArea && s.area_nombre !== areas.find(a => a.id === filtroArea)?.nombre) return false
    if (filtroArticulo && s.articulo_id !== filtroArticulo) return false
    if (busqueda) {
      const q = busqueda.toLowerCase()
      return s.articulo_codigo.toLowerCase().includes(q) ||
        s.articulo_nombre.toLowerCase().includes(q) ||
        s.ubicacion_codigo.toLowerCase().includes(q) ||
        (s.lote || '').toLowerCase().includes(q)
    }
    return true
  })

  // Totales por artículo
  const totalesPorArticulo = filtrado.reduce((acc, s) => {
    const key = s.articulo_id
    acc[key] = (acc[key] || 0) + s.cantidad
    return acc
  }, {} as Record<string, number>)

  const totalUnidades = filtrado.reduce((sum, s) => sum + s.cantidad, 0)
  const articulosUnicos = new Set(filtrado.map(s => s.articulo_id)).size
  const ubicacionesOcupadas = new Set(filtrado.filter(s => s.cantidad > 0).map(s => s.ubicacion_id)).size

  function vencimientoColor(fecha: string | null) {
    if (!fecha) return ''
    const dias = Math.ceil((new Date(fecha).getTime() - Date.now()) / 86400000)
    if (dias < 0) return 'text-red-400'
    if (dias <= 30) return 'text-yellow-400'
    return 'text-green-400'
  }

  function formatFecha(f: string | null) {
    if (!f) return '—'
    return new Date(f).toLocaleDateString('es-AR')
  }

  return (
    <Layout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Consultar Stock</h1>
            <p className="text-dark-400 text-sm mt-1">Posición actual del inventario</p>
          </div>
          <button onClick={fetchAll} className="btn-secondary px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
            <span>↻</span> Actualizar
          </button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="card rounded-xl p-4">
            <p className="text-dark-400 text-xs uppercase tracking-wider mb-1">Total Unidades</p>
            <p className="text-2xl font-bold text-white">{totalUnidades.toLocaleString('es-AR')}</p>
          </div>
          <div className="card rounded-xl p-4">
            <p className="text-dark-400 text-xs uppercase tracking-wider mb-1">Artículos</p>
            <p className="text-2xl font-bold text-white">{articulosUnicos}</p>
          </div>
          <div className="card rounded-xl p-4">
            <p className="text-dark-400 text-xs uppercase tracking-wider mb-1">Ubicaciones Ocupadas</p>
            <p className="text-2xl font-bold text-white">{ubicacionesOcupadas}</p>
          </div>
        </div>

        {/* Filtros */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
          <input
            type="text" placeholder="Buscar artículo, ubicación, lote..."
            value={busqueda} onChange={e => setBusqueda(e.target.value)}
            className="input-dark rounded-lg px-3 py-2 text-sm md:col-span-2"
          />
          <select value={filtroArticulo} onChange={e => setFiltroArticulo(e.target.value)} className="input-dark rounded-lg px-3 py-2 text-sm">
            <option value="">Todos los artículos</option>
            {articulos.map(a => <option key={a.id} value={a.id}>{a.codigo} - {a.nombre}</option>)}
          </select>
          <select value={filtroArea} onChange={e => setFiltroArea(e.target.value)} className="input-dark rounded-lg px-3 py-2 text-sm">
            <option value="">Todas las áreas</option>
            {areas.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-2 mb-4">
          <input type="checkbox" id="soloStock" checked={soloConStock} onChange={e => setSoloConStock(e.target.checked)} className="w-4 h-4 rounded" />
          <label htmlFor="soloStock" className="text-dark-300 text-sm">Solo mostrar con stock &gt; 0</label>
          <span className="ml-auto text-dark-400 text-sm">{filtrado.length} registros</span>
        </div>

        {/* Tabla */}
        {loading ? (
          <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-dark-500 border-t-primary-500 rounded-full animate-spin" /></div>
        ) : (
          <div className="card rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-700">
                  <th className="text-left px-4 py-3 text-dark-400 text-xs font-medium uppercase tracking-wider">Artículo</th>
                  <th className="text-left px-4 py-3 text-dark-400 text-xs font-medium uppercase tracking-wider">Descripción</th>
                  <th className="text-left px-4 py-3 text-dark-400 text-xs font-medium uppercase tracking-wider">Ubicación</th>
                  <th className="text-left px-4 py-3 text-dark-400 text-xs font-medium uppercase tracking-wider">Área</th>
                  <th className="text-left px-4 py-3 text-dark-400 text-xs font-medium uppercase tracking-wider">Lote</th>
                  <th className="text-left px-4 py-3 text-dark-400 text-xs font-medium uppercase tracking-wider">Vencimiento</th>
                  <th className="text-right px-4 py-3 text-dark-400 text-xs font-medium uppercase tracking-wider">Cantidad</th>
                </tr>
              </thead>
              <tbody>
                {filtrado.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-8 text-dark-400">No hay registros de stock</td></tr>
                ) : filtrado.map(s => (
                  <tr key={s.id} className="border-b border-dark-800 hover:bg-dark-800/50 transition-colors">
                    <td className="px-4 py-3 text-white font-mono font-semibold">{s.articulo_codigo}</td>
                    <td className="px-4 py-3 text-dark-300 max-w-xs truncate">{s.articulo_nombre}</td>
                    <td className="px-4 py-3 text-primary-400 font-mono">{s.ubicacion_codigo}</td>
                    <td className="px-4 py-3 text-dark-400 text-sm">{s.area_nombre}</td>
                    <td className="px-4 py-3 text-dark-300 font-mono text-sm">{s.lote || '—'}</td>
                    <td className={`px-4 py-3 text-sm font-mono ${vencimientoColor(s.fecha_vencimiento)}`}>{formatFecha(s.fecha_vencimiento)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-bold text-lg ${s.cantidad <= 0 ? 'text-dark-500' : s.cantidad <= 10 ? 'text-yellow-400' : 'text-white'}`}>
                        {s.cantidad.toLocaleString('es-AR')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              {filtrado.length > 0 && (
                <tfoot>
                  <tr className="border-t border-dark-600">
                    <td colSpan={6} className="px-4 py-3 text-dark-400 text-sm font-medium">Total</td>
                    <td className="px-4 py-3 text-right text-white font-bold">{totalUnidades.toLocaleString('es-AR')}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
    </Layout>
  )
}
