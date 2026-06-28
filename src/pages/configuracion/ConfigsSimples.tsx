import { useState, useEffect } from 'react'
import Layout from '../../components/Layout'
import { supabase } from '../../lib/supabase'

// ─── Generic CRUD component ──────────────────────────────────────────────────
interface Campo { key: string; label: string; type?: string; required?: boolean }

function ConfigCRUD({ tabla, titulo, campos }: { tabla: string; titulo: string; campos: Campo[] }) {
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editando, setEditando] = useState<any | null>(null)
  const [form, setForm] = useState<Record<string, any>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { fetch() }, [])

  async function fetch() {
    setLoading(true)
    const { data } = await supabase.from(tabla).select('*').order('nombre', { ascending: true })
    setRows(data || [])
    setLoading(false)
  }

  function abrirNuevo() {
    setEditando(null)
    const initial: Record<string, any> = {}
    campos.forEach(c => { initial[c.key] = c.type === 'checkbox' ? true : '' })
    setForm(initial)
    setError('')
    setShowModal(true)
  }

  function abrirEditar(row: any) {
    setEditando(row)
    const f: Record<string, any> = {}
    campos.forEach(c => { f[c.key] = row[c.key] ?? (c.type === 'checkbox' ? true : '') })
    setForm(f)
    setError('')
    setShowModal(true)
  }

  async function guardar() {
    const reqs = campos.filter(c => c.required)
    for (const c of reqs) { if (!form[c.key]?.toString().trim()) { setError(c.label + ' es obligatorio'); return } }
    setSaving(true); setError('')
    try {
      if (editando) {
        const { error: e } = await supabase.from(tabla).update(form).eq('id', editando.id)
        if (e) throw e
      } else {
        const { error: e } = await supabase.from(tabla).insert(form)
        if (e) throw e
      }
      setShowModal(false); fetch()
    } catch (e: any) { setError(e.message || 'Error al guardar') }
    finally { setSaving(false) }
  }

  async function toggleActivo(row: any) {
    await supabase.from(tabla).update({ activo: !row.activo }).eq('id', row.id)
    fetch()
  }

  const camposVisibles = campos.filter(c => c.type !== 'checkbox')

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-white font-semibold">{titulo} ({rows.length})</h2>
        <button onClick={abrirNuevo} className="btn-primary px-3 py-1.5 rounded-lg text-sm font-medium">+ Nuevo</button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-dark-500 border-t-primary-500 rounded-full animate-spin" /></div>
      ) : (
        <div className="card rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-dark-700">
                {camposVisibles.map(c => (
                  <th key={c.key} className="text-left px-4 py-3 text-dark-400 text-xs font-medium uppercase tracking-wider">{c.label}</th>
                ))}
                <th className="text-left px-4 py-3 text-dark-400 text-xs font-medium uppercase tracking-wider">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={camposVisibles.length + 2} className="text-center py-6 text-dark-400 text-sm">Sin registros</td></tr>
              ) : rows.map(row => (
                <tr key={row.id} className="border-b border-dark-800 hover:bg-dark-800/50 transition-colors">
                  {camposVisibles.map(c => (
                    <td key={c.key} className="px-4 py-3 text-dark-300 text-sm">{row[c.key] || '—'}</td>
                  ))}
                  <td className="px-4 py-3">
                    <button onClick={() => toggleActivo(row)} className={`px-2 py-0.5 rounded text-xs font-medium ${row.activo !== false ? 'bg-green-500/20 text-green-400' : 'bg-dark-700 text-dark-400'}`}>
                      {row.activo !== false ? 'Activo' : 'Inactivo'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => abrirEditar(row)} className="text-dark-400 hover:text-white text-xs transition-colors">Editar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="card rounded-xl w-full max-w-sm p-6">
            <h3 className="text-white font-bold mb-4">{editando ? 'Editar' : 'Nuevo'} {titulo}</h3>
            {error && <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg px-3 py-2 text-xs mb-3">{error}</div>}
            <div className="space-y-3">
              {campos.map(c => c.type === 'checkbox' ? (
                <div key={c.key} className="flex items-center gap-2">
                  <input type="checkbox" id={c.key} checked={!!form[c.key]}
                    onChange={e => setForm(p => ({ ...p, [c.key]: e.target.checked }))} className="w-4 h-4 rounded" />
                  <label htmlFor={c.key} className="text-dark-300 text-sm">{c.label}</label>
                </div>
              ) : (
                <div key={c.key}>
                  <label className="text-dark-300 text-sm mb-1 block">{c.label}{c.required ? ' *' : ''}</label>
                  <input value={form[c.key] || ''} onChange={e => setForm(p => ({ ...p, [c.key]: e.target.value }))}
                    className="input-dark rounded-lg px-3 py-2 text-sm w-full" />
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowModal(false)} className="flex-1 btn-secondary py-2 rounded-lg text-sm">Cancelar</button>
              <button onClick={guardar} disabled={saving} className="flex-1 btn-primary py-2 rounded-lg text-sm disabled:opacity-50">
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Páginas individuales ─────────────────────────────────────────────────────

export function TipoUbicacion() {
  return (
    <Layout>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Tipos de Ubicación</h1>
          <p className="text-dark-400 text-sm mt-1">Categorías para clasificar las ubicaciones del depósito</p>
        </div>
        <ConfigCRUD
          tabla="tipos_ubicacion"
          titulo="Tipo de Ubicación"
          campos={[
            { key: 'nombre', label: 'Nombre', required: true },
            { key: 'descripcion', label: 'Descripción' },
            { key: 'activo', label: 'Activo', type: 'checkbox' }
          ]}
        />
      </div>
    </Layout>
  )
}

export function MotivoAjuste() {
  return (
    <Layout>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Motivos de Ajuste</h1>
          <p className="text-dark-400 text-sm mt-1">Razones disponibles para los ajustes de inventario</p>
        </div>
        <ConfigCRUD
          tabla="motivos_ajuste"
          titulo="Motivo de Ajuste"
          campos={[
            { key: 'nombre', label: 'Nombre', required: true },
            { key: 'descripcion', label: 'Descripción' },
            { key: 'activo', label: 'Activo', type: 'checkbox' }
          ]}
        />
      </div>
    </Layout>
  )
}

export function Negocio() {
  const [config, setConfig] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState({ nombre: '', razon_social: '', cuit: '', direccion: '', telefono: '', email: '', logo_url: '' })

  useEffect(() => {
    supabase.from('negocios').select('*').single().then(({ data }) => {
      if (data) { setConfig(data); setForm({ nombre: data.nombre || '', razon_social: data.razon_social || '', cuit: data.cuit || '', direccion: data.direccion || '', telefono: data.telefono || '', email: data.email || '', logo_url: data.logo_url || '' }) }
      setLoading(false)
    })
  }, [])

  async function guardar() {
    setSaving(true); setSaved(false)
    if (config) {
      await supabase.from('negocios').update(form).eq('id', config.id)
    } else {
      await supabase.from('negocios').insert(form)
    }
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  if (loading) return <Layout><div className="flex justify-center py-24"><div className="w-8 h-8 border-2 border-dark-500 border-t-primary-500 rounded-full animate-spin" /></div></Layout>

  return (
    <Layout>
      <div className="p-6 max-w-2xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Negocio</h1>
          <p className="text-dark-400 text-sm mt-1">Datos de tu empresa</p>
        </div>
        <div className="card rounded-xl p-6 space-y-4">
          {[
            { key: 'nombre', label: 'Nombre comercial', placeholder: 'Mi Empresa SRL' },
            { key: 'razon_social', label: 'Razón social', placeholder: 'Mi Empresa S.R.L.' },
            { key: 'cuit', label: 'CUIT', placeholder: '30-12345678-9' },
            { key: 'direccion', label: 'Dirección', placeholder: 'Av. Corrientes 1234, CABA' },
            { key: 'telefono', label: 'Teléfono', placeholder: '+54 11 4444-5555' },
            { key: 'email', label: 'Email', placeholder: 'info@empresa.com' },
            { key: 'logo_url', label: 'URL del Logo', placeholder: 'https://...' },
          ].map(f => (
            <div key={f.key}>
              <label className="text-dark-300 text-sm mb-1 block">{f.label}</label>
              <input value={(form as any)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                className="input-dark rounded-lg px-3 py-2 text-sm w-full" placeholder={f.placeholder} />
            </div>
          ))}
          <div className="flex items-center gap-3 pt-2">
            <button onClick={guardar} disabled={saving} className="btn-primary px-6 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
            {saved && <span className="text-green-400 text-sm">✓ Guardado</span>}
          </div>
        </div>
      </div>
    </Layout>
  )
}

export function Impresoras() {
  return (
    <Layout>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Impresoras</h1>
          <p className="text-dark-400 text-sm mt-1">Gestión de impresoras de etiquetas y documentos</p>
        </div>
        <ConfigCRUD
          tabla="impresoras"
          titulo="Impresora"
          campos={[
            { key: 'nombre', label: 'Nombre', required: true },
            { key: 'modelo', label: 'Modelo' },
            { key: 'ip', label: 'IP / Host' },
            { key: 'tipo', label: 'Tipo (etiquetas/documentos)' },
            { key: 'activo', label: 'Activa', type: 'checkbox' }
          ]}
        />
      </div>
    </Layout>
  )
}
