import { useState, useRef } from 'react'
import Layout from '../components/Layout'
import {
  ShoppingCart, User, Calendar, Plus, Trash2, Send,
  CheckCircle, XCircle, Package, AlertTriangle, ArrowLeft
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

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function fechaHoy(): string {
  const d = new Date()
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

let uidCounter = 0
function uid() {
  return String(Date.now()) + String(++uidCounter)
}

async function enviarPedidoERP(params: {
  idcliente: number
  idclialias: number
  fecentre: string
  renglones: RenglonPedido[]
}): Promise<Resultado> {
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
          idcliente: params.idcliente,
          idclialias: params.idclialias,
          fecentre: params.fecentre,
          renglones: params.renglones.map(r => ({
            codart: r.codart,
            cant: String(r.cant),
            bonifpct: r.bonifpct || '0',
            motivo: r.motivo || '0'
          })),
          overrides: {}
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
// COMPONENTE
// ─────────────────────────────────────────────────────────────────────────────

export default function TomaPedido() {
  const [idcliente, setIdcliente] = useState('')
  const [idclialias, setIdclialias] = useState('1')
  const [fecentre, setFecentre] = useState(fechaHoy)
  const [renglones, setRenglones] = useState<RenglonPedido[]>([])

  const [codartInput, setCodartInput] = useState('')
  const [cantInput, setCantInput] = useState('')
  const [bonifpctInput, setBonifpctInput] = useState('')
  const [motivoInput, setMotivoInput] = useState('')
  const [errInput, setErrInput] = useState('')

  const [etapa, setEtapa] = useState<Etapa>('formulario')
  const [resultado, setResultado] = useState<Resultado | null>(null)

  const codartRef = useRef<HTMLInputElement>(null)
  const cantRef = useRef<HTMLInputElement>(null)

  const limpiarInputArt = () => {
    setCodartInput('')
    setCantInput('')
    setBonifpctInput('')
    setMotivoInput('')
    setErrInput('')
    codartRef.current?.focus()
  }

  const agregarRenglon = () => {
    setErrInput('')
    const codart = codartInput.trim()
    const cant = parseFloat(cantInput.replace(',', '.'))

    if (!codart || isNaN(parseInt(codart, 10))) {
      setErrInput('Ingresá un código de artículo válido')
      codartRef.current?.focus()
      return
    }

    if (!cantInput.trim() || isNaN(cant) || cant <= 0) {
      setErrInput('Ingresá una cantidad válida')
      cantRef.current?.focus()
      return
    }

    const tieneBonif = bonifpctInput.trim() !== '' && parseFloat(bonifpctInput) > 0

    if (tieneBonif && !motivoInput) {
      setErrInput('Si hay descuento, elegí el motivo')
      return
    }

    setRenglones(prev => [
      ...prev,
      {
        uid: uid(),
        codart,
        cant,
        bonifpct: tieneBonif ? bonifpctInput.trim() : '',
        motivo: tieneBonif ? motivoInput : ''
      }
    ])

    limpiarInputArt()
  }

  const quitarRenglon = (id: string) => {
    setRenglones(prev => prev.filter(r => r.uid !== id))
  }

  const enviar = async () => {
    setErrInput('')

    if (!idcliente.trim() || isNaN(parseInt(idcliente, 10))) {
      setErrInput('Ingresá un número de cliente válido')
      return
    }

    if (!fecentre || !/^\d{2}\/\d{2}\/\d{4}$/.test(fecentre)) {
      setErrInput('La fecha debe ser DD/MM/AAAA')
      return
    }

    if (renglones.length === 0) {
      setErrInput('Agregá al menos un artículo')
      return
    }

    setEtapa('enviando')

    const res = await enviarPedidoERP({
      idcliente: parseInt(idcliente, 10),
      idclialias: parseInt(idclialias || '1', 10),
      fecentre,
      renglones
    })

    setResultado(res)
    setEtapa('resultado')
  }

  const nuevoPedido = () => {
    setIdcliente('')
    setIdclialias('1')
    setFecentre(fechaHoy())
    setRenglones([])
    limpiarInputArt()
    setResultado(null)
    setEtapa('formulario')
  }

  // ─── Pantalla de carga ─────────────────────────────────────────────

  if (etapa === 'enviando') {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-8">
          <div className="w-16 h-16 border-4 border-dark-600 border-t-primary-500 rounded-full animate-spin" />
          <p className="text-white text-lg font-semibold">Enviando pedido al ERP...</p>
          <p className="text-dark-400 text-sm">
            Cliente {idcliente} · {renglones.length} artículo{renglones.length !== 1 ? 's' : ''}
          </p>
        </div>
      </Layout>
    )
  }

  // ─── Pantalla de resultado ─────────────────────────────────────────

  if (etapa === 'resultado' && resultado) {
    return (
      <Layout>
        <div className="p-4 md:p-6 max-w-lg mx-auto">
          <div
            className={`rounded-2xl p-8 text-center ${
              resultado.ok
                ? 'bg-green-500/10 border border-green-500/30'
                : 'bg-red-500/10 border border-red-500/30'
            }`}
          >
            {resultado.ok ? (
              <>
                <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-white mb-1">Pedido grabado</h2>
                <p className="text-dark-400 mb-5">Cliente {idcliente} · {fecentre}</p>
                <div className="bg-dark-800 rounded-xl p-5 mb-6 inline-block w-full">
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
              <button
                onClick={nuevoPedido}
                className="w-full btn-primary py-3 rounded-xl font-semibold flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Nuevo pedido
              </button>

              {!resultado.ok && (
                <button
                  onClick={() => setEtapa('formulario')}
                  className="w-full btn-secondary py-3 rounded-xl font-semibold flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Volver y editar
                </button>
              )}
            </div>
          </div>
        </div>
      </Layout>
    )
  }

  // ─── Formulario ────────────────────────────────────────────────────

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

        {/* ── Cabecera del pedido ─────────────────────────────────────── */}
        <div className="card rounded-2xl p-5 mb-4">
          <p className="text-xs font-medium text-dark-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
            <User className="w-3.5 h-3.5" />
            Cliente y fecha
          </p>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-xs text-dark-400 block mb-1.5">N° Cliente *</label>
              <input
                type="number"
                inputMode="numeric"
                placeholder="Ej: 12345"
                value={idcliente}
                onChange={e => setIdcliente(e.target.value)}
                className="w-full bg-dark-700 border border-dark-500 rounded-xl px-4 py-3 text-white text-lg font-mono placeholder-dark-600 focus:outline-none focus:border-primary-500 transition-colors"
              />
            </div>
            <div>
              <label className="text-xs text-dark-400 block mb-1.5">Alias</label>
              <input
                type="number"
                inputMode="numeric"
                placeholder="1"
                value={idclialias}
                onChange={e => setIdclialias(e.target.value)}
                className="w-full bg-dark-700 border border-dark-500 rounded-xl px-4 py-3 text-white text-lg font-mono placeholder-dark-600 focus:outline-none focus:border-primary-500 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-dark-400 block mb-1.5 flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              Fecha de entrega (DD/MM/AAAA) *
            </label>
            <input
              type="text"
              placeholder="DD/MM/AAAA"
              value={fecentre}
              onChange={e => setFecentre(e.target.value)}
              className="w-full bg-dark-700 border border-dark-500 rounded-xl px-4 py-3 text-white font-mono placeholder-dark-600 focus:outline-none focus:border-primary-500 transition-colors"
            />
          </div>
        </div>

        {/* ── Agregar artículo ────────────────────────────────────────── */}
        <div className="card rounded-2xl p-5 mb-4">
          <p className="text-xs font-medium text-dark-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
            <Package className="w-3.5 h-3.5" />
            Agregar artículo
          </p>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-xs text-dark-400 block mb-1.5">Código art. *</label>
              <input
                ref={codartRef}
                type="number"
                inputMode="numeric"
                placeholder="Cód. artículo"
                value={codartInput}
                onChange={e => setCodartInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && cantRef.current?.focus()}
                className="w-full bg-dark-700 border border-dark-500 rounded-xl px-4 py-3 text-white text-lg font-mono placeholder-dark-600 focus:outline-none focus:border-primary-500 transition-colors"
              />
            </div>
            <div>
              <label className="text-xs text-dark-400 block mb-1.5">Cantidad *</label>
              <input
                ref={cantRef}
                type="number"
                inputMode="decimal"
                placeholder="0"
                value={cantInput}
                onChange={e => setCantInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (tieneBonif ? undefined : agregarRenglon())}
                className="w-full bg-dark-700 border border-dark-500 rounded-xl px-4 py-3 text-white text-lg font-mono placeholder-dark-600 focus:outline-none focus:border-primary-500 transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="text-xs text-dark-400 block mb-1.5">Descuento % (opc.)</label>
              <input
                type="number"
                inputMode="decimal"
                placeholder="0"
                value={bonifpctInput}
                onChange={e => {
                  setBonifpctInput(e.target.value)
                  if (!e.target.value || parseFloat(e.target.value) <= 0) setMotivoInput('')
                }}
                className="w-full bg-dark-700 border border-dark-500 rounded-xl px-4 py-3 text-white font-mono placeholder-dark-600 focus:outline-none focus:border-primary-500 transition-colors"
              />
            </div>
            <div>
              <label className="text-xs text-dark-400 block mb-1.5">
                Motivo{tieneBonif ? ' *' : ''}
              </label>
              <select
                value={motivoInput}
                onChange={e => setMotivoInput(e.target.value)}
                disabled={!tieneBonif}
                className="w-full bg-dark-700 border border-dark-500 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <option value="">— Motivo —</option>
                {Object.entries(MOTIVOS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>

          {errInput && (
            <div className="flex items-start gap-2 text-red-400 text-sm mb-3 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              {errInput}
            </div>
          )}

          <button
            onClick={agregarRenglon}
            className="w-full btn-primary py-3 rounded-xl font-semibold flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Agregar artículo
          </button>
        </div>

        {/* ── Lista de artículos ──────────────────────────────────────── */}
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
                  <th className="text-left px-5 py-2 text-dark-400 text-xs font-medium uppercase tracking-wider">
                    Cód. Art.
                  </th>
                  <th className="text-right px-3 py-2 text-dark-400 text-xs font-medium uppercase tracking-wider">
                    Cant.
                  </th>
                  <th className="text-right px-3 py-2 text-dark-400 text-xs font-medium uppercase tracking-wider">
                    Desc.%
                  </th>
                  <th className="text-right px-3 py-2 text-dark-400 text-xs font-medium uppercase tracking-wider">
                    Motivo
                  </th>
                  <th className="w-10 px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {renglones.map(r => (
                  <tr key={r.uid} className="border-b border-dark-800 last:border-0 hover:bg-dark-800/40 transition-colors">
                    <td className="px-5 py-3 text-white font-mono font-semibold">{r.codart}</td>
                    <td className="px-3 py-3 text-right text-dark-300 font-mono">{r.cant}</td>
                    <td className="px-3 py-3 text-right">
                      {r.bonifpct ? (
                        <span className="text-yellow-400 text-sm font-mono">{r.bonifpct}%</span>
                      ) : (
                        <span className="text-dark-600">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {r.motivo ? (
                        <span className="text-dark-300 text-xs">{MOTIVOS[r.motivo] ?? r.motivo}</span>
                      ) : (
                        <span className="text-dark-600">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <button
                        onClick={() => quitarRenglon(r.uid)}
                        className="text-dark-500 hover:text-red-400 transition-colors p-1 rounded-lg hover:bg-red-500/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Confirmar ───────────────────────────────────────────────── */}
        <button
          onClick={enviar}
          disabled={!idcliente.trim() || renglones.length === 0}
          className="w-full btn-primary py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
        >
          <Send className="w-5 h-5" />
          Confirmar pedido
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
