import { and, asc, desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { animalMedia, animals, geneticData, pedigreeMembers } from "../../../db/schema";
import { mediaBucket } from "../../../lib/storage";
import { requireApiUser } from "../../api-auth";
import { resolveAnimalPrimaryImage } from "../../../lib/animal-image";

const cabinId = 1;

function message(error: unknown) {
  const text = error instanceof Error ? error.message : "Error inesperado";
  let current: unknown = error;
  let code = "UNKNOWN";
  for (let depth = 0; depth < 4 && current && typeof current === "object"; depth++) {
    if ("code" in current && current.code) { code = String(current.code); break; }
    current = "cause" in current ? current.cause : null;
  }
  console.error("Database query failed", { code });
  if (text.includes("no such table")) return "La base de datos todavía no fue inicializada.";
  if (text.includes("UNIQUE constraint failed")) return "Ya existe un animal con ese RP.";
  return `${text}\nCódigo de conexión: ${code}`;
}

class InputError extends Error {}

function optionalExternalUrl(value: unknown) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error();
    return url.toString();
  } catch {
    throw new InputError("El enlace del centro de genética no es válido.");
  }
}

function writeError(error: unknown) {
  if (error instanceof InputError) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ error: message(error) }, { status: 500 });
}

function clean(payload: Record<string, unknown>) {
  const value = (key: string) => typeof payload[key] === "string" ? payload[key].trim() : "";
  const editorial = (key: string, fallback: string) => key in payload ? String(payload[key] ?? "").trim() : fallback;
  return {
    name: value("name"),
    type: value("type") || "Toro padre",
    rp: value("rp"),
    breed: value("breed") || "Hereford",
    birthDate: value("birthDate") || null,
    coat: value("coat") || null,
    registration: value("registration") || null,
    description: value("description") || null,
    geneticsProviderName: value("geneticsProviderName") || null,
    geneticsProviderUrl: optionalExternalUrl(payload.geneticsProviderUrl),
    catalogSection: payload.catalogSection === "criollos" ? "criollos" as const : "genetics" as const,
    introTitle: editorial("introTitle", "Potencia, estructura"),
    introEmphasis: editorial("introEmphasis", "y corrección."),
    introSecondary: editorial("introSecondary", "Su pedigree reúne líneas probadas de nuestro programa genético con referentes internacionales de la raza."),
    pedigreeTitle: editorial("pedigreeTitle", "Pedigree de"),
    pedigreeEmphasis: editorial("pedigreeEmphasis", "tres generaciones."),
    pedigreeDescription: editorial("pedigreeDescription", "Una genealogía sólida, construida sobre padres y madres que marcaron nuestro rodeo."),
    status: payload.status === "published" ? "published" as const : "draft" as const,
    featured: Boolean(payload.featured),
    sold: Boolean(payload.sold),
    image: value("image") || "/tupambae-animal-placeholder.svg",
    birthWeight: value("birthWeight") || null,
    weaningWeight: value("weaningWeight") || null,
    scrotalCircumference: value("scrotalCircumference") || null,
    frame: value("frame") || null,
    rpLabel: editorial("rpLabel", "RP"),
    birthDateLabel: editorial("birthDateLabel", "Nacimiento"),
    coatLabel: editorial("coatLabel", "Pelaje"),
    registrationLabel: editorial("registrationLabel", "HBU"),
    birthWeightLabel: editorial("birthWeightLabel", payload.catalogSection === "criollos" ? "Sexo" : "Peso al nacer"),
    weaningWeightLabel: editorial("weaningWeightLabel", payload.catalogSection === "criollos" ? "Categoría" : "Peso al destete"),
    scrotalCircumferenceLabel: editorial("scrotalCircumferenceLabel", payload.catalogSection === "criollos" ? "Marcha" : "Circ. escrotal"),
    frameLabel: editorial("frameLabel", payload.catalogSection === "criollos" ? "Estado" : "Frame"),
    updatedAt: new Date().toISOString(),
  };
}

function details(payload: Record<string, unknown>) {
  const pedigree = Array.isArray(payload.pedigree) ? payload.pedigree.flatMap((item, sortOrder) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const relation = typeof row.relation === "string" ? row.relation.trim() : "";
    const name = typeof row.name === "string" ? row.name.trim() : "";
    if (!relation || !name) return [];
    return [{ relation, name, registration: typeof row.registration === "string" ? row.registration.trim() || null : null, sortOrder }];
  }) : [];
  const deps = Array.isArray(payload.deps) ? payload.deps.flatMap((item, sortOrder) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const label = typeof row.label === "string" ? row.label.trim() : "";
    const value = typeof row.value === "string" ? row.value.trim() : "";
    if (!label || !value) return [];
    return [{ label, value, precision: typeof row.precision === "string" ? row.precision.trim() || null : null, percentile: typeof row.percentile === "string" ? row.percentile.trim() || null : null, sortOrder }];
  }) : [];
  return { pedigree, deps };
}

