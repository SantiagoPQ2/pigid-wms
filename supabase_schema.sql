-- ============================================================
-- PIGID WMS - Supabase Schema
-- Paso 1: Borrar tablas existentes (en orden por dependencias)
-- ============================================================

DROP TABLE IF EXISTS public.ubicaciones CASCADE;
DROP TABLE IF EXISTS public.articulos CASCADE;
DROP TABLE IF EXISTS public.clientes CASCADE;
DROP TABLE IF EXISTS public.areas CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- ============================================================
-- Paso 2: Crear todas las tablas del sistema PIGID
-- ============================================================

-- NEGOCIOS (multi-tenant)
CREATE TABLE public.negocios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- DEPOSITOS (un negocio puede tener varios depósitos)
CREATE TABLE public.depositos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id UUID NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  direccion TEXT,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- PROFILES (extiende auth.users de Supabase)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  negocio_id UUID REFERENCES public.negocios(id),
  deposito_id UUID REFERENCES public.depositos(id),
  nombre TEXT,
  apellido TEXT,
  email TEXT,
  rol TEXT DEFAULT 'operario' CHECK (rol IN ('admin', 'supervisor', 'operario', 'externo')),
  activo BOOLEAN DEFAULT true,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- PROVEEDORES
CREATE TABLE public.proveedores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id UUID NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  cuit TEXT,
  email TEXT,
  telefono TEXT,
  direccion TEXT,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- CLIENTES
CREATE TABLE public.clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id UUID NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  cuit TEXT,
  email TEXT,
  telefono TEXT,
  direccion TEXT,
  region TEXT,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ARTICULOS
CREATE TABLE public.articulos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id UUID NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  codigo TEXT NOT NULL,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  unidad_medida TEXT DEFAULT 'UN',
  peso NUMERIC(10,3),
  volumen NUMERIC(10,3),
  requiere_lote BOOLEAN DEFAULT false,
  requiere_serie BOOLEAN DEFAULT false,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(negocio_id, codigo)
);

-- ARTICULO PROPIEDADES
CREATE TABLE public.articulo_propiedades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  articulo_id UUID NOT NULL REFERENCES public.articulos(id) ON DELETE CASCADE,
  clave TEXT NOT NULL,
  valor TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- CONTENEDOR TIPOS
CREATE TABLE public.contenedor_tipos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id UUID NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  activo BOOLEAN DEFAULT true
);

-- CONTENEDOR ESTADOS
CREATE TABLE public.contenedor_estados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id UUID NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  color TEXT DEFAULT '#gray',
  activo BOOLEAN DEFAULT true
);

-- CONTENEDORES
CREATE TABLE public.contenedores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id UUID NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  deposito_id UUID NOT NULL REFERENCES public.depositos(id),
  codigo TEXT NOT NULL,
  tipo_id UUID REFERENCES public.contenedor_tipos(id),
  estado_id UUID REFERENCES public.contenedor_estados(id),
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(negocio_id, codigo)
);

-- TIPO UBICACION
CREATE TABLE public.tipo_ubicacion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id UUID NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  es_picking BOOLEAN DEFAULT false,
  activo BOOLEAN DEFAULT true
);

-- AREAS
CREATE TABLE public.areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deposito_id UUID NOT NULL REFERENCES public.depositos(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  abreviacion TEXT NOT NULL,
  tipo TEXT CHECK (tipo IN ('Almacen', 'Recepcion', 'Picking', 'OverFlow', 'Despacho', 'Preparacion')),
  estado_tarea_defecto TEXT DEFAULT 'Pendiente' CHECK (estado_tarea_defecto IN ('Pendiente', 'EnProceso', 'Finalizado')),
  impresora_id UUID,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- UBICACIONES
CREATE TABLE public.ubicaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id UUID NOT NULL REFERENCES public.areas(id) ON DELETE CASCADE,
  deposito_id UUID NOT NULL REFERENCES public.depositos(id),
  tipo_id UUID REFERENCES public.tipo_ubicacion(id),
  codigo TEXT NOT NULL,
  pasillo TEXT,
  columna TEXT,
  fila TEXT,
  nivel TEXT,
  capacidad_max INTEGER,
  es_picking BOOLEAN DEFAULT false,
  activo BOOLEAN DEFAULT true,
  estado TEXT DEFAULT 'Libre' CHECK (estado IN ('Libre', 'Ocupado', 'Bloqueado')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- IMPRESORAS
CREATE TABLE public.impresoras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deposito_id UUID NOT NULL REFERENCES public.depositos(id),
  nombre TEXT NOT NULL,
  ip TEXT,
  activo BOOLEAN DEFAULT true
);

-- Actualizar areas con FK a impresoras
ALTER TABLE public.areas ADD CONSTRAINT fk_impresora FOREIGN KEY (impresora_id) REFERENCES public.impresoras(id);

-- MOTIVOS AJUSTE
CREATE TABLE public.motivos_ajuste (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id UUID NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  tipo TEXT CHECK (tipo IN ('Entrada', 'Salida')),
  activo BOOLEAN DEFAULT true
);

-- TRANSPORTES (empresas)
CREATE TABLE public.transportes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id UUID NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  cuit TEXT,
  activo BOOLEAN DEFAULT true
);

