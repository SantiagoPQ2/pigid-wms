import { useNavigate } from 'react-router-dom'

export default function NotFound() {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <p className="text-8xl font-black text-dark-700 font-mono mb-4">404</p>
        <h1 className="text-2xl font-bold text-white mb-2">Página no encontrada</h1>
        <p className="text-dark-400 mb-8">La ruta que buscás no existe o fue movida.</p>
        <div className="flex gap-3 justify-center">
          <button onClick={() => navigate(-1)} className="btn-secondary px-5 py-2 rounded-lg text-sm font-medium">← Volver</button>
          <button onClick={() => navigate('/')} className="btn-primary px-5 py-2 rounded-lg text-sm font-medium">Ir al Dashboard</button>
        </div>
      </div>
    </div>
  )
}
