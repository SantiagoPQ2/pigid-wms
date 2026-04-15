import { useState, useEffect } from 'react'
import Layout from '../../components/Layout'
import { supabase } from '../../lib/supabase'

interface Documento {
  id: string
  numero: string
  proveedor_nombre: string
  fecha: string
  estado: string
}

interface ItemCiego {
  id: string
  articulo_id: string
  articulo_codigo: string
  articulo_nombre: string
  cantidad_esperada: number   // oculta al operario
  cantidad_recibida: number | null
  lote: string
  fecha_vencimiento: string
  diferencia?: number
}

type Etapa = 'seleccion' | 'conteo' | 'resultado'

export default function ControlCiego() {
  const [etapa, setEtapa] = useState<Etapa>('seleccion')
  const [documentos, setDocumentos] = useState<Documento[]>([])
  const [loading, setLoading] = useState(true)
  const [docSeleccionado, setDocSeleccionado] = useState<Documento | null>(null)
  const [items, setItems] = useState<ItemCiego[]>([])
  const [loadingItems, setLoadingItems] = useState(false)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => { fetchDocumentos() }, [])

  async function fetchDocumentos() {
    setLoading(true)
    const { data } = await supabase
      .from('documentos_recepcion')
      .select('id, numero, fecha, estado, proveedores(nombre)')
      .in('estado', ['pendiente', 'en_proceso'])
      .order('fecha', { ascending: false })
    setDocumentos((data || []).map((d: any) => ({ ...d, proveedor_nombre: d.proveedores?.nombre || '—' })))
    setLoading(false)
  }

  async function seleccionarDoc(doc: Documento) {
    setDocSeleccionado(doc)
    setLoadingItems(true)
    const { data } = await supabase
      .from('items_recepcion')
      .select('id, articulo_id, cantidad_esperada, lote, fecha_vencimiento, articulos(codigo, nombre)')
      .eq('documento_id', doc.id)
    setItems((data || []).map((i: any) => ({
      ...i,
      articulo_codigo: i.articulos?.codigo || '',
      articulo_nombre: i.articulos?.nombre || '',
      cantidad_recibida: null
    })))
    setLoadingItems(false)
    setEtapa('conteo')
  }

  function setCantidad(id: string, val: string) {
    const n = parseInt(val)
    setItems(prev => prev.map(i => i.id === id ? { ...i, cantidad_recibida: isNaN(n) ? null : n } : i))
  }

  function calcularResultados() {
    return items.map(i => ({
      ...i,
      diferencia: (i.cantidad_recibida ?? 0) - i.cantidad_esperada
    }))
  }

  function todoContado() {
    return items.every(i => i.cantidad_recibida !== null && i.cantidad_recibida >= 0)
  }

  async function confirmarConteo() {
    if (!todoContado() || !docSeleccionado) return
    setGuardando(true)
    const resultados = calcularResultados()

    // Actualizar items con cantidad recibida
    for (const item of resultados) {
      await supabase.from('items_recepcion').update({
        cantidad_recibida: item.cantidad_recibida,
        diferencia: item.diferencia
      }).eq('id', item.id)
    }

    // Actualizar estado del documento
    const hayDiferencias = resultados.some(r => r.diferencia !== 0)
    await supabase.from('documentos_recepcion').update({
      estado: hayDiferencias ? 'con_diferencias' : 'recibido'
    }).eq('id', docSeleccionado.id)

    setItems(resultados)
    setGuardando(false)
    setEtapa('resultado')
  }

  function reiniciar() {
    setEtapa('seleccion')
    setDocSeleccionado(null)
    setItems([])
    fetchDocumentos()
  }

  const resultados = calcularResultados()
  const itemsOK = resultados.filter(r => r.diferencia === 0).length
  const itemsFaltante = resultados.filter(r => (r.diferencia ?? 0) < 0).length
  const itemsSobrante = resultados.filter(r => (r.diferencia ?? 0) > 0).length

  return (
    <Layout>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          {etapa !== 'seleccion' && (
            <button onClick={reiniciar} className="text-dark-400 hover:text-white transition-colors">← Volver</button>
          )}
          <div>
            <h1 className="text-2xl font-bold text-white">Control Ciego</h1>
            <p className="text-dark-400 text-sm mt-1">Recepción sin cantidades esperadas visibles</p>
          </div>
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-2 mb-8">
          {(['seleccion', 'conteo', 'resultado'] as Etapa[]).map((e, i) => (
            <div key={e} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${etapa === e ? 'bg-primary-600 text-white' : i < ['seleccion','conteo','resultado'].indexOf(etapa) ? 'bg-green-600 text-white' : 'bg-dark-700 text-dark-400'}`}>
                {i < ['seleccion','conteo','resultado'].indexOf(etapa) ? '✓' : i + 1}
              </div>
              <span className={`text-sm ${etapa === e ? 'text-white font-medium' : 'text-dark-500'}`}>
                {e === 'seleccion' ? 'Documento' : e === 'conteo' ? 'Conteo' : 'Resultado'}
              </span>
              {i < 2 && <div className="w-8 h-px bg-dark-700 mx-1" />}
            </div>
          ))}
        </div>

        {/* ETAPA 1: Selección de documento */}
        {etapa === 'seleccion' && (
          <div>
            <h2 className="text-white font-semibold mb-4">Seleccionar documento a recibir</h2>
            {loading ? (
              <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-dark-500 border-t-primary-500 rounded-full animate-spin" /></div>
            ) : documentos.length === 0 ? (
              <div className="card rounded-xl p-8 text-center">
                <p className="text-dark-400">No hay documentos pendientes de recepción</p>
              </div>
            ) : (
              <div className="space-y-3">
                {documentos.map(doc => (
                  <button key={doc.id} onClick={() => seleccionarDoc(doc)}
                    className="card rounded-xl p-4 w-full text-left hover:border-primary-500/50 transition-colors group">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white font-semibold font-mono">{doc.numero}</p>
                        <p className="text-dark-400 text-sm mt-1">{doc.proveedor_nombre} · {new Date(doc.fecha).toLocaleDateString('es-AR')}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${doc.estado === 'en_proceso' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-blue-500/20 text-blue-400'}`}>
                          {doc.estado}
                        </span>
                        <span className="text-dark-500 group-hover:text-white transition-colors">→</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ETAPA 2: Conteo ciego */}
        {etapa === 'conteo' && (
          <div>
            <div className="card rounded-lg p-3 mb-4 flex items-center gap-3">
              <span className="text-primary-400 font-mono font-semibold">{docSeleccionado?.numero}</span>
              <span className="text-dark-400">·</span>
              <span className="text-dark-300">{docSeleccionado?.proveedor_nombre}</span>
              <span className="ml-auto text-dark-400 text-sm">{items.filter(i => i.cantidad_recibida !== null).length}/{items.length} contados</span>
            </div>

            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-4 py-3 mb-4 text-sm text-yellow-400">
              ⚠️ Modo Control Ciego — las cantidades esperadas no se muestran. Ingresá lo que realmente recibiste.
            </div>

            {loadingItems ? (
              <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-dark-500 border-t-primary-500 rounded-full animate-spin" /></div>
            ) : (
              <div className="space-y-2 mb-6">
                {items.map((item, idx) => (
                  <div key={item.id} className="card rounded-lg p-4 flex items-center gap-4">
                    <span className="text-dark-500 text-sm w-6">{idx + 1}</span>
                    <div className="flex-1">
                      <p className="text-white font-mono font-semibold">{item.articulo_codigo}</p>
                      <p className="text-dark-400 text-sm">{item.articulo_nombre}</p>
                      {item.lote && <p className="text-dark-500 text-xs mt-0.5">Lote: {item.lote}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-dark-400 text-sm">Cant. recibida:</label>
                      <input
                        type="number" min="0"
                        value={item.cantidad_recibida ?? ''}
                        onChange={e => setCantidad(item.id, e.target.value)}
                        className={`input-dark rounded-lg px-3 py-2 text-sm w-24 text-right font-mono ${item.cantidad_recibida !== null ? 'border-primary-500/50' : ''}`}
                        placeholder="0"
                        autoFocus={idx === 0}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end">
              <button onClick={confirmarConteo} disabled={!todoContado() || guardando}
                className="btn-primary px-6 py-2 rounded-lg font-medium disabled:opacity-40">
                {guardando ? 'Guardando...' : 'Confirmar Conteo →'}
              </button>
            </div>
          </div>
        )}

        {/* ETAPA 3: Resultado */}
        {etapa === 'resultado' && (
          <div>
            {/* Resumen */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="card rounded-xl p-4 border-green-500/20">
                <p className="text-dark-400 text-xs uppercase mb-1">Coincidencias</p>
                <p className="text-2xl font-bold text-green-400">{itemsOK}</p>
              </div>
              <div className="card rounded-xl p-4 border-red-500/20">
                <p className="text-dark-400 text-xs uppercase mb-1">Faltantes</p>
                <p className="text-2xl font-bold text-red-400">{itemsFaltante}</p>
              </div>
              <div className="card rounded-xl p-4 border-yellow-500/20">
                <p className="text-dark-400 text-xs uppercase mb-1">Sobrantes</p>
                <p className="text-2xl font-bold text-yellow-400">{itemsSobrante}</p>
              </div>
            </div>

            <div className="card rounded-xl overflow-hidden mb-6">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-dark-700">
                    <th className="text-left px-4 py-3 text-dark-400 text-xs font-medium uppercase">Artículo</th>
                    <th className="text-right px-4 py-3 text-dark-400 text-xs font-medium uppercase">Esperado</th>
                    <th className="text-right px-4 py-3 text-dark-400 text-xs font-medium uppercase">Recibido</th>
                    <th className="text-right px-4 py-3 text-dark-400 text-xs font-medium uppercase">Diferencia</th>
                    <th className="text-center px-4 py-3 text-dark-400 text-xs font-medium uppercase">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {resultados.map(r => (
                    <tr key={r.id} className="border-b border-dark-800">
                      <td className="px-4 py-3">
                        <p className="text-white font-mono font-semibold">{r.articulo_codigo}</p>
                        <p className="text-dark-400 text-xs">{r.articulo_nombre}</p>
                      </td>
                      <td className="px-4 py-3 text-right text-dark-300 font-mono">{r.cantidad_esperada}</td>
                      <td className="px-4 py-3 text-right text-white font-mono font-semibold">{r.cantidad_recibida ?? 0}</td>
                      <td className={`px-4 py-3 text-right font-mono font-bold ${(r.diferencia ?? 0) === 0 ? 'text-green-400' : (r.diferencia ?? 0) < 0 ? 'text-red-400' : 'text-yellow-400'}`}>
                        {(r.diferencia ?? 0) > 0 ? '+' : ''}{r.diferencia ?? 0}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${(r.diferencia ?? 0) === 0 ? 'bg-green-500/20 text-green-400' : (r.diferencia ?? 0) < 0 ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                          {(r.diferencia ?? 0) === 0 ? 'OK' : (r.diferencia ?? 0) < 0 ? 'Faltante' : 'Sobrante'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end">
              <button onClick={reiniciar} className="btn-primary px-6 py-2 rounded-lg font-medium">
                Nuevo Control Ciego
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
