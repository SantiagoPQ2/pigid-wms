import { useState, useEffect, useRef } from 'react'
import Layout from '../components/Layout'
import { Upload, Navigation, MapPin, RefreshCw, AlertCircle, CheckCircle, List, Map } from 'lucide-react'

interface Punto { cliente: string; lat: number; lon: number; orden?: number }

// ── Haversine distance en km ──────────────────────────────────────────────────
function dist(a: {lat:number;lon:number}, b: {lat:number;lon:number}) {
  const R = 6371
  const dLat = (b.lat - a.lat) * Math.PI / 180
  const dLon = (b.lon - a.lon) * Math.PI / 180
  const la = Math.sin(dLat/2)**2 + Math.cos(a.lat*Math.PI/180)*Math.cos(b.lat*Math.PI/180)*Math.sin(dLon/2)**2
  return R * 2 * Math.atan2(Math.sqrt(la), Math.sqrt(1-la))
}

// ── Nearest Neighbor TSP ──────────────────────────────────────────────────────
function rutaEficiente(origen: {lat:number;lon:number}, puntos: Punto[]): Punto[] {
  const restantes = [...puntos]
  const ruta: Punto[] = []
  let actual: {lat:number;lon:number} = origen
  while (restantes.length) {
    let minDist = Infinity, minIdx = 0
    restantes.forEach((p, i) => { const d = dist(actual, p); if (d < minDist) { minDist = d; minIdx = i } })
    ruta.push(restantes[minIdx])
    actual = restantes[minIdx]
    restantes.splice(minIdx, 1)
  }
  return ruta.map((p, i) => ({ ...p, orden: i + 1 }))
}

// ── Parser CSV ────────────────────────────────────────────────────────────────
function parsearCSV(texto: string): Punto[] {
  const lineas = texto.trim().split(/\r?\n/)
  const puntos: Punto[] = []
  for (let i = 0; i < lineas.length; i++) {
    const cols = lineas[i].split(/[,;]/).map(c => c.trim().replace(/^"|"$/g,''))
    if (i === 0) {
      // Detectar si es header
      if (isNaN(Number(cols[1])) || isNaN(Number(cols[2]))) continue
    }
    if (cols.length < 3) continue
    const lat = parseFloat(cols[1])
    const lon = parseFloat(cols[2])
    if (isNaN(lat) || isNaN(lon)) continue
    puntos.push({ cliente: cols[0], lat, lon })
  }
  return puntos
}

// ── Distancia total de la ruta ────────────────────────────────────────────────
function distanciaTotal(origen: {lat:number;lon:number}, ruta: Punto[]): number {
  if (!ruta.length) return 0
  let total = dist(origen, ruta[0])
  for (let i = 1; i < ruta.length; i++) total += dist(ruta[i-1], ruta[i])
  return total
}

