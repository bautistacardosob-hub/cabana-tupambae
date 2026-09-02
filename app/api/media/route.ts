import { and, asc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { animalMedia, animals } from "../../../db/schema";
import { requireApiUser } from "../../api-auth";
import { mediaBucket } from "../../../lib/storage";

const allowedImages = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const maxImageBytes = 12 * 1024 * 1024;
const cabinId = Number(process.env.NEXT_PUBLIC_CABIN_ID || 1);

const bucket = mediaBucket;

function publicRecord(row: typeof animalMedia.$inferSelect) {
  return {
    ...row,
    url: row.storageKey ? `/api/media?key=${encodeURIComponent(row.storageKey)}` : row.externalUrl,
  };
}

export async function GET(request: Request) {
  try {
    const key = new URL(request.url).searchParams.get("key");
    if (!key) return Response.json({ error: "Archivo inválido." }, { status: 400 });
    return Response.redirect(bucket().publicUrl(key), 307);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "No se pudo leer el archivo." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const unauthorized = await requireApiUser();
  if (unauthorized) return unauthorized;
  try {
    const contentType = request.headers.get("content-type") || "";
    const db = getDb();

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const animalId = Number(form.get("animalId"));
      const file = form.get("file");
      if (!animalId || !(file instanceof File)) return Response.json({ error: "Seleccioná una fotografía válida." }, { status: 400 });
      if (!allowedImages.has(file.type)) return Response.json({ error: "Usá una imagen JPG, PNG, WebP o GIF." }, { status: 400 });
      if (file.size > maxImageBytes) return Response.json({ error: "La imagen no puede superar los 12 MB." }, { status: 400 });
      const [animal] = await db.select({ id: animals.id }).from(animals).where(eq(animals.id, animalId));
      if (!animal) return Response.json({ error: "Animal no encontrado." }, { status: 404 });
      const safeName = file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").slice(-80) || "foto.jpg";
      const storageKey = `animals/${animalId}/${crypto.randomUUID()}-${safeName}`;
      await bucket().put(storageKey, file, file.type);
      const existing = await db.select({ id: animalMedia.id }).from(animalMedia).where(eq(animalMedia.animalId, animalId));
      const [row] = await db.insert(animalMedia).values({ animalId, kind: "image", storageKey, filename: file.name, contentType: file.type, sortOrder: existing.length }).returning();
      return Response.json({ media: publicRecord(row) }, { status: 201 });
    }

    const body = await request.json() as { action?: string; animalId?: number; videoUrl?: string; filename?: string; contentType?: string; storageKey?: string; size?: number };
    const animalId = Number(body.animalId);
    if (body.action === "prepare-image") {
      const filename = String(body.filename || "").trim();
      const imageType = String(body.contentType || "").trim();
      const size = Number(body.size);
      if (!animalId || !filename) return Response.json({ error: "Seleccioná una fotografía válida." }, { status: 400 });
      if (!allowedImages.has(imageType)) return Response.json({ error: "Usá una imagen JPG, PNG, WebP o GIF." }, { status: 400 });
      if (!Number.isFinite(size) || size <= 0 || size > maxImageBytes) return Response.json({ error: "La imagen no puede superar los 12 MB." }, { status: 400 });
      const [animal] = await db.select({ id: animals.id }).from(animals).where(and(eq(animals.id, animalId), eq(animals.cabinId, cabinId)));
      if (!animal) return Response.json({ error: "Animal no encontrado." }, { status: 404 });
      const safeName = filename.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").slice(-80) || "foto.jpg";
      const storageKey = `animals/${animalId}/${crypto.randomUUID()}-${safeName}`;
      const signed = await bucket().createSignedUpload(storageKey);
      return Response.json({ upload: { path: signed.path, token: signed.token } });
    }
    if (body.action === "complete-image") {
      const filename = String(body.filename || "").trim();
      const imageType = String(body.contentType || "").trim();
      const storageKey = String(body.storageKey || "").trim();
      if (!animalId || !filename || !allowedImages.has(imageType) || !storageKey.startsWith(`animals/${animalId}/`)) {
        return Response.json({ error: "Los datos de la fotografía no son válidos." }, { status: 400 });
      }
      const [animal] = await db.select({ id: animals.id }).from(animals).where(and(eq(animals.id, animalId), eq(animals.cabinId, cabinId)));
      if (!animal) return Response.json({ error: "Animal no encontrado." }, { status: 404 });
      if (!await bucket().exists(storageKey)) return Response.json({ error: "La fotografía no terminó de subirse." }, { status: 409 });
      const [recorded] = await db.select().from(animalMedia).where(eq(animalMedia.storageKey, storageKey)).limit(1);
      if (recorded) return Response.json({ media: publicRecord(recorded) });
      const existing = await db.select({ id: animalMedia.id }).from(animalMedia).where(eq(animalMedia.animalId, animalId));
      const [row] = await db.insert(animalMedia).values({ animalId, kind: "image", storageKey, filename, contentType: imageType, sortOrder: existing.length }).returning();
      return Response.json({ media: publicRecord(row) }, { status: 201 });
    }
    const videoUrl = String(body.videoUrl || "").trim();
    if (!animalId || !/^https?:\/\//i.test(videoUrl)) return Response.json({ error: "Ingresá un enlace de video válido." }, { status: 400 });
    const existing = await db.select({ id: animalMedia.id }).from(animalMedia).where(eq(animalMedia.animalId, animalId)).orderBy(asc(animalMedia.sortOrder));
    const [row] = await db.insert(animalMedia).values({ animalId, kind: "video", externalUrl: videoUrl, sortOrder: existing.length }).returning();
    return Response.json({ media: publicRecord(row) }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "No se pudo guardar el archivo." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const unauthorized = await requireApiUser();
  if (unauthorized) return unauthorized;
  try {
    const id = Number(new URL(request.url).searchParams.get("id"));
    if (!id) return Response.json({ error: "Archivo inválido." }, { status: 400 });
    const db = getDb();
    const [row] = await db.select().from(animalMedia).where(eq(animalMedia.id, id));
    if (!row) return Response.json({ error: "Archivo no encontrado." }, { status: 404 });
    if (row.storageKey) await bucket().delete(row.storageKey);
    await db.delete(animalMedia).where(eq(animalMedia.id, id));
    return Response.json({ deleted: id });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "No se pudo eliminar el archivo." }, { status: 500 });
  }
}
