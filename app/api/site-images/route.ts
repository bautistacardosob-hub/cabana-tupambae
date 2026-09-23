import { and, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { siteImages } from "../../../db/schema";
import { requireApiUser } from "../../api-auth";
import { mediaBucket } from "../../../lib/storage";

const cabinId = 1;
const allowedImages = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const maxImageBytes = 12 * 1024 * 1024;

const isAllowedImage = (imageKey:string, contentType:string) =>
  imageKey === "brand-pdf" ? ["image/svg+xml", "image/png", "image/webp"].includes(contentType) :
  allowedImages.has(contentType) || (["brand-watermark","site-icon"].includes(imageKey) && contentType === "image/svg+xml");

const bucket = mediaBucket;

type ImagePayload = {
  action?: string;
  imageKey?: string;
  label?: string;
  fallbackUrl?: string;
  filename?: string;
  contentType?: string;
  storageKey?: string;
  size?: number;
};

function publicRow(row: typeof siteImages.$inferSelect,draft=false) {
  const key=draft&&row.draftStorageKey!==null?row.draftStorageKey:row.storageKey;
  return { ...row, url: key ? `/api/media?key=${encodeURIComponent(key)}` : row.imageKey==="brand-pdf" ? "" : row.fallbackUrl };
}

async function saveDraftImage(imageKey:string,label:string,fallbackUrl:string,storageKey:string,contentType:string){
  const db=getDb();
  const [current]=await db.select().from(siteImages).where(and(eq(siteImages.cabinId,cabinId),eq(siteImages.imageKey,imageKey)));
  const values={cabinId,imageKey,label,storageKey:current?.storageKey??null,draftStorageKey:storageKey,fallbackUrl:current?.fallbackUrl||fallbackUrl,contentType:current?.contentType??null,draftContentType:contentType,updatedAt:new Date().toISOString()};
  const [row]=current
    ?await db.update(siteImages).set(values).where(eq(siteImages.id,current.id)).returning()
    :await db.insert(siteImages).values(values).returning();
  if(current?.draftStorageKey&&current.draftStorageKey!==storageKey)await bucket().delete(current.draftStorageKey);
  return row;
}

export async function GET(request:Request) {
  try {
    const draft=new URL(request.url).searchParams.get("draft")==="1";
    if(draft){const unauthorized=await requireApiUser();if(unauthorized)return unauthorized}
    const rows = await getDb().select().from(siteImages).where(eq(siteImages.cabinId, cabinId));
    return Response.json(
      { images: rows.map(row=>publicRow(row,draft)), hasDraft:rows.some(row=>row.draftStorageKey!==null) },
      {headers:{"Cache-Control":draft?"private, no-store":"public, s-maxage=15, stale-while-revalidate=120"}}
    );
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "No se pudieron cargar las imágenes." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const unauthorized = await requireApiUser();
  if (unauthorized) return unauthorized;
  try {
    const requestType=request.headers.get("content-type")||"";
    if(requestType.includes("application/json")){
      const body=await request.json() as ImagePayload;
      if(body.action==="reset-image"){
        if(body.imageKey!=="brand-pdf")return Response.json({error:"Solo se puede quitar la marca opcional de las fichas PDF."},{status:400});
        const db=getDb();
        const [current]=await db.select().from(siteImages).where(and(eq(siteImages.cabinId,cabinId),eq(siteImages.imageKey,"brand-pdf"))).limit(1);
        if(!current)return Response.json({error:"Todavía no hay una marca de fichas PDF para quitar."},{status:404});
        const [row]=await db.update(siteImages).set({draftStorageKey:"",draftContentType:null,updatedAt:new Date().toISOString()}).where(eq(siteImages.id,current.id)).returning();
        if(current.draftStorageKey&&current.draftStorageKey!==current.storageKey)await bucket().delete(current.draftStorageKey).catch(()=>undefined);
        return Response.json({image:publicRow(row,true),hasDraft:true});
      }
      const imageKey=String(body.imageKey||"").trim();
      const label=String(body.label||imageKey).trim();
      const fallbackUrl=String(body.fallbackUrl||"/hero-cattle.jpg").trim();
      const filename=String(body.filename||"").trim();
      const imageType=String(body.contentType||"").trim();
      const size=Number(body.size);
      if(!/^[a-z0-9-]+$/.test(imageKey)||!filename)return Response.json({error:"Seleccioná una imagen válida."},{status:400});
      if(!isAllowedImage(imageKey,imageType))return Response.json({error:"Usá una imagen JPG, PNG, WebP o GIF. La marca para fichas PDF admite PNG, WebP o SVG transparente."},{status:400});
      if(body.action==="prepare-image"){
        if(!Number.isFinite(size)||size<=0||size>maxImageBytes)return Response.json({error:"La imagen no puede superar los 12 MB."},{status:400});
        const safeName=filename.toLowerCase().replace(/[^a-z0-9._-]+/g,"-").slice(-80)||"imagen.jpg";
        const storageKey=`site/${imageKey}/${crypto.randomUUID()}-${safeName}`;
        const signed=await bucket().createSignedUpload(storageKey);
        return Response.json({upload:{path:signed.path,token:signed.token}});
      }
      if(body.action==="complete-image"){
        const storageKey=String(body.storageKey||"").trim();
        if(!storageKey.startsWith(`site/${imageKey}/`))return Response.json({error:"Los datos de la imagen no son válidos."},{status:400});
        if(!await bucket().exists(storageKey))return Response.json({error:"La imagen no terminó de subirse."},{status:409});
        const row=await saveDraftImage(imageKey,label,fallbackUrl,storageKey,imageType);
        return Response.json({image:publicRow(row,true),hasDraft:true});
      }
      return Response.json({error:"Acción de imagen inválida."},{status:400});
    }
    const form = await request.formData();
    const imageKey = String(form.get("imageKey") || "").trim();
    const label = String(form.get("label") || imageKey).trim();
    const fallbackUrl = String(form.get("fallbackUrl") || "/hero-cattle.jpg").trim();
    const file = form.get("file");
    if (!/^[a-z0-9-]+$/.test(imageKey) || !(file instanceof File)) return Response.json({ error: "Seleccioná una imagen válida." }, { status: 400 });
    if (!isAllowedImage(imageKey,file.type)) return Response.json({ error: "Usá una imagen JPG, PNG, WebP o GIF. La marca para fichas PDF admite PNG, WebP o SVG transparente." }, { status: 400 });
    if (file.size > maxImageBytes) return Response.json({ error: "La imagen no puede superar los 12 MB." }, { status: 400 });
    const safeName = file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").slice(-80) || "imagen.jpg";
    const storageKey = `site/${imageKey}/${crypto.randomUUID()}-${safeName}`;
    await bucket().put(storageKey, file, file.type);
    const row=await saveDraftImage(imageKey,label,fallbackUrl,storageKey,file.type);
    return Response.json({ image: publicRow(row,true), hasDraft:true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "No se pudo reemplazar la imagen." }, { status: 500 });
  }
}
