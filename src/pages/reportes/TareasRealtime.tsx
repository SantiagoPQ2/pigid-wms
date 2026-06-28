import { useState, useEffect, useRef } from 'react'
import Layout from '../../components/Layout'
import { supabase } from '../../lib/supabase'

type EstadoTarea = 'pendiente' | 'en_proceso' | 'completada' | 'cancelada'
type TipoTarea = 'picking' | 'reposicion' | 'recepcion' | 'despacho' | 'inventario' | 'limpieza' | 'otro'

interface Tarea {
  id: string
  tipo: TipoTarea
  descripcion: string
  ubicacion_codigo: string | null
  articulo_codigo: string | null
  estado: EstadoTarea
  prioridad: number
  asignado_a: string | null
  cantidad: number | null
  notas: string | null
  created_at: string
  updated_at: string
}

const TIPO_COLOR: Record<TipoTarea, string> = {
  picking: 'bg-blue-500/20 text-blue-400',
  reposicion: 'bg-purple-500/20 text-purple-400',
  recepcion: 'bg-cyan-500/20 text-cyan-400',
  despacho: 'bg-green-500/20 text-green-400',
  inventario: 'bg-yellow-500/20 text-yellow-400',
  limpieza: 'bg-dark-700 text-dark-400',
  otro: 'bg-dark-700 text-dark-400',
}

const ESTADO_COLOR: Record<EstadoTarea, string> = {
  pendiente: 'border-l-blue-500',
  en_proceso: 'border-l-yellow-500',
  completada: 'border-l-green-500',
  cancelada: 'border-l-dark-600',
}

const PRIORIDAD_DOT: Record<number, string> = { 1: 'bg-red-500', 2: 'bg-yellow-500', 3: 'bg-blue-400', 4: 'bg-dark-500' }

