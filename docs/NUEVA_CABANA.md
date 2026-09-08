# Proceso para crear una nueva cabaña

## Arquitectura elegida

Cada cliente se entrega como una web independiente: repositorio y Netlify,
proyecto Supabase, dominio, datos, usuarios e imágenes propios. Su administrador
vive en `https://dominio/admin`.

El panel maestro es un directorio operativo que abre el `/admin` de cada cliente;
no comparte la base de datos ni reemplaza el administrador individual.

## Preparar el alta

```bash
npm run client:prepare -- \
  --name "Cabaña Ejemplo" \
  --slug cabana-ejemplo \
  --owner-email cliente@ejemplo.com \
  --support-email administrador@ejemplo.com \
  --domain www.cabanaejemplo.com \
  --primary-color "#6c422b"
```

Se crea `client-setups/cabana-ejemplo/` con la ficha del cliente, variables de
Netlify sin secretos reales, SQL inicial y checklist de entrega. La carpeta está
ignorada por Git porque contiene datos operativos.

## Alta técnica

1. Crear un repositorio nuevo a partir de la plantilla.
2. Crear un proyecto Supabase nuevo.
3. Ejecutar en orden todos los archivos de `drizzle-postgres/`.
4. Ejecutar el `seed.sql` generado.
5. Crear el propietario y el administrador técnico en Supabase Authentication, y asignar sus UUID en `public.user_roles`. El propietario usa el rol `owner`; el acceso técnico usa `editor`. Cada persona conserva su propia contraseña.
6. Crear el sitio Netlify desde el nuevo repositorio.
7. Completar en Netlify las variables de `netlify.env.example` y redesplegar.
8. Vincular el dominio y actualizar `NEXT_PUBLIC_SITE_URL`.
9. Registrar la web y su `/admin` en el panel maestro.

## Control antes de entregar

- Todo el contenido pertenece al cliente; no quedan datos demostrativos.
- Las secciones opcionales no aparecen si están vacías.
- El próximo remate sólo aparece publicado y vigente.
- Imágenes, videos, borradores y publicación funcionan en escritorio y móvil.
- El cliente sólo accede a su propio proyecto y `/admin`.
- Contacto, WhatsApp, Instagram, mapa y dominio funcionan.
- Las credenciales se guardan de forma segura, nunca en Git.
