import { useState, useEffect } from 'react'
import Layout from '../../components/Layout'
import { supabase } from '../../lib/supabase'

interface Contenedor {
  id: string
  codigo: string
  descripcion: string
  tipo: string
  capacidad_max: number
  tara_kg: number | null
  activo: boolean
  created_at: string
}

const TIPOS = ['paleta', 'caja', 'pallet plastico', 'contenedor', 'bandeja', 'otro']

export default function Contenedores() {
  const [items, setItems] = useState<Contenedor[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editando, setEditando] = useState<Contenedor | null>(null)
  const [form, setForm] = useState({ codigo: '', descripcion: '', tipo: 'paleta', capacidad_max: 100, tara_kg: '', activo: true })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { fetchItems() }, [])

  async function fetchItems() {
    setLoading(true)
    const { data } = await supabase.from('contenedores').select('*').order('codigo')
    setItems(data || [])
    setLoading(false)
  }

  function abrirNuevo() {
    setEditando(null)
    setForm({ codigo: '', descripcion: '', tipo: 'paleta', capacidad_max: 100, tara_kg: '', activo: true })
    setError('')
    setShowModal(true)
  }

  function abrirEditar(c: Contenedor) {
    setEditando(c)
    setForm({ codigo: c.codigo, descripcion: c.descripcion || '', tipo: c.tipo, capacidad_max: c.capacidad_max, tara_kg: c.tara_kg?.toString() || '', activo: c.activo })
    setError('')
    setShowModal(true)
  }

  async function guardar() {
    if (!form.codigo.trim()) { setError('El código es obligatorio'); return }
    setSaving(true); setError('')
    const payload = { ...form, codigo: form.codigo.toUpperCase(), tara_kg: form.tara_kg ? parseFloat(form.tara_kg) : null }
    try {
      if (editando) {
        const { error: e } = await supabase.from('contenedores').update(payload).eq('id', editando.id)
        if (e) throw e
      } else {
        const { error: e } = await supabase.from('contenedores').insert(payload)
        if (e) throw e
      }
      setShowModal(false); fetchItems()
    } catch (e: any) { setError(e.message || 'Error al guardar') }
    finally { setSaving(false) }
  }

  async function toggleActivo(c: Contenedor) {
    await supabase.from('contenedores').update({ activo: !c.activo }).eq('id', c.id)
    fetchItems()
  }

  const filtrados = items.filter(c =>
    !busqueda || c.codigo.toLowerCase().includes(busqueda.toLowerCase()) || c.descripcion?.toLowerCase().includes(busqueda.toLowerCase())
  )

  const tipoBadgeColor: Record<string, string> = {
    paleta: 'bg-blue-500/20 text-blue-400',
    caja: 'bg-green-500/20 text-green-400',
    'pallet plastico': 'bg-purple-500/20 text-purple-400',
    contenedor: 'bg-yellow-500/20 text-yellow-400',
    bandeja: 'bg-cyan-500/20 text-cyan-400',
    otro: 'bg-dark-700 text-dark-400',
  }

  return (
    <Layout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Contenedores</h1>
            <p className="text-dark-400 text-sm mt-1">Paletas, cajas y unidades de carga</p>
          </div>
          <button onClick={abrirNuevo} className="btn-primary px-4 py-2 rounded-lg text-sm font-medium">+ Nuevo Contenedor</button>
        </div>

        <div className="flex items-center gap-3 mb-4">
          <input type="text" placeholder="Buscar código o descripción..."
            value={busqueda} onChange={e => setBusqueda(e.target.value)}
            className="input-dark rounded-lg px-3 py-2 text-sm flex-1 max-w-xs" />
          <span className="text-dark-400 text-sm ml-auto">{filtrados.length} contenedores</span>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-dark-500 border-t-primary-500 rounded-full animate-spin" /></div>
        ) : (
          <div className="card rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-700">
                  <th className="text-left px-4 py-3 text-dark-400 text-xs font-medium uppercase tracking-wider">Código</th>
                  <th className="text-left px-4 py-3 text-dark-400 text-xs font-medium uppercase tracking-wider">Descripción</th>
                  <th className="text-left px-4 py-3 text-dark-400 text-xs font-medium uppercase tracking-wider">Tipo</th>
                  <th className="text-right px-4 py-3 text-dark-400 text-xs font-medium uppercase tracking-wider">Cap. máx.</th>
                  <th className="text-right px-4 py-3 text-dark-400 text-xs font-medium uppercase tracking-wider">Tara (kg)</th>
                  <th className="text-left px-4 py-3 text-dark-400 text-xs font-medium uppercase tracking-wider">Estado</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtrados.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-8 text-dark-400">No hay contenedores registrados</td></tr>
                ) : filtrados.map(c => (
                  <tr key={c.id} className="border-b border-dark-800 hover:bg-dark-800/50 transition-colors">
                    <td className="px-4 py-3 text-white font-mono font-semibold">{c.codigo}</td>
                    <td className="px-4 py-3 text-dark-300">{c.descripcion || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${tipoBadgeColor[c.tipo] || 'bg-dark-700 text-dark-400'}`}>{c.tipo}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-dark-300">{c.capacidad_max}</td>
                    <td className="px-4 py-3 text-right text-dark-300 font-mono">{c.tara_kg ?? '—'}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => toggleActivo(c)} className={`px-2 py-1 rounded text-xs font-medium ${c.activo ? 'bg-green-500/20 text-green-400' : 'bg-dark-700 text-dark-400'}`}>
                        {c.activo ? 'Activo' : 'Inactivo'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => abrirEditar(c)} className="text-dark-400 hover:text-white transition-colors text-sm">Editar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {showModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="card rounded-xl w-full max-w-md p-6">
              <h2 className="text-lg font-bold text-white mb-4">{editando ? 'Editar Contenedor' : 'Nuevo Contenedor'}</h2>
              {error && <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg px-3 py-2 text-sm mb-4">{error}</div>}
              <div className="space-y-3">
                <div>
                  <label className="text-dark-300 text-sm mb-1 block">Código *</label>
                  <input value={form.codigo} onChange={e => setForm(p => ({ ...p, codigo: e.target.value }))}
                    className="input-dark rounded-lg px-3 py-2 text-sm w-full font-mono uppercase" placeholder="PAL-001" />
                </div>
                <div>
                  <label className="text-dark-300 text-sm mb-1 block">Descripción</label>
                  <input value={form.descripcion} onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))}
                    className="input-dark rounded-lg px-3 py-2 text-sm w-full" placeholder="Paleta de madera 1.2x1.0" />
                </div>
                <div>
                  <label className="text-dark-300 text-sm mb-1 block">Tipo</label>
                  <select value={form.tipo} onChange={e => setForm(p => ({ ...p, tipo: e.target.value }))}
                    className="input-dark rounded-lg px-3 py-2 text-sm w-full">
                    {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-dark-300 text-sm mb-1 block">Capacidad máx.</label>
                    <input type="number" value={form.capacidad_max} onChange={e => setForm(p => ({ ...p, capacidad_max: parseInt(e.target.value) || 0 }))}
                      className="input-dark rounded-lg px-3 py-2 text-sm w-full" min={0} />
                  </div>
                  <div>
                    <label className="text-dark-300 text-sm mb-1 block">Tara (kg)</label>
                    <input type="number" step="0.01" value={form.tara_kg} onChange={e => setForm(p => ({ ...p, tara_kg: e.target.value }))}
                      className="input-dark rounded-lg px-3 py-2 text-sm w-full" placeholder="0.00" />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="activoCont" checked={form.activo} onChange={e => setForm(p => ({ ...p, activo: e.target.checked }))} className="w-4 h-4 rounded" />
                  <label htmlFor="activoCont" className="text-dark-300 text-sm">Activo</label>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setShowModal(false)} className="flex-1 btn-secondary py-2 rounded-lg text-sm">Cancelar</button>
                <button onClick={guardar} disabled={saving} className="flex-1 btn-primary py-2 rounded-lg text-sm disabled:opacity-50">
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
