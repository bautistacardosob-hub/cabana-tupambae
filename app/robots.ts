import type { MetadataRoute } from "next";
import { getPublicSiteUrl } from "../lib/site-identity";

export default function robots():MetadataRoute.Robots{
  const siteUrl=getPublicSiteUrl();
  return {rules:{userAgent:"*",allow:"/",disallow:["/admin","/login","/preview","/api/"]},sitemap:`${siteUrl}/sitemap.xml`,host:siteUrl};
}

