import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  Package, ChevronDown, Bell, Search, LogOut, Settings,
  Truck, ClipboardList, LayoutDashboard, Warehouse,
  ShoppingCart, PackageCheck, Send, BarChart2, Users
} from 'lucide-react'

const navItems = [
  {
    label: 'Recepcion',
    icon: PackageCheck,
    children: [
      { label: 'Documentos', path: '/recepcion/documentos' },
      { label: 'Control Ciego', path: '/recepcion/control-ciego' },
    ]
  },
  {
    label: 'Deposito',
    icon: Warehouse,
    children: [
      { label: 'Areas', path: '/deposito/areas' },
      { label: 'Ubicaciones', path: '/deposito/ubicaciones' },
      { label: 'Reposicion de Picking', path: '/deposito/reposicion' },
      { label: 'Tareas', path: '/deposito/tareas' },
      { label: 'Movimientos', path: '/deposito/movimientos' },
      { label: 'Ajustes', path: '/deposito/ajustes' },
    ]
  },
  {
    label: 'Preparacion',
    icon: ClipboardList,
    children: [
      { label: 'Preparaciones', path: '/preparacion/preparaciones' },
      { label: 'Pedidos', path: '/preparacion/pedidos' },
    ]
  },
  {
    label: 'Despacho',
    icon: Truck,
    children: [
      { label: 'Despachos', path: '/despacho/despachos' },
      { label: 'Transportes', path: '/despacho/transportes' },
    ]
  },
  {
    label: 'Configuracion',
    icon: Settings,
    children: [
      { label: 'Artículos', path: '/configuracion/articulos' },
      { label: 'Clientes', path: '/configuracion/clientes' },
      { label: 'Proveedores', path: '/configuracion/proveedores' },
      { label: 'Contenedores', path: '/configuracion/contenedores' },
      { label: 'Impresoras', path: '/configuracion/impresoras' },
      { label: 'Usuarios', path: '/configuracion/usuarios' },
      { label: 'Transportes', path: '/configuracion/transportes' },
      { label: 'Tipo de Ubicación', path: '/configuracion/tipo-ubicacion' },
      { label: 'Motivo Ajuste', path: '/configuracion/motivo-ajuste' },
      { label: 'Negocio', path: '/configuracion/negocio' },
    ]
  },
  {
    label: 'Reportes',
    icon: BarChart2,
    children: [
      { label: 'Consultar Stock', path: '/reportes/stock' },
      { label: 'Tareas Activas', path: '/reportes/tareas-activas' },
      { label: 'Estadísticas Usuarios', path: '/reportes/estadisticas' },
    ]
  },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const { profile, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-dark-900 font-sans">
      {/* Top navbar */}
      <header className="bg-dark-800 border-b border-dark-600 sticky top-0 z-50">
        <div className="flex items-center h-14 px-4 gap-4">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 mr-4 shrink-0">
            <div className="w-7 h-7 bg-primary-600 rounded-lg flex items-center justify-center">
              <Package className="w-4 h-4 text-white" />
            </div>
            <span className="text-white font-bold font-mono text-lg tracking-tight">PIGID</span>
          </Link>

          {/* Nav items */}
          <nav className="flex items-center gap-1 flex-1">
            {navItems.map(item => (
              <div key={item.label} className="relative">
                <button
                  onMouseEnter={() => setOpenMenu(item.label)}
                  onMouseLeave={() => setOpenMenu(null)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                    ${openMenu === item.label ? 'bg-dark-600 text-white' : 'text-gray-400 hover:text-white hover:bg-dark-700'}`}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                  <ChevronDown className="w-3 h-3" />
                </button>

                {/* Dropdown */}
                {openMenu === item.label && (
                  <div
                    className="absolute top-full left-0 mt-1 w-52 bg-dark-700 border border-dark-500 rounded-xl shadow-2xl py-1 z-50"
                    onMouseEnter={() => setOpenMenu(item.label)}
                    onMouseLeave={() => setOpenMenu(null)}
                  >
                    {item.children.map(child => (
                      <Link
                        key={child.path}
                        to={child.path}
                        className={`block px-4 py-2.5 text-sm transition-colors
                          ${location.pathname === child.path
                            ? 'text-primary-400 bg-primary-900/20'
                            : 'text-gray-300 hover:text-white hover:bg-dark-600'}`}
                      >
                        {child.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-3 shrink-0">
            <button className="text-gray-400 hover:text-white transition-colors">
              <Search className="w-4 h-4" />
            </button>
            <button className="text-gray-400 hover:text-white transition-colors relative">
              <Bell className="w-4 h-4" />
            </button>

            <div className="h-5 w-px bg-dark-500" />

            <div className="flex items-center gap-2">
              <div className="text-right">
                <p className="text-xs font-medium text-white leading-none">
                  {profile?.nombre || 'Usuario'}
                </p>
                <p className="text-xs text-gray-500 mt-0.5 capitalize">{profile?.rol}</p>
              </div>
              <button
                onClick={handleSignOut}
                className="text-gray-500 hover:text-red-400 transition-colors ml-1"
                title="Salir"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="p-6">
        {children}
      </main>
    </div>
  )
}
