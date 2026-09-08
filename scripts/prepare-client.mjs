#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

function parseArgs(argv) {
  const values = {};
  for (let i = 0; i < argv.length; i += 2) {
    const token = argv[i];
    const value = argv[i + 1];
    if (!token?.startsWith("--") || !value || value.startsWith("--")) {
      throw new Error(`Argumento incompleto cerca de ${token ?? "el final"}.`);
    }
    values[token.slice(2)] = value;
  }
  return values;
}

function sqlLiteral(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

const args = parseArgs(process.argv.slice(2));
const missing = ["name", "slug", "owner-email"].filter((key) => !args[key]);
if (missing.length) {
  console.error(`Faltan: ${missing.map((key) => `--${key}`).join(", ")}`);
  console.error('Uso: npm run client:prepare -- --name "Cabaña Ejemplo" --slug cabana-ejemplo --owner-email cliente@ejemplo.com');
  process.exit(1);
}
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(args.slug)) throw new Error("El slug sólo admite minúsculas, números y guiones simples.");
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(args["owner-email"])) throw new Error("El correo no es válido.");

const primaryColor = args["primary-color"] ?? "#6c422b";
if (!/^#[0-9a-fA-F]{6}$/.test(primaryColor)) throw new Error("El color debe tener formato #6c422b.");

const outputDirectory = resolve(args.output ?? "client-setups", args.slug);
await mkdir(outputDirectory, { recursive: true });

const metadata = {
  name: args.name,
  slug: args.slug,
  ownerEmail: args["owner-email"],
  supportEmail: args["support-email"] ?? "",
  domain: args.domain ?? "",
  primaryColor,
  generatedAt: new Date().toISOString(),
};
const environment = `# Netlify > Site configuration > Environment variables
# Reemplazar los marcadores. Nunca guardar secretos en Git.
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_REPLACE_ME
SUPABASE_SECRET_KEY=sb_secret_REPLACE_ME
DATABASE_URL=postgresql://postgres.YOUR_PROJECT:REPLACE_ME@YOUR_POOLER_HOST:6543/postgres
NEXT_PUBLIC_CABIN_ID=1
NEXT_PUBLIC_SITE_URL=${args.domain ? `https://${args.domain}` : "https://YOUR_SITE.netlify.app"}
`;
const supportAccess = args["support-email"] ? `
-- Crear también ${args["support-email"]} en Authentication > Users.
-- Este usuario técnico tendrá su propia contraseña y no conocerá la del cliente:
-- insert into public.user_roles (user_id, cabin_id, role)
-- values ('SUPPORT_AUTH_USER_UUID', 1, 'editor')
-- on conflict (user_id, cabin_id) do update set role = excluded.role;
` : `
-- Acceso técnico opcional: crear otro usuario en Authentication > Users y asignarlo
-- como editor con su propio UUID. Nunca compartir la contraseña del propietario.
-- insert into public.user_roles (user_id, cabin_id, role)
-- values ('SUPPORT_AUTH_USER_UUID', 1, 'editor')
-- on conflict (user_id, cabin_id) do update set role = excluded.role;
`;
const seed = `-- Ejecutar después de todas las migraciones de drizzle-postgres/.
insert into public.cabins (id, slug, name)
values (1, ${sqlLiteral(args.slug)}, ${sqlLiteral(args.name)})
on conflict (id) do update set slug = excluded.slug, name = excluded.name;
select setval(pg_get_serial_sequence('public.cabins', 'id'), greatest((select max(id) from public.cabins), 1));

-- Crear ${args["owner-email"]} en Authentication > Users y copiar su UUID:
-- insert into public.user_roles (user_id, cabin_id, role)
-- values ('OWNER_AUTH_USER_UUID', 1, 'owner')
-- on conflict (user_id, cabin_id) do update set role = excluded.role;
${supportAccess}
`;
const checklist = `# Alta de ${args.name}

Sitio independiente: repositorio, Supabase, Netlify, dominio y /admin propios.

1. Crear repositorio nuevo desde la plantilla y conectarlo a Netlify.
2. Crear un proyecto Supabase exclusivo.
3. Ejecutar en orden drizzle-postgres/*.sql y luego seed.sql.
4. Crear el propietario y, si corresponde, el administrador técnico indicados en seed.sql. Cada uno debe usar su propia contraseña.
5. Completar netlify.env.example en Netlify y volver a desplegar.
6. Verificar /, /admin, login, imágenes, publicación y contacto.
7. Asociar el dominio y actualizar NEXT_PUBLIC_SITE_URL.
8. Registrar la web y https://dominio/admin en el panel maestro.

No compartir DATABASE_URL ni SUPABASE_SECRET_KEY entre clientes.
`;

await Promise.all([
  writeFile(resolve(outputDirectory, "client.json"), `${JSON.stringify(metadata, null, 2)}\n`, { flag: "wx" }),
  writeFile(resolve(outputDirectory, "netlify.env.example"), environment, { flag: "wx" }),
  writeFile(resolve(outputDirectory, "seed.sql"), seed, { flag: "wx" }),
  writeFile(resolve(outputDirectory, "CHECKLIST.md"), checklist, { flag: "wx" }),
]);
console.log(`Alta preparada en ${outputDirectory}`);
