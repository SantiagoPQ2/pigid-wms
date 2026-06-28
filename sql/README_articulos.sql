-- ============================================================
-- PIGID WMS - Importar artículos via Supabase Dashboard
-- ============================================================
-- OPCION 1 (recomendada): Usar la API REST directamente
--   Correr scripts/importar_articulos.py con tu service_role key
--
-- OPCION 2: Importar CSV desde Supabase Dashboard
--   1. Ir a Table Editor > articulos
--   2. Click "Import data from CSV"  
--   3. Subir el archivo Articulos.csv (separador: punto y coma)
--   4. Mapear columnas:
--      Codigo -> codigo
--      Descripcion -> nombre  
--      UnidadMedida -> unidad_medida
--      UsaLote -> requiere_lote
--      UsaSerie -> requiere_serie
--      Activo -> activo
--   5. Agregar negocio_id = '00000000-0000-0000-0000-000000000001'
--
-- OPCION 3: SQL manual (solo para pocos artículos de prueba)

INSERT INTO public.articulos (negocio_id, codigo, nombre, unidad_medida, requiere_lote, requiere_serie, activo)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'TEST001', 'Artículo de prueba 1', 'UN', false, false, true),
  ('00000000-0000-0000-0000-000000000001', 'TEST002', 'Artículo de prueba 2', 'KG', false, false, true),
  ('00000000-0000-0000-0000-000000000001', 'TEST003', 'Artículo de prueba 3', 'LT', false, false, true)
ON CONFLICT (negocio_id, codigo) DO NOTHING;
