import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { NotifProvider } from './context/NotifContext'
// Pages
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import NotFound from './pages/NotFound'
// Recepcion
import RecepcionDocumentos from './pages/recepcion/RecepcionDocumentos'
import ControlCiego from './pages/recepcion/ControlCiego'
// Deposito
import Areas from './pages/deposito/Areas'
import Ubicaciones from './pages/deposito/Ubicaciones'
import Tareas from './pages/deposito/Tareas'
import ReposicionPicking from './pages/deposito/ReposicionPicking'
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
import Contenedores from './pages/configuracion/Contenedores'
// Reportes
import ConsultarStock from './pages/reportes/ConsultarStock'
import Estadisticas from './pages/reportes/Estadisticas'
import TareasRealtime from './pages/reportes/TareasRealtime'

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

export default function App() {
  return (
    <AuthProvider>
      <NotifProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Public><Login /></Public>} />
            <Route path="/" element={<Protected><Dashboard /></Protected>} />

            {/* Recepcion */}
            <Route path="/recepcion/documentos" element={<Protected><RecepcionDocumentos /></Protected>} />
            <Route path="/recepcion/control-ciego" element={<Protected><ControlCiego /></Protected>} />

            {/* Deposito */}
            <Route path="/deposito/areas" element={<Protected><Areas /></Protected>} />
            <Route path="/deposito/ubicaciones" element={<Protected><Ubicaciones /></Protected>} />
            <Route path="/deposito/reposicion" element={<Protected><ReposicionPicking /></Protected>} />
            <Route path="/deposito/tareas" element={<Protected><Tareas /></Protected>} />
            <Route path="/deposito/movimientos" element={<Protected><Movimientos /></Protected>} />
            <Route path="/deposito/ajustes" element={<Protected><Ajustes /></Protected>} />

            {/* Preparacion */}
            <Route path="/preparacion/preparaciones" element={<Protected><Preparaciones /></Protected>} />
            <Route path="/preparacion/pedidos" element={<Protected><Pedidos /></Protected>} />

            {/* Despacho */}
            <Route path="/despacho/despachos" element={<Protected><Despachos /></Protected>} />
            <Route path="/despacho/transportes" element={<Protected><UsuariosTransportes /></Protected>} />

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
            <Route path="/configuracion/contenedores" element={<Protected><Contenedores /></Protected>} />

            {/* Reportes */}
            <Route path="/reportes/stock" element={<Protected><ConsultarStock /></Protected>} />
            <Route path="/reportes/estadisticas" element={<Protected><Estadisticas /></Protected>} />
            <Route path="/reportes/tareas-activas" element={<Protected><TareasRealtime /></Protected>} />

            {/* 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </NotifProvider>
    </AuthProvider>
  )
}
