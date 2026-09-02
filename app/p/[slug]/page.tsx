import type { Metadata } from "next";
import { and, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { siteContent } from "../../../db/schema";
import { SiteApplication } from "../../page";
import { getPublicIdentity } from "../../../lib/site-identity";

type PageProps={params:Promise<{slug:string}>};
type StoredPage={slug:string;menuLabel:string;title:string;lead:string;published:boolean};

async function getPage(slug:string){
  const [row]=await getDb().select({value:siteContent.value}).from(siteContent).where(and(eq(siteContent.cabinId,1),eq(siteContent.contentKey,"custom_pages_json"))).limit(1);
  try{return (JSON.parse(row?.value||"[]") as StoredPage[]).find(page=>page.slug===slug&&page.published)}catch{return undefined}
}

export async function generateMetadata({params}:PageProps):Promise<Metadata>{
  const {slug}=await params;const page=await getPage(slug);
  const {brandName}=await getPublicIdentity();
  if(!page)return {title:`Página no disponible | ${brandName}`,robots:{index:false,follow:false}};
  const title=`${page.title||page.menuLabel} | ${brandName}`;const description=page.lead||brandName;
  return {title,description,openGraph:{title,description,images:[]},twitter:{card:"summary",title,description,images:[]}};
}

export default async function CustomPageRoute({params}:PageProps){const {slug}=await params;return <SiteApplication initialScreen="pagina" initialPageSlug={slug}/>}
