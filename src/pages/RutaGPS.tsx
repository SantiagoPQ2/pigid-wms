import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import { Upload, Navigation, MapPin, RefreshCw, CheckCircle, Circle, ChevronRight, RotateCcw, ExternalLink } from 'lucide-react'

const OSRM = 'https://router.project-osrm.org'

interface Punto { cliente: string; lat: number; lon: number; completado?: boolean }

function parsearCSV(texto: string): Punto[] {
  const lineas = texto.trim().split(/\r?\n/)
  const puntos: Punto[] = []
  for (let i = 0; i < lineas.length; i++) {
    const cols = lineas[i].split(/[,;]/).map(c => c.trim().replace(/^"|"$/g,''))
    if (cols.length < 3) continue
    if (i === 0 && (isNaN(Number(cols[1])) || isNaN(Number(cols[2])))) continue
    const lat = parseFloat(cols[1]); const lon = parseFloat(cols[2])
    if (isNaN(lat) || isNaN(lon)) continue
    puntos.push({ cliente: cols[0], lat, lon, completado: false })
  }
  return puntos
}

async function obtenerMatriz(todos: {lat:number;lon:number}[]): Promise<number[][]> {
  const coords = todos.map(p => p.lon+','+p.lat).join(';')
  const res = await fetch(`${OSRM}/table/v1/driving/${coords}?annotations=duration`)
  const data = await res.json()
  if (data.code !== 'Ok') throw new Error('Error OSRM: ' + data.message)
  return data.durations
}

function tspNearestNeighbor(matriz: number[][], origenIdx: number, destinos: number[]): number[] {
  const restantes = [...destinos]; const ruta: number[] = []; let actual = origenIdx
  while (restantes.length) {
    let minVal = Infinity, minIdx = 0
    restantes.forEach((idx, i) => { if (matriz[actual][idx] < minVal) { minVal = matriz[actual][idx]; minIdx = i } })
    ruta.push(restantes[minIdx]); actual = restantes[minIdx]; restantes.splice(minIdx, 1)
  }
  return ruta
}

function abrirGoogleMaps(desde: {lat:number;lon:number}, hasta: {lat:number;lon:number}) {
  window.open(
    `https://www.google.com/maps/dir/?api=1&origin=${desde.lat},${desde.lon}&destination=${hasta.lat},${hasta.lon}&travelmode=driving`,
    '_blank'
  )
}

