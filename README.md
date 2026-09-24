# Cabaña Tupambaé — propuesta web Hereford

Adaptación independiente de la plantilla Cabañas Premium. La propuesta usa una identidad bordó, marfil, carbón y arena, y conserva el catálogo, las fichas PDF, la comparación de animales, remates, actualidad, galería y el administrador.

## Estado

- Es una **propuesta local**, no el sitio oficial de Tupambaé.
- La marca fue aportada por el usuario. Se conserva también el archivo original con fondo bordó; la versión transparente fue preparada para usar sobre fondos claros y oscuros.
- Las tres fotografías Hereford de esta carpeta son **imágenes conceptuales generadas para la maqueta**. No representan animales, instalaciones ni trabajo real de Tupambaé. Deben reemplazarse antes de publicar una presentación definitiva.
- El número `+598 91 088 716` es un contacto provisional de la propuesta. El Instagram proporcionado es `https://www.instagram.com/cabana_tupambae/`.
- No se inventaron animales, pedigree, cifras productivas, fechas de remate ni trayectoria. El catálogo comienza vacío y las fichas nuevas usan un marcador “Fotografía pendiente”.
- Este proyecto no está conectado a GitHub, Netlify ni Supabase de Tupambaé. No comparte credenciales ni datos con Curupy o La Morada.

## Vista local

Requiere Node.js 22 o posterior. Instalación y desarrollo:

```bash
npm ci
npm run dev
```

Abrir `http://localhost:3000`. Sin variables de entorno, se muestra la propuesta visual y el contacto por WhatsApp; el administrador y las funciones de datos requieren Supabase propio.

Para verificar código:

```bash
npm test
npx tsc --noEmit --incremental false
npx next build --webpack
```

## Para convertirla en sitio real

1. Confirmar con Tupambaé que podemos usar su marca y aprobar los textos y fotografías definitivos.
2. Pedir historia, ubicación, datos de contacto oficiales, fotos del establecimiento y de reproductores, categorías, fichas genéticas, próximos remates y redes sociales.
3. Crear un repositorio GitHub, proyecto Supabase y sitio Netlify **exclusivos** para Tupambaé.
4. Ejecutar `drizzle-postgres/*.sql` en orden, incluida `0014_tupambae_defaults.sql`, y crear el propietario con el procedimiento de [docs/NUEVA_CABANA.md](docs/NUEVA_CABANA.md). No usar la base de otro cliente.
5. Configurar las variables de entorno y comprobar inicio, catálogo, PDF, contacto, carga de imágenes y publicación desde `/admin` antes de ofrecer la dirección pública.

La guía de despliegue de la plantilla sigue en [docs/NUEVA_CABANA.md](docs/NUEVA_CABANA.md). En esta instancia, sustituir los ejemplos de esa guía por los datos confirmados de Tupambaé.
