import { useState, useCallback, useRef, useEffect } from 'react'
import Layout from '../components/Layout'
import { Upload, FileText, Download, AlertCircle, Truck, Package, RefreshCw, Save, Calendar, ChevronDown, Trash2, Clock } from 'lucide-react'
import { supabase } from '../lib/supabase'

interface Fila { ID: string; Transporte: string; CodigoArticulo: string; Descripcion: string; Bultos: number }
interface PlanillaGuardada { id: string; fecha: string; fecha_str: string; archivo_nombre: string | null; creado_en: string; detalle: Fila[]; resumen: Fila[] }

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
  const filas: Fila[] = []; let inTable = false
  for (const rawLine of lines) {
    const line = rawLine.trim(); if (!line) continue
    if (/^SKU\s+Descripci/i.test(line)) { inTable = true; continue }
    if (!inTable) continue
    if (/T\s*O\s*T\s*A\s*L/.test(line) || line.includes('Estado del Transporte')) { inTable = false; continue }
    const mPeso    = line.match(/^(\d{2,})\s+(.+)\s+(\d{1,5})\s+\d+[.,]\d+\s*$/)
    const mSinPeso = line.match(/^(\d{2,})\s+(.+)\s+(\d{1,5})\s*$/)
    const m = mPeso || mSinPeso; if (!m) continue
    const sku = m[1]; let desc = m[2].trim(); const bultos = parseInt(m[3])
    if (/^\d+\s*-\s*[A-Z]/.test(desc)) continue
    if (/total/i.test(desc)) continue
    if (bultos > 9999 || bultos === 0) continue
    if (desc.length < 2) continue
    desc = desc.replace(/\s+\d{2}\/\d{2}\/\d{2,4}\s*$/, '').trim()
    const nroT = transporte.match(/^(\d+)/)?.[1] || transporte
    filas.push({ ID: nroT + sku, Transporte: transporte, CodigoArticulo: sku, Descripcion: desc, Bultos: bultos })
  }
  return filas
}
function exportarCSV(filas: Fila[], nombre: string) {
  const headers = 'ID;Transporte;CodigoArticulo;Descripcion;Bultos'
  const rows = filas.map(f => f.ID+';'+f.Transporte+';'+f.CodigoArticulo+';'+f.Descripcion+';'+f.Bultos)
  const blob = new Blob(['\uFEFF'+headers+'\n'+rows.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = nombre; a.click()
  URL.revokeObjectURL(url)
}

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

  // Guardado
  const [fechaGuardar, setFechaGuardar] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [guardadoOk, setGuardadoOk] = useState(false)
  const [planillaId, setPlanillaId] = useState<string | null>(null)

  // Planillas guardadas
  const [planillasGuardadas, setPlanillasGuardadas] = useState<PlanillaGuardada[]>([])
  const [cargandoGuardadas, setCargandoGuardadas] = useState(false)
  const [mostrarGuardadas, setMostrarGuardadas] = useState(false)

  useEffect(() => { cargarPlanillasGuardadas() }, [])

  const cargarPlanillasGuardadas = async () => {
    setCargandoGuardadas(true)
    const { data } = await supabase
      .from('planillas_carga')
      .select('id, fecha, fecha_str, archivo_nombre, creado_en')
      .order('fecha', { ascending: false })
      .limit(20)
    if (data) setPlanillasGuardadas(data as any)
    setCargandoGuardadas(false)
  }

  const guardarPlanilla = async () => {
    if (!fechaGuardar || !detalle.length) return
    setGuardando(true)
    try {
      // Convertir dd/mm/yyyy → yyyy-mm-dd
      const [dd, mm, yyyy] = fechaGuardar.split('/')
      const fechaISO = yyyy + '-' + mm.padStart(2,'0') + '-' + dd.padStart(2,'0')
      const { data, error: err } = await supabase.from('planillas_carga').insert({
        fecha: fechaISO,
        fecha_str: fechaGuardar,
        archivo_nombre: archivo?.name || null,
        detalle: detalle,
        resumen: resumen,
      }).select('id').single()
      if (err) throw err
      setPlanillaId(data.id)
      setGuardadoOk(true)
      cargarPlanillasGuardadas()
    } catch (e) {
      setError('Error al guardar: ' + String(e))
    } finally {
      setGuardando(false)
    }
  }

  const precargarPlanilla = async (p: PlanillaGuardada) => {
    const { data } = await supabase.from('planillas_carga').select('detalle, resumen').eq('id', p.id).single()
    if (data) {
      setDetalle(data.detalle as Fila[])
      setResumen(data.resumen as Fila[])
      setFechaGuardar(p.fecha_str)
      setPlanillaId(p.id)
      setGuardadoOk(true)
      setArchivo(null)
      setMostrarGuardadas(false)
      setProgreso({ actual: 1, total: 1, estado: 'Precargada desde Supabase' })
    }
  }

  const eliminarPlanilla = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await supabase.from('planillas_carga').delete().eq('id', id)
    cargarPlanillasGuardadas()
  }

  const procesarPDF = async (file: File) => {
    setArchivo(file); setError(''); setDetalle([]); setResumen([])
    setGuardadoOk(false); setPlanillaId(null)
    cancelRef.current = false
    setProgreso({ actual: 0, total: 0, estado: 'Cargando pdf.js...' })
    try {
      if (!(window as any).pdfjsLib) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script')
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
          script.onload = () => resolve(); script.onerror = () => reject(new Error('No se pudo cargar pdf.js'))
          document.head.appendChild(script)
        })
      }
      const pdfjsLib = (window as any).pdfjsLib
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
      setProgreso({ actual: 0, total: 0, estado: 'Leyendo archivo...' })
      const arrayBuffer = await file.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
      const totalPags = pdf.numPages
      setProgreso({ actual: 0, total: totalPags, estado: 'Analizando páginas...' })
      const todasFilas: Fila[] = []; let paginasProcesadas = 0
      for (let pag = 1; pag <= totalPags; pag++) {
        if (cancelRef.current) break
        const page = await pdf.getPage(pag)
        const content = await page.getTextContent()
        const items = content.items as any[]
        let lines: string[] = []; let currentLine = ''; let lastY = -1
        for (const item of items) {
          const y = Math.round(item.transform[5])
          if (lastY !== -1 && Math.abs(y - lastY) > 3) {
            if (currentLine.trim()) lines.push(currentLine.trim()); currentLine = item.str
          } else { currentLine += item.str }
          lastY = y
        }
        if (currentLine.trim()) lines.push(currentLine.trim())
        if (!isPlanillaHeader(lines)) { setProgreso({ actual: pag, total: totalPags, estado: 'Página '+pag+'/'+totalPags }); continue }
        const transporte = extraerTransporte(lines)
        const filas = parsearPagina(lines, transporte)
        todasFilas.push(...filas); paginasProcesadas++
        setProgreso({ actual: pag, total: totalPags, estado: 'Procesando... '+paginasProcesadas+' pág. planilla, '+todasFilas.length+' filas' })
      }
      if (!todasFilas.length) { setError('No se extrajeron filas.'); setArchivo(null); return }
      const mapa = new Map<string, Fila>()
      for (const f of todasFilas) {
        const key = f.Transporte+'|'+f.CodigoArticulo+'|'+f.Descripcion
        const ex = mapa.get(key); if (ex) ex.Bultos += f.Bultos; else mapa.set(key, { ...f })
      }
      const res = Array.from(mapa.values()).sort((a,b)=>a.Transporte.localeCompare(b.Transporte)||a.CodigoArticulo.localeCompare(b.CodigoArticulo))
      setDetalle(todasFilas); setResumen(res)
      setProgreso({ actual: totalPags, total: totalPags, estado: '¡Listo!' })
    } catch (err) {
      setError('Error: '+String(err)); setArchivo(null)
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
    cancelRef.current = true; setArchivo(null); setDetalle([]); setResumen([])
    setProgreso({ actual: 0, total: 0, estado: '' }); setError('')
    setGuardadoOk(false); setPlanillaId(null); setFechaGuardar('')
  }

  const listo = detalle.length > 0
  const pct = progreso.total > 0 ? Math.round(progreso.actual / progreso.total * 100) : 0
  const detalleF = filtro ? detalle.filter(f => f.Transporte.toLowerCase().includes(filtro.toLowerCase()) || f.CodigoArticulo.includes(filtro) || f.Descripcion.toLowerCase().includes(filtro.toLowerCase())) : detalle
  const resumenF = filtro ? resumen.filter(f => f.Transporte.toLowerCase().includes(filtro.toLowerCase()) || f.CodigoArticulo.includes(filtro) || f.Descripcion.toLowerCase().includes(filtro.toLowerCase())) : resumen

  return (
    <Layout>
      <div className="p-6 max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white">Planilla de Carga</h1>
          <div className="flex items-center gap-2">
            {(listo || archivo) && (
              <button onClick={resetear} className="flex items-center gap-2 text-dark-400 hover:text-white text-sm transition-colors">
                <RefreshCw className="w-4 h-4" /> Nuevo PDF
              </button>
            )}
            <button
              onClick={() => setMostrarGuardadas(!mostrarGuardadas)}
              className="flex items-center gap-2 bg-dark-700 hover:bg-dark-600 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <Clock className="w-4 h-4" />
              Planillas guardadas
              <ChevronDown className={'w-3.5 h-3.5 transition-transform '+(mostrarGuardadas?'rotate-180':'')} />
            </button>
          </div>
        </div>

        {/* Panel planillas guardadas */}
        {mostrarGuardadas && (
          <div className="card rounded-xl mb-4 overflow-hidden">
            <div className="px-4 py-3 border-b border-dark-700 flex items-center justify-between">
              <h3 className="text-white font-semibold text-sm">Planillas guardadas</h3>
              {cargandoGuardadas && <RefreshCw className="w-4 h-4 text-primary-400 animate-spin" />}
            </div>
            {planillasGuardadas.length === 0 && !cargandoGuardadas && (
              <div className="px-4 py-6 text-center text-dark-500 text-sm">No hay planillas guardadas</div>
            )}
            <div className="divide-y divide-dark-800">
              {planillasGuardadas.map(p => (
                <div key={p.id} className="flex items-center justify-between px-4 py-3 hover:bg-dark-800/40 cursor-pointer transition-colors" onClick={() => precargarPlanilla(p)}>
                  <div className="flex items-center gap-3">
                    <Calendar className="w-4 h-4 text-primary-400 flex-shrink-0" />
                    <div>
                      <p className="text-white font-semibold text-sm">{p.fecha_str}</p>
                      <p className="text-dark-400 text-xs">{p.archivo_nombre || 'Sin nombre'}</p>
                    </div>
                  </div>
                  <button onClick={(e) => eliminarPlanilla(p.id, e)} className="text-dark-500 hover:text-red-400 transition-colors p-1">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

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
        {!archivo && !error && !listo && (
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => document.getElementById('pdf-input')?.click()}
            className={'border-2 border-dashed rounded-2xl p-16 text-center transition-all cursor-pointer '+(dragging?'border-primary-400 bg-primary-400/10':'border-dark-600 hover:border-dark-400 hover:bg-dark-800/30')}
          >
            <Upload className={'w-14 h-14 mx-auto mb-4 '+(dragging?'text-primary-400':'text-dark-500')} />
            <p className="text-white font-semibold text-xl mb-2">{dragging?'Soltá el PDF acá':'Arrastrá el PDF o hacé click'}</p>
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
                <p className="text-dark-400 text-sm">{(archivo.size/1024/1024).toFixed(1)} MB</p>
              </div>
            </div>
            <div className="w-full bg-dark-700 rounded-full h-3 mb-3">
              <div className="bg-primary-500 h-3 rounded-full transition-all duration-300" style={{ width: pct+'%' }} />
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
                <p className="text-2xl font-bold text-primary-400">{new Set(detalle.map(f=>f.Transporte)).size}</p>
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

            {/* Guardar en Supabase */}
            <div className={'card rounded-xl p-4 mb-4 '+(guardadoOk?'border border-green-500/30 bg-green-500/5':'')}>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-primary-400 flex-shrink-0" />
                  <span className="text-white text-sm font-medium">Guardar planilla:</span>
                </div>
                <input
                  type="text"
                  placeholder="dd/mm/yyyy"
                  value={fechaGuardar}
                  onChange={e => {
                    let v = e.target.value.replace(/[^0-9/]/g,'')
                    if (v.length===2&&!v.includes('/')) v+='/'
                    if (v.length===5&&v.split('/').length===2) v+='/'
                    setFechaGuardar(v.substring(0,10))
                    setGuardadoOk(false)
                  }}
                  maxLength={10}
                  className="bg-dark-800 border border-dark-600 focus:border-primary-500 rounded-lg px-3 py-2 text-sm text-white w-32 outline-none font-mono"
                />
                {guardadoOk ? (
                  <div className="flex items-center gap-2 text-green-400 text-sm font-medium">
                    <span>✓ Guardado</span>
                    {planillaId && <span className="text-dark-500 text-xs font-mono">#{planillaId.slice(-6)}</span>}
                  </div>
                ) : (
                  <button
                    onClick={guardarPlanilla}
                    disabled={!fechaGuardar || guardando || fechaGuardar.length < 10}
                    className="flex items-center gap-2 bg-primary-600 hover:bg-primary-500 disabled:opacity-40 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    <Save className="w-4 h-4" />
                    {guardando ? 'Guardando...' : 'Guardar'}
                  </button>
                )}
                <span className="text-dark-500 text-xs ml-auto">La planilla guardada puede compararse con Patagonia WMS</span>
              </div>
            </div>

            {/* Controles tabla */}
            <div className="flex flex-wrap items-center gap-3 mb-3">
              <div className="flex gap-1 bg-dark-800 rounded-lg p-1">
                <button onClick={() => setTab('resumen')} className={'px-3 py-1.5 rounded-md text-sm font-medium transition-colors '+(tab==='resumen'?'bg-primary-600 text-white':'text-dark-400 hover:text-white')}>
                  Resumen ({resumen.length})
                </button>
                <button onClick={() => setTab('detalle')} className={'px-3 py-1.5 rounded-md text-sm font-medium transition-colors '+(tab==='detalle'?'bg-primary-600 text-white':'text-dark-400 hover:text-white')}>
                  Detalle ({detalle.length})
                </button>
              </div>
              <div className="relative flex-1 max-w-sm">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <input type="text" placeholder="Buscar transporte, código o artículo..." value={filtro}
                  onChange={e => setFiltro(e.target.value)}
                  className="w-full bg-dark-800 border border-dark-600 hover:border-dark-500 focus:border-primary-500 rounded-lg pl-9 pr-8 py-2 text-sm text-white placeholder-dark-500 outline-none transition-all" />
                {filtro && <button onClick={() => setFiltro('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-white transition-colors"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>}
              </div>
              <div className="flex gap-2 ml-auto">
                <button onClick={() => exportarCSV(resumenF, 'resumen_planilla.csv')} className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">
                  <Download className="w-3.5 h-3.5" />Resumen CSV
                </button>
                <button onClick={() => exportarCSV(detalleF, 'detalle_planilla.csv')} className="flex items-center gap-2 bg-dark-700 hover:bg-dark-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">
                  <Download className="w-3.5 h-3.5" />Detalle CSV
                </button>
              </div>
            </div>

            {/* Tablas */}
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
                    {(tab==='resumen'?resumenF:detalleF).map((f,i) => (
                      <tr key={i} className="border-b border-dark-800 hover:bg-dark-800/40">
                        <td className="px-4 py-2 text-dark-300 font-mono text-xs">{f.ID}</td>
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
          </>
        )}
      </div>
    </Layout>
  )
}
