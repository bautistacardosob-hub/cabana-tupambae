import { and, asc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { auctions } from "../../../db/schema";
import { requireApiUser } from "../../api-auth";

const cabinId = 1;

function clean(payload: Record<string, unknown>) {
  const value = (key: string) => typeof payload[key] === "string" ? payload[key].trim() : "";
  return {
    title: value("title"),
    auctionDate: value("auctionDate") || null,
    auctionTime: value("auctionTime") || null,
    auctioneer: value("auctioneer") || null,
    location: value("location") || null,
    lots: value("lots") || null,
    description: value("description") || null,
    catalogUrl: value("catalogUrl") || null,
    streamUrl: value("streamUrl") || null,
    image: value("image") || "/ranch.jpg",
    status: payload.status === "past" ? "past" as const : "upcoming" as const,
    published: payload.published !== false,
    sortOrder: Number(payload.sortOrder) || 0,
    updatedAt: new Date().toISOString(),
  };
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "No se pudo guardar el remate.";
}

export async function GET(request: Request) {
  try {
    const all = new URL(request.url).searchParams.get("all") === "1";
    if (all) { const unauthorized = await requireApiUser(); if (unauthorized) return unauthorized; }
    const rows = await getDb().select().from(auctions).where(all ? eq(auctions.cabinId, cabinId) : and(eq(auctions.cabinId, cabinId), eq(auctions.published, true))).orderBy(asc(auctions.auctionDate), asc(auctions.sortOrder));
    return Response.json({ auctions: rows });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const unauthorized = await requireApiUser();
  if (unauthorized) return unauthorized;
  try {
    const body = await request.json() as Record<string, unknown>;
    const payload = clean(body);
    if (!payload.title) return Response.json({ error: "El título es obligatorio." }, { status: 400 });
    const [auction] = await getDb().insert(auctions).values({ cabinId, ...payload }).returning();
    return Response.json({ auction }, { status: 201 });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const unauthorized = await requireApiUser();
  if (unauthorized) return unauthorized;
  try {
    const body = await request.json() as Record<string, unknown>;
    const id = Number(body.id);
    const payload = clean(body);
    if (!id || !payload.title) return Response.json({ error: "Remate inválido." }, { status: 400 });
    const [auction] = await getDb().update(auctions).set(payload).where(eq(auctions.id, id)).returning();
    if (!auction) return Response.json({ error: "Remate no encontrado." }, { status: 404 });
    return Response.json({ auction });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const unauthorized = await requireApiUser();
  if (unauthorized) return unauthorized;
  try {
    const id = Number(new URL(request.url).searchParams.get("id"));
    if (!id) return Response.json({ error: "Remate inválido." }, { status: 400 });
    const [auction] = await getDb().delete(auctions).where(eq(auctions.id, id)).returning();
    if (!auction) return Response.json({ error: "Remate no encontrado." }, { status: 404 });
    return Response.json({ deleted: id });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}
