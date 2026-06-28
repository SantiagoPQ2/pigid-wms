export interface Profile {
  id: string
  negocio_id: string | null
  deposito_id: string | null
  nombre: string | null
  apellido: string | null
  email: string | null
  rol: 'admin' | 'supervisor' | 'operario' | 'externo'
  activo: boolean
}

export interface Negocio {
  id: string
  nombre: string
  activo: boolean
}

export interface Deposito {
  id: string
  negocio_id: string
  nombre: string
  activo: boolean
}

export interface Area {
  id: string
  deposito_id: string
  nombre: string
  abreviacion: string
  tipo: 'Almacen' | 'Recepcion' | 'Picking' | 'OverFlow' | 'Despacho' | 'Preparacion'
  estado_tarea_defecto: string
  activo: boolean
}

export interface Ubicacion {
  id: string
  area_id: string
  deposito_id: string
  codigo: string
  pasillo: string | null
  columna: string | null
  fila: string | null
  nivel: string | null
  es_picking: boolean
  activo: boolean
  estado: 'Libre' | 'Ocupado' | 'Bloqueado'
  areas?: Area
}

export interface Articulo {
  id: string
  negocio_id: string
  codigo: string
  nombre: string
  descripcion: string | null
  unidad_medida: string
  activo: boolean
}

export interface Cliente {
  id: string
  negocio_id: string
  nombre: string
  cuit: string | null
  email: string | null
  telefono: string | null
  direccion: string | null
  region: string | null
  activo: boolean
}

export interface Proveedor {
  id: string
  negocio_id: string
  nombre: string
  cuit: string | null
  activo: boolean
}

export interface Recepcion {
  id: string
  deposito_id: string
  proveedor_id: string | null
  tipo_documento: string | null
  tipo_recepcion: string | null
  numero_documento: string | null
  orden_compra: string | null
  fecha: string
  estado: 'PendienteArribo' | 'EnRecepcion' | 'Finalizado' | 'Anulado'
  observacion: string | null
  proveedores?: Proveedor
}

export interface Pedido {
  id: string
  deposito_id: string
  cliente_id: string | null
  numero: string
  fecha: string
  fecha_entrega: string | null
  estado: 'Pendiente' | 'EnPreparacion' | 'Preparado' | 'Despachado' | 'Anulado'
  observacion: string | null
  clientes?: Cliente
}

export interface Preparacion {
  id: string
  deposito_id: string
  pedido_id: string | null
  numero: string | null
  estado: 'Pendiente' | 'EnProceso' | 'Finalizado' | 'Suspendido' | 'Anulado'
  prioridad: number
  pedidos?: Pedido
}

export interface Tarea {
  id: string
  deposito_id: string
  tipo: 'Picking' | 'Reposicion' | 'Movimiento' | 'Ajuste' | 'Recepcion' | 'Despacho'
  estado: 'Pendiente' | 'EnProceso' | 'Finalizado' | 'Suspendido' | 'Anulado'
  prioridad: number
  observacion: string | null
  created_at: string
}

export interface Despacho {
  id: string
  deposito_id: string
  numero: string | null
  fecha: string
  estado: 'Pendiente' | 'EnCarga' | 'Despachado' | 'Anulado'
  observacion: string | null
  transportes?: { nombre: string }
  vehiculos?: { patente: string }
}

export interface Stock {
  id: string
  deposito_id: string
  articulo_id: string
  ubicacion_id: string
  cantidad: number
  lote: string | null
  articulos?: Articulo
  ubicaciones?: Ubicacion
}
