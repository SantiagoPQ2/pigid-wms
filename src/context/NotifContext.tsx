import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { supabase } from '../lib/supabase'

interface Notificacion {
  id: string
  tipo: string
  titulo: string
  mensaje: string | null
  leida: boolean
  link: string | null
  created_at: string
}

interface NotifContextType {
  notificaciones: Notificacion[]
  noLeidas: number
  marcarLeida: (id: string) => void
  marcarTodasLeidas: () => void
  loading: boolean
}

const NotifContext = createContext<NotifContextType>({
  notificaciones: [], noLeidas: 0, marcarLeida: () => {}, marcarTodasLeidas: () => {}, loading: false
})

export function NotifProvider({ children }: { children: ReactNode }) {
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchNotificaciones()

    const channel = supabase
      .channel('notificaciones-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notificaciones' }, payload => {
        setNotificaciones(prev => [payload.new as Notificacion, ...prev])
      })
      .subscribe()

    return () => { channel.unsubscribe() }
  }, [])

  async function fetchNotificaciones() {
    const { data } = await supabase
      .from('notificaciones')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
    setNotificaciones(data || [])
    setLoading(false)
  }

  async function marcarLeida(id: string) {
    await supabase.from('notificaciones').update({ leida: true }).eq('id', id)
    setNotificaciones(prev => prev.map(n => n.id === id ? { ...n, leida: true } : n))
  }

  async function marcarTodasLeidas() {
    await supabase.from('notificaciones').update({ leida: true }).eq('leida', false)
    setNotificaciones(prev => prev.map(n => ({ ...n, leida: true })))
  }

  const noLeidas = notificaciones.filter(n => !n.leida).length

  return (
    <NotifContext.Provider value={{ notificaciones, noLeidas, marcarLeida, marcarTodasLeidas, loading }}>
      {children}
    </NotifContext.Provider>
  )
}

export const useNotif = () => useContext(NotifContext)
