import { and, asc, eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { animals, geneticData, pedigreeMembers, siteContent, siteImages } from "../../../../../db/schema";
import { animalPdfSlug, createAnimalPdf } from "../../../../../lib/animal-pdf";

export const runtime = "nodejs";
const cabinId = Number(process.env.NEXT_PUBLIC_CABIN_ID || 1);

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id < 1) return new Response("Ficha no disponible", { status: 404 });
  try {
    const db = getDb();
    const [animal] = await db.select().from(animals).where(and(eq(animals.id, id), eq(animals.cabinId, cabinId), eq(animals.status, "published"))).limit(1);
    if (!animal) return new Response("Ficha no disponible", { status: 404 });
    const [pedigree, deps, brand, logos] = await Promise.all([
      db.select().from(pedigreeMembers).where(eq(pedigreeMembers.animalId, id)).orderBy(asc(pedigreeMembers.sortOrder)),
      db.select().from(geneticData).where(eq(geneticData.animalId, id)).orderBy(asc(geneticData.sortOrder)),
      db.select({ value: siteContent.value }).from(siteContent).where(and(eq(siteContent.cabinId, cabinId), eq(siteContent.contentKey, "brand_name"))).limit(1),
      db.select({ storageKey: siteImages.storageKey, fallbackUrl: siteImages.fallbackUrl }).from(siteImages).where(and(eq(siteImages.cabinId, cabinId), eq(siteImages.imageKey, "brand-logo"))).limit(1),
    ]);
    const logo = logos[0]?.storageKey ? `/api/media?key=${encodeURIComponent(logos[0].storageKey)}` : logos[0]?.fallbackUrl || "/template-brand.svg";
    const bytes = await createAnimalPdf([{ ...animal, pedigree, deps }], brand[0]?.value || "Cabaña", logo, new URL(request.url).origin);
    return new Response(bytes, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="ficha-${animalPdfSlug(animal.name)}-rp-${animalPdfSlug(animal.rp)}.pdf"`, "Cache-Control": "public, max-age=60" } });
  } catch (error) {
    console.error("Could not create animal PDF", error);
    return new Response("No se pudo generar la ficha PDF.", { status: 500 });
  }
}
