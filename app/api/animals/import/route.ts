import readXlsxFile from "read-excel-file/node";
import { and, asc, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { animalCategories, animals, geneticData, pedigreeMembers } from "../../../../db/schema";
import { parseAnimalWorkbook, type ImportedAnimalDraft, type SpreadsheetCell } from "../../../../lib/animal-import";
import { requireApiUser } from "../../../api-auth";

export const runtime = "nodejs";

const cabinId = 1;
const maxFileBytes = 10 * 1024 * 1024;
const slugify = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function inputError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

async function parseFile(form: FormData) {
  const file = form.get("file");
  if (!(file instanceof File)) throw new Error("Seleccioná un archivo Excel.");
  if (!file.name.toLowerCase().endsWith(".xlsx")) throw new Error("El archivo debe tener formato .xlsx.");
  if (file.size > maxFileBytes) throw new Error("El Excel no puede superar los 10 MB.");
  const workbook = await readXlsxFile(Buffer.from(await file.arrayBuffer())) as unknown;
  const firstEntry = Array.isArray(workbook) ? workbook[0] : null;
  const rows = firstEntry && !Array.isArray(firstEntry) && typeof firstEntry === "object" && "data" in firstEntry
    ? (firstEntry as { data: SpreadsheetCell[][] }).data
    : workbook as SpreadsheetCell[][];
  return parseAnimalWorkbook(rows, {
    breed: String(form.get("breed") || "Aberdeen Angus"),
    defaultType: String(form.get("defaultType") || "Sin categoría"),
  });
}

function animalValues(item: ImportedAnimalDraft, catalogSection: "genetics" | "criollos", status: "draft" | "published") {
  return {
    name: item.name,
    type: item.type,
    rp: item.rp,
    breed: item.breed,
    birthDate: item.birthDate || null,
    registration: item.registration || null,
    catalogSection,
    status,
    featured: false,
    sold: false,
    image: "/animal-black.jpg",
    weaningWeight: item.weaningWeight || null,
    frame: item.frame || null,
    rpLabel: "RP",
    birthDateLabel: "Nacimiento",
    coatLabel: "Pelaje",
    registrationLabel: "HBU",
    birthWeightLabel: catalogSection === "criollos" ? "Sexo" : "Peso al nacer",
    weaningWeightLabel: item.weaningWeight ? item.weaningWeightLabel : catalogSection === "criollos" ? "Categoría" : "Peso al destete",
    scrotalCircumferenceLabel: catalogSection === "criollos" ? "Marcha" : "Circ. escrotal",
    frameLabel: item.frame ? "Lote" : catalogSection === "criollos" ? "Estado" : "Frame",
    updatedAt: new Date().toISOString(),
  };
}

type ImportTransaction = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

async function replaceImportedDetails(db: ImportTransaction, animalId: number, item: ImportedAnimalDraft) {
  await db.delete(pedigreeMembers).where(eq(pedigreeMembers.animalId, animalId));
  await db.delete(geneticData).where(eq(geneticData.animalId, animalId));
  if (item.pedigree.length) await db.insert(pedigreeMembers).values(item.pedigree.map(row => ({ animalId, ...row })));
  if (item.deps.length) await db.insert(geneticData).values(item.deps.map(row => ({ animalId, ...row })));
}

export async function POST(request: Request) {
  const unauthorized = await requireApiUser();
  if (unauthorized) return unauthorized;
  try {
    const form = await request.formData();
    const parsed = await parseFile(form);
    const db = getDb();
    const existing = await db.select({ rp: animals.rp }).from(animals).where(eq(animals.cabinId, cabinId));
    const existingRps = new Set(existing.map(item => item.rp));
    const preview = parsed.animals.map(item => ({ ...item, exists: existingRps.has(item.rp) }));
    if (form.get("action") !== "import") {
      return Response.json({
        preview,
        depLabels: parsed.depLabels,
        headerRow: parsed.sheetHeaderRow,
        validCount: preview.filter(item => !item.errors.length).length,
        duplicateCount: preview.filter(item => item.exists).length,
      });
    }

    const catalogSection = form.get("catalogSection") === "criollos" ? "criollos" as const : "genetics" as const;
    const status = form.get("status") === "published" ? "published" as const : "draft" as const;
    const mode = form.get("mode") === "update" ? "update" as const : "skip" as const;
    const valid = parsed.animals.filter(item => !item.errors.length);
    if (!valid.length) return inputError("No hay filas válidas para importar.");

    let created = 0;
    let updated = 0;
    let skipped = 0;
    await db.transaction(async transaction => {
      const current = await transaction.select().from(animals).where(eq(animals.cabinId, cabinId));
      const byRp = new Map(current.map(item => [item.rp, item]));
      for (const item of valid) {
        const existingAnimal = byRp.get(item.rp);
        if (existingAnimal && mode === "skip") {
          skipped += 1;
          continue;
        }
        if (existingAnimal) {
          await transaction.update(animals).set({
            ...animalValues(item, catalogSection, status),
            image: existingAnimal.image,
            featured: existingAnimal.featured,
            sold: existingAnimal.sold,
          }).where(and(eq(animals.id, existingAnimal.id), eq(animals.cabinId, cabinId)));
          await replaceImportedDetails(transaction, existingAnimal.id, item);
          updated += 1;
          continue;
        }
        const [createdAnimal] = await transaction.insert(animals).values({ cabinId, ...animalValues(item, catalogSection, status) }).returning();
        await replaceImportedDetails(transaction, createdAnimal.id, item);
        byRp.set(item.rp, createdAnimal);
        created += 1;
      }

      const categoryRows = await transaction.select().from(animalCategories).where(and(eq(animalCategories.cabinId, cabinId), eq(animalCategories.catalogSection, catalogSection), eq(animalCategories.kind, "category"))).orderBy(asc(animalCategories.sortOrder));
      const known = new Set(categoryRows.map(item => item.slug));
      const newCategories = [...new Set(valid.map(item => item.type).filter(Boolean))].filter(name => !known.has(slugify(name)));
      if (newCategories.length) await transaction.insert(animalCategories).values(newCategories.map((name, index) => ({ cabinId, name, slug: slugify(name), catalogSection, kind: "category" as const, active: true, sortOrder: categoryRows.length + index }))).onConflictDoNothing();
    });

    return Response.json({ imported: true, created, updated, skipped, invalid: parsed.animals.length - valid.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo leer el Excel.";
    console.error("Animal spreadsheet import failed", { message });
    return inputError(message);
  }
}
