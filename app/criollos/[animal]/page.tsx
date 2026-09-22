import type { Metadata } from "next";
import { and, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { animals } from "../../../db/schema";
import { SiteApplication } from "../../page";
import { getPublicIdentity } from "../../../lib/site-identity";
import { AnimalDetailActions } from "../../animal-detail-actions";
type PageProps={params:Promise<{animal:string}>};
const animalIdFrom=(value:string)=>Number(value.match(/^\d+/)?.[0]||0);
async function getAnimal(value:string){const id=animalIdFrom(value);if(!id)return undefined;const [animal]=await getDb().select().from(animals).where(and(eq(animals.id,id),eq(animals.cabinId,1),eq(animals.status,"published"))).limit(1);return animal;}
export async function generateMetadata({params}:PageProps):Promise<Metadata>{const {animal:value}=await params;const animal=await getAnimal(value);const {brandName}=await getPublicIdentity();if(!animal)return {title:`Ficha no disponible | ${brandName}`,robots:{index:false,follow:false}};const title=`${animal.name} · RP ${animal.rp} | ${brandName}`;const description=animal.description||`${animal.type} ${animal.breed}. Consultá la ficha del ejemplar.`;return {title,description,openGraph:{title,description,type:"website"},twitter:{card:"summary",title,description}};}
export default async function AnimalPage({params}:PageProps){const {animal:value}=await params;const animal=await getAnimal(value);return <><SiteApplication initialScreen="animal" initialAnimalId={animalIdFrom(value)}/>{animal&&<AnimalDetailActions id={animal.id} section="criollos"/>}</>;}
