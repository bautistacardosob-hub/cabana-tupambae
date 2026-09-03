import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { siteContent, siteImages, sitePublications } from "../../../db/schema";
import { requireApiUser } from "../../api-auth";

const cabinId=1;
type Snapshot={content:Record<string,string>;images:Record<string,{storageKey:string|null;fallbackUrl:string;contentType:string|null}>};

const imageUrl=(key:string|null,fallback:string)=>key?`/api/media?key=${encodeURIComponent(key)}`:fallback;

async function currentSnapshot():Promise<Snapshot>{
  const db=getDb();
  const [contentRows,imageRows]=await Promise.all([db.select().from(siteContent).where(eq(siteContent.cabinId,cabinId)),db.select().from(siteImages).where(eq(siteImages.cabinId,cabinId))]);
  return {content:Object.fromEntries(contentRows.map(row=>[row.contentKey,row.value])),images:Object.fromEntries(imageRows.map(row=>[row.imageKey,{storageKey:row.storageKey,fallbackUrl:row.fallbackUrl,contentType:row.contentType}]))};
}

export async function GET(){
  const unauthorized=await requireApiUser();if(unauthorized)return unauthorized;
  try{const rows=await getDb().select({id:sitePublications.id,publishedAt:sitePublications.publishedAt}).from(sitePublications).where(eq(sitePublications.cabinId,cabinId)).orderBy(desc(sitePublications.publishedAt)).limit(8);return Response.json({publications:rows})}catch(error){return Response.json({error:error instanceof Error?error.message:"No se pudo cargar el historial."},{status:500})}
}

export async function POST(){
  const unauthorized=await requireApiUser();if(unauthorized)return unauthorized;
  try{
    const db=getDb();
    const {publication,snapshot}=await db.transaction(async tx=>{
      const updatedAt=new Date().toISOString();
      await tx.update(siteContent).set({value:sql`${siteContent.draftValue}`,draftValue:null,updatedAt}).where(and(eq(siteContent.cabinId,cabinId),isNotNull(siteContent.draftValue)));
      await tx.update(siteImages).set({storageKey:sql`${siteImages.draftStorageKey}`,contentType:sql`${siteImages.draftContentType}`,draftStorageKey:null,draftContentType:null,updatedAt}).where(and(eq(siteImages.cabinId,cabinId),isNotNull(siteImages.draftStorageKey)));
      const contentRows=await tx.select().from(siteContent).where(eq(siteContent.cabinId,cabinId));
      const imageRows=await tx.select().from(siteImages).where(eq(siteImages.cabinId,cabinId));
      const snapshot:Snapshot={content:Object.fromEntries(contentRows.map(row=>[row.contentKey,row.value])),images:Object.fromEntries(imageRows.map(row=>[row.imageKey,{storageKey:row.storageKey,fallbackUrl:row.fallbackUrl,contentType:row.contentType}]))};
      const [publication]=await tx.insert(sitePublications).values({cabinId,snapshot:JSON.stringify(snapshot),publishedAt:updatedAt}).returning();
      return {publication,snapshot};
    });
    return Response.json({publication:{id:publication.id,publishedAt:publication.publishedAt},content:snapshot.content,images:Object.entries(snapshot.images).map(([imageKey,image])=>({imageKey,url:imageUrl(image.storageKey,image.fallbackUrl)}))});
  }catch(error){return Response.json({error:error instanceof Error?error.message:"No se pudieron publicar los cambios."},{status:500})}
}

export async function PATCH(request:Request){
  const unauthorized=await requireApiUser();if(unauthorized)return unauthorized;
  try{
    const publicationId=Number((await request.json() as {publicationId?:number}).publicationId);const db=getDb();
    const [publication]=await db.select().from(sitePublications).where(and(eq(sitePublications.id,publicationId),eq(sitePublications.cabinId,cabinId)));
    if(!publication)return Response.json({error:"Versión no encontrada."},{status:404});
    const snapshot=JSON.parse(publication.snapshot) as Snapshot;
    for(const [contentKey,value] of Object.entries(snapshot.content)){const [row]=await db.select().from(siteContent).where(and(eq(siteContent.cabinId,cabinId),eq(siteContent.contentKey,contentKey)));if(row)await db.update(siteContent).set({value,draftValue:null,updatedAt:new Date().toISOString()}).where(eq(siteContent.id,row.id));else await db.insert(siteContent).values({cabinId,contentKey,value,draftValue:null,updatedAt:new Date().toISOString()})}
    for(const [imageKey,image] of Object.entries(snapshot.images)){const [row]=await db.select().from(siteImages).where(and(eq(siteImages.cabinId,cabinId),eq(siteImages.imageKey,imageKey)));if(row)await db.update(siteImages).set({storageKey:image.storageKey,contentType:image.contentType,fallbackUrl:image.fallbackUrl,draftStorageKey:null,draftContentType:null,updatedAt:new Date().toISOString()}).where(eq(siteImages.id,row.id))}
    const restored=await currentSnapshot();
    return Response.json({content:restored.content,images:Object.entries(restored.images).map(([imageKey,image])=>({imageKey,url:imageUrl(image.storageKey,image.fallbackUrl)}))});
  }catch(error){return Response.json({error:error instanceof Error?error.message:"No se pudo restaurar la versión."},{status:500})}
}
