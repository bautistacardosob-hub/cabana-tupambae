import { and, eq } from "drizzle-orm";
import { getDb } from "../db";
import { siteContent } from "../db/schema";
import { templateContent } from "./template-content";

export async function getPublicIdentity(){
  try{
    const rows=await getDb().select({key:siteContent.contentKey,value:siteContent.value}).from(siteContent).where(and(eq(siteContent.cabinId,1),eq(siteContent.contentKey,"brand_name")));
    const brandName=rows[0]?.value?.trim()||templateContent.brand_name;
    return {brandName,description:`${brandName}: genética, producción e identidad de la cabaña.`};
  }catch{
    return {brandName:templateContent.brand_name,description:templateContent.home_hero_copy};
  }
}
