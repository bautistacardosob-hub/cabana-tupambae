import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { siteContent, siteImages } from "../../../db/schema";
import { publicCacheHeaders } from "../../../lib/public-cache";

const cabinId = Number(process.env.NEXT_PUBLIC_CABIN_ID || 1);

export async function GET() {
  try {
    const db = getDb();
    const [contentRows, imageRows] = await Promise.all([
      db.select().from(siteContent).where(eq(siteContent.cabinId, cabinId)),
      db.select().from(siteImages).where(eq(siteImages.cabinId, cabinId)),
    ]);
    return Response.json(
      {
        content: Object.fromEntries(contentRows.map((row) => [row.contentKey, row.value])),
        images: imageRows.map((row) => ({
          ...row,
          url: row.storageKey ? `/api/media?key=${encodeURIComponent(row.storageKey)}` : row.fallbackUrl,
        })),
      },
      { headers: publicCacheHeaders() },
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "No se pudo cargar el sitio." },
      { status: 500 },
    );
  }
}