export default function RutaGPS() {
  const [puntos, setPuntos] = useState<Punto[]>([])
  const [ruta, setRuta] = useState<Punto[]>([])
  const [ubicacion, setUbicacion] = useState<{lat:number;lon:number} | null>(null)
  const [errorUbic, setErrorUbic] = useState('')
  const [cargandoUbic, setCargandoUbic] = useState(false)
  const [calculando, setCalculando] = useState(false)
  const [progreso, setProgreso] = useState('')
  const [error, setError] = useState('')
  const [archivoNombre, setArchivoNombre] = useState('')
  const [indiceActual, setIndiceActual] = useState(0)

  const obtenerUbicacion = () => {
    setCargandoUbic(true); setErrorUbic('')
    navigator.geolocation.getCurrentPosition(
      pos => { setUbicacion({ lat: pos.coords.latitude, lon: pos.coords.longitude }); setCargandoUbic(false) },
      err => { setErrorUbic('No se pudo obtener ubicación: ' + err.message); setCargandoUbic(false) },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  useEffect(() => { obtenerUbicacion() }, [])

  const calcularRuta = async () => {
    if (!ubicacion || !puntos.length) return
    setCalculando(true); setError(''); setRuta([]); setIndiceActual(0)
    try {
      const todos = [ubicacion, ...puntos]
      setProgreso('Calculando rutas por calles...')
      const matriz = await obtenerMatriz(todos)
      setProgreso('Optimizando orden...')
      const ordenIdx = tspNearestNeighbor(matriz, 0, puntos.map((_, i) => i + 1))
      const rutaOrdenada = ordenIdx.map(idx => ({ ...puntos[idx - 1], completado: false }))
      setRuta(rutaOrdenada)
      setProgreso('')
    } catch (e) {
      setError('Error: ' + String(e))
    } finally {
      setCalculando(false)
    }
  }

  const marcarCompletado = (idx: number) => {
    setRuta(prev => prev.map((p, i) => i === idx ? { ...p, completado: true } : p))
    // Avanzar al siguiente no completado
    const siguiente = ruta.findIndex((p, i) => i > idx && !p.completado)
    if (siguiente !== -1) setIndiceActual(siguiente)
    else setIndiceActual(idx + 1) // último
  }

  const irA = (destino: Punto) => {
    // Origen = ubicación actual o último completado
    const ultimoComp = [...ruta].reverse().find(p => p.completado)
    const desde = ultimoComp ?? ubicacion!
    abrirGoogleMaps(desde, destino)
  }

  const reiniciar = () => {
    setRuta(prev => prev.map(p => ({ ...p, completado: false }))); setIndiceActual(0)
  }

  const onCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    setArchivoNombre(file.name)
    const reader = new FileReader()
    reader.onload = ev => { setPuntos(parsearCSV(ev.target?.result as string)); setRuta([]); setIndiceActual(0) }
    reader.readAsText(file)
  }

  const completados = ruta.filter(p => p.completado).length
  const total = ruta.length
  const todoListo = total > 0 && completados === total
  const puntoActual = ruta[indiceActual]

  return (
    <Layout>
      <div className="p-6 max-w-2xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Navigation className="w-6 h-6 text-primary-400" />Ruta GPS
            </h1>
            {ruta.length > 0 && (
              <p className="text-dark-400 text-sm mt-1">{completados}/{total} destinos completados</p>
            )}
          </div>
          {ruta.length > 0 && completados > 0 && !todoListo && (
            <button onClick={reiniciar} className="flex items-center gap-1.5 text-dark-400 hover:text-white text-sm transition-colors">
              <RotateCcw className="w-4 h-4" />Reiniciar
            </button>
          )}
        </div>

        {/* Setup — solo si no hay ruta calculada */}
        {!ruta.length && (
          <div className="space-y-3 mb-5">
            {/* Ubicación */}
            <div className="card rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${ubicacion ? 'bg-green-500/20' : 'bg-dark-700'}`}>
                    <MapPin className={`w-4 h-4 ${ubicacion ? 'text-green-400' : 'text-dark-500'}`} />
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">Punto de partida</p>
                    {ubicacion
                      ? <p className="text-green-400 text-xs">✓ Ubicación obtenida · {ubicacion.lat.toFixed(4)}, {ubicacion.lon.toFixed(4)}</p>
                      : cargandoUbic
                        ? <p className="text-dark-400 text-xs flex items-center gap-1"><RefreshCw className="w-3 h-3 animate-spin" />Obteniendo...</p>
                        : <p className="text-red-400 text-xs">{errorUbic || 'Sin ubicación'}</p>
                    }
                  </div>
                </div>
                {!ubicacion && !cargandoUbic && (
                  <button onClick={obtenerUbicacion} className="text-primary-400 hover:text-primary-300 text-xs font-medium transition-colors">
                    Reintentar
                  </button>
                )}
              </div>
            </div>

            {/* CSV */}
            <div className="card rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${puntos.length ? 'bg-green-500/20' : 'bg-dark-700'}`}>
                  <Upload className={`w-4 h-4 ${puntos.length ? 'text-green-400' : 'text-dark-500'}`} />
                </div>
                <div className="flex-1">
                  <p className="text-white text-sm font-medium">Destinos CSV</p>
                  {puntos.length
                    ? <p className="text-green-400 text-xs">✓ {puntos.length} destinos · {archivoNombre}</p>
                    : <p className="text-dark-400 text-xs">cliente,lat,lon — una fila por destino</p>
                  }
                </div>
                <label className="cursor-pointer">
                  <span className="bg-dark-700 hover:bg-dark-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">
                    {puntos.length ? 'Cambiar' : 'Subir CSV'}
                  </span>
                  <input type="file" accept=".csv,.txt" className="hidden" onChange={onCSV} />
                </label>
              </div>
            </div>

            {/* Botón calcular */}
            <button
              onClick={calcularRuta}
              disabled={calculando || !ubicacion || !puntos.length}
              className="w-full flex items-center justify-center gap-3 bg-primary-600 hover:bg-primary-500 disabled:opacity-40 disabled:cursor-not-allowed text-white py-3.5 rounded-xl text-base font-semibold transition-colors"
            >
              {calculando
                ? <><RefreshCw className="w-5 h-5 animate-spin" />{progreso || 'Calculando...'}</>
                : <><Navigation className="w-5 h-5" />Calcular ruta óptima</>
              }
            </button>
            {error && <p className="text-red-400 text-sm text-center">{error}</p>}
          </div>
        )}

        {/* Ruta calculada — checklist */}
        {ruta.length > 0 && (
          <>
            {/* Barra de progreso */}
            <div className="mb-5">
              <div className="flex justify-between text-xs text-dark-400 mb-1.5">
                <span>{completados} completados</span>
                <span>{total - completados} restantes</span>
              </div>
              <div className="w-full bg-dark-700 rounded-full h-2">
                <div
                  className="bg-primary-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: total ? (completados/total*100)+'%' : '0%' }}
                />
              </div>
            </div>

            {/* Completado todo */}
            {todoListo && (
              <div className="card rounded-xl p-8 text-center mb-4">
                <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-green-400" />
                </div>
                <p className="text-white font-bold text-xl mb-2">¡Ruta completada!</p>
                <p className="text-dark-400 text-sm mb-4">Visitaste los {total} destinos</p>
                <button onClick={reiniciar} className="btn-primary px-6 py-2.5 rounded-lg font-semibold">
                  Reiniciar ruta
                </button>
              </div>
            )}

            {/* Lista de paradas */}
            <div className="space-y-2">
              {ruta.map((p, i) => {
                const esCurrent = i === indiceActual && !p.completado
                const esPasado = p.completado
                const esFuturo = !p.completado && i !== indiceActual

                return (
                  <div
                    key={i}
                    className={`card rounded-xl overflow-hidden transition-all duration-300
                      ${esCurrent ? 'ring-2 ring-primary-500 bg-primary-500/5' : ''}
                      ${esPasado ? 'opacity-50' : ''}
                    `}
                  >
                    <div className="flex items-center gap-4 px-4 py-4">
                      {/* Número / check */}
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm
                        ${esPasado ? 'bg-green-500/20 text-green-400' : esCurrent ? 'bg-primary-500 text-white' : 'bg-dark-700 text-dark-400'}`}>
                        {esPasado ? <CheckCircle className="w-5 h-5" /> : i + 1}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className={`font-semibold text-sm truncate ${esPasado ? 'text-dark-400 line-through' : 'text-white'}`}>
                          {p.cliente}
                        </p>
                        <p className="text-dark-500 text-xs font-mono">{p.lat.toFixed(5)}, {p.lon.toFixed(5)}</p>
                      </div>

                      {/* Acciones */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {!esPasado && (
                          <button
                            onClick={() => irA(p)}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors
                              ${esCurrent
                                ? 'bg-blue-600 hover:bg-blue-500 text-white'
                                : 'bg-dark-700 hover:bg-dark-600 text-dark-300'
                              }`}
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            {esCurrent ? 'Navegar' : 'Ir'}
                          </button>
                        )}
                        {!esPasado && (
                          <button
                            onClick={() => marcarCompletado(i)}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors
                              ${esCurrent
                                ? 'bg-green-600 hover:bg-green-500 text-white'
                                : 'bg-dark-800 hover:bg-dark-700 text-dark-400 hover:text-white'
                              }`}
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            {esCurrent ? 'Llegué' : 'Check'}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Banner "próximo destino" */}
                    {esCurrent && (
                      <div className="bg-primary-500/10 border-t border-primary-500/20 px-4 py-2 flex items-center justify-between">
                        <span className="text-primary-400 text-xs font-medium flex items-center gap-1.5">
                          <ChevronRight className="w-3.5 h-3.5" />Próximo destino
                        </span>
                        <span className="text-dark-400 text-xs">{total - completados - 1} más después de este</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Recalcular */}
            <button
              onClick={() => { setRuta([]); setIndiceActual(0) }}
              className="w-full mt-4 text-dark-500 hover:text-dark-300 text-sm py-3 transition-colors"
            >
              ← Volver y recalcular ruta
            </button>
          </>
        )}
      </div>
    </Layout>
  )
}
