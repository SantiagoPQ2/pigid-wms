-- ============================================================
-- PIGID WMS - Supabase Schema Migrations
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- ── Tablas de configuración ──────────────────────────────────

CREATE TABLE IF NOT EXISTS tipos_ubicacion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  descripcion TEXT,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS motivos_ajuste (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  descripcion TEXT,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS impresoras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  modelo TEXT,
  ip TEXT,
  tipo TEXT DEFAULT 'etiquetas',
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS negocios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT,
  razon_social TEXT,
  cuit TEXT,
  direccion TEXT,
  telefono TEXT,
  email TEXT,
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── Contenedores ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS contenedores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL UNIQUE,
  descripcion TEXT,
  tipo TEXT DEFAULT 'paleta',
  capacidad_max INTEGER DEFAULT 100,
  tara_kg NUMERIC(8,2),
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── Usuarios del sistema (no auth, solo perfil operativo) ────

CREATE TABLE IF NOT EXISTS usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  rol TEXT DEFAULT 'operario',
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── Transportes ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS transportes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  cuit TEXT,
  telefono TEXT,
  email TEXT,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── Stock ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  articulo_id UUID REFERENCES articulos(id),
  ubicacion_id UUID REFERENCES ubicaciones(id),
  cantidad INTEGER DEFAULT 0,
  lote TEXT,
  fecha_vencimiento DATE,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(articulo_id, ubicacion_id, lote)
);

-- ── Reposicion picking ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS reposicion_picking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  articulo_id UUID REFERENCES articulos(id),
  ubicacion_picking_id UUID REFERENCES ubicaciones(id),
  ubicacion_reserva_id UUID REFERENCES ubicaciones(id),
  cantidad_minima INTEGER DEFAULT 10,
  cantidad_actual INTEGER DEFAULT 0,
  cantidad_reponer INTEGER DEFAULT 0,
  stock_reserva INTEGER DEFAULT 0,
  estado TEXT DEFAULT 'pendiente',
  prioridad INTEGER DEFAULT 2,
  asignado_a TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── Tareas ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tareas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT DEFAULT 'otro',
  descripcion TEXT NOT NULL,
  ubicacion_codigo TEXT,
  articulo_codigo TEXT,
  cantidad INTEGER,
  estado TEXT DEFAULT 'pendiente',
  prioridad INTEGER DEFAULT 2,
  asignado_a TEXT,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── Notificaciones ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notificaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  mensaje TEXT,
  leida BOOLEAN DEFAULT false,
  link TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── Ubicaciones: agregar columna stock_minimo si no existe ───

ALTER TABLE ubicaciones ADD COLUMN IF NOT EXISTS stock_minimo INTEGER DEFAULT 10;

-- ── Habilitar Realtime para tareas y notificaciones ──────────

ALTER PUBLICATION supabase_realtime ADD TABLE tareas;
ALTER PUBLICATION supabase_realtime ADD TABLE notificaciones;

-- ── Datos de ejemplo para motivos de ajuste ──────────────────

INSERT INTO motivos_ajuste (nombre, descripcion) VALUES
  ('Inventario físico', 'Corrección por conteo físico'),
  ('Merma', 'Pérdida por deterioro o vencimiento'),
  ('Error de ingreso', 'Corrección de error en recepción'),
  ('Devolución cliente', 'Mercadería devuelta por cliente'),
  ('Rotura', 'Producto dañado o roto'),
  ('Diferencia de despacho', 'Diferencia detectada en despacho')
ON CONFLICT DO NOTHING;

-- ── Datos de ejemplo para tipos de ubicación ────────────────

INSERT INTO tipos_ubicacion (nombre, descripcion) VALUES
  ('Picking', 'Ubicación de picking activo'),
  ('Reserva', 'Stock de reserva en altura'),
  ('Recepción', 'Zona de recepción de mercadería'),
  ('Despacho', 'Zona de staging para despacho'),
  ('Cuarentena', 'Mercadería en cuarentena'),
  ('Devoluciones', 'Zona de devoluciones')
ON CONFLICT DO NOTHING;

-- ── Función para obtener ubicaciones bajo mínimo ─────────────

CREATE OR REPLACE FUNCTION get_ubicaciones_bajo_minimo()
RETURNS TABLE (
  articulo_id UUID,
  ubicacion_id UUID,
  cantidad INTEGER,
  stock_minimo INTEGER,
  reserva_id UUID,
  stock_reserva INTEGER
) AS $$
  SELECT
    s.articulo_id,
    s.ubicacion_id,
    s.cantidad,
    COALESCE(u.stock_minimo, 10) as stock_minimo,
    NULL::UUID as reserva_id,
    0 as stock_reserva
  FROM stock s
  JOIN ubicaciones u ON u.id = s.ubicacion_id
  WHERE u.tipo_ubicacion = 'Picking'
    AND s.cantidad <= COALESCE(u.stock_minimo, 10)
$$ LANGUAGE SQL;
