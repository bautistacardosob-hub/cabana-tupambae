import type { Metadata } from "next";
import { and, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { newsPosts } from "../../../db/schema";
import { SiteApplication } from "../../page";
import { getPublicIdentity } from "../../../lib/site-identity";

type PageProps={params:Promise<{slug:string}>};

async function getPost(slug:string){
  const [post]=await getDb().select().from(newsPosts).where(and(eq(newsPosts.slug,slug),eq(newsPosts.published,true))).limit(1);
  return post;
}

export async function generateMetadata({params}:PageProps):Promise<Metadata>{
  const {slug}=await params;
  const post=await getPost(slug);
  const {brandName}=await getPublicIdentity();
  if(!post)return {title:`Noticia no disponible | ${brandName}`,robots:{index:false,follow:false}};
  const title=`${post.title} | ${brandName}`;
  const description=post.excerpt||post.content?.slice(0,155)||`Actualidad de ${brandName}`;
  return {title,description,openGraph:{title,description,type:"article",images:[]},twitter:{card:"summary",title,description,images:[]}};
}

export default async function NewsDetailPage({params}:PageProps){
  const {slug}=await params;
  return <SiteApplication initialScreen="noticia" initialNewsSlug={slug}/>;
}
