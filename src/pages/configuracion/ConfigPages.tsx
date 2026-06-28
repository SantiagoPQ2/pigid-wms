import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/layout/Layout'
import Modal from '../../components/ui/Modal'
import {
  PageHeader, Card, Button, Table, Tr, Td,
  Input, Select, Spinner
} from '../../components/ui'
import { Plus, Edit2, Trash2 } from 'lucide-react'

// ─── ARTÍCULOS ───────────────────────────────────────────────
export function Articulos() {
  const { profile } = useAuth()
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [selected, setSelected] = useState<any>(null)
  const [form, setForm] = useState({ codigo: '', nombre: '', descripcion: '', unidad_medida: 'UN', activo: true })

  const fetchData = async () => {
    if (!profile?.negocio_id) return
    setLoading(true)
    const { data } = await supabase.from('articulos').select('*')
      .eq('negocio_id', profile.negocio_id).order('nombre').limit(200)
    setRows(data ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [profile])

  const openEdit = (row?: any) => {
    setSelected(row ?? null)
    setForm(row ? { codigo: row.codigo, nombre: row.nombre, descripcion: row.descripcion ?? '',
      unidad_medida: row.unidad_medida, activo: row.activo } : { codigo: '', nombre: '', descripcion: '', unidad_medida: 'UN', activo: true })
    setModal(true)
  }

  const handleSave = async () => {
    if (!profile?.negocio_id) return
    if (selected) await supabase.from('articulos').update(form).eq('id', selected.id)
    else await supabase.from('articulos').insert({ ...form, negocio_id: profile.negocio_id })
    setModal(false); fetchData()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar?')) return
    await supabase.from('articulos').delete().eq('id', id)
    fetchData()
  }

  return (
    <Layout>
      <PageHeader title="Artículos">
        <Button onClick={() => openEdit()} size="sm"><Plus className="w-4 h-4" /> Nuevo</Button>
      </PageHeader>
      <Card>
        {loading ? <Spinner /> : (
          <Table headers={['Código', 'Nombre', 'Descripción', 'Unidad', 'Activo', 'Acciones']}>
            {rows.map(row => (
              <Tr key={row.id}>
                <Td className="font-mono text-xs">{row.codigo}</Td>
                <Td className="font-medium text-white">{row.nombre}</Td>
                <Td className="text-xs text-gray-500 max-w-xs truncate">{row.descripcion ?? '—'}</Td>
                <Td className="text-xs">{row.unidad_medida}</Td>
                <Td><span className={row.activo ? 'text-green-400' : 'text-red-400'}>{row.activo ? 'Si' : 'No'}</span></Td>
                <Td>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(row)} className="text-yellow-400 p-1"><Edit2 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleDelete(row.id)} className="text-red-400 p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </Td>
              </Tr>
            ))}
            {rows.length === 0 && <Tr><Td className="text-center py-8 text-gray-500"><span>Sin artículos</span></Td></Tr>}
          </Table>
        )}
      </Card>
      <Modal open={modal} onClose={() => setModal(false)} title={selected ? 'Editar Artículo' : 'Nuevo Artículo'} size="md">
        <div className="space-y-4">
          <Input label="Código *" value={form.codigo} onChange={e => setForm(f => ({ ...f, codigo: e.target.value }))} />
          <Input label="Nombre *" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
          <Input label="Descripción" value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} />
          <Select label="Unidad de medida" value={form.unidad_medida} onChange={e => setForm(f => ({ ...f, unidad_medida: e.target.value }))}>
            <option value="UN">Unidad</option>
            <option value="KG">Kilogramo</option>
            <option value="LT">Litro</option>
            <option value="MT">Metro</option>
          </Select>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setModal(false)}>Cancelar</Button>
            <Button onClick={handleSave}>{selected ? 'Actualizar' : 'Guardar'}</Button>
          </div>
        </div>
      </Modal>
    </Layout>
  )
}

