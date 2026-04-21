import { useState, useCallback, useRef } from 'react'
import Layout from '../components/Layout'
import { Upload, FileText, Download, AlertCircle, Truck, Package, RefreshCw } from 'lucide-react'

interface Fila { ID: string; Transporte: string; CodigoArticulo: string; Descripcion: string; Bultos: number }

// ── Parser de texto plano (misma lógica que el script Python) ─────────────────
function isPlanillaHeader(lines: string[]): boolean {
  const head = lines.slice(0, 20).join(' ').toUpperCase().replace(/\s+/g, ' ')
  return head.includes('PLANILLA') && head.includes('CARGA') &&
    !head.includes('COMPOSICION DE CARGA') && !head.includes('PLANILLA ADMINISTRATIVA')
}

function extraerTransporte(lines: string[]): string {
  for (const line of lines.slice(0, 15)) {
    const m = line.match(/Transporte:\s*(.+?)(?:\s*\|\s*Chofer|\s*\|\s*Dep|$)/)
    if (m) return m[1].trim()
  }
  return 'Sin transporte'
}

function parsearPagina(lines: string[], transporte: string): Fila[] {
  const filas: Fila[] = []
  let inTable = false

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue
    if (/^SKU\s+Descripci/i.test(line)) { inTable = true; continue }
    if (!inTable) continue
    if (/T\s*O\s*T\s*A\s*L/.test(line) || line.includes('Estado del Transporte')) { inTable = false; continue }

    // Línea artículo: SKU DESC [VENC] BULTOS [UNIDS] [PESO]
    const m = line.match(/^(\d{2,})\s+(.+?)\s+(\d{1,5})(?:\s+[\d,.]+)*\s*$/)
    if (!m) continue

    const sku = m[1]
    let desc = m[2].trim()
    const bultos = parseInt(m[3])

    if (/^\d+\s*-\s*[A-Z]/.test(desc)) continue  // "001 - CONGELADOS"
    if (/total/i.test(desc)) continue
    if (bultos > 9999 || bultos === 0) continue
    if (desc.length < 2) continue

    // Limpiar fecha de vencimiento si quedó en la descripción
    desc = desc.replace(/\s+\d{2}\/\d{2}\/\d{2,4}\s*$/, '').trim()

    // ID = nro_transporte + codigo (ej: "10_1199")
    const nroTransporte = transporte.match(/^(\d+)/)?.[1] || transporte
    const id = nroTransporte + '_' + sku
    filas.push({ ID: id, Transporte: transporte, CodigoArticulo: sku, Descripcion: desc, Bultos: bultos })
  }
  return filas
}

