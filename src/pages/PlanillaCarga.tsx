import { useState, useCallback } from 'react'
import Layout from '../components/Layout'
import { Upload, FileText, Download, AlertCircle, CheckCircle, Package, Truck, RefreshCw, X } from 'lucide-react'

interface FilaDetalle {
  Transporte: string
  CodigoArticulo: string
  Descripcion: string
  Bultos: number
}

interface FilaResumen {
  Transporte: string
  CodigoArticulo: string
  Descripcion: string
  Bultos: number
}

interface ResultadoParseo {
  ok: boolean
  error?: string
  stats?: { transportes: number; filas: number; skus: number; paginas_procesadas: number }
  detalle?: FilaDetalle[]
  resumen?: FilaResumen[]
}

function TablaDetalle({ filas }: { filas: FilaDetalle[] }) {
  const [filtro, setFiltro] = useState('')
  const filtradas = filtro
    ? filas.filter(f => f.Transporte?.toLowerCase().includes(filtro.toLowerCase()) ||
        f.CodigoArticulo?.includes(filtro) || f.Descripcion?.toLowerCase().includes(filtro.toLowerCase()))
    : filas

  return (
    <div>
      <div className="px-4 py-3 border-b border-dark-700 flex items-center gap-3">
        <input type="text" placeholder="Filtrar por transporte, código o descripción..."
          value={filtro} onChange={e => setFiltro(e.target.value)}
          className="input-field flex-1 text-sm" />
        <span className="text-dark-400 text-sm">{filtradas.length} filas</span>
      </div>
      <div className="overflow-x-auto max-h-96">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-dark-800">
            <tr className="border-b border-dark-700">
              <th className="text-left px-4 py-2 text-dark-400 text-xs uppercase font-medium">Transporte</th>
              <th className="text-left px-4 py-2 text-dark-400 text-xs uppercase font-medium">Código</th>
              <th className="text-left px-4 py-2 text-dark-400 text-xs uppercase font-medium">Descripción</th>
              <th className="text-right px-4 py-2 text-dark-400 text-xs uppercase font-medium">Bultos</th>
            </tr>
          </thead>
          <tbody>
            {filtradas.map((f, i) => (
              <tr key={i} className="border-b border-dark-800 hover:bg-dark-800/40">
                <td className="px-4 py-2 text-blue-400 text-xs font-medium">{f.Transporte || '—'}</td>
                <td className="px-4 py-2 text-primary-400 font-mono font-semibold">{f.CodigoArticulo}</td>
                <td className="px-4 py-2 text-white">{f.Descripcion}</td>
                <td className="px-4 py-2 text-right text-white font-semibold">{f.Bultos}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function TablaResumen({ filas }: { filas: FilaResumen[] }) {
  const transportes = [...new Set(filas.map(f => f.Transporte))].filter(Boolean)
  return (
    <div className="overflow-x-auto max-h-96">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-dark-800">
          <tr className="border-b border-dark-700">
            <th className="text-left px-4 py-2 text-dark-400 text-xs uppercase font-medium">Transporte</th>
            <th className="text-left px-4 py-2 text-dark-400 text-xs uppercase font-medium">Código</th>
            <th className="text-left px-4 py-2 text-dark-400 text-xs uppercase font-medium">Descripción</th>
            <th className="text-right px-4 py-2 text-dark-400 text-xs uppercase font-medium">Bultos Total</th>
          </tr>
        </thead>
        <tbody>
          {transportes.map(t => {
            const rows = filas.filter(f => f.Transporte === t)
            const totalBultos = rows.reduce((s, r) => s + r.Bultos, 0)
            return rows.map((f, i) => (
              <tr key={t+i} className="border-b border-dark-800 hover:bg-dark-800/40">
                {i === 0 && (
                  <td className="px-4 py-2 text-blue-400 text-xs font-bold align-top" rowSpan={rows.length}>
                    {f.Transporte}
                    <div className="text-dark-500 font-normal mt-0.5">{rows.length} items · {totalBultos} bultos</div>
                  </td>
                )}
                <td className="px-4 py-2 text-primary-400 font-mono font-semibold">{f.CodigoArticulo}</td>
                <td className="px-4 py-2 text-white">{f.Descripcion}</td>
                <td className="px-4 py-2 text-right text-white font-semibold">{f.Bultos}</td>
              </tr>
            ))
          })}
        </tbody>
      </table>
    </div>
  )
}

function exportarCSV(filas: FilaDetalle[] | FilaResumen[], nombre: string) {
  const headers = Object.keys(filas[0] || {}).join(';')
  const rows = filas.map(f => Object.values(f).join(';')).join('\n')
  const blob = new Blob(['\uFEFF' + headers + '\n' + rows], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = nombre; a.click()
  URL.revokeObjectURL(url)
}

export default function PlanillaCarga() {
  const [dragging, setDragging] = useState(false)
  const [archivo, setArchivo] = useState<File | null>(null)
  const [cargando, setCargando] = useState(false)
  const [resultado, setResultado] = useState<ResultadoParseo | null>(null)
  const [tab, setTab] = useState<'detalle' | 'resumen'>('resumen')

  const SUPA_URL = import.meta.env.VITE_SUPABASE_URL || ''
  const SUPA_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

  const procesarArchivo = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setResultado({ ok: false, error: 'El archivo debe ser un PDF.' })
      return
    }
    setArchivo(file)
    setCargando(true)
    setResultado(null)
    try {
      const arrayBuffer = await file.arrayBuffer()
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))
      const res = await fetch(SUPA_URL + '/functions/v1/parsear-planilla', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + SUPA_KEY,
          'apikey': SUPA_KEY,
        },
        body: JSON.stringify({ pdf_base64: base64, filename: file.name })
      })
      const data = await res.json()
      setResultado(data)
    } catch (err) {
      setResultado({ ok: false, error: 'Error al conectar con el servidor: ' + String(err) })
    } finally {
      setCargando(false)
    }
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) procesarArchivo(file)
  }, [])

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) procesarArchivo(file)
  }

  const resetear = () => { setArchivo(null); setResultado(null) }

  return (
    <Layout>
      <div className="p-6 max-w-6xl mx-auto">

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Planilla de Carga</h1>
            <p className="text-dark-400 text-sm mt-1">Subí el PDF de planilla de carga para extraer los datos por transporte</p>
          </div>
          {resultado?.ok && (
            <button onClick={resetear} className="flex items-center gap-2 text-dark-400 hover:text-white text-sm transition-colors">
              <RefreshCw className="w-4 h-4" /> Nuevo PDF
            </button>
          )}
        </div>

        {/* Drop zone */}
        {!archivo && !cargando && (
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={'border-2 border-dashed rounded-2xl p-12 text-center transition-all cursor-pointer ' +
              (dragging ? 'border-primary-400 bg-primary-400/10' : 'border-dark-600 hover:border-dark-400 hover:bg-dark-800/30')}
            onClick={() => document.getElementById('pdf-input')?.click()}
          >
            <Upload className={'w-12 h-12 mx-auto mb-4 ' + (dragging ? 'text-primary-400' : 'text-dark-500')} />
            <p className="text-white font-semibold text-lg mb-2">
              {dragging ? 'Soltá el PDF acá' : 'Arrastrá el PDF o hacé click para seleccionar'}
            </p>
            <p className="text-dark-400 text-sm">Solo archivos .pdf · Planilla de Carga</p>
            <input id="pdf-input" type="file" accept=".pdf" className="hidden" onChange={onFileInput} />
          </div>
        )}

        {/* Cargando */}
        {cargando && (
          <div className="card rounded-2xl p-12 text-center">
            <RefreshCw className="w-10 h-10 text-primary-400 animate-spin mx-auto mb-4" />
            <p className="text-white font-semibold text-lg">Procesando {archivo?.name}...</p>
            <p className="text-dark-400 text-sm mt-2">Extrayendo datos del PDF, esto puede tardar unos segundos</p>
          </div>
        )}

        {/* Error */}
        {resultado && !resultado.ok && (
          <div className="card rounded-2xl p-6">
            <div className="flex gap-3 mb-4">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-red-400 font-semibold">Error al procesar el PDF</p>
                <p className="text-red-300 text-sm mt-1">{resultado.error}</p>
              </div>
            </div>
            <button onClick={resetear} className="btn-primary px-4 py-2 rounded-lg text-sm">Intentar con otro PDF</button>
          </div>
        )}

        {/* Resultado OK */}
        {resultado?.ok && resultado.stats && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div className="card rounded-xl p-4">
                <p className="text-2xl font-bold text-primary-400">{resultado.stats.transportes}</p>
                <p className="text-dark-400 text-sm flex items-center gap-1 mt-1"><Truck className="w-3.5 h-3.5" />Transportes</p>
              </div>
              <div className="card rounded-xl p-4">
                <p className="text-2xl font-bold text-green-400">{resultado.stats.skus}</p>
                <p className="text-dark-400 text-sm flex items-center gap-1 mt-1"><Package className="w-3.5 h-3.5" />SKUs únicos</p>
              </div>
              <div className="card rounded-xl p-4">
                <p className="text-2xl font-bold text-white">{resultado.stats.filas}</p>
                <p className="text-dark-400 text-sm mt-1">Filas totales</p>
              </div>
              <div className="card rounded-xl p-4">
                <p className="text-2xl font-bold text-yellow-400">{resultado.stats.paginas_procesadas}</p>
                <p className="text-dark-400 text-sm flex items-center gap-1 mt-1"><FileText className="w-3.5 h-3.5" />Páginas leídas</p>
              </div>
            </div>

            {/* Acciones */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex gap-1 bg-dark-800 rounded-lg p-1">
                <button onClick={() => setTab('resumen')}
                  className={'px-4 py-1.5 rounded-md text-sm font-medium transition-colors ' +
                    (tab === 'resumen' ? 'bg-primary-600 text-white' : 'text-dark-400 hover:text-white')}>
                  Resumen por transporte
                </button>
                <button onClick={() => setTab('detalle')}
                  className={'px-4 py-1.5 rounded-md text-sm font-medium transition-colors ' +
                    (tab === 'detalle' ? 'bg-primary-600 text-white' : 'text-dark-400 hover:text-white')}>
                  Detalle ({resultado.detalle?.length} filas)
                </button>
              </div>
              <div className="flex gap-2">
                <button onClick={() => exportarCSV(resultado.resumen || [], 'resumen_planilla.csv')}
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">
                  <Download className="w-3.5 h-3.5" />Resumen CSV
                </button>
                <button onClick={() => exportarCSV(resultado.detalle || [], 'detalle_planilla.csv')}
                  className="flex items-center gap-2 bg-dark-700 hover:bg-dark-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">
                  <Download className="w-3.5 h-3.5" />Detalle CSV
                </button>
              </div>
            </div>

            {/* Tabla */}
            <div className="card rounded-xl overflow-hidden">
              {tab === 'resumen'
                ? <TablaResumen filas={resultado.resumen || []} />
                : <TablaDetalle filas={resultado.detalle || []} />
              }
            </div>
          </>
        )}
      </div>
    </Layout>
  )
}
