import { useState, useEffect, useRef } from 'react'
import Layout from '../components/Layout'
import { Upload, Navigation, MapPin, RefreshCw, AlertCircle, CheckCircle, List, Map as MapIcon } from 'lucide-react'

// ── OSRM public API — routing real por calles, sin API key ───────────────────
const OSRM = 'https://router.project-osrm.org'

interface Punto { cliente: string; lat: number; lon: number; orden?: number }
interface Segmento { coords: [number,number][]; distancia: number; duracion: number }

// ── Parser CSV ────────────────────────────────────────────────────────────────
function parsearCSV(texto: string): Punto[] {
  const lineas = texto.trim().split(/\r?\n/)
  const puntos: Punto[] = []
  for (let i = 0; i < lineas.length; i++) {
    const cols = lineas[i].split(/[,;]/).map(c => c.trim().replace(/^"|"$/g,''))
    if (cols.length < 3) continue
    if (i === 0 && (isNaN(Number(cols[1])) || isNaN(Number(cols[2])))) continue
    const lat = parseFloat(cols[1]); const lon = parseFloat(cols[2])
    if (isNaN(lat) || isNaN(lon)) continue
    puntos.push({ cliente: cols[0], lat, lon })
  }
  return puntos
}

// ── Obtener matriz de duraciones por calles via OSRM /table ──────────────────
async function obtenerMatriz(todos: {lat:number;lon:number}[]): Promise<number[][]> {
  const coords = todos.map(p => p.lon + ',' + p.lat).join(';')
  const res = await fetch(`${OSRM}/table/v1/driving/${coords}?annotations=duration`)
  const data = await res.json()
  if (data.code !== 'Ok') throw new Error('OSRM matrix error: ' + data.message)
  return data.durations // segundos
}

// ── TSP Nearest Neighbor usando la matriz de duraciones reales ───────────────
function tspNearestNeighbor(matriz: number[][], origenIdx: number, destinos: number[]): number[] {
  const restantes = [...destinos]
  const ruta: number[] = []
  let actual = origenIdx
  while (restantes.length) {
    let minVal = Infinity, minIdx = 0
    restantes.forEach((idx, i) => {
      const d = matriz[actual][idx]
      if (d < minVal) { minVal = d; minIdx = i }
    })
    ruta.push(restantes[minIdx])
    actual = restantes[minIdx]
    restantes.splice(minIdx, 1)
  }
  return ruta
}

// ── Obtener geometría de ruta real entre dos puntos ──────────────────────────
async function obtenerSegmento(desde: {lat:number;lon:number}, hasta: {lat:number;lon:number}): Promise<Segmento> {
  const coords = `${desde.lon},${desde.lat};${hasta.lon},${hasta.lat}`
  const res = await fetch(`${OSRM}/route/v1/driving/${coords}?geometries=geojson&overview=full`)
  const data = await res.json()
  if (data.code !== 'Ok' || !data.routes?.length) throw new Error('Sin ruta entre puntos')
  const route = data.routes[0]
  const coords2d: [number,number][] = route.geometry.coordinates.map((c: number[]) => [c[1], c[0]])
  return { coords: coords2d, distancia: route.distance / 1000, duracion: route.duration / 60 }
}

