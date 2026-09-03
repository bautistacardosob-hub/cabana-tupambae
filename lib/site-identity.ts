import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "../db";
import { siteContent, siteImages } from "../db/schema";
import { templateContent } from "./template-content";

const cabinId=1;
const publicContentKeys=["brand_name","seo_title","seo_description","seo_keywords","home_hero_copy"] as const;
const publicImageKeys=["site-icon","seo-share","home-hero"] as const;

export function getPublicSiteUrl(){
  const raw=process.env.NEXT_PUBLIC_SITE_URL||process.env.URL||"http://localhost:3000";
  try{return new URL(/^https?:\/\//i.test(raw)?raw:`https://${raw}`).origin}catch{return "http://localhost:3000"}
}

const mediaUrl=(storageKey:string|undefined|null,fallback:string)=>storageKey?`/api/media?key=${encodeURIComponent(storageKey)}`:fallback;

export async function getPublicIdentity(){
  try{
    const db=getDb();
    const [contentRows,imageRows]=await Promise.all([
      db.select({key:siteContent.contentKey,value:siteContent.value}).from(siteContent).where(and(eq(siteContent.cabinId,cabinId),inArray(siteContent.contentKey,[...publicContentKeys]))),
      db.select({key:siteImages.imageKey,storageKey:siteImages.storageKey,fallback:siteImages.fallbackUrl}).from(siteImages).where(and(eq(siteImages.cabinId,cabinId),inArray(siteImages.imageKey,[...publicImageKeys]))),
    ]);
    const content=Object.fromEntries(contentRows.map(row=>[row.key,row.value]));
    const images=Object.fromEntries(imageRows.map(row=>[row.key,row]));
    const brandName=content.brand_name?.trim()||templateContent.brand_name;
    const title=content.seo_title?.trim()||`${brandName} | Genética y producción`;
    const description=content.seo_description?.trim()||content.home_hero_copy?.trim()||`${brandName}: genética, producción e identidad de la cabaña.`;
    const keywords=content.seo_keywords?.trim()||templateContent.seo_keywords;
    const icon=mediaUrl(images["site-icon"]?.storageKey,images["site-icon"]?.fallback||"/favicon.svg");
    const shareRow=images["seo-share"]||images["home-hero"];
    const shareImage=mediaUrl(shareRow?.storageKey,shareRow?.fallback||"/hero-cattle.jpg");
    return {brandName,title,description,keywords,icon,shareImage,siteUrl:getPublicSiteUrl()};
  }catch{
    const brandName=templateContent.brand_name;
    return {brandName,title:`${brandName} | Genética y producción`,description:templateContent.home_hero_copy,keywords:templateContent.seo_keywords,icon:"/favicon.svg",shareImage:"/hero-cattle.jpg",siteUrl:getPublicSiteUrl()};
  }
}
