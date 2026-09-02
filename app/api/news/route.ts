import { and, asc, desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { newsPosts } from "../../../db/schema";
import { requireApiUser } from "../../api-auth";
import { mediaBucket } from "../../../lib/storage";

const cabinId=1;
const allowedImages=new Set(["image/jpeg","image/png","image/webp","image/gif"]);
const maxImageBytes=12*1024*1024;
const allowedDocuments=new Set(["application/pdf"]);
const maxDocumentBytes=24*1024*1024;
const slugify=(value:string)=>value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
const bucket=mediaBucket;
const publicRecord=(row:typeof newsPosts.$inferSelect)=>({...row,image:row.storageKey?`/api/media?key=${encodeURIComponent(row.storageKey)}`:row.image,articleImage:row.articleStorageKey?`/api/media?key=${encodeURIComponent(row.articleStorageKey)}`:row.articleImage,documentUrl:row.documentStorageKey?`/api/media?key=${encodeURIComponent(row.documentStorageKey)}`:null});

type NewsImagePayload={action?:string;imageKind?:"cover"|"article"|"document";filename?:string;contentType?:string;storageKey?:string;size?:number;ids?:number[]};

async function newsImageAction(request:Request){
  const body=await request.json() as NewsImagePayload;
  if(body.action==="reorder"){
    const ids=Array.isArray(body.ids)?body.ids.filter((id):id is number=>Number.isInteger(id)&&id>0):[];
    if(!ids.length||new Set(ids).size!==ids.length)return Response.json({error:"El orden enviado no es válido."},{status:400});
    const db=getDb();
    const rows=await db.select({id:newsPosts.id}).from(newsPosts).where(eq(newsPosts.cabinId,cabinId));
    if(rows.length!==ids.length||rows.some(row=>!ids.includes(row.id)))return Response.json({error:"La lista de artículos cambió. Recargá la página e intentá nuevamente."},{status:409});
    await Promise.all(ids.map((id,index)=>db.update(newsPosts).set({sortOrder:index,updatedAt:new Date().toISOString()}).where(and(eq(newsPosts.id,id),eq(newsPosts.cabinId,cabinId)))));
    return Response.json({ordered:ids});
  }
  const kind=body.imageKind==="document"?"document":body.imageKind==="article"?"article":"cover";
  const folder=kind==="document"?"news/documents":kind==="article"?"news/articles":"news/covers";
  const filename=String(body.filename||"").trim();
  const fileType=String(body.contentType||"").trim();
  const size=Number(body.size);
  const allowed=kind==="document"?allowedDocuments:allowedImages;
  const maxBytes=kind==="document"?maxDocumentBytes:maxImageBytes;
  if(!filename||!allowed.has(fileType))return Response.json({error:kind==="document"?"El documento debe ser un archivo PDF.":"Usá una imagen JPG, PNG, WebP o GIF."},{status:400});
  if(body.action==="prepare-image"){
    if(!Number.isFinite(size)||size<=0||size>maxBytes)return Response.json({error:kind==="document"?"El PDF no puede superar los 24 MB.":"La imagen no puede superar los 12 MB."},{status:400});
    const safeName=filename.toLowerCase().replace(/[^a-z0-9._-]+/g,"-").slice(-80)||(kind==="document"?"documento.pdf":kind==="article"?"articulo.jpg":"noticia.jpg");
    const storageKey=`${folder}/${crypto.randomUUID()}-${safeName}`;
    const signed=await bucket().createSignedUpload(storageKey);
    return Response.json({upload:{path:signed.path,token:signed.token}});
  }
  if(body.action==="complete-image"){
    const storageKey=String(body.storageKey||"").trim();
    if(!storageKey.startsWith(`${folder}/`))return Response.json({error:"Los datos de la imagen no son válidos."},{status:400});
    if(!await bucket().exists(storageKey))return Response.json({error:"La imagen no terminó de subirse."},{status:409});
    return Response.json({uploaded:{storageKey,url:`/api/media?key=${encodeURIComponent(storageKey)}`}});
  }
  return Response.json({error:"Acción de imagen inválida."},{status:400});
}

export async function GET(request:Request){try{const all=new URL(request.url).searchParams.get("all")==="1";if(all){const unauthorized=await requireApiUser();if(unauthorized)return unauthorized}const db=getDb();const rows=all?await db.select().from(newsPosts).where(eq(newsPosts.cabinId,cabinId)).orderBy(asc(newsPosts.sortOrder),desc(newsPosts.updatedAt)):await db.select().from(newsPosts).where(and(eq(newsPosts.cabinId,cabinId),eq(newsPosts.published,true))).orderBy(asc(newsPosts.sortOrder),desc(newsPosts.publishedAt));return Response.json({posts:rows.map(publicRecord)})}catch(error){return Response.json({error:error instanceof Error?error.message:"No se pudo cargar Actualidad."},{status:500})}}

async function valuesFromForm(form:FormData,current?:typeof newsPosts.$inferSelect){
  const title=String(form.get("title")||"").trim();if(!title)throw new Error("Ingresá un título.");
  let storageKey=current?.storageKey??null;let image=current?.image??"/ranch.jpg";const directCover=String(form.get("coverStorageKey")||"").trim();
  if(directCover){if(!directCover.startsWith("news/covers/")||!await bucket().exists(directCover))throw new Error("La portada no terminó de subirse.");if(storageKey&&storageKey!==directCover)await bucket().delete(storageKey);storageKey=directCover;image="/ranch.jpg"}
  const file=form.get("file");
  if(file instanceof File&&file.size){if(!allowedImages.has(file.type))throw new Error("Usá una imagen JPG, PNG, WebP o GIF.");if(file.size>maxImageBytes)throw new Error("La imagen no puede superar los 12 MB.");const safeName=file.name.toLowerCase().replace(/[^a-z0-9._-]+/g,"-").slice(-80)||"noticia.jpg";const nextKey=`news/${crypto.randomUUID()}-${safeName}`;await bucket().put(nextKey,file,file.type);if(storageKey)await bucket().delete(storageKey);storageKey=nextKey;image="/ranch.jpg"}
  let articleStorageKey=current?.articleStorageKey??null;let articleImage=current?.articleImage??null;const directArticle=String(form.get("articleStorageKey")||"").trim();
  if(form.get("removeArticleImage")==="true"){if(articleStorageKey)await bucket().delete(articleStorageKey);articleStorageKey=null;articleImage=null}
  if(directArticle){if(!directArticle.startsWith("news/articles/")||!await bucket().exists(directArticle))throw new Error("La imagen interior no terminó de subirse.");if(articleStorageKey&&articleStorageKey!==directArticle)await bucket().delete(articleStorageKey);articleStorageKey=directArticle;articleImage=null}
  const articleFile=form.get("articleFile");
  if(articleFile instanceof File&&articleFile.size){if(!allowedImages.has(articleFile.type))throw new Error("Usá una imagen interior JPG, PNG, WebP o GIF.");if(articleFile.size>maxImageBytes)throw new Error("La imagen interior no puede superar los 12 MB.");const safeName=articleFile.name.toLowerCase().replace(/[^a-z0-9._-]+/g,"-").slice(-80)||"articulo.jpg";const nextKey=`news/articles/${crypto.randomUUID()}-${safeName}`;await bucket().put(nextKey,articleFile,articleFile.type);if(articleStorageKey)await bucket().delete(articleStorageKey);articleStorageKey=nextKey;articleImage=null}
  let documentStorageKey=current?.documentStorageKey??null;let documentFilename=current?.documentFilename??null;const directDocument=String(form.get("documentStorageKey")||"").trim();
  if(form.get("removeDocument")==="true"){if(documentStorageKey)await bucket().delete(documentStorageKey);documentStorageKey=null;documentFilename=null}
  if(directDocument){if(!directDocument.startsWith("news/documents/")||!await bucket().exists(directDocument))throw new Error("El PDF no terminó de subirse.");if(documentStorageKey&&documentStorageKey!==directDocument)await bucket().delete(documentStorageKey);documentStorageKey=directDocument;documentFilename=String(form.get("documentFilename")||"Documento PDF").trim()||"Documento PDF"}
  const published=form.get("published")==="true";return {title,excerpt:String(form.get("excerpt")||"").trim(),content:String(form.get("content")||"").trim(),videoUrl:String(form.get("videoUrl")||"").trim()||null,category:String(form.get("category")||"Actualidad").trim(),image,storageKey,articleImage,articleStorageKey,documentStorageKey,documentFilename,published,publishedAt:published?(current?.publishedAt||new Date().toISOString()):null,updatedAt:new Date().toISOString()};
}

export async function POST(request:Request){const unauthorized=await requireApiUser();if(unauthorized)return unauthorized;try{if((request.headers.get("content-type")||"").includes("application/json"))return await newsImageAction(request);const form=await request.formData();const values=await valuesFromForm(form);const base=slugify(values.title)||"noticia";const slug=`${base}-${Date.now().toString(36)}`;const [post]=await getDb().insert(newsPosts).values({cabinId,slug,...values}).returning();return Response.json({post:publicRecord(post)},{status:201})}catch(error){return Response.json({error:error instanceof Error?error.message:"No se pudo crear la noticia."},{status:400})}}
export async function PATCH(request:Request){const unauthorized=await requireApiUser();if(unauthorized)return unauthorized;try{const form=await request.formData();const id=Number(form.get("id"));const db=getDb();const [current]=await db.select().from(newsPosts).where(and(eq(newsPosts.id,id),eq(newsPosts.cabinId,cabinId)));if(!current)return Response.json({error:"Noticia no encontrada."},{status:404});const values=await valuesFromForm(form,current);const [post]=await db.update(newsPosts).set(values).where(eq(newsPosts.id,id)).returning();return Response.json({post:publicRecord(post)})}catch(error){return Response.json({error:error instanceof Error?error.message:"No se pudo actualizar la noticia."},{status:400})}}
export async function DELETE(request:Request){const unauthorized=await requireApiUser();if(unauthorized)return unauthorized;try{const id=Number(new URL(request.url).searchParams.get("id"));const db=getDb();const [post]=await db.select().from(newsPosts).where(and(eq(newsPosts.id,id),eq(newsPosts.cabinId,cabinId)));if(!post)return Response.json({error:"Noticia no encontrada."},{status:404});if(post.storageKey)await bucket().delete(post.storageKey);if(post.articleStorageKey)await bucket().delete(post.articleStorageKey);if(post.documentStorageKey)await bucket().delete(post.documentStorageKey);await db.delete(newsPosts).where(eq(newsPosts.id,id));return Response.json({deleted:id})}catch(error){return Response.json({error:error instanceof Error?error.message:"No se pudo eliminar la noticia."},{status:500})}}
