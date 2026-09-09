"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { templateContent, templateSiteImages } from "../lib/template-content";
import { readApiJson, uploadFileDirect, uploadImageDirect } from "../lib/client-upload";
import { optimizedImageUrl } from "../lib/image-url";

export type Screen = "home" | "cabana" | "genetica" | "animal" | "criollos" | "actualidad" | "noticia" | "galeria" | "remate" | "contacto" | "pagina" | "admin";
export type AdminSection = "resumen" | "animales" | "categorias" | "actualidad" | "remates" | "consultas" | "pagina" | "multimedia" | "cuenta";
export type PedigreeMember = { id?:number; relation:string; name:string; registration?:string|null; sortOrder?:number };
export type DepRecord = { id?:number; label:string; value:string; precision?:string|null; percentile?:string|null; sortOrder?:number };
export type MediaRecord = { id?:number; kind:"image"|"video"; url?:string|null; storageKey?:string|null; externalUrl?:string|null; filename?:string|null; caption?:string|null; sortOrder?:number };
export type AuctionRecord = { id?:number; title:string; auctionDate?:string|null; auctionTime?:string|null; auctioneer?:string|null; location?:string|null; lots?:string|null; description?:string|null; catalogUrl?:string|null; streamUrl?:string|null; image:string; status:"upcoming"|"past"; published:boolean; sortOrder?:number; updatedAt?:string };
export type ContactMessage = { id:number; name:string; email:string; phone?:string|null; subject?:string|null; message:string; isRead:boolean; createdAt:string };
export type SiteImageRecord = { id?:number; imageKey:string; label:string; url:string; fallbackUrl:string; storageKey?:string|null };
export type SiteImageMap = Record<string,string>;
export type SiteContentMap = Record<string,string>;
export type CategoryRecord = {id:number;name:string;slug:string;sortOrder:number;active:boolean;catalogSection?:"genetics"|"criollos";kind?:"category"|"coat"};
export type GalleryMediaRecord = {id:number;url:string;storageKey:string;filename?:string|null;caption?:string|null;category?:string|null;published:boolean;sortOrder:number};
export type NewsRecord = {id:number;title:string;slug:string;excerpt?:string|null;content?:string|null;videoUrl?:string|null;articleImage?:string|null;documentUrl?:string|null;documentFilename?:string|null;sortOrder?:number;category:string;image:string;published:boolean;publishedAt?:string|null;updatedAt:string};
export type PublicationRecord = {id:number;publishedAt:string};
export type CustomPage = {id:string;slug:string;menuLabel:string;template:"editorial"|"photographic"|"split";eyebrow:string;title:string;lead:string;body:string;heroImage:string;published:boolean};
export const pedigreeLabels = [["sire","Padre"],["dam","Madre"],["paternal_grandsire","Abuelo paterno"],["paternal_granddam","Abuela paterna"],["maternal_grandsire","Abuelo materno"],["maternal_granddam","Abuela materna"]] as const;

export type AnimalRecord = {
  id?: number; name: string; type: string; rp: string; breed: string; image: string;
  status: "published" | "draft"; featured: boolean; sold: boolean; birthDate?: string | null;
  catalogSection?: "genetics" | "criollos";
  coat?: string | null; registration?: string | null; description?: string | null;
  geneticsProviderName?: string | null; geneticsProviderUrl?: string | null;
  introTitle?: string; introEmphasis?: string; introSecondary?: string;
  pedigreeTitle?: string; pedigreeEmphasis?: string; pedigreeDescription?: string;
  birthWeight?: string | null; weaningWeight?: string | null;
  scrotalCircumference?: string | null; frame?: string | null; updatedAt?: string;
  rpLabel?: string | null; birthDateLabel?: string | null; coatLabel?: string | null;
  registrationLabel?: string | null; birthWeightLabel?: string | null; weaningWeightLabel?: string | null;
  scrotalCircumferenceLabel?: string | null; frameLabel?: string | null;
  pedigree?: PedigreeMember[]; deps?: DepRecord[]; media?: MediaRecord[];
};

export const defaultSiteImages:SiteImageMap={"brand-logo":"/template-brand.svg","brand-watermark":"/template-watermark.svg",...Object.fromEntries(templateSiteImages.map(([key,,url])=>[key,url]))};
export const defaultContent:SiteContentMap=templateContent;
const ContentContext=createContext<SiteContentMap>(defaultContent);
export const SiteImageContext=createContext<SiteImageMap>(defaultSiteImages);
const AuctionContext=createContext<AuctionRecord|null>(null);
export const useSiteContent=()=>useContext(ContentContext);
export const isVisible=(content:SiteContentMap,key:string)=>content[key]!=="false";
const pageVisibilityKeys:Partial<Record<Screen,string>>={cabana:"show_cabana",genetica:"show_genetics",criollos:"show_criollos",actualidad:"show_news",galeria:"show_gallery",contacto:"show_contact"};
export const customPagesFromContent=(content:SiteContentMap):CustomPage[]=>{try{const value=JSON.parse(content.custom_pages_json||"[]");return Array.isArray(value)?value.filter(item=>item&&typeof item.slug==="string"):[]}catch{return []}};
type CachedSiteIdentity={brandName?:string;logo?:string};
const siteIdentityCacheKey="cabana-site-identity-v1";
const readCachedSiteIdentity=():CachedSiteIdentity=>{if(typeof window==="undefined")return {};try{return JSON.parse(localStorage.getItem(siteIdentityCacheKey)||"{}") as CachedSiteIdentity}catch{return {}}};
const cacheSiteIdentity=(values:CachedSiteIdentity)=>{if(typeof window==="undefined")return;try{const current=readCachedSiteIdentity();localStorage.setItem(siteIdentityCacheKey,JSON.stringify({...current,...values}))}catch{}};
type CachedPublicSnapshot={content?:SiteContentMap;images?:SiteImageRecord[];savedAt?:number};
const publicSnapshotCacheKey="cabana-public-snapshot-v1";
const readCachedPublicSnapshot=():CachedPublicSnapshot=>{if(typeof window==="undefined")return {};try{const value=JSON.parse(localStorage.getItem(publicSnapshotCacheKey)||"{}");return value&&typeof value==="object"?value as CachedPublicSnapshot:{}}catch{return {}}};
const cachePublicSnapshot=(content?:SiteContentMap,images?:SiteImageRecord[])=>{if(typeof window==="undefined"||!content||!images?.length)return;try{localStorage.setItem(publicSnapshotCacheKey,JSON.stringify({content,images,savedAt:Date.now()}))}catch{}};
export const colorPalettes=[
  {id:"tierra",name:"Tierra",copy:"Cálida, editorial y natural.",colors:["#35271f","#2b1d16","#f3eee4","#ae6d43"]},
  {id:"monte",name:"Monte",copy:"Verdes profundos y tonos orgánicos.",colors:["#203128","#10241a","#f0f2e9","#8d7148"]},
  {id:"pampa",name:"Pampa",copy:"Neutra, sobria y contemporánea.",colors:["#30332f","#202520","#efebe2","#8c7456"]},
  {id:"vino",name:"Vino",copy:"Borgoña elegante con acentos suaves.",colors:["#40292b","#2b181b","#f4ebe5","#9d5d50"]}
] as const;
export const typographyPresets=[
  {id:"editorial",name:"Editorial",copy:"Serif elegante y aire de catálogo premium."},
  {id:"clasica",name:"Clásica",copy:"Tradicional, refinada y de lectura pausada."},
  {id:"contemporanea",name:"Contemporánea",copy:"Limpia, directa y completamente sans serif."},
  {id:"campo",name:"Campo",copy:"Sólida, cálida y con carácter productivo."}
] as const;

export function findNextAuction(auctions:AuctionRecord[]){
  const today=new Date();today.setHours(0,0,0,0);
  return auctions.filter(item=>item.published&&item.status==="upcoming"&&Boolean(item.auctionDate)&&new Date(`${item.auctionDate}T12:00:00`)>=today).sort((a,b)=>String(a.auctionDate).localeCompare(String(b.auctionDate)))[0]??null;
}

function animalInquiryUrl(whatsapp:string,phone:string,animal:AnimalRecord){
  const reference=`${animal.name}${animal.rp?` (RP ${animal.rp})`:""}`;
  const message=animal.sold
    ? `Hola, vi que ${reference} figura como vendido. Quisiera consultar por animales similares.`
    : `Hola, quisiera consultar por ${reference}.`;
  const raw=whatsapp.trim();
  if(!raw)return "";
  try{
    const candidate=/^https?:\/\//i.test(raw)?raw:`https://${raw}`;
    const url=new URL(candidate);
    if(url.hostname.includes("wa.me")||url.hostname.includes("whatsapp.com")){
      url.searchParams.set("text",message);
      return url.toString();
    }
    if(url.hostname.includes("wa.link")){
      const configuredPhone=phone.replace(/\D/g,"");
      if(configuredPhone)return `https://wa.me/${configuredPhone}?text=${encodeURIComponent(message)}`;
      url.searchParams.set("text",message);
      return url.toString();
    }
  }catch{}
  const rawPhone=raw.replace(/\D/g,"");
  return rawPhone?`https://wa.me/${rawPhone}?text=${encodeURIComponent(message)}`:"";
}

