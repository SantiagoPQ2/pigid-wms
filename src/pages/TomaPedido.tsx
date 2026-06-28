import { useState, useRef } from 'react'
import Layout from '../components/Layout'
import {
  ShoppingCart, User, Calendar, Plus, Trash2, Send,
  CheckCircle, XCircle, Package, AlertTriangle, ArrowLeft,
  ChevronDown, ChevronUp, Settings2
} from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────────────────

interface RenglonPedido {
  uid: string
  codart: string
  cant: number
  bonifpct: string
  motivo: string
}

interface Cabecera {
  npedido: string
  idcliente: string
  idclialias: string
  fecentre: string
  iddocumento: string
  idempresa: string
  tipopago: string
  idDepo: string
  idSucur: string
  idfuerzaventas: string
  c_perso: string
  codlipre: string
}

type Etapa = 'formulario' | 'enviando' | 'resultado'

interface Resultado {
  ok: boolean
  nropedido: string
  error: string
  logs: string[]
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────────────────────────────────────────

const MOTIVOS: Record<string, string> = {
  '1': '[B',
  '2': 'CLIENTE ESPECIAL'
}

const CABECERA_INICIAL: Cabecera = {
  npedido: '',
  idcliente: '',
  idclialias: '1',
  fecentre: '',
  iddocumento: 'PRVTA',
  idempresa: '1',
  tipopago: '2',
  idDepo: '4',
  idSucur: '',
  idfuerzaventas: '',
  c_perso: '',
  codlipre: ''
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function fechaHoy(): string {
  const d = new Date()
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

let uidCounter = 0
function uid() { return String(Date.now()) + String(++uidCounter) }

function buildOverrides(cab: Cabecera): Record<string, unknown> {
  const ov: Record<string, unknown> = {}
  if (cab.iddocumento.trim())    ov.iddocumento    = cab.iddocumento.trim()
  if (cab.idempresa.trim())      ov.idempresa      = parseInt(cab.idempresa, 10)
  if (cab.tipopago.trim())       ov.tipopago       = parseInt(cab.tipopago, 10)
  if (cab.idDepo.trim())         ov.idDepo         = parseInt(cab.idDepo, 10)
  if (cab.idSucur.trim())        ov.idSucur        = parseInt(cab.idSucur, 10)
  if (cab.idfuerzaventas.trim()) ov.idfuerzaventas = parseInt(cab.idfuerzaventas, 10)
  if (cab.c_perso.trim())        ov.c_perso        = parseInt(cab.c_perso, 10)
  if (cab.codlipre.trim())       ov.codlipre       = parseInt(cab.codlipre, 10)
  return ov
}

async function enviarPedidoERP(
  cab: Cabecera,
  renglones: RenglonPedido[]
): Promise<Resultado> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/cargar-pedidos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + supabaseKey,
        apikey: supabaseKey
      },
      body: JSON.stringify({
        pedido: {
          idcliente: parseInt(cab.idcliente, 10),
          idclialias: parseInt(cab.idclialias || '1', 10),
          fecentre: cab.fecentre,
          renglones: renglones.map(r => ({
            codart: r.codart,
            cant: String(r.cant),
            bonifpct: r.bonifpct || '0',
            motivo: r.motivo || '0'
          })),
          overrides: buildOverrides(cab)
        }
      })
    })

    const data = await res.json()

    if (data.success) {
      return { ok: true, nropedido: String(data.nropedido || ''), error: '', logs: data.logs || [] }
    }

    return { ok: false, nropedido: '', error: data.error || 'Error desconocido', logs: data.logs || [] }
  } catch (err) {
    return { ok: false, nropedido: '', error: String(err), logs: [] }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTES
// ─────────────────────────────────────────────────────────────────────────────

function Field({
  label, required, children
}: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-dark-400 block mb-1.5">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

function TextInput({
  value, onChange, placeholder, type = 'text', inputMode, onKeyDown, inputRef, mono = false
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>
  inputRef?: React.RefObject<HTMLInputElement>
  mono?: boolean
}) {
  return (
    <input
      ref={inputRef}
      type={type}
      inputMode={inputMode}
      placeholder={placeholder}
      value={value}
      onChange={e => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      className={`w-full bg-dark-700 border border-dark-500 rounded-xl px-4 py-2.5 text-white placeholder-dark-600 focus:outline-none focus:border-primary-500 transition-colors ${mono ? 'font-mono' : ''}`}
    />
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

export default function TomaPedido() {
  const [cab, setCab] = useState<Cabecera>({ ...CABECERA_INICIAL, fecentre: fechaHoy() })
  const [renglones, setRenglones] = useState<RenglonPedido[]>([])
  const [avanzadoAbierto, setAvanzadoAbierto] = useState(false)

  const [codartInput, setCodartInput] = useState('')
  const [cantInput, setCantInput] = useState('')
  const [bonifpctInput, setBonifpctInput] = useState('')
  const [motivoInput, setMotivoInput] = useState('')
  const [errInput, setErrInput] = useState('')

  const [etapa, setEtapa] = useState<Etapa>('formulario')
  const [resultado, setResultado] = useState<Resultado | null>(null)

  const codartRef = useRef<HTMLInputElement>(null)
  const cantRef = useRef<HTMLInputElement>(null)

  const set = (key: keyof Cabecera) => (v: string) => setCab(prev => ({ ...prev, [key]: v }))

  const limpiarInputArt = () => {
    setCodartInput(''); setCantInput(''); setBonifpctInput(''); setMotivoInput(''); setErrInput('')
    codartRef.current?.focus()
  }

  const agregarRenglon = () => {
    setErrInput('')
    const codart = codartInput.trim()
    const cant = parseFloat(cantInput.replace(',', '.'))

    if (!codart || isNaN(parseInt(codart, 10))) {
      setErrInput('Ingresá un código de artículo válido'); codartRef.current?.focus(); return
    }
    if (!cantInput.trim() || isNaN(cant) || cant <= 0) {
      setErrInput('Ingresá una cantidad válida'); cantRef.current?.focus(); return
    }

    const tieneBonif = bonifpctInput.trim() !== '' && parseFloat(bonifpctInput) > 0
    if (tieneBonif && !motivoInput) { setErrInput('Si hay descuento, elegí el motivo'); return }

    setRenglones(prev => [...prev, {
      uid: uid(), codart, cant,
      bonifpct: tieneBonif ? bonifpctInput.trim() : '',
      motivo: tieneBonif ? motivoInput : ''
    }])
    limpiarInputArt()
  }

  const enviar = async () => {
    setErrInput('')
    if (!cab.idcliente.trim() || isNaN(parseInt(cab.idcliente, 10))) {
      setErrInput('Ingresá un número de cliente válido'); return
    }
    if (!cab.fecentre || !/^\d{2}\/\d{2}\/\d{4}$/.test(cab.fecentre)) {
      setErrInput('La fecha debe ser DD/MM/AAAA'); return
    }
    if (renglones.length === 0) {
      setErrInput('Agregá al menos un artículo'); return
    }

    setEtapa('enviando')
    const res = await enviarPedidoERP(cab, renglones)
    setResultado(res)
    setEtapa('resultado')
  }

  const nuevoPedido = () => {
    setCab({ ...CABECERA_INICIAL, fecentre: fechaHoy() })
    setRenglones([])
    limpiarInputArt()
    setResultado(null)
    setEtapa('formulario')
  }

  // ─── Pantalla de carga ───────────────────────────────────────────

  if (etapa === 'enviando') {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-8">
          <div className="w-16 h-16 border-4 border-dark-600 border-t-primary-500 rounded-full animate-spin" />
          <p className="text-white text-lg font-semibold">Enviando pedido al ERP...</p>
          <p className="text-dark-400 text-sm">
            Cliente {cab.idcliente} · {renglones.length} artículo{renglones.length !== 1 ? 's' : ''}
          </p>
        </div>
      </Layout>
    )
  }

  // ─── Pantalla de resultado ───────────────────────────────────────

  if (etapa === 'resultado' && resultado) {
    return (
      <Layout>
        <div className="p-4 md:p-6 max-w-lg mx-auto">
          <div className={`rounded-2xl p-8 text-center ${resultado.ok
            ? 'bg-green-500/10 border border-green-500/30'
            : 'bg-red-500/10 border border-red-500/30'}`}
          >
            {resultado.ok ? (
              <>
                <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-white mb-1">Pedido grabado</h2>
                <p className="text-dark-400 mb-5">
                  Cliente {cab.idcliente} · {cab.fecentre}
                </p>
                <div className="bg-dark-800 rounded-xl p-5 mb-6 w-full">
                  <p className="text-dark-400 text-sm mb-1">Número de pedido</p>
                  <p className="text-5xl font-bold font-mono text-primary-400">#{resultado.nropedido}</p>
                </div>
              </>
            ) : (
              <>
                <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-white mb-2">Error al grabar</h2>
                <p className="text-red-300 text-sm mb-5">{resultado.error}</p>
              </>
            )}

            {resultado.logs.length > 0 && (
              <div className="text-left bg-dark-900/60 rounded-xl p-4 mb-6">
                <p className="text-dark-400 text-xs font-medium uppercase tracking-wider mb-2">Log</p>
                {resultado.logs.map((l, i) => (
                  <p key={i} className="text-dark-300 text-xs font-mono leading-relaxed">{l}</p>
                ))}
              </div>
            )}

            <div className="flex flex-col gap-3">
              <button onClick={nuevoPedido}
                className="w-full btn-primary py-3 rounded-xl font-semibold flex items-center justify-center gap-2">
                <Plus className="w-4 h-4" /> Nuevo pedido
              </button>
              {!resultado.ok && (
                <button onClick={() => setEtapa('formulario')}
                  className="w-full btn-secondary py-3 rounded-xl font-semibold flex items-center justify-center gap-2">
                  <ArrowLeft className="w-4 h-4" /> Volver y editar
                </button>
              )}
            </div>
          </div>
        </div>
      </Layout>
    )
  }

  // ─── Formulario ─────────────────────────────────────────────────

  const tieneBonif = bonifpctInput.trim() !== '' && parseFloat(bonifpctInput) > 0

  return (
    <Layout>
      <div className="p-4 md:p-6 max-w-2xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 bg-primary-600/20 rounded-xl flex items-center justify-center shrink-0">
            <ShoppingCart className="w-5 h-5 text-primary-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white leading-tight">Toma de Pedido</h1>
            <p className="text-dark-400 text-sm">Chess ERP · Ingreso manual</p>
          </div>
        </div>

        {/* ── Identificación ───────────────────────────────────────── */}
        <div className="card rounded-2xl p-5 mb-4">
          <p className="text-xs font-medium text-dark-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
            <User className="w-3.5 h-3.5" />
            Identificación
          </p>

          <div className="grid grid-cols-3 gap-3 mb-3">
            <div className="col-span-2">
              <Field label="N° Cliente" required>
                <TextInput value={cab.idcliente} onChange={set('idcliente')}
                  placeholder="Ej: 300045" inputMode="numeric" mono />
              </Field>
            </div>
            <div>
              <Field label="Alias">
                <TextInput value={cab.idclialias} onChange={set('idclialias')}
                  placeholder="1" inputMode="numeric" mono />
              </Field>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="N° Pedido ref. (opcional)">
              <TextInput value={cab.npedido} onChange={set('npedido')}
                placeholder="Ej: 55" inputMode="numeric" mono />
            </Field>
            <Field label="Fecha de entrega (DD/MM/AAAA)" required>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500 pointer-events-none" />
                <input
                  type="text"
                  placeholder="DD/MM/AAAA"
                  value={cab.fecentre}
                  onChange={e => set('fecentre')(e.target.value)}
                  className="w-full bg-dark-700 border border-dark-500 rounded-xl pl-9 pr-4 py-2.5 text-white font-mono placeholder-dark-600 focus:outline-none focus:border-primary-500 transition-colors"
                />
              </div>
            </Field>
          </div>
        </div>

        {/* ── Parámetros de cabecera ───────────────────────────────── */}
        <div className="card rounded-2xl mb-4 overflow-hidden">
          <button
            onClick={() => setAvanzadoAbierto(o => !o)}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-dark-700/50 transition-colors"
          >
            <span className="text-xs font-medium text-dark-400 uppercase tracking-wider flex items-center gap-1.5">
              <Settings2 className="w-3.5 h-3.5" />
              Parámetros de la orden
            </span>
            {avanzadoAbierto
              ? <ChevronUp className="w-4 h-4 text-dark-500" />
              : <ChevronDown className="w-4 h-4 text-dark-500" />}
          </button>

          {/* Preview compacto cuando está cerrado */}
          {!avanzadoAbierto && (
            <div className="px-5 pb-4 flex flex-wrap gap-3">
              {[
                { label: 'Doc.', value: cab.iddocumento || 'PRVTA' },
                { label: 'Empresa', value: cab.idempresa || '1' },
                { label: 'Tipo pago', value: cab.tipopago || '2' },
                { label: 'Depósito', value: cab.idDepo || '4' },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center gap-1.5">
                  <span className="text-dark-500 text-xs">{label}:</span>
                  <span className="text-dark-300 text-xs font-mono">{value}</span>
                </div>
              ))}
            </div>
          )}

          {avanzadoAbierto && (
            <div className="px-5 pb-5 border-t border-dark-700">
              <div className="grid grid-cols-2 gap-3 mt-4">
                <Field label="Documento (iddocumento)">
                  <TextInput value={cab.iddocumento} onChange={set('iddocumento')}
                    placeholder="PRVTA" mono />
                </Field>
                <Field label="Empresa (idempresa)">
                  <TextInput value={cab.idempresa} onChange={set('idempresa')}
                    placeholder="1" inputMode="numeric" mono />
                </Field>
                <Field label="Tipo de pago (tipopago)">
                  <TextInput value={cab.tipopago} onChange={set('tipopago')}
                    placeholder="2" inputMode="numeric" mono />
                </Field>
                <Field label="Depósito (idDepo)">
                  <TextInput value={cab.idDepo} onChange={set('idDepo')}
                    placeholder="4" inputMode="numeric" mono />
                </Field>
                <Field label="Sucursal (idSucur)">
                  <TextInput value={cab.idSucur} onChange={set('idSucur')}
                    placeholder="Del cliente" inputMode="numeric" mono />
                </Field>
                <Field label="Fuerza de ventas (idfuerzaventas)">
                  <TextInput value={cab.idfuerzaventas} onChange={set('idfuerzaventas')}
                    placeholder="Del cliente" inputMode="numeric" mono />
                </Field>
                <Field label="Vendedor (c_perso)">
                  <TextInput value={cab.c_perso} onChange={set('c_perso')}
                    placeholder="Del cliente" inputMode="numeric" mono />
                </Field>
                <Field label="Lista de precios (codlipre)">
                  <TextInput value={cab.codlipre} onChange={set('codlipre')}
                    placeholder="Del cliente" inputMode="numeric" mono />
                </Field>
              </div>
              <p className="text-dark-600 text-xs mt-3">
                Los campos vacíos toman el valor configurado en el cliente del ERP.
              </p>
            </div>
          )}
        </div>

        {/* ── Agregar artículo ─────────────────────────────────────── */}
        <div className="card rounded-2xl p-5 mb-4">
          <p className="text-xs font-medium text-dark-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
            <Package className="w-3.5 h-3.5" />
            Agregar artículo
          </p>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <Field label="Código art." required>
              <input
                ref={codartRef}
                type="number"
                inputMode="numeric"
                placeholder="Cód. artículo"
                value={codartInput}
                onChange={e => setCodartInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && cantRef.current?.focus()}
                className="w-full bg-dark-700 border border-dark-500 rounded-xl px-4 py-2.5 text-white text-lg font-mono placeholder-dark-600 focus:outline-none focus:border-primary-500 transition-colors"
              />
            </Field>
            <Field label="Cantidad" required>
              <input
                ref={cantRef}
                type="number"
                inputMode="decimal"
                placeholder="0"
                value={cantInput}
                onChange={e => setCantInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !tieneBonif && agregarRenglon()}
                className="w-full bg-dark-700 border border-dark-500 rounded-xl px-4 py-2.5 text-white text-lg font-mono placeholder-dark-600 focus:outline-none focus:border-primary-500 transition-colors"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <Field label="Descuento % (opcional)">
              <TextInput
                value={bonifpctInput}
                onChange={v => { setBonifpctInput(v); if (!v || parseFloat(v) <= 0) setMotivoInput('') }}
                placeholder="0" inputMode="decimal" mono
              />
            </Field>
            <Field label={`Motivo${tieneBonif ? ' *' : ''}`}>
              <select
                value={motivoInput}
                onChange={e => setMotivoInput(e.target.value)}
                disabled={!tieneBonif}
                className="w-full bg-dark-700 border border-dark-500 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-primary-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <option value="">— Motivo —</option>
                {Object.entries(MOTIVOS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </Field>
          </div>

          {errInput && (
            <div className="flex items-start gap-2 text-red-400 text-sm mb-3 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              {errInput}
            </div>
          )}

          <button onClick={agregarRenglon}
            className="w-full btn-primary py-3 rounded-xl font-semibold flex items-center justify-center gap-2">
            <Plus className="w-4 h-4" />
            Agregar artículo
          </button>
        </div>

        {/* ── Lista de artículos ───────────────────────────────────── */}
        {renglones.length > 0 && (
          <div className="card rounded-2xl overflow-hidden mb-4">
            <div className="px-5 py-3 border-b border-dark-700 flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-primary-400" />
              <span className="text-sm font-medium text-white">
                {renglones.length} artículo{renglones.length !== 1 ? 's' : ''} en el pedido
              </span>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-700">
                  <th className="text-left px-5 py-2 text-dark-400 text-xs font-medium uppercase tracking-wider">Cód. Art.</th>
                  <th className="text-right px-3 py-2 text-dark-400 text-xs font-medium uppercase tracking-wider">Cant.</th>
                  <th className="text-right px-3 py-2 text-dark-400 text-xs font-medium uppercase tracking-wider">Desc.%</th>
                  <th className="text-right px-3 py-2 text-dark-400 text-xs font-medium uppercase tracking-wider hidden sm:table-cell">Motivo</th>
                  <th className="w-10 px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {renglones.map(r => (
                  <tr key={r.uid} className="border-b border-dark-800 last:border-0 hover:bg-dark-800/40 transition-colors">
                    <td className="px-5 py-3 text-white font-mono font-semibold">{r.codart}</td>
                    <td className="px-3 py-3 text-right text-dark-300 font-mono">{r.cant}</td>
                    <td className="px-3 py-3 text-right">
                      {r.bonifpct
                        ? <span className="text-yellow-400 text-sm font-mono">{r.bonifpct}%</span>
                        : <span className="text-dark-600">—</span>}
                    </td>
                    <td className="px-3 py-3 text-right hidden sm:table-cell">
                      {r.motivo
                        ? <span className="text-dark-300 text-xs">{MOTIVOS[r.motivo] ?? r.motivo}</span>
                        : <span className="text-dark-600">—</span>}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <button onClick={() => setRenglones(prev => prev.filter(x => x.uid !== r.uid))}
                        className="text-dark-500 hover:text-red-400 transition-colors p-1 rounded-lg hover:bg-red-500/10">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Confirmar ────────────────────────────────────────────── */}
        <button
          onClick={enviar}
          disabled={!cab.idcliente.trim() || renglones.length === 0}
          className="w-full btn-primary py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
        >
          <Send className="w-5 h-5" />
          Confirmar pedido
          {renglones.length > 0 && (
            <span className="ml-1 text-sm font-normal opacity-80">
              ({renglones.length} art.)
            </span>
          )}
        </button>

        {renglones.length === 0 && (
          <p className="text-center text-dark-500 text-xs mt-2">
            Agregá al menos un artículo para poder confirmar
          </p>
        )}
      </div>
    </Layout>
  )
}
