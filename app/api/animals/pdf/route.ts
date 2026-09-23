import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb } from "../../../../db";
import { animals, geneticData, pedigreeMembers, siteContent, siteImages } from "../../../../db/schema";
import { createAnimalPdf } from "../../../../lib/animal-pdf";

export const runtime = "nodejs";
const cabinId = Number(process.env.NEXT_PUBLIC_CABIN_ID || 1);

export async function GET(request: Request) {
  const section = new URL(request.url).searchParams.get("section") === "criollos" ? "criollos" : "genetics";
  try {
    const db = getDb();
    const rows = await db.select().from(animals).where(and(eq(animals.cabinId, cabinId), eq(animals.status, "published"), eq(animals.catalogSection, section))).orderBy(asc(animals.name));
    if (!rows.length) return new Response("No hay fichas publicadas para descargar.", { status: 404 });
    const ids = rows.map(row => row.id);
    const [pedigree, deps, brand, logos] = await Promise.all([
      db.select().from(pedigreeMembers).where(inArray(pedigreeMembers.animalId, ids)).orderBy(asc(pedigreeMembers.sortOrder)),
      db.select().from(geneticData).where(inArray(geneticData.animalId, ids)).orderBy(asc(geneticData.sortOrder)),
      db.select({ value: siteContent.value }).from(siteContent).where(and(eq(siteContent.cabinId, cabinId), eq(siteContent.contentKey, "brand_name"))).limit(1),
      db.select({ storageKey: siteImages.storageKey, fallbackUrl: siteImages.fallbackUrl }).from(siteImages).where(and(eq(siteImages.cabinId, cabinId), eq(siteImages.imageKey, "brand-logo"))).limit(1),
    ]);
    const logo = logos[0]?.storageKey ? `/api/media?key=${encodeURIComponent(logos[0].storageKey)}` : logos[0]?.fallbackUrl || "/template-brand.svg";
    const bytes = await createAnimalPdf(rows.map(animal => ({ ...animal, pedigree: pedigree.filter(item => item.animalId === animal.id), deps: deps.filter(item => item.animalId === animal.id) })), brand[0]?.value || "Cabaña", logo, new URL(request.url).origin);
    return new Response(bytes, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${section === "criollos" ? "catalogo-criollos" : "catalogo-genetico"}.pdf"`, "Cache-Control": "public, max-age=60" } });
  } catch (error) {
    console.error("Could not create animal catalogue PDF", error);
    return new Response("No se pudo generar el catálogo PDF.", { status: 500 });
  }
}
