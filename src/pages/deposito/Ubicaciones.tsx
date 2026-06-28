import { useState, useEffect } from 'react'
import Layout from '../../components/Layout'
import { supabase } from '../../lib/supabase'

interface Ubicacion {
  id: string
  codigo: string
  descripcion: string
  area_id: string
  area_nombre?: string
  tipo_ubicacion: string
  capacidad_max: number
  ocupacion_actual: number
  activo: boolean
  created_at: string
}

interface Area {
  id: string
  nombre: string
}

const TIPOS = ['Picking', 'Reserva', 'Recepción', 'Despacho', 'Devolución', 'Cuarentena']

export default function Ubicaciones() {
  const [ubicaciones, setUbicaciones] = useState<Ubicacion[]>([])
  const [areas, setAreas] = useState<Area[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editando, setEditando] = useState<Ubicacion | null>(null)
  const [filtroArea, setFiltroArea] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroBusqueda, setFiltroBusqueda] = useState('')
  const [form, setForm] = useState({
    codigo: '', descripcion: '', area_id: '', tipo_ubicacion: 'Picking',
    capacidad_max: 100, activo: true
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const [{ data: ub }, { data: ar }] = await Promise.all([
      supabase.from('ubicaciones').select('*, areas(nombre)').order('codigo'),
      supabase.from('areas').select('id, nombre').order('nombre')
    ])
    setUbicaciones((ub || []).map((u: any) => ({ ...u, area_nombre: u.areas?.nombre })))
    setAreas(ar || [])
    setLoading(false)
  }

  function abrirNuevo() {
    setEditando(null)
    setForm({ codigo: '', descripcion: '', area_id: areas[0]?.id || '', tipo_ubicacion: 'Picking', capacidad_max: 100, activo: true })
    setError('')
    setShowModal(true)
  }

  function abrirEditar(u: Ubicacion) {
    setEditando(u)
    setForm({ codigo: u.codigo, descripcion: u.descripcion, area_id: u.area_id, tipo_ubicacion: u.tipo_ubicacion, capacidad_max: u.capacidad_max, activo: u.activo })
    setError('')
    setShowModal(true)
  }

  async function guardar() {
    if (!form.codigo.trim() || !form.area_id) { setError('Código y área son obligatorios'); return }
    setSaving(true)
    setError('')
    try {
      if (editando) {
        const { error: e } = await supabase.from('ubicaciones').update({ ...form, codigo: form.codigo.toUpperCase() }).eq('id', editando.id)
        if (e) throw e
      } else {
        const { error: e } = await supabase.from('ubicaciones').insert({ ...form, codigo: form.codigo.toUpperCase(), ocupacion_actual: 0 })
        if (e) throw e
      }
      setShowModal(false)
      fetchData()
    } catch (e: any) {
      setError(e.message || 'Error al guardar')
    } finally { setSaving(false) }
  }

  async function toggleActivo(u: Ubicacion) {
    await supabase.from('ubicaciones').update({ activo: !u.activo }).eq('id', u.id)
    fetchData()
  }

  const filtradas = ubicaciones.filter(u => {
    const matchArea = !filtroArea || u.area_id === filtroArea
    const matchTipo = !filtroTipo || u.tipo_ubicacion === filtroTipo
    const matchBusq = !filtroBusqueda || u.codigo.toLowerCase().includes(filtroBusqueda.toLowerCase()) || u.descripcion?.toLowerCase().includes(filtroBusqueda.toLowerCase())
    return matchArea && matchTipo && matchBusq
  })

  function pctColor(pct: number) {
    if (pct >= 90) return 'bg-red-500'
    if (pct >= 70) return 'bg-yellow-500'
    return 'bg-green-500'
  }

  return (
    <Layout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Ubicaciones</h1>
            <p className="text-dark-400 text-sm mt-1">{filtradas.length} ubicaciones</p>
          </div>
          <button onClick={abrirNuevo} className="btn-primary px-4 py-2 rounded-lg text-sm font-medium">
            + Nueva Ubicación
          </button>
        </div>

        {/* Filtros */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
          <input
            type="text" placeholder="Buscar código o descripción..."
            value={filtroBusqueda} onChange={e => setFiltroBusqueda(e.target.value)}
            className="input-dark rounded-lg px-3 py-2 text-sm"
          />
          <select value={filtroArea} onChange={e => setFiltroArea(e.target.value)} className="input-dark rounded-lg px-3 py-2 text-sm">
            <option value="">Todas las áreas</option>
            {areas.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
          </select>
          <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} className="input-dark rounded-lg px-3 py-2 text-sm">
            <option value="">Todos los tipos</option>
            {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        {/* Tabla */}
        {loading ? (
          <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-dark-500 border-t-primary-500 rounded-full animate-spin" /></div>
        ) : (
          <div className="card rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-700">
                  <th className="text-left px-4 py-3 text-dark-400 text-xs font-medium uppercase tracking-wider">Código</th>
                  <th className="text-left px-4 py-3 text-dark-400 text-xs font-medium uppercase tracking-wider">Descripción</th>
                  <th className="text-left px-4 py-3 text-dark-400 text-xs font-medium uppercase tracking-wider">Área</th>
                  <th className="text-left px-4 py-3 text-dark-400 text-xs font-medium uppercase tracking-wider">Tipo</th>
                  <th className="text-left px-4 py-3 text-dark-400 text-xs font-medium uppercase tracking-wider">Ocupación</th>
                  <th className="text-left px-4 py-3 text-dark-400 text-xs font-medium uppercase tracking-wider">Estado</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtradas.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-8 text-dark-400">No hay ubicaciones</td></tr>
                ) : filtradas.map(u => {
                  const pct = u.capacidad_max > 0 ? Math.round((u.ocupacion_actual / u.capacidad_max) * 100) : 0
                  return (
                    <tr key={u.id} className="border-b border-dark-800 hover:bg-dark-800/50 transition-colors">
                      <td className="px-4 py-3 text-white font-mono font-semibold">{u.codigo}</td>
                      <td className="px-4 py-3 text-dark-300">{u.descripcion || '—'}</td>
                      <td className="px-4 py-3 text-dark-300">{u.area_nombre || '—'}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 rounded text-xs font-medium bg-dark-700 text-dark-200">{u.tipo_ubicacion}</span>
                      </td>
                      <td className="px-4 py-3 w-40">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-dark-700 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${pctColor(pct)}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                          </div>
                          <span className="text-xs text-dark-400 w-12 text-right">{u.ocupacion_actual}/{u.capacidad_max}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => toggleActivo(u)} className={`px-2 py-1 rounded text-xs font-medium ${u.activo ? 'bg-green-500/20 text-green-400' : 'bg-dark-700 text-dark-400'}`}>
                          {u.activo ? 'Activo' : 'Inactivo'}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => abrirEditar(u)} className="text-dark-400 hover:text-white transition-colors text-sm">Editar</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="card rounded-xl w-full max-w-md p-6">
              <h2 className="text-lg font-bold text-white mb-4">{editando ? 'Editar Ubicación' : 'Nueva Ubicación'}</h2>
              {error && <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg px-3 py-2 text-sm mb-4">{error}</div>}
              <div className="space-y-3">
                <div>
                  <label className="text-dark-300 text-sm mb-1 block">Código *</label>
                  <input value={form.codigo} onChange={e => setForm(p => ({ ...p, codigo: e.target.value }))}
                    className="input-dark rounded-lg px-3 py-2 text-sm w-full font-mono uppercase" placeholder="Ej: A-01-01" />
                </div>
                <div>
                  <label className="text-dark-300 text-sm mb-1 block">Descripción</label>
                  <input value={form.descripcion} onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))}
                    className="input-dark rounded-lg px-3 py-2 text-sm w-full" placeholder="Descripción opcional" />
                </div>
                <div>
                  <label className="text-dark-300 text-sm mb-1 block">Área *</label>
                  <select value={form.area_id} onChange={e => setForm(p => ({ ...p, area_id: e.target.value }))}
                    className="input-dark rounded-lg px-3 py-2 text-sm w-full">
                    <option value="">Seleccionar área...</option>
                    {areas.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-dark-300 text-sm mb-1 block">Tipo de Ubicación</label>
                  <select value={form.tipo_ubicacion} onChange={e => setForm(p => ({ ...p, tipo_ubicacion: e.target.value }))}
                    className="input-dark rounded-lg px-3 py-2 text-sm w-full">
                    {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-dark-300 text-sm mb-1 block">Capacidad máxima</label>
                  <input type="number" value={form.capacidad_max} onChange={e => setForm(p => ({ ...p, capacidad_max: parseInt(e.target.value) || 0 }))}
                    className="input-dark rounded-lg px-3 py-2 text-sm w-full" min={0} />
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="activo" checked={form.activo} onChange={e => setForm(p => ({ ...p, activo: e.target.checked }))}
                    className="w-4 h-4 rounded" />
                  <label htmlFor="activo" className="text-dark-300 text-sm">Activo</label>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setShowModal(false)} className="flex-1 btn-secondary py-2 rounded-lg text-sm font-medium">Cancelar</button>
                <button onClick={guardar} disabled={saving} className="flex-1 btn-primary py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
