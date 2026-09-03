import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("uses Next.js, Supabase and Netlify in the commercial edition", async () => {
  const [pkg, config, env] = await Promise.all([
    read("package.json"), read("netlify.toml"), read(".env.example"),
  ]);
  assert.match(pkg, /"next": "16\.3\.3"/);
  assert.match(pkg, /"@supabase\/ssr"/);
  assert.match(config, /publish = "\.next"/);
  assert.match(env, /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
  assert.doesNotMatch(pkg, /vinext|wrangler|sites-vite-plugin/);
});

test("protects the individual admin with Supabase membership", async () => {
  const [adminPage, auth, apiAuth] = await Promise.all([
    read("app/admin/page.tsx"), read("app/auth.ts"), read("app/api-auth.ts"),
  ]);
  assert.match(adminPage, /requireAdminUser/);
  assert.match(auth, /userRoles/);
  assert.match(apiAuth, /getAdminUser/);
  assert.doesNotMatch(adminPage + auth + apiAuth, /ChatGPTUser|signin-with-chatgpt/);
});

test("includes PostgreSQL RLS and protected media storage", async () => {
  const sql = await read("drizzle-postgres/0001_security_and_storage.sql");
  assert.match(sql, /enable row level security/g);
  assert.match(sql, /private\.is_cabin_admin/);
  assert.match(sql, /insert into storage\.buckets/);
  assert.match(sql, /grant usage on schema public to anon, authenticated/);
});

test("supports curated home animals and uploaded PDF documents", async () => {
  const [page, animalsApi, newsApi, migration, storageMigration] = await Promise.all([
    read("app/page.tsx"),
    read("app/api/animals/route.ts"),
    read("app/api/news/route.ts"),
    read("drizzle-postgres/0005_news_documents.sql"),
    read("drizzle-postgres/0006_allow_pdf_documents_in_media_bucket.sql"),
  ]);
  assert.match(page, /homeAnimals=.*slice\(0,2\)/);
  assert.match(page, /Mostrar en Inicio/);
  assert.match(animalsApi, /Solo podés mostrar dos animales en Inicio/);
  assert.match(page, /Documento PDF opcional/);
  assert.match(newsApi, /news\/documents/);
  assert.match(migration, /document_storage_key/);
  assert.match(storageMigration, /application\/pdf/);
  assert.match(storageMigration, /25165824/);
});

test("removes animal media from storage when deleting an animal", async () => {
  const animalsApi = await read("app/api/animals/route.ts");
  assert.match(animalsApi, /mediaBucket\(\)\.delete\(storageKey\)/);
  assert.match(animalsApi, /animalMedia\.animalId/);
  assert.match(animalsApi, /eq\(animals\.cabinId, cabinId\)/);
});

test("supports manual ordering of news articles", async () => {
  const [page, newsApi, schema, migration] = await Promise.all([
    read("app/page.tsx"),
    read("app/api/news/route.ts"),
    read("db/schema.ts"),
    read("drizzle-postgres/0007_news_manual_order.sql"),
  ]);
  assert.match(page, /movePost/);
  assert.match(page, /Subir \$\{post\.title\}/);
  assert.match(newsApi, /action==="reorder"/);
  assert.match(newsApi, /asc\(newsPosts\.sortOrder\)/);
  assert.match(schema, /sortOrder: integer\("sort_order"\)/);
  assert.match(migration, /row_number\(\) over/);
});

test("supports editable compact gallery heading", async () => {
  const [page, content, styles] = await Promise.all([
    read("app/page.tsx"),
    read("lib/template-content.ts"),
    read("app/globals.css"),
  ]);
  assert.match(page, /gallery_eyebrow/);
  assert.match(page, /gallery_title_line_1/);
  assert.match(page, /Portada de Galería/);
  assert.match(content, /gallery_title_line_2:"de la cabaña\."/);
  assert.match(styles, /\.galleryTitle\{grid-template-columns:1fr;gap:22px/);
});

test("ships as an isolated neutral client template", async () => {
  const [pkg, page, content, migration, layout, generator] = await Promise.all([
    read("package.json"),
    read("app/page.tsx"),
    read("lib/template-content.ts"),
    read("drizzle-postgres/0001_security_and_storage.sql"),
    read("app/layout.tsx"),
    read("scripts/prepare-client.mjs"),
  ]);
  assert.match(pkg, /"name": "cabanas-premium-template"/);
  assert.match(page, /templateContent/);
  assert.match(content, /brand_name:"Nombre de la cabaña"/);
  assert.doesNotMatch(content + migration + layout + generator, /Curupy del Salvador|curupy\.com/i);
  assert.doesNotMatch(migration, /insert into public\.cabins/i);
  assert.match(layout, /getPublicIdentity/);
  assert.match(generator, /Sitio independiente: repositorio, Supabase, Netlify, dominio y \/admin propios/);
});

test("renders the neutral public preview before Supabase is configured", async () => {
  const page = await read("app/page.tsx");
  assert.match(page, /const backendConfigured=Boolean\(process\.env\.NEXT_PUBLIC_SUPABASE_URL&&process\.env\.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY\)/);
  assert.match(page, /if\(!backendConfigured&&initialScreen!=="admin"\)/);
  assert.match(page, /setInitialDataLoaded\(true\)/);
});

test("keeps master-panel data outside individual cabin databases", async () => {
  const [schema, migration] = await Promise.all([
    read("db/schema.ts"),
    read("drizzle-postgres/0008_remove_master_panel_table.sql"),
  ]);
  assert.doesNotMatch(schema, /clientSites|client_sites/);
  assert.match(migration, /drop table if exists public\.client_sites/);
});

test("does not show an empty auction before auction data loads", async () => {
  const [page, styles] = await Promise.all([
    read("app/page.tsx"),
    read("app/globals.css"),
  ]);
  assert.match(page, /const \[auctionsLoaded,setAuctionsLoaded\]=useState\(false\)/);
  assert.match(page, /finally\(\(\)=>setAuctionsLoaded\(true\)\)/);
  assert.match(page, /if\(!loaded\)return .*auctionPageLoading/);
  assert.match(page, /<AuctionPage go=\{go\} loaded=\{auctionsLoaded\}\/>/);
  assert.match(styles, /\.auctionPageLoading\{/);
});

test("keeps contact conversion actions prominent", async () => {
  const [page, styles] = await Promise.all([
    read("app/page.tsx"),
    read("app/editor.css"),
  ]);
  assert.match(page, /className="contactWhatsapp"/);
  assert.match(page, /Contactar por WhatsApp/);
  assert.match(styles, /\.contactDirect \.contactWhatsapp/);
  assert.match(styles, /padding: 78px 5vw 68px/);
});

test("never renders demo animals while public data loads", async () => {
  const [page, styles] = await Promise.all([
    read("app/page.tsx"),
    read("app/globals.css"),
  ]);
  assert.doesNotMatch(page, /const seedAnimals/);
  assert.doesNotMatch(page, /const seedAuctions/);
  assert.match(page, /useState<AnimalRecord\[\]>\(\[\]\)/);
  assert.match(page, /criticalDataFailed/);
  assert.match(page, /<PublicLoading failed=\{criticalDataFailed\}\/>/);
  assert.match(styles, /\.publicLoading\{/);
});

test("unblocks the public site before secondary collections finish loading", async () => {
  const [page, contentApi, imagesApi] = await Promise.all([
    read("app/page.tsx"),
    read("app/api/site-content/route.ts"),
    read("app/api/site-images/route.ts"),
  ]);
  assert.match(page, /const readyRequests=initialScreen==="admin"/);
  assert.match(page, /:\[imageRequest,contentRequest\]/);
  assert.match(contentApi, /stale-while-revalidate=120/);
  assert.match(imagesApi, /stale-while-revalidate=120/);
});

test("uses a text-safe compact genetics call to action on mobile", async () => {
  const [page, styles] = await Promise.all([
    read("app/page.tsx"),
    read("app/globals.css"),
  ]);
  assert.doesNotMatch(page, /<b>↘<\/b>/);
  assert.match(page, /<b aria-hidden="true"\/>/);
  assert.match(styles, /avoids emoji rendering on iOS/);
  assert.match(styles, /\.roundLink span br\{display:none\}/);
});

test("supports whole-page and section-by-section visibility", async () => {
  const [page, content] = await Promise.all([
    read("app/page.tsx"),
    read("lib/template-content.ts"),
  ]);
  assert.match(content, /show_cabana:"true"/);
  assert.match(content, /show_genetics:"true"/);
  assert.match(page, /pageVisibilityKeys/);
  assert.match(page, /key:"show_genetics_results",label:"Resultados productivos"/);
  assert.match(page, /isVisible\(content,"show_genetics_results"\)/);
  assert.match(page, /window\.location\.replace\("\/"\)/);
});

test("links the compact home genetics preview directly to the catalog", async () => {
  const [page, styles] = await Promise.all([
    read("app/page.tsx"),
    read("app/globals.css"),
  ]);
  assert.match(page, /window\.location\.assign\("\/genetica#catalogo-animales"\)/);
  assert.match(page, /window\.location\.hash!=="#catalogo-animales"/);
  assert.match(styles, /\.intro \+ \.geneticsPreview\{padding-top:55px\}/);
  assert.match(styles, /#catalogo-animales\{scroll-margin-top:90px\}/);
});

test("offers persistent public color palette presets", async () => {
  const [page, content, styles] = await Promise.all([
    read("app/page.tsx"),
    read("lib/template-content.ts"),
    read("app/globals.css"),
  ]);
  assert.match(content, /color_palette:"tierra"/);
  assert.match(page, /title:"Paleta de colores"/);
  assert.match(page, /document\.body\.dataset\.palette=content\.color_palette/);
  assert.match(styles, /body\[data-palette="monte"\]/);
  assert.match(styles, /body\[data-palette="pampa"\]/);
  assert.match(styles, /body\[data-palette="vino"\]/);
});
