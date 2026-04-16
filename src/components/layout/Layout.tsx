import { useState, useEffect, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  Package, ChevronDown, LogOut, Settings, Truck,
  ClipboardList, Warehouse, PackageCheck, Send, BarChart2,
  Menu, X, ChevronRight, LayoutDashboard
} from 'lucide-react'
import NotifPanel from '../NotifPanel'

const navItems = [
  { label: 'Recepcion', icon: PackageCheck, children: [
    { label: 'Documentos', path: '/recepcion/documentos' },
    { label: 'Control Ciego', path: '/recepcion/control-ciego' },
  ]},
  { label: 'Deposito', icon: Warehouse, children: [
    { label: 'Areas', path: '/deposito/areas' },
    { label: 'Ubicaciones', path: '/deposito/ubicaciones' },
    { label: 'Reposicion Picking', path: '/deposito/reposicion' },
    { label: 'Tareas', path: '/deposito/tareas' },
    { label: 'Movimientos', path: '/deposito/movimientos' },
    { label: 'Ajustes', path: '/deposito/ajustes' },
  ]},
  { label: 'Preparacion', icon: ClipboardList, children: [
    { label: 'Preparaciones', path: '/preparacion/preparaciones' },
    { label: 'Pedidos', path: '/preparacion/pedidos' },
  ]},
  { label: 'Despacho', icon: Truck, children: [
    { label: 'Despachos', path: '/despacho/despachos' },
    { label: 'Transportes', path: '/despacho/transportes' },
  ]},
  { label: 'Configuracion', icon: Settings, children: [
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
  ]},
  { label: 'Reportes', icon: BarChart2, children: [
    { label: 'Consultar Stock', path: '/reportes/stock' },
    { label: 'Tareas Activas', path: '/reportes/tareas-activas' },
    { label: 'Estadísticas', path: '/reportes/estadisticas' },
  ]},
]

