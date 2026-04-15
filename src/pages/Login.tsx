import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Package } from 'lucide-react'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { signIn } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await signIn(email, password)
    if (error) {
      setError('Usuario o contraseña incorrectos')
      setLoading(false)
    } else {
      navigate('/')
    }
  }

  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center p-4">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 40px, #22c55e 40px, #22c55e 41px),
            repeating-linear-gradient(90deg, transparent, transparent 40px, #22c55e 40px, #22c55e 41px)`
        }}
      />

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-primary-600 rounded-xl flex items-center justify-center">
              <Package className="w-7 h-7 text-white" />
            </div>
            <span className="text-4xl font-bold text-white tracking-tight font-mono">PIGID</span>
          </div>
          <p className="text-dark-500 text-sm mt-2 font-sans">Sistema de Gestión de Almacenes</p>
        </div>

        {/* Card */}
        <div className="bg-dark-800 border border-dark-600 rounded-2xl p-8 shadow-2xl">
          <h2 className="text-white text-xl font-semibold mb-6">Ingresar</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1.5">Usuario</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="usuario@empresa.com"
                required
                className="w-full bg-dark-700 border border-dark-500 text-white rounded-lg px-4 py-3 text-sm
                  placeholder-gray-600 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500
                  transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1.5">Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full bg-dark-700 border border-dark-500 text-white rounded-lg px-4 py-3 text-sm
                  placeholder-gray-600 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500
                  transition-colors"
              />
            </div>

            {error && (
              <div className="bg-red-900/30 border border-red-700 text-red-400 text-sm rounded-lg px-4 py-3">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary-600 hover:bg-primary-700 disabled:bg-primary-800 disabled:cursor-not-allowed
                text-white font-semibold rounded-lg px-4 py-3 text-sm transition-colors mt-2"
            >
              {loading ? 'Ingresando...' : 'INGRESAR'}
            </button>
          </form>

          <p className="text-center text-xs text-gray-600 mt-6">
            ¿No tenés cuenta?{' '}
            <span className="text-primary-500 cursor-pointer hover:text-primary-400">
              Contactá a tu administrador
            </span>
          </p>
        </div>

        <p className="text-center text-xs text-gray-700 mt-6 font-mono">Versión 1.0.0</p>
      </div>
    </div>
  )
}
