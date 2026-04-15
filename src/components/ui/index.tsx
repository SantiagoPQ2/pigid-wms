import { ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'

// Page Header
export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-6">
      <h1 className="text-xl font-semibold text-white">{title}</h1>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  )
}

// Card
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bg-dark-800 border border-dark-600 rounded-xl ${className}`}>
      {children}
    </div>
  )
}

// Badge
type BadgeVariant = 'green' | 'yellow' | 'red' | 'blue' | 'gray' | 'orange'
const badgeColors: Record<BadgeVariant, string> = {
  green: 'bg-green-900/40 text-green-400 border-green-700/50',
  yellow: 'bg-yellow-900/40 text-yellow-400 border-yellow-700/50',
  red: 'bg-red-900/40 text-red-400 border-red-700/50',
  blue: 'bg-blue-900/40 text-blue-400 border-blue-700/50',
  gray: 'bg-gray-800 text-gray-400 border-gray-600',
  orange: 'bg-orange-900/40 text-orange-400 border-orange-700/50',
}
export function Badge({ label, variant = 'gray' }: { label: string; variant?: BadgeVariant }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${badgeColors[variant]}`}>
      {label}
    </span>
  )
}

// Estado badges
export function EstadoBadge({ estado }: { estado: string }) {
  const map: Record<string, BadgeVariant> = {
    Pendiente: 'yellow',
    PendienteArribo: 'yellow',
    EnRecepcion: 'blue',
    EnProceso: 'blue',
    EnPreparacion: 'blue',
    EnCarga: 'blue',
    Finalizado: 'green',
    Preparado: 'green',
    Despachado: 'green',
    Suspendido: 'orange',
    Anulado: 'red',
    Libre: 'green',
    Ocupado: 'yellow',
    Bloqueado: 'red',
  }
  return <Badge label={estado} variant={map[estado] ?? 'gray'} />
}

// Button
type BtnVariant = 'primary' | 'secondary' | 'danger' | 'ghost'
const btnStyles: Record<BtnVariant, string> = {
  primary: 'bg-primary-600 hover:bg-primary-700 text-white',
  secondary: 'bg-dark-600 hover:bg-dark-500 text-white border border-dark-500',
  danger: 'bg-red-700 hover:bg-red-600 text-white',
  ghost: 'text-gray-400 hover:text-white hover:bg-dark-700',
}
export function Button({
  children, onClick, variant = 'primary', size = 'md', disabled = false, className = '', type = 'button'
}: {
  children: ReactNode
  onClick?: () => void
  variant?: BtnVariant
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  className?: string
  type?: 'button' | 'submit' | 'reset'
}) {
  const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2 text-sm', lg: 'px-5 py-2.5 text-sm' }
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-2 font-medium rounded-lg transition-colors
        disabled:opacity-50 disabled:cursor-not-allowed
        ${btnStyles[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </button>
  )
}

// Table
export function Table({ headers, children, empty = 'Sin resultados' }: {
  headers: string[]
  children: ReactNode
  empty?: string
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-dark-600">
            {headers.map(h => (
              <th key={h} className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-dark-700">
          {children}
        </tbody>
      </table>
    </div>
  )
}

export function Tr({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <tr
      onClick={onClick}
      className={`text-gray-300 ${onClick ? 'cursor-pointer hover:bg-dark-700/50' : ''} transition-colors`}
    >
      {children}
    </tr>
  )
}

export function Td({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <td className={`px-4 py-3 ${className}`}>{children}</td>
}

// Input
export function Input({ label, ...props }: { label?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1">
      {label && <label className="block text-xs font-medium text-gray-400">{label}</label>}
      <input
        {...props}
        className="w-full bg-dark-700 border border-dark-500 text-white rounded-lg px-3 py-2 text-sm
          placeholder-gray-600 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500
          transition-colors disabled:opacity-50"
      />
    </div>
  )
}

// Select
export function Select({ label, children, ...props }: { label?: string } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="space-y-1">
      {label && <label className="block text-xs font-medium text-gray-400">{label}</label>}
      <select
        {...props}
        className="w-full bg-dark-700 border border-dark-500 text-white rounded-lg px-3 py-2 text-sm
          focus:outline-none focus:border-primary-500 transition-colors"
      >
        {children}
      </select>
    </div>
  )
}

// Loading spinner
export function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="w-8 h-8 border-2 border-dark-500 border-t-primary-500 rounded-full animate-spin" />
    </div>
  )
}

// Stats card
export function StatCard({ label, value, icon: Icon, color = 'green' }: {
  label: string; value: string | number; icon: React.ElementType; color?: string
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{label}</p>
          <p className="text-2xl font-bold text-white font-mono">{value}</p>
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-${color}-900/40`}>
          <Icon className={`w-5 h-5 text-${color}-400`} />
        </div>
      </div>
    </Card>
  )
}
