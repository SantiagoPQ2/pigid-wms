# PIGID WMS

Sistema de Gestión de Depósito (WMS) - Clon funcional de Digip WMS.

## Stack
- **Frontend**: React + TypeScript + Tailwind CSS
- **DB**: Supabase (PostgreSQL)  
- **Deploy**: Netlify
- **URL**: https://pigid.netlify.app

## Setup

### 1. Supabase
Ejecutar en orden en el SQL Editor de Supabase:
1. `supabase_schema.sql` — Schema base (ya ejecutado)
2. `supabase_migrations_v2.sql` — Migraciones adicionales
3. `sql/articulos_part1.sql` a `sql/articulos_part10.sql` — Importar artículos

### 2. Variables de entorno (Netlify)
```
VITE_SUPABASE_URL=https://ivriqgapkcjqnbfvsqtz.supabase.co
VITE_SUPABASE_ANON_KEY=...
```

### 3. PWA
La app es instalable como PWA en Android e iOS.
- Android: Chrome → Menú → "Agregar a pantalla de inicio"
- iOS: Safari → Compartir → "Agregar a pantalla de inicio"

## Módulos
- **Recepción**: Documentos + Control Ciego
- **Depósito**: Áreas, Ubicaciones, Reposición Picking, Tareas, Movimientos, Ajustes
- **Preparación**: Preparaciones + Pedidos
- **Despacho**: Despachos
- **Configuración**: Artículos, Clientes, Proveedores, Contenedores, Impresoras, Usuarios, Transportes, Tipo Ubicación, Motivo Ajuste, Negocio
- **Reportes**: Stock, Tareas en Tiempo Real, Estadísticas
