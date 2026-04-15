import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import {
  PackageCheck, Warehouse, ClipboardList, Truck,
  BarChart2, Activity, ArrowRight
} from 'lucide-react'
import { Card, Spinner } from '../components/ui'

interface Stats {
  recepciones_pendientes: number
  pedidos_pendientes: number
  preparaciones_activas: number
  despachos_hoy: number
  tareas_pendientes: number
}

const quickLinks = [
  {
    title: 'Estadísticas del día',
    desc: 'Dashboard con pickeos, unidades preparadas y más',
    icon: BarChart2,
    path: '/reportes/estadisticas',
    color: 'blue'
  },
  {
    title: 'Pedidos',
    desc: 'Crear, editar y descargar pedidos',
    icon: ClipboardList,
    path: '/preparacion/pedidos',
    color: 'green'
  },
  {
    title: 'Preparaciones',
    desc: 'Gestiona las preparaciones activas',
    icon: PackageCheck,
    path: '/preparacion/preparaciones',
    color: 'yellow'
  },
  {
    title: 'Tareas',
    desc: 'Ver y gestionar tareas del depósito',
    icon: Activity,
    path: '/deposito/tareas',
    color: 'orange'
  },
  {
    title: 'Despachos',
    desc: 'Configura y crea despachos',
    icon: Truck,
    path: '/despacho/despachos',
    color: 'purple'
  },
  {
    title: 'Deposito',
    desc: 'Areas, ubicaciones y movimientos',
    icon: Warehouse,
    path: '/deposito/areas',
    color: 'teal'
  },
]

const colorMap: Record<string, string> = {
  blue: 'bg-blue-900/30 text-blue-400 border-blue-700/30',
  green: 'bg-green-900/30 text-green-400 border-green-700/30',
  yellow: 'bg-yellow-900/30 text-yellow-400 border-yellow-700/30',
  orange: 'bg-orange-900/30 text-orange-400 border-orange-700/30',
  purple: 'bg-purple-900/30 text-purple-400 border-purple-700/30',
  teal: 'bg-teal-900/30 text-teal-400 border-teal-700/30',
}

export default function Dashboard() {
  const { profile } = useAuth()
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      if (!profile?.deposito_id) { setLoading(false); return }
      const did = profile.deposito_id

      const [rec, ped, prep, des, tar] = await Promise.all([
        supabase.from('recepciones').select('id', { count: 'exact', head: true })
          .eq('deposito_id', did).in('estado', ['PendienteArribo', 'EnRecepcion']),
        supabase.from('pedidos').select('id', { count: 'exact', head: true })
          .eq('deposito_id', did).eq('estado', 'Pendiente'),
        supabase.from('preparaciones').select('id', { count: 'exact', head: true })
          .eq('deposito_id', did).in('estado', ['Pendiente', 'EnProceso']),
        supabase.from('despachos').select('id', { count: 'exact', head: true })
          .eq('deposito_id', did).gte('fecha', new Date().toISOString().split('T')[0]),
        supabase.from('tareas').select('id', { count: 'exact', head: true })
          .eq('deposito_id', did).eq('estado', 'Pendiente'),
      ])

      setStats({
        recepciones_pendientes: rec.count ?? 0,
        pedidos_pendientes: ped.count ?? 0,
        preparaciones_activas: prep.count ?? 0,
        despachos_hoy: des.count ?? 0,
        tareas_pendientes: tar.count ?? 0,
      })
      setLoading(false)
    }
    load()
  }, [profile])

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">
          Bienvenido{profile?.nombre ? `, ${profile.nombre}` : ''}
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          {profile?.deposito_id ? 'Depósito activo' : 'Sin depósito asignado'}
        </p>
      </div>

      {loading ? <Spinner /> : (
        <>
          {/* Stats row */}
          {stats && (
            <div className="grid grid-cols-5 gap-4 mb-8">
              {[
                { label: 'Recepciones pendientes', val: stats.recepciones_pendientes, color: 'blue' },
                { label: 'Pedidos pendientes', val: stats.pedidos_pendientes, color: 'yellow' },
                { label: 'Preparaciones activas', val: stats.preparaciones_activas, color: 'green' },
                { label: 'Despachos hoy', val: stats.despachos_hoy, color: 'purple' },
                { label: 'Tareas pendientes', val: stats.tareas_pendientes, color: 'orange' },
              ].map(s => (
                <Card key={s.label} className="p-4">
                  <p className="text-xs text-gray-500 mb-1">{s.label}</p>
                  <p className="text-3xl font-bold text-white font-mono">{s.val}</p>
                </Card>
              ))}
            </div>
          )}

          {/* Quick links grid */}
          <div className="grid grid-cols-3 gap-4">
            {quickLinks.map(item => (
              <Link key={item.path} to={item.path}>
                <Card className={`p-5 border hover:border-opacity-60 transition-all hover:translate-y-[-1px] cursor-pointer ${colorMap[item.color]}`}>
                  <div className="flex items-start justify-between mb-3">
                    <item.icon className="w-6 h-6" />
                    <ArrowRight className="w-4 h-4 opacity-50" />
                  </div>
                  <h3 className="font-semibold text-white mb-1">{item.title}</h3>
                  <p className="text-xs opacity-70">{item.desc}</p>
                </Card>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