-- VEHICULOS
CREATE TABLE public.vehiculos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transporte_id UUID NOT NULL REFERENCES public.transportes(id),
  patente TEXT NOT NULL,
  tipo TEXT,
  activo BOOLEAN DEFAULT true
);

-- PERSONAL TRANSPORTE (choferes)
CREATE TABLE public.personal_transporte (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transporte_id UUID NOT NULL REFERENCES public.transportes(id),
  nombre TEXT NOT NULL,
  apellido TEXT NOT NULL,
  dni TEXT,
  licencia TEXT,
  activo BOOLEAN DEFAULT true
);

-- ============================================================
-- RECEPCION
-- ============================================================

CREATE TABLE public.recepciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deposito_id UUID NOT NULL REFERENCES public.depositos(id),
  proveedor_id UUID REFERENCES public.proveedores(id),
  tipo_documento TEXT CHECK (tipo_documento IN ('Factura', 'Remito', 'OrdenCompra', 'Otro')),
  tipo_recepcion TEXT CHECK (tipo_recepcion IN ('Normal', 'ControlCiego', 'Devolucion')),
  numero_documento TEXT,
  orden_compra TEXT,
  fecha DATE DEFAULT CURRENT_DATE,
  estado TEXT DEFAULT 'PendienteArribo' CHECK (estado IN ('PendienteArribo', 'EnRecepcion', 'Finalizado', 'Anulado')),
  observacion TEXT,
  usuario_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.recepcion_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recepcion_id UUID NOT NULL REFERENCES public.recepciones(id) ON DELETE CASCADE,
  articulo_id UUID NOT NULL REFERENCES public.articulos(id),
  cantidad_esperada NUMERIC(10,3),
  cantidad_recibida NUMERIC(10,3) DEFAULT 0,
  ubicacion_id UUID REFERENCES public.ubicaciones(id),
  lote TEXT,
  serie TEXT,
  vencimiento DATE,
  observacion TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- STOCK
-- ============================================================

CREATE TABLE public.stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deposito_id UUID NOT NULL REFERENCES public.depositos(id),
  articulo_id UUID NOT NULL REFERENCES public.articulos(id),
  ubicacion_id UUID NOT NULL REFERENCES public.ubicaciones(id),
  cantidad NUMERIC(10,3) DEFAULT 0,
  lote TEXT,
  serie TEXT,
  vencimiento DATE,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(deposito_id, articulo_id, ubicacion_id, lote, serie)
);

-- ============================================================
-- PEDIDOS
-- ============================================================

CREATE TABLE public.pedidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deposito_id UUID NOT NULL REFERENCES public.depositos(id),
  cliente_id UUID REFERENCES public.clientes(id),
  numero TEXT NOT NULL,
  fecha DATE DEFAULT CURRENT_DATE,
  fecha_entrega DATE,
  estado TEXT DEFAULT 'Pendiente' CHECK (estado IN ('Pendiente', 'EnPreparacion', 'Preparado', 'Despachado', 'Anulado')),
  observacion TEXT,
  usuario_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.pedido_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id UUID NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  articulo_id UUID NOT NULL REFERENCES public.articulos(id),
  cantidad_pedida NUMERIC(10,3) NOT NULL,
  cantidad_preparada NUMERIC(10,3) DEFAULT 0,
  observacion TEXT
);

-- ============================================================
-- PREPARACION
-- ============================================================

CREATE TABLE public.preparaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deposito_id UUID NOT NULL REFERENCES public.depositos(id),
  pedido_id UUID REFERENCES public.pedidos(id),
  numero TEXT,
  estado TEXT DEFAULT 'Pendiente' CHECK (estado IN ('Pendiente', 'EnProceso', 'Finalizado', 'Suspendido', 'Anulado')),
  prioridad INTEGER DEFAULT 0,
  usuario_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.preparacion_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  preparacion_id UUID NOT NULL REFERENCES public.preparaciones(id) ON DELETE CASCADE,
  articulo_id UUID NOT NULL REFERENCES public.articulos(id),
  ubicacion_origen_id UUID REFERENCES public.ubicaciones(id),
  cantidad_requerida NUMERIC(10,3) NOT NULL,
  cantidad_preparada NUMERIC(10,3) DEFAULT 0,
  lote TEXT,
  estado TEXT DEFAULT 'Pendiente' CHECK (estado IN ('Pendiente', 'EnProceso', 'Finalizado'))
);

-- ============================================================
-- TAREAS
-- ============================================================

