import { and, asc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { galleryMedia } from "../../../db/schema";
import { requireApiUser } from "../../api-auth";
import { mediaBucket } from "../../../lib/storage";

const cabinId=1;
const allowedImages=new Set(["image/jpeg","image/png","image/webp","image/gif"]);
const maxImageBytes=12*1024*1024;
const bucket=mediaBucket;
const isExternal=(value:string)=>/^https?:\/\//i.test(value);
const publicRecord=(row:typeof galleryMedia.$inferSelect)=>({...row,url:isExternal(row.storageKey)?row.storageKey:`/api/media?key=${encodeURIComponent(row.storageKey)}`});

type GalleryUploadPayload={action?:string;filename?:string;contentType?:string;storageKey?:string;size?:number;caption?:string;category?:string};

async function insertGalleryRecord(storageKey:string,filename:string,contentType:string,caption:string,category:string){
  const db=getDb();
  const [duplicate]=await db.select().from(galleryMedia).where(and(eq(galleryMedia.cabinId,cabinId),eq(galleryMedia.storageKey,storageKey)));
  if(duplicate)return duplicate;
  const existing=await db.select({sortOrder:galleryMedia.sortOrder}).from(galleryMedia).where(eq(galleryMedia.cabinId,cabinId));
  const nextOrder=existing.reduce((highest,item)=>Math.max(highest,item.sortOrder),-1)+1;
  const [row]=await db.insert(galleryMedia).values({cabinId,storageKey,filename,contentType,caption,category,published:true,sortOrder:nextOrder}).returning();
  return row;
}

export async function GET(request:Request){
  try{const all=new URL(request.url).searchParams.get("all")==="1";if(all){const unauthorized=await requireApiUser();if(unauthorized)return unauthorized}const db=getDb();const rows=all?await db.select().from(galleryMedia).where(eq(galleryMedia.cabinId,cabinId)).orderBy(asc(galleryMedia.sortOrder)):await db.select().from(galleryMedia).where(and(eq(galleryMedia.cabinId,cabinId),eq(galleryMedia.published,true))).orderBy(asc(galleryMedia.sortOrder));return Response.json({media:rows.map(publicRecord)})}catch(error){return Response.json({error:error instanceof Error?error.message:"No se pudo cargar la galería."},{status:500})}
}

export async function POST(request:Request){
  const unauthorized=await requireApiUser();if(unauthorized)return unauthorized;
  try{
    if((request.headers.get("content-type")||"").includes("application/json")){
      const body=await request.json() as GalleryUploadPayload;
      const filename=String(body.filename||"").trim();
      const contentType=String(body.contentType||"").trim();
      const size=Number(body.size);
      const category=String(body.category||"General").trim()||"General";
      const caption=String(body.caption||"").trim();
      if(!filename||!allowedImages.has(contentType))return Response.json({error:"Usá una imagen JPG, PNG, WebP o GIF."},{status:400});
      if(body.action==="prepare-image"){
        if(!Number.isFinite(size)||size<=0||size>maxImageBytes)return Response.json({error:"La imagen no puede superar los 12 MB."},{status:400});
        const safeName=filename.toLowerCase().replace(/[^a-z0-9._-]+/g,"-").slice(-80)||"foto.jpg";
        const storageKey=`gallery/${crypto.randomUUID()}-${safeName}`;
        const signed=await bucket().createSignedUpload(storageKey);
        return Response.json({upload:{path:signed.path,token:signed.token}});
      }
      if(body.action==="complete-image"){
        const storageKey=String(body.storageKey||"").trim();
        if(!storageKey.startsWith("gallery/"))return Response.json({error:"Los datos de la fotografía no son válidos."},{status:400});
        if(!await bucket().exists(storageKey))return Response.json({error:"La fotografía no terminó de subirse."},{status:409});
        const row=await insertGalleryRecord(storageKey,filename,contentType,caption,category);
        return Response.json({media:publicRecord(row)},{status:201});
      }
      return Response.json({error:"Acción de imagen inválida."},{status:400});
    }
    const form=await request.formData();
    const file=form.get("file");
    if(!(file instanceof File))return Response.json({error:"Seleccioná una fotografía."},{status:400});
    if(!allowedImages.has(file.type))return Response.json({error:"Usá una imagen JPG, PNG, WebP o GIF."},{status:400});
    if(file.size>maxImageBytes)return Response.json({error:"La imagen no puede superar los 12 MB."},{status:400});
    const safeName=file.name.toLowerCase().replace(/[^a-z0-9._-]+/g,"-").slice(-80)||"foto.jpg";
    const storageKey=`gallery/${crypto.randomUUID()}-${safeName}`;
    await bucket().put(storageKey,file,file.type);
    const row=await insertGalleryRecord(storageKey,file.name,file.type,String(form.get("caption")||"").trim(),String(form.get("category")||"General").trim()||"General");
    return Response.json({media:publicRecord(row)},{status:201});
  }catch(error){return Response.json({error:error instanceof Error?error.message:"No se pudo subir la fotografía."},{status:500})}
}

export async function PATCH(request:Request){
  const unauthorized=await requireApiUser();if(unauthorized)return unauthorized;
  try{const body=await request.json() as {id?:number;caption?:string;category?:string;published?:boolean;order?:number[]};const db=getDb();if(Array.isArray(body.order)){const order=[...new Set(body.order.map(Number).filter(Boolean))];const existing=await db.select({id:galleryMedia.id}).from(galleryMedia).where(eq(galleryMedia.cabinId,cabinId));if(order.length!==existing.length||existing.some(item=>!order.includes(item.id)))return Response.json({error:"El orden de la galería no es válido."},{status:400});for(const [index,id] of order.entries())await db.update(galleryMedia).set({sortOrder:index}).where(and(eq(galleryMedia.id,id),eq(galleryMedia.cabinId,cabinId)));const rows=await db.select().from(galleryMedia).where(eq(galleryMedia.cabinId,cabinId)).orderBy(asc(galleryMedia.sortOrder));return Response.json({media:rows.map(publicRecord)})}const id=Number(body.id);if(!id)return Response.json({error:"Fotografía inválida."},{status:400});const [row]=await db.update(galleryMedia).set({caption:String(body.caption||"").trim(),category:String(body.category||"General").trim(),published:Boolean(body.published)}).where(and(eq(galleryMedia.id,id),eq(galleryMedia.cabinId,cabinId))).returning();if(!row)return Response.json({error:"Fotografía no encontrada."},{status:404});return Response.json({media:publicRecord(row)})}catch(error){return Response.json({error:error instanceof Error?error.message:"No se pudo actualizar la fotografía."},{status:500})}
}

export async function DELETE(request:Request){
  const unauthorized=await requireApiUser();if(unauthorized)return unauthorized;
  try{const id=Number(new URL(request.url).searchParams.get("id"));const db=getDb();const [row]=await db.select().from(galleryMedia).where(and(eq(galleryMedia.id,id),eq(galleryMedia.cabinId,cabinId)));if(!row)return Response.json({error:"Fotografía no encontrada."},{status:404});if(!isExternal(row.storageKey))await bucket().delete(row.storageKey);await db.delete(galleryMedia).where(eq(galleryMedia.id,id));return Response.json({deleted:id})}catch(error){return Response.json({error:error instanceof Error?error.message:"No se pudo eliminar la fotografía."},{status:500})}
}
