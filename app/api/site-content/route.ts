import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { siteContent } from "../../../db/schema";
import { requireApiUser } from "../../api-auth";
import { templateContent } from "../../../lib/template-content";

const cabinId = 1;

export async function GET(request:Request) {
  try {
    const draft=new URL(request.url).searchParams.get("draft")==="1";
    if(draft){const unauthorized=await requireApiUser();if(unauthorized)return unauthorized}
    const rows = await getDb().select().from(siteContent).where(eq(siteContent.cabinId, cabinId));
    return Response.json(
      { content: Object.fromEntries(rows.map(row => [row.contentKey, draft?(row.draftValue??row.value):row.value])), hasDraft:rows.some(row=>row.draftValue!==null) },
      {headers:{"Cache-Control":draft?"private, no-store":"public, s-maxage=15, stale-while-revalidate=120"}}
    );
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "No se pudo cargar el contenido." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const unauthorized = await requireApiUser();
  if (unauthorized) return unauthorized;
  try {
    const body = await request.json() as { values?: Record<string, unknown> };
    const entries = Object.entries(body.values || {}).flatMap(([contentKey, value]) => {
      if (!/^[a-z0-9_]+$/.test(contentKey) || typeof value !== "string") return [];
      const normalized=value.trim();
      return [{ cabinId, contentKey, value:(templateContent as Record<string,string>)[contentKey]??(contentKey==="custom_pages_json"?"[]":""), draftValue:normalized, updatedAt: new Date().toISOString() }];
    });
    if (!entries.length) return Response.json({ error: "No hay contenido para guardar." }, { status: 400 });
    const db = getDb();
    for (const entry of entries) {
      await db.insert(siteContent).values(entry).onConflictDoUpdate({ target: [siteContent.cabinId, siteContent.contentKey], set: { draftValue: entry.draftValue, updatedAt: entry.updatedAt } });
    }
    return Response.json({ content: Object.fromEntries(entries.map(entry => [entry.contentKey, entry.draftValue])), hasDraft:true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "No se pudo guardar el contenido." }, { status: 500 });
  }
}
