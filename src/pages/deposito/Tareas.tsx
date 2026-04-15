// Tareas del depósito
import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/layout/Layout'
import { PageHeader, Card, Button, Table, Tr, Td, EstadoBadge, Select, Spinner } from '../../components/ui'
import { RefreshCw } from 'lucide-react'
import { format } from 'date-fns'

export default function Tareas() {
  const { profile } = useAuth()
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroEstado, setFiltroEstado] = useState('Pendiente')
  const [filtroTipo, setFiltroTipo] = useState('')

  const fetchData = async () => {
    if (!profile?.deposito_id) return
    setLoading(true)
    let q = supabase.from('tareas')
      .select('*')
      .eq('deposito_id', profile.deposito_id)
      .order('prioridad', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(100)

    if (filtroEstado) q = q.eq('estado', filtroEstado)
    if (filtroTipo) q = q.eq('tipo', filtroTipo)

    const { data } = await q
    setRows(data ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [profile])

  return (
    <Layout>
      <PageHeader title="Tareas">
        <Button onClick={fetchData} variant="secondary" size="sm"><RefreshCw className="w-4 h-4" /></Button>
      </PageHeader>
      <Card>
        <div className="p-4 border-b border-dark-600 flex gap-3 items-end flex-wrap">
          <div className="w-44">
            <Select label="Estado" value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
              <option value="">Todos</option>
              <option value="Pendiente">Pendiente</option>
              <option value="EnProceso">En Proceso</option>
              <option value="Finalizado">Finalizado</option>
              <option value="Suspendido">Suspendido</option>
              <option value="Anulado">Anulado</option>
            </Select>
          </div>
          <div className="w-44">
            <Select label="Tipo" value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
              <option value="">Todos</option>
              <option value="Picking">Picking</option>
              <option value="Reposicion">Reposición</option>
              <option value="Movimiento">Movimiento</option>
              <option value="Ajuste">Ajuste</option>
              <option value="Recepcion">Recepción</option>
              <option value="Despacho">Despacho</option>
            </Select>
          </div>
          <Button onClick={fetchData} size="sm">Buscar</Button>
        </div>
        {loading ? <Spinner /> : (
          <Table headers={['#', 'Tipo', 'Estado', 'Área', 'Prioridad', 'Usuario asignado', 'Fecha', 'Acciones']}>
            {rows.map(row => (
              <Tr key={row.id}>
                <Td className="font-mono text-xs text-primary-400">{row.id.slice(0, 8)}</Td>
                <Td>{row.tipo}</Td>
                <Td><EstadoBadge estado={row.estado} /></Td>
                <Td className="text-xs text-gray-500">{row.area_id?.slice(0, 8) ?? '—'}</Td>
                <Td>{row.prioridad}</Td>
                <Td className="text-xs">{row.usuario_asignado_id?.slice(0, 8) ?? 'Sin asignar'}</Td>
                <Td className="text-xs text-gray-500">{format(new Date(row.created_at), 'dd/MM HH:mm')}</Td>
                <Td>
                  <div className="flex gap-2">
                    <button className="text-xs text-yellow-400">Suspender</button>
                    <button className="text-xs text-red-400">Anular</button>
                  </div>
                </Td>
              </Tr>
            ))}
            {rows.length === 0 && (
              <Tr><Td className="text-center text-gray-500 py-8"><span>Sin tareas</span></Td></Tr>
            )}
          </Table>
        )}
      </Card>
    </Layout>
  )
}