export default function TareasRealtime() {
  const [tareas, setTareas] = useState<Tarea[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroEstado, setFiltroEstado] = useState<EstadoTarea | ''>('pendiente')
  const [filtroTipo, setFiltroTipo] = useState<TipoTarea | ''>('')
  const [conectado, setConectado] = useState(false)
  const [nuevasTareas, setNuevasTareas] = useState(0)
  const [showNuevaTarea, setShowNuevaTarea] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ tipo: 'picking' as TipoTarea, descripcion: '', ubicacion_codigo: '', articulo_codigo: '', prioridad: 2, cantidad: '', notas: '', asignado_a: '' })
  const channelRef = useRef<any>(null)
  const audioRef = useRef<AudioContext | null>(null)

  useEffect(() => {
    fetchTareas()
    suscribirRealtime()
    return () => { channelRef.current?.unsubscribe() }
  }, [])

  async function fetchTareas() {
    setLoading(true)
    const { data } = await supabase.from('tareas').select('*').order('prioridad').order('created_at', { ascending: false })
    setTareas(data || [])
    setLoading(false)
  }

  function suscribirRealtime() {
    const channel = supabase
      .channel('tareas-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tareas' }, payload => {
        if (payload.eventType === 'INSERT') {
          setTareas(prev => [payload.new as Tarea, ...prev])
          setNuevasTareas(n => n + 1)
          playBeep()
        } else if (payload.eventType === 'UPDATE') {
          setTareas(prev => prev.map(t => t.id === payload.new.id ? payload.new as Tarea : t))
        } else if (payload.eventType === 'DELETE') {
          setTareas(prev => prev.filter(t => t.id !== payload.old.id))
        }
      })
      .subscribe(status => {
        setConectado(status === 'SUBSCRIBED')
      })
    channelRef.current = channel
  }

  function playBeep() {
    try {
      if (!audioRef.current) audioRef.current = new AudioContext()
      const ctx = audioRef.current
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.frequency.value = 880; gain.gain.value = 0.1
      osc.start(); osc.stop(ctx.currentTime + 0.1)
    } catch {}
  }

  async function cambiarEstado(id: string, estado: EstadoTarea) {
    await supabase.from('tareas').update({ estado, updated_at: new Date().toISOString() }).eq('id', id)
  }

  async function crearTarea() {
    if (!form.descripcion.trim()) return
    setSaving(true)
    await supabase.from('tareas').insert({
      tipo: form.tipo,
      descripcion: form.descripcion,
      ubicacion_codigo: form.ubicacion_codigo || null,
      articulo_codigo: form.articulo_codigo || null,
      prioridad: form.prioridad,
      cantidad: form.cantidad ? parseInt(form.cantidad) : null,
      notas: form.notas || null,
      asignado_a: form.asignado_a || null,
      estado: 'pendiente',
    })
    setShowNuevaTarea(false)
    setForm({ tipo: 'picking', descripcion: '', ubicacion_codigo: '', articulo_codigo: '', prioridad: 2, cantidad: '', notas: '', asignado_a: '' })
    setSaving(false)
  }

  const filtradas = tareas.filter(t => {
    if (filtroEstado && t.estado !== filtroEstado) return false
    if (filtroTipo && t.tipo !== filtroTipo) return false
    return true
  })

  const counts = {
    pendiente: tareas.filter(t => t.estado === 'pendiente').length,
    en_proceso: tareas.filter(t => t.estado === 'en_proceso').length,
    completada: tareas.filter(t => t.estado === 'completada').length,
  }

  function tiempoRelativo(fecha: string) {
    const diff = Date.now() - new Date(fecha).getTime()
    const min = Math.floor(diff / 60000)
    if (min < 1) return 'ahora'
    if (min < 60) return `hace ${min}m`
    const hs = Math.floor(min / 60)
    if (hs < 24) return `hace ${hs}h`
    return new Date(fecha).toLocaleDateString('es-AR')
  }

  return (
    <Layout>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-2xl font-bold text-white">Tareas en Tiempo Real</h1>
              <p className="text-dark-400 text-sm mt-1">Panel de operaciones en vivo</p>
            </div>
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${conectado ? 'bg-green-500/20 text-green-400' : 'bg-dark-700 text-dark-400'}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${conectado ? 'bg-green-400 animate-pulse' : 'bg-dark-500'}`} />
              {conectado ? 'En vivo' : 'Conectando...'}
            </div>
            {nuevasTareas > 0 && (
              <button onClick={() => setNuevasTareas(0)} className="px-2 py-1 rounded-full bg-primary-600 text-white text-xs font-medium animate-bounce">
                +{nuevasTareas} nueva{nuevasTareas > 1 ? 's' : ''}
              </button>
            )}
          </div>
          <button onClick={() => setShowNuevaTarea(true)} className="btn-primary px-4 py-2 rounded-lg text-sm font-medium">
            + Nueva Tarea
          </button>
        </div>

        {/* Tabs de estado */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { key: 'pendiente', label: 'Pendientes', count: counts.pendiente, color: 'border-blue-500 text-blue-400' },
            { key: 'en_proceso', label: 'En proceso', count: counts.en_proceso, color: 'border-yellow-500 text-yellow-400' },
            { key: 'completada', label: 'Completadas', count: counts.completada, color: 'border-green-500 text-green-400' },
          ].map(tab => (
            <button key={tab.key} onClick={() => setFiltroEstado(filtroEstado === tab.key ? '' : tab.key as EstadoTarea)}
              className={`card rounded-xl p-4 text-left border-l-4 transition-colors ${filtroEstado === tab.key ? tab.color : 'border-l-dark-700'}`}>
              <p className={`text-2xl font-bold ${filtroEstado === tab.key ? tab.color.split(' ')[1] : 'text-white'}`}>{tab.count}</p>
              <p className="text-dark-400 text-sm mt-1">{tab.label}</p>
            </button>
          ))}
        </div>

        {/* Filtro tipo */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {(['', 'picking', 'reposicion', 'recepcion', 'despacho', 'inventario', 'otro'] as const).map(t => (
            <button key={t} onClick={() => setFiltroTipo(t as any)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${filtroTipo === t ? 'bg-primary-600 text-white' : 'bg-dark-800 text-dark-400 hover:text-white'}`}>
              {t === '' ? 'Todos' : t}
            </button>
          ))}
        </div>

        {/* Lista de tareas */}
        {loading ? (
          <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-dark-500 border-t-primary-500 rounded-full animate-spin" /></div>
        ) : filtradas.length === 0 ? (
          <div className="card rounded-xl p-10 text-center">
            <p className="text-4xl mb-3">📋</p>
            <p className="text-dark-400">No hay tareas {filtroEstado || filtroTipo ? 'con esos filtros' : ''}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtradas.map(tarea => (
              <div key={tarea.id} className={`card rounded-xl p-4 border-l-4 ${ESTADO_COLOR[tarea.estado]} flex items-center gap-4`}>
                {/* Prioridad dot */}
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${PRIORIDAD_DOT[tarea.prioridad] || 'bg-dark-500'}`} />

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${TIPO_COLOR[tarea.tipo]}`}>{tarea.tipo}</span>
                    {tarea.ubicacion_codigo && <span className="text-primary-400 font-mono text-xs">{tarea.ubicacion_codigo}</span>}
                    {tarea.articulo_codigo && <span className="text-dark-300 font-mono text-xs">{tarea.articulo_codigo}</span>}
                    {tarea.cantidad && <span className="text-dark-400 text-xs">· {tarea.cantidad} u.</span>}
                  </div>
                  <p className="text-white text-sm">{tarea.descripcion}</p>
                  <div className="flex items-center gap-3 mt-1">
                    {tarea.asignado_a && <span className="text-dark-500 text-xs">→ {tarea.asignado_a}</span>}
                    <span className="text-dark-600 text-xs">{tiempoRelativo(tarea.created_at)}</span>
                  </div>
                </div>

                {/* Acciones */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {tarea.estado === 'pendiente' && (
                    <button onClick={() => cambiarEstado(tarea.id, 'en_proceso')}
                      className="text-xs px-2 py-1 rounded bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 transition-colors">
                      Iniciar
                    </button>
                  )}
                  {tarea.estado === 'en_proceso' && (
                    <button onClick={() => cambiarEstado(tarea.id, 'completada')}
                      className="text-xs px-2 py-1 rounded bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors">
                      ✓ Listo
                    </button>
                  )}
                  {(tarea.estado === 'pendiente' || tarea.estado === 'en_proceso') && (
                    <button onClick={() => cambiarEstado(tarea.id, 'cancelada')}
                      className="text-xs px-1.5 py-1 text-dark-600 hover:text-red-400 transition-colors">✕</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal nueva tarea */}
        {showNuevaTarea && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="card rounded-xl w-full max-w-md p-6">
              <h2 className="text-white font-bold mb-4">Nueva Tarea</h2>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-dark-300 text-sm mb-1 block">Tipo</label>
                    <select value={form.tipo} onChange={e => setForm(p => ({ ...p, tipo: e.target.value as TipoTarea }))}
                      className="input-dark rounded-lg px-3 py-2 text-sm w-full">
                      {['picking','reposicion','recepcion','despacho','inventario','limpieza','otro'].map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-dark-300 text-sm mb-1 block">Prioridad</label>
                    <select value={form.prioridad} onChange={e => setForm(p => ({ ...p, prioridad: parseInt(e.target.value) }))}
                      className="input-dark rounded-lg px-3 py-2 text-sm w-full">
                      <option value={1}>1 - Alta</option>
                      <option value={2}>2 - Media</option>
                      <option value={3}>3 - Baja</option>
                      <option value={4}>4 - Mínima</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-dark-300 text-sm mb-1 block">Descripción *</label>
                  <input value={form.descripcion} onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))}
                    className="input-dark rounded-lg px-3 py-2 text-sm w-full" placeholder="Descripción de la tarea" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-dark-300 text-sm mb-1 block">Ubicación</label>
                    <input value={form.ubicacion_codigo} onChange={e => setForm(p => ({ ...p, ubicacion_codigo: e.target.value }))}
                      className="input-dark rounded-lg px-3 py-2 text-sm w-full font-mono uppercase" placeholder="A-01-01" />
                  </div>
                  <div>
                    <label className="text-dark-300 text-sm mb-1 block">Cantidad</label>
                    <input type="number" value={form.cantidad} onChange={e => setForm(p => ({ ...p, cantidad: e.target.value }))}
                      className="input-dark rounded-lg px-3 py-2 text-sm w-full" placeholder="0" />
                  </div>
                </div>
                <div>
                  <label className="text-dark-300 text-sm mb-1 block">Asignar a</label>
                  <input value={form.asignado_a} onChange={e => setForm(p => ({ ...p, asignado_a: e.target.value }))}
                    className="input-dark rounded-lg px-3 py-2 text-sm w-full" placeholder="Nombre del operario" />
                </div>
                <div>
                  <label className="text-dark-300 text-sm mb-1 block">Notas</label>
                  <input value={form.notas} onChange={e => setForm(p => ({ ...p, notas: e.target.value }))}
                    className="input-dark rounded-lg px-3 py-2 text-sm w-full" placeholder="Instrucciones adicionales" />
                </div>
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={() => setShowNuevaTarea(false)} className="flex-1 btn-secondary py-2 rounded-lg text-sm">Cancelar</button>
                <button onClick={crearTarea} disabled={!form.descripcion.trim() || saving}
                  className="flex-1 btn-primary py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                  {saving ? 'Creando...' : 'Crear Tarea'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
