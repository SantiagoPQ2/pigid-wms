import { useState, useEffect, useCallback } from 'react'
import Layout from '../../components/layout/Layout'
import { supabase } from '../../lib/supabase'
import * as XLSX from 'xlsx'
import {
  Truck, Plus, RefreshCw, Save, ChevronDown, ChevronUp,
  MapPin, Package, AlertTriangle, CheckCircle, X, Search,
  ArrowRight, Loader2, Info, Settings, Calendar, Download,
  FileSpreadsheet
} from 'lucide-react'

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface Deposito  { iddepo: number; nombre: string }
interface Entorno   { identorno: number; nombre: string; detalle: string }
interface Transporte {
  idcliente: number; nomcli: string; chapa: string
  modelo: string; propio: boolean; iddepo: number; maxpeso: number
}
interface Reparto {
  idreparto: number; idtransp: number; dstransp: string
  totcnt: number; totpes: number; totval: number; totpdv: number; bloqueada: boolean
}
interface PtoEntrega {
  idcliente: number; cpbte: string; dscliente: string; fantacli: string
  fecha: string; idreparto: number; idtransp: number; dstransp: string
  calle: string; altura: number; dslocalidad: string; dsprovincia: string
  xcoord: string; ycoord: string; ruta: number; rutadis: number
  totcnt: number; totpes: number; totval: number; totped: number
  detallecpbte: string; bloqueada: boolean
}
interface Config {
  fecha: string; iddepo: number; dsdepo: string; identorno: number; dsentorno: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function callEdge(accion: string, extra: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke('ruteo-chess', {
    body: { accion, ...extra },
  })
  if (error) throw new Error(error.message)
  if (data?.error) throw new Error(data.error)
  return data
}

function hoy() { return new Date().toISOString().slice(0, 10) }
function fmtPeso(n: number) { return (n||0).toLocaleString('es-AR', {maximumFractionDigits:1}) + ' kg' }
function fmtImp(n: number) { return '$' + (n||0).toLocaleString('es-AR', {maximumFractionDigits:0}) }

// ─── Export XLSX ──────────────────────────────────────────────────────────────
function exportarPedidosXlsx(ptos: PtoEntrega[], config: Config) {
  const rows = ptos.map(p => ({
    'Cód. Cliente':  p.idcliente,
    'Cliente':       p.dscliente,
    'Fantasía':      p.fantacli,
    'Comprobante':   p.cpbte,
    'Detalle':       p.detallecpbte,
    'Fecha':         p.fecha,
    'Dirección':     `${p.calle} ${p.altura}`,
    'Localidad':     p.dslocalidad,
    'Provincia':     p.dsprovincia,
    'Latitud':       p.ycoord,
    'Longitud':      p.xcoord,
    'Ruta':          p.ruta,
    'Ruta Dist.':    p.rutadis,
    'Reparto':       p.idreparto,
    'Transporte':    p.dstransp,
    'Cant.':         p.totcnt,
    'Peso (kg)':     p.totpes,
    'Importe ($)':   p.totval,
    'Pedidos':       p.totped,
    'Bloqueada':     p.bloqueada ? 'Sí' : 'No',
  }))
  const ws = XLSX.utils.json_to_sheet(rows)
  // Anchos de columna
  ws['!cols'] = [
    {wch:12},{wch:28},{wch:20},{wch:22},{wch:35},{wch:12},
    {wch:28},{wch:20},{wch:16},{wch:12},{wch:12},{wch:8},
    {wch:10},{wch:10},{wch:28},{wch:8},{wch:10},{wch:14},{wch:8},{wch:10}
  ]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Pedidos')
  XLSX.writeFile(wb, `pedidos_${config.fecha}_ent${config.identorno}.xlsx`)
}

function exportarRepartosXlsx(repartos: Reparto[], ptos: PtoEntrega[], config: Config) {
  const wb = XLSX.utils.book_new()
  // Hoja resumen de repartos
  const resumen = repartos.map(r => ({
    'Reparto':      r.idreparto,
    'Transporte':   r.dstransp,
    'PDEs':         ptos.filter(p => p.idreparto === r.idreparto).length,
    'Cant.':        r.totcnt,
    'Peso (kg)':    r.totpes,
    'Importe ($)':  r.totval,
    'Bloqueado':    r.bloqueada ? 'Sí' : 'No',
  }))
  const wsRes = XLSX.utils.json_to_sheet(resumen)
  wsRes['!cols'] = [{wch:10},{wch:30},{wch:8},{wch:8},{wch:10},{wch:14},{wch:10}]
  XLSX.utils.book_append_sheet(wb, wsRes, 'Repartos')
  // Una hoja por reparto con sus pedidos
  for (const r of repartos) {
    const ptosRep = ptos.filter(p => p.idreparto === r.idreparto)
    if (!ptosRep.length) continue
    const rows = ptosRep.map(p => ({
      'Cód. Cliente': p.idcliente,
      'Cliente':      p.dscliente,
      'Comprobante':  p.cpbte,
      'Dirección':    `${p.calle} ${p.altura}`,
      'Localidad':    p.dslocalidad,
      'Latitud':      p.ycoord,
      'Longitud':     p.xcoord,
      'Ruta':         p.ruta,
      'Cant.':        p.totcnt,
      'Peso (kg)':    p.totpes,
      'Importe ($)':  p.totval,
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [{wch:12},{wch:28},{wch:22},{wch:28},{wch:20},{wch:12},{wch:12},{wch:8},{wch:8},{wch:10},{wch:14}]
    // Nombre de hoja limitado a 31 chars (límite Excel)
    const nombre = `${r.idreparto}-${r.dstransp}`.substring(0, 31)
    XLSX.utils.book_append_sheet(wb, ws, nombre)
  }
  XLSX.writeFile(wb, `repartos_${config.fecha}_ent${config.identorno}.xlsx`)
}

// ─── Modal config inicial ─────────────────────────────────────────────────────
function ModalConfig({ depositos, entornos, onAceptar, cargando }: {
  depositos: Deposito[]; entornos: Entorno[]
  onAceptar: (cfg: Config) => void; cargando: boolean
}) {
  const [fecha,     setFecha]     = useState(hoy())
  const [iddepo,    setIddepo]    = useState<number>(1)
  const [identorno, setIdentorno] = useState<number>(1)

  useEffect(() => { if (depositos.length) setIddepo(depositos[0].iddepo) }, [depositos])
  useEffect(() => { if (entornos.length)  setIdentorno(entornos[0].identorno) }, [entornos])

  const depoSel    = depositos.find(d => d.iddepo === iddepo)
  const entornoSel = entornos.find(e => e.identorno === identorno)

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70">
      <div className="w-full max-w-lg bg-dark-800 rounded-2xl border border-dark-600 shadow-2xl">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-dark-700">
          <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
            <Truck className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-white font-semibold">Seleccionar entorno de distribución</h2>
            <p className="text-xs text-dark-400">Configurá fecha, depósito y entorno</p>
          </div>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-dark-300 mb-1.5">Fecha de entrega *</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
              <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
                className="w-full bg-dark-700 border border-dark-600 text-white text-sm rounded-lg pl-9 pr-3 py-2.5 focus:outline-none focus:border-primary-500" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-dark-300 mb-1.5">Depósito *</label>
            {cargando
              ? <div className="bg-dark-700 border border-dark-600 rounded-lg px-3 py-2.5 flex items-center gap-2 text-dark-400 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Cargando...</div>
              : <select value={iddepo} onChange={e => setIddepo(Number(e.target.value))}
                  className="w-full bg-dark-700 border border-dark-600 text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-primary-500">
                  {depositos.map(d => <option key={d.iddepo} value={d.iddepo}>{d.nombre}</option>)}
                </select>
            }
          </div>
          <div>
            <label className="block text-xs font-medium text-dark-300 mb-1.5">Entorno de Distribución</label>
            <div className="border border-dark-600 rounded-xl overflow-hidden">
              <div className="grid grid-cols-3 bg-dark-700 px-3 py-2 text-xs font-medium text-dark-400 border-b border-dark-600">
                <span>NRO</span><span>DESCRIPCIÓN</span><span>DETALLE</span>
              </div>
              <div className="max-h-40 overflow-y-auto divide-y divide-dark-700/50">
                {entornos.map(e => (
                  <div key={e.identorno} onClick={() => setIdentorno(e.identorno)}
                    className={`grid grid-cols-3 px-3 py-2.5 text-sm cursor-pointer transition-colors
                      ${identorno === e.identorno ? 'bg-primary-900/30 text-primary-300' : 'text-dark-300 hover:bg-dark-700'}`}>
                    <span>{e.identorno}</span>
                    <span className="font-medium">{e.nombre}</span>
                    <span className="text-dark-500 text-xs truncate">{e.detalle}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-dark-700 flex justify-end">
          <button onClick={() => onAceptar({ fecha, iddepo, dsdepo: depoSel?.nombre ?? String(iddepo), identorno, dsentorno: entornoSel?.nombre ?? String(identorno) })}
            disabled={cargando || !fecha}
            className="flex items-center gap-2 bg-primary-600 hover:bg-primary-500 disabled:opacity-50 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors">
            <CheckCircle className="w-4 h-4" /> Aceptar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Tarjeta camión ───────────────────────────────────────────────────────────
function TarjetaCamion({ reparto, ptos, seleccionado, onClick, onQuitarPto }: {
  reparto: Reparto; ptos: PtoEntrega[]; seleccionado: boolean
  onClick: () => void; onQuitarPto: (cpbte: string) => void
}) {
  const [expandido, setExpandido] = useState(false)
  const ptosRep = ptos.filter(p => p.idreparto === reparto.idreparto)

  return (
    <div className={`rounded-xl border transition-all cursor-pointer
      ${seleccionado ? 'border-primary-500 bg-primary-900/20 ring-1 ring-primary-500/40' : 'border-dark-600 bg-dark-800 hover:border-dark-500'}`}>
      <div className="p-3 flex items-center gap-3" onClick={onClick}>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${seleccionado ? 'bg-primary-600' : 'bg-dark-700'}`}>
          <Truck className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">{reparto.dstransp}</p>
          <p className="text-xs text-dark-400">Reparto #{reparto.idreparto} · {ptosRep.length} PDE</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs text-dark-400">{fmtPeso(reparto.totpes)}</p>
          <p className="text-xs text-green-400">{fmtImp(reparto.totval)}</p>
        </div>
        <button className="text-dark-500 hover:text-white ml-1 p-1"
          onClick={e => { e.stopPropagation(); setExpandido(v => !v) }}>
          {expandido ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>
      {expandido && (
        <div className="border-t border-dark-700 divide-y divide-dark-700/50">
          {ptosRep.length === 0 && <p className="text-xs text-dark-500 px-4 py-3 text-center">Sin pedidos asignados</p>}
          {ptosRep.map(p => (
            <div key={p.cpbte} className="flex items-center gap-2 px-4 py-2">
              <MapPin className="w-3 h-3 text-dark-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white truncate">
                  <span className="text-dark-400 mr-1">[{p.idcliente}]</span>{p.dscliente}
                </p>
                <p className="text-xs text-dark-500 truncate">{p.cpbte} · {p.calle} {p.altura}, {p.dslocalidad}</p>
              </div>
              <button onClick={e => { e.stopPropagation(); onQuitarPto(p.cpbte) }}
                className="text-dark-600 hover:text-red-400 transition-colors p-0.5 shrink-0">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function RuteoAutomatico() {
  const [configCargando, setConfigCargando] = useState(true)
  const [depositos,       setDepositos]     = useState<Deposito[]>([])
  const [entornos,        setEntornos]      = useState<Entorno[]>([])
  const [transportesDisp, setTransportesDisp] = useState<Transporte[]>([])
  const [config,          setConfig]        = useState<Config | null>(null)

  const [repartos,     setRepartos]    = useState<Reparto[]>([])
  const [ptosEntrega,  setPtosEntrega] = useState<PtoEntrega[]>([])
  const [reasignaciones, setReasignaciones] = useState<Map<string, { cpbte: string; idreparto: number; idtransp: number }>>(new Map())

  const [cargandoDist,    setCargandoDist]    = useState(false)
  const [guardando,       setGuardando]       = useState(false)
  const [error,           setError]           = useState('')
  const [exito,           setExito]           = useState('')
  const [repartoSelec,    setRepartoSelec]    = useState<number | null>(null)
  const [busqueda,        setBusqueda]        = useState('')
  const [filtroPendientes,setFiltroPendientes]= useState(false)

  // Modal transportes
  const [modalTransporte, setModalTransporte]   = useState(false)
  const [busqTransporte,  setBusqTransporte]    = useState('')
  const [selecTransportes,setSelecTransportes]  = useState<Set<number>>(new Set())
  const [agregando,       setAgregando]         = useState(false)

  // ── Config inicial
  useEffect(() => {
    setConfigCargando(true)
    callEdge('get_config')
      .then(data => {
        setDepositos(Array.isArray(data.depositos) ? data.depositos : [])
        setEntornos(Array.isArray(data.entornos) ? data.entornos : [])
        setTransportesDisp(Array.isArray(data.transportes) ? data.transportes : [])
      })
      .catch(e => setError(e.message))
      .finally(() => setConfigCargando(false))
  }, [])

  // ── Cargar distribución
  const cargarDistribucion = useCallback(async (cfg: Config) => {
    setCargandoDist(true); setError('')
    try {
      const data = await callEdge('get_distribucion', { fecha: cfg.fecha, iddepo: cfg.iddepo, identorno: cfg.identorno })
      setRepartos(data.repartos ?? [])
      setPtosEntrega(data.ptos_entrega ?? [])
      setReasignaciones(new Map())
      setRepartoSelec(null)
    } catch (e: any) { setError(e.message) }
    finally { setCargandoDist(false) }
  }, [])

  const handleAceptarConfig = (cfg: Config) => { setConfig(cfg); cargarDistribucion(cfg) }

  // ── Agregar transportes (múltiples a la vez)
  const agregarTransportes = async () => {
    if (!config || selecTransportes.size === 0) return
    setAgregando(true); setError('')
    const nuevos: Reparto[] = []
    try {
      for (const idcliente of selecTransportes) {
        const data = await callEdge('agregar_transporte', { idtransporte: idcliente, iddepo: config.iddepo })
        nuevos.push(data.reparto)
      }
      setRepartos(prev => [...prev, ...nuevos])
      setModalTransporte(false)
      setSelecTransportes(new Set())
      setExito(`✅ ${nuevos.length} transporte${nuevos.length !== 1 ? 's' : ''} agregado${nuevos.length !== 1 ? 's' : ''} correctamente`)
      setTimeout(() => setExito(''), 4000)
    } catch (e: any) { setError(e.message) }
    finally { setAgregando(false) }
  }

  // ── Asignar pedido
  const asignarPto = (pto: PtoEntrega) => {
    if (repartoSelec === null) return
    const reparto = repartos.find(r => r.idreparto === repartoSelec)
    if (!reparto) return
    setPtosEntrega(prev => prev.map(p => p.cpbte === pto.cpbte
      ? { ...p, idreparto: reparto.idreparto, idtransp: reparto.idtransp, dstransp: reparto.dstransp } : p))
    setReasignaciones(prev => { const n = new Map(prev); n.set(pto.cpbte, { cpbte: pto.cpbte, idreparto: reparto.idreparto, idtransp: reparto.idtransp }); return n })
  }

  // ── Quitar pedido
  const quitarPto = (cpbte: string) => {
    setPtosEntrega(prev => prev.map(p => p.cpbte === cpbte ? { ...p, idreparto: 0, idtransp: 0, dstransp: 'Sin asignar' } : p))
    setReasignaciones(prev => { const n = new Map(prev); n.set(cpbte, { cpbte, idreparto: 0, idtransp: 0 }); return n })
  }

  // ── Guardar
  const guardar = async () => {
    if (!config || reasignaciones.size === 0) return
    setGuardando(true); setError('')
    try {
      const lista = Array.from(reasignaciones.values())
      const data = await callEdge('guardar_distribucion', { fecha: config.fecha, iddepo: config.iddepo, identorno: config.identorno, reasignaciones: lista })
      setReasignaciones(new Map())
      setExito(`✅ ${data.reasignados} pedido${data.reasignados !== 1 ? 's' : ''} guardado${data.reasignados !== 1 ? 's' : ''} en Chess`)
      setTimeout(() => setExito(''), 5000)
    } catch (e: any) { setError(e.message) }
    finally { setGuardando(false) }
  }

  // ── Filtros
  const ptosFiltrados = ptosEntrega.filter(p => {
    if (filtroPendientes && p.idreparto !== 0) return false
    if (!busqueda) return true
    const q = busqueda.toLowerCase()
    return (
      String(p.idcliente).includes(q) ||
      p.dscliente?.toLowerCase().includes(q) ||
      p.fantacli?.toLowerCase().includes(q) ||
      p.cpbte?.toLowerCase().includes(q) ||
      p.dslocalidad?.toLowerCase().includes(q) ||
      p.dstransp?.toLowerCase().includes(q) ||
      p.calle?.toLowerCase().includes(q)
    )
  })

  const idsConReparto = new Set(repartos.map(r => r.idtransp))
  const transportesFiltrados = transportesDisp.filter(t =>
    !idsConReparto.has(t.idcliente) &&
    (!busqTransporte || [String(t.idcliente), t.nomcli, t.chapa, t.modelo].join(' ').toLowerCase().includes(busqTransporte.toLowerCase()))
  )

  const hayPendientes   = reasignaciones.size > 0
  const sinAsignarCount = ptosEntrega.filter(p => !p.idreparto || p.idreparto === 0).length

  const toggleTransporte = (id: number) => {
    setSelecTransportes(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  return (
    <Layout>
      {!config && (
        <ModalConfig depositos={depositos} entornos={entornos}
          onAceptar={handleAceptarConfig} cargando={configCargando} />
      )}

      <div className="max-w-screen-xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Truck className="w-5 h-5 text-primary-400" /> Ruteo Automático
            </h1>
            {config && <p className="text-sm text-dark-400 mt-0.5">{config.fecha} · {config.dsdepo} · {config.dsentorno}</p>}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => setConfig(null)}
              className="flex items-center gap-2 bg-dark-700 hover:bg-dark-600 text-white text-sm px-3 py-2 rounded-lg border border-dark-600 transition-colors">
              <Settings className="w-4 h-4" /> Cambiar entorno
            </button>
            <button onClick={() => config && cargarDistribucion(config)} disabled={cargandoDist || !config}
              className="flex items-center gap-2 bg-dark-700 hover:bg-dark-600 text-white text-sm px-3 py-2 rounded-lg border border-dark-600 transition-colors disabled:opacity-50">
              <RefreshCw className={`w-4 h-4 ${cargandoDist ? 'animate-spin' : ''}`} /> Recargar
            </button>
            <button onClick={() => setModalTransporte(true)} disabled={!config}
              className="flex items-center gap-2 bg-dark-700 hover:bg-dark-600 text-white text-sm px-3 py-2 rounded-lg border border-dark-600 transition-colors disabled:opacity-50">
              <Plus className="w-4 h-4 text-primary-400" /> Transporte
            </button>
            {config && repartos.length > 0 && (
              <button onClick={() => exportarRepartosXlsx(repartos, ptosEntrega, config)}
                className="flex items-center gap-2 bg-dark-700 hover:bg-dark-600 text-white text-sm px-3 py-2 rounded-lg border border-dark-600 transition-colors">
                <FileSpreadsheet className="w-4 h-4 text-green-400" /> Repartos
              </button>
            )}
            <button onClick={guardar} disabled={!hayPendientes || guardando}
              className={`flex items-center gap-2 text-sm px-4 py-2 rounded-lg font-medium transition-colors
                ${hayPendientes ? 'bg-primary-600 hover:bg-primary-500 text-white' : 'bg-dark-700 text-dark-500 border border-dark-600 cursor-not-allowed'}`}>
              {guardando ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</> : <><Save className="w-4 h-4" /> Guardar{hayPendientes ? ` (${reasignaciones.size})` : ''}</>}
            </button>
          </div>
        </div>

        {/* Alertas */}
        {error && (
          <div className="mb-4 flex items-start gap-2 bg-red-900/20 border border-red-700/40 text-red-300 text-sm px-4 py-3 rounded-xl">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /><span>{error}</span>
            <button onClick={() => setError('')} className="ml-auto"><X className="w-4 h-4" /></button>
          </div>
        )}
        {exito && (
          <div className="mb-4 flex items-center gap-2 bg-green-900/20 border border-green-700/40 text-green-300 text-sm px-4 py-3 rounded-xl">
            <CheckCircle className="w-4 h-4" /><span>{exito}</span>
          </div>
        )}
        {hayPendientes && (
          <div className="mb-4 flex items-center gap-2 bg-yellow-900/20 border border-yellow-700/40 text-yellow-300 text-sm px-4 py-3 rounded-xl">
            <Info className="w-4 h-4" />
            <span>{reasignaciones.size} cambio{reasignaciones.size !== 1 ? 's' : ''} pendiente{reasignaciones.size !== 1 ? 's' : ''} sin guardar</span>
          </div>
        )}
        {repartoSelec !== null && (
          <div className="mb-4 flex items-center gap-2 bg-primary-900/20 border border-primary-700/40 text-primary-300 text-sm px-4 py-3 rounded-xl">
            <ArrowRight className="w-4 h-4" />
            <span>Destino: <strong>{repartos.find(r => r.idreparto === repartoSelec)?.dstransp}</strong> — Hacé click en un pedido para asignarlo</span>
            <button onClick={() => setRepartoSelec(null)} className="ml-auto"><X className="w-4 h-4" /></button>
          </div>
        )}

        {/* Layout 2 columnas */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Transportes */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-dark-300 uppercase tracking-wider">Transportes ({repartos.length})</h2>
              <p className="text-xs text-dark-500">Click para seleccionar destino</p>
            </div>
            {cargandoDist
              ? <div className="flex items-center justify-center py-16 text-dark-500"><Loader2 className="w-6 h-6 animate-spin mr-2" /> Cargando...</div>
              : (
                <div className="space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
                  {repartos.map(r => (
                    <TarjetaCamion key={r.idreparto} reparto={r} ptos={ptosEntrega}
                      seleccionado={repartoSelec === r.idreparto}
                      onClick={() => setRepartoSelec(prev => prev === r.idreparto ? null : r.idreparto)}
                      onQuitarPto={quitarPto} />
                  ))}
                  {repartos.length === 0 && !cargandoDist && (
                    <div className="text-center py-12 text-dark-500">
                      <Truck className="w-10 h-10 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">No hay transportes para esta fecha</p>
                    </div>
                  )}
                </div>
              )
            }
          </div>

          {/* Pedidos */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-dark-300 uppercase tracking-wider">
                Pedidos ({ptosFiltrados.length} / {ptosEntrega.length})
              </h2>
              <div className="flex items-center gap-2">
                {sinAsignarCount > 0 && (
                  <button onClick={() => setFiltroPendientes(v => !v)}
                    className={`text-xs px-2 py-1 rounded-lg transition-colors
                      ${filtroPendientes ? 'bg-red-800/50 text-red-300' : 'bg-dark-700 text-dark-400 hover:text-white'}`}>
                    {sinAsignarCount} sin asignar
                  </button>
                )}
                {config && ptosEntrega.length > 0 && (
                  <button onClick={() => exportarPedidosXlsx(ptosFiltrados, config)}
                    className="flex items-center gap-1.5 text-xs bg-dark-700 hover:bg-dark-600 text-green-400 px-2 py-1 rounded-lg border border-dark-600 transition-colors">
                    <Download className="w-3 h-3" /> xlsx
                  </button>
                )}
              </div>
            </div>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
              <input type="text" placeholder="Buscar por cód. cliente, nombre, comprobante, localidad..."
                value={busqueda} onChange={e => setBusqueda(e.target.value)}
                className="w-full bg-dark-800 border border-dark-600 text-white text-sm rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:border-primary-500" />
            </div>
            <div className="space-y-1.5 max-h-[calc(100vh-330px)] overflow-y-auto pr-1">
              {ptosFiltrados.map(p => {
                const pendiente  = reasignaciones.has(p.cpbte)
                const sinAsignar = !p.idreparto || p.idreparto === 0
                const asignable  = repartoSelec !== null
                const tieneCoords = p.xcoord && p.ycoord && p.xcoord !== '0' && p.ycoord !== '0'
                return (
                  <div key={p.cpbte} onClick={() => asignable && asignarPto(p)}
                    className={`rounded-lg border px-3 py-2.5 transition-all
                      ${asignable ? 'cursor-pointer' : 'cursor-default'}
                      ${pendiente ? 'border-yellow-600/50 bg-yellow-900/10'
                        : sinAsignar ? 'border-red-700/30 bg-red-900/10'
                        : 'border-dark-700 bg-dark-800'}
                      ${asignable ? 'hover:border-primary-500/60 hover:bg-primary-900/10' : ''}
                    `}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-mono text-dark-400">[{p.idcliente}]</span>
                          <span className="text-xs font-medium text-white truncate">{p.dscliente}</span>
                          {p.fantacli && <span className="text-xs text-dark-500 truncate">· {p.fantacli}</span>}
                          {pendiente   && <span className="text-xs bg-yellow-800/50 text-yellow-300 px-1.5 py-0.5 rounded">pendiente</span>}
                          {sinAsignar  && <span className="text-xs bg-red-800/50 text-red-300 px-1.5 py-0.5 rounded">sin asignar</span>}
                          {tieneCoords && <span title={`${p.ycoord}, ${p.xcoord}`}><MapPin className="w-3 h-3 text-blue-400 shrink-0" /></span>}
                        </div>
                        <p className="text-xs text-dark-500 mt-0.5 truncate">{p.cpbte} · {p.calle} {p.altura}, {p.dslocalidad}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-dark-400">{fmtImp(p.totval)}</p>
                        <p className="text-xs text-dark-500 mt-0.5 truncate max-w-[110px]">{p.dstransp}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
              {ptosFiltrados.length === 0 && (
                <div className="text-center py-12 text-dark-500">
                  <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No hay pedidos{busqueda ? ' que coincidan' : ''}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal agregar transportes (múltiple) */}
      {modalTransporte && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => { setModalTransporte(false); setSelecTransportes(new Set()) }} />
          <div className="relative w-full max-w-lg bg-dark-800 rounded-2xl border border-dark-600 shadow-2xl flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-dark-700">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <Plus className="w-4 h-4 text-primary-400" />
                Agregar transportes
                {selecTransportes.size > 0 && (
                  <span className="bg-primary-600 text-white text-xs px-2 py-0.5 rounded-full">{selecTransportes.size} seleccionado{selecTransportes.size !== 1 ? 's' : ''}</span>
                )}
              </h3>
              <button onClick={() => { setModalTransporte(false); setSelecTransportes(new Set()) }} className="text-dark-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-5 py-3 border-b border-dark-700">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
                <input type="text" placeholder="Buscar por id, nombre, chapa, modelo..."
                  value={busqTransporte} onChange={e => setBusqTransporte(e.target.value)}
                  className="w-full bg-dark-700 border border-dark-600 text-white text-sm rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:border-primary-500"
                  autoFocus />
              </div>
            </div>
            <div className="overflow-y-auto flex-1 divide-y divide-dark-700/50">
              {transportesFiltrados.length === 0 && (
                <p className="text-center text-dark-500 text-sm py-8">
                  {busqTransporte ? 'Sin resultados' : 'Todos los transportes ya están agregados'}
                </p>
              )}
              {transportesFiltrados.map(t => {
                const selec = selecTransportes.has(t.idcliente)
                return (
                  <div key={t.idcliente} onClick={() => toggleTransporte(t.idcliente)}
                    className={`flex items-center gap-3 px-5 py-3 cursor-pointer transition-colors
                      ${selec ? 'bg-primary-900/20 border-l-2 border-primary-500' : 'hover:bg-dark-700/50'}`}>
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors
                      ${selec ? 'bg-primary-600 border-primary-600' : 'border-dark-500'}`}>
                      {selec && <CheckCircle className="w-3 h-3 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white">
                        <span className="text-dark-400 font-mono text-xs mr-1">[{t.idcliente}]</span>
                        {t.nomcli}
                      </p>
                      <p className="text-xs text-dark-500">{t.chapa} · {t.modelo} · {t.propio ? 'Propio' : 'Externo'} · {fmtPeso(t.maxpeso)} máx</p>
                    </div>
                  </div>
                )
              })}
            </div>
            {/* Footer con exportar + agregar */}
            <div className="px-5 py-4 border-t border-dark-700 flex items-center justify-between gap-3">
              {selecTransportes.size > 0 && config && (
                <button
                  onClick={() => {
                    const selRepartos = repartos.filter(r => selecTransportes.has(r.idtransp))
                    if (selRepartos.length) exportarRepartosXlsx(selRepartos, ptosEntrega, config)
                  }}
                  className="flex items-center gap-1.5 text-sm text-green-400 bg-dark-700 hover:bg-dark-600 border border-dark-600 px-3 py-2 rounded-lg transition-colors">
                  <FileSpreadsheet className="w-4 h-4" /> Exportar selección
                </button>
              )}
              <button onClick={agregarTransportes} disabled={selecTransportes.size === 0 || agregando}
                className="flex items-center gap-2 bg-primary-600 hover:bg-primary-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors ml-auto">
                {agregando ? <><Loader2 className="w-4 h-4 animate-spin" /> Agregando...</> : <><Plus className="w-4 h-4" /> Agregar {selecTransportes.size > 0 ? `(${selecTransportes.size})` : ''}</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
