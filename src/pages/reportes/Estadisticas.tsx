import { useState, useEffect } from 'react'
import Layout from '../../components/Layout'
import { supabase } from '../../lib/supabase'

interface DayStat { label: string; recepciones: number; preparaciones: number; despachos: number }
interface HourStat { hora: string; tareas: number }

export default function Estadisticas() {
  const [loading, setLoading] = useState(true)
  const [periodo, setPeriodo] = useState<'hoy' | '7d' | '30d'>('7d')
  const [stats, setStats] = useState({
    recepciones: 0, preparaciones: 0, despachos: 0, ajustes: 0,
    unidadesRecibidas: 0, unidadesPreparadas: 0, unidadesDespachadas: 0,
    tareasCompletadas: 0, tareasPendientes: 0,
  })
  const [porDia, setPorDia] = useState<DayStat[]>([])
  const [porHora, setPorHora] = useState<HourStat[]>([])

  useEffect(() => { fetchStats() }, [periodo])

  async function fetchStats() {
    setLoading(true)
    const dias = periodo === 'hoy' ? 1 : periodo === '7d' ? 7 : 30
    const desde = new Date(); desde.setDate(desde.getDate() - dias + 1); desde.setHours(0,0,0,0)
    const desdeISO = desde.toISOString()

    const [{ count: cRec }, { count: cPrep }, { count: cDesp }, { count: cAj }, { count: cTarComp }, { count: cTarPend }] = await Promise.all([
      supabase.from('documentos_recepcion').select('id', { count: 'exact', head: true }).gte('created_at', desdeISO),
      supabase.from('preparaciones').select('id', { count: 'exact', head: true }).gte('created_at', desdeISO),
      supabase.from('despachos').select('id', { count: 'exact', head: true }).gte('created_at', desdeISO),
      supabase.from('ajustes_stock').select('id', { count: 'exact', head: true }).gte('created_at', desdeISO),
      supabase.from('tareas').select('id', { count: 'exact', head: true }).eq('estado', 'completada').gte('created_at', desdeISO),
      supabase.from('tareas').select('id', { count: 'exact', head: true }).eq('estado', 'pendiente'),
    ])

    setStats({
      recepciones: cRec || 0, preparaciones: cPrep || 0, despachos: cDesp || 0, ajustes: cAj || 0,
      unidadesRecibidas: 0, unidadesPreparadas: 0, unidadesDespachadas: 0,
      tareasCompletadas: cTarComp || 0, tareasPendientes: cTarPend || 0,
    })

    // Datos por día (últimos N días)
    const days: DayStat[] = []
    for (let i = dias - 1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0,0,0,0)
      const fin = new Date(d); fin.setHours(23,59,59,999)
      const label = dias === 1 ? 'Hoy' : d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' })
      const [{ count: r }, { count: p }, { count: dp }] = await Promise.all([
        supabase.from('documentos_recepcion').select('id', { count: 'exact', head: true }).gte('created_at', d.toISOString()).lte('created_at', fin.toISOString()),
        supabase.from('preparaciones').select('id', { count: 'exact', head: true }).gte('created_at', d.toISOString()).lte('created_at', fin.toISOString()),
        supabase.from('despachos').select('id', { count: 'exact', head: true }).gte('created_at', d.toISOString()).lte('created_at', fin.toISOString()),
      ])
      days.push({ label, recepciones: r || 0, preparaciones: p || 0, despachos: dp || 0 })
    }
    setPorDia(days)

    // Por hora del día de hoy
    const horas: HourStat[] = []
    const hoy = new Date(); hoy.setHours(0,0,0,0)
    for (let h = 6; h <= 22; h++) {
      const ini = new Date(hoy); ini.setHours(h); const fin2 = new Date(hoy); fin2.setHours(h, 59, 59)
      const { count } = await supabase.from('tareas').select('id', { count: 'exact', head: true })
        .gte('created_at', ini.toISOString()).lte('created_at', fin2.toISOString())
      horas.push({ hora: h + 'hs', tareas: count || 0 })
    }
    setPorHora(horas)

    setLoading(false)
  }

  // ── Mini chart bar helpers ────────────────────────────────────────────
  const maxDia = Math.max(...porDia.map(d => Math.max(d.recepciones, d.preparaciones, d.despachos)), 1)
  const maxHora = Math.max(...porHora.map(h => h.tareas), 1)

  const kpis = [
    { label: 'Recepciones', value: stats.recepciones, color: 'text-blue-400', bg: 'bg-blue-500' },
    { label: 'Preparaciones', value: stats.preparaciones, color: 'text-purple-400', bg: 'bg-purple-500' },
    { label: 'Despachos', value: stats.despachos, color: 'text-green-400', bg: 'bg-green-500' },
    { label: 'Ajustes', value: stats.ajustes, color: 'text-yellow-400', bg: 'bg-yellow-500' },
  ]

  return (
    <Layout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Estadísticas</h1>
            <p className="text-dark-400 text-sm mt-1">Actividad operativa del depósito</p>
          </div>
          <div className="flex gap-1 bg-dark-800 rounded-lg p-1">
            {(['hoy', '7d', '30d'] as const).map(p => (
              <button key={p} onClick={() => setPeriodo(p)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${periodo === p ? 'bg-primary-600 text-white' : 'text-dark-400 hover:text-white'}`}>
                {p === 'hoy' ? 'Hoy' : p === '7d' ? '7 días' : '30 días'}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-24"><div className="w-8 h-8 border-2 border-dark-500 border-t-primary-500 rounded-full animate-spin" /></div>
        ) : (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {kpis.map(k => (
                <div key={k.label} className="card rounded-xl p-4">
                  <div className={`w-8 h-1 rounded-full ${k.bg} mb-3`} />
                  <p className={`text-3xl font-bold ${k.color}`}>{k.value}</p>
                  <p className="text-dark-400 text-sm mt-1">{k.label}</p>
                </div>
              ))}
            </div>

            {/* Tareas */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="card rounded-xl p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center text-xl">✓</div>
                <div>
                  <p className="text-3xl font-bold text-green-400">{stats.tareasCompletadas}</p>
                  <p className="text-dark-400 text-sm">Tareas completadas</p>
                </div>
              </div>
              <div className="card rounded-xl p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center text-xl">⏳</div>
                <div>
                  <p className="text-3xl font-bold text-yellow-400">{stats.tareasPendientes}</p>
                  <p className="text-dark-400 text-sm">Tareas pendientes</p>
                </div>
              </div>
            </div>

            {/* Gráfico por día */}
            <div className="card rounded-xl p-6 mb-6">
              <h2 className="text-white font-semibold mb-1">Actividad por día</h2>
              <p className="text-dark-400 text-xs mb-5">Recepciones · Preparaciones · Despachos</p>
              <div className="flex items-end gap-2 h-40 overflow-x-auto pb-2">
                {porDia.map((d, i) => (
                  <div key={i} className="flex flex-col items-center gap-1 flex-shrink-0" style={{ minWidth: 48 }}>
                    <div className="flex items-end gap-0.5 h-32">
                      {[
                        { val: d.recepciones, color: 'bg-blue-500' },
                        { val: d.preparaciones, color: 'bg-purple-500' },
                        { val: d.despachos, color: 'bg-green-500' },
                      ].map((b, j) => (
                        <div key={j} className="w-3 rounded-t flex-shrink-0 transition-all group relative"
                          style={{ height: `${Math.max((b.val / maxDia) * 128, b.val > 0 ? 4 : 0)}px`, backgroundColor: 'transparent' }}>
                          <div className={`w-full h-full rounded-t ${b.color} opacity-80 hover:opacity-100 transition-opacity`}
                            style={{ height: '100%' }} title={b.val.toString()} />
                        </div>
                      ))}
                    </div>
                    <span className="text-dark-500 text-xs whitespace-nowrap">{d.label}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-4 mt-3">
                {[['bg-blue-500','Recepciones'],['bg-purple-500','Preparaciones'],['bg-green-500','Despachos']].map(([c,l]) => (
                  <div key={l} className="flex items-center gap-1.5">
                    <div className={`w-3 h-3 rounded-sm ${c}`} />
                    <span className="text-dark-400 text-xs">{l}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Gráfico por hora */}
            <div className="card rounded-xl p-6">
              <h2 className="text-white font-semibold mb-1">Tareas por hora — hoy</h2>
              <p className="text-dark-400 text-xs mb-5">Distribución horaria de actividad</p>
              <div className="flex items-end gap-1.5 h-32 overflow-x-auto">
                {porHora.map((h, i) => (
                  <div key={i} className="flex flex-col items-center gap-1 flex-shrink-0" style={{ minWidth: 32 }}>
                    <div className="w-full rounded-t bg-primary-500/70 hover:bg-primary-500 transition-colors"
                      style={{ height: `${Math.max((h.tareas / maxHora) * 112, h.tareas > 0 ? 4 : 0)}px` }}
                      title={h.tareas + ' tareas'} />
                    <span className="text-dark-600 text-xs">{h.hora}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  )
}
