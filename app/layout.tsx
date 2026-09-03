import type { Metadata } from "next";
import { getPublicIdentity } from "../lib/site-identity";
import "./globals.css";

export const revalidate=60;

export async function generateMetadata(): Promise<Metadata> {
  const identity=await getPublicIdentity();
  return {
    metadataBase:new URL(identity.siteUrl),
    title:{default:identity.title,template:`%s | ${identity.brandName}`},
    description:identity.description,
    keywords:identity.keywords.split(",").map(value=>value.trim()).filter(Boolean),
    applicationName:identity.brandName,
    creator:identity.brandName,
    icons:{icon:identity.icon,apple:identity.icon},
    openGraph:{title:identity.title,description:identity.description,type:"website",locale:"es_UY",siteName:identity.brandName,url:"/",images:[{url:identity.shareImage,width:1200,height:630,alt:`${identity.brandName} — genética y producción`}]},
    twitter:{card:"summary_large_image",title:identity.title,description:identity.description,images:[identity.shareImage]},
    robots:{index:true,follow:true},
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
