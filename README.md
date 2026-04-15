# PIGID WMS

Sistema de Gestión de Almacenes — React + Supabase + Netlify

## Stack

- **Frontend**: React 18 + TypeScript + Tailwind CSS
- **Base de datos**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth (JWT)
- **Deploy**: Netlify
- **Realtime**: Supabase Realtime

## Setup inicial

### 1. Clonar y instalar

```bash
git clone https://github.com/TU_USUARIO/pigid-wms.git
cd pigid-wms
npm install
```

### 2. Variables de entorno

Copiá `.env.example` a `.env` y completá con tus datos de Supabase:

```bash
cp .env.example .env
```

```env
VITE_SUPABASE_URL=https://TU_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=TU_ANON_KEY
```

### 3. Base de datos

En el SQL Editor de Supabase, ejecutá el archivo `supabase_schema.sql` completo.

### 4. Correr en local

```bash
npm run dev
```

### 5. Deploy en Netlify

1. Conectá el repo de GitHub en Netlify
2. Build command: `npm run build`
3. Publish directory: `dist`
4. Agregá las variables de entorno en Netlify > Site settings > Environment variables

## Módulos implementados

| Módulo | Estado |
|---|---|
| Login | ✅ |
| Dashboard | ✅ |
| Recepción > Documentos | ✅ |
| Depósito > Áreas | ✅ |
| Depósito > Tareas | ✅ |
| Depósito > Movimientos | ✅ |
| Depósito > Ajustes | ✅ |
| Preparación > Preparaciones | ✅ con modal detalle completo |
| Preparación > Pedidos | ✅ con modal detalle completo |
| Despacho > Despachos | ✅ con modal + barras capacidad |
| Configuración > Artículos | ✅ CRUD |
| Configuración > Clientes | ✅ CRUD |
| Configuración > Proveedores | ✅ CRUD |
| Resto de módulos | 🚧 En construcción |

## Estructura del proyecto

```
src/
├── components/
│   ├── layout/      # Layout principal con navbar
│   └── ui/          # Componentes reutilizables (Button, Card, Table, Modal, etc.)
├── context/         # AuthContext
├── hooks/           # Custom hooks
├── lib/             # Supabase client
├── pages/           # Páginas por módulo
│   ├── recepcion/
│   ├── deposito/
│   ├── preparacion/
│   ├── despacho/
│   └── configuracion/
└── types/           # TypeScript types
```
