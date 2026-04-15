import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
// Pages
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
// Recepcion
import RecepcionDocumentos from './pages/recepcion/RecepcionDocumentos'
import ControlCiego from './pages/recepcion/ControlCiego'
// Deposito
import Areas from './pages/deposito/Areas'
import Ubicaciones from './pages/deposito/Ubicaciones'
import Tareas from './pages/deposito/Tareas'
import { Movimientos, Ajustes } from './pages/deposito/MovimientosAjustes'
// Preparacion
import Preparaciones from './pages/preparacion/Preparaciones'
import Pedidos from './pages/preparacion/Pedidos'
// Despacho
import Despachos from './pages/despacho/Despachos'
// Configuracion
import { Articulos, Clientes, Proveedores } from './pages/configuracion/ConfigPages'
import UsuariosTransportes from './pages/configuracion/UsuariosTransportes'
import { TipoUbicacion, MotivoAjuste, Negocio, Impresoras } from './pages/configuracion/ConfigsSimples'
// Reportes
import ConsultarStock from './pages/reportes/ConsultarStock'
import Estadisticas from './pages/reportes/Estadisticas'

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-dark-500 border-t-primary-500 rounded-full animate-spin" />
    </div>
  )
}

function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function Public({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <LoadingScreen />
  if (user) return <Navigate to="/" replace />
  return <>{children}</>
}

function ComingSoon({ title }: { title: string }) {
  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center">
      <div className="text-center">
        <p className="text-4xl font-bold text-dark-600 font-mono mb-2">🚧</p>
        <p className="text-white text-lg font-semibold">{title}</p>
        <p className="text-gray-500 text-sm mt-1">En construcción</p>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Públicas */}
          <Route path="/login" element={<Public><Login /></Public>} />

          {/* Dashboard */}
          <Route path="/" element={<Protected><Dashboard /></Protected>} />

          {/* Recepcion */}
          <Route path="/recepcion/documentos" element={<Protected><RecepcionDocumentos /></Protected>} />
          <Route path="/recepcion/control-ciego" element={<Protected><ControlCiego /></Protected>} />

          {/* Deposito */}
          <Route path="/deposito/areas" element={<Protected><Areas /></Protected>} />
          <Route path="/deposito/ubicaciones" element={<Protected><Ubicaciones /></Protected>} />
          <Route path="/deposito/reposicion" element={<Protected><ComingSoon title="Reposición de Picking" /></Protected>} />
          <Route path="/deposito/tareas" element={<Protected><Tareas /></Protected>} />
          <Route path="/deposito/movimientos" element={<Protected><Movimientos /></Protected>} />
          <Route path="/deposito/ajustes" element={<Protected><Ajustes /></Protected>} />

          {/* Preparacion */}
          <Route path="/preparacion/preparaciones" element={<Protected><Preparaciones /></Protected>} />
          <Route path="/preparacion/pedidos" element={<Protected><Pedidos /></Protected>} />

          {/* Despacho */}
          <Route path="/despacho/despachos" element={<Protected><Despachos /></Protected>} />
          <Route path="/despacho/transportes" element={<Protected><ComingSoon title="Transportes" /></Protected>} />

          {/* Configuracion */}
          <Route path="/configuracion/articulos" element={<Protected><Articulos /></Protected>} />
          <Route path="/configuracion/clientes" element={<Protected><Clientes /></Protected>} />
          <Route path="/configuracion/proveedores" element={<Protected><Proveedores /></Protected>} />
          <Route path="/configuracion/usuarios" element={<Protected><UsuariosTransportes /></Protected>} />
          <Route path="/configuracion/transportes" element={<Protected><UsuariosTransportes /></Protected>} />
          <Route path="/configuracion/tipo-ubicacion" element={<Protected><TipoUbicacion /></Protected>} />
          <Route path="/configuracion/motivo-ajuste" element={<Protected><MotivoAjuste /></Protected>} />
          <Route path="/configuracion/negocio" element={<Protected><Negocio /></Protected>} />
          <Route path="/configuracion/impresoras" element={<Protected><Impresoras /></Protected>} />
          <Route path="/configuracion/contenedores" element={<Protected><ComingSoon title="Contenedores" /></Protected>} />

          {/* Reportes */}
          <Route path="/reportes/stock" element={<Protected><ConsultarStock /></Protected>} />
          <Route path="/reportes/estadisticas" element={<Protected><Estadisticas /></Protected>} />
          <Route path="/reportes/tareas-activas" element={<Protected><ComingSoon title="Tareas Activas" /></Protected>} />

          {/* 404 */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