// ─── CLIENTES ────────────────────────────────────────────────
export function Clientes() {
  const { profile } = useAuth()
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [selected, setSelected] = useState<any>(null)
  const [form, setForm] = useState({ nombre: '', cuit: '', email: '', telefono: '', direccion: '', region: '', activo: true })

  const fetchData = async () => {
    if (!profile?.negocio_id) return
    setLoading(true)
    const { data } = await supabase.from('clientes').select('*').eq('negocio_id', profile.negocio_id).order('nombre').limit(200)
    setRows(data ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [profile])

  const openEdit = (row?: any) => {
    setSelected(row ?? null)
    setForm(row ? { nombre: row.nombre, cuit: row.cuit ?? '', email: row.email ?? '',
      telefono: row.telefono ?? '', direccion: row.direccion ?? '', region: row.region ?? '', activo: row.activo }
      : { nombre: '', cuit: '', email: '', telefono: '', direccion: '', region: '', activo: true })
    setModal(true)
  }

  const handleSave = async () => {
    if (!profile?.negocio_id) return
    if (selected) await supabase.from('clientes').update(form).eq('id', selected.id)
    else await supabase.from('clientes').insert({ ...form, negocio_id: profile.negocio_id })
    setModal(false); fetchData()
  }

  return (
    <Layout>
      <PageHeader title="Clientes">
        <Button onClick={() => openEdit()} size="sm"><Plus className="w-4 h-4" /> Nuevo</Button>
      </PageHeader>
      <Card>
        {loading ? <Spinner /> : (
          <Table headers={['Nombre', 'CUIT', 'Email', 'Teléfono', 'Dirección', 'Región', 'Activo', 'Acciones']}>
            {rows.map(row => (
              <Tr key={row.id}>
                <Td className="font-medium text-white">{row.nombre}</Td>
                <Td className="font-mono text-xs">{row.cuit ?? '—'}</Td>
                <Td className="text-xs">{row.email ?? '—'}</Td>
                <Td className="text-xs">{row.telefono ?? '—'}</Td>
                <Td className="text-xs text-gray-500">{row.direccion ?? '—'}</Td>
                <Td className="text-xs">{row.region ?? '—'}</Td>
                <Td><span className={row.activo ? 'text-green-400' : 'text-red-400'}>{row.activo ? 'Si' : 'No'}</span></Td>
                <Td>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(row)} className="text-yellow-400 p-1"><Edit2 className="w-3.5 h-3.5" /></button>
                    <button className="text-red-400 p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </Td>
              </Tr>
            ))}
            {rows.length === 0 && <Tr><Td className="text-center py-8 text-gray-500"><span>Sin clientes</span></Td></Tr>}
          </Table>
        )}
      </Card>
      <Modal open={modal} onClose={() => setModal(false)} title={selected ? 'Editar Cliente' : 'Nuevo Cliente'} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Nombre *" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
            <Input label="CUIT" value={form.cuit} onChange={e => setForm(f => ({ ...f, cuit: e.target.value }))} />
            <Input label="Email" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            <Input label="Teléfono" value={form.telefono} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} />
            <Input label="Dirección" value={form.direccion} onChange={e => setForm(f => ({ ...f, direccion: e.target.value }))} />
            <Input label="Región" value={form.region} onChange={e => setForm(f => ({ ...f, region: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setModal(false)}>Cancelar</Button>
            <Button onClick={handleSave}>{selected ? 'Actualizar' : 'Guardar'}</Button>
          </div>
        </div>
      </Modal>
    </Layout>
  )
}

// ─── PROVEEDORES ──────────────────────────────────────────────
export function Proveedores() {
  const { profile } = useAuth()
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [selected, setSelected] = useState<any>(null)
  const [form, setForm] = useState({ nombre: '', cuit: '', email: '', telefono: '', direccion: '', activo: true })

  const fetchData = async () => {
    if (!profile?.negocio_id) return
    setLoading(true)
    const { data } = await supabase.from('proveedores').select('*').eq('negocio_id', profile.negocio_id).order('nombre').limit(200)
    setRows(data ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [profile])

  const openEdit = (row?: any) => {
    setSelected(row ?? null)
    setForm(row ? { nombre: row.nombre, cuit: row.cuit ?? '', email: row.email ?? '',
      telefono: row.telefono ?? '', direccion: row.direccion ?? '', activo: row.activo }
      : { nombre: '', cuit: '', email: '', telefono: '', direccion: '', activo: true })
    setModal(true)
  }

  const handleSave = async () => {
    if (!profile?.negocio_id) return
    if (selected) await supabase.from('proveedores').update(form).eq('id', selected.id)
    else await supabase.from('proveedores').insert({ ...form, negocio_id: profile.negocio_id })
    setModal(false); fetchData()
  }

  return (
    <Layout>
      <PageHeader title="Proveedores">
        <Button onClick={() => openEdit()} size="sm"><Plus className="w-4 h-4" /> Nuevo</Button>
      </PageHeader>
      <Card>
        {loading ? <Spinner /> : (
          <Table headers={['Nombre', 'CUIT', 'Email', 'Teléfono', 'Activo', 'Acciones']}>
            {rows.map(row => (
              <Tr key={row.id}>
                <Td className="font-medium text-white">{row.nombre}</Td>
                <Td className="font-mono text-xs">{row.cuit ?? '—'}</Td>
                <Td className="text-xs">{row.email ?? '—'}</Td>
                <Td className="text-xs">{row.telefono ?? '—'}</Td>
                <Td><span className={row.activo ? 'text-green-400' : 'text-red-400'}>{row.activo ? 'Si' : 'No'}</span></Td>
                <Td>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(row)} className="text-yellow-400 p-1"><Edit2 className="w-3.5 h-3.5" /></button>
                    <button className="text-red-400 p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </Td>
              </Tr>
            ))}
            {rows.length === 0 && <Tr><Td className="text-center py-8 text-gray-500"><span>Sin proveedores</span></Td></Tr>}
          </Table>
        )}
      </Card>
      <Modal open={modal} onClose={() => setModal(false)} title={selected ? 'Editar Proveedor' : 'Nuevo Proveedor'} size="md">
        <div className="space-y-4">
          <Input label="Nombre *" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="CUIT" value={form.cuit} onChange={e => setForm(f => ({ ...f, cuit: e.target.value }))} />
            <Input label="Email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            <Input label="Teléfono" value={form.telefono} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} />
            <Input label="Dirección" value={form.direccion} onChange={e => setForm(f => ({ ...f, direccion: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setModal(false)}>Cancelar</Button>
            <Button onClick={handleSave}>{selected ? 'Actualizar' : 'Guardar'}</Button>
          </div>
        </div>
      </Modal>
    </Layout>
  )
}