async function replaceDetails(db: ReturnType<typeof getDb>, animalId: number, payload: Record<string, unknown>) {
  const { pedigree, deps } = details(payload);
  await db.delete(pedigreeMembers).where(eq(pedigreeMembers.animalId, animalId));
  await db.delete(geneticData).where(eq(geneticData.animalId, animalId));
  if (pedigree.length) await db.insert(pedigreeMembers).values(pedigree.map(row => ({ animalId, ...row })));
  if (deps.length) await db.insert(geneticData).values(deps.map(row => ({ animalId, ...row })));
  return { pedigree, deps };
}

async function addDetails(db: ReturnType<typeof getDb>, rows: Array<typeof animals.$inferSelect>) {
  const pedigree = await db.select().from(pedigreeMembers).orderBy(asc(pedigreeMembers.sortOrder));
  const deps = await db.select().from(geneticData).orderBy(asc(geneticData.sortOrder));
  const media = await db.select().from(animalMedia).orderBy(asc(animalMedia.sortOrder));
  return rows.map(animal => {
    const animalMediaRows = media.filter(row => row.animalId === animal.id).map(row => ({
      ...row,
      url: row.storageKey ? `/api/media?key=${encodeURIComponent(row.storageKey)}` : row.externalUrl,
    }));
    return {
      ...animal,
      image: resolveAnimalPrimaryImage(animal.image, animalMediaRows),
      pedigree: pedigree.filter(row => row.animalId === animal.id),
      deps: deps.filter(row => row.animalId === animal.id),
      media: animalMediaRows,
    };
  });
}

async function hasFeaturedSlot(db: ReturnType<typeof getDb>, catalogSection: "genetics" | "criollos", currentId?: number) {
  const rows = await db.select({ id: animals.id }).from(animals).where(and(eq(animals.cabinId, cabinId), eq(animals.catalogSection, catalogSection), eq(animals.featured, true)));
  return rows.filter((row) => row.id !== currentId).length < 2;
}

export async function GET(request:Request) {
  try {
    const all=new URL(request.url).searchParams.get("all")==="1";
    if(all){const unauthorized=await requireApiUser();if(unauthorized)return unauthorized}
    const db = getDb();
    const rows = await db.select().from(animals).where(all?eq(animals.cabinId,cabinId):and(eq(animals.cabinId,cabinId),eq(animals.status,"published"))).orderBy(desc(animals.featured), desc(animals.updatedAt));
    return Response.json({ animals: await addDetails(db, rows) });
  } catch (error) {
    return writeError(error);
  }
}

export async function POST(request: Request) {
  const unauthorized = await requireApiUser();
  if (unauthorized) return unauthorized;
  try {
    const body = await request.json() as Record<string, unknown>;
    const payload = clean(body);
    if (!payload.name || !payload.rp) return Response.json({ error: "Nombre y RP son obligatorios." }, { status: 400 });
    const db = getDb();
    if (payload.featured && !await hasFeaturedSlot(db, payload.catalogSection)) return Response.json({ error: "Solo podés destacar dos animales por catálogo. Solo podés mostrar dos animales en Inicio por catálogo." }, { status: 409 });
    const [animal] = await db.insert(animals).values({ cabinId, ...payload }).returning();
    await replaceDetails(db, animal.id, body);
    const [enriched] = await addDetails(db, [animal]);
    return Response.json({ animal: enriched }, { status: 201 });
  } catch (error) {
    return writeError(error);
  }
}

export async function PATCH(request: Request) {
  const unauthorized = await requireApiUser();
  if (unauthorized) return unauthorized;
  try {
    const body = await request.json() as Record<string, unknown>;
    const id = Number(body.id);
    const payload = clean(body);
    if (!id || !payload.name || !payload.rp) return Response.json({ error: "Ficha inválida." }, { status: 400 });
    const db = getDb();
    if (payload.featured && !await hasFeaturedSlot(db, payload.catalogSection, id)) return Response.json({ error: "Solo podés destacar dos animales por catálogo. Solo podés mostrar dos animales en Inicio por catálogo." }, { status: 409 });
    const [animal] = await db.update(animals).set(payload).where(eq(animals.id, id)).returning();
    if (!animal) return Response.json({ error: "Animal no encontrado." }, { status: 404 });
    await replaceDetails(db, id, body);
    const [enriched] = await addDetails(db, [animal]);
    return Response.json({ animal: enriched });
  } catch (error) {
    return writeError(error);
  }
}

export async function DELETE(request: Request) {
  const unauthorized = await requireApiUser();
  if (unauthorized) return unauthorized;
  try {
    const id = Number(new URL(request.url).searchParams.get("id"));
    if (!id) return Response.json({ error: "ID inválido." }, { status: 400 });
    const db = getDb();
    const [animal] = await db.select().from(animals).where(and(eq(animals.id, id), eq(animals.cabinId, cabinId))).limit(1);
    if (!animal) return Response.json({ error: "Animal no encontrado." }, { status: 404 });
    const media = await db.select({ storageKey: animalMedia.storageKey }).from(animalMedia).where(eq(animalMedia.animalId, id));
    const storageKeys = [...new Set(media.flatMap((item) => item.storageKey ? [item.storageKey] : []))];
    for (const storageKey of storageKeys) await mediaBucket().delete(storageKey);
    await db.delete(animals).where(and(eq(animals.id, id), eq(animals.cabinId, cabinId)));
    return Response.json({ deleted: id });
  } catch (error) {
    return Response.json({ error: message(error) }, { status: 500 });
  }
}
