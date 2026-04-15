import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNotif } from '../context/NotifContext'

const TIPO_ICON: Record<string, string> = {
  stock: '📦',
  reposicion: '🔄',
  tarea: '📋',
  recepcion: '📥',
  despacho: '🚚',
  alerta: '⚠️',
  info: 'ℹ️',
}

const TIPO_COLOR: Record<string, string> = {
  stock: 'bg-yellow-500',
  reposicion: 'bg-orange-500',
  tarea: 'bg-blue-500',
  recepcion: 'bg-cyan-500',
  despacho: 'bg-green-500',
  alerta: 'bg-red-500',
  info: 'bg-dark-500',
}

function tiempoRelativo(fecha: string) {
  const diff = Date.now() - new Date(fecha).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'ahora'
  if (min < 60) return `${min}m`
  const hs = Math.floor(min / 60)
  if (hs < 24) return `${hs}h`
  return new Date(fecha).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
}

export default function NotifPanel() {
  const { notificaciones, noLeidas, marcarLeida, marcarTodasLeidas } = useNotif()
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleNotifClick(n: { id: string; leida: boolean; link: string | null }) {
    if (!n.leida) marcarLeida(n.id)
    if (n.link) { navigate(n.link); setOpen(false) }
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen(o => !o)}
        className="relative p-2 rounded-lg text-dark-400 hover:text-white hover:bg-dark-700 transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {noLeidas > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center leading-none">
            {noLeidas > 9 ? '9+' : noLeidas}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-80 bg-dark-800 border border-dark-700 rounded-xl shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-dark-700">
            <span className="text-white font-semibold text-sm">Notificaciones</span>
            <div className="flex items-center gap-2">
              {noLeidas > 0 && (
                <button onClick={marcarTodasLeidas} className="text-xs text-primary-400 hover:text-primary-300 transition-colors">
                  Marcar todas leídas
                </button>
              )}
              <span className="text-dark-500 text-xs">{noLeidas} sin leer</span>
            </div>
          </div>

          {/* Lista */}
          <div className="max-h-96 overflow-y-auto">
            {notificaciones.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-2xl mb-2">🔔</p>
                <p className="text-dark-400 text-sm">Sin notificaciones</p>
              </div>
            ) : notificaciones.map(n => (
              <button
                key={n.id}
                onClick={() => handleNotifClick(n)}
                className={`w-full text-left px-4 py-3 border-b border-dark-700/50 last:border-0 hover:bg-dark-700/50 transition-colors flex items-start gap-3 ${n.leida ? 'opacity-50' : ''}`}
              >
                <div className={`w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0 ${n.leida ? 'bg-dark-600' : TIPO_COLOR[n.tipo] || 'bg-primary-500'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-xs">{TIPO_ICON[n.tipo] || '🔔'}</span>
                    <span className="text-white text-sm font-medium truncate">{n.titulo}</span>
                  </div>
                  {n.mensaje && <p className="text-dark-400 text-xs leading-relaxed line-clamp-2">{n.mensaje}</p>}
                </div>
                <span className="text-dark-600 text-xs flex-shrink-0">{tiempoRelativo(n.created_at)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
