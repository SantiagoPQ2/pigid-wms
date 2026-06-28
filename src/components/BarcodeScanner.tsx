import { useState, useEffect, useRef, useCallback } from 'react'
import { Camera, CameraOff, X, Zap, RotateCcw } from 'lucide-react'

interface BarcodeScannerProps {
  onScan: (codigo: string) => void
  onClose: () => void
  titulo?: string
  placeholder?: string
}

// Usa la BarcodeDetector API nativa del browser (Chrome/Edge/Android)
// con fallback a input manual en dispositivos sin soporte
declare global {
  interface Window {
    BarcodeDetector: any
  }
}

export default function BarcodeScanner({ onScan, onClose, titulo = 'Escanear código', placeholder = 'o escribí el código manualmente' }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const detectorRef = useRef<any>(null)
  const scanLoopRef = useRef<number | null>(null)
  const lastScanRef = useRef<string>('')
  const lastScanTimeRef = useRef<number>(0)

  const [modo, setModo] = useState<'camara' | 'manual'>('camara')
  const [activo, setActivo] = useState(false)
  const [error, setError] = useState('')
  const [input, setInput] = useState('')
  const [flashActivo, setFlashActivo] = useState(false)
  const [camaraIdx, setCamaraIdx] = useState(0)
  const [camaras, setCamaras] = useState<MediaDeviceInfo[]>([])
  const [soportado, setSoportado] = useState(true)
  const [ultimoEscaneado, setUltimoEscaneado] = useState('')

  // Verificar soporte de BarcodeDetector
  useEffect(() => {
    if (!('BarcodeDetector' in window)) {
      setSoportado(false)
      setModo('manual')
    }
    // Listar cámaras disponibles
    navigator.mediaDevices?.enumerateDevices().then(devices => {
      const videoDevices = devices.filter(d => d.kind === 'videoinput')
      setCamaras(videoDevices)
    }).catch(() => {})
  }, [])

  const detener = useCallback(() => {
    if (scanLoopRef.current) cancelAnimationFrame(scanLoopRef.current)
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setActivo(false)
    setFlashActivo(false)
  }, [])

  const iniciar = useCallback(async (idx = camaraIdx) => {
    detener()
    setError('')
    try {
      // Usar cámara trasera si está disponible
      const constraint: MediaStreamConstraints = {
        video: camaras[idx]
          ? { deviceId: { exact: camaras[idx].deviceId }, facingMode: 'environment' }
          : { facingMode: 'environment' }
      }
      const stream = await navigator.mediaDevices.getUserMedia(constraint)
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }

      // Crear detector
      if ('BarcodeDetector' in window) {
        detectorRef.current = new window.BarcodeDetector({
          formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'qr_code', 'upc_a', 'upc_e', 'itf', 'codabar']
        })
      }

      setActivo(true)
      scanLoop()
    } catch (err: any) {
      if (err.name === 'NotAllowedError') setError('Permisos de cámara denegados. Habilitá la cámara en ajustes.')
      else if (err.name === 'NotFoundError') setError('No se encontró cámara disponible.')
      else setError('Error al iniciar la cámara: ' + err.message)
      setModo('manual')
    }
  }, [camaraIdx, camaras, detener])

  const scanLoop = useCallback(() => {
    const video = videoRef.current
    const detector = detectorRef.current
    if (!video || !detector || video.readyState < 2) {
      scanLoopRef.current = requestAnimationFrame(scanLoop)
      return
    }
    detector.detect(video).then((barcodes: any[]) => {
      if (barcodes.length > 0) {
        const codigo = barcodes[0].rawValue
        const ahora = Date.now()
        // Debounce: no repetir el mismo código en 2 segundos
        if (codigo !== lastScanRef.current || ahora - lastScanTimeRef.current > 2000) {
          lastScanRef.current = codigo
          lastScanTimeRef.current = ahora
          setUltimoEscaneado(codigo)
          // Flash visual
          setFlashActivo(true)
          setTimeout(() => setFlashActivo(false), 300)
          // Vibración haptica en móvil
          if (navigator.vibrate) navigator.vibrate(100)
          onScan(codigo)
        }
      }
    }).catch(() => {})
    scanLoopRef.current = requestAnimationFrame(scanLoop)
  }, [onScan])

  useEffect(() => {
    if (modo === 'camara' && soportado) iniciar()
    return () => detener()
  }, [modo])

  const toggleFlash = async () => {
    if (!streamRef.current) return
    const track = streamRef.current.getVideoTracks()[0]
    try {
      const caps = track.getCapabilities() as any
      if (caps.torch) {
        await track.applyConstraints({ advanced: [{ torch: !flashActivo } as any] })
        setFlashActivo(f => !f)
      }
    } catch {}
  }

  const cambiarCamara = () => {
    const siguiente = (camaraIdx + 1) % Math.max(camaras.length, 1)
    setCamaraIdx(siguiente)
    iniciar(siguiente)
  }

  const handleManual = (e: React.FormEvent) => {
    e.preventDefault()
    if (input.trim()) {
      onScan(input.trim())
      setInput('')
      setUltimoEscaneado(input.trim())
    }
  }

  return (
    <div className="fixed inset-0 z-[300] flex flex-col bg-dark-950">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-dark-900 border-b border-dark-700">
        <h2 className="text-white font-semibold">{titulo}</h2>
        <div className="flex items-center gap-2">
          {soportado && (
            <button
              onClick={() => setModo(m => m === 'camara' ? 'manual' : 'camara')}
              className="text-dark-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-dark-700 text-xs flex items-center gap-1"
            >
              {modo === 'camara' ? <><CameraOff className="w-4 h-4" />Manual</> : <><Camera className="w-4 h-4" />Cámara</>}
            </button>
          )}
          <button onClick={() => { detener(); onClose(); }} className="text-dark-400 hover:text-white p-1.5 rounded-lg hover:bg-dark-700">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Vista de cámara */}
      {modo === 'camara' && (
        <div className="flex-1 relative overflow-hidden bg-black">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline muted autoPlay
          />

          {/* Flash de scan */}
          {flashActivo && (
            <div className="absolute inset-0 bg-white/30 pointer-events-none animate-pulse" />
          )}

          {/* Visor de escaneo */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="relative w-72 h-40">
              {/* Esquinas del visor */}
              <div className="absolute top-0 left-0 w-8 h-8 border-t-3 border-l-3 border-primary-400 rounded-tl-lg" style={{borderWidth:'3px'}} />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-3 border-r-3 border-primary-400 rounded-tr-lg" style={{borderWidth:'3px'}} />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-3 border-l-3 border-primary-400 rounded-bl-lg" style={{borderWidth:'3px'}} />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-3 border-r-3 border-primary-400 rounded-br-lg" style={{borderWidth:'3px'}} />
              {/* Línea de escaneo animada */}
              {activo && (
                <div className="absolute left-2 right-2 h-0.5 bg-primary-400 shadow-lg animate-scan-line" style={{
                  boxShadow: '0 0 8px #6366f1',
                  animation: 'scanLine 2s ease-in-out infinite'
                }} />
              )}
            </div>
          </div>

          {/* Controles flotantes */}
          <div className="absolute bottom-6 left-0 right-0 flex items-center justify-center gap-6">
            {camaras.length > 1 && (
              <button onClick={cambiarCamara} className="w-12 h-12 rounded-full bg-dark-800/80 text-white flex items-center justify-center">
                <RotateCcw className="w-5 h-5" />
              </button>
            )}
            <button onClick={toggleFlash} className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${flashActivo ? 'bg-yellow-400 text-dark-900' : 'bg-dark-800/80 text-white'}`}>
              <Zap className="w-5 h-5" />
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="absolute top-4 left-4 right-4 bg-red-500/90 text-white text-sm rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          {/* Último escaneado */}
          {ultimoEscaneado && (
            <div className="absolute top-4 left-4 right-4 bg-green-500/90 text-white text-sm rounded-xl px-4 py-2 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-white animate-ping" />
              <span className="font-mono font-bold">{ultimoEscaneado}</span>
            </div>
          )}
        </div>
      )}

      {/* Modo manual */}
      {modo === 'manual' && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6">
          {!soportado && (
            <div className="text-center text-dark-400 text-sm bg-dark-800 rounded-xl p-4">
              Tu navegador no soporta el escáner de cámara.<br />
              Usá un lector físico o escribí el código manualmente.
            </div>
          )}
          <div className="w-full max-w-sm">
            <form onSubmit={handleManual} className="flex flex-col gap-3">
              <input
                type="text"
                autoFocus
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder={placeholder}
                className="input-field text-center text-xl font-mono tracking-widest"
              />
              <button type="submit" disabled={!input.trim()} className="btn-primary py-3 rounded-xl font-semibold disabled:opacity-50">
                Confirmar
              </button>
            </form>
          </div>
          {ultimoEscaneado && (
            <div className="text-center">
              <p className="text-dark-400 text-xs mb-1">Último escaneado</p>
              <p className="text-white font-mono font-bold text-lg">{ultimoEscaneado}</p>
            </div>
          )}
        </div>
      )}

      {/* Input manual siempre visible abajo cuando hay cámara */}
      {modo === 'camara' && (
        <div className="bg-dark-900 border-t border-dark-700 px-4 py-3">
          <form onSubmit={handleManual} className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={placeholder}
              className="input-field flex-1 font-mono text-sm"
            />
            <button type="submit" disabled={!input.trim()} className="btn-primary px-4 rounded-lg text-sm disabled:opacity-50">
              OK
            </button>
          </form>
        </div>
      )}

      <style>{`
        @keyframes scanLine {
          0% { top: 8px; }
          50% { top: calc(100% - 8px); }
          100% { top: 8px; }
        }
      `}</style>
    </div>
  )
}