export default function RutaGPS() {
  const [puntos, setPuntos] = useState<Punto[]>([])
  const [ruta, setRuta] = useState<Punto[]>([])
  const [segmentos, setSegmentos] = useState<Segmento[]>([])
  const [ubicacion, setUbicacion] = useState<{lat:number;lon:number} | null>(null)
  const [errorUbic, setErrorUbic] = useState('')
  const [cargandoUbic, setCargandoUbic] = useState(false)
  const [calculando, setCalculando] = useState(false)
  const [errorCalc, setErrorCalc] = useState('')
  const [tab, setTab] = useState<'mapa'|'lista'>('mapa')
  const [archivoNombre, setArchivoNombre] = useState('')
  const [progreso, setProgreso] = useState('')
  const mapRef = useRef<any>(null)
  const mapDivRef = useRef<HTMLDivElement>(null)

  const obtenerUbicacion = () => {
    setCargandoUbic(true); setErrorUbic('')
    navigator.geolocation.getCurrentPosition(
      pos => { setUbicacion({ lat: pos.coords.latitude, lon: pos.coords.longitude }); setCargandoUbic(false) },
      err => { setErrorUbic('No se pudo obtener la ubicación: ' + err.message); setCargandoUbic(false) },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  useEffect(() => { obtenerUbicacion() }, [])

  const calcularRuta = async () => {
    if (!ubicacion || !puntos.length) return
    setCalculando(true); setErrorCalc(''); setRuta([]); setSegmentos([])

    try {
      // Todos los puntos: origen + destinos
      const todos = [ubicacion, ...puntos]
      const origenIdx = 0
      const destinosIdx = puntos.map((_, i) => i + 1)

      // 1. Obtener matriz de tiempos por calles
      setProgreso('Calculando matriz de rutas reales...')
      const matriz = await obtenerMatriz(todos)

      // 2. TSP con tiempos reales
      setProgreso('Optimizando orden de visitas...')
      const ordenIdx = tspNearestNeighbor(matriz, origenIdx, destinosIdx)
      const rutaOrdenada = ordenIdx.map((idx, i) => ({ ...puntos[idx - 1], orden: i + 1 }))

      // 3. Obtener geometría de cada segmento
      const segs: Segmento[] = []
      const stops = [ubicacion, ...rutaOrdenada]
      for (let i = 0; i < stops.length - 1; i++) {
        setProgreso(`Trayendo ruta por calles ${i + 1}/${stops.length - 1}...`)
        const seg = await obtenerSegmento(stops[i], stops[i + 1])
        segs.push(seg)
      }

      setRuta(rutaOrdenada)
      setSegmentos(segs)
      setProgreso('')
    } catch (e) {
      setErrorCalc('Error al calcular ruta: ' + String(e))
    } finally {
      setCalculando(false)
    }
  }

  // Mapa Leaflet
  useEffect(() => {
    if (tab !== 'mapa' || !mapDivRef.current || !ruta.length || !ubicacion || !segmentos.length) return
    const initMap = () => {
      const L = (window as any).L; if (!L) return
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null }
      const map = L.map(mapDivRef.current!).setView([ubicacion.lat, ubicacion.lon], 12)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
      }).addTo(map)
      mapRef.current = map

      // Marcador origen
      const iconOrigen = L.divIcon({
        html: `<div style="background:#3b82f6;color:white;border-radius:50%;width:38px;height:38px;display:flex;align-items:center;justify-content:center;font-size:18px;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4)">📍</div>`,
        iconSize: [38,38], iconAnchor: [19,19], className: ''
      })
      L.marker([ubicacion.lat, ubicacion.lon], { icon: iconOrigen }).addTo(map)
        .bindPopup('<b>Punto de partida</b>')

      // Marcadores destinos
      ruta.forEach((p, i) => {
        const color = i === 0 ? '#22c55e' : i === ruta.length-1 ? '#ef4444' : '#f59e0b'
        const icon = L.divIcon({
          html: `<div style="background:${color};color:white;border-radius:50%;width:34px;height:34px;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:14px;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)">${i+1}</div>`,
          iconSize: [34,34], iconAnchor: [17,17], className: ''
        })
        L.marker([p.lat, p.lon], { icon }).addTo(map)
          .bindPopup(`<b>${i+1}. ${p.cliente}</b>`)
      })

      // Dibujar rutas reales por calles (geometría de OSRM)
      segmentos.forEach((seg, i) => {
        const color = i === 0 ? '#6366f1' : '#6366f1'
        L.polyline(seg.coords, { color, weight: 4, opacity: 0.85 }).addTo(map)
      })

      // Ajustar vista
      const allCoords: [number,number][] = [
        [ubicacion.lat, ubicacion.lon],
        ...ruta.map(p => [p.lat, p.lon] as [number,number])
      ]
      map.fitBounds(L.latLngBounds(allCoords), { padding: [40,40] })
    }

    if (!(window as any).L) {
      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link')
        link.id='leaflet-css'; link.rel='stylesheet'
        link.href='https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css'
        document.head.appendChild(link)
      }
      const script = document.createElement('script')
      script.src='https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js'
      script.onload = () => setTimeout(initMap, 100)
      document.head.appendChild(script)
    } else { setTimeout(initMap, 50) }
    return () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null } }
  }, [tab, ruta, segmentos, ubicacion])

  const onCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    setArchivoNombre(file.name)
    const reader = new FileReader()
    reader.onload = ev => { setPuntos(parsearCSV(ev.target?.result as string)); setRuta([]); setSegmentos([]) }
    reader.readAsText(file)
  }

  const abrirEnGoogleMaps = () => {
    if (!ubicacion || !ruta.length) return
    const origin = `${ubicacion.lat},${ubicacion.lon}`
    const dest = `${ruta[ruta.length-1].lat},${ruta[ruta.length-1].lon}`
    const wp = ruta.slice(0,-1).map(p => `${p.lat},${p.lon}`).join('|')
    const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}${wp?'&waypoints='+wp:''}&travelmode=driving`
    window.open(url, '_blank')
  }

  const kmTotal = segmentos.reduce((s, sg) => s + sg.distancia, 0)
  const minTotal = segmentos.reduce((s, sg) => s + sg.duracion, 0)

  return (
    <Layout>
      <div className="p-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Navigation className="w-7 h-7 text-primary-400" />Ruta GPS
            </h1>
            <p className="text-dark-400 text-sm mt-1">Ruta óptima por calles — powered by OSRM + OpenStreetMap</p>
          </div>
          {ruta.length > 0 && (
            <button onClick={abrirEnGoogleMaps}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
              <Navigation className="w-4 h-4" />Abrir en Google Maps
            </button>
          )}
        </div>

        {/* Controles */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="card rounded-xl p-4">
            <h3 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-blue-400" />Punto de partida
            </h3>
            {ubicacion ? (
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-green-400 text-sm font-medium">Ubicación obtenida</p>
                  <p className="text-dark-400 text-xs font-mono">{ubicacion.lat.toFixed(5)}, {ubicacion.lon.toFixed(5)}</p>
                </div>
                <button onClick={obtenerUbicacion} className="text-dark-400 hover:text-white transition-colors"><RefreshCw className="w-4 h-4" /></button>
              </div>
            ) : cargandoUbic ? (
              <div className="flex items-center gap-2 text-dark-400 text-sm"><RefreshCw className="w-4 h-4 animate-spin" />Obteniendo ubicación...</div>
            ) : (
              <div>
                {errorUbic && <p className="text-red-400 text-xs mb-2">{errorUbic}</p>}
                <button onClick={obtenerUbicacion} className="btn-primary px-4 py-2 rounded-lg text-sm font-semibold">Obtener mi ubicación</button>
              </div>
            )}
          </div>

          <div className="card rounded-xl p-4">
            <h3 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
              <Upload className="w-4 h-4 text-primary-400" />Cargar destinos (CSV)
            </h3>
            <label className="flex items-center gap-3 cursor-pointer group">
              <div className="flex-1 bg-dark-800 border border-dark-600 group-hover:border-primary-500 rounded-lg px-3 py-2 text-sm transition-colors">
                <span className={archivoNombre ? 'text-white' : 'text-dark-500'}>{archivoNombre || 'cliente,lat,lon'}</span>
              </div>
              <div className="bg-primary-600 hover:bg-primary-500 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap">Subir CSV</div>
              <input type="file" accept=".csv,.txt" className="hidden" onChange={onCSV} />
            </label>
            {puntos.length > 0 && <p className="text-green-400 text-xs mt-2">✓ {puntos.length} destinos cargados</p>}
          </div>
        </div>

        {/* Botón calcular */}
        {puntos.length > 0 && ubicacion && !ruta.length && (
          <div className="mb-4">
            <button onClick={calcularRuta} disabled={calculando}
              className="w-full flex items-center justify-center gap-3 bg-primary-600 hover:bg-primary-500 disabled:opacity-50 text-white py-3 rounded-xl text-base font-semibold transition-colors">
              {calculando ? <><RefreshCw className="w-5 h-5 animate-spin" />{progreso || 'Calculando...'}</> : <><Navigation className="w-5 h-5" />Calcular ruta óptima por calles</>}
            </button>
            {calculando && <p className="text-dark-500 text-xs text-center mt-2">Consultando OSRM para ruteo real por calles...</p>}
          </div>
        )}

        {errorCalc && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-4 flex gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-red-300 text-sm">{errorCalc}</p>
          </div>
        )}

        {/* Stats */}
        {ruta.length > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="card rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-primary-400">{ruta.length}</p>
              <p className="text-dark-400 text-sm">Destinos</p>
            </div>
            <div className="card rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-green-400">{kmTotal.toFixed(1)} km</p>
              <p className="text-dark-400 text-sm">Por calles</p>
            </div>
            <div className="card rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-yellow-400">{Math.round(minTotal)} min</p>
              <p className="text-dark-400 text-sm">Tiempo estimado</p>
            </div>
          </div>
        )}

        {/* Vacío */}
        {!puntos.length && (
          <div className="card rounded-xl p-16 text-center">
            <Navigation className="w-14 h-14 mx-auto mb-4 text-dark-600" />
            <p className="text-white font-semibold text-lg mb-2">Cargá tu CSV de clientes</p>
            <p className="text-dark-400 text-sm">Formato: <span className="font-mono text-primary-400">cliente,lat,lon</span></p>
            <p className="text-dark-500 text-xs mt-2">La ruta se calcula por calles reales usando OpenStreetMap</p>
          </div>
        )}

        {/* Tabs */}
        {ruta.length > 0 && (
          <>
            <div className="flex gap-1 bg-dark-800 rounded-lg p-1 mb-4 w-fit">
              <button onClick={() => setTab('mapa')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${tab==='mapa'?'bg-primary-600 text-white':'text-dark-400 hover:text-white'}`}>
                <MapIcon className="w-4 h-4" />Mapa
              </button>
              <button onClick={() => setTab('lista')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${tab==='lista'?'bg-primary-600 text-white':'text-dark-400 hover:text-white'}`}>
                <List className="w-4 h-4" />Lista ({ruta.length})
              </button>
            </div>

            {/* Mapa */}
            {tab === 'mapa' && (
              <div className="card rounded-xl overflow-hidden">
                <div ref={mapDivRef} style={{ height: '540px', width: '100%' }} />
              </div>
            )}

            {/* Lista */}
            {tab === 'lista' && (
              <div className="card rounded-xl overflow-hidden">
                {ubicacion && (
                  <div className="flex items-center gap-4 px-4 py-3 border-b border-dark-700 bg-blue-500/5">
                    <div className="w-9 h-9 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="text-white font-semibold text-sm">Tu ubicación</p>
                      <p className="text-dark-400 text-xs font-mono">{ubicacion.lat.toFixed(5)}, {ubicacion.lon.toFixed(5)}</p>
                    </div>
                  </div>
                )}
                {ruta.map((p, i) => {
                  const seg = segmentos[i]
                  const isFirst = i === 0; const isLast = i === ruta.length - 1
                  return (
                    <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-dark-800 hover:bg-dark-800/40 transition-colors">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold text-sm
                        ${isFirst?'bg-green-500':isLast?'bg-red-500':'bg-yellow-500'}`}>{i+1}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-semibold text-sm truncate">{p.cliente}</p>
                        <p className="text-dark-400 text-xs font-mono">{p.lat.toFixed(5)}, {p.lon.toFixed(5)}</p>
                      </div>
                      {seg && (
                        <div className="text-right flex-shrink-0">
                          <p className="text-primary-400 text-sm font-semibold">{seg.distancia.toFixed(1)} km</p>
                          <p className="text-dark-500 text-xs">{Math.round(seg.duracion)} min</p>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  )
}
