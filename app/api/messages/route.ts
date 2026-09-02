import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { contactMessages } from "../../../db/schema";
import { requireApiUser } from "../../api-auth";

const cabinId = 1;

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "No se pudo procesar la consulta.";
}

export async function GET() {
  const unauthorized = await requireApiUser();
  if (unauthorized) return unauthorized;
  try {
    const messages = await getDb().select().from(contactMessages).where(eq(contactMessages.cabinId, cabinId)).orderBy(desc(contactMessages.createdAt));
    return Response.json({ messages });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const value = (key: string) => typeof body[key] === "string" ? body[key].trim() : "";
    const payload = { name: value("name"), email: value("email"), phone: value("phone") || null, subject: value("subject") || null, message: value("message") };
    if (!payload.name || !payload.email || !payload.message) return Response.json({ error: "Nombre, email y mensaje son obligatorios." }, { status: 400 });
    if (!/^\S+@\S+\.\S+$/.test(payload.email)) return Response.json({ error: "Ingresá un email válido." }, { status: 400 });
    const [message] = await getDb().insert(contactMessages).values({ cabinId, ...payload }).returning();
    return Response.json({ message }, { status: 201 });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const unauthorized = await requireApiUser();
  if (unauthorized) return unauthorized;
  try {
    const body = await request.json() as { id?: number; isRead?: boolean };
    const id = Number(body.id);
    if (!id) return Response.json({ error: "Consulta inválida." }, { status: 400 });
    const [message] = await getDb().update(contactMessages).set({ isRead: body.isRead !== false }).where(eq(contactMessages.id, id)).returning();
    if (!message) return Response.json({ error: "Consulta no encontrada." }, { status: 404 });
    return Response.json({ message });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const unauthorized = await requireApiUser();
  if (unauthorized) return unauthorized;
  try {
    const id = Number(new URL(request.url).searchParams.get("id"));
    if (!id) return Response.json({ error: "Consulta inválida." }, { status: 400 });
    const [message] = await getDb().delete(contactMessages).where(eq(contactMessages.id, id)).returning();
    if (!message) return Response.json({ error: "Consulta no encontrada." }, { status: 404 });
    return Response.json({ deleted: id });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}