function safeExternalUrl(value?:string|null){
  const raw=value?.trim();
  if(!raw)return "";
  try{
    const url=new URL(/^https?:\/\//i.test(raw)?raw:`https://${raw}`);
    return url.protocol==="http:"||url.protocol==="https:"?url.toString():"";
  }catch{return ""}
}

export function Brand({ dark = false }: { dark?: boolean }) {
  const content=useSiteContent();
  const images=useContext(SiteImageContext);
  return <div className={`brandMark ${dark ? "brandDark" : "brandLight"}`}><img src={images["brand-logo"]||defaultSiteImages["brand-logo"]} alt={content.brand_name}/></div>;
}

function Header({ screen, go }: { screen: Screen; go: (s: Screen) => void }) {
  const nextAuction=useContext(AuctionContext);
  const content=useSiteContent();
  const customPages=customPagesFromContent(content).filter(page=>page.published);
  const [menuOpen,setMenuOpen]=useState(false);
  const light = screen === "home" || screen === "animal";
  const navigate=(target:Screen)=>{setMenuOpen(false);go(target)};
  return (
    <>
    <header className={`siteHeader ${light ? "headerLight" : "headerDark"} ${menuOpen?"menuOpen":""}`}>
      <button className="brandButton" onClick={() => go("home")} aria-label="Ir al inicio"><Brand dark={!light}/></button>
      <nav className="mainNav" aria-label="Navegación principal">
        <button className={screen === "home" ? "active" : ""} onClick={() => go("home")}>Inicio</button>
        {isVisible(content,"show_cabana")&&<button className={screen === "cabana" ? "active" : ""} onClick={() => go("cabana")}>La cabaña</button>}
        {isVisible(content,"show_genetics")&&<button className={screen === "genetica" || screen === "animal" ? "active" : ""} onClick={() => go("genetica")}>Genética</button>}
        {isVisible(content,"show_criollos")&&<button className={screen === "criollos" ? "active" : ""} onClick={() => go("criollos")}>Criollos</button>}
        {isVisible(content,"show_news")&&<button className={screen === "actualidad" || screen === "noticia" ? "active" : ""} onClick={() => go("actualidad")}>Actualidad</button>}
        {isVisible(content,"show_gallery")&&<button className={screen === "galeria" ? "active" : ""} onClick={() => go("galeria")}>Galería</button>}
        {isVisible(content,"show_contact")&&<button className={screen === "contacto" ? "active" : ""} onClick={() => go("contacto")}>Contacto</button>}
        {customPages.map(page=><button key={page.id} onClick={()=>window.location.assign(`/p/${page.slug}`)}>{page.menuLabel}</button>)}
      </nav>
      {nextAuction&&<button className="navAction" onClick={()=>go("remate")}>Próximo remate <span>↗</span></button>}
      <button className="mobileMenu" onClick={()=>setMenuOpen(value=>!value)} aria-expanded={menuOpen} aria-label={menuOpen?"Cerrar menú":"Abrir menú"}>{menuOpen?"Cerrar":"Menú"}</button>
      {menuOpen&&<nav className="mobileNavPanel" aria-label="Navegación móvil"><small>Explorar</small><button onClick={()=>navigate("home")}>Inicio <span>01</span></button>{isVisible(content,"show_cabana")&&<button onClick={()=>navigate("cabana")}>La cabaña <span>02</span></button>}{isVisible(content,"show_genetics")&&<button onClick={()=>navigate("genetica")}>Genética <span>03</span></button>}{isVisible(content,"show_criollos")&&<button onClick={()=>navigate("criollos")}>Criollos <span>04</span></button>}{isVisible(content,"show_news")&&<button onClick={()=>navigate("actualidad")}>Actualidad <span>05</span></button>}{isVisible(content,"show_gallery")&&<button onClick={()=>navigate("galeria")}>Galería <span>06</span></button>}{isVisible(content,"show_contact")&&<button onClick={()=>navigate("contacto")}>Contacto <span>07</span></button>}{customPages.map((page,index)=><button key={page.id} onClick={()=>window.location.assign(`/p/${page.slug}`)}>{page.menuLabel} <span>{String(index+8).padStart(2,"0")}</span></button>)}{nextAuction&&<button className="mobileAuction" onClick={()=>navigate("remate")}>Próximo remate <span>↗</span></button>}<p><Brand/></p></nav>}
    </header>
    <ScrollToTop/>
    </>
  );
}

function HomeCarousel({kind,news,gallery,openNews,go}:{kind:"news"|"gallery";news:NewsRecord[];gallery:GalleryMediaRecord[];openNews:(post:NewsRecord)=>void;go:(screen:Screen)=>void}){
  const rail=useRef<HTMLDivElement>(null);
  const move=(direction:number)=>rail.current?.scrollBy({left:direction*Math.min(720,window.innerWidth*.72),behavior:"smooth"});
  const isNews=kind==="news";
  const hasItems=isNews?news.length>0:gallery.length>0;
  if(!hasItems)return null;
  return <section className="homeCarousel"><header><div><p className="sectionNumber">{isNews?"03 — Actualidad":"04 — Galería"}</p><h2>{isNews?<>Lo que está<br/><em>pasando.</em></>:<>La vida<br/><em>en imágenes.</em></>}</h2></div><div className="carouselActions"><button onClick={()=>move(-1)} aria-label="Ver anteriores">←</button><button onClick={()=>move(1)} aria-label="Ver siguientes">→</button></div></header><div className="homeCarouselRail" ref={rail}>{isNews?news.slice(0,8).map(post=><article className="homeNewsCard" key={post.id}><button onClick={()=>openNews(post)}><div style={{backgroundImage:`url(${optimizedImageUrl(post.image,900)})`}}/>
    <small>{post.category}</small><h3>{post.title}</h3><span>Leer noticia →</span></button></article>):gallery.slice(0,10).map(image=><figure className="homeGalleryCard" key={image.id} style={{backgroundImage:`url(${optimizedImageUrl(image.url,1000)})`}}><figcaption>{image.caption||image.category||"La cabaña"}</figcaption></figure>)}</div><button className="textLink carouselMore" onClick={()=>go(isNews?"actualidad":"galeria")}>{isNews?"Ver toda la actualidad":"Ver toda la galería"} <span>↗</span></button></section>;
}

function ScrollToTop(){
  const [visible,setVisible]=useState(false);
  useEffect(()=>{
    const update=()=>setVisible(window.scrollY>650);
    update();
    window.addEventListener("scroll",update,{passive:true});
    return()=>window.removeEventListener("scroll",update);
  },[]);
  return <button type="button" className={`scrollToTop ${visible?"visible":""}`} onClick={()=>window.scrollTo({top:0,behavior:"smooth"})} aria-label="Volver al inicio"><span>↑</span><small>Inicio</small></button>;
}

function Home({ go, animals, auctions, siteImages, news, galleryMedia, openAnimal, openNews }: { go: (s: Screen) => void; animals: AnimalRecord[]; auctions: AuctionRecord[]; siteImages:SiteImageMap; news:NewsRecord[]; galleryMedia:GalleryMediaRecord[]; openAnimal: (animal: AnimalRecord) => void; openNews:(post:NewsRecord)=>void }) {
  const content=useSiteContent();
  const visible = animals.filter(a=>a.status==="published");
  const visibleGenetics=visible.filter(a=>(a.catalogSection||"genetics")==="genetics");
  const visibleCriollos=visible.filter(a=>a.catalogSection==="criollos");
  const selectedForHome=visibleGenetics.filter(a=>a.featured);
  const homeAnimals=(selectedForHome.length?selectedForHome:visibleGenetics).slice(0,2);
  const nextAuction=findNextAuction(auctions);
  const auctionDate=nextAuction?.auctionDate?new Date(`${nextAuction.auctionDate}T12:00:00`):null;
  const auctionPosition=content.home_auction_position||"after_genetics";
  const homeCarousels=(position:string)=><>{isVisible(content,"show_home_news_carousel")&&(content.home_news_carousel_position||"after_auction")===position&&<HomeCarousel kind="news" news={news} gallery={galleryMedia} openNews={openNews} go={go}/>} {isVisible(content,"show_home_gallery_carousel")&&(content.home_gallery_carousel_position||"after_auction")===position&&<HomeCarousel kind="gallery" news={news} gallery={galleryMedia} openNews={openNews} go={go}/>}</>;
  const auctionSection=nextAuction?<section className="auction auctionFeatured" id="remate"><div className="auctionBackdrop" style={{backgroundImage:`url(${optimizedImageUrl(nextAuction.image,1920)})`}}/><div className="auctionShade"/><div className="auctionLead"><p className="eyebrow">Próximo remate</p><h2>{nextAuction.title.split(" ").slice(0,2).join(" ")}<br/><em>{nextAuction.title.split(" ").slice(2).join(" ")}</em></h2><p className="auctionSummary">{nextAuction.description||nextAuction.lots}</p></div><div className="auctionFeaturePanel"><div className="auctionDate"><b>{auctionDate?.getDate()||"—"}</b><span>{auctionDate?.toLocaleDateString("es-AR",{month:"long"})||"Fecha"}<br/>{auctionDate?.getFullYear()||"a confirmar"}</span></div><dl>{nextAuction.auctionTime&&<div><dt>Horario</dt><dd>{nextAuction.auctionTime} hs</dd></div>}{nextAuction.auctioneer&&<div><dt>Rematador</dt><dd>{nextAuction.auctioneer}</dd></div>}{nextAuction.location&&<div><dt>Ubicación</dt><dd>{nextAuction.location}</dd></div>}{nextAuction.lots&&<div><dt>Oferta</dt><dd>{nextAuction.lots}</dd></div>}</dl><div className="auctionActions"><button onClick={()=>go("remate")}>Ver más información <span>→</span></button>{nextAuction.catalogUrl&&<a href={nextAuction.catalogUrl} target="_blank" rel="noreferrer">Ver catálogo <span>↗</span></a>}{nextAuction.streamUrl&&<a href={nextAuction.streamUrl} target="_blank" rel="noreferrer">Transmisión <span>▶</span></a>}</div></div></section>:null;
  return <>
    <section className="hero screenSection" style={{backgroundImage:`url(${optimizedImageUrl(siteImages["home-hero"],1920)})`}}>
      <Header screen="home" go={go}/><div className="heroShade" />
      <div className="heroContent"><p className="eyebrow">{content.brand_tagline}</p><h1>{content.home_hero_line_1}<br/><em>{content.home_hero_line_2}</em></h1><p className="heroCopy">{content.home_hero_copy}</p><div className="heroActions">{isVisible(content,"show_genetics")&&<button className="roundLink" onClick={() => go("genetica")}><span>Explorar<br/>la genética</span><b aria-hidden="true"/></button>}{isVisible(content,"show_criollos")&&visibleCriollos.length>0&&<button className="roundLink" onClick={()=>window.location.assign("/criollos#catalogo-criollos")}><span>Ver Criollos<br/>en venta</span><b aria-hidden="true"/></button>}</div></div>
      <div className="heroIndex"><span>01</span><i/><span>03</span></div>
    </section>
    {isVisible(content,"show_home_intro")&&<section className="intro" id="cabana"><div className="sectionNumber">01 — La cabaña</div><div>{content.home_intro_eyebrow&&<p className="kicker">{content.home_intro_eyebrow}</p>}<h2>{content.home_intro_line_1}{content.home_intro_line_2&&<><br/><em>{content.home_intro_line_2}</em></>}</h2></div><div className="introCopy">{content.home_intro_copy&&<p>{content.home_intro_copy}</p>}{isVisible(content,"show_cabana")&&<button className="textLink" onClick={()=>go("cabana")}>Nuestra historia <span>→</span></button>}</div></section>}
    {isVisible(content,"show_home_establishment")&&<section className="widePhoto" style={{backgroundImage:`url(${optimizedImageUrl(siteImages.establishment,1920)})`}} aria-label="Ganado Angus en el establecimiento"><div className="photoCaption"><span>{content.establishment_name}</span><span>{content.establishment_location}</span></div></section>}
    {homeCarousels("before_genetics")}
    {auctionPosition==="before_genetics"&&auctionSection}
    {isVisible(content,"show_genetics")&&isVisible(content,"show_home_genetics")&&<section className={`geneticsPreview animalCount${homeAnimals.length}`} id="genetica"><div className="previewLead"><p className="sectionNumber">02 — Nuestra genética</p><h2>{content.genetics_line_1}{content.genetics_line_2&&<><br/><em>{content.genetics_line_2}</em></>}</h2><button className="textLink" onClick={() => visibleGenetics.length?window.location.assign("/genetica#catalogo-animales"):go("genetica")}>{visibleGenetics.length?"Ver todos los animales":"Conocer el programa"} <span>↗</span></button></div>{homeAnimals.map((a,i)=><article className={`homeAnimal animal${i+1}`} key={a.id??a.name} onClick={() => openAnimal(a)}><div className="animalImage" style={{backgroundImage:`url(${optimizedImageUrl(a.image,1100)})`}}>{a.sold&&<span className="soldBadge">Vendido</span>}</div><div><span>{a.type}</span><h3>{a.name}</h3><small>RP {a.rp} · {a.breed}</small></div></article>)}</section>}
    {homeCarousels("before_auction")}
    {auctionPosition==="after_genetics"&&auctionSection}
    {homeCarousels("after_auction")}
    {auctionPosition==="after_carousels"&&auctionSection}
    <Footer go={go}/>
  </>;
}

function CabinPage({go,siteImages}:{go:(screen:Screen)=>void;siteImages:SiteImageMap}){
  const content=useSiteContent();
  const showBrand=isVisible(content,"show_cabana_watermark");
  const chapters=[["01",content.history_territory_title,content.history_territory_copy],["02",content.history_origins_title,content.history_origins_copy],["03",content.history_selection_title,content.history_selection_copy],["04",content.history_production_title,content.history_production_copy],["05",content.history_present_title,content.history_present_copy],["06",content.history_sales_title,content.history_sales_copy]].filter(([,title,copy])=>title||copy);
  const values:[[string,string,string,string],[string,string,string,string],[string,string,string,string]]=[["01",content.story_value_1_title,content.story_value_1_copy,"show_story_value_1"],["02",content.story_value_2_title,content.story_value_2_copy,"show_story_value_2"],["03",content.story_value_3_title,content.story_value_3_copy,"show_story_value_3"]];
  const visibleValues=values.filter(([,title,copy,key])=>isVisible(content,key)&&Boolean(title||copy));
  return <div className="editorialPage"><Header screen="cabana" go={go}/><section className="storyHero"><div>{content.cabana_eyebrow&&<p className="sectionNumber">{content.cabana_eyebrow}</p>}<h1>{content.cabana_title_line_1}{content.cabana_title_line_2&&<><br/><em>{content.cabana_title_line_2}</em></>}</h1></div>{content.cabana_lead&&<p>{content.cabana_lead}</p>}</section>{isVisible(content,"show_cabana_establishment_image")&&<section className="storyPhoto" style={{backgroundImage:`url(${optimizedImageUrl(siteImages.establishment,1920)})`}}><span>{content.establishment_name} · {content.establishment_location}</span></section>}<section className="storyBody">{showBrand&&<img className="cabinBrandWatermark" src={siteImages["brand-watermark"]||defaultSiteImages["brand-watermark"]} alt="" aria-hidden="true"/>}<div>{content.cabana_year&&<><small>Desde</small><b>{content.cabana_year}</b></>}</div><article>{content.cabana_story_1&&<p>{content.cabana_story_1}</p>}{content.cabana_story_2&&<p>{content.cabana_story_2}</p>}</article></section>{isVisible(content,"show_history_chapters")&&chapters.length>0&&<section className="historyChapters"><div className="sectionTop"><div><p className="sectionNumber">Historia completa</p><h2>Territorio, selección<br/><em>y producción.</em></h2></div><p>El recorrido de {content.brand_name} desde sus orígenes hasta el trabajo actual.</p></div>{chapters.map(([number,title,copy])=><article key={number}><small>{number}</small><h3>{title}</h3><p>{copy}</p></article>)}</section>}{isVisible(content,"show_story_values")&&visibleValues.length>0&&<section className={`storyValues storyValues${visibleValues.length}`}><p className="sectionNumber">{content.story_values_eyebrow}</p><div>{visibleValues.map(([number,title,copy])=><article key={number}><small>{number}</small>{title&&<h2>{title}</h2>}{copy&&<p>{copy}</p>}</article>)}</div></section>}<Footer go={go}/></div>;
}

function CriollosCatalog({animals,categories,openAnimal}:{animals:AnimalRecord[];categories:CategoryRecord[];openAnimal:(animal:AnimalRecord)=>void}){
  const [filter,setFilter]=useState("Todos");
  const [query,setQuery]=useState("");
  const criollos=animals.filter(animal=>animal.status==="published"&&animal.catalogSection==="criollos");
  const activeCategories=categories.filter(item=>item.active&&item.kind!=="coat"&&item.catalogSection==="criollos"&&criollos.some(animal=>animal.type===item.name));
  const normalized=query.trim().toLocaleLowerCase("es");
  const visible=criollos.filter(animal=>filter==="Todos"||animal.type===filter).filter(animal=>!normalized||[animal.name,animal.rp,animal.breed,animal.type].some(value=>value.toLocaleLowerCase("es").includes(normalized))).sort((a,b)=>Number(b.featured)-Number(a.featured)||a.name.localeCompare(b.name,"es"));
  useEffect(()=>{
    if(window.location.hash!=="#catalogo-criollos")return;
    const frame=window.requestAnimationFrame(()=>document.getElementById("catalogo-criollos")?.scrollIntoView({block:"start"}));
    return()=>window.cancelAnimationFrame(frame);
  },[]);
  if(!criollos.length)return null;
  return <section className="criollosCatalog" id="catalogo-criollos"><section className="listingHead"><p className="sectionNumber">Criollos disponibles</p><div><h1>Criollos<br/><em>en venta.</em></h1><p>Conocé los ejemplares publicados por la cabaña y consultá directamente por cada uno.</p></div><span className="resultCount">{visible.length} ejemplares</span></section>{activeCategories.length>0&&<section className="filterBar" aria-label="Filtros de Criollos">{["Todos",...activeCategories.map(item=>item.name)].map(item=><button key={item} className={filter===item?"selected":""} onClick={()=>setFilter(item)}>{item}</button>)}</section>}<section className="catalogTools"><label><span>⌕</span><input aria-label="Buscar Criollos" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Buscar por nombre, RP, raza o categoría"/></label></section>{visible.length?<section className="animalGrid">{visible.map((animal,index)=><article className="animalCard" key={animal.id??animal.name}><button className="cardImage" style={{backgroundImage:`url(${optimizedImageUrl(animal.image,1000)})`}} onClick={()=>openAnimal(animal)} aria-label={`Ver ficha de ${animal.name}`}><span className="cardIndex">{String(index+1).padStart(2,"0")}</span>{animal.featured&&<span className="featured">Destacado</span>}{animal.sold&&<span className="soldBadge">Vendido</span>}<span className="openCard">↗</span></button><div className="cardMeta"><div><span>{animal.type}</span><h2>{animal.name}</h2></div><p>{animal.sold&&<><b className="soldText">Vendido</b><br/></>}RP {animal.rp}<br/>{animal.breed}</p></div></article>)}</section>:<section className="catalogEmpty"><span>◇</span><h2>No encontramos ejemplares.</h2><p>Probá con otra búsqueda o categoría.</p></section>}</section>;
}

function CriollosPage({go,siteImages,animals,categories,openAnimal}:{go:(screen:Screen)=>void;siteImages:SiteImageMap;animals?:AnimalRecord[];categories?:CategoryRecord[];openAnimal?:(animal:AnimalRecord)=>void}){
  const content=useSiteContent();
  const [loadedAnimals,setLoadedAnimals]=useState<AnimalRecord[]>(animals??[]);
  const [loadedCategories,setLoadedCategories]=useState<CategoryRecord[]>(categories??[]);
  useEffect(()=>{if(animals)return;void fetch("/api/animals").then(response=>response.json()).then(data=>setLoadedAnimals(data.animals??[])).catch(()=>undefined);void fetch("/api/categories").then(response=>response.json()).then(data=>setLoadedCategories(data.categories??[])).catch(()=>undefined)},[animals]);
  const navigateAnimal=openAnimal??((animal)=>{if(animal.id)window.location.assign(`/criollos/${animal.id}-${animal.name.toLowerCase().replace(/[^a-z0-9]+/g,"-")}`)});
  return <div className="editorialPage criollosPage"><Header screen="criollos" go={go}/><section className="storyHero"><div><p className="sectionNumber">Criollos · {content.brand_name}</p><h1>{content.criollos_title_line_1}<br/><em>{content.criollos_title_line_2}</em></h1></div><p>{content.criollos_lead}</p></section>{isVisible(content,"show_criollos_image")&&<section className="storyPhoto criollosPhoto" style={{backgroundImage:`url(${optimizedImageUrl(siteImages["criollos-hero"],1920)})`}}><span>Caballos Criollos · {content.brand_name}</span></section>}<section className="criollosBody">{[content.criollos_story_1,content.criollos_story_2,content.criollos_story_3].filter(Boolean).map((copy,index)=><article key={index}><small>{String(index+1).padStart(2,"0")}</small><p>{copy}</p></article>)}</section><CriollosCatalog animals={loadedAnimals} categories={loadedCategories} openAnimal={navigateAnimal}/><Footer go={go}/></div>;
}

function NewsPage({go,posts,openNews}:{go:(screen:Screen)=>void;posts:NewsRecord[];openNews:(post:NewsRecord)=>void}){
  const content=useSiteContent();
  return <div className="editorialPage"><Header screen="actualidad" go={go}/><section className="pageTitle newsListingTitle"><p className="sectionNumber">Noticias de la cabaña</p><h1>Actualidad<br/><em>{content.brand_name}.</em></h1>{content.actualidad_intro&&<p>{content.actualidad_intro}</p>}</section>{posts.length?<section className="newsGrid">{posts.map((post,index)=><article key={post.id}><button className="newsCardButton" onClick={()=>openNews(post)}><div className="newsImage" style={{backgroundImage:`url(${optimizedImageUrl(post.image,1000)})`}}><span>{String(index+1).padStart(2,"0")}</span></div><div><small>{post.category} · {post.publishedAt?new Date(post.publishedAt).toLocaleDateString("es-AR",{month:"long",year:"numeric"}):""}</small><h2>{post.title}</h2><p>{post.excerpt}</p><b>Leer noticia →</b></div></button></article>)}</section>:<section className="publicGalleryEmpty"><span>◇</span><h2>Todavía no hay noticias publicadas.</h2><p>La sección se completará desde el administrador de la cabaña.</p></section>}<Footer go={go}/></div>;
}

function youtubeEmbedUrl(value?:string|null){
  if(!value)return "";
  const match=value.match(/(?:youtube\.com\/(?:watch\?.*?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/i);
  return match?`https://www.youtube.com/embed/${match[1]}`:"";
}

function animalVideoEmbedUrl(value?:string|null){
  const youtube=youtubeEmbedUrl(value);
  if(youtube)return youtube;
  const vimeo=value?.match(/(?:player\.)?vimeo\.com\/(?:video\/)?(\d+)/i);
  return vimeo?`https://player.vimeo.com/video/${vimeo[1]}`:"";
}

function isDirectVideoUrl(value?:string|null){
  if(!value)return false;
  try{
    return /\.(?:mp4|webm|ogg|mov)$/i.test(new URL(value,"https://video.local").pathname);
  }catch{
    return false;
  }
}

function NewsDetail({go,post,loaded}:{go:(screen:Screen)=>void;post?:NewsRecord;loaded:boolean}){
  if(!loaded)return <div className="editorialPage"><Header screen="noticia" go={go}/><section className="publicGalleryEmpty newsMissing"><span>◇</span><h2>Cargando noticia…</h2></section></div>;
  if(!post)return <div className="editorialPage"><Header screen="noticia" go={go}/><section className="publicGalleryEmpty newsMissing"><span>◇</span><h2>Esta noticia no está disponible.</h2><p>Puede haber sido retirada o todavía no estar publicada.</p><button onClick={()=>go("actualidad")}>Volver a Actualidad →</button></section><Footer go={go}/></div>;
  const date=post.publishedAt?new Date(post.publishedAt).toLocaleDateString("es-AR",{day:"2-digit",month:"long",year:"numeric"}):"";
  const paragraphs=(post.content||post.excerpt||"").split(/\n+/).map(value=>value.trim()).filter(Boolean);
  const inferredVideo=(post.content||"").match(/https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?[^\s]*v=|shorts\/)|youtu\.be\/)[^\s]+/i)?.[0];
  const video=youtubeEmbedUrl(post.videoUrl||inferredVideo);
  return <div className="editorialPage newsDetailPage"><Header screen="noticia" go={go}/><button className="newsBack" onClick={()=>go("actualidad")}>← Volver a Actualidad</button><section className="newsDetailIntro"><small>{post.category} · {date}</small><h1>{post.title}</h1><p>{post.excerpt}</p></section>{video&&<div className="newsVideo"><iframe src={video} title={`Video de ${post.title}`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen/></div>}{post.articleImage&&<figure className="newsArticleImage" style={{backgroundImage:`url(${optimizedImageUrl(post.articleImage,1600)})`}}/>}<section className="newsDetailBody"><aside><span>Actualidad</span><b>{date}</b></aside><article>{paragraphs.map((paragraph,index)=>{const match=paragraph.match(/^(.*?):\s*(https?:\/\/\S+)$/);return match?<p key={index}><span>{match[1]}: </span><a href={match[2]} target="_blank" rel="noreferrer">Abrir original ↗</a></p>:<p key={index}>{paragraph}</p>})}{post.documentUrl&&<a className="newsDocumentLink" href={post.documentUrl} target="_blank" rel="noreferrer" download={post.documentFilename||undefined}>Descargar PDF <span>↓</span></a>}<button onClick={()=>go("contacto")}>Contactar a la cabaña →</button></article></section><Footer go={go}/></div>;
}

function GalleryPage({go,galleryMedia,categories}:{go:(screen:Screen)=>void;galleryMedia:GalleryMediaRecord[];categories:CategoryRecord[]}){
  const content=useSiteContent();
  const [filter,setFilter]=useState("Todas");
  const images=galleryMedia.filter(item=>filter==="Todas"||item.category===filter);
  const activeCategories=categories.filter(item=>item.active&&galleryMedia.some(media=>media.category===item.name));
  return <div className="editorialPage"><Header screen="galeria" go={go}/><section className="pageTitle galleryTitle">{content.gallery_eyebrow&&<p className="sectionNumber">{content.gallery_eyebrow}</p>}<h1>{content.gallery_title_line_1||"Galería"}{content.gallery_title_line_2&&<><br/><em>{content.gallery_title_line_2}</em></>}</h1></section>{galleryMedia.length>0&&<section className="galleryFilters">{["Todas",...activeCategories.map(item=>item.name)].map(item=><button key={item} className={filter===item?"active":""} onClick={()=>setFilter(item)}>{item}</button>)}</section>}{images.length?<section className="publicGallery">{images.map((image,index)=><figure key={image.id} className={`galleryItem galleryItem${index%5}`} style={{backgroundImage:`url(${optimizedImageUrl(image.url,1200)})`}}><figcaption>{String(index+1).padStart(2,"0")} · {image.caption||image.category||"La cabaña"}</figcaption></figure>)}</section>:<section className="publicGalleryEmpty"><span>◇</span><h2>Todavía no hay fotografías publicadas.</h2><p>La galería se completará desde el administrador de la cabaña.</p></section>}<Footer go={go}/></div>;
}

function AuctionPage({go,loaded}:{go:(screen:Screen)=>void;loaded:boolean}){
  const auction=useContext(AuctionContext);
  if(!loaded)return <div className="editorialPage"><Header screen="remate" go={go}/><section className="auctionPageLoading" aria-live="polite"><i/><span>Cargando información del remate…</span></section></div>;
  if(!auction)return <div className="editorialPage"><Header screen="remate" go={go}/><section className="pageTitle"><p className="sectionNumber">Remates</p><h1>Próxima fecha<br/><em>a confirmar.</em></h1><p>Cuando la cabaña publique un nuevo remate, la información aparecerá automáticamente en esta página.</p></section><Footer go={go}/></div>;
  const date=auction.auctionDate?new Date(`${auction.auctionDate}T12:00:00`):null;
  return <div className="auctionPage"><Header screen="remate" go={go}/><section className="auctionPageHero" style={{backgroundImage:`url(${optimizedImageUrl(auction.image,1920)})`}}><div/><section><p className="eyebrow">Próximo remate</p><h1>{auction.title}</h1><p>{auction.description}</p></section></section><section className="auctionPageInfo"><div><small>Fecha</small><b>{date?.toLocaleDateString("es-AR",{day:"2-digit",month:"long",year:"numeric"})||"A confirmar"}</b></div>{auction.auctionTime&&<div><small>Horario</small><b>{auction.auctionTime} hs</b></div>}{auction.auctioneer&&<div><small>Rematador</small><b>{auction.auctioneer}</b></div>}{auction.location&&<div><small>Ubicación</small><b>{auction.location}</b></div>}{auction.lots&&<div><small>Oferta</small><b>{auction.lots}</b></div>}</section><section className="auctionPageActions"><div><p className="sectionNumber">Información del evento</p><h2>Nos encontramos<br/><em>en la cabaña.</em></h2></div><div><p>{auction.description||"Una nueva edición de nuestro remate anual, con la selección genética de la cabaña."}</p><div>{auction.catalogUrl&&<a href={auction.catalogUrl} target="_blank" rel="noreferrer">Ver catálogo ↗</a>}{auction.streamUrl&&<a href={auction.streamUrl} target="_blank" rel="noreferrer">Ver transmisión ▶</a>}<button onClick={()=>go("contacto")}>Consultar disponibilidad →</button></div></div></section><Footer go={go}/></div>;
}

function Genetics({ go, animals, categories, siteImages, openAnimal }: { go: (s: Screen) => void; animals: AnimalRecord[]; categories:CategoryRecord[]; siteImages:SiteImageMap; openAnimal: (animal: AnimalRecord) => void }) {
  const content=useSiteContent();
  useEffect(()=>{
    if(window.location.hash!=="#catalogo-animales")return;
    const frame=window.requestAnimationFrame(()=>document.getElementById("catalogo-animales")?.scrollIntoView({block:"start"}));
    return()=>window.cancelAnimationFrame(frame);
  },[]);
  const [filter,setFilter]=useState("Todos");
  const [query,setQuery]=useState("");
  const [sort,setSort]=useState<"featured"|"name"|"rp">("featured");
  const [page,setPage]=useState(1);
  const pageSize=8;
  const activeCategories=categories.filter(item=>item.active&&item.kind!=="coat"&&(item.catalogSection||"genetics")==="genetics");
  const normalized=query.trim().toLocaleLowerCase("es");
  const filtered=animals.filter(a=>a.status==="published"&&(a.catalogSection||"genetics")==="genetics").filter(a=>filter==="Todos"||a.type.toLowerCase().includes(filter.replace(/s$/i,"").toLowerCase())).filter(a=>!normalized||[a.name,a.rp,a.breed,a.type].some(value=>value.toLocaleLowerCase("es").includes(normalized))).sort((a,b)=>sort==="name"?a.name.localeCompare(b.name,"es"):sort==="rp"?a.rp.localeCompare(b.rp,"es",{numeric:true}):Number(b.featured)-Number(a.featured)||a.name.localeCompare(b.name,"es"));
  const pages=Math.max(1,Math.ceil(filtered.length/pageSize));
  const currentPage=Math.min(page,pages);
  const visible=filtered.slice((currentPage-1)*pageSize,currentPage*pageSize);
  const stats=[[content.stat_1_value,content.stat_1_label],[content.stat_2_value,content.stat_2_label],[content.stat_3_value,content.stat_3_label]].filter(([value])=>value);
  const showResultsImage=isVisible(content,"show_genetics_results_image");
  return <div className="innerPage"><Header screen="genetica" go={go}/>{isVisible(content,"show_genetics_catalog")&&<section className="availableAnimalsBanner"><div><p className="eyebrow">Catálogo actualizado</p><h1>Ver animales<br/><em>disponibles.</em></h1><p>{filtered.length?`${filtered.length} ejemplares publicados con información, imágenes y pedigree.`:"Las nuevas fichas se publicarán próximamente."}</p></div><button onClick={()=>document.getElementById("catalogo-animales")?.scrollIntoView({behavior:"smooth",block:"start"})}>Explorar catálogo <span>↓</span></button></section>}{isVisible(content,"show_genetics_program")&&<>{isVisible(content,"show_genetics_hero")&&<section className="geneticsProgramHero" style={{backgroundImage:`url(${optimizedImageUrl(siteImages["genetics-hero"],1920)})`}}><div/><section><p className="eyebrow">Mejoramiento genético</p><h1>Datos, presión de selección<br/><em>y adaptación.</em></h1></section></section>}{isVisible(content,"show_genetics_intro")&&<section className="geneticsProgram"><div><p className="sectionNumber">Programa genético</p><h2>{content.genetics_title}</h2></div>{content.genetics_copy&&<p>{content.genetics_copy}</p>}</section>}{isVisible(content,"show_genetics_stats")&&stats.length>0&&<section className={`geneticsStats geneticsStats${stats.length}`}>{stats.map(([value,label],index)=><article key={`${label}-${index}`}><b>{value}</b>{label&&<span>{label}</span>}</article>)}</section>}{isVisible(content,"show_genetics_results")&&Boolean(content.genetics_cycle_title||content.genetics_cycle_copy)&&<section className={`geneticsCycle ${showResultsImage?"":"noImage"}`}>{showResultsImage&&<div style={{backgroundImage:`url(${optimizedImageUrl(siteImages["genetics-cycle"],1600)})`}}/>}<article><p className="sectionNumber">Resultados</p>{content.genetics_cycle_title&&<h2>{content.genetics_cycle_title}</h2>}{content.genetics_cycle_copy&&<p>{content.genetics_cycle_copy}</p>}</article></section>}</>}{isVisible(content,"show_genetics_catalog")&&<><section className="listingHead" id="catalogo-animales">{content.genetics_catalog_eyebrow&&<p className="sectionNumber">{content.genetics_catalog_eyebrow}</p>}<div><h1>{content.genetics_catalog_title_line_1}{content.genetics_catalog_title_line_2&&<><br/><em>{content.genetics_catalog_title_line_2}</em></>}</h1>{content.genetics_catalog_copy&&<p>{content.genetics_catalog_copy}</p>}</div><span className="resultCount">{filtered.length} ejemplares</span></section><section className="filterBar" aria-label="Filtros de animales">{["Todos",...activeCategories.map(item=>item.name)].map(f=><button className={filter===f?"selected":""} onClick={()=>{setFilter(f);setPage(1)}} key={f}>{f}</button>)}</section><section className="catalogTools"><label><span>⌕</span><input aria-label="Buscar en genética" value={query} onChange={e=>{setQuery(e.target.value);setPage(1)}} placeholder="Buscar por nombre, RP, raza o categoría"/></label><select aria-label="Ordenar animales" value={sort} onChange={e=>{setSort(e.target.value as "featured"|"name"|"rp");setPage(1)}}><option value="featured">Destacados primero</option><option value="name">Nombre A–Z</option><option value="rp">RP ascendente</option></select></section>{visible.length?<section className="animalGrid">{visible.map((a,i)=><article className="animalCard" key={a.id??a.name}><button className="cardImage" style={{backgroundImage:`url(${optimizedImageUrl(a.image,1000)})`}} onClick={()=>openAnimal(a)} aria-label={`Ver ficha de ${a.name}`}><span className="cardIndex">{String((currentPage-1)*pageSize+i+1).padStart(2,"0")}</span>{a.featured&&<span className="featured">Inicio</span>}{a.sold&&<span className="soldBadge">Vendido</span>}<span className="openCard">↗</span></button><div className="cardMeta"><div><span>{a.type}</span><h2>{a.name}</h2></div><p>{a.sold&&<><b className="soldText">Vendido</b><br/></>}RP {a.rp}<br/>{a.breed}</p></div></article>)}</section>:<section className="catalogEmpty"><span>◇</span><h2>Todavía no hay animales publicados.</h2><p>El programa genético ya está disponible; las fichas se cargarán desde el administrador.</p></section>} {filtered.length>pageSize&&<div className="pagination"><button disabled={currentPage===1} onClick={()=>setPage(value=>Math.max(1,value-1))}>←</button><span>{currentPage} / {pages}</span><button disabled={currentPage===pages} onClick={()=>setPage(value=>Math.min(pages,value+1))}>→</button></div>}</>}<Footer go={go}/></div>;
}

function Pedigree({animal}:{animal:AnimalRecord}) {
  const find=(relation:string)=>animal.pedigree?.find(member=>member.relation===relation);
  const member=(relation:string,label:string)=><div><small>{label}</small><b>{find(relation)?.name||"Sin cargar"}</b>{find(relation)?.registration&&<span>{find(relation)?.registration}</span>}</div>;
  return <div className="pedigree" aria-label="Pedigree de tres generaciones"><div className="pedRoot"><small>Ejemplar</small><b>{animal.name}</b><span>{animal.registration||`RP ${animal.rp}`}</span></div><div className="pedCol">{member("sire","Padre")}{member("dam","Madre")}</div><div className="pedCol third">{member("paternal_grandsire","Abuelo paterno")}{member("paternal_granddam","Abuela paterna")}{member("maternal_grandsire","Abuelo materno")}{member("maternal_granddam","Abuela materna")}</div></div>;
}

function AnimalDetail({ go, animal, siteImages, loaded=true }: { go: (s: Screen) => void; animal?: AnimalRecord; siteImages:SiteImageMap; loaded?:boolean }) {
  const content=useSiteContent();
  if(!loaded)return <div className="editorialPage"><Header screen="genetica" go={go}/><section className="publicGalleryEmpty animalMissing"><span>◇</span><h2>Cargando ficha…</h2></section></div>;
  if(!animal)return <div className="editorialPage"><Header screen="genetica" go={go}/><section className="publicGalleryEmpty animalMissing"><span>◇</span><h2>Esta ficha no está disponible.</h2><p>El animal puede estar en borrador o haber sido retirado del catálogo.</p><button onClick={()=>go("genetica")}>Volver a Genética →</button></section><Footer go={go}/></div>;
  const parts=animal.name.split(" "); const first=parts.shift()??animal.name; const rest=parts.join(" ");
  const uploadedImages=animal.media?.filter(item=>item.kind==="image"&&item.url).map(item=>item.url!)??[];
  const video=animal.media?.find(item=>item.kind==="video"&&item.url)?.url||"";
  const videoEmbed=animalVideoEmbedUrl(video);
  const directVideo=isDirectVideoUrl(video);
  const visibleGallery=uploadedImages.slice(0,3);
  const imageClasses=["galleryMain","galleryTop","galleryBottom"];
  const showBrand=isVisible(content,"show_animal_watermark");
  const inquiryUrl=animalInquiryUrl(content.contact_whatsapp||"",content.contact_phone||"",animal);
  const geneticsProviderUrl=safeExternalUrl(animal.geneticsProviderUrl);
  const catalogUrl=animal.catalogSection==="criollos"?"/criollos#catalogo-criollos":"/genetica#catalogo-animales";
  const horse=animal.catalogSection==="criollos";
  const heroFacts=[[animal.rpLabel??"RP",animal.rp],[animal.birthDateLabel??"Nacimiento",animal.birthDate||"Sin dato"],[animal.coatLabel??"Pelaje",animal.coat||"Sin dato"]].filter(([label])=>label);
  const dataFacts=[[animal.registrationLabel??"Registro",animal.registration||"Sin dato"],[animal.birthWeightLabel??(horse?"Sexo":"Peso al nacer"),animal.birthWeight||"—"],[animal.weaningWeightLabel??(horse?"Categoría":"Peso al destete"),animal.weaningWeight||"—"],[animal.scrotalCircumferenceLabel??(horse?"Marcha":"Circ. escrotal"),animal.scrotalCircumference||"—"],[animal.frameLabel??(horse?"Estado":"Frame"),animal.frame||"—"]].filter(([label])=>label);

  return <div className="detailPage"><section className="detailHero" style={{backgroundImage:`url(${optimizedImageUrl(animal.image,1920)})`}}><Header screen="animal" go={go}/><div className="detailOverlay"/><button className="backButton" onClick={()=>window.location.assign(catalogUrl)}>← Volver al catálogo</button><div className="detailTitle">{animal.sold&&<span className="soldBadge soldBadgeDetail">Vendido</span>}<p className="eyebrow">{animal.type} · {animal.breed}</p><h1>{first}<br/><em>{rest}</em></h1><div className="heroFacts">{heroFacts.map(([label,value])=><span key={label}><small>{label}</small>{value}</span>)}</div></div><div className="imageCounter">01 <i/> 04</div></section><section className="detailIntro"><div><p className="sectionNumber">01 — El ejemplar</p>{(animal.introTitle||animal.introEmphasis)&&<h2>{animal.introTitle}{animal.introTitle&&animal.introEmphasis&&<br/>}{animal.introEmphasis&&<em>{animal.introEmphasis}</em>}</h2>}</div><div className="description">{animal.description&&<p>{animal.description}</p>}{animal.introSecondary&&<p>{animal.introSecondary}</p>}{inquiryUrl&&<a className="animalInquiry" href={inquiryUrl} target="_blank" rel="noreferrer">{animal.sold?"Consultar por animales similares":"Consultar por este animal"} <span>↗</span></a>}</div>
{showBrand&&<div className="animalBrandWatermark" aria-hidden="true"><img src={siteImages["brand-watermark"]||defaultSiteImages["brand-watermark"]} alt=""/></div>}
{geneticsProviderUrl&&<aside className="geneticsProvider"><div><p className="sectionNumber">Disponibilidad genética</p><h2>Semen y embriones<br/><em>disponibles.</em></h2></div><div className="geneticsProviderInfo"><span>Centro responsable</span><strong>{animal.geneticsProviderName||"Centro de genética"}</strong><p>Consultá disponibilidad, condiciones comerciales y forma de compra directamente con el centro.</p><a href={geneticsProviderUrl} target="_blank" rel="noopener noreferrer">Ver disponibilidad en el centro <span>↗</span></a></div></aside>}
</section>{dataFacts.length>0&&<section className={`dataBand dataBand${dataFacts.length}`}>{dataFacts.map(([label,value])=><div key={label}><small>{label}</small><b>{value}</b></div>)}</section>}<section className="pedigreeSection"><div className="sectionTop"><div><p className="sectionNumber">02 — Linaje</p>{(animal.pedigreeTitle||animal.pedigreeEmphasis)&&<h2>{animal.pedigreeTitle}{animal.pedigreeTitle&&animal.pedigreeEmphasis&&<br/>}{animal.pedigreeEmphasis&&<em>{animal.pedigreeEmphasis}</em>}</h2>}</div>{animal.pedigreeDescription&&<p>{animal.pedigreeDescription}</p>}</div><Pedigree animal={animal}/></section>{Boolean(animal.deps?.length)&&<section className="depsSection"><div className="depsIntro"><p className="sectionNumber">03 — {horse?"Información adicional":"Información genética"}</p><h2>Datos que<br/><em>acompañan la mirada.</em></h2><p>{horse?"Características adicionales configuradas para este ejemplar.":"Valores expresados como DEPs. Cada cabaña puede configurar las características que publica."}</p></div><div className="depsTable"><div className="depsHeader"><span>Característica</span><span>{horse?"Valor":"DEP"}</span><span>{horse?"Detalle":"Prec."}</span><span>{horse?"Referencia":"Percentil"}</span></div>{animal.deps!.map((d,i)=><div className="depRow" key={`${d.label}-${i}`}><b>{d.label}</b><span>{d.value}</span><span>{d.precision||"—"}</span><span className="percent"><i style={{width:`${Math.max(18,85-i*9)}%`}}/>{d.percentile||"—"}</span></div>)}</div></section>}{Boolean(uploadedImages.length||video)&&<section className="gallerySection"><div className="sectionTop"><div><p className="sectionNumber">04 — Galería</p><h2>{video?<>Ver al animal<br/><em>en movimiento.</em></>:<>Galería<br/><em>del animal.</em></>}</h2></div></div>{video&&<div className="animalVideoPlayer">{videoEmbed?<iframe src={videoEmbed} title={`Video de ${animal.name}`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen/>:directVideo?<video src={video} controls playsInline preload="metadata"/>:<a href={video} target="_blank" rel="noreferrer"><span>▶</span> Abrir video</a>}</div>}{visibleGallery.length>0&&<div className={`galleryGrid galleryCount${visibleGallery.length}`}>{visibleGallery.map((image,index)=><div key={`${image}-${index}`} className={`galleryImage ${imageClasses[index]}`} style={{backgroundImage:`url(${image})`}}>{index===visibleGallery.length-1&&<span>{String(visibleGallery.length).padStart(2,"0")} / {String(uploadedImages.length).padStart(2,"0")}</span>}</div>)}</div>}</section>}<Footer go={go}/></div>;
}

function ContactPage({go,siteImages}:{go:(screen:Screen)=>void;siteImages:SiteImageMap}) {
  const content=useSiteContent();
  const [busy,setBusy]=useState(false);
  const [sent,setSent]=useState(false);
  const [error,setError]=useState("");
  const socials=[["Instagram",content.social_instagram],["Facebook",content.social_facebook],["YouTube",content.social_youtube]].filter((item):item is [string,string]=>Boolean(item[1]?.trim()));
  const submit=async(form:HTMLFormElement)=>{setBusy(true);setError("");const data=new FormData(form);try{const response=await fetch("/api/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:data.get("name"),email:data.get("email"),phone:data.get("phone"),subject:data.get("subject"),message:data.get("message")})});const result=await response.json() as {error?:string};if(!response.ok)throw new Error(result.error||"No se pudo enviar la consulta.");form.reset();setSent(true)}catch(cause){setError(cause instanceof Error?cause.message:"No se pudo enviar la consulta.")}finally{setBusy(false)}};
  const showContactImage=isVisible(content,"show_contact_image");
  return <div className="contactPage"><Header screen="contacto" go={go}/><section className="contactHero"><div><p className="sectionNumber">Contacto · {content.brand_name}</p><h1>{content.contact_line_1}{content.contact_line_2&&<><br/><em>{content.contact_line_2}</em></>}</h1>{content.contact_intro&&<p>{content.contact_intro}</p>}</div><div className="contactDirect"><span>Contacto directo</span>{content.contact_email&&<a href={`mailto:${content.contact_email}`}>{content.contact_email} ↗</a>}{content.contact_whatsapp&&<a className="contactWhatsapp" href={content.contact_whatsapp} target="_blank" rel="noreferrer"><span>Contactar por WhatsApp</span><b>{content.contact_phone||"Abrir conversación"}</b><i>↗</i></a>}{socials.length>0&&<div className="contactSocials">{socials.map(([label,url])=><a key={label} href={url} target="_blank" rel="noreferrer">{label} ↗</a>)}</div>}{content.contact_location&&<small>{content.contact_location}<br/>Visitas con coordinación previa</small>}</div></section><section className={`contactBody ${showContactImage?"":"noImage"}`}>{showContactImage&&<div className="contactPhoto" style={{backgroundImage:`url(${optimizedImageUrl(siteImages.contact,1400)})`}}/>}<form className="contactForm" onSubmit={e=>{e.preventDefault();void submit(e.currentTarget)}}><div><p className="sectionNumber">Enviar una consulta</p><h2>¿En qué podemos<br/><em>acompañarte?</em></h2></div>{sent?<div className="contactSuccess"><span>✓</span><h3>Consulta recibida.</h3><p>Gracias por escribirnos. El equipo de la cabaña se pondrá en contacto.</p><button type="button" onClick={()=>setSent(false)}>Enviar otra consulta</button></div>:<><div className="contactFields"><label>Nombre y apellido<input name="name" required/></label><label>Email<input name="email" type="email" required/></label><label>Teléfono<input name="phone" type="tel"/></label><label>Motivo<select name="subject"><option>Consulta genética</option><option>Disponibilidad de animales</option><option>Caballos Criollos</option><option>Visita al establecimiento</option><option>Otro</option></select></label><label className="fullField">Mensaje<textarea name="message" required rows={6}/></label></div>{error&&<p className="contactError">{error}</p>}<button className="sendMessage" disabled={busy}>{busy?"Enviando...":"Enviar consulta →"}</button></>}</form></section>{content.contact_map&&<section className="contactMap"><div><p className="sectionNumber">Cómo llegar</p><h2>Ubicación</h2><p>{content.contact_location}</p></div><iframe title={`Mapa de ${content.brand_name}`} src={content.contact_map} loading="lazy" referrerPolicy="no-referrer-when-downgrade"/></section>}<Footer go={go}/></div>;
}

function CustomPublicPage({go,slug,siteImages}:{go:(screen:Screen)=>void;slug?:string;siteImages:SiteImageMap}){
  const content=useSiteContent();
  const page=customPagesFromContent(content).find(item=>item.slug===slug&&item.published);
  if(!page)return <div className="editorialPage"><Header screen="pagina" go={go}/><section className="publicGalleryEmpty customPageMissing"><span>◇</span><h2>Esta página no está disponible.</h2><button onClick={()=>go("home")}>Volver al inicio →</button></section><Footer go={go}/></div>;
  const image=siteImages[`page-${page.id}`]||page.heroImage||siteImages.establishment;
  const paragraphs=page.body.split(/\n+/).map(item=>item.trim()).filter(Boolean);
  return <div className={`editorialPage customPublicPage template-${page.template}`}><Header screen="pagina" go={go}/>{page.template==="photographic"?<><section className="customPhotoHero" style={{backgroundImage:`url(${optimizedImageUrl(image,1920)})`}}><div/><article><p className="eyebrow">{page.eyebrow}</p><h1>{page.title}</h1><p>{page.lead}</p></article></section><section className="customPublicBody">{paragraphs.map((paragraph,index)=><p key={index}>{paragraph}</p>)}</section></>:page.template==="split"?<section className="customSplit"><div style={{backgroundImage:`url(${optimizedImageUrl(image,1920)})`}}/><article><p className="sectionNumber">{page.eyebrow}</p><h1>{page.title}</h1><p className="customLead">{page.lead}</p>{paragraphs.map((paragraph,index)=><p key={index}>{paragraph}</p>)}</article></section>:<><section className="pageTitle customEditorialTitle"><div><p className="sectionNumber">{page.eyebrow}</p><h1>{page.title}</h1></div><p>{page.lead}</p></section><div className="customEditorialPhoto" style={{backgroundImage:`url(${optimizedImageUrl(image,1920)})`}}/><section className="customPublicBody">{paragraphs.map((paragraph,index)=><p key={index}>{paragraph}</p>)}</section></>}<Footer go={go}/></div>;
}

function AdminLoading(){const content=useSiteContent();const images=useContext(SiteImageContext);const hasIdentity=Boolean(content.brand_name&&content.brand_name!=="Nombre de la cabaña"&&images["brand-logo"]&&!images["brand-logo"].endsWith("/template-brand.svg"));return <div className="adminLoading" role="status" aria-live="polite"><div>{hasIdentity&&<Brand dark/>}<i/><p>Cargando administrador…</p></div></div>}
function PublicLoading({failed=false}:{failed?:boolean}){return <div className={`publicLoading ${failed?"failed":""}`} role="status" aria-live="polite">{failed?<><span>No pudimos cargar el sitio.</span><button onClick={()=>window.location.reload()}>Volver a intentar</button></>:<><i/><span>Cargando sitio…</span></>}</div>}

const Admin=dynamic(()=>import("./admin-panel"),{loading:()=> <AdminLoading/>});


function Footer({ go }: { go: (s: Screen) => void }) {const content=useSiteContent();const customPages=customPagesFromContent(content).filter(page=>page.published);const socials=[["WhatsApp",content.contact_whatsapp],["Instagram",content.social_instagram],["Facebook",content.social_facebook],["YouTube",content.social_youtube]].filter((item):item is [string,string]=>Boolean(item[1]?.trim()));return <footer><Brand/><div><p>Conocé nuestra genética<br/>y nuestro trabajo.</p>{content.contact_email&&<a href={`mailto:${content.contact_email}`}>{content.contact_email} ↗</a>}{socials.length>0&&<div className="footerSocials">{socials.map(([label,url])=><a key={label} href={url} target="_blank" rel="noreferrer">{label} ↗</a>)}</div>}</div><div className="footerLinks">{isVisible(content,"show_cabana")&&<button onClick={()=>go("cabana")}>La cabaña</button>}{isVisible(content,"show_genetics")&&<button onClick={()=>go("genetica")}>Genética</button>}{isVisible(content,"show_criollos")&&<button onClick={()=>go("criollos")}>Criollos</button>}{isVisible(content,"show_news")&&<button onClick={()=>go("actualidad")}>Actualidad</button>}{isVisible(content,"show_gallery")&&<button onClick={()=>go("galeria")}>Galería</button>}{isVisible(content,"show_contact")&&<button onClick={()=>go("contacto")}>Contacto</button>}{customPages.map(page=><button key={page.id} onClick={()=>window.location.assign(`/p/${page.slug}`)}>{page.menuLabel}</button>)}</div><small>© 2026 {content.brand_name}</small></footer>}

export function SiteApplication({initialScreen="home",initialNewsSlug,initialAnimalId,initialPageSlug,initialPreview=false}:{initialScreen?:Screen;initialNewsSlug?:string;initialAnimalId?:number;initialPageSlug?:string;initialPreview?:boolean}) {
  const [screen,setScreen]=useState<Screen>(initialScreen);
  const [animals,setAnimals]=useState<AnimalRecord[]>([]);
  const [auctions,setAuctions]=useState<AuctionRecord[]>([]);
  const [categories,setCategories]=useState<CategoryRecord[]>([]);
  const [galleryCategories,setGalleryCategories]=useState<CategoryRecord[]>([]);
  const [galleryMedia,setGalleryMedia]=useState<GalleryMediaRecord[]>([]);
  const [news,setNews]=useState<NewsRecord[]>([]);
  const [newsLoaded,setNewsLoaded]=useState(false);
  const [auctionsLoaded,setAuctionsLoaded]=useState(false);
  const [siteImages,setSiteImages]=useState<SiteImageMap>(defaultSiteImages);
  const [content,setContent]=useState<SiteContentMap>(defaultContent);
  const [publicationPending,setPublicationPending]=useState(false);
  const [criticalDataFailed,setCriticalDataFailed]=useState(false);
  const [selectedAnimal,setSelectedAnimal]=useState<AnimalRecord|undefined>(undefined);
  const [animalsLoaded,setAnimalsLoaded]=useState(false);
  const [selectedNews,setSelectedNews]=useState<NewsRecord|undefined>(undefined);
  const [initialDataLoaded,setInitialDataLoaded]=useState(false);
  const nextAuction=findNextAuction(auctions);
  const draftMode=initialScreen==="admin"||initialPreview;
  useEffect(()=>{
    if(initialScreen==="admin"){delete document.body.dataset.palette;delete document.body.dataset.typography}
    else{document.body.dataset.palette=content.color_palette||"tierra";document.body.dataset.typography=content.typography_style||"editorial"}
    return()=>{delete document.body.dataset.palette;delete document.body.dataset.typography};
  },[content.color_palette,content.typography_style,initialScreen]);
  useEffect(()=>{if(initialScreen!=="admin")return;const cached=readCachedSiteIdentity();if(cached.brandName)setContent(current=>({...current,brand_name:cached.brandName!}));if(cached.logo)setSiteImages(current=>({...current,"brand-logo":cached.logo!}))},[initialScreen]);
  useEffect(()=>{if(initialScreen==="admin"||initialPreview)return;const cached=readCachedPublicSnapshot();const cachedImages=cached.images;if(cached.content)setContent(current=>({...current,...cached.content}));if(cachedImages?.length)setSiteImages(current=>({...current,...Object.fromEntries(cachedImages.map(image=>[image.imageKey,image.url]))}));if(cached.content&&cachedImages?.length)setInitialDataLoaded(true)},[initialScreen,initialPreview]);
  useEffect(()=>{
    let active=true;
    const backendConfigured=Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL&&process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
    if(!backendConfigured&&initialScreen!=="admin"){
      setAnimalsLoaded(true);
      setAuctionsLoaded(true);
      setNewsLoaded(true);
      setInitialDataLoaded(true);
      setCriticalDataFailed(false);
      return()=>{active=false};
    }
    if(initialScreen==="admin")setInitialDataLoaded(false);
    setCriticalDataFailed(false);
    const animalsUrl=initialScreen==="admin"?"/api/animals?all=1":"/api/animals";
    const adminSuffix=initialScreen==="admin"?"?all=1":"";
    const bootstrapRequest=initialScreen!=="admin"&&!draftMode?fetch("/api/bootstrap").then(async response=>{if(!response.ok)throw new Error("No se pudo cargar el sitio.");const data=await response.json() as {content?:SiteContentMap;images?:SiteImageRecord[]};if(data.content){setContent(current=>({...current,...data.content}));if(data.content.brand_name)cacheSiteIdentity({brandName:data.content.brand_name})}if(data.images?.length){setSiteImages(current=>({...current,...Object.fromEntries(data.images!.map(image=>[image.imageKey,image.url]))}));const logo=data.images.find(image=>image.imageKey==="brand-logo");if(logo)cacheSiteIdentity({logo:logo.url})}cachePublicSnapshot(data.content,data.images)}).catch(()=>setCriticalDataFailed(true)):null;
    const imageRequest=bootstrapRequest??fetch(draftMode?"/api/site-images?draft=1":"/api/site-images").then(async response=>{if(!response.ok)throw new Error("No se pudieron cargar las imágenes del sitio.");const data=await response.json() as {images?:SiteImageRecord[];hasDraft?:boolean};if(data.images?.length){setSiteImages(current=>({...current,...Object.fromEntries(data.images!.map(image=>[image.imageKey,image.url]))}));const logo=data.images.find(image=>image.imageKey==="brand-logo");if(logo)cacheSiteIdentity({logo:logo.url})}if(data.hasDraft)setPublicationPending(true)}).catch(()=>setCriticalDataFailed(true));
    const contentRequest=bootstrapRequest??fetch(draftMode?"/api/site-content?draft=1":"/api/site-content").then(async response=>{if(!response.ok)throw new Error("No se pudo cargar la identidad del sitio.");const data=await response.json() as {content?:SiteContentMap;hasDraft?:boolean};if(data.content){setContent(current=>({...current,...data.content}));if(data.content.brand_name)cacheSiteIdentity({brandName:data.content.brand_name})}if(data.hasDraft)setPublicationPending(true)}).catch(()=>setCriticalDataFailed(true));
    const secondaryRequests=[
      fetch(animalsUrl).then(async response=>{if(!response.ok)return;const data=await response.json() as {animals?:AnimalRecord[]};const records=data.animals??[];setAnimals(records);setSelectedAnimal(initialAnimalId?records.find(animal=>animal.id===initialAnimalId):records[0])}).catch(()=>undefined).finally(()=>setAnimalsLoaded(true)),
      fetch(`/api/auctions${adminSuffix}`).then(async response=>{if(!response.ok)return;const data=await response.json() as {auctions?:AuctionRecord[]};setAuctions(data.auctions??[])}).catch(()=>undefined).finally(()=>setAuctionsLoaded(true)),
      fetch(`/api/categories${adminSuffix}`).then(async response=>{if(!response.ok)return;const data=await response.json() as {categories?:CategoryRecord[]};setCategories(data.categories??[])}).catch(()=>undefined),
      fetch(`/api/gallery-categories${adminSuffix}`).then(async response=>{if(!response.ok)return;const data=await response.json() as {categories?:CategoryRecord[]};setGalleryCategories(data.categories??[])}).catch(()=>undefined),
      fetch(`/api/gallery${adminSuffix}`).then(async response=>{if(!response.ok)return;const data=await response.json() as {media?:GalleryMediaRecord[]};setGalleryMedia(data.media??[])}).catch(()=>undefined),
      fetch(`/api/news${adminSuffix}`).then(async response=>{if(!response.ok)return;const data=await response.json() as {posts?:NewsRecord[]};const posts=data.posts??[];setNews(posts);if(initialNewsSlug)setSelectedNews(posts.find(post=>post.slug===initialNewsSlug))}).catch(()=>undefined).finally(()=>setNewsLoaded(true))
    ];
    const readyRequests=initialScreen==="admin"
      ?[imageRequest,contentRequest,...secondaryRequests]
      :[imageRequest,contentRequest];
    void Promise.all(readyRequests).finally(()=>{if(active)setInitialDataLoaded(true)});
    return()=>{active=false};
  },[initialScreen,initialAnimalId,initialNewsSlug,initialPreview,draftMode]);
  useEffect(()=>{
    if(initialScreen==="admin"||initialPreview||!initialDataLoaded)return;
    const visibilityKey=pageVisibilityKeys[screen];
    if(visibilityKey&&!isVisible(content,visibilityKey))window.location.replace("/");
  },[content,initialDataLoaded,initialPreview,initialScreen,screen]);
  const go=(s:Screen)=>{
    if(s==="admin"&&initialScreen!=="admin"){window.location.assign("/admin");return}
    if(initialScreen==="admin"&&s!=="admin"){window.location.assign("/");return}
    const paths:Partial<Record<Screen,string>>={home:"/",cabana:"/la-cabana",genetica:"/genetica",criollos:"/criollos",actualidad:"/actualidad",galeria:"/galeria",remate:"/proximo-remate",contacto:"/contacto"};
    const target=paths[s];
    if(target&&window.location.pathname!==target){window.location.assign(target);return}
    setScreen(s);window.scrollTo({top:0,behavior:"smooth"});
  };
  const openAnimal=(animal:AnimalRecord)=>{if(animal.id){const slug=animal.name.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");const catalog=animal.catalogSection==="criollos"?"criollos":"genetica";window.location.assign(`/${catalog}/${animal.id}-${slug}`);return}setSelectedAnimal(animal);go("animal")};
  const openNews=(post:NewsRecord)=>{window.location.assign(`/actualidad/${encodeURIComponent(post.slug)}`)};
  const saveAnimal=async(animal:AnimalRecord)=>{const response=await fetch("/api/animals",{method:animal.id?"PATCH":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(animal)});const data=await response.json() as {animal?:AnimalRecord;error?:string};if(!response.ok||!data.animal)throw new Error(data.error||"No se pudo guardar la ficha.");setAnimals(current=>animal.id?current.map(item=>item.id===data.animal!.id?data.animal!:item):[data.animal!,...current]);setSelectedAnimal(data.animal);};
  const deleteAnimal=async(id:number)=>{const response=await fetch(`/api/animals?id=${id}`,{method:"DELETE"});if(!response.ok)throw new Error("No se pudo eliminar la ficha.");setAnimals(current=>current.filter(item=>item.id!==id));};
  const saveAuction=async(auction:AuctionRecord)=>{const response=await fetch("/api/auctions",{method:auction.id?"PATCH":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(auction)});const data=await readApiJson<{auction?:AuctionRecord;error?:string}>(response);if(!response.ok||!data.auction)throw new Error(data.error||"No se pudo guardar el remate.");setAuctions(current=>auction.id?current.map(item=>item.id===data.auction!.id?data.auction!:item):[...current,data.auction!]);};
  const deleteAuction=async(id:number)=>{const response=await fetch(`/api/auctions?id=${id}`,{method:"DELETE"});if(!response.ok)throw new Error("No se pudo eliminar el remate.");setAuctions(current=>current.filter(item=>item.id!==id));};
  const updateSiteImage=(image:SiteImageRecord)=>{setSiteImages(current=>({...current,[image.imageKey]:image.url}));if(image.imageKey==="brand-logo")cacheSiteIdentity({logo:image.url});setPublicationPending(true)};
  const updateContent=(values:SiteContentMap)=>{setContent(current=>({...current,...values}));if(values.brand_name)cacheSiteIdentity({brandName:values.brand_name});setPublicationPending(true)};
  const publishSite=async()=>{const response=await fetch("/api/publication",{method:"POST"});const data=await response.json() as {publication?:PublicationRecord;content?:SiteContentMap;images?:SiteImageRecord[];error?:string};if(!response.ok||!data.publication)throw new Error(data.error||"No se pudieron publicar los cambios.");if(data.content)setContent(current=>({...current,...data.content}));if(data.images)setSiteImages(current=>({...current,...Object.fromEntries(data.images!.map(image=>[image.imageKey,image.url]))}));setPublicationPending(false);return data.publication};
  const restorePublication=async(publicationId:number)=>{const response=await fetch("/api/publication",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({publicationId})});const data=await response.json() as {content?:SiteContentMap;images?:SiteImageRecord[];error?:string};if(!response.ok||!data.content)throw new Error(data.error||"No se pudo restaurar la versión.");setContent(current=>({...current,...data.content}));if(data.images)setSiteImages(current=>({...current,...Object.fromEntries(data.images!.map(image=>[image.imageKey,image.url]))}));setPublicationPending(false)};
  if(initialScreen!=="admin"&&(!initialDataLoaded||criticalDataFailed))return <PublicLoading failed={criticalDataFailed}/>;
  return <ContentContext.Provider value={content}><SiteImageContext.Provider value={siteImages}><AuctionContext.Provider value={nextAuction}>{initialPreview&&<div className="previewBanner"><span>Vista previa · los cambios todavía no están publicados</span><button onClick={()=>window.location.assign("/admin")}>Volver al administrador</button></div>}<main className={`titleSize-${content.font_size_titles||"normal"} bodySize-${content.font_size_body||"normal"}`}>{screen==="home"&&<Home go={go} animals={animals} auctions={auctions} siteImages={siteImages} news={news} galleryMedia={galleryMedia} openAnimal={openAnimal} openNews={openNews}/>} {screen==="cabana"&&<CabinPage go={go} siteImages={siteImages}/>} {screen==="genetica"&&<Genetics go={go} animals={animals} categories={categories} siteImages={siteImages} openAnimal={openAnimal}/>} {screen==="animal"&&<AnimalDetail go={go} animal={selectedAnimal} siteImages={siteImages} loaded={animalsLoaded}/>} {screen==="criollos"&&<CriollosPage go={go} siteImages={siteImages}/>} {screen==="actualidad"&&<NewsPage go={go} posts={news} openNews={openNews}/>} {screen==="noticia"&&<NewsDetail go={go} post={selectedNews} loaded={newsLoaded}/>} {screen==="galeria"&&<GalleryPage go={go} galleryMedia={galleryMedia} categories={galleryCategories}/>} {screen==="remate"&&<AuctionPage go={go} loaded={auctionsLoaded}/>} {screen==="contacto"&&<ContactPage go={go} siteImages={siteImages}/>} {screen==="pagina"&&<CustomPublicPage go={go} slug={initialPageSlug} siteImages={siteImages}/>} {screen==="admin"&&!initialDataLoaded&&<AdminLoading/>} {screen==="admin"&&initialDataLoaded&&<Admin go={go} animals={animals} categories={categories} updateCategories={setCategories} auctions={auctions} siteImages={siteImages} content={content} publicationPending={publicationPending} updateSiteImage={updateSiteImage} updateContent={updateContent} publishSite={publishSite} restorePublication={restorePublication} saveAnimal={saveAnimal} deleteAnimal={deleteAnimal} saveAuction={saveAuction} deleteAuction={deleteAuction}/>}</main></AuctionContext.Provider></SiteImageContext.Provider></ContentContext.Provider>;
}

export default function Page(){return <SiteApplication/>}
