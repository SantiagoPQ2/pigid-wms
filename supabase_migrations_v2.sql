-- ============================================================
-- PIGID WMS - Migraciones sobre schema existente
-- Correr en Supabase SQL Editor
-- ============================================================

-- ── Tablas extras que el schema original no incluyó ──────────

-- Tareas (el schema usa la de arriba pero con deposito_id)
-- Ya existe via schema original, solo agregamos si falta

-- Notificaciones (nueva)
CREATE TABLE IF NOT EXISTS public.notificaciones (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo       TEXT NOT NULL DEFAULT 'info',
  titulo     TEXT NOT NULL,
  mensaje    TEXT,
  leida      BOOLEAN DEFAULT false,
  link       TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Usuarios operativos (perfil sin auth, para asignación de tareas)
-- Ya existe profiles con auth. Esta es para operarios sin login.
CREATE TABLE IF NOT EXISTS public.operarios (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id UUID NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  nombre     TEXT NOT NULL,
  apellido   TEXT,
  activo     BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── Columnas faltantes en tablas existentes ──────────────────

-- motivos_ajuste: el schema tiene (negocio_id, nombre, tipo) sin descripcion
-- No hace falta agregar descripcion, ya matchea con el frontend

-- ubicaciones: agregar stock_minimo para reposicion picking
ALTER TABLE public.ubicaciones ADD COLUMN IF NOT EXISTS stock_minimo INTEGER DEFAULT 10;

-- tareas: columna texto libre para descripcion (el schema usa observacion)
ALTER TABLE public.tareas ADD COLUMN IF NOT EXISTS descripcion TEXT;
ALTER TABLE public.tareas ADD COLUMN IF NOT EXISTS ubicacion_codigo TEXT;
ALTER TABLE public.tareas ADD COLUMN IF NOT EXISTS articulo_codigo TEXT;
ALTER TABLE public.tareas ADD COLUMN IF NOT EXISTS cantidad NUMERIC(10,3);
ALTER TABLE public.tareas ADD COLUMN IF NOT EXISTS asignado_a TEXT;
ALTER TABLE public.tareas ADD COLUMN IF NOT EXISTS notas TEXT;

-- ── Habilitar Realtime ────────────────────────────────────────
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.tareas;
  EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.notificaciones;
  EXCEPTION WHEN others THEN NULL; END;
END $$;

-- ── Políticas RLS básicas (autenticados ven todo su negocio) ─

-- notificaciones: todos los autenticados pueden ver y crear
ALTER TABLE public.notificaciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "notif_auth" ON public.notificaciones
  FOR ALL USING (auth.role() = 'authenticated');

-- operarios
ALTER TABLE public.operarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "operarios_negocio" ON public.operarios
  FOR ALL USING (
    negocio_id = (SELECT negocio_id FROM public.profiles WHERE id = auth.uid())
  );

-- ── Función para reposición bajo mínimo ──────────────────────
CREATE OR REPLACE FUNCTION public.get_ubicaciones_bajo_minimo(p_deposito_id UUID)
RETURNS TABLE (
  articulo_id  UUID,
  ubicacion_id UUID,
  cantidad     NUMERIC,
  stock_minimo INTEGER
) AS $$
  SELECT s.articulo_id, s.ubicacion_id, s.cantidad,
         COALESCE(u.stock_minimo, 10) AS stock_minimo
  FROM   public.stock s
  JOIN   public.ubicaciones u ON u.id = s.ubicacion_id
  WHERE  s.deposito_id = p_deposito_id
    AND  u.es_picking = true
    AND  s.cantidad <= COALESCE(u.stock_minimo, 10)
$$ LANGUAGE SQL STABLE;