// ── Exportar CSV ──────────────────────────────────────────────────────────────
function exportarCSV(filas: Fila[], nombre: string) {
  const headers = 'Transporte;CodigoArticulo;Descripcion;Bultos'
  const rows = filas.map(f => `${f.Transporte};${f.CodigoArticulo};${f.Descripcion};${f.Bultos}`)
  const blob = new Blob(['\uFEFF' + headers + '\n' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = nombre; a.click()
  URL.revokeObjectURL(url)
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function PlanillaCarga() {
  const [dragging, setDragging] = useState(false)
  const [archivo, setArchivo] = useState<File | null>(null)
  const [progreso, setProgreso] = useState({ actual: 0, total: 0, estado: '' })
  const [error, setError] = useState('')
  const [detalle, setDetalle] = useState<Fila[]>([])
  const [resumen, setResumen] = useState<Fila[]>([])
  const [tab, setTab] = useState<'resumen' | 'detalle'>('resumen')
  const [filtro, setFiltro] = useState('')
  const cancelRef = useRef(false)

  const procesarPDF = async (file: File) => {
    setArchivo(file); setError(''); setDetalle([]); setResumen([])
    cancelRef.current = false
    setProgreso({ actual: 0, total: 0, estado: 'Cargando pdf.js...' })

    try {
      // Cargar pdf.js desde CDN
      if (!(window as any).pdfjsLib) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script')
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
          script.onload = () => resolve()
          script.onerror = () => reject(new Error('No se pudo cargar pdf.js'))
          document.head.appendChild(script)
        })
      }
      const pdfjsLib = (window as any).pdfjsLib
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'

      setProgreso({ actual: 0, total: 0, estado: 'Leyendo archivo...' })
      const arrayBuffer = await file.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
      const totalPags = pdf.numPages

      setProgreso({ actual: 0, total: totalPags, estado: 'Analizando páginas...' })

      const todasFilas: Fila[] = []
      let paginasProcesadas = 0

      for (let pag = 1; pag <= totalPags; pag++) {
        if (cancelRef.current) break

        const page = await pdf.getPage(pag)
        const content = await page.getTextContent()

        // Reconstruir líneas de texto
        const items = content.items as any[]
        let lines: string[] = []
        let currentLine = ''
        let lastY = -1

        for (const item of items) {
          const y = Math.round(item.transform[5])
          if (lastY !== -1 && Math.abs(y - lastY) > 3) {
            if (currentLine.trim()) lines.push(currentLine.trim())
            currentLine = item.str
          } else {
            currentLine += item.str
          }
          lastY = y
        }
        if (currentLine.trim()) lines.push(currentLine.trim())

        // Filtrar páginas de planilla de carga
        if (!isPlanillaHeader(lines)) {
          setProgreso({ actual: pag, total: totalPags, estado: `Página ${pag}/${totalPags}` })
          continue
        }

        const transporte = extraerTransporte(lines)
        const filas = parsearPagina(lines, transporte)
        todasFilas.push(...filas)
        paginasProcesadas++

        setProgreso({ actual: pag, total: totalPags, estado: `Procesando... ${paginasProcesadas} pág. planilla, ${todasFilas.length} filas` })
      }

      if (!todasFilas.length) {
        setError('No se extrajeron filas. Verificá que sea una Planilla de Carga digital (no escaneada).')
        setArchivo(null); return
      }

      // Resumen agrupado
      const mapa = new Map<string, Fila>()
      for (const f of todasFilas) {
        const key = f.Transporte + '|' + f.CodigoArticulo + '|' + f.Descripcion
        const ex = mapa.get(key)
        if (ex) ex.Bultos += f.Bultos
        else mapa.set(key, { ...f })
      }
      const res = Array.from(mapa.values())
        .sort((a, b) => a.Transporte.localeCompare(b.Transporte) || a.CodigoArticulo.localeCompare(b.CodigoArticulo))

      setDetalle(todasFilas)
      setResumen(res)
      setProgreso({ actual: totalPags, total: totalPags, estado: '¡Listo!' })

    } catch (err) {
      setError('Error: ' + String(err))
      setArchivo(null)
      setProgreso({ actual: 0, total: 0, estado: '' })
    }
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files[0]; if (file) procesarPDF(file)
  }, [])

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (file) procesarPDF(file)
  }

  const resetear = () => {
    cancelRef.current = true
    setArchivo(null); setDetalle([]); setResumen([])
    setProgreso({ actual: 0, total: 0, estado: '' }); setError('')
  }

  const listo = detalle.length > 0
  const pct = progreso.total > 0 ? Math.round(progreso.actual / progreso.total * 100) : 0

  // Transportes únicos para resumen
  const transportes = [...new Set(resumen.map(f => f.Transporte))].sort()
  const detalleF = filtro ? detalle.filter(f =>
    f.Transporte.toLowerCase().includes(filtro.toLowerCase()) ||
    f.CodigoArticulo.includes(filtro) ||
    f.Descripcion.toLowerCase().includes(filtro.toLowerCase())
  ) : detalle
  const resumenF = filtro ? resumen.filter(f =>
    f.Transporte.toLowerCase().includes(filtro.toLowerCase()) ||
    f.CodigoArticulo.includes(filtro) ||
    f.Descripcion.toLowerCase().includes(filtro.toLowerCase())
  ) : resumen

  return (
    <Layout>
      <div className="p-6 max-w-6xl mx-auto">

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Planilla de Carga</h1>

          </div>
          {(listo || archivo) && (
            <button onClick={resetear} className="flex items-center gap-2 text-dark-400 hover:text-white text-sm transition-colors">
              <RefreshCw className="w-4 h-4" /> Nuevo PDF
            </button>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="card rounded-xl p-4 mb-4 flex gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-400 font-semibold text-sm">Error</p>
              <p className="text-red-300 text-sm mt-0.5">{error}</p>
              <button onClick={resetear} className="mt-3 btn-primary px-4 py-1.5 rounded-lg text-sm">Intentar de nuevo</button>
            </div>
          </div>
        )}

        {/* Drop zone */}
        {!archivo && !error && (
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => document.getElementById('pdf-input')?.click()}
            className={'border-2 border-dashed rounded-2xl p-16 text-center transition-all cursor-pointer ' +
              (dragging ? 'border-primary-400 bg-primary-400/10' : 'border-dark-600 hover:border-dark-400 hover:bg-dark-800/30')}
          >
            <Upload className={'w-14 h-14 mx-auto mb-4 ' + (dragging ? 'text-primary-400' : 'text-dark-500')} />
            <p className="text-white font-semibold text-xl mb-2">{dragging ? 'Soltá el PDF acá' : 'Arrastrá el PDF o hacé click'}</p>
            <p className="text-dark-400 text-sm">Planilla de Carga · Chess ERP · Cualquier tamaño</p>
            <input id="pdf-input" type="file" accept=".pdf" className="hidden" onChange={onFileInput} />
          </div>
        )}

        {/* Progreso */}
        {archivo && !listo && !error && (
          <div className="card rounded-2xl p-8">
            <div className="flex items-center gap-3 mb-4">
              <FileText className="w-6 h-6 text-primary-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold truncate">{archivo.name}</p>
                <p className="text-dark-400 text-sm">{(archivo.size / 1024 / 1024).toFixed(1)} MB</p>
              </div>
            </div>
            <div className="w-full bg-dark-700 rounded-full h-3 mb-3">
              <div className="bg-primary-500 h-3 rounded-full transition-all duration-300" style={{ width: pct + '%' }} />
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-dark-300">{progreso.estado}</span>
              <span className="text-primary-400 font-semibold">{pct}%</span>
            </div>
          </div>
        )}

        {/* Resultados */}
        {listo && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div className="card rounded-xl p-4">
                <p className="text-2xl font-bold text-primary-400">{transportes.length}</p>
                <p className="text-dark-400 text-sm flex items-center gap-1 mt-1"><Truck className="w-3.5 h-3.5" />Transportes</p>
              </div>
              <div className="card rounded-xl p-4">
                <p className="text-2xl font-bold text-green-400">{new Set(detalle.map(f=>f.CodigoArticulo)).size}</p>
                <p className="text-dark-400 text-sm flex items-center gap-1 mt-1"><Package className="w-3.5 h-3.5" />SKUs únicos</p>
              </div>
              <div className="card rounded-xl p-4">
                <p className="text-2xl font-bold text-white">{detalle.length}</p>
                <p className="text-dark-400 text-sm mt-1">Filas totales</p>
              </div>
              <div className="card rounded-xl p-4">
                <p className="text-2xl font-bold text-yellow-400">{detalle.reduce((s,f)=>s+f.Bultos,0).toLocaleString()}</p>
                <p className="text-dark-400 text-sm mt-1">Bultos totales</p>
              </div>
            </div>

            {/* Controles */}
            <div className="flex flex-wrap items-center gap-3 mb-3">
              <div className="flex gap-1 bg-dark-800 rounded-lg p-1">
                <button onClick={() => setTab('resumen')}
                  className={'px-3 py-1.5 rounded-md text-sm font-medium transition-colors ' + (tab==='resumen' ? 'bg-primary-600 text-white' : 'text-dark-400 hover:text-white')}>
                  Resumen ({resumen.length})
                </button>
                <button onClick={() => setTab('detalle')}
                  className={'px-3 py-1.5 rounded-md text-sm font-medium transition-colors ' + (tab==='detalle' ? 'bg-primary-600 text-white' : 'text-dark-400 hover:text-white')}>
                  Detalle ({detalle.length})
                </button>
              </div>
              <div className="relative flex-1 max-w-sm">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <input type="text" placeholder="Buscar transporte, código o artículo..." value={filtro}
                  onChange={e => setFiltro(e.target.value)}
                  className="w-full bg-dark-800 border border-dark-600 hover:border-dark-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-dark-500 outline-none transition-all" />
                {filtro && (
                  <button onClick={() => setFiltro('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-white transition-colors">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                )}
              </div>
              <div className="flex gap-2 ml-auto">
                <button onClick={() => exportarCSV(resumenF, 'resumen_planilla.csv')}
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">
                  <Download className="w-3.5 h-3.5" />Resumen CSV
                </button>
                <button onClick={() => exportarCSV(detalleF, 'detalle_planilla.csv')}
                  className="flex items-center gap-2 bg-dark-700 hover:bg-dark-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">
                  <Download className="w-3.5 h-3.5" />Detalle CSV
                </button>
              </div>
            </div>

            {/* Tabla resumen */}
            {tab === 'resumen' && (
              <div className="card rounded-xl overflow-hidden">
                <div className="overflow-x-auto max-h-[500px]">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-dark-800">
                      <tr className="border-b border-dark-700">
                        <th className="text-left px-4 py-2 text-dark-400 text-xs uppercase">ID</th>
                        <th className="text-left px-4 py-2 text-dark-400 text-xs uppercase">Transporte</th>
                        <th className="text-left px-4 py-2 text-dark-400 text-xs uppercase">Código</th>
                        <th className="text-left px-4 py-2 text-dark-400 text-xs uppercase">Descripción</th>
                        <th className="text-right px-4 py-2 text-dark-400 text-xs uppercase">Bultos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resumenF.map((f, i) => (
                        <tr key={i} className="border-b border-dark-800 hover:bg-dark-800/40">
                          <td className="px-4 py-2 text-dark-300 font-mono text-xs font-semibold">{f.ID}</td>
                          <td className="px-4 py-2 text-blue-400 text-xs font-medium">{f.Transporte}</td>
                          <td className="px-4 py-2 text-primary-400 font-mono font-semibold">{f.CodigoArticulo}</td>
                          <td className="px-4 py-2 text-white">{f.Descripcion}</td>
                          <td className="px-4 py-2 text-right text-white font-semibold">{f.Bultos}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Tabla detalle */}
            {tab === 'detalle' && (
              <div className="card rounded-xl overflow-hidden">
                <div className="overflow-x-auto max-h-[500px]">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-dark-800">
                      <tr className="border-b border-dark-700">
                        <th className="text-left px-4 py-2 text-dark-400 text-xs uppercase">ID</th>
                        <th className="text-left px-4 py-2 text-dark-400 text-xs uppercase">Transporte</th>
                        <th className="text-left px-4 py-2 text-dark-400 text-xs uppercase">Código</th>
                        <th className="text-left px-4 py-2 text-dark-400 text-xs uppercase">Descripción</th>
                        <th className="text-right px-4 py-2 text-dark-400 text-xs uppercase">Bultos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detalleF.map((f, i) => (
                        <tr key={i} className="border-b border-dark-800 hover:bg-dark-800/40">
                          <td className="px-4 py-2 text-dark-300 font-mono text-xs font-semibold">{f.ID}</td>
                          <td className="px-4 py-2 text-blue-400 text-xs font-medium">{f.Transporte}</td>
                          <td className="px-4 py-2 text-primary-400 font-mono font-semibold">{f.CodigoArticulo}</td>
                          <td className="px-4 py-2 text-white">{f.Descripcion}</td>
                          <td className="px-4 py-2 text-right text-white font-semibold">{f.Bultos}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  )
}