CREATE TABLE public.tareas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deposito_id UUID NOT NULL REFERENCES public.depositos(id),
  tipo TEXT CHECK (tipo IN ('Picking', 'Reposicion', 'Movimiento', 'Ajuste', 'Recepcion', 'Despacho')),
  estado TEXT DEFAULT 'Pendiente' CHECK (estado IN ('Pendiente', 'EnProceso', 'Finalizado', 'Suspendido', 'Anulado')),
  prioridad INTEGER DEFAULT 0,
  referencia_id UUID,
  referencia_tipo TEXT,
  usuario_asignado_id UUID REFERENCES public.profiles(id),
  area_id UUID REFERENCES public.areas(id),
  observacion TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- MOVIMIENTOS
-- ============================================================

CREATE TABLE public.movimientos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deposito_id UUID NOT NULL REFERENCES public.depositos(id),
  articulo_id UUID NOT NULL REFERENCES public.articulos(id),
  ubicacion_origen_id UUID REFERENCES public.ubicaciones(id),
  ubicacion_destino_id UUID REFERENCES public.ubicaciones(id),
  cantidad NUMERIC(10,3) NOT NULL,
  tipo TEXT CHECK (tipo IN ('Entrada', 'Salida', 'Transferencia', 'Ajuste')),
  motivo_ajuste_id UUID REFERENCES public.motivos_ajuste(id),
  referencia_id UUID,
  referencia_tipo TEXT,
  lote TEXT,
  usuario_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- AJUSTES
-- ============================================================

CREATE TABLE public.ajustes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deposito_id UUID NOT NULL REFERENCES public.depositos(id),
  motivo_id UUID REFERENCES public.motivos_ajuste(id),
  articulo_id UUID NOT NULL REFERENCES public.articulos(id),
  ubicacion_id UUID REFERENCES public.ubicaciones(id),
  cantidad NUMERIC(10,3) NOT NULL,
  tipo TEXT CHECK (tipo IN ('Entrada', 'Salida')),
  observacion TEXT,
  usuario_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- DESPACHO
-- ============================================================

CREATE TABLE public.despachos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deposito_id UUID NOT NULL REFERENCES public.depositos(id),
  numero TEXT,
  fecha DATE DEFAULT CURRENT_DATE,
  estado TEXT DEFAULT 'Pendiente' CHECK (estado IN ('Pendiente', 'EnCarga', 'Despachado', 'Anulado')),
  transporte_id UUID REFERENCES public.transportes(id),
  vehiculo_id UUID REFERENCES public.vehiculos(id),
  chofer_id UUID REFERENCES public.personal_transporte(id),
  observacion TEXT,
  usuario_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.despacho_pedidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  despacho_id UUID NOT NULL REFERENCES public.despachos(id) ON DELETE CASCADE,
  pedido_id UUID NOT NULL REFERENCES public.pedidos(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- REPOSICION DE PICKING
-- ============================================================

CREATE TABLE public.reposicion_picking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deposito_id UUID NOT NULL REFERENCES public.depositos(id),
  articulo_id UUID NOT NULL REFERENCES public.articulos(id),
  ubicacion_picking_id UUID NOT NULL REFERENCES public.ubicaciones(id),
  ubicacion_origen_id UUID REFERENCES public.ubicaciones(id),
  cantidad NUMERIC(10,3) NOT NULL,
  estado TEXT DEFAULT 'Pendiente' CHECK (estado IN ('Pendiente', 'EnProceso', 'Finalizado')),
  usuario_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- RLS (Row Level Security)
-- ============================================================

ALTER TABLE public.negocios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.depositos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ubicaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.articulos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proveedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedido_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recepciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recepcion_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preparaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preparacion_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tareas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ajustes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.despachos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.despacho_pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transportes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehiculos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contenedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.motivos_ajuste ENABLE ROW LEVEL SECURITY;

-- Políticas básicas: usuarios autenticados ven su negocio
CREATE POLICY "profiles_self" ON public.profiles
  FOR ALL USING (auth.uid() = id);

CREATE POLICY "authenticated_read" ON public.negocios
  FOR SELECT USING (auth.role() = 'authenticated');

-- ============================================================
-- FUNCIÓN: auto-crear profile al registrarse
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nombre)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nombre', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- DATOS INICIALES DE EJEMPLO
-- ============================================================

INSERT INTO public.negocios (id, nombre) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Mi Empresa');

INSERT INTO public.depositos (id, negocio_id, nombre) VALUES
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Deposito Principal');

INSERT INTO public.tipo_ubicacion (negocio_id, nombre, es_picking) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Rack', false),
  ('00000000-0000-0000-0000-000000000001', 'Picking', true),
  ('00000000-0000-0000-0000-000000000001', 'Suelo', false);

INSERT INTO public.motivos_ajuste (negocio_id, nombre, tipo) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Inventario', 'Entrada'),
  ('00000000-0000-0000-0000-000000000001', 'Inventario', 'Salida'),
  ('00000000-0000-0000-0000-000000000001', 'Merma', 'Salida'),
  ('00000000-0000-0000-0000-000000000001', 'Rotura', 'Salida');