export default function RutaGPS() {
  const [puntos, setPuntos] = useState<Punto[]>([])
  const [ruta, setRuta] = useState<Punto[]>([])
  const [ubicacion, setUbicacion] = useState<{lat:number;lon:number} | null>(null)
  const [errorUbic, setErrorUbic] = useState('')
  const [cargandoUbic, setCargandoUbic] = useState(false)
  const [tab, setTab] = useState<'mapa'|'lista'>('mapa')
  const [archivoNombre, setArchivoNombre] = useState('')
  const mapRef = useRef<any>(null)
  const mapDivRef = useRef<HTMLDivElement>(null)
  const leafletRef = useRef<any>(null)

  // Obtener ubicación actual
  const obtenerUbicacion = () => {
    setCargandoUbic(true); setErrorUbic('')
    navigator.geolocation.getCurrentPosition(
      pos => {
        setUbicacion({ lat: pos.coords.latitude, lon: pos.coords.longitude })
        setCargandoUbic(false)
      },
      err => { setErrorUbic('No se pudo obtener la ubicación: ' + err.message); setCargandoUbic(false) },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  useEffect(() => { obtenerUbicacion() }, [])

  // Recalcular ruta cuando cambian puntos o ubicación
  useEffect(() => {
    if (puntos.length && ubicacion) {
      setRuta(rutaEficiente(ubicacion, puntos))
    }
  }, [puntos, ubicacion])

  // Inicializar mapa Leaflet
  useEffect(() => {
    if (tab !== 'mapa' || !mapDivRef.current || !ruta.length || !ubicacion) return
    // Cargar Leaflet si no está
    const initMap = () => {
      const L = (window as any).L
      if (!L) return
      // Destruir mapa anterior si existe
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null }
      // Centrar en el primer punto de la ruta
      const map = L.map(mapDivRef.current!).setView([ubicacion.lat, ubicacion.lon], 12)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(map)
      mapRef.current = map
      leafletRef.current = L
      dibujarMapa(map, L)
    }
    if (!(window as any).L) {
      // Cargar CSS
      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link')
        link.id = 'leaflet-css'; link.rel = 'stylesheet'
        link.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css'
        document.head.appendChild(link)
      }
      // Cargar JS
      const script = document.createElement('script')
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js'
      script.onload = () => setTimeout(initMap, 100)
      document.head.appendChild(script)
    } else {
      setTimeout(initMap, 50)
    }
    return () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null } }
  }, [tab, ruta, ubicacion])

  const dibujarMapa = (map: any, L: any) => {
    if (!ubicacion || !ruta.length) return
    // Marcador origen
    const iconOrigen = L.divIcon({
      html: `<div style="background:#3b82f6;color:white;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:16px;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)">📍</div>`,
      iconSize: [36, 36], iconAnchor: [18, 18], className: ''
    })
    L.marker([ubicacion.lat, ubicacion.lon], { icon: iconOrigen })
      .addTo(map).bindPopup('<b>Tu ubicación</b>')

    // Marcadores destinos
    ruta.forEach((p, i) => {
      const color = i === 0 ? '#22c55e' : i === ruta.length - 1 ? '#ef4444' : '#f59e0b'
      const icon = L.divIcon({
        html: `<div style="background:${color};color:white;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:13px;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)">${i+1}</div>`,
        iconSize: [32, 32], iconAnchor: [16, 16], className: ''
      })
      L.marker([p.lat, p.lon], { icon })
        .addTo(map).bindPopup(`<b>${i+1}. ${p.cliente}</b><br>${p.lat.toFixed(5)}, ${p.lon.toFixed(5)}`)
    })

    // Polilínea de la ruta
    const coords: [number, number][] = [
      [ubicacion.lat, ubicacion.lon],
      ...ruta.map(p => [p.lat, p.lon] as [number, number])
    ]
    L.polyline(coords, { color: '#6366f1', weight: 3, opacity: 0.8, dashArray: '8,4' }).addTo(map)

    // Ajustar vista
    const bounds = L.latLngBounds(coords)
    map.fitBounds(bounds, { padding: [40, 40] })
  }

  const onCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    setArchivoNombre(file.name)
    const reader = new FileReader()
    reader.onload = ev => {
      const pts = parsearCSV(ev.target?.result as string)
      setPuntos(pts)
    }
    reader.readAsText(file)
  }

  const abrirEnGoogleMaps = () => {
    if (!ubicacion || !ruta.length) return
    const origin = `${ubicacion.lat},${ubicacion.lon}`
    const waypoints = ruta.slice(0, -1).map(p => `${p.lat},${p.lon}`).join('|')
    const destination = `${ruta[ruta.length-1].lat},${ruta[ruta.length-1].lon}`
    const url = waypoints.length
      ? `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&waypoints=${waypoints}&travelmode=driving`
      : `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`
    window.open(url, '_blank')
  }

  const kmTotal = ubicacion && ruta.length ? distanciaTotal(ubicacion, ruta).toFixed(1) : null

  return (
    <Layout>
      <div className="p-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Navigation className="w-7 h-7 text-primary-400" />
              Ruta GPS
            </h1>
            <p className="text-dark-400 text-sm mt-1">Cargá un CSV con clientes y coordenadas para generar la ruta más eficiente</p>
          </div>
          {ruta.length > 0 && (
            <button onClick={abrirEnGoogleMaps}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
              <Navigation className="w-4 h-4" />
              Abrir en Google Maps
            </button>
          )}
        </div>

        {/* Controles */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
          {/* Ubicación */}
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
                <button onClick={obtenerUbicacion} className="text-dark-400 hover:text-white transition-colors">
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            ) : cargandoUbic ? (
              <div className="flex items-center gap-2 text-dark-400 text-sm">
                <RefreshCw className="w-4 h-4 animate-spin" />Obteniendo ubicación...
              </div>
            ) : (
              <div>
                {errorUbic && <p className="text-red-400 text-xs mb-2">{errorUbic}</p>}
                <button onClick={obtenerUbicacion} className="btn-primary px-4 py-2 rounded-lg text-sm font-semibold">
                  Obtener mi ubicación
                </button>
              </div>
            )}
          </div>

          {/* CSV Upload */}
          <div className="card rounded-xl p-4">
            <h3 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
              <Upload className="w-4 h-4 text-primary-400" />Cargar destinos (CSV)
            </h3>
            <label className="flex items-center gap-3 cursor-pointer group">
              <div className="flex-1 bg-dark-800 border border-dark-600 group-hover:border-primary-500 rounded-lg px-3 py-2 text-sm transition-colors">
                <span className={archivoNombre ? 'text-white' : 'text-dark-500'}>
                  {archivoNombre || 'cliente,lat,lon  —  sin encabezado o con él'}
                </span>
              </div>
              <div className="bg-primary-600 hover:bg-primary-500 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors">
                Subir CSV
              </div>
              <input type="file" accept=".csv,.txt" className="hidden" onChange={onCSV} />
            </label>
            {puntos.length > 0 && (
              <p className="text-green-400 text-xs mt-2">✓ {puntos.length} destinos cargados</p>
            )}
          </div>
        </div>

        {/* Stats */}
        {ruta.length > 0 && ubicacion && (
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="card rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-primary-400">{ruta.length}</p>
              <p className="text-dark-400 text-sm">Destinos</p>
            </div>
            <div className="card rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-green-400">{kmTotal} km</p>
              <p className="text-dark-400 text-sm">Distancia total</p>
            </div>
            <div className="card rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-yellow-400">~{Math.round(Number(kmTotal) / 40 * 60)} min</p>
              <p className="text-dark-400 text-sm">Tiempo estimado</p>
            </div>
          </div>
        )}

        {/* Sin datos */}
        {!ruta.length && !cargandoUbic && (
          <div className="card rounded-xl p-16 text-center">
            <Navigation className="w-14 h-14 mx-auto mb-4 text-dark-600" />
            <p className="text-white font-semibold text-lg mb-2">Cargá tu CSV de clientes</p>
            <p className="text-dark-400 text-sm">Formato: <span className="font-mono text-primary-400">cliente,lat,lon</span> — una fila por destino</p>
          </div>
        )}

        {/* Tabs mapa / lista */}
        {ruta.length > 0 && (
          <>
            <div className="flex gap-1 bg-dark-800 rounded-lg p-1 mb-4 w-fit">
              <button onClick={() => setTab('mapa')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${tab==='mapa'?'bg-primary-600 text-white':'text-dark-400 hover:text-white'}`}>
                <Map className="w-4 h-4" />Mapa
              </button>
              <button onClick={() => setTab('lista')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${tab==='lista'?'bg-primary-600 text-white':'text-dark-400 hover:text-white'}`}>
                <List className="w-4 h-4" />Lista ({ruta.length})
              </button>
            </div>

            {/* Mapa */}
            {tab === 'mapa' && (
              <div className="card rounded-xl overflow-hidden">
                <div ref={mapDivRef} style={{ height: '520px', width: '100%' }} />
              </div>
            )}

            {/* Lista */}
            {tab === 'lista' && (
              <div className="card rounded-xl overflow-hidden">
                {/* Origen */}
                {ubicacion && (
                  <div className="flex items-center gap-4 px-4 py-3 border-b border-dark-700 bg-blue-500/5">
                    <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="text-white font-semibold text-sm">Tu ubicación (inicio)</p>
                      <p className="text-dark-400 text-xs font-mono">{ubicacion.lat.toFixed(5)}, {ubicacion.lon.toFixed(5)}</p>
                    </div>
                  </div>
                )}
                {ruta.map((p, i) => {
                  const kmDesde = i === 0
                    ? (ubicacion ? dist(ubicacion, p).toFixed(1) : '—')
                    : dist(ruta[i-1], p).toFixed(1)
                  const isFirst = i === 0
                  const isLast = i === ruta.length - 1
                  return (
                    <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-dark-800 hover:bg-dark-800/40 transition-colors">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold text-sm
                        ${isFirst ? 'bg-green-500' : isLast ? 'bg-red-500' : 'bg-yellow-500'}`}>
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-semibold text-sm truncate">{p.cliente}</p>
                        <p className="text-dark-400 text-xs font-mono">{p.lat.toFixed(5)}, {p.lon.toFixed(5)}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-primary-400 text-sm font-semibold">{kmDesde} km</p>
                        <p className="text-dark-600 text-xs">desde anterior</p>
                      </div>
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
