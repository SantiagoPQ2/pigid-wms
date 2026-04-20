import { useState, useCallback, useRef } from 'react'
import Layout from '../components/Layout'
import { Upload, FileText, Play, CheckCircle, XCircle, AlertTriangle, Download, Trash2, RefreshCw, Eye, ChevronDown, ChevronUp } from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────────────────

interface RenglonCSV {
  codart: string
  cant: string
  bonifpct?: string
  motivo?: string
}

interface PedidoAgrupado {
  key: string
  idcliente: string
  idclialias: string
  fecentre: string
  renglones: RenglonCSV[]
  overrides: Record<string, string>
  errores: string[]
}

type EstadoPedido = 'pendiente' | 'procesando' | 'ok' | 'error' | 'advertencia'

interface ResultadoPedido {
  key: string
  idcliente: string
  fecentre: string
  nropedido: string
  estado: EstadoPedido
  error: string
  log: string[]
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────────────────────────────────────────

const ERP_BASE = import.meta.env.VITE_ERP_BASE_URL || 'http://appserver29.dyndns.org:8094'
const ERP_USER = import.meta.env.VITE_ERP_USUARIO || ''
const ERP_PASS = import.meta.env.VITE_ERP_PASSWORD || ''

const COLS_OBLIGATORIAS = ['idcliente', 'idclialias', 'fecentre', 'codart', 'cant']
const COL_NPEDIDO = 'npedido'
const COLS_CABECERA_OPT = ['tipopago', 'iddocumento', 'idempresa', 'idsucur', 'iddepo', 'idfuerzaventas', 'c_perso', 'codlipre']
const COLS_RENGLON_OPT = ['bonifpct', 'motivo']
const MOTIVOS_VALIDOS: Record<string, string> = { '1': '[B', '2': 'CLIENTE ESPECIAL' }

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function parsearCSV(texto: string): { headers: string[]; rows: Record<string, string>[] } {
  const lineas = texto.trim().split(/\r?\n/).filter(l => l.trim())
  if (lineas.length < 2) throw new Error('El CSV debe tener al menos una fila de datos')
  const headers = lineas[0].split(';').map(h => h.trim().toLowerCase().replace(/^\uFEFF/, ''))
  const rows = lineas.slice(1).map(linea => {
    const vals = linea.split(';')
    return Object.fromEntries(headers.map((h, i) => [h, (vals[i] || '').trim()]))
  })
  return { headers, rows }
}

function agruparPedidos(rows: Record<string, string>[], headers: string[]): PedidoAgrupado[] {
  const mapa = new Map<string, PedidoAgrupado>()
  
  for (const row of rows) {
    const np = row[COL_NPEDIDO] || ''
    const key = np ? `n${np}_${row.idcliente}_${row.idclialias}_${row.fecentre}` : `${row.idcliente}_${row.idclialias}_${row.fecentre}`
    
    if (!mapa.has(key)) {
      const overrides: Record<string, string> = {}
      for (const col of COLS_CABECERA_OPT) {
        const match = headers.find(h => h === col)
        if (match && row[match]) overrides[col] = row[match]
      }
      mapa.set(key, {
        key, idcliente: row.idcliente, idclialias: row.idclialias,
        fecentre: row.fecentre, npedido: row[COL_NPEDIDO] || '', renglones: [], overrides, errores: []
      })
    }
    
    const pedido = mapa.get(key)!
    const renglon: RenglonCSV = { codart: row.codart, cant: row.cant }
    if (row.bonifpct !== undefined) renglon.bonifpct = row.bonifpct
    if (row.motivo !== undefined) renglon.motivo = row.motivo
    pedido.renglones.push(renglon)
  }
  
  return Array.from(mapa.values())
}

function validarPedidos(pedidos: PedidoAgrupado[]): PedidoAgrupado[] {
  return pedidos.map(p => {
    const errores: string[] = []
    if (!p.idcliente || isNaN(Number(p.idcliente))) errores.push('idcliente inválido')
    if (!p.fecentre || !/^\d{2}\/\d{2}\/\d{4}$/.test(p.fecentre)) errores.push('fecentre debe ser DD/MM/YYYY')
    
    for (const r of p.renglones) {
      if (!r.codart || isNaN(Number(r.codart))) errores.push(`Artículo "${r.codart}": codart inválido`)
      if (!r.cant || isNaN(Number(r.cant))) errores.push(`Artículo "${r.codart}": cant inválida`)
      const tieneBonif = r.bonifpct && r.bonifpct !== '' && r.bonifpct !== '0'
      if (tieneBonif && (!r.motivo || !MOTIVOS_VALIDOS[r.motivo])) {
        errores.push(`Artículo "${r.codart}": bonifpct requiere motivo válido (1=${MOTIVOS_VALIDOS['1']}, 2=${MOTIVOS_VALIDOS['2']})`)
      }
    }
    return { ...p, errores }
  })
}

function formatFecha(f: string) {
  // DD/MM/YYYY → YYYY-MM-DD
  const [d, m, y] = f.split('/')
  return `${y}-${m}-${d}`
}

function descargarCSV(resultados: ResultadoPedido[]) {
  const header = 'idcliente;fecentre;nropedido;estado;error'
  const rows = resultados.map(r => `${r.idcliente};${r.fecentre};${r.nropedido};${r.estado};${r.error}`)
  const blob = new Blob([header + '\n' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = 'resultado_pedidos.csv'; a.click()
  URL.revokeObjectURL(url)
}

// ─────────────────────────────────────────────────────────────────────────────
// SERVICIO ERP (via proxy o CORS)
// ─────────────────────────────────────────────────────────────────────────────

// Como el ERP usa Spring Security y no tiene CORS, las llamadas reales
// deben hacerse desde el backend (Python). Esta UI actúa como:
// 1. Preview/validación local del CSV
// 2. Llamadas via un endpoint proxy en Netlify Functions si está disponible
// 3. Fallback: mostrar el payload que se enviaría

async function procesarPedidoERP(
  pedido: PedidoAgrupado,
  onLog: (msg: string) => void
): Promise<{ nropedido: string; estado: EstadoPedido; error: string }> {

  // URL de la Supabase Edge Function (corre en los servidores de Supabase
  // que SÍ tienen acceso al ERP interno via internet)
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
  const edgeFnUrl = `${supabaseUrl}/functions/v1/cargar-pedidos`

  const payload = {
    pedido: {
      idcliente:  parseInt(pedido.idcliente),
      idclialias: parseInt(pedido.idclialias),
      fecentre:   pedido.fecentre,
      renglones:  pedido.renglones.map(r => ({
        codart:   r.codart,
        cant:     r.cant,
        bonifpct: r.bonifpct || '0',
        motivo:   r.motivo   || '0',
      })),
      overrides: pedido.overrides,
    }
  }

  try {
    onLog('Conectando con el ERP...')

    // Primero intentar proxy local (si está corriendo)
    let usandoLocal = false
    try {
      const ping = await fetch('http://localhost:5001/ping', {
        signal: AbortSignal.timeout(1500)
      })
      if (ping.ok) {
        usandoLocal = true
        onLog('Proxy local detectado en localhost:5001')
      }
    } catch { /* usar edge function */ }

    let res: Response
    if (usandoLocal) {
      res = await fetch('http://localhost:5001/cargar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
    } else {
      onLog('Usando Supabase Edge Function...')
      res = await fetch(edgeFnUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
          'apikey': supabaseKey,
        },
        body: JSON.stringify(payload)
      })
    }

    const data = await res.json()

    if (data.logs) data.logs.forEach((l: string) => onLog(l))

    if (data.success) {
      return { nropedido: String(data.nropedido), estado: 'ok', error: '' }
    } else {
      return { nropedido: '', estado: 'error', error: data.error || 'Error desconocido' }
    }

  } catch (err) {
    onLog(`Error de conexión: ${err}`)
    return { nropedido: '', estado: 'error', error: String(err) }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTES
// ─────────────────────────────────────────────────────────────────────────────

function BadgeEstado({ estado }: { estado: EstadoPedido }) {
  const map: Record<EstadoPedido, { color: string; icon: React.ReactNode; label: string }> = {
    pendiente:   { color: 'bg-dark-700 text-dark-300', icon: null, label: 'Pendiente' },
    procesando:  { color: 'bg-blue-500/20 text-blue-400', icon: <RefreshCw className="w-3 h-3 animate-spin" />, label: 'Procesando' },
    ok:          { color: 'bg-green-500/20 text-green-400', icon: <CheckCircle className="w-3 h-3" />, label: 'OK' },
    error:       { color: 'bg-red-500/20 text-red-400', icon: <XCircle className="w-3 h-3" />, label: 'Error' },
    advertencia: { color: 'bg-yellow-500/20 text-yellow-400', icon: <AlertTriangle className="w-3 h-3" />, label: 'Advertencia' },
  }
  const { color, icon, label } = map[estado]
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${color}`}>
      {icon}{label}
    </span>
  )
}

function FilaPreview({ pedido, resultado, index }: {
  pedido: PedidoAgrupado
  resultado?: ResultadoPedido
  index: number
}) {
  const [expanded, setExpanded] = useState(false)
  const estado: EstadoPedido = resultado?.estado || (pedido.errores.length > 0 ? 'error' : 'pendiente')
  const tieneErroresValidacion = pedido.errores.length > 0

  return (
    <>
      <tr
        onClick={() => setExpanded(e => !e)}
        className={`border-b border-dark-800 hover:bg-dark-800/50 cursor-pointer transition-colors ${tieneErroresValidacion ? 'bg-red-950/20' : ''}`}
      >
        <td className="px-4 py-3 text-dark-500 text-sm">{index + 1}</td>
        <td className="px-4 py-3">
          <span className="text-white font-semibold">{pedido.idcliente}</span>
          <span className="text-dark-500 text-xs ml-1">alias:{pedido.idclialias}</span>
        </td>
        <td className="px-4 py-3 text-dark-300 font-mono text-sm">{pedido.fecentre}</td>
        <td className="px-4 py-3">
          <span className="text-white font-semibold">{pedido.renglones.length}</span>
          <span className="text-dark-500 text-xs ml-1">artículo{pedido.renglones.length !== 1 ? 's' : ''}</span>
        </td>
        <td className="px-4 py-3">
          {Object.keys(pedido.overrides).length > 0 ? (
            <span className="text-xs text-blue-400">{Object.keys(pedido.overrides).join(', ')}</span>
          ) : <span className="text-dark-600 text-xs">—</span>}
        </td>
        <td className="px-4 py-3">
          {tieneErroresValidacion ? (
            <span className="text-red-400 text-xs font-medium">⚠ {pedido.errores.length} error{pedido.errores.length > 1 ? 'es' : ''}</span>
          ) : (
            <BadgeEstado estado={estado} />
          )}
        </td>
        <td className="px-4 py-3 text-dark-300 font-mono text-sm">
          {resultado?.nropedido && resultado.nropedido !== 'PREVIEW' ? (
            <span className="text-green-400 font-bold">#{resultado.nropedido}</span>
          ) : '—'}
        </td>
        <td className="px-4 py-3 text-dark-400">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </td>
      </tr>

      {/* Detalle expandible */}
      {expanded && (
        <tr className="bg-dark-900/60">
          <td colSpan={8} className="px-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Renglones */}
              <div>
                <p className="text-dark-400 text-xs font-medium uppercase tracking-wider mb-2">Artículos</p>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-dark-500 text-xs">
                      <th className="text-left pb-1">Cod. Art.</th>
                      <th className="text-right pb-1">Cant.</th>
                      <th className="text-right pb-1">Bonif%</th>
                      <th className="text-right pb-1">Motivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pedido.renglones.map((r, i) => (
                      <tr key={i} className="border-t border-dark-800">
                        <td className="py-1 text-white font-mono">{r.codart}</td>
                        <td className="py-1 text-right text-dark-300">{r.cant}</td>
                        <td className="py-1 text-right text-yellow-400">{r.bonifpct && r.bonifpct !== '0' && r.bonifpct !== '' ? r.bonifpct + '%' : '—'}</td>
                        <td className="py-1 text-right text-dark-400 text-xs">{r.motivo && MOTIVOS_VALIDOS[r.motivo] ? MOTIVOS_VALIDOS[r.motivo] : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Errores y overrides */}
              <div className="space-y-3">
                {pedido.errores.length > 0 && (
                  <div>
                    <p className="text-red-400 text-xs font-medium uppercase tracking-wider mb-1">Errores de validación</p>
                    {pedido.errores.map((e, i) => (
                      <p key={i} className="text-red-300 text-xs">• {e}</p>
                    ))}
                  </div>
                )}
                {Object.keys(pedido.overrides).length > 0 && (
                  <div>
                    <p className="text-dark-400 text-xs font-medium uppercase tracking-wider mb-1">Overrides de cabecera</p>
                    {Object.entries(pedido.overrides).map(([k, v]) => (
                      <p key={k} className="text-dark-300 text-xs font-mono">{k}: <span className="text-blue-400">{v}</span></p>
                    ))}
                  </div>
                )}
                {resultado?.log && resultado.log.length > 0 && (
                  <div>
                    <p className="text-dark-400 text-xs font-medium uppercase tracking-wider mb-1">Log de ejecución</p>
                    {resultado.log.slice(-4).map((l, i) => (
                      <p key={i} className="text-dark-300 text-xs font-mono">{l}</p>
                    ))}
                  </div>
                )}
                {resultado?.error && (
                  <div>
                    <p className="text-red-400 text-xs font-medium uppercase tracking-wider mb-1">Error</p>
                    <p className="text-red-300 text-xs">{resultado.error}</p>
                  </div>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PÁGINA PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

export default function CargaPedidos() {
  const [pedidos, setPedidos] = useState<PedidoAgrupado[]>([])
  const [resultados, setResultados] = useState<Map<string, ResultadoPedido>>(new Map())
  const [headers, setHeaders] = useState<string[]>([])
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([])
  const [cargando, setCargando] = useState(false)
  const [archivoNombre, setArchivoNombre] = useState('')
  const [error, setError] = useState('')
  const [progresoActual, setProgresoActual] = useState(0)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef(false)

  const procesarArchivo = useCallback((file: File) => {
    setError('')
    setArchivoNombre(file.name)
    setResultados(new Map())
    setProgresoActual(0)

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const texto = e.target?.result as string
        const { headers: hs, rows } = parsearCSV(texto)

        // Verificar columnas obligatorias
        const faltantes = COLS_OBLIGATORIAS.filter(c => !hs.includes(c))
        if (faltantes.length > 0) {
          setError(`Columnas obligatorias faltantes: ${faltantes.join(', ')}`)
          return
        }

        setHeaders(hs)
        setRawRows(rows)
        const agrupados = agruparPedidos(rows, hs)
        const validados = validarPedidos(agrupados)
        setPedidos(validados)
      } catch (err) {
        setError(String(err))
      }
    }
    reader.readAsText(file, 'utf-8')
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file && file.name.endsWith('.csv')) procesarArchivo(file)
    else setError('Solo se aceptan archivos .csv')
  }, [procesarArchivo])

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) procesarArchivo(file)
  }, [procesarArchivo])

  const ejecutarCarga = async () => {
    const pedidosValidos = pedidos.filter(p => p.errores.length === 0)
    if (pedidosValidos.length === 0) { setError('No hay pedidos válidos para cargar'); return }

    setCargando(true); abortRef.current = false; setProgresoActual(0)
    const nuevosResultados = new Map(resultados)

    for (let i = 0; i < pedidosValidos.length; i++) {
      if (abortRef.current) break
      const pedido = pedidosValidos[i]
      const logs: string[] = []

      // Marcar como procesando
      nuevosResultados.set(pedido.key, { key: pedido.key, idcliente: pedido.idcliente, fecentre: pedido.fecentre, nropedido: '', estado: 'procesando', error: '', log: [] })
      setResultados(new Map(nuevosResultados))

      const resultado = await procesarPedidoERP(pedido, (msg) => { logs.push(msg) })
      nuevosResultados.set(pedido.key, { ...resultado, key: pedido.key, idcliente: pedido.idcliente, fecentre: pedido.fecentre, log: logs })
      setResultados(new Map(nuevosResultados))
      setProgresoActual(i + 1)
    }

    setCargando(false)
  }

  const limpiar = () => {
    setPedidos([]); setResultados(new Map()); setHeaders([]); setRawRows([])
    setArchivoNombre(''); setError(''); setProgresoActual(0)
    if (fileRef.current) fileRef.current.value = ''
  }

  // Stats
  const pedidosValidos = pedidos.filter(p => p.errores.length === 0).length
  const pedidosConError = pedidos.filter(p => p.errores.length > 0).length
  const totalArticulos = pedidos.reduce((s, p) => s + p.renglones.length, 0)
  const resOk = [...resultados.values()].filter(r => r.estado === 'ok').length
  const resError = [...resultados.values()].filter(r => r.estado === 'error').length
  const resAdvert = [...resultados.values()].filter(r => r.estado === 'advertencia').length
  const hayResultados = resultados.size > 0
  const progresoPct = pedidosValidos > 0 ? Math.round((progresoActual / pedidosValidos) * 100) : 0

  return (
    <Layout>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Carga de Pedidos ERP</h1>
            <p className="text-dark-400 text-sm mt-1">Chess ERP — VAFOOD SRL · Carga masiva via CSV</p>
          </div>
          {pedidos.length > 0 && (
            <div className="flex gap-2">
              {hayResultados && (
                <button onClick={() => descargarCSV([...resultados.values()])} className="btn-secondary px-3 py-2 rounded-lg text-sm flex items-center gap-2">
                  <Download className="w-4 h-4" /> Exportar log
                </button>
              )}
              <button onClick={limpiar} className="btn-secondary px-3 py-2 rounded-lg text-sm flex items-center gap-2">
                <Trash2 className="w-4 h-4" /> Limpiar
              </button>
            </div>
          )}
        </div>

        {/* Drop zone */}
        {pedidos.length === 0 && (
          <div
            onDrop={handleDrop} onDragOver={(e) => { e.preventDefault(); setDragOver(true) }} onDragLeave={() => setDragOver(false)}
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors mb-6 ${dragOver ? 'border-primary-500 bg-primary-500/10' : 'border-dark-600 hover:border-dark-500 hover:bg-dark-800/30'}`}
          >
            <Upload className="w-12 h-12 text-dark-500 mx-auto mb-4" />
            <p className="text-white font-semibold text-lg mb-1">Arrastrá o hacé click para subir el CSV</p>
            <p className="text-dark-400 text-sm mb-3">Separador: punto y coma (;) · Codificación: UTF-8</p>
            <div className="inline-flex gap-4 text-xs text-dark-500">
              <span>✓ idcliente</span><span>✓ idclialias</span><span>✓ fecentre</span><span>✓ codart</span><span>✓ cant</span>
            </div>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
          </div>
        )}

        {/* Error global */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-4 flex items-start gap-3">
            <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-400 font-semibold text-sm">Error al procesar el archivo</p>
              <p className="text-red-300 text-sm mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Preview cargado */}
        {pedidos.length > 0 && (
          <>
            {/* Info del archivo */}
            <div className="card rounded-xl p-4 mb-4 flex items-center gap-4">
              <FileText className="w-8 h-8 text-primary-400 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-white font-semibold">{archivoNombre}</p>
                <p className="text-dark-400 text-sm">{rawRows.length} filas · {pedidos.length} pedidos agrupados · {totalArticulos} artículos totales</p>
              </div>
              <button onClick={() => fileRef.current?.click()} className="text-xs text-dark-400 hover:text-white transition-colors flex items-center gap-1">
                <RefreshCw className="w-3 h-3" /> Cambiar archivo
              </button>
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div className="card rounded-xl p-4">
                <p className="text-2xl font-bold text-white">{pedidos.length}</p>
                <p className="text-dark-400 text-sm">Pedidos totales</p>
              </div>
              <div className={`card rounded-xl p-4 ${pedidosValidos > 0 ? 'border-green-500/20' : ''}`}>
                <p className="text-2xl font-bold text-green-400">{pedidosValidos}</p>
                <p className="text-dark-400 text-sm">Válidos para cargar</p>
              </div>
              <div className={`card rounded-xl p-4 ${pedidosConError > 0 ? 'border-red-500/20' : ''}`}>
                <p className={`text-2xl font-bold ${pedidosConError > 0 ? 'text-red-400' : 'text-dark-500'}`}>{pedidosConError}</p>
                <p className="text-dark-400 text-sm">Con errores</p>
              </div>
              <div className="card rounded-xl p-4">
                <p className="text-2xl font-bold text-primary-400">{totalArticulos}</p>
                <p className="text-dark-400 text-sm">Artículos totales</p>
              </div>
            </div>

            {/* Progreso (durante carga) */}
            {cargando && (
              <div className="card rounded-xl p-4 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white text-sm font-medium">Cargando pedidos...</span>
                  <span className="text-dark-400 text-sm">{progresoActual}/{pedidosValidos} ({progresoPct}%)</span>
                </div>
                <div className="h-2 bg-dark-700 rounded-full overflow-hidden">
                  <div className="h-full bg-primary-500 rounded-full transition-all duration-500" style={{ width: `${progresoPct}%` }} />
                </div>
                <button onClick={() => { abortRef.current = true }} className="mt-2 text-xs text-red-400 hover:text-red-300 transition-colors">
                  ✕ Cancelar
                </button>
              </div>
            )}

            {/* Resultado resumen (post carga) */}
            {hayResultados && !cargando && (
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="card rounded-xl p-3 border-green-500/20 flex items-center gap-3">
                  <CheckCircle className="w-6 h-6 text-green-400" />
                  <div><p className="text-xl font-bold text-green-400">{resOk}</p><p className="text-dark-400 text-xs">Grabados OK</p></div>
                </div>
                <div className="card rounded-xl p-3 border-yellow-500/20 flex items-center gap-3">
                  <AlertTriangle className="w-6 h-6 text-yellow-400" />
                  <div><p className="text-xl font-bold text-yellow-400">{resAdvert}</p><p className="text-dark-400 text-xs">Advertencias</p></div>
                </div>
                <div className="card rounded-xl p-3 border-red-500/20 flex items-center gap-3">
                  <XCircle className="w-6 h-6 text-red-400" />
                  <div><p className="text-xl font-bold text-red-400">{resError}</p><p className="text-dark-400 text-xs">Errores</p></div>
                </div>
              </div>
            )}

            {/* Botón cargar */}
            {!cargando && pedidosValidos > 0 && (
              <div className="flex justify-end mb-4">
                <button onClick={ejecutarCarga} disabled={cargando}
                  className="btn-primary px-6 py-2.5 rounded-lg font-semibold flex items-center gap-2 disabled:opacity-50">
                  <Play className="w-4 h-4" />
                  Cargar {pedidosValidos} pedido{pedidosValidos !== 1 ? 's' : ''} al ERP
                </button>
              </div>
            )}

            

            {/* Tabla de preview */}
            <div className="card rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-dark-700 flex items-center justify-between">
                <h2 className="text-white font-semibold">Preview de pedidos</h2>
                <span className="text-dark-400 text-sm">Click en una fila para ver el detalle</span>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-dark-700">
                    <th className="text-left px-4 py-3 text-dark-400 text-xs font-medium uppercase tracking-wider w-10">#</th>
                    <th className="text-left px-4 py-3 text-dark-400 text-xs font-medium uppercase tracking-wider">Cliente</th>
                    <th className="text-left px-4 py-3 text-dark-400 text-xs font-medium uppercase tracking-wider">Fecha entrega</th>
                    <th className="text-left px-4 py-3 text-dark-400 text-xs font-medium uppercase tracking-wider">Artículos</th>
                    <th className="text-left px-4 py-3 text-dark-400 text-xs font-medium uppercase tracking-wider">Overrides</th>
                    <th className="text-left px-4 py-3 text-dark-400 text-xs font-medium uppercase tracking-wider">Estado</th>
                    <th className="text-left px-4 py-3 text-dark-400 text-xs font-medium uppercase tracking-wider">Nro. Pedido</th>
                    <th className="w-8 px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {pedidos.map((pedido, i) => (
                    <FilaPreview key={pedido.key} pedido={pedido} resultado={resultados.get(pedido.key)} index={i} />
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </Layout>
  )
}
