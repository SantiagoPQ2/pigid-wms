import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

interface Stats {
  recepcionesHoy: number
  preparacionesHoy: number
  despachosHoy: number
  tareasPendientes: number
  tareasEnProceso: number
  stockTotal: number
  articulosBajoStock: number
  reposicionPendiente: number
}

interface ActividadReciente {
  tipo: string
  descripcion: string
  tiempo: string
  color: string
}

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState<Stats>({
    recepcionesHoy: 0, preparacionesHoy: 0, despachosHoy: 0,
    tareasPendientes: 0, tareasEnProceso: 0, stockTotal: 0,
    articulosBajoStock: 0, reposicionPendiente: 0,
  })
  const [actividad, setActividad] = useState<ActividadReciente[]>([])
  const [loading, setLoading] = useState(true)
  const [hora, setHora] = useState(new Date())

  useEffect(() => {
    fetchStats()
    const timer = setInterval(() => setHora(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  async function fetchStats() {
    const hoy = new Date(); hoy.setHours(0,0,0,0)
    const hoyISO = hoy.toISOString()

    const [
      { count: rec }, { count: prep }, { count: desp },
      { count: tPend }, { count: tProc },
      { data: stockData },
      { count: reposPend }
    ] = await Promise.all([
      supabase.from('documentos_recepcion').select('id', { count: 'exact', head: true }).gte('created_at', hoyISO),
      supabase.from('preparaciones').select('id', { count: 'exact', head: true }).gte('created_at', hoyISO),
      supabase.from('despachos').select('id', { count: 'exact', head: true }).gte('created_at', hoyISO),
      supabase.from('tareas').select('id', { count: 'exact', head: true }).eq('estado', 'pendiente'),
      supabase.from('tareas').select('id', { count: 'exact', head: true }).eq('estado', 'en_proceso'),
      supabase.from('stock').select('cantidad'),
      supabase.from('reposicion_picking').select('id', { count: 'exact', head: true }).eq('estado', 'pendiente'),
    ])

    const totalStock = (stockData || []).reduce((sum: number, s: any) => sum + (s.cantidad || 0), 0)

    setStats({
      recepcionesHoy: rec || 0, preparacionesHoy: prep || 0, despachosHoy: desp || 0,
      tareasPendientes: tPend || 0, tareasEnProceso: tProc || 0,
      stockTotal: totalStock, articulosBajoStock: 0, reposicionPendiente: reposPend || 0,
    })

    // Actividad reciente
    const [{ data: ultimasRec }, { data: ultimasPrep }, { data: ultimasDesp }] = await Promise.all([
      supabase.from('documentos_recepcion').select('numero, created_at').order('created_at', { ascending: false }).limit(3),
      supabase.from('preparaciones').select('numero, created_at').order('created_at', { ascending: false }).limit(3),
      supabase.from('despachos').select('numero, created_at').order('created_at', { ascending: false }).limit(3),
    ])

    const act: ActividadReciente[] = [
      ...(ultimasRec || []).map((r: any) => ({ tipo: 'Recepción', descripcion: r.numero, tiempo: r.created_at, color: 'bg-blue-500' })),
      ...(ultimasPrep || []).map((p: any) => ({ tipo: 'Preparación', descripcion: p.numero, tiempo: p.created_at, color: 'bg-purple-500' })),
      ...(ultimasDesp || []).map((d: any) => ({ tipo: 'Despacho', descripcion: d.numero, tiempo: d.created_at, color: 'bg-green-500' })),
    ].sort((a, b) => new Date(b.tiempo).getTime() - new Date(a.tiempo).getTime()).slice(0, 8)

    setActividad(act)
    setLoading(false)
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

  const saludo = () => {
    const h = hora.getHours()
    if (h < 12) return 'Buenos días'
    if (h < 19) return 'Buenas tardes'
    return 'Buenas noches'
  }

  const kpisOperativos = [
    { label: 'Recepciones hoy', value: stats.recepcionesHoy, icon: '📥', color: 'text-blue-400', bg: 'bg-blue-500/10', path: '/recepcion/documentos' },
    { label: 'Preparaciones hoy', value: stats.preparacionesHoy, icon: '📦', color: 'text-purple-400', bg: 'bg-purple-500/10', path: '/preparacion/preparaciones' },
    { label: 'Despachos hoy', value: stats.despachosHoy, icon: '🚚', color: 'text-green-400', bg: 'bg-green-500/10', path: '/despacho/despachos' },
    { label: 'Stock total', value: stats.stockTotal.toLocaleString('es-AR'), icon: '📊', color: 'text-yellow-400', bg: 'bg-yellow-500/10', path: '/reportes/stock' },
  ]

  const kpisTareas = [
    { label: 'Tareas pendientes', value: stats.tareasPendientes, icon: '⏳', color: 'text-blue-400', path: '/reportes/tareas-activas' },
    { label: 'En proceso', value: stats.tareasEnProceso, icon: '⚡', color: 'text-yellow-400', path: '/reportes/tareas-activas' },
    { label: 'Reposición pendiente', value: stats.reposicionPendiente, icon: '🔄', color: 'text-orange-400', path: '/deposito/reposicion' },
  ]

  const accesosRapidos = [
    { label: 'Nueva Recepción', icon: '📥', path: '/recepcion/documentos', color: 'hover:border-blue-500/50' },
    { label: 'Control Ciego', icon: '🎯', path: '/recepcion/control-ciego', color: 'hover:border-cyan-500/50' },
    { label: 'Preparaciones', icon: '📦', path: '/preparacion/preparaciones', color: 'hover:border-purple-500/50' },
    { label: 'Despachos', icon: '🚚', path: '/despacho/despachos', color: 'hover:border-green-500/50' },
    { label: 'Consultar Stock', icon: '📊', path: '/reportes/stock', color: 'hover:border-yellow-500/50' },
    { label: 'Tareas en Vivo', icon: '⚡', path: '/reportes/tareas-activas', color: 'hover:border-red-500/50' },
    { label: 'Reposición', icon: '🔄', path: '/deposito/reposicion', color: 'hover:border-orange-500/50' },
    { label: 'Estadísticas', icon: '📈', path: '/reportes/estadisticas', color: 'hover:border-primary-500/50' },
  ]

  return (
    <Layout>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">
              {saludo()}{user?.email ? ', ' + user.email.split('@')[0] : ''} 👋
            </h1>
            <p className="text-dark-400 text-sm mt-1">
              {hora.toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              {' · '}
              <span className="font-mono">{hora.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
            </p>
          </div>
          <button onClick={fetchStats} className="btn-secondary px-3 py-2 rounded-lg text-sm flex items-center gap-2">
            <span>↻</span> Actualizar
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-24"><div className="w-10 h-10 border-2 border-dark-500 border-t-primary-500 rounded-full animate-spin" /></div>
        ) : (
          <>
            {/* KPIs operativos */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {kpisOperativos.map(k => (
                <button key={k.label} onClick={() => navigate(k.path)}
                  className={`card rounded-xl p-5 text-left hover:scale-[1.02] transition-transform ${k.bg}`}>
                  <div className="text-2xl mb-2">{k.icon}</div>
                  <p className={`text-3xl font-bold ${k.color}`}>{k.value}</p>
                  <p className="text-dark-400 text-sm mt-1">{k.label}</p>
                </button>
              ))}
            </div>

            {/* KPIs tareas + actividad */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {kpisTareas.map(k => (
                <button key={k.label} onClick={() => navigate(k.path)}
                  className="card rounded-xl p-4 text-left flex items-center gap-4 hover:border-dark-600 transition-colors">
                  <span className="text-2xl">{k.icon}</span>
                  <div>
                    <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
                    <p className="text-dark-400 text-sm">{k.label}</p>
                  </div>
                </button>
              ))}
            </div>

            {/* Accesos rápidos + Actividad reciente */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Accesos rápidos */}
              <div>
                <h2 className="text-white font-semibold mb-3">Accesos rápidos</h2>
                <div className="grid grid-cols-4 gap-2">
                  {accesosRapidos.map(a => (
                    <button key={a.label} onClick={() => navigate(a.path)}
                      className={`card rounded-xl p-3 flex flex-col items-center gap-2 transition-colors ${a.color}`}>
                      <span className="text-xl">{a.icon}</span>
                      <span className="text-dark-300 text-xs text-center leading-tight">{a.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Actividad reciente */}
              <div>
                <h2 className="text-white font-semibold mb-3">Actividad reciente</h2>
                <div className="card rounded-xl overflow-hidden">
                  {actividad.length === 0 ? (
                    <div className="py-8 text-center text-dark-500 text-sm">Sin actividad registrada hoy</div>
                  ) : actividad.map((a, i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-dark-800 last:border-0">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${a.color}`} />
                      <div className="flex-1 min-w-0">
                        <span className="text-dark-400 text-xs">{a.tipo} · </span>
                        <span className="text-white text-sm font-mono">{a.descripcion}</span>
                      </div>
                      <span className="text-dark-600 text-xs flex-shrink-0">{tiempoRelativo(a.tiempo)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  )
}
