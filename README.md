# Cabañas Premium — plantilla maestra

Plantilla reutilizable para crear sitios web independientes de cabañas ganaderas.

Cada implementación debe tener recursos propios:

- un repositorio Git;
- un sitio de Netlify;
- un proyecto de Supabase;
- un dominio y un acceso `/admin` independientes.

La plantilla no comparte datos, archivos, usuarios ni credenciales entre cabañas. El diseño se mantiene controlado internamente y el cliente administra contenidos desde su propio `/admin`.

## Requisitos

- Node.js `>=22.13.0`
- una cuenta de Supabase
- una cuenta de Netlify

## Desarrollo local

```bash
npm install
cp .env.example .env.local
npm run dev
```

Para validar una modificación:

```bash
npm test
npm run build
```

## Preparar una nueva cabaña

```bash
npm run client:prepare -- \
  --name "Cabaña Ejemplo" \
  --slug cabana-ejemplo \
  --owner-email cliente@ejemplo.com \
  --support-email administrador@ejemplo.com \
  --domain ejemplo.com
```

El comando genera, dentro de `client-setups/<slug>/`, los datos iniciales, las variables de entorno de referencia y una lista de verificación. Esa carpeta contiene información operativa del alta y no debe publicarse en Git.

La guía completa está en [docs/NUEVA_CABANA.md](docs/NUEVA_CABANA.md).

## Base de datos

1. Crear un proyecto Supabase exclusivo para el cliente.
2. Ejecutar en orden los archivos de `drizzle-postgres/`.
3. Ejecutar el `seed.sql` generado para esa cabaña.
4. Crear el usuario propietario y asignar su UUID según las instrucciones del seed.

Nunca reutilizar `DATABASE_URL`, `SUPABASE_SECRET_KEY`, usuarios ni buckets entre clientes.

## Publicación

Conectar el repositorio individual de la cabaña a un sitio nuevo de Netlify, cargar las variables indicadas en `netlify.env.example` y desplegar. El proyecto no viene vinculado a ningún sitio de Netlify ni a ninguna base de datos.
