import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/layout/Layout'
import Modal from '../../components/ui/Modal'
import {
  PageHeader, Card, Button, Table, Tr, Td,
  Badge, Input, Select, Spinner
} from '../../components/ui'
import { Plus, Edit2, Trash2, Eye, Printer, MapPin } from 'lucide-react'

export default function Areas() {
  const { profile } = useAuth()
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editModal, setEditModal] = useState(false)
  const [selected, setSelected] = useState<any>(null)

  const [form, setForm] = useState({
    nombre: '', abreviacion: '', tipo: 'Almacen',
    estado_tarea_defecto: 'Pendiente', activo: true
  })

  const fetchData = async () => {
    if (!profile?.deposito_id) return
    setLoading(true)
    const { data } = await supabase
      .from('areas')
      .select(`*, ubicaciones(id)`)
      .eq('deposito_id', profile.deposito_id)
      .order('nombre')
    setRows(data ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [profile])

  const openEdit = (area?: any) => {
    if (area) {
      setSelected(area)
      setForm({ nombre: area.nombre, abreviacion: area.abreviacion, tipo: area.tipo,
        estado_tarea_defecto: area.estado_tarea_defecto, activo: area.activo })
    } else {
      setSelected(null)
      setForm({ nombre: '', abreviacion: '', tipo: 'Almacen', estado_tarea_defecto: 'Pendiente', activo: true })
    }
    setEditModal(true)
  }

  const handleSave = async () => {
    if (!profile?.deposito_id) return
    if (selected) {
      await supabase.from('areas').update(form).eq('id', selected.id)
    } else {
      await supabase.from('areas').insert({ ...form, deposito_id: profile.deposito_id })
    }
    setEditModal(false)
    fetchData()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta área?')) return
    await supabase.from('areas').delete().eq('id', id)
    fetchData()
  }

  const tipoColor: Record<string, string> = {
    Almacen: 'blue', Recepcion: 'yellow', Picking: 'green',
    OverFlow: 'orange', Despacho: 'purple', Preparacion: 'teal'
  }

  return (
    <Layout>
      <PageHeader title="Areas">
        <Button onClick={() => openEdit()} size="sm">
          <Plus className="w-4 h-4" /> Nueva Area
        </Button>
      </PageHeader>

      <Card>
        <div className="p-4 border-b border-dark-600">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Areas</p>
        </div>

        {loading ? <Spinner /> : (
          <Table headers={['#', 'Nombre del Area', 'Abreviación', 'Tipo de Area', 'Estado tarea al crearse', 'Ubicaciones', '% Ocupación', 'Activo', 'Acciones']}>
            {rows.map((row, i) => (
              <Tr key={row.id}>
                <Td className="text-gray-500 text-xs font-mono">{i + 1}</Td>
                <Td className="font-medium text-white">{row.nombre}</Td>
                <Td className="font-mono text-xs">{row.abreviacion}</Td>
                <Td>
                  <Badge label={row.tipo} variant={tipoColor[row.tipo] as any ?? 'gray'} />
                </Td>
                <Td>
                  <span className={`text-sm ${row.estado_tarea_defecto === 'Pendiente' ? 'text-yellow-400' : 'text-green-400'}`}>
                    {row.estado_tarea_defecto}
                  </span>
                </Td>
                <Td className="font-mono">{row.ubicaciones?.length ?? 0}</Td>
                <Td>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-dark-600 rounded-full overflow-hidden">
                      <div className="h-full bg-primary-500 rounded-full" style={{ width: '1%' }} />
                    </div>
                    <span className="text-xs text-gray-500">1%</span>
                  </div>
                </Td>
                <Td>
                  <span className={row.activo ? 'text-green-400 text-sm' : 'text-red-400 text-sm'}>
                    {row.activo ? 'Si' : 'No'}
                  </span>
                </Td>
                <Td>
                  <div className="flex items-center gap-1">
                    <button title="Ubicaciones" className="text-green-400 hover:text-green-300 p-1"><MapPin className="w-3.5 h-3.5" /></button>
                    <button title="Ver" className="text-blue-400 hover:text-blue-300 p-1"><Eye className="w-3.5 h-3.5" /></button>
                    <button title="Editar" onClick={() => openEdit(row)} className="text-yellow-400 hover:text-yellow-300 p-1"><Edit2 className="w-3.5 h-3.5" /></button>
                    <button title="Imprimir" className="text-gray-400 hover:text-gray-300 p-1"><Printer className="w-3.5 h-3.5" /></button>
                    <button title="Eliminar" onClick={() => handleDelete(row.id)} className="text-red-400 hover:text-red-300 p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </Td>
              </Tr>
            ))}
            {rows.length === 0 && (
              <Tr><Td className="text-center text-gray-500 py-8"><span>Sin áreas cargadas</span></Td></Tr>
            )}
          </Table>
        )}
      </Card>

      {/* Modal crear/editar */}
      <Modal open={editModal} onClose={() => setEditModal(false)}
        title={selected ? 'Editar Area' : 'Nueva Area'} size="md">
        <div className="space-y-4">
          <Input label="Nombre del área" value={form.nombre}
            onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
            placeholder="Ej: ALMACEN SECOS" />
          <Input label="Abreviación" value={form.abreviacion}
            onChange={e => setForm(f => ({ ...f, abreviacion: e.target.value }))}
            placeholder="Ej: ALS" />
          <Select label="Tipo de área" value={form.tipo}
            onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
            <option value="Almacen">Almacen</option>
            <option value="Recepcion">Recepcion</option>
            <option value="Picking">Picking</option>
            <option value="OverFlow">OverFlow</option>
            <option value="Despacho">Despacho</option>
            <option value="Preparacion">Preparacion</option>
          </Select>
          <Select label="Estado de tareas al crearse" value={form.estado_tarea_defecto}
            onChange={e => setForm(f => ({ ...f, estado_tarea_defecto: e.target.value }))}>
            <option value="Pendiente">Pendiente</option>
            <option value="EnProceso">En Proceso</option>
            <option value="Finalizado">Finalizado</option>
          </Select>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="activo" checked={form.activo}
              onChange={e => setForm(f => ({ ...f, activo: e.target.checked }))}
              className="rounded border-dark-500 bg-dark-700 text-primary-500" />
            <label htmlFor="activo" className="text-sm text-gray-400">Activo</label>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setEditModal(false)}>Cancelar</Button>
            <Button onClick={handleSave}>{selected ? 'Actualizar' : 'Guardar'}</Button>
          </div>
        </div>
      </Modal>
    </Layout>
  )
}