const bottomTabs = [
  { label: 'Inicio', icon: LayoutDashboard, path: '/' },
  { label: 'Recepción', icon: PackageCheck, path: '/recepcion/documentos' },
  { label: 'Preparación', icon: ClipboardList, path: '/preparacion/preparaciones' },
  { label: 'Despacho', icon: Send, path: '/despacho/despachos' },
  { label: 'Menú', icon: Menu, path: '__menu__' },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [mobileSection, setMobileSection] = useState<string | null>(null)
  const { profile, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const navRef = useRef<HTMLDivElement>(null)

  // Cerrar dropdown al clickear fuera
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenMenu(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Cerrar dropdown al cambiar de ruta
  useEffect(() => {
    setOpenMenu(null)
    setMobileOpen(false)
    setMobileSection(null)
  }, [location.pathname])

  const handleSignOut = async () => { await signOut(); navigate('/login') }
  const isActive = (path: string) => location.pathname === path
  const isSectionActive = (children: { path: string }[]) =>
    children.some(c => location.pathname.startsWith(c.path))

  function toggleMenu(label: string) {
    setOpenMenu(prev => prev === label ? null : label)
  }

  return (
    <div className="min-h-screen bg-dark-900 font-sans">

      {/* ── DESKTOP NAVBAR ──────────────────────────────────── */}
      <header className="hidden md:flex bg-dark-800 border-b border-dark-600 sticky top-0 z-50 h-14 items-center px-4 gap-4">
        <Link to="/" className="flex items-center gap-2 mr-4 shrink-0">
          <div className="w-7 h-7 bg-primary-600 rounded-lg flex items-center justify-center">
            <Package className="w-4 h-4 text-white" />
          </div>
          <span className="text-white font-bold font-mono text-lg tracking-tight">PIGID</span>
        </Link>

        <nav ref={navRef} className="flex items-center gap-0.5 flex-1">
          {navItems.map(item => (
            <div key={item.label} className="relative">
              <button
                onClick={() => toggleMenu(item.label)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors select-none ${
                  isSectionActive(item.children)
                    ? 'text-primary-400 bg-primary-900/20'
                    : openMenu === item.label
                    ? 'bg-dark-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-dark-700'
                }`}
              >
                <item.icon className="w-4 h-4" />
                <span>{item.label}</span>
                <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${openMenu === item.label ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown */}
              {openMenu === item.label && (
                <div className="absolute top-full left-0 mt-1 w-52 bg-dark-700 border border-dark-500 rounded-xl shadow-2xl py-1 z-[100]">
                  {item.children.map(child => (
                    <Link
                      key={child.path}
                      to={child.path}
                      className={`block px-4 py-2.5 text-sm transition-colors ${
                        isActive(child.path)
                          ? 'text-primary-400 bg-primary-900/20'
                          : 'text-gray-300 hover:text-white hover:bg-dark-600'
                      }`}
                    >
                      {child.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <NotifPanel />
          <div className="h-5 w-px bg-dark-500" />
          <div className="hidden lg:block text-right">
            <p className="text-xs font-medium text-white leading-none">{profile?.nombre || 'Usuario'}</p>
            <p className="text-xs text-gray-500 mt-0.5 capitalize">{profile?.rol}</p>
          </div>
          <button onClick={handleSignOut} className="text-gray-500 hover:text-red-400 transition-colors p-1" title="Salir">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ── MOBILE TOP BAR ───────────────────────────────────── */}
      <header className="flex md:hidden bg-dark-800 border-b border-dark-600 sticky top-0 z-50 h-14 items-center px-4 justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-7 h-7 bg-primary-600 rounded-lg flex items-center justify-center">
            <Package className="w-4 h-4 text-white" />
          </div>
          <span className="text-white font-bold font-mono text-base tracking-tight">PIGID</span>
        </Link>
        <div className="flex items-center gap-1">
          <NotifPanel />
          <button onClick={handleSignOut} className="text-gray-500 hover:text-red-400 transition-colors p-2">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ── MOBILE SIDE DRAWER ──────────────────────────────── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[200] md:hidden flex">
          <div className="absolute inset-0 bg-black/60" onClick={() => { setMobileOpen(false); setMobileSection(null) }} />
          <div className="relative w-72 bg-dark-800 h-full flex flex-col shadow-2xl overflow-y-auto">
            <div className="flex items-center justify-between px-4 py-4 border-b border-dark-700">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-primary-600 rounded-lg flex items-center justify-center">
                  <Package className="w-4 h-4 text-white" />
                </div>
                <span className="text-white font-bold font-mono">PIGID WMS</span>
              </div>
              <button onClick={() => { setMobileOpen(false); setMobileSection(null) }} className="text-dark-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-4 py-3 border-b border-dark-700 bg-dark-900/50">
              <p className="text-white text-sm font-medium">{profile?.nombre || 'Usuario'}</p>
              <p className="text-dark-400 text-xs capitalize">{profile?.rol}</p>
            </div>

            <nav className="flex-1 py-2">
              <Link to="/" onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 text-sm transition-colors ${
                  isActive('/') ? 'text-primary-400 bg-primary-900/20' : 'text-gray-300 hover:text-white hover:bg-dark-700'
                }`}>
                <LayoutDashboard className="w-4 h-4" />
                Dashboard
              </Link>

              {navItems.map(item => (
                <div key={item.label}>
                  <button
                    onClick={() => setMobileSection(mobileSection === item.label ? null : item.label)}
                    className={`w-full flex items-center justify-between px-4 py-3 text-sm transition-colors ${
                      isSectionActive(item.children) ? 'text-primary-400' : 'text-gray-300 hover:text-white hover:bg-dark-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className="w-4 h-4" />
                      {item.label}
                    </div>
                    <ChevronRight className={`w-4 h-4 transition-transform ${mobileSection === item.label ? 'rotate-90' : ''}`} />
                  </button>
                  {mobileSection === item.label && (
                    <div className="bg-dark-900/40 border-l-2 border-primary-600/30 ml-4">
                      {item.children.map(child => (
                        <Link key={child.path} to={child.path}
                          onClick={() => { setMobileOpen(false); setMobileSection(null) }}
                          className={`block px-6 py-2.5 text-sm transition-colors ${
                            isActive(child.path) ? 'text-primary-400' : 'text-gray-400 hover:text-white'
                          }`}>
                          {child.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </nav>

            <div className="border-t border-dark-700 p-4">
              <button onClick={handleSignOut} className="w-full flex items-center gap-3 text-sm text-gray-400 hover:text-red-400 transition-colors py-2">
                <LogOut className="w-4 h-4" />
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PAGE CONTENT ─────────────────────────────────────── */}
      <main className="pb-20 md:pb-0">
        {children}
      </main>

      {/* ── MOBILE BOTTOM TAB BAR ────────────────────────────── */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-dark-800 border-t border-dark-600 flex">
        {bottomTabs.map(tab => {
          const active = tab.path === '__menu__' ? mobileOpen : isActive(tab.path)
          return (
            <button
              key={tab.label}
              onClick={() => {
                if (tab.path === '__menu__') {
                  setMobileOpen(o => !o)
                  setMobileSection(null)
                } else {
                  navigate(tab.path)
                  setMobileOpen(false)
                }
              }}
              className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors ${
                active ? 'text-primary-400' : 'text-dark-500 hover:text-dark-300'
              }`}
            >
              <tab.icon className="w-5 h-5" />
              <span className="text-xs">{tab.label}</span>
            </button>
          )
        })}
      </nav>

    </div>
  )
}
