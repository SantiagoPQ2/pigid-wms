import { useState, useEffect } from 'react'
import Layout from '../../components/Layout'
import { supabase } from '../../lib/supabase'

interface Usuario {
  id: string
  nombre: string
  email: string
  rol: string
  activo: boolean
  created_at: string
}

interface Transporte {
  id: string
  nombre: string
  cuit: string
  telefono: string
  email: string
  activo: boolean
  created_at: string
}

const ROLES = ['admin', 'operario', 'supervisor', 'solo_lectura']

export default function UsuariosTransportes() {
  const [tab, setTab] = useState<'usuarios' | 'transportes'>('usuarios')

  // Usuarios
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loadingU, setLoadingU] = useState(true)
  const [showModalU, setShowModalU] = useState(false)
  const [editandoU, setEditandoU] = useState<Usuario | null>(null)
  const [formU, setFormU] = useState({ nombre: '', email: '', rol: 'operario', activo: true })
  const [savingU, setSavingU] = useState(false)
  const [errorU, setErrorU] = useState('')

  // Transportes
  const [transportes, setTransportes] = useState<Transporte[]>([])
  const [loadingT, setLoadingT] = useState(true)
  const [showModalT, setShowModalT] = useState(false)
  const [editandoT, setEditandoT] = useState<Transporte | null>(null)
  const [formT, setFormT] = useState({ nombre: '', cuit: '', telefono: '', email: '', activo: true })
  const [savingT, setSavingT] = useState(false)
  const [errorT, setErrorT] = useState('')

  useEffect(() => { fetchUsuarios(); fetchTransportes() }, [])

  async function fetchUsuarios() {
    setLoadingU(true)
    const { data } = await supabase.from('usuarios').select('*').order('nombre')
    setUsuarios(data || [])
    setLoadingU(false)
  }

  async function fetchTransportes() {
    setLoadingT(true)
    const { data } = await supabase.from('transportes').select('*').order('nombre')
    setTransportes(data || [])
    setLoadingT(false)
  }

  function abrirNuevoU() {
    setEditandoU(null)
    setFormU({ nombre: '', email: '', rol: 'operario', activo: true })
    setErrorU('')
    setShowModalU(true)
  }

  function abrirEditarU(u: Usuario) {
    setEditandoU(u)
    setFormU({ nombre: u.nombre, email: u.email, rol: u.rol, activo: u.activo })
    setErrorU('')
    setShowModalU(true)
  }

  async function guardarU() {
    if (!formU.nombre.trim() || !formU.email.trim()) { setErrorU('Nombre y email son obligatorios'); return }
    setSavingU(true); setErrorU('')
    try {
      if (editandoU) {
        const { error: e } = await supabase.from('usuarios').update(formU).eq('id', editandoU.id)
        if (e) throw e
      } else {
        const { error: e } = await supabase.from('usuarios').insert(formU)
        if (e) throw e
      }
      setShowModalU(false); fetchUsuarios()
    } catch (e: any) { setErrorU(e.message || 'Error al guardar') }
    finally { setSavingU(false) }
  }

  async function toggleActivoU(u: Usuario) {
    await supabase.from('usuarios').update({ activo: !u.activo }).eq('id', u.id)
    fetchUsuarios()
  }

  function abrirNuevoT() {
    setEditandoT(null)
    setFormT({ nombre: '', cuit: '', telefono: '', email: '', activo: true })
    setErrorT('')
    setShowModalT(true)
  }

  function abrirEditarT(t: Transporte) {
    setEditandoT(t)
    setFormT({ nombre: t.nombre, cuit: t.cuit, telefono: t.telefono, email: t.email, activo: t.activo })
    setErrorT('')
    setShowModalT(true)
  }

  async function guardarT() {
    if (!formT.nombre.trim()) { setErrorT('El nombre es obligatorio'); return }
    setSavingT(true); setErrorT('')
    try {
      if (editandoT) {
        const { error: e } = await supabase.from('transportes').update(formT).eq('id', editandoT.id)
        if (e) throw e
      } else {
        const { error: e } = await supabase.from('transportes').insert(formT)
        if (e) throw e
      }
      setShowModalT(false); fetchTransportes()
    } catch (e: any) { setErrorT(e.message || 'Error al guardar') }
    finally { setSavingT(false) }
  }

  async function toggleActivoT(t: Transporte) {
    await supabase.from('transportes').update({ activo: !t.activo }).eq('id', t.id)
    fetchTransportes()
  }

  const rolBadge = (rol: string) => {
    const colors: Record<string, string> = {
      admin: 'bg-red-500/20 text-red-400',
      supervisor: 'bg-yellow-500/20 text-yellow-400',
      operario: 'bg-blue-500/20 text-blue-400',
      solo_lectura: 'bg-dark-700 text-dark-400'
    }
    return colors[rol] || 'bg-dark-700 text-dark-400'
  }

  return (
    <Layout>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Usuarios & Transportes</h1>
          <p className="text-dark-400 text-sm mt-1">Gestión de usuarios del sistema y empresas de transporte</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-dark-800 rounded-lg p-1 w-fit">
          <button onClick={() => setTab('usuarios')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'usuarios' ? 'bg-primary-600 text-white' : 'text-dark-400 hover:text-white'}`}>
            Usuarios ({usuarios.length})
          </button>
          <button onClick={() => setTab('transportes')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'transportes' ? 'bg-primary-600 text-white' : 'text-dark-400 hover:text-white'}`}>
            Transportes ({transportes.length})
          </button>
        </div>

        {/* USUARIOS */}
        {tab === 'usuarios' && (
          <>
            <div className="flex justify-end mb-4">
              <button onClick={abrirNuevoU} className="btn-primary px-4 py-2 rounded-lg text-sm font-medium">+ Nuevo Usuario</button>
            </div>
            {loadingU ? (
              <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-dark-500 border-t-primary-500 rounded-full animate-spin" /></div>
            ) : (
              <div className="card rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-dark-700">
                      <th className="text-left px-4 py-3 text-dark-400 text-xs font-medium uppercase tracking-wider">Nombre</th>
                      <th className="text-left px-4 py-3 text-dark-400 text-xs font-medium uppercase tracking-wider">Email</th>
                      <th className="text-left px-4 py-3 text-dark-400 text-xs font-medium uppercase tracking-wider">Rol</th>
                      <th className="text-left px-4 py-3 text-dark-400 text-xs font-medium uppercase tracking-wider">Estado</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {usuarios.length === 0 ? (
                      <tr><td colSpan={5} className="text-center py-8 text-dark-400">No hay usuarios registrados</td></tr>
                    ) : usuarios.map(u => (
                      <tr key={u.id} className="border-b border-dark-800 hover:bg-dark-800/50 transition-colors">
                        <td className="px-4 py-3 text-white font-medium">{u.nombre}</td>
                        <td className="px-4 py-3 text-dark-300">{u.email}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${rolBadge(u.rol)}`}>{u.rol}</span>
                        </td>
                        <td className="px-4 py-3">
                          <button onClick={() => toggleActivoU(u)} className={`px-2 py-1 rounded text-xs font-medium ${u.activo ? 'bg-green-500/20 text-green-400' : 'bg-dark-700 text-dark-400'}`}>
                            {u.activo ? 'Activo' : 'Inactivo'}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => abrirEditarU(u)} className="text-dark-400 hover:text-white transition-colors text-sm">Editar</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* TRANSPORTES */}
        {tab === 'transportes' && (
          <>
            <div className="flex justify-end mb-4">
              <button onClick={abrirNuevoT} className="btn-primary px-4 py-2 rounded-lg text-sm font-medium">+ Nuevo Transporte</button>
            </div>
            {loadingT ? (
              <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-dark-500 border-t-primary-500 rounded-full animate-spin" /></div>
            ) : (
              <div className="card rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-dark-700">
                      <th className="text-left px-4 py-3 text-dark-400 text-xs font-medium uppercase tracking-wider">Nombre</th>
                      <th className="text-left px-4 py-3 text-dark-400 text-xs font-medium uppercase tracking-wider">CUIT</th>
                      <th className="text-left px-4 py-3 text-dark-400 text-xs font-medium uppercase tracking-wider">Teléfono</th>
                      <th className="text-left px-4 py-3 text-dark-400 text-xs font-medium uppercase tracking-wider">Email</th>
                      <th className="text-left px-4 py-3 text-dark-400 text-xs font-medium uppercase tracking-wider">Estado</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {transportes.length === 0 ? (
                      <tr><td colSpan={6} className="text-center py-8 text-dark-400">No hay transportes registrados</td></tr>
                    ) : transportes.map(t => (
                      <tr key={t.id} className="border-b border-dark-800 hover:bg-dark-800/50 transition-colors">
                        <td className="px-4 py-3 text-white font-medium">{t.nombre}</td>
                        <td className="px-4 py-3 text-dark-300 font-mono">{t.cuit || '—'}</td>
                        <td className="px-4 py-3 text-dark-300">{t.telefono || '—'}</td>
                        <td className="px-4 py-3 text-dark-300">{t.email || '—'}</td>
                        <td className="px-4 py-3">
                          <button onClick={() => toggleActivoT(t)} className={`px-2 py-1 rounded text-xs font-medium ${t.activo ? 'bg-green-500/20 text-green-400' : 'bg-dark-700 text-dark-400'}`}>
                            {t.activo ? 'Activo' : 'Inactivo'}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => abrirEditarT(t)} className="text-dark-400 hover:text-white transition-colors text-sm">Editar</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* Modal Usuarios */}
        {showModalU && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="card rounded-xl w-full max-w-md p-6">
              <h2 className="text-lg font-bold text-white mb-4">{editandoU ? 'Editar Usuario' : 'Nuevo Usuario'}</h2>
              {errorU && <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg px-3 py-2 text-sm mb-4">{errorU}</div>}
              <div className="space-y-3">
                <div>
                  <label className="text-dark-300 text-sm mb-1 block">Nombre *</label>
                  <input value={formU.nombre} onChange={e => setFormU(p => ({ ...p, nombre: e.target.value }))}
                    className="input-dark rounded-lg px-3 py-2 text-sm w-full" placeholder="Nombre completo" />
                </div>
                <div>
                  <label className="text-dark-300 text-sm mb-1 block">Email *</label>
                  <input type="email" value={formU.email} onChange={e => setFormU(p => ({ ...p, email: e.target.value }))}
                    className="input-dark rounded-lg px-3 py-2 text-sm w-full" placeholder="email@empresa.com" />
                </div>
                <div>
                  <label className="text-dark-300 text-sm mb-1 block">Rol</label>
                  <select value={formU.rol} onChange={e => setFormU(p => ({ ...p, rol: e.target.value }))}
                    className="input-dark rounded-lg px-3 py-2 text-sm w-full">
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="activoU" checked={formU.activo} onChange={e => setFormU(p => ({ ...p, activo: e.target.checked }))} className="w-4 h-4 rounded" />
                  <label htmlFor="activoU" className="text-dark-300 text-sm">Activo</label>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setShowModalU(false)} className="flex-1 btn-secondary py-2 rounded-lg text-sm font-medium">Cancelar</button>
                <button onClick={guardarU} disabled={savingU} className="flex-1 btn-primary py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                  {savingU ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Transportes */}
        {showModalT && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="card rounded-xl w-full max-w-md p-6">
              <h2 className="text-lg font-bold text-white mb-4">{editandoT ? 'Editar Transporte' : 'Nuevo Transporte'}</h2>
              {errorT && <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg px-3 py-2 text-sm mb-4">{errorT}</div>}
              <div className="space-y-3">
                <div>
                  <label className="text-dark-300 text-sm mb-1 block">Nombre *</label>
                  <input value={formT.nombre} onChange={e => setFormT(p => ({ ...p, nombre: e.target.value }))}
                    className="input-dark rounded-lg px-3 py-2 text-sm w-full" placeholder="Nombre de la empresa" />
                </div>
                <div>
                  <label className="text-dark-300 text-sm mb-1 block">CUIT</label>
                  <input value={formT.cuit} onChange={e => setFormT(p => ({ ...p, cuit: e.target.value }))}
                    className="input-dark rounded-lg px-3 py-2 text-sm w-full font-mono" placeholder="XX-XXXXXXXX-X" />
                </div>
                <div>
                  <label className="text-dark-300 text-sm mb-1 block">Teléfono</label>
                  <input value={formT.telefono} onChange={e => setFormT(p => ({ ...p, telefono: e.target.value }))}
                    className="input-dark rounded-lg px-3 py-2 text-sm w-full" placeholder="+54 11 XXXX-XXXX" />
                </div>
                <div>
                  <label className="text-dark-300 text-sm mb-1 block">Email</label>
                  <input type="email" value={formT.email} onChange={e => setFormT(p => ({ ...p, email: e.target.value }))}
                    className="input-dark rounded-lg px-3 py-2 text-sm w-full" placeholder="contacto@transporte.com" />
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="activoT" checked={formT.activo} onChange={e => setFormT(p => ({ ...p, activo: e.target.checked }))} className="w-4 h-4 rounded" />
                  <label htmlFor="activoT" className="text-dark-300 text-sm">Activo</label>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setShowModalT(false)} className="flex-1 btn-secondary py-2 rounded-lg text-sm font-medium">Cancelar</button>
                <button onClick={guardarT} disabled={savingT} className="flex-1 btn-primary py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                  {savingT ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
