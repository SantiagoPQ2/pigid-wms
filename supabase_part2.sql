-- ============================================================
-- PIGID WMS - SQL PARTE 2: Datos de ejemplo + Realtime + Función
-- Ejecutar DESPUÉS de la Parte 1
-- ============================================================

-- Habilitar Realtime (ignorar si ya están)
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE tareas;
  EXCEPTION WHEN others THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE notificaciones;
  EXCEPTION WHEN others THEN NULL;
  END;
END $$;

-- Datos de ejemplo para motivos_ajuste (solo si está vacía)
INSERT INTO motivos_ajuste (nombre, descripcion)
SELECT * FROM (VALUES
  ('Inventario físico',      'Corrección por conteo físico'),
  ('Merma',                  'Pérdida por deterioro o vencimiento'),
  ('Error de ingreso',       'Corrección de error en recepción'),
  ('Devolución cliente',     'Mercadería devuelta por cliente'),
  ('Rotura',                 'Producto dañado o roto'),
  ('Diferencia de despacho', 'Diferencia detectada en despacho')
) AS v(nombre, descripcion)
WHERE NOT EXISTS (SELECT 1 FROM motivos_ajuste LIMIT 1);

-- Datos de ejemplo para tipos_ubicacion (solo si está vacía)
INSERT INTO tipos_ubicacion (nombre, descripcion)
SELECT * FROM (VALUES
  ('Picking',      'Ubicación de picking activo'),
  ('Reserva',      'Stock de reserva en altura'),
  ('Recepción',    'Zona de recepción de mercadería'),
  ('Despacho',     'Zona de staging para despacho'),
  ('Cuarentena',   'Mercadería en cuarentena'),
  ('Devoluciones', 'Zona de devoluciones')
) AS v(nombre, descripcion)
WHERE NOT EXISTS (SELECT 1 FROM tipos_ubicacion LIMIT 1);

-- Función para reposición automática
CREATE OR REPLACE FUNCTION get_ubicaciones_bajo_minimo()
RETURNS TABLE (
  articulo_id   UUID,
  ubicacion_id  UUID,
  cantidad      INTEGER,
  stock_minimo  INTEGER,
  reserva_id    UUID,
  stock_reserva INTEGER
) AS $$
  SELECT
    s.articulo_id,
    s.ubicacion_id,
    s.cantidad,
    COALESCE(u.stock_minimo, 10) AS stock_minimo,
    NULL::UUID AS reserva_id,
    0          AS stock_reserva
  FROM  stock s
  JOIN  ubicaciones u ON u.id = s.ubicacion_id
  WHERE u.tipo_ubicacion = 'Picking'
    AND s.cantidad <= COALESCE(u.stock_minimo, 10)
$$ LANGUAGE SQL STABLE;
