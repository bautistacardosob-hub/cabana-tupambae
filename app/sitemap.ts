import type { MetadataRoute } from "next";
import { getPublicSiteUrl } from "../lib/site-identity";

export default function sitemap():MetadataRoute.Sitemap{
  const siteUrl=getPublicSiteUrl();
  const routes=["","/la-cabana","/genetica","/actualidad","/galeria","/contacto"];
  return routes.map((route,index)=>({url:`${siteUrl}${route}`,lastModified:new Date(),changeFrequency:index===0?"weekly":"monthly",priority:index===0?1:0.8}));
}

