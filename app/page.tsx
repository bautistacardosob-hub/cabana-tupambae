"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { templateContent, templateSiteImages } from "../lib/template-content";
import { readApiJson, uploadFileDirect, uploadImageDirect } from "../lib/client-upload";

type Screen = "home" | "cabana" | "genetica" | "animal" | "criollos" | "actualidad" | "noticia" | "galeria" | "remate" | "contacto" | "pagina" | "admin";
type AdminSection = "resumen" | "animales" | "categorias" | "actualidad" | "remates" | "consultas" | "pagina" | "multimedia";
type PedigreeMember = { id?:number; relation:string; name:string; registration?:string|null; sortOrder?:number };
type DepRecord = { id?:number; label:string; value:string; precision?:string|null; percentile?:string|null; sortOrder?:number };
type MediaRecord = { id?:number; kind:"image"|"video"; url?:string|null; storageKey?:string|null; externalUrl?:string|null; filename?:string|null; caption?:string|null; sortOrder?:number };
type AuctionRecord = { id?:number; title:string; auctionDate?:string|null; auctionTime?:string|null; auctioneer?:string|null; location?:string|null; lots?:string|null; description?:string|null; catalogUrl?:string|null; streamUrl?:string|null; image:string; status:"upcoming"|"past"; published:boolean; sortOrder?:number; updatedAt?:string };
type ContactMessage = { id:number; name:string; email:string; phone?:string|null; subject?:string|null; message:string; isRead:boolean; createdAt:string };
type SiteImageRecord = { id?:number; imageKey:string; label:string; url:string; fallbackUrl:string; storageKey?:string|null };
type SiteImageMap = Record<string,string>;
type SiteContentMap = Record<string,string>;
type CategoryRecord = {id:number;name:string;slug:string;sortOrder:number;active:boolean};
type GalleryMediaRecord = {id:number;url:string;storageKey:string;filename?:string|null;caption?:string|null;category?:string|null;published:boolean;sortOrder:number};
type NewsRecord = {id:number;title:string;slug:string;excerpt?:string|null;content?:string|null;videoUrl?:string|null;articleImage?:string|null;documentUrl?:string|null;documentFilename?:string|null;sortOrder?:number;category:string;image:string;published:boolean;publishedAt?:string|null;updatedAt:string};
type PublicationRecord = {id:number;publishedAt:string};
type CustomPage = {id:string;slug:string;menuLabel:string;template:"editorial"|"photographic"|"split";eyebrow:string;title:string;lead:string;body:string;heroImage:string;published:boolean};
const pedigreeLabels = [["sire","Padre"],["dam","Madre"],["paternal_grandsire","Abuelo paterno"],["paternal_granddam","Abuela paterna"],["maternal_grandsire","Abuelo materno"],["maternal_granddam","Abuela materna"]] as const;

type AnimalRecord = {
  id?: number; name: string; type: string; rp: string; breed: string; image: string;
  status: "published" | "draft"; featured: boolean; birthDate?: string | null;
  coat?: string | null; registration?: string | null; description?: string | null;
  introTitle?: string; introEmphasis?: string; introSecondary?: string;
  pedigreeTitle?: string; pedigreeEmphasis?: string; pedigreeDescription?: string;
  birthWeight?: string | null; weaningWeight?: string | null;
  scrotalCircumference?: string | null; frame?: string | null; updatedAt?: string;
  pedigree?: PedigreeMember[]; deps?: DepRecord[]; media?: MediaRecord[];
};

const defaultSiteImages:SiteImageMap={"brand-logo":"/template-brand.svg","brand-watermark":"/template-watermark.svg",...Object.fromEntries(templateSiteImages.map(([key,,url])=>[key,url]))};
const defaultContent:SiteContentMap=templateContent;
const ContentContext=createContext<SiteContentMap>(defaultContent);
const SiteImageContext=createContext<SiteImageMap>(defaultSiteImages);
const AuctionContext=createContext<AuctionRecord|null>(null);
const useSiteContent=()=>useContext(ContentContext);
const isVisible=(content:SiteContentMap,key:string)=>content[key]!=="false";
const pageVisibilityKeys:Partial<Record<Screen,string>>={cabana:"show_cabana",genetica:"show_genetics",criollos:"show_criollos",actualidad:"show_news",galeria:"show_gallery",contacto:"show_contact"};
const customPagesFromContent=(content:SiteContentMap):CustomPage[]=>{try{const value=JSON.parse(content.custom_pages_json||"[]");return Array.isArray(value)?value.filter(item=>item&&typeof item.slug==="string"):[]}catch{return []}};
type CachedSiteIdentity={brandName?:string;logo?:string};
const siteIdentityCacheKey="cabana-site-identity-v1";
const readCachedSiteIdentity=():CachedSiteIdentity=>{if(typeof window==="undefined")return {};try{return JSON.parse(localStorage.getItem(siteIdentityCacheKey)||"{}") as CachedSiteIdentity}catch{return {}}};
const cacheSiteIdentity=(values:CachedSiteIdentity)=>{if(typeof window==="undefined")return;try{const current=readCachedSiteIdentity();localStorage.setItem(siteIdentityCacheKey,JSON.stringify({...current,...values}))}catch{}};
const colorPalettes=[
  {id:"tierra",name:"Tierra",copy:"Cálida, editorial y natural.",colors:["#35271f","#2b1d16","#f3eee4","#ae6d43"]},
  {id:"monte",name:"Monte",copy:"Verdes profundos y tonos orgánicos.",colors:["#203128","#10241a","#f0f2e9","#8d7148"]},
  {id:"pampa",name:"Pampa",copy:"Neutra, sobria y contemporánea.",colors:["#30332f","#202520","#efebe2","#8c7456"]},
  {id:"vino",name:"Vino",copy:"Borgoña elegante con acentos suaves.",colors:["#40292b","#2b181b","#f4ebe5","#9d5d50"]}
] as const;

function findNextAuction(auctions:AuctionRecord[]){
  const today=new Date();today.setHours(0,0,0,0);
  return auctions.filter(item=>item.published&&item.status==="upcoming"&&Boolean(item.auctionDate)&&new Date(`${item.auctionDate}T12:00:00`)>=today).sort((a,b)=>String(a.auctionDate).localeCompare(String(b.auctionDate)))[0]??null;
}

function Brand({ dark = false }: { dark?: boolean }) {
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
  return <section className="homeCarousel"><header><div><p className="sectionNumber">{isNews?"03 — Actualidad":"04 — Galería"}</p><h2>{isNews?<>Lo que está<br/><em>pasando.</em></>:<>La vida<br/><em>en imágenes.</em></>}</h2></div><div className="carouselActions"><button onClick={()=>move(-1)} aria-label="Ver anteriores">←</button><button onClick={()=>move(1)} aria-label="Ver siguientes">→</button></div></header><div className="homeCarouselRail" ref={rail}>{isNews?news.slice(0,8).map(post=><article className="homeNewsCard" key={post.id}><button onClick={()=>openNews(post)}><div style={{backgroundImage:`url(${post.image})`}}/>
    <small>{post.category}</small><h3>{post.title}</h3><span>Leer noticia →</span></button></article>):gallery.slice(0,10).map(image=><figure className="homeGalleryCard" key={image.id} style={{backgroundImage:`url(${image.url})`}}><figcaption>{image.caption||image.category||"La cabaña"}</figcaption></figure>)}</div><button className="textLink carouselMore" onClick={()=>go(isNews?"actualidad":"galeria")}>{isNews?"Ver toda la actualidad":"Ver toda la galería"} <span>↗</span></button></section>;
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
  const selectedForHome=visible.filter(a=>a.featured);
  const homeAnimals=(selectedForHome.length?selectedForHome:visible).slice(0,2);
  const nextAuction=findNextAuction(auctions);
  const auctionDate=nextAuction?.auctionDate?new Date(`${nextAuction.auctionDate}T12:00:00`):null;
  const auctionPosition=content.home_auction_position||"after_genetics";
  const homeCarousels=(position:string)=><>{isVisible(content,"show_home_news_carousel")&&(content.home_news_carousel_position||"after_auction")===position&&<HomeCarousel kind="news" news={news} gallery={galleryMedia} openNews={openNews} go={go}/>} {isVisible(content,"show_home_gallery_carousel")&&(content.home_gallery_carousel_position||"after_auction")===position&&<HomeCarousel kind="gallery" news={news} gallery={galleryMedia} openNews={openNews} go={go}/>}</>;
  const auctionSection=nextAuction?<section className="auction auctionFeatured" id="remate"><div className="auctionBackdrop" style={{backgroundImage:`url(${nextAuction.image})`}}/><div className="auctionShade"/><div className="auctionLead"><p className="eyebrow">Próximo remate</p><h2>{nextAuction.title.split(" ").slice(0,2).join(" ")}<br/><em>{nextAuction.title.split(" ").slice(2).join(" ")}</em></h2><p className="auctionSummary">{nextAuction.description||nextAuction.lots}</p></div><div className="auctionFeaturePanel"><div className="auctionDate"><b>{auctionDate?.getDate()||"—"}</b><span>{auctionDate?.toLocaleDateString("es-AR",{month:"long"})||"Fecha"}<br/>{auctionDate?.getFullYear()||"a confirmar"}</span></div><dl>{nextAuction.auctionTime&&<div><dt>Horario</dt><dd>{nextAuction.auctionTime} hs</dd></div>}{nextAuction.auctioneer&&<div><dt>Rematador</dt><dd>{nextAuction.auctioneer}</dd></div>}{nextAuction.location&&<div><dt>Ubicación</dt><dd>{nextAuction.location}</dd></div>}{nextAuction.lots&&<div><dt>Oferta</dt><dd>{nextAuction.lots}</dd></div>}</dl><div className="auctionActions"><button onClick={()=>go("remate")}>Ver más información <span>→</span></button>{nextAuction.catalogUrl&&<a href={nextAuction.catalogUrl} target="_blank" rel="noreferrer">Ver catálogo <span>↗</span></a>}{nextAuction.streamUrl&&<a href={nextAuction.streamUrl} target="_blank" rel="noreferrer">Transmisión <span>▶</span></a>}</div></div></section>:null;
  return <>
    <section className="hero screenSection" style={{backgroundImage:`url(${siteImages["home-hero"]})`}}>
      <Header screen="home" go={go}/><div className="heroShade" />
      <div className="heroContent"><p className="eyebrow">{content.brand_tagline}</p><h1>{content.home_hero_line_1}<br/><em>{content.home_hero_line_2}</em></h1><p className="heroCopy">{content.home_hero_copy}</p>{isVisible(content,"show_genetics")&&<button className="roundLink" onClick={() => go("genetica")}><span>Explorar<br/>la genética</span><b aria-hidden="true"/></button>}</div>
      <div className="heroIndex"><span>01</span><i/><span>03</span></div>
    </section>
    {isVisible(content,"show_home_intro")&&<section className="intro" id="cabana"><div className="sectionNumber">01 — La cabaña</div><div>{content.home_intro_eyebrow&&<p className="kicker">{content.home_intro_eyebrow}</p>}<h2>{content.home_intro_line_1}{content.home_intro_line_2&&<><br/><em>{content.home_intro_line_2}</em></>}</h2></div><div className="introCopy">{content.home_intro_copy&&<p>{content.home_intro_copy}</p>}{isVisible(content,"show_cabana")&&<button className="textLink" onClick={()=>go("cabana")}>Nuestra historia <span>→</span></button>}</div></section>}
    {isVisible(content,"show_home_establishment")&&<section className="widePhoto" style={{backgroundImage:`url(${siteImages.establishment})`}} aria-label="Ganado Angus en el establecimiento"><div className="photoCaption"><span>{content.establishment_name}</span><span>{content.establishment_location}</span></div></section>}
    {homeCarousels("before_genetics")}
    {auctionPosition==="before_genetics"&&auctionSection}
    {isVisible(content,"show_genetics")&&isVisible(content,"show_home_genetics")&&<section className={`geneticsPreview animalCount${homeAnimals.length}`} id="genetica"><div className="previewLead"><p className="sectionNumber">02 — Nuestra genética</p><h2>{content.genetics_line_1}{content.genetics_line_2&&<><br/><em>{content.genetics_line_2}</em></>}</h2><button className="textLink" onClick={() => visible.length?window.location.assign("/genetica#catalogo-animales"):go("genetica")}>{visible.length?"Ver todos los animales":"Conocer el programa"} <span>↗</span></button></div>{homeAnimals.map((a,i)=><article className={`homeAnimal animal${i+1}`} key={a.id??a.name} onClick={() => openAnimal(a)}><div className="animalImage" style={{backgroundImage:`url(${a.image})`}}/><div><span>{a.type}</span><h3>{a.name}</h3><small>RP {a.rp} · {a.breed}</small></div></article>)}</section>}
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
  return <div className="editorialPage"><Header screen="cabana" go={go}/><section className="storyHero"><div>{content.cabana_eyebrow&&<p className="sectionNumber">{content.cabana_eyebrow}</p>}<h1>{content.cabana_title_line_1}{content.cabana_title_line_2&&<><br/><em>{content.cabana_title_line_2}</em></>}</h1></div>{content.cabana_lead&&<p>{content.cabana_lead}</p>}</section>{isVisible(content,"show_cabana_establishment_image")&&<section className="storyPhoto" style={{backgroundImage:`url(${siteImages.establishment})`}}><span>{content.establishment_name} · {content.establishment_location}</span></section>}<section className="storyBody">{showBrand&&<img className="cabinBrandWatermark" src={siteImages["brand-watermark"]||defaultSiteImages["brand-watermark"]} alt="" aria-hidden="true"/>}<div>{content.cabana_year&&<><small>Desde</small><b>{content.cabana_year}</b></>}</div><article>{content.cabana_story_1&&<p>{content.cabana_story_1}</p>}{content.cabana_story_2&&<p>{content.cabana_story_2}</p>}</article></section>{isVisible(content,"show_history_chapters")&&chapters.length>0&&<section className="historyChapters"><div className="sectionTop"><div><p className="sectionNumber">Historia completa</p><h2>Territorio, selección<br/><em>y producción.</em></h2></div><p>El recorrido de {content.brand_name} desde sus orígenes hasta el trabajo actual.</p></div>{chapters.map(([number,title,copy])=><article key={number}><small>{number}</small><h3>{title}</h3><p>{copy}</p></article>)}</section>}{isVisible(content,"show_story_values")&&visibleValues.length>0&&<section className={`storyValues storyValues${visibleValues.length}`}><p className="sectionNumber">{content.story_values_eyebrow}</p><div>{visibleValues.map(([number,title,copy])=><article key={number}><small>{number}</small>{title&&<h2>{title}</h2>}{copy&&<p>{copy}</p>}</article>)}</div></section>}<Footer go={go}/></div>;
}

function CriollosPage({go,siteImages}:{go:(screen:Screen)=>void;siteImages:SiteImageMap}){
  const content=useSiteContent();
  return <div className="editorialPage criollosPage"><Header screen="criollos" go={go}/><section className="storyHero"><div><p className="sectionNumber">Criollos · {content.brand_name}</p><h1>{content.criollos_title_line_1}<br/><em>{content.criollos_title_line_2}</em></h1></div><p>{content.criollos_lead}</p></section>{isVisible(content,"show_criollos_image")&&<section className="storyPhoto criollosPhoto" style={{backgroundImage:`url(${siteImages["criollos-hero"]})`}}><span>Caballos Criollos · {content.brand_name}</span></section>}<section className="criollosBody">{[content.criollos_story_1,content.criollos_story_2,content.criollos_story_3].filter(Boolean).map((copy,index)=><article key={index}><small>{String(index+1).padStart(2,"0")}</small><p>{copy}</p></article>)}</section><Footer go={go}/></div>;
}

function NewsPage({go,posts,openNews}:{go:(screen:Screen)=>void;posts:NewsRecord[];openNews:(post:NewsRecord)=>void}){
  const content=useSiteContent();
  return <div className="editorialPage"><Header screen="actualidad" go={go}/><section className="pageTitle newsListingTitle"><p className="sectionNumber">Noticias de la cabaña</p><h1>Actualidad<br/><em>{content.brand_name}.</em></h1>{content.actualidad_intro&&<p>{content.actualidad_intro}</p>}</section>{posts.length?<section className="newsGrid">{posts.map((post,index)=><article key={post.id}><button className="newsCardButton" onClick={()=>openNews(post)}><div className="newsImage" style={{backgroundImage:`url(${post.image})`}}><span>{String(index+1).padStart(2,"0")}</span></div><div><small>{post.category} · {post.publishedAt?new Date(post.publishedAt).toLocaleDateString("es-AR",{month:"long",year:"numeric"}):""}</small><h2>{post.title}</h2><p>{post.excerpt}</p><b>Leer noticia →</b></div></button></article>)}</section>:<section className="publicGalleryEmpty"><span>◇</span><h2>Todavía no hay noticias publicadas.</h2><p>La sección se completará desde el administrador de la cabaña.</p></section>}<Footer go={go}/></div>;
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
  return <div className="editorialPage newsDetailPage"><Header screen="noticia" go={go}/><button className="newsBack" onClick={()=>go("actualidad")}>← Volver a Actualidad</button><section className="newsDetailIntro"><small>{post.category} · {date}</small><h1>{post.title}</h1><p>{post.excerpt}</p></section>{video&&<div className="newsVideo"><iframe src={video} title={`Video de ${post.title}`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen/></div>}{post.articleImage&&<figure className="newsArticleImage" style={{backgroundImage:`url(${post.articleImage})`}}/>}<section className="newsDetailBody"><aside><span>Actualidad</span><b>{date}</b></aside><article>{paragraphs.map((paragraph,index)=>{const match=paragraph.match(/^(.*?):\s*(https?:\/\/\S+)$/);return match?<p key={index}><span>{match[1]}: </span><a href={match[2]} target="_blank" rel="noreferrer">Abrir original ↗</a></p>:<p key={index}>{paragraph}</p>})}{post.documentUrl&&<a className="newsDocumentLink" href={post.documentUrl} target="_blank" rel="noreferrer" download={post.documentFilename||undefined}>Descargar PDF <span>↓</span></a>}<button onClick={()=>go("contacto")}>Contactar a la cabaña →</button></article></section><Footer go={go}/></div>;
}

function GalleryPage({go,galleryMedia,categories}:{go:(screen:Screen)=>void;galleryMedia:GalleryMediaRecord[];categories:CategoryRecord[]}){
  const content=useSiteContent();
  const [filter,setFilter]=useState("Todas");
  const images=galleryMedia.filter(item=>filter==="Todas"||item.category===filter);
  const activeCategories=categories.filter(item=>item.active&&galleryMedia.some(media=>media.category===item.name));
  return <div className="editorialPage"><Header screen="galeria" go={go}/><section className="pageTitle galleryTitle">{content.gallery_eyebrow&&<p className="sectionNumber">{content.gallery_eyebrow}</p>}<h1>{content.gallery_title_line_1||"Galería"}{content.gallery_title_line_2&&<><br/><em>{content.gallery_title_line_2}</em></>}</h1></section>{galleryMedia.length>0&&<section className="galleryFilters">{["Todas",...activeCategories.map(item=>item.name)].map(item=><button key={item} className={filter===item?"active":""} onClick={()=>setFilter(item)}>{item}</button>)}</section>}{images.length?<section className="publicGallery">{images.map((image,index)=><figure key={image.id} className={`galleryItem galleryItem${index%5}`} style={{backgroundImage:`url(${image.url})`}}><figcaption>{String(index+1).padStart(2,"0")} · {image.caption||image.category||"La cabaña"}</figcaption></figure>)}</section>:<section className="publicGalleryEmpty"><span>◇</span><h2>Todavía no hay fotografías publicadas.</h2><p>La galería se completará desde el administrador de la cabaña.</p></section>}<Footer go={go}/></div>;
}

function AuctionPage({go,loaded}:{go:(screen:Screen)=>void;loaded:boolean}){
  const auction=useContext(AuctionContext);
  if(!loaded)return <div className="editorialPage"><Header screen="remate" go={go}/><section className="auctionPageLoading" aria-live="polite"><i/><span>Cargando información del remate…</span></section></div>;
  if(!auction)return <div className="editorialPage"><Header screen="remate" go={go}/><section className="pageTitle"><p className="sectionNumber">Remates</p><h1>Próxima fecha<br/><em>a confirmar.</em></h1><p>Cuando la cabaña publique un nuevo remate, la información aparecerá automáticamente en esta página.</p></section><Footer go={go}/></div>;
  const date=auction.auctionDate?new Date(`${auction.auctionDate}T12:00:00`):null;
  return <div className="auctionPage"><Header screen="remate" go={go}/><section className="auctionPageHero" style={{backgroundImage:`url(${auction.image})`}}><div/><section><p className="eyebrow">Próximo remate</p><h1>{auction.title}</h1><p>{auction.description}</p></section></section><section className="auctionPageInfo"><div><small>Fecha</small><b>{date?.toLocaleDateString("es-AR",{day:"2-digit",month:"long",year:"numeric"})||"A confirmar"}</b></div>{auction.auctionTime&&<div><small>Horario</small><b>{auction.auctionTime} hs</b></div>}{auction.auctioneer&&<div><small>Rematador</small><b>{auction.auctioneer}</b></div>}{auction.location&&<div><small>Ubicación</small><b>{auction.location}</b></div>}{auction.lots&&<div><small>Oferta</small><b>{auction.lots}</b></div>}</section><section className="auctionPageActions"><div><p className="sectionNumber">Información del evento</p><h2>Nos encontramos<br/><em>en la cabaña.</em></h2></div><div><p>{auction.description||"Una nueva edición de nuestro remate anual, con la selección genética de la cabaña."}</p><div>{auction.catalogUrl&&<a href={auction.catalogUrl} target="_blank" rel="noreferrer">Ver catálogo ↗</a>}{auction.streamUrl&&<a href={auction.streamUrl} target="_blank" rel="noreferrer">Ver transmisión ▶</a>}<button onClick={()=>go("contacto")}>Consultar disponibilidad →</button></div></div></section><Footer go={go}/></div>;
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
  const activeCategories=categories.filter(item=>item.active);
  const normalized=query.trim().toLocaleLowerCase("es");
  const filtered=animals.filter(a=>a.status==="published").filter(a=>filter==="Todos"||a.type.toLowerCase().includes(filter.replace(/s$/i,"").toLowerCase())).filter(a=>!normalized||[a.name,a.rp,a.breed,a.type].some(value=>value.toLocaleLowerCase("es").includes(normalized))).sort((a,b)=>sort==="name"?a.name.localeCompare(b.name,"es"):sort==="rp"?a.rp.localeCompare(b.rp,"es",{numeric:true}):Number(b.featured)-Number(a.featured)||a.name.localeCompare(b.name,"es"));
  const pages=Math.max(1,Math.ceil(filtered.length/pageSize));
  const currentPage=Math.min(page,pages);
  const visible=filtered.slice((currentPage-1)*pageSize,currentPage*pageSize);
  const stats=[[content.stat_1_value,content.stat_1_label],[content.stat_2_value,content.stat_2_label],[content.stat_3_value,content.stat_3_label]].filter(([value])=>value);
  const showResultsImage=isVisible(content,"show_genetics_results_image");
  return <div className="innerPage"><Header screen="genetica" go={go}/>{isVisible(content,"show_genetics_catalog")&&<section className="availableAnimalsBanner"><div><p className="eyebrow">Catálogo actualizado</p><h1>Ver animales<br/><em>disponibles.</em></h1><p>{filtered.length?`${filtered.length} ejemplares publicados con información, imágenes y pedigree.`:"Las nuevas fichas se publicarán próximamente."}</p></div><button onClick={()=>document.getElementById("catalogo-animales")?.scrollIntoView({behavior:"smooth",block:"start"})}>Explorar catálogo <span>↓</span></button></section>}{isVisible(content,"show_genetics_program")&&<>{isVisible(content,"show_genetics_hero")&&<section className="geneticsProgramHero" style={{backgroundImage:`url(${siteImages["genetics-hero"]})`}}><div/><section><p className="eyebrow">Mejoramiento genético</p><h1>Datos, presión de selección<br/><em>y adaptación.</em></h1></section></section>}{isVisible(content,"show_genetics_intro")&&<section className="geneticsProgram"><div><p className="sectionNumber">Programa genético</p><h2>{content.genetics_title}</h2></div>{content.genetics_copy&&<p>{content.genetics_copy}</p>}</section>}{isVisible(content,"show_genetics_stats")&&stats.length>0&&<section className={`geneticsStats geneticsStats${stats.length}`}>{stats.map(([value,label],index)=><article key={`${label}-${index}`}><b>{value}</b>{label&&<span>{label}</span>}</article>)}</section>}{isVisible(content,"show_genetics_results")&&Boolean(content.genetics_cycle_title||content.genetics_cycle_copy)&&<section className={`geneticsCycle ${showResultsImage?"":"noImage"}`}>{showResultsImage&&<div style={{backgroundImage:`url(${siteImages["genetics-cycle"]})`}}/>}<article><p className="sectionNumber">Resultados</p>{content.genetics_cycle_title&&<h2>{content.genetics_cycle_title}</h2>}{content.genetics_cycle_copy&&<p>{content.genetics_cycle_copy}</p>}</article></section>}</>}{isVisible(content,"show_genetics_catalog")&&<><section className="listingHead" id="catalogo-animales">{content.genetics_catalog_eyebrow&&<p className="sectionNumber">{content.genetics_catalog_eyebrow}</p>}<div><h1>{content.genetics_catalog_title_line_1}{content.genetics_catalog_title_line_2&&<><br/><em>{content.genetics_catalog_title_line_2}</em></>}</h1>{content.genetics_catalog_copy&&<p>{content.genetics_catalog_copy}</p>}</div><span className="resultCount">{filtered.length} ejemplares</span></section><section className="filterBar" aria-label="Filtros de animales">{["Todos",...activeCategories.map(item=>item.name)].map(f=><button className={filter===f?"selected":""} onClick={()=>{setFilter(f);setPage(1)}} key={f}>{f}</button>)}</section><section className="catalogTools"><label><span>⌕</span><input aria-label="Buscar en genética" value={query} onChange={e=>{setQuery(e.target.value);setPage(1)}} placeholder="Buscar por nombre, RP, raza o categoría"/></label><select aria-label="Ordenar animales" value={sort} onChange={e=>{setSort(e.target.value as "featured"|"name"|"rp");setPage(1)}}><option value="featured">Destacados primero</option><option value="name">Nombre A–Z</option><option value="rp">RP ascendente</option></select></section>{visible.length?<section className="animalGrid">{visible.map((a,i)=><article className="animalCard" key={a.id??a.name}><button className="cardImage" style={{backgroundImage:`url(${a.image})`}} onClick={()=>openAnimal(a)} aria-label={`Ver ficha de ${a.name}`}><span className="cardIndex">{String((currentPage-1)*pageSize+i+1).padStart(2,"0")}</span>{a.featured&&<span className="featured">Inicio</span>}<span className="openCard">↗</span></button><div className="cardMeta"><div><span>{a.type}</span><h2>{a.name}</h2></div><p>RP {a.rp}<br/>{a.breed}</p></div></article>)}</section>:<section className="catalogEmpty"><span>◇</span><h2>Todavía no hay animales publicados.</h2><p>El programa genético ya está disponible; las fichas se cargarán desde el administrador.</p></section>} {filtered.length>pageSize&&<div className="pagination"><button disabled={currentPage===1} onClick={()=>setPage(value=>Math.max(1,value-1))}>←</button><span>{currentPage} / {pages}</span><button disabled={currentPage===pages} onClick={()=>setPage(value=>Math.min(pages,value+1))}>→</button></div>}</>}<Footer go={go}/></div>;
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

  return <div className="detailPage"><section className="detailHero" style={{backgroundImage:`url(${animal.image})`}}><Header screen="animal" go={go}/><div className="detailOverlay"/><button className="backButton" onClick={()=>go("genetica")}>← Volver a genética</button><div className="detailTitle"><p className="eyebrow">{animal.type} · {animal.breed}</p><h1>{first}<br/><em>{rest}</em></h1><div className="heroFacts"><span><small>RP</small>{animal.rp}</span><span><small>Nacimiento</small>{animal.birthDate||"Sin dato"}</span><span><small>Pelaje</small>{animal.coat||"Sin dato"}</span></div></div><div className="imageCounter">01 <i/> 04</div></section><section className="detailIntro"><div><p className="sectionNumber">01 — El ejemplar</p>{(animal.introTitle||animal.introEmphasis)&&<h2>{animal.introTitle}{animal.introTitle&&animal.introEmphasis&&<br/>}{animal.introEmphasis&&<em>{animal.introEmphasis}</em>}</h2>}</div><div className="description">{animal.description&&<p>{animal.description}</p>}{animal.introSecondary&&<p>{animal.introSecondary}</p>}</div>
{showBrand&&<div className="animalBrandWatermark" aria-hidden="true"><img src={siteImages["brand-watermark"]||defaultSiteImages["brand-watermark"]} alt=""/></div>}
</section><section className="dataBand"><div><small>Registro</small><b>{animal.registration||"Sin dato"}</b></div><div><small>Peso al nacer</small><b>{animal.birthWeight||"—"}</b></div><div><small>Peso al destete</small><b>{animal.weaningWeight||"—"}</b></div><div><small>Circ. escrotal</small><b>{animal.scrotalCircumference||"—"}</b></div><div><small>Frame</small><b>{animal.frame||"—"}</b></div></section><section className="pedigreeSection"><div className="sectionTop"><div><p className="sectionNumber">02 — Linaje</p>{(animal.pedigreeTitle||animal.pedigreeEmphasis)&&<h2>{animal.pedigreeTitle}{animal.pedigreeTitle&&animal.pedigreeEmphasis&&<br/>}{animal.pedigreeEmphasis&&<em>{animal.pedigreeEmphasis}</em>}</h2>}</div>{animal.pedigreeDescription&&<p>{animal.pedigreeDescription}</p>}</div><Pedigree animal={animal}/></section>{Boolean(animal.deps?.length)&&<section className="depsSection"><div className="depsIntro"><p className="sectionNumber">03 — Información genética</p><h2>Datos que<br/><em>acompañan la mirada.</em></h2><p>Valores expresados como DEPs. Cada cabaña puede configurar las características que publica.</p></div><div className="depsTable"><div className="depsHeader"><span>Característica</span><span>DEP</span><span>Prec.</span><span>Percentil</span></div>{animal.deps!.map((d,i)=><div className="depRow" key={`${d.label}-${i}`}><b>{d.label}</b><span>{d.value}</span><span>{d.precision||"—"}</span><span className="percent"><i style={{width:`${Math.max(18,85-i*9)}%`}}/>{d.percentile||"—"}</span></div>)}</div></section>}{Boolean(uploadedImages.length||video)&&<section className="gallerySection"><div className="sectionTop"><div><p className="sectionNumber">04 — Galería</p><h2>{video?<>Ver al animal<br/><em>en movimiento.</em></>:<>Galería<br/><em>del animal.</em></>}</h2></div></div>{video&&<div className="animalVideoPlayer">{videoEmbed?<iframe src={videoEmbed} title={`Video de ${animal.name}`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen/>:directVideo?<video src={video} controls playsInline preload="metadata"/>:<a href={video} target="_blank" rel="noreferrer"><span>▶</span> Abrir video</a>}</div>}{visibleGallery.length>0&&<div className={`galleryGrid galleryCount${visibleGallery.length}`}>{visibleGallery.map((image,index)=><div key={`${image}-${index}`} className={`galleryImage ${imageClasses[index]}`} style={{backgroundImage:`url(${image})`}}>{index===visibleGallery.length-1&&<span>{String(visibleGallery.length).padStart(2,"0")} / {String(uploadedImages.length).padStart(2,"0")}</span>}</div>)}</div>}</section>}<Footer go={go}/></div>;
}

function ContactPage({go,siteImages}:{go:(screen:Screen)=>void;siteImages:SiteImageMap}) {
  const content=useSiteContent();
  const [busy,setBusy]=useState(false);
  const [sent,setSent]=useState(false);
  const [error,setError]=useState("");
  const socials=[["Instagram",content.social_instagram],["Facebook",content.social_facebook],["YouTube",content.social_youtube]].filter((item):item is [string,string]=>Boolean(item[1]?.trim()));
  const submit=async(form:HTMLFormElement)=>{setBusy(true);setError("");const data=new FormData(form);try{const response=await fetch("/api/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:data.get("name"),email:data.get("email"),phone:data.get("phone"),subject:data.get("subject"),message:data.get("message")})});const result=await response.json() as {error?:string};if(!response.ok)throw new Error(result.error||"No se pudo enviar la consulta.");form.reset();setSent(true)}catch(cause){setError(cause instanceof Error?cause.message:"No se pudo enviar la consulta.")}finally{setBusy(false)}};
  const showContactImage=isVisible(content,"show_contact_image");
  return <div className="contactPage"><Header screen="contacto" go={go}/><section className="contactHero"><div><p className="sectionNumber">Contacto · {content.brand_name}</p><h1>{content.contact_line_1}{content.contact_line_2&&<><br/><em>{content.contact_line_2}</em></>}</h1>{content.contact_intro&&<p>{content.contact_intro}</p>}</div><div className="contactDirect"><span>Contacto directo</span>{content.contact_email&&<a href={`mailto:${content.contact_email}`}>{content.contact_email} ↗</a>}{content.contact_whatsapp&&<a className="contactWhatsapp" href={content.contact_whatsapp} target="_blank" rel="noreferrer"><span>Contactar por WhatsApp</span><b>{content.contact_phone||"Abrir conversación"}</b><i>↗</i></a>}{socials.length>0&&<div className="contactSocials">{socials.map(([label,url])=><a key={label} href={url} target="_blank" rel="noreferrer">{label} ↗</a>)}</div>}{content.contact_location&&<small>{content.contact_location}<br/>Visitas con coordinación previa</small>}</div></section><section className={`contactBody ${showContactImage?"":"noImage"}`}>{showContactImage&&<div className="contactPhoto" style={{backgroundImage:`url(${siteImages.contact})`}}/>}<form className="contactForm" onSubmit={e=>{e.preventDefault();void submit(e.currentTarget)}}><div><p className="sectionNumber">Enviar una consulta</p><h2>¿En qué podemos<br/><em>acompañarte?</em></h2></div>{sent?<div className="contactSuccess"><span>✓</span><h3>Consulta recibida.</h3><p>Gracias por escribirnos. El equipo de la cabaña se pondrá en contacto.</p><button type="button" onClick={()=>setSent(false)}>Enviar otra consulta</button></div>:<><div className="contactFields"><label>Nombre y apellido<input name="name" required/></label><label>Email<input name="email" type="email" required/></label><label>Teléfono<input name="phone" type="tel"/></label><label>Motivo<select name="subject"><option>Consulta genética</option><option>Disponibilidad de animales</option><option>Caballos Criollos</option><option>Visita al establecimiento</option><option>Otro</option></select></label><label className="fullField">Mensaje<textarea name="message" required rows={6}/></label></div>{error&&<p className="contactError">{error}</p>}<button className="sendMessage" disabled={busy}>{busy?"Enviando...":"Enviar consulta →"}</button></>}</form></section>{content.contact_map&&<section className="contactMap"><div><p className="sectionNumber">Cómo llegar</p><h2>Ubicación</h2><p>{content.contact_location}</p></div><iframe title={`Mapa de ${content.brand_name}`} src={content.contact_map} loading="lazy" referrerPolicy="no-referrer-when-downgrade"/></section>}<Footer go={go}/></div>;
}

function CustomPublicPage({go,slug,siteImages}:{go:(screen:Screen)=>void;slug?:string;siteImages:SiteImageMap}){
  const content=useSiteContent();
  const page=customPagesFromContent(content).find(item=>item.slug===slug&&item.published);
  if(!page)return <div className="editorialPage"><Header screen="pagina" go={go}/><section className="publicGalleryEmpty customPageMissing"><span>◇</span><h2>Esta página no está disponible.</h2><button onClick={()=>go("home")}>Volver al inicio →</button></section><Footer go={go}/></div>;
  const image=siteImages[`page-${page.id}`]||page.heroImage||siteImages.establishment;
  const paragraphs=page.body.split(/\n+/).map(item=>item.trim()).filter(Boolean);
  return <div className={`editorialPage customPublicPage template-${page.template}`}><Header screen="pagina" go={go}/>{page.template==="photographic"?<><section className="customPhotoHero" style={{backgroundImage:`url(${image})`}}><div/><article><p className="eyebrow">{page.eyebrow}</p><h1>{page.title}</h1><p>{page.lead}</p></article></section><section className="customPublicBody">{paragraphs.map((paragraph,index)=><p key={index}>{paragraph}</p>)}</section></>:page.template==="split"?<section className="customSplit"><div style={{backgroundImage:`url(${image})`}}/><article><p className="sectionNumber">{page.eyebrow}</p><h1>{page.title}</h1><p className="customLead">{page.lead}</p>{paragraphs.map((paragraph,index)=><p key={index}>{paragraph}</p>)}</article></section>:<><section className="pageTitle customEditorialTitle"><div><p className="sectionNumber">{page.eyebrow}</p><h1>{page.title}</h1></div><p>{page.lead}</p></section><div className="customEditorialPhoto" style={{backgroundImage:`url(${image})`}}/><section className="customPublicBody">{paragraphs.map((paragraph,index)=><p key={index}>{paragraph}</p>)}</section></>}<Footer go={go}/></div>;
}

function AdminLoading(){const content=useSiteContent();const images=useContext(SiteImageContext);const hasIdentity=Boolean(content.brand_name&&content.brand_name!=="Nombre de la cabaña"&&images["brand-logo"]&&!images["brand-logo"].endsWith("/template-brand.svg"));return <div className="adminLoading" role="status" aria-live="polite"><div>{hasIdentity&&<Brand dark/>}<i/><p>Cargando administrador…</p></div></div>}
function PublicLoading({failed=false}:{failed?:boolean}){return <div className={`publicLoading ${failed?"failed":""}`} role="status" aria-live="polite">{failed?<><span>No pudimos cargar el sitio.</span><button onClick={()=>window.location.reload()}>Volver a intentar</button></>:<><i/><span>Cargando sitio…</span></>}</div>}

function Admin({ go, animals, categories, updateCategories, auctions, siteImages, content, publicationPending, updateSiteImage, updateContent, publishSite, restorePublication, saveAnimal, deleteAnimal, saveAuction, deleteAuction }: { go: (s: Screen) => void; animals: AnimalRecord[]; categories:CategoryRecord[]; updateCategories:(categories:CategoryRecord[])=>void; auctions: AuctionRecord[]; siteImages:SiteImageMap; content:SiteContentMap; publicationPending:boolean; updateSiteImage:(image:SiteImageRecord)=>void; updateContent:(values:SiteContentMap)=>void; publishSite:()=>Promise<PublicationRecord>; restorePublication:(id:number)=>Promise<void>; saveAnimal: (animal: AnimalRecord) => Promise<void>; deleteAnimal: (id: number) => Promise<void>; saveAuction:(auction:AuctionRecord)=>Promise<void>; deleteAuction:(id:number)=>Promise<void> }) {
  const [section,setSection]=useState<AdminSection>("resumen");
  const [editor,setEditor]=useState<AnimalRecord|null|undefined>(undefined);
  const [saved,setSaved]=useState(false);
  const [publishing,setPublishing]=useState(false);
  const [publicationMessage,setPublicationMessage]=useState("");
  const [history,setHistory]=useState<PublicationRecord[]>([]);
  useEffect(()=>{void fetch("/api/publication").then(async response=>{if(response.ok){const data=await response.json() as {publications?:PublicationRecord[]};setHistory(data.publications??[])}})},[]);
  const publish=async()=>{setPublishing(true);setPublicationMessage("");try{const publication=await publishSite();setHistory(current=>[publication,...current].slice(0,8));setPublicationMessage("✓ Sitio publicado")}catch(cause){setPublicationMessage(cause instanceof Error?cause.message:"No se pudo publicar.")}finally{setPublishing(false)}};
  const restore=async(item:PublicationRecord)=>{if(!window.confirm(`¿Restaurar la versión del ${new Date(item.publishedAt).toLocaleString("es-AR")}?`))return;setPublishing(true);setPublicationMessage("");try{await restorePublication(item.id);setPublicationMessage("✓ Versión restaurada")}catch(cause){setPublicationMessage(cause instanceof Error?cause.message:"No se pudo restaurar.")}finally{setPublishing(false)}};
  const labels: Record<AdminSection,string> = {resumen:"Resumen",animales:"Animales",categorias:"Categorías",actualidad:"Actualidad",remates:"Remates",consultas:"Consultas",pagina:"Página web",multimedia:"Galería"};
  const choose=(value:AdminSection)=>{setSection(value);setEditor(undefined);setSaved(false)};
  return <div className="adminShell">
    <aside className="adminSidebar">
      <div className="adminBrand"><Brand/><span>Administrador</span></div>
      <nav aria-label="Secciones del administrador">
        {(["resumen","animales","categorias","actualidad","remates","consultas","pagina","multimedia"] as AdminSection[]).map((item,i)=><button key={item} className={section===item?"active":""} onClick={()=>choose(item)}><i>{["⌂","♧","≡","◫","◇","✉","▤","▧"][i]}</i>{labels[item]}{item==="animales"&&<b>{animals.length}</b>}</button>)}
      </nav>
      <div className="adminUser"><span>AD</span><p><b>Administrador</b><small>Acceso protegido</small></p></div>
    </aside>
    <div className="adminWorkspace">
      <header className="adminTopbar"><div><small>{content.brand_name}</small><strong>{labels[section]}</strong></div><div className="adminTopActions"><span className={`adminAutosave ${publicationPending?"pending":""}`}>{publicationMessage||(publicationPending?"● Hay cambios sin publicar":"✓ Sitio actualizado")}</span><button className="previewSite" onClick={()=>window.open("/preview","_blank")}>↗ Vista previa</button><details className="publishHistory"><summary>Versiones</summary><div>{history.length?history.map(item=><button key={item.id} disabled={publishing} onClick={()=>void restore(item)}><b>{new Date(item.publishedAt).toLocaleDateString("es-AR")}</b><span>{new Date(item.publishedAt).toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"})}</span></button>):<p>Todavía no hay versiones guardadas.</p>}</div></details><button className="publishSite" disabled={publishing||!publicationPending} onClick={()=>void publish()}>{publishing?"Publicando...":"Publicar cambios"}</button><button className="previewSite" onClick={()=>window.location.assign("/auth/signout")}>Cerrar sesión</button></div></header>
      <main className="adminMain">
        {section==="resumen"&&<AdminOverview setSection={choose} openEditor={()=>setEditor(null)} animals={animals} auctions={auctions} content={content}/>}
        {section==="animales"&&<AdminAnimals openEditor={setEditor} animals={animals}/>} 
        {section==="categorias"&&<AdminCategories categories={categories} update={updateCategories}/>}
        {section==="actualidad"&&<AdminNews content={content} updateContent={updateContent}/>}
        {section==="remates"&&<><AuctionHomePosition content={content} updateContent={updateContent}/><AdminAuctions auctions={auctions} save={saveAuction} remove={deleteAuction}/></>}
        {section==="consultas"&&<AdminMessages/>}
        {section==="pagina"&&<PageContent siteImages={siteImages} content={content} updateSiteImage={updateSiteImage} updateContent={updateContent}/>}
        {section==="multimedia"&&<MediaLibrary content={content} updateContent={updateContent}/>}
      </main>
    </div>
    {editor!==undefined&&<AnimalEditor animal={editor} categories={categories} featuredCount={animals.filter(item=>item.featured&&item.id!==editor?.id).length} close={()=>setEditor(undefined)} save={async(value)=>{await saveAnimal(value);setSaved(true);setTimeout(()=>setEditor(undefined),650)}} remove={async()=>{if(editor?.id){await deleteAnimal(editor.id);setEditor(undefined)}}} saved={saved}/>}
  </div>;
}

function AdminOverview({setSection,openEditor,animals,auctions,content}:{setSection:(s:AdminSection)=>void;openEditor:()=>void;animals:AnimalRecord[];auctions:AuctionRecord[];content:SiteContentMap}) {
  const published=animals.filter(a=>a.status==="published").length;
  const drafts=animals.length-published;
  const nextAuction=findNextAuction(auctions);
  const [messages,setMessages]=useState<ContactMessage[]>([]);
  useEffect(()=>{void fetch("/api/messages").then(async response=>{if(!response.ok)return;const data=await response.json() as {messages?:ContactMessage[]};setMessages(data.messages??[])}).catch(()=>undefined)},[]);
  const weekAgo=Date.now()-7*24*60*60*1000;
  const recentMessages=messages.filter(item=>new Date(item.createdAt).getTime()>=weekAgo).length;
  const checks:[string,boolean,AdminSection][]=[
    ["Identidad de la cabaña",Boolean(content.brand_name&&content.brand_tagline),"pagina"],
    ["Historia y filosofía",Boolean(content.cabana_story_1&&content.cabana_story_2),"pagina"],
    ["Genética y animales",published>0,"animales"],
    ["Próximo remate",Boolean(nextAuction),"remates"],
    ["Datos de contacto",Boolean(content.contact_location&&(content.contact_email||content.contact_phone||content.contact_whatsapp)),"pagina"]
  ];
  const completion=Math.round(checks.filter(([,done])=>done).length/checks.length*100);
  const today=new Intl.DateTimeFormat("es-AR",{weekday:"long",day:"numeric",month:"long"}).format(new Date());
  const auctionDate=nextAuction?.auctionDate?new Date(`${nextAuction.auctionDate}T12:00:00`).toLocaleDateString("es-AR",{day:"2-digit",month:"short"}):"Sin fecha";
  return <><section className="adminWelcome"><div><p>{today}</p><h1>Resumen de la cabaña.</h1><span>Información actualizada con los contenidos cargados en esta página.</span></div><button onClick={openEditor}>＋ Agregar animal</button></section><section className="metricGrid"><article><span>Animales publicados</span><b>{published}</b><small>{animals.length} fichas en total</small></article><article><span>Borradores</span><b>{drafts}</b><small>Fichas todavía no visibles</small></article><article><span>Consultas recibidas</span><b>{messages.length}</b><small><i>{recentMessages}</i> en los últimos 7 días</small></article><article className="siteStatus"><span>Próximo remate</span><b><i className={nextAuction?"":"inactive"}/>{nextAuction?"Programado":"Sin publicar"}</b><small>{nextAuction?`${auctionDate} · ${nextAuction.title}`:"No aparece en la web pública"}</small></article></section><section className="adminColumns"><div className="adminPanel recentPanel"><header><div><h2>Animales recientes</h2><p>Últimas fichas creadas o modificadas.</p></div><button onClick={()=>setSection("animales")}>Ver todos →</button></header><AnimalRows animals={animals} compact openEditor={()=>setSection("animales")}/></div><div className="adminPanel progressPanel"><header><div><h2>Tu página web</h2><p>Contenido completado</p></div><b>{completion}%</b></header><div className="progressTrack"><i style={{width:`${completion}%`}}/></div>{checks.map(([text,done,target])=><button key={text} onClick={()=>setSection(target)}><span className={done?"done":""}>{done?"✓":""}</span>{text}<i>›</i></button>)}</div></section><section className="adminPanel quickPanel"><header><div><h2>Accesos rápidos</h2><p>Las tareas más frecuentes.</p></div></header><div><button onClick={openEditor}><span>＋</span><b>Nuevo animal</b><small>Crear una ficha genética</small></button><button onClick={()=>setSection("multimedia")}><span>▧</span><b>Subir fotografías</b><small>Agregar a multimedia</small></button><button onClick={()=>setSection("remates")}><span>◇</span><b>Gestionar remates</b><small>Publicar el próximo evento</small></button><button onClick={()=>setSection("pagina")}><span>✎</span><b>Editar página</b><small>Actualizar textos y portada</small></button></div></section></>;
}

function AnimalRows({animals,compact=false,openEditor}:{animals:AnimalRecord[];compact?:boolean;openEditor:(animal:AnimalRecord)=>void}) {return <div className="adminTable"><div className="adminTableHead"><span>Animal</span><span>Categoría</span><span>Estado</span><span>Actualización</span><span/></div>{animals.slice(0,compact?3:animals.length).map(a=><button className="adminRow" key={a.id??a.name} onClick={()=>openEditor(a)}><span className="rowAnimal"><i style={{backgroundImage:`url(${a.image})`}}/><b>{a.name}<small>RP {a.rp} · {a.breed}</small></b></span><span>{a.type}</span><span className={`statusPill ${a.status==="draft"?"draft":""}`}><i/>{a.status==="published"?"Publicado":"Borrador"}</span><span>{a.updatedAt?new Date(a.updatedAt).toLocaleDateString("es-AR"):"Sincronizado"}</span><span>•••</span></button>)}</div>}

function AdminAnimals({openEditor,animals}:{openEditor:(animal:AnimalRecord|null)=>void;animals:AnimalRecord[]}) {
  const [query,setQuery]=useState("");
  const [status,setStatus]=useState<"all"|"published"|"draft">("all");
  const [category,setCategory]=useState("all");
  const [page,setPage]=useState(1);
  const pageSize=8;
  const published=animals.filter(a=>a.status==="published").length;
  const categories=[...new Set(animals.map(animal=>animal.type).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"es"));
  const normalized=query.trim().toLocaleLowerCase("es");
  const filtered=animals.filter(animal=>(status==="all"||animal.status===status)&&(category==="all"||animal.type===category)&&(!normalized||[animal.name,animal.rp,animal.breed,animal.type].some(value=>value.toLocaleLowerCase("es").includes(normalized))));
  const pages=Math.max(1,Math.ceil(filtered.length/pageSize));
  const currentPage=Math.min(page,pages);
  const visible=filtered.slice((currentPage-1)*pageSize,currentPage*pageSize);
  const changeStatus=(value:"all"|"published"|"draft")=>{setStatus(value);setPage(1)};
  return <><section className="adminPageHead"><div><p>Catálogo genético</p><h1>Animales</h1><span>Gestioná las fichas que aparecen en la página web.</span></div><button onClick={()=>openEditor(null)}>＋ Agregar animal</button></section><section className="adminPanel animalsPanel"><div className="tableTools"><label>⌕ <input aria-label="Buscar animales" placeholder="Buscar por nombre, RP, raza..." value={query} onChange={e=>{setQuery(e.target.value);setPage(1)}}/></label><div><button className={status==="all"?"selected":""} onClick={()=>changeStatus("all")}>Todos {animals.length}</button><button className={status==="published"?"selected":""} onClick={()=>changeStatus("published")}>Publicados {published}</button><button className={status==="draft"?"selected":""} onClick={()=>changeStatus("draft")}>Borradores {animals.length-published}</button></div><select aria-label="Filtrar por categoría" value={category} onChange={e=>{setCategory(e.target.value);setPage(1)}}><option value="all">Todas las categorías</option>{categories.map(item=><option key={item}>{item}</option>)}</select></div>{visible.length?<AnimalRows animals={visible} openEditor={openEditor}/>:<div className="animalSearchEmpty"><span>⌕</span><b>No encontramos animales</b><small>Probá con otra búsqueda o cambiá los filtros.</small></div>}<footer className="tableFooter"><span>Mostrando {visible.length} de {filtered.length} animales</span><div><button disabled={currentPage===1} onClick={()=>setPage(value=>Math.max(1,value-1))}>←</button><b>{currentPage} / {pages}</b><button disabled={currentPage===pages} onClick={()=>setPage(value=>Math.min(pages,value+1))}>→</button></div></footer></section></>
}

function AuctionHomePosition({content,updateContent}:{content:SiteContentMap;updateContent:(values:SiteContentMap)=>void}){
  const [position,setPosition]=useState(content.home_auction_position||"after_genetics");
  const [saving,setSaving]=useState(false);
  const [saved,setSaved]=useState(false);
  const [error,setError]=useState("");
  const savePosition=async()=>{setSaving(true);setSaved(false);setError("");try{const response=await fetch("/api/site-content",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({values:{home_auction_position:position}})});const data=await readApiJson<{content?:SiteContentMap;error?:string}>(response);if(!response.ok||!data.content)throw new Error(data.error||"No se pudo guardar la posición.");updateContent(data.content);setSaved(true);setTimeout(()=>setSaved(false),1800)}catch(cause){setError(cause instanceof Error?cause.message:"No se pudo guardar la posición.")}finally{setSaving(false)}};
  return <section className="adminPanel auctionPositionSettings"><div><small>Portada del sitio</small><h2>Posición del remate</h2><p>Elegí en qué momento aparece el próximo remate dentro de la página de Inicio.</p></div><div><label>Ubicación en Inicio<select value={position} onChange={event=>setPosition(event.target.value)}><option value="before_genetics">Antes de Genética</option><option value="after_genetics">Después de Genética</option><option value="after_carousels">Después de los carruseles</option></select></label><footer><span>{saved?"✓ Posición guardada":"Se aplica al publicar los cambios."}</span><button type="button" disabled={saving} onClick={()=>void savePosition()}>{saving?"Guardando...":"Guardar posición"}</button></footer>{error&&<p className="editorError">{error}</p>}</div></section>;
}

function AdminAuctions({auctions,save,remove}:{auctions:AuctionRecord[];save:(auction:AuctionRecord)=>Promise<void>;remove:(id:number)=>Promise<void>}) {
  const [draft,setDraft]=useState<AuctionRecord|null|undefined>(undefined);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [uploadingImage,setUploadingImage]=useState(false);
  const uploadAuctionImage=async(file:File)=>{if(!draft?.id){setError("Guardá primero el remate para subir su imagen.");return}setUploadingImage(true);setError("");try{const data=await uploadImageDirect<{image?:SiteImageRecord;error?:string}>("/api/site-images",file,{imageKey:`auction-${draft.id}`,label:`Imagen de ${draft.title}`,fallbackUrl:draft.image||"/ranch.jpg"});if(!data.image)throw new Error(data.error||"No se pudo subir la imagen.");setDraft(current=>current?{...current,image:data.image!.url}:current)}catch(cause){setError(cause instanceof Error?cause.message:"No se pudo subir la imagen.")}finally{setUploadingImage(false)}};
  const submit=async(form:HTMLFormElement)=>{setBusy(true);setError("");const data=new FormData(form);try{await save({...draft,title:String(data.get("title")||""),auctionDate:String(data.get("auctionDate")||""),auctionTime:String(data.get("auctionTime")||""),auctioneer:String(data.get("auctioneer")||""),location:String(data.get("location")||""),lots:String(data.get("lots")||""),description:String(data.get("description")||""),catalogUrl:String(data.get("catalogUrl")||""),streamUrl:String(data.get("streamUrl")||""),image:String(data.get("image")||"/ranch.jpg"),status:data.get("status")==="past"?"past":"upcoming",published:data.get("published")==="on",sortOrder:Number(data.get("sortOrder"))||0});setDraft(undefined)}catch(cause){setError(cause instanceof Error?cause.message:"No se pudo guardar el remate.")}finally{setBusy(false)}};
  const fresh:AuctionRecord={title:"",auctionDate:"",auctionTime:"",auctioneer:"",location:"",lots:"",description:"",catalogUrl:"",streamUrl:"",image:"/ranch.jpg",status:"upcoming",published:true,sortOrder:auctions.length+1};
  return <><section className="adminPageHead"><div><p>Eventos y ventas</p><h1>Remates</h1><span>Gestioná fechas, catálogos y transmisiones que aparecen en la página.</span></div><button onClick={()=>setDraft(fresh)}>＋ Crear remate</button></section>{draft!==undefined?<form className="adminPanel auctionEditor" onSubmit={e=>{e.preventDefault();void submit(e.currentTarget)}}><header><div><h2>{draft?.id?"Editar remate":"Nuevo remate"}</h2><p>El diseño público se completa automáticamente con esta información.</p></div><button type="button" onClick={()=>setDraft(undefined)}>×</button></header><div className="auctionForm"><label className="fullField">Título<input name="title" required defaultValue={draft?.title||""} placeholder="Remate Anual de la cabaña"/></label><label>Fecha<input name="auctionDate" type="date" defaultValue={draft?.auctionDate||""}/></label><label>Horario<input name="auctionTime" type="time" defaultValue={draft?.auctionTime||""}/></label><label>Estado<select name="status" defaultValue={draft?.status||"upcoming"}><option value="upcoming">Próximo</option><option value="past">Finalizado</option></select></label><label>Rematador<input name="auctioneer" defaultValue={draft?.auctioneer||""} placeholder="Ej. Escritorio rematador"/></label><label className="fullField">Ubicación<input name="location" defaultValue={draft?.location||""} placeholder="Nombre del establecimiento · Localidad"/></label><label className="fullField">Lotes<input name="lots" defaultValue={draft?.lots||""} placeholder="Toros · vientres seleccionados"/></label><label className="fullField">Descripción<textarea name="description" defaultValue={draft?.description||""} placeholder="Información general del remate..."/></label><label>Enlace del catálogo<input name="catalogUrl" type="url" defaultValue={draft?.catalogUrl||""} placeholder="https://...pdf"/></label><label>Enlace de transmisión<input name="streamUrl" type="url" defaultValue={draft?.streamUrl||""} placeholder="https://youtube.com/..."/></label><div className="auctionImageField fullField"><div style={{backgroundImage:`url(${draft?.image||"/ranch.jpg"})`}}/><section><span>Imagen del remate</span><input name="image" value={draft?.image||"/ranch.jpg"} onChange={e=>setDraft(current=>current?{...current,image:e.target.value}:current)} placeholder="URL de la imagen"/>{draft?.id&&<label className={`auctionImageUpload ${uploadingImage?"disabled":""}`}>
<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={uploadingImage} onChange={e=>{const file=e.target.files?.[0];if(file)void uploadAuctionImage(file);e.currentTarget.value=""}}/>{uploadingImage?"Subiendo...":"Subir desde el equipo"}</label>} {!draft?.id&&<small>Guardá el remate para habilitar la carga de imagen.</small>}</section></div><input type="hidden" name="sortOrder" value={draft?.sortOrder||0}/><label className="publishCheck"><input name="published" type="checkbox" defaultChecked={draft?.published??true}/> Visible en la web</label>{error&&<p className="editorError fullField">{error}</p>}</div><footer>{draft?.id&&<button type="button" className="deleteAuction" onClick={()=>{if(draft.id)void remove(draft.id).then(()=>setDraft(undefined))}}>Eliminar</button>}<button type="button" onClick={()=>setDraft(undefined)}>Cancelar</button><button className="saveAuction" disabled={busy}>{busy?"Guardando...":"Guardar remate"}</button></footer></form>:<section className="auctionAdminGrid">{auctions.map(item=><article key={item.id??item.title}><div className="auctionAdminImage" style={{backgroundImage:`url(${item.image})`}}><span className={item.published?"live":"draft"}>{item.published?"Publicado":"Oculto"}</span></div><div><small>{item.status==="upcoming"?"Próximo remate":"Remate finalizado"}</small><h2>{item.title}</h2><p>{item.auctionDate?new Date(`${item.auctionDate}T12:00:00`).toLocaleDateString("es-AR",{day:"2-digit",month:"long",year:"numeric"}):"Fecha a confirmar"}<br/>{item.location||"Ubicación a confirmar"}</p><span>{item.lots||"Lotes por definir"}</span><button onClick={()=>setDraft(item)}>Editar remate →</button></div></article>)}{!auctions.length&&<div className="mediaEmpty">Todavía no hay remates cargados.</div>}</section>}</>;
}

function HomeCarouselSettings({kind,content,updateContent,publishedCount}:{kind:"news"|"gallery";content:SiteContentMap;updateContent:(values:SiteContentMap)=>void;publishedCount:number}){
  const isNews=kind==="news";
  const visibleKey=isNews?"show_home_news_carousel":"show_home_gallery_carousel";
  const positionKey=isNews?"home_news_carousel_position":"home_gallery_carousel_position";
  const [enabled,setEnabled]=useState(isVisible(content,visibleKey));
  const [position,setPosition]=useState(content[positionKey]||"after_auction");
  const [saving,setSaving]=useState(false);
  const [saved,setSaved]=useState(false);
  const [error,setError]=useState("");
  const save=async()=>{setSaving(true);setSaved(false);setError("");try{const values={[visibleKey]:enabled?"true":"false",[positionKey]:position};const response=await fetch("/api/site-content",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({values})});const data=await readApiJson<{content?:SiteContentMap;error?:string}>(response);if(!response.ok||!data.content)throw new Error(data.error||"No se pudo guardar la configuración.");updateContent(data.content);setSaved(true);setTimeout(()=>setSaved(false),1800)}catch(cause){setError(cause instanceof Error?cause.message:"No se pudo guardar la configuración.")}finally{setSaving(false)}};
  return <section className="adminPanel homeCarouselSettings"><div><small>Portada del sitio</small><h2>Carrusel en Inicio</h2><p>Mostrá las {isNews?"publicaciones":"fotografías"} destacadas también en la página principal.</p>{publishedCount===0&&<span>Necesitás al menos un elemento publicado para que el carrusel aparezca.</span>}</div><div className="carouselSettingControls"><label><span>Mostrar carrusel en Inicio</span><button type="button" className={enabled?"toggleOn":"toggleOff"} onClick={()=>setEnabled(current=>!current)} aria-label={enabled?"Ocultar carrusel en Inicio":"Mostrar carrusel en Inicio"}><i/></button></label><label>Posición en la página<select value={position} disabled={!enabled} onChange={e=>setPosition(e.target.value)}><option value="before_genetics">Antes de Genética</option><option value="before_auction">Antes del Remate</option><option value="after_auction">Después del Remate</option></select></label><div><span>{saved?"✓ Configuración guardada":"Se aplica al publicar los cambios."}</span><button type="button" disabled={saving} onClick={()=>void save()}>{saving?"Guardando...":"Guardar configuración"}</button></div>{error&&<p className="editorError">{error}</p>}</div></section>;
}

function AdminNews({content,updateContent}:{content:SiteContentMap;updateContent:(values:SiteContentMap)=>void}){
  const [posts,setPosts]=useState<NewsRecord[]>([]);const [editor,setEditor]=useState<NewsRecord|null>(null);const [busy,setBusy]=useState(false);const [reordering,setReordering]=useState(false);const [error,setError]=useState("");
  useEffect(()=>{void fetch("/api/news?all=1").then(async response=>{if(!response.ok)return;const data=await response.json() as {posts?:NewsRecord[]};setPosts(data.posts??[])})},[]);
  const fresh:NewsRecord={id:0,title:"",slug:"",excerpt:"",content:"",videoUrl:"",articleImage:null,documentUrl:null,documentFilename:null,category:"Actualidad",image:"/ranch.jpg",published:false,updatedAt:""};
  const submit=async(form:HTMLFormElement)=>{setBusy(true);setError("");try{const data=new FormData(form);const cover=data.get("file");const article=data.get("articleFile");const document=data.get("documentFile");data.delete("file");data.delete("articleFile");data.delete("documentFile");if(cover instanceof File&&cover.size){const uploaded=await uploadImageDirect<{uploaded?:{storageKey:string};error?:string}>("/api/news",cover,{imageKind:"cover"});if(!uploaded.uploaded)throw new Error(uploaded.error||"No se pudo subir la portada.");data.set("coverStorageKey",uploaded.uploaded.storageKey)}if(article instanceof File&&article.size){const uploaded=await uploadImageDirect<{uploaded?:{storageKey:string};error?:string}>("/api/news",article,{imageKind:"article"});if(!uploaded.uploaded)throw new Error(uploaded.error||"No se pudo subir la imagen interior.");data.set("articleStorageKey",uploaded.uploaded.storageKey)}if(document instanceof File&&document.size){const uploaded=await uploadFileDirect<{uploaded?:{storageKey:string};error?:string}>("/api/news",document,{imageKind:"document"});if(!uploaded.uploaded)throw new Error(uploaded.error||"No se pudo subir el PDF.");data.set("documentStorageKey",uploaded.uploaded.storageKey);data.set("documentFilename",document.name)}data.set("published",data.get("published")==="on"?"true":"false");if(editor?.id)data.set("id",String(editor.id));const response=await fetch("/api/news",{method:editor?.id?"PATCH":"POST",body:data});const result=await readApiJson<{post?:NewsRecord;error?:string}>(response);if(!response.ok||!result.post)throw new Error(result.error||"No se pudo guardar la noticia.");setPosts(current=>editor?.id?current.map(item=>item.id===result.post!.id?result.post!:item):[result.post!,...current]);setEditor(null)}catch(cause){setError(cause instanceof Error?cause.message:"No se pudo guardar la noticia.")}finally{setBusy(false)}};
  const remove=async(post:NewsRecord)=>{const response=await fetch(`/api/news?id=${post.id}`,{method:"DELETE"});if(response.ok){setPosts(current=>current.filter(item=>item.id!==post.id));setEditor(null)}};
  const movePost=async(index:number,direction:-1|1)=>{const target=index+direction;if(target<0||target>=posts.length||reordering)return;const previous=[...posts];const ordered=[...posts];[ordered[index],ordered[target]]=[ordered[target],ordered[index]];setPosts(ordered);setReordering(true);setError("");try{const response=await fetch("/api/news",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"reorder",ids:ordered.map(post=>post.id)})});const result=await readApiJson<{ordered?:number[];error?:string}>(response);if(!response.ok||!result.ordered)throw new Error(result.error||"No se pudo guardar el orden.")}catch(cause){setPosts(previous);setError(cause instanceof Error?cause.message:"No se pudo guardar el orden.")}finally{setReordering(false)}};
  return <>
    <section className="adminPageHead"><div><p>Contenido editorial</p><h1>Actualidad</h1><span>Creá y publicá las noticias que aparecen en la web.</span></div><button onClick={()=>setEditor(fresh)}>＋ Nueva noticia</button></section>
    <HomeCarouselSettings kind="news" content={content} updateContent={updateContent} publishedCount={posts.filter(post=>post.published).length}/>
    {editor?<form className="adminPanel newsEditor" onSubmit={e=>{e.preventDefault();void submit(e.currentTarget)}}>
      <header><div><h2>{editor.id?"Editar noticia":"Nueva noticia"}</h2><p>Solo las noticias publicadas aparecen en Actualidad.</p></div><button type="button" onClick={()=>setEditor(null)}>×</button></header>
      <div className="newsForm">
        <label className="fullField">Título<input name="title" required defaultValue={editor.title}/></label>
        <label>Categoría<input name="category" defaultValue={editor.category}/></label>
        <label>Portada horizontal<input name="file" type="file" accept="image/jpeg,image/png,image/webp,image/gif"/><small>Se usa solamente en listados y carruseles.</small></label>
        <label>Imagen interior opcional<input name="articleFile" type="file" accept="image/jpeg,image/png,image/webp,image/gif"/><small>Solo aparece dentro del artículo.</small></label>
        {editor.articleImage&&<label className="newsRemoveImage"><input name="removeArticleImage" type="checkbox" value="true"/> Quitar imagen interior actual</label>}
        <label className="fullField">Documento PDF opcional<input name="documentFile" type="file" accept="application/pdf"/><small>El archivo queda alojado en la web y se ofrece para descargar dentro del artículo.</small></label>
        {editor.documentUrl&&<label className="newsRemoveImage"><input name="removeDocument" type="checkbox" value="true"/> Quitar PDF actual ({editor.documentFilename||"documento.pdf"})</label>}
        <label className="fullField">Video de YouTube<input name="videoUrl" type="url" defaultValue={editor.videoUrl||""} placeholder="https://www.youtube.com/watch?v=..."/><small>Si completás este enlace, el artículo mostrará el reproductor dentro de la página.</small></label>
        <label className="fullField">Resumen<textarea name="excerpt" rows={3} defaultValue={editor.excerpt||""}/></label>
        <label className="fullField">Contenido<textarea name="content" rows={8} defaultValue={editor.content||""}/></label>
        <label className="newsPublish"><input name="published" type="checkbox" defaultChecked={editor.published}/> Publicada en la web</label>
        {error&&<p className="editorError fullField">{error}</p>}
      </div>
      <footer>{editor.id>0&&<button type="button" className="danger" onClick={()=>void remove(editor)}>Eliminar</button>}<button type="button" onClick={()=>setEditor(null)}>Cancelar</button><button className="saveNews" disabled={busy}>{busy?"Guardando...":"Guardar noticia"}</button></footer>
    </form>:<>{error&&<p className="editorError newsOrderError">{error}</p>}<section className="newsAdminGrid">{posts.map((post,index)=><article key={post.id}><div style={{backgroundImage:`url(${post.image})`}}><span className={post.published?"live":"draft"}>{post.published?"Publicada":"Borrador"}</span></div><section><small>Posición {String(index+1).padStart(2,"0")} · {post.category}{post.videoUrl?" · Video":""}{post.documentUrl?" · PDF":""}</small><h2>{post.title}</h2><p>{post.excerpt||"Sin resumen"}</p><div className="newsCardActions"><button onClick={()=>setEditor(post)}>Editar noticia →</button><div className="newsOrderControls" aria-label={`Ordenar ${post.title}`}><button type="button" disabled={index===0||reordering} onClick={()=>void movePost(index,-1)} aria-label={`Subir ${post.title}`}>↑</button><button type="button" disabled={index===posts.length-1||reordering} onClick={()=>void movePost(index,1)} aria-label={`Bajar ${post.title}`}>↓</button></div></div></section></article>)}{!posts.length&&<div className="mediaEmpty">Todavía no hay noticias. La página Actualidad está vacía.</div>}</section></>}
  </>;
}

function AnimalEditor({
  animal,
  categories,
  featuredCount,
  close,
  save,
  remove,
  saved,
}: {
  animal: AnimalRecord | null;
  categories: CategoryRecord[];
  featuredCount: number;
  close: () => void;
  save: (value: AnimalRecord) => Promise<void>;
  remove: () => Promise<void>;
  saved: boolean;
}) {
  const [publishing, setPublishing] = useState(animal?.status === "published");
  const [featured, setFeatured] = useState(Boolean(animal?.featured));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"info" | "pedigree" | "deps" | "gallery">(
    "info",
  );
  const [pedigree, setPedigree] = useState<PedigreeMember[]>(
    animal?.pedigree ?? [],
  );
  const [deps, setDeps] = useState<DepRecord[]>(animal?.deps ?? []);
  const [media, setMedia] = useState<MediaRecord[]>(animal?.media ?? []);
  const [primaryImage, setPrimaryImage] = useState(
    animal?.image || "/animal-black.jpg",
  );
  const [videoUrl, setVideoUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [editorial, setEditorial] = useState({
    introTitle: animal?.introTitle ?? "Potencia, estructura",
    introEmphasis: animal?.introEmphasis ?? "y corrección.",
    introSecondary:
      animal?.introSecondary ??
      "Su pedigree reúne líneas probadas de nuestro programa genético con referentes internacionales de la raza.",
    pedigreeTitle: animal?.pedigreeTitle ?? "Pedigree de",
    pedigreeEmphasis: animal?.pedigreeEmphasis ?? "tres generaciones.",
    pedigreeDescription:
      animal?.pedigreeDescription ??
      "Una genealogía sólida, construida sobre padres y madres que marcaron nuestro rodeo.",
  });
  const uploadPhoto = async (file: File) => {
    if (!animal?.id) {
      setError("Guardá primero la ficha para poder subir fotografías.");
      return;
    }
    setUploading(true);
    setError("");
    try {
      const data = await uploadImageDirect<{
        media?: MediaRecord;
        error?: string;
      }>("/api/media", file, { animalId: animal.id });
      if (!data.media)
        throw new Error(data.error || "No se pudo subir la fotografía.");
      setMedia((current) => [...current, data.media!]);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No se pudo subir la fotografía.",
      );
    } finally {
      setUploading(false);
    }
  };
  const uploadPrimary = async (file: File) => {
    if (!animal?.id) {
      setError(
        "Guardá primero la ficha para reemplazar la fotografía principal.",
      );
      return;
    }
    setUploading(true);
    setError("");
    try {
      const data = await uploadImageDirect<{
        media?: MediaRecord;
        error?: string;
      }>("/api/media", file, { animalId: animal.id });
      if (!data.media?.url)
        throw new Error(data.error || "No se pudo subir la fotografía.");
      setMedia((current) => [...current, data.media!]);
      setPrimaryImage(data.media.url);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No se pudo subir la fotografía.",
      );
    } finally {
      setUploading(false);
    }
  };
  const addVideo = async () => {
    if (!animal?.id) {
      setError("Guardá primero la ficha para agregar un video.");
      return;
    }
    setUploading(true);
    setError("");
    try {
      const response = await fetch("/api/media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ animalId: animal.id, videoUrl }),
      });
      const data = await readApiJson<{ media?: MediaRecord; error?: string }>(
        response,
      );
      if (!response.ok || !data.media)
        throw new Error(data.error || "No se pudo agregar el video.");
      setMedia((current) => [...current, data.media!]);
      setVideoUrl("");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "No se pudo agregar el video.",
      );
    } finally {
      setUploading(false);
    }
  };
  const removeMedia = async (item: MediaRecord) => {
    if (!item.id) return;
    setUploading(true);
    setError("");
    try {
      const response = await fetch(`/api/media?id=${item.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || "No se pudo eliminar el archivo.");
      }
      setMedia((current) => current.filter((entry) => entry.id !== item.id));
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No se pudo eliminar el archivo.",
      );
    } finally {
      setUploading(false);
    }
  };
  const submit = async (
    form: HTMLFormElement,
    status: "published" | "draft",
  ) => {
    setBusy(true);
    setError("");
    const data = new FormData(form);
    try {
      await save({
        ...animal,
        name: String(data.get("name") || ""),
        rp: String(data.get("rp") || ""),
        type: String(data.get("type") || "Toro padre"),
        breed: String(data.get("breed") || "Aberdeen Angus"),
        birthDate: String(data.get("birthDate") || ""),
        coat: String(data.get("coat") || ""),
        registration: String(data.get("registration") || ""),
        description: String(data.get("description") || ""),
        image: primaryImage,
        birthWeight: String(data.get("birthWeight") || ""),
        weaningWeight: String(data.get("weaningWeight") || ""),
        scrotalCircumference: String(data.get("scrotalCircumference") || ""),
        frame: String(data.get("frame") || ""),
        status,
        featured,
        pedigree,
        deps,
        media,
        ...editorial,
      });
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "No se pudo guardar la ficha.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div
      className="editorBackdrop"
      onMouseDown={(e) => e.target === e.currentTarget && close()}
    >
      <form
        className="animalEditor"
        onSubmit={(e) => {
          e.preventDefault();
          void submit(e.currentTarget, publishing ? "published" : "draft");
        }}
      >
        <header>
          <div>
            <small>{animal ? "Editar ficha" : "Nueva ficha"}</small>
            <h2>{animal?.name || "Nuevo animal"}</h2>
          </div>
          <button type="button" onClick={close}>
            ×
          </button>
        </header>
        <div className="editorTabs">
          <button
            type="button"
            onClick={() => setTab("info")}
            className={tab === "info" ? "active" : ""}
          >
            Información
          </button>
          <button
            type="button"
            onClick={() => setTab("pedigree")}
            className={tab === "pedigree" ? "active" : ""}
          >
            Pedigree
          </button>
          <button
            type="button"
            onClick={() => setTab("deps")}
            className={tab === "deps" ? "active" : ""}
          >
            DEPs <span>{deps.length}</span>
          </button>
          <button
            type="button"
            onClick={() => setTab("gallery")}
            className={tab === "gallery" ? "active" : ""}
          >
            Galería
          </button>
        </div>
        <div
          className={`editorBody ${tab !== "info" ? "hiddenEditorBody" : ""}`}
        >
          <div
            className="editorPhoto"
            style={{ backgroundImage: `url(${primaryImage})` }}
          >
            <span>Fotografía principal</span>
            <label className={uploading ? "disabled" : ""}>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                disabled={uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void uploadPrimary(file);
                  e.currentTarget.value = "";
                }}
              />
              {uploading ? "Subiendo..." : "Reemplazar foto"}
            </label>
          </div>
          <input type="hidden" name="image" value={primaryImage} />
          <div className="fieldGrid">
            <label>
              Nombre del animal
              <input
                name="name"
                required
                defaultValue={animal?.name || ""}
                placeholder="Nombre o identificación"
              />
            </label>
            <label>
              RP
              <input
                name="rp"
                required
                defaultValue={animal?.rp || ""}
                placeholder="2890"
              />
            </label>
            <label>
              Categoría
              <select
                name="type"
                defaultValue={
                  animal?.type ||
                  categories.find((item) => item.active)?.name ||
                  "Sin categoría"
                }
              >
                {animal?.type &&
                  !categories.some((item) => item.name === animal.type) && (
                    <option>{animal.type}</option>
                  )}
                {categories
                  .filter((item) => item.active)
                  .map((item) => (
                    <option key={item.id}>{item.name}</option>
                  ))}
              </select>
            </label>
            <label>
              Raza
              <input
                name="breed"
                defaultValue={animal?.breed || "Aberdeen Angus"}
              />
            </label>
            <label>
              Fecha de nacimiento
              <input
                name="birthDate"
                defaultValue={animal?.birthDate || ""}
                placeholder="15/08/2024"
              />
            </label>
            <label>
              Pelaje
              <select name="coat" defaultValue={animal?.coat || "Negro"}>
                <option>Negro</option>
                <option>Colorado</option>
              </select>
            </label>
            <label>
              Registro
              <input
                name="registration"
                defaultValue={animal?.registration || ""}
                placeholder="HBU 867431"
              />
            </label>
            <label>
              Peso al nacer
              <input
                name="birthWeight"
                defaultValue={animal?.birthWeight || ""}
                placeholder="35 kg"
              />
            </label>
            <label>
              Peso al destete
              <input
                name="weaningWeight"
                defaultValue={animal?.weaningWeight || ""}
                placeholder="286 kg"
              />
            </label>
            <label>
              Circunferencia escrotal
              <input
                name="scrotalCircumference"
                defaultValue={animal?.scrotalCircumference || ""}
                placeholder="41 cm"
              />
            </label>
            <label>
              Frame
              <input
                name="frame"
                defaultValue={animal?.frame || ""}
                placeholder="5.8"
              />
            </label>
            <label className="fullField">
              Descripción del animal
              <textarea
                name="description"
                defaultValue={animal?.description || ""}
                placeholder="Descripción breve del ejemplar..."
              />
            </label>
            <label>
              Título editorial
              <input
                value={editorial.introTitle}
                onChange={(e) =>
                  setEditorial((current) => ({
                    ...current,
                    introTitle: e.target.value,
                  }))
                }
                placeholder="Potencia, estructura"
              />
            </label>
            <label>
              Parte destacada del título
              <input
                value={editorial.introEmphasis}
                onChange={(e) =>
                  setEditorial((current) => ({
                    ...current,
                    introEmphasis: e.target.value,
                  }))
                }
                placeholder="y corrección."
              />
            </label>
            <label className="fullField">
              Texto complementario
              <textarea
                value={editorial.introSecondary}
                onChange={(e) =>
                  setEditorial((current) => ({
                    ...current,
                    introSecondary: e.target.value,
                  }))
                }
                placeholder="Texto opcional debajo de la descripción..."
              />
            </label>
          </div>
          <div className="visibilityBox">
            <div>
              <b>Visible en la web</b>
              <small>
                La ficha publicada aparece automáticamente en el catálogo.
              </small>
            </div>
            <button
              type="button"
              onClick={() => setPublishing((v) => !v)}
              className={publishing ? "toggleOn" : "toggleOff"}
              aria-label="Cambiar visibilidad"
            >
              <i />
            </button>
          </div>
          <div className="visibilityBox featuredBox">
            <div>
              <b>Mostrar en Inicio</b>
              <small>
                Elegí hasta dos animales para la portada. Si ninguno está seleccionado, se usan los dos primeros publicados.
              </small>
            </div>
            <button
              type="button"
              onClick={() => {
                if (!featured && featuredCount >= 2) {
                  setError("Ya hay dos animales seleccionados para Inicio. Desmarcá uno antes de elegir otro.");
                  return;
                }
                setError("");
                setFeatured((value) => !value);
              }}
              className={featured ? "toggleOn" : "toggleOff"}
              aria-label="Mostrar este animal en Inicio"
            >
              <i />
            </button>
          </div>
          {error && <p className="editorError">{error}</p>}
        </div>
        {tab === "pedigree" && (
          <div className="editorBody geneticEditor">
            <div className="editorSectionIntro">
              <small>Genealogía</small>
              <h3>Pedigree de tres generaciones</h3>
              <p>
                Completá únicamente los ancestros disponibles. Los espacios
                vacíos se mostrarán como “Sin cargar”.
              </p>
            </div>
            <div className="fieldGrid pedigreeEditorialFields">
              <label>
                Título de la sección
                <input
                  value={editorial.pedigreeTitle}
                  onChange={(e) =>
                    setEditorial((current) => ({
                      ...current,
                      pedigreeTitle: e.target.value,
                    }))
                  }
                  placeholder="Pedigree de"
                />
              </label>
              <label>
                Parte destacada del título
                <input
                  value={editorial.pedigreeEmphasis}
                  onChange={(e) =>
                    setEditorial((current) => ({
                      ...current,
                      pedigreeEmphasis: e.target.value,
                    }))
                  }
                  placeholder="tres generaciones."
                />
              </label>
              <label className="fullField">
                Introducción del pedigree
                <textarea
                  value={editorial.pedigreeDescription}
                  onChange={(e) =>
                    setEditorial((current) => ({
                      ...current,
                      pedigreeDescription: e.target.value,
                    }))
                  }
                  placeholder="Descripción opcional del linaje..."
                />
              </label>
            </div>
            <div className="pedigreeForm">
              {pedigreeLabels.map(([relation, label]) => {
                const member = pedigree.find(
                  (item) => item.relation === relation,
                );
                return (
                  <label key={relation}>
                    <span>{label}</span>
                    <input
                      value={member?.name || ""}
                      placeholder="Nombre del ejemplar"
                      onChange={(e) =>
                        setPedigree((current) => [
                          ...current.filter(
                            (item) => item.relation !== relation,
                          ),
                          {
                            ...member,
                            relation,
                            name: e.target.value,
                            registration: member?.registration || "",
                          },
                        ])
                      }
                    />
                    <input
                      value={member?.registration || ""}
                      placeholder="Registro opcional"
                      onChange={(e) =>
                        setPedigree((current) => [
                          ...current.filter(
                            (item) => item.relation !== relation,
                          ),
                          {
                            ...member,
                            relation,
                            name: member?.name || "",
                            registration: e.target.value,
                          },
                        ])
                      }
                    />
                  </label>
                );
              })}
            </div>
          </div>
        )}
        {tab === "deps" && (
          <div className="editorBody geneticEditor">
            <div className="editorSectionIntro">
              <small>Información genética</small>
              <h3>DEPs y métricas</h3>
              <p>
                Las características son configurables por animal. Solo se
                publican las filas completas.
              </p>
            </div>
            <div className="depsForm">
              <div className="depsFormHead">
                <span>Característica</span>
                <span>Valor</span>
                <span>Precisión</span>
                <span>Percentil</span>
                <span />
              </div>
              {deps.map((dep, index) => (
                <div className="depsFormRow" key={index}>
                  <input
                    value={dep.label}
                    placeholder="Ej. Peso al nacer"
                    onChange={(e) =>
                      setDeps((current) =>
                        current.map((item, i) =>
                          i === index
                            ? { ...item, label: e.target.value }
                            : item,
                        ),
                      )
                    }
                  />
                  <input
                    value={dep.value}
                    placeholder="+0.2"
                    onChange={(e) =>
                      setDeps((current) =>
                        current.map((item, i) =>
                          i === index
                            ? { ...item, value: e.target.value }
                            : item,
                        ),
                      )
                    }
                  />
                  <input
                    value={dep.precision || ""}
                    placeholder="0.72"
                    onChange={(e) =>
                      setDeps((current) =>
                        current.map((item, i) =>
                          i === index
                            ? { ...item, precision: e.target.value }
                            : item,
                        ),
                      )
                    }
                  />
                  <input
                    value={dep.percentile || ""}
                    placeholder="15%"
                    onChange={(e) =>
                      setDeps((current) =>
                        current.map((item, i) =>
                          i === index
                            ? { ...item, percentile: e.target.value }
                            : item,
                        ),
                      )
                    }
                  />
                  <button
                    type="button"
                    aria-label="Eliminar métrica"
                    onClick={() =>
                      setDeps((current) =>
                        current.filter((_, i) => i !== index),
                      )
                    }
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="addDep"
                onClick={() =>
                  setDeps((current) => [
                    ...current,
                    { label: "", value: "", precision: "", percentile: "" },
                  ])
                }
              >
                ＋ Agregar característica
              </button>
            </div>
          </div>
        )}
        {tab === "gallery" && (
          <div className="editorBody geneticEditor">
            <div className="editorSectionIntro">
              <small>Multimedia</small>
              <h3>Galería del animal</h3>
              <p>
                Subí fotografías y agregá un enlace de video. La ficha pública
                se actualiza al guardar.
              </p>
            </div>
            {!animal?.id ? (
              <div className="mediaEmpty">
                Guardá primero la información básica del animal.
              </div>
            ) : (
              <>
                <label className={`mediaUpload ${uploading ? "disabled" : ""}`}>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    disabled={uploading}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void uploadPhoto(file);
                      e.currentTarget.value = "";
                    }}
                  />
                  <span>＋</span>
                  <b>{uploading ? "Procesando..." : "Subir fotografía"}</b>
                  <small>JPG, PNG o WebP · hasta 12 MB</small>
                </label>
                <div className="mediaEditorGrid">
                  {media.map((item, index) => (
                    <article
                      className={item.kind === "video" ? "mediaVideoCard" : ""}
                      key={item.id ?? index}
                      style={
                        item.kind === "image"
                          ? { backgroundImage: `url(${item.url})` }
                          : undefined
                      }
                    >
                      <span>
                        {item.kind === "video"
                          ? "▶ Video"
                          : `Foto ${index + 1}`}
                      </span>
                      {item.kind === "video" && <small>{item.url}</small>}
                      <button
                        type="button"
                        aria-label="Eliminar archivo"
                        disabled={uploading}
                        onClick={() => void removeMedia(item)}
                      >
                        ×
                      </button>
                    </article>
                  ))}
                </div>
                <div className="videoLinkEditor">
                  <div>
                    <b>Enlace de video</b>
                    <small>YouTube, Vimeo u otra plataforma</small>
                  </div>
                  <input
                    type="url"
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    placeholder="https://..."
                  />
                  <button
                    type="button"
                    disabled={uploading || !videoUrl.trim()}
                    onClick={() => void addVideo()}
                  >
                    Agregar video
                  </button>
                </div>
              </>
            )}
            {error && <p className="editorError">{error}</p>}
          </div>
        )}
        <footer>
          {animal?.id && (
            <button
              type="button"
              className="deleteAnimal"
              onClick={() => void remove()}
            >
              Eliminar
            </button>
          )}
          <button type="button" onClick={close}>
            Cancelar
          </button>
          <button
            type="button"
            className="saveDraft"
            disabled={busy}
            onClick={(e) => void submit(e.currentTarget.form!, "draft")}
          >
            Guardar borrador
          </button>
          <button type="submit" className="saveAnimal" disabled={busy}>
            {saved ? "✓ Guardado" : busy ? "Guardando..." : "Guardar cambios"}
          </button>
        </footer>
      </form>
    </div>
  );
}

function AdminMessages() {
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [selected, setSelected] = useState<ContactMessage | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    void fetch("/api/messages")
      .then(async (response) => {
        if (!response.ok) return;
        const data = (await response.json()) as { messages?: ContactMessage[] };
        setMessages(data.messages ?? []);
      })
      .finally(() => setLoading(false));
  }, []);
  const open = async (item: ContactMessage) => {
    setSelected(item);
    if (!item.isRead) {
      const response = await fetch("/api/messages", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, isRead: true }),
      });
      if (response.ok)
        setMessages((current) =>
          current.map((message) =>
            message.id === item.id ? { ...message, isRead: true } : message,
          ),
        );
    }
  };
  const remove = async (item: ContactMessage) => {
    const response = await fetch(`/api/messages?id=${item.id}`, {
      method: "DELETE",
    });
    if (response.ok) {
      setMessages((current) =>
        current.filter((message) => message.id !== item.id),
      );
      setSelected(null);
    }
  };
  const unread = messages.filter((item) => !item.isRead).length;
  return (
    <>
      <section className="adminPageHead">
        <div>
          <p>Bandeja de entrada</p>
          <h1>Consultas</h1>
          <span>
            {unread
              ? `${unread} mensajes sin leer`
              : "Todas las consultas están leídas"}
          </span>
        </div>
      </section>
      <section className="messageWorkspace">
        <div className="adminPanel messageList">
          {loading ? (
            <p className="messageEmpty">Cargando consultas...</p>
          ) : (
            messages.map((item) => (
              <button
                key={item.id}
                className={`${!item.isRead ? "unread" : ""} ${selected?.id === item.id ? "selected" : ""}`}
                onClick={() => void open(item)}
              >
                <span>{item.name.slice(0, 2).toUpperCase()}</span>
                <div>
                  <b>{item.name}</b>
                  <small>{item.subject || "Consulta general"}</small>
                  <p>{item.message}</p>
                </div>
                <time>
                  {new Date(item.createdAt).toLocaleDateString("es-AR")}
                </time>
              </button>
            ))
          )}
          {!loading && !messages.length && (
            <p className="messageEmpty">Todavía no hay consultas.</p>
          )}
        </div>
        <div className="adminPanel messageDetail">
          {selected ? (
            <>
              <header>
                <div>
                  <h2>{selected.subject || "Consulta general"}</h2>
                  <p>
                    {selected.name} · {selected.email}
                  </p>
                </div>
                <button onClick={() => void remove(selected)}>Eliminar</button>
              </header>
              <div>
                <p>{selected.message}</p>
                <dl>
                  <div>
                    <dt>Email</dt>
                    <dd>
                      <a href={`mailto:${selected.email}`}>{selected.email}</a>
                    </dd>
                  </div>
                  <div>
                    <dt>Teléfono</dt>
                    <dd>{selected.phone || "No informado"}</dd>
                  </div>
                  <div>
                    <dt>Recibida</dt>
                    <dd>
                      {new Date(selected.createdAt).toLocaleString("es-AR")}
                    </dd>
                  </div>
                </dl>
                <a
                  className="replyMessage"
                  href={`mailto:${selected.email}?subject=${encodeURIComponent(`Re: ${selected.subject || "Consulta a la cabaña"}`)}`}
                >
                  Responder por email ↗
                </a>
              </div>
            </>
          ) : (
            <div className="messageEmptyDetail">
              <span>✉</span>
              <p>Seleccioná una consulta para leerla.</p>
            </div>
          )}
        </div>
      </section>
    </>
  );
}

function PageContent({siteImages,content,updateSiteImage,updateContent}:{siteImages:SiteImageMap;content:SiteContentMap;updateSiteImage:(image:SiteImageRecord)=>void;updateContent:(values:SiteContentMap)=>void}) {
  const [tab,setTab]=useState<"text"|"sections"|"images">("text");
  const [draft,setDraft]=useState<SiteContentMap>(content);
  const [activePage,setActivePage]=useState("home");
  const [creating,setCreating]=useState(false);
  const [newPageName,setNewPageName]=useState("");
  const [newTemplate,setNewTemplate]=useState<CustomPage["template"]>("editorial");
  const [saving,setSaving]=useState(false);
  const [saved,setSaved]=useState(false);
  const [uploading,setUploading]=useState("");
  const [error,setError]=useState("");
  useEffect(()=>setDraft(content),[content]);
  const customPages=customPagesFromContent(draft);
  const selectedCustom=customPages.find(page=>`custom:${page.id}`===activePage);
  const builtInPages=[{id:"general",label:"General",path:"Todas las páginas"},{id:"home",label:"Inicio",path:"/"},{id:"cabana",label:"La cabaña",path:"/la-cabana"},{id:"genetica",label:"Genética",path:"/genetica"},{id:"criollos",label:"Criollos",path:"/criollos"},{id:"actualidad",label:"Actualidad",path:"/actualidad"},{id:"galeria",label:"Galería",path:"/galeria"},{id:"contacto",label:"Contacto",path:"/contacto"}];
  const groups=[
    {page:"general",title:"Identidad",copy:"Información compartida por todo el sitio.",fields:[{key:"brand_name",label:"Nombre de la cabaña"},{key:"brand_tagline",label:"Lema o especialidad"},{key:"establishment_name",label:"Nombre del establecimiento"},{key:"establishment_location",label:"Ubicación"}]},
    {page:"general",title:"Redes y video",copy:"Solo aparecen los enlaces que tengan contenido.",fields:[{key:"social_instagram",label:"Instagram · enlace completo"},{key:"social_facebook",label:"Facebook · enlace completo"},{key:"social_youtube",label:"YouTube · enlace del canal"},{key:"institutional_video",label:"Video institucional"}]},
    {page:"general",title:"Tipografía",copy:"Elegí la escala general. El diseño y las proporciones de la plantilla se mantienen protegidos.",fields:[{key:"font_size_titles",label:"Tamaño de títulos",options:[{value:"small",label:"Compacto"},{value:"normal",label:"Normal"},{value:"large",label:"Grande"}]},{key:"font_size_body",label:"Tamaño de textos",options:[{value:"small",label:"Compacto"},{value:"normal",label:"Normal"},{value:"large",label:"Grande"}]}]},
    {page:"general",title:"Paleta de colores",copy:"Elegí una identidad cromática preestablecida. La opción se aplica en toda la web al publicar los cambios.",fields:[{key:"color_palette",label:"Estilo de color",options:colorPalettes.map(palette=>({value:palette.id,label:`${palette.name} · ${palette.copy}`}))}]},
    {page:"home",title:"Portada",copy:"El primer mensaje que recibe quien visita el sitio.",fields:[{key:"home_hero_line_1",label:"Título · primera línea"},{key:"home_hero_line_2",label:"Título · segunda línea"},{key:"home_hero_copy",label:"Texto de apertura",long:true}]},
    {page:"home",title:"Presentación",copy:"La introducción institucional de la Home.",fields:[{key:"home_intro_eyebrow",label:"Antetítulo"},{key:"home_intro_line_1",label:"Título · primera línea"},{key:"home_intro_line_2",label:"Título · segunda línea"},{key:"home_intro_copy",label:"Descripción",long:true},{key:"genetics_line_1",label:"Genética · primera línea"},{key:"genetics_line_2",label:"Genética · segunda línea"}]},
    {page:"cabana",title:"Historia de la cabaña",copy:"Presentación principal de la página.",fields:[{key:"cabana_eyebrow",label:"Antetítulo"},{key:"cabana_title_line_1",label:"Título · primera línea"},{key:"cabana_title_line_2",label:"Título · segunda línea"},{key:"cabana_lead",label:"Introducción",long:true},{key:"cabana_story_1",label:"Historia · primer bloque",long:true},{key:"cabana_story_2",label:"Historia · segundo bloque",long:true},{key:"cabana_year",label:"Año de origen"}]},
    {page:"cabana",title:"Historia completa",copy:"Un título o texto vacío no se publica.",fields:[{key:"history_territory_title",label:"Territorio · título"},{key:"history_territory_copy",label:"Territorio · texto",long:true},{key:"history_origins_title",label:"Orígenes · título"},{key:"history_origins_copy",label:"Orígenes · texto",long:true},{key:"history_selection_title",label:"Selección · título"},{key:"history_selection_copy",label:"Selección · texto",long:true},{key:"history_production_title",label:"Producción · título"},{key:"history_production_copy",label:"Producción · texto",long:true},{key:"history_present_title",label:"Trabajo actual · título"},{key:"history_present_copy",label:"Trabajo actual · texto",long:true},{key:"history_sales_title",label:"Venta y tradición · título"},{key:"history_sales_copy",label:"Venta y tradición · texto",long:true}]},
    {page:"cabana",title:"Nuestra manera de hacer",copy:"Editá cada valor institucional. También podés ocultarlos individualmente desde Visibilidad.",fields:[{key:"story_values_eyebrow",label:"Antetítulo"},{key:"story_value_1_title",label:"Valor 1 · título"},{key:"story_value_1_copy",label:"Valor 1 · descripción",long:true},{key:"story_value_2_title",label:"Valor 2 · título"},{key:"story_value_2_copy",label:"Valor 2 · descripción",long:true},{key:"story_value_3_title",label:"Valor 3 · título"},{key:"story_value_3_copy",label:"Valor 3 · descripción",long:true}]},
    {page:"genetica",title:"Introducción del programa",copy:"Presentación institucional de la propuesta genética.",visibilityKey:"show_genetics_intro",fields:[{key:"genetics_title",label:"Programa · título"},{key:"genetics_copy",label:"Programa · descripción",long:true}]},
    {page:"genetica",title:"Indicadores",copy:"Cifras o datos destacados del programa.",visibilityKey:"show_genetics_stats",fields:[{key:"stat_1_value",label:"Indicador 1 · valor"},{key:"stat_1_label",label:"Indicador 1 · descripción"},{key:"stat_2_value",label:"Indicador 2 · valor"},{key:"stat_2_label",label:"Indicador 2 · descripción"},{key:"stat_3_value",label:"Indicador 3 · valor"},{key:"stat_3_label",label:"Indicador 3 · descripción"}]},
    {page:"genetica",title:"Resultados productivos",copy:"Podés ocultar este bloque completo desde la pestaña Visibilidad, con independencia de su imagen.",visibilityKey:"show_genetics_results",fields:[{key:"genetics_cycle_title",label:"Resultados · título"},{key:"genetics_cycle_copy",label:"Resultados · texto",long:true}]},
    {page:"genetica",title:"Portada del catálogo",copy:"Presentación que aparece inmediatamente antes de los animales.",fields:[{key:"genetics_catalog_eyebrow",label:"Antetítulo"},{key:"genetics_catalog_title_line_1",label:"Título · primera línea"},{key:"genetics_catalog_title_line_2",label:"Título · segunda línea"},{key:"genetics_catalog_copy",label:"Descripción",long:true}]},
    {page:"criollos",title:"Criollos",copy:"Historia y propuesta de la caballada.",fields:[{key:"criollos_title_line_1",label:"Título · primera línea"},{key:"criollos_title_line_2",label:"Título · segunda línea"},{key:"criollos_lead",label:"Introducción",long:true},{key:"criollos_story_1",label:"Historia · primer bloque",long:true},{key:"criollos_story_2",label:"Historia · segundo bloque",long:true},{key:"criollos_story_3",label:"Historia · tercer bloque",long:true}]},
    {page:"actualidad",title:"Portada de Actualidad",copy:"El texto introductorio puede dejarse vacío para mostrar una portada más compacta.",fields:[{key:"actualidad_intro",label:"Texto introductorio",long:true}]},
    {page:"galeria",title:"Portada de Galería",copy:"Editá los textos que presentan la galería pública. El antetítulo puede dejarse vacío.",fields:[{key:"gallery_eyebrow",label:"Antetítulo"},{key:"gallery_title_line_1",label:"Título · primera línea"},{key:"gallery_title_line_2",label:"Título · segunda línea"}]},
    {page:"contacto",title:"Contacto",copy:"Información pública y formulario de consultas.",fields:[{key:"contact_line_1",label:"Título · primera línea"},{key:"contact_line_2",label:"Título · segunda línea"},{key:"contact_intro",label:"Introducción",long:true},{key:"contact_email",label:"Email"},{key:"contact_phone",label:"Teléfono / persona de contacto"},{key:"contact_whatsapp",label:"Enlace de WhatsApp"},{key:"contact_location",label:"Ubicación"},{key:"contact_map",label:"Enlace de mapa embebido"}]}
  ];
  const visibilityFields=[
    {page:"general",key:"show_animal_watermark",label:"Marca en fichas de animales",copy:"Sello translúcido junto a la presentación del ejemplar."},{page:"general",key:"show_cabana_watermark",label:"Marca en La cabaña",copy:"Sello translúcido detrás del bloque histórico."},
    {page:"home",key:"show_home_intro",label:"Presentación",copy:"Texto inicial sobre la identidad de la cabaña."},{page:"home",key:"show_home_establishment",label:"Foto del establecimiento",copy:"Bloque fotográfico ancho."},{page:"home",key:"show_home_genetics",label:"Genética destacada",copy:"Programa y animales publicados."},

    {page:"cabana",key:"show_cabana",label:"Página publicada",copy:"Oculta la página completa y la quita de todos los menús."},{page:"cabana",key:"show_history_chapters",label:"Historia completa",copy:"Capítulos extensos de la cabaña."},{page:"cabana",key:"show_story_values",label:"Bloque de valores",copy:"Agrupa la manera de hacer de la cabaña."},{page:"cabana",key:"show_story_value_1",label:"Valor 1",copy:"Primer valor institucional."},{page:"cabana",key:"show_story_value_2",label:"Valor 2",copy:"Segundo valor institucional."},{page:"cabana",key:"show_story_value_3",label:"Valor 3",copy:"Tercer valor institucional."},{page:"cabana",key:"show_cabana_establishment_image",label:"Imagen del establecimiento",copy:"Fotografía grande situada después de la portada."},
    {page:"genetica",key:"show_genetics",label:"Página publicada",copy:"Oculta la página completa, sus accesos y su presencia en los menús."},{page:"genetica",key:"show_genetics_program",label:"Programa genético completo",copy:"Control general de la sección institucional."},{page:"genetica",key:"show_genetics_hero",label:"Portada fotográfica",copy:"Imagen principal del programa genético."},{page:"genetica",key:"show_genetics_intro",label:"Introducción del programa",copy:"Título y descripción institucional."},{page:"genetica",key:"show_genetics_stats",label:"Indicadores",copy:"Hasta tres cifras o datos destacados."},{page:"genetica",key:"show_genetics_results",label:"Resultados productivos",copy:"Bloque final de resultados, con texto e imagen opcional."},{page:"genetica",key:"show_genetics_results_image",label:"Imagen de resultados",copy:"Permite mantener el texto de resultados sin fotografía."},{page:"genetica",key:"show_genetics_catalog",label:"Catálogo de animales",copy:"Listado y filtros de fichas genéticas."},
    {page:"criollos",key:"show_criollos",label:"Página publicada",copy:"También controla su presencia en el menú."},{page:"criollos",key:"show_criollos_image",label:"Imagen principal",copy:"Fotografía protagonista de la página."},{page:"actualidad",key:"show_news",label:"Página publicada",copy:"También controla su presencia en el menú."},{page:"galeria",key:"show_gallery",label:"Página publicada",copy:"También controla su presencia en el menú."},{page:"contacto",key:"show_contact",label:"Página publicada",copy:"También controla su presencia en el menú."},{page:"contacto",key:"show_contact_image",label:"Imagen del formulario",copy:"Fotografía lateral situada junto al formulario."}
  ];
  const fields=[{page:"general",key:"brand-logo",label:"Marca de la estancia",copy:"Logo visible en todo el sitio",fallback:"/template-brand.svg"},
{page:"general",key:"brand-watermark",label:"Marca ganadera",copy:"Sello de agua para secciones institucionales",fallback:"/template-watermark.svg"},
{page:"home",key:"home-hero",label:"Portada principal",copy:"Imagen de apertura",fallback:defaultSiteImages["home-hero"]},{page:"home",key:"establishment",label:"El establecimiento",copy:"Fotografía institucional",fallback:defaultSiteImages.establishment},{page:"genetica",key:"genetics-hero",label:"Programa genético",copy:"Fotografía principal",fallback:defaultSiteImages["genetics-hero"]},{page:"genetica",key:"genetics-cycle",label:"Resultados productivos",copy:"Imagen del bloque de resultados",fallback:defaultSiteImages["genetics-cycle"]},{page:"genetica",key:"animal-gallery-secondary",label:"Galería secundaria",copy:"Respaldo para fichas sin galería",fallback:defaultSiteImages["animal-gallery-secondary"]},{page:"genetica",key:"animal-gallery-tertiary",label:"Galería terciaria",copy:"Tercera imagen de respaldo",fallback:defaultSiteImages["animal-gallery-tertiary"]},{page:"criollos",key:"criollos-hero",label:"Página Criollos",copy:"Imagen protagonista",fallback:defaultSiteImages["criollos-hero"]},{page:"contacto",key:"contact",label:"Página de contacto",copy:"Imagen lateral del formulario",fallback:defaultSiteImages.contact}];
  const upload=async(field:typeof fields[number],file:File)=>{setUploading(field.key);setError("");try{const data=await uploadImageDirect<{image?:SiteImageRecord;error?:string}>("/api/site-images",file,{imageKey:field.key,label:field.label,fallbackUrl:field.fallback});if(!data.image)throw new Error(data.error||"No se pudo reemplazar la imagen.");updateSiteImage(data.image)}catch(cause){setError(cause instanceof Error?cause.message:"No se pudo reemplazar la imagen.")}finally{setUploading("")}};
  const saveText=async()=>{setSaving(true);setSaved(false);setError("");try{const response=await fetch("/api/site-content",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({values:draft})});const data=await response.json() as {content?:SiteContentMap;error?:string};if(!response.ok||!data.content)throw new Error(data.error||"No se pudieron guardar los textos.");updateContent(data.content);setSaved(true);setTimeout(()=>setSaved(false),1800)}catch(cause){setError(cause instanceof Error?cause.message:"No se pudieron guardar los textos.")}finally{setSaving(false)}};
  const updateCustom=(page:CustomPage)=>setDraft(current=>({...current,custom_pages_json:JSON.stringify(customPages.map(item=>item.id===page.id?page:item))}));
  const createPage=()=>{const label=newPageName.trim();if(!label)return;const slug=label.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")||`pagina-${Date.now()}`;const page:CustomPage={id:Date.now().toString(36),slug,menuLabel:label,template:newTemplate,eyebrow:content.brand_name,title:label,lead:"Una nueva página para contar esta parte de la cabaña.",body:"Editá este texto desde el administrador. Podés agregar varios párrafos separándolos con un salto de línea.",heroImage:defaultSiteImages.establishment,published:false};setDraft(current=>({...current,custom_pages_json:JSON.stringify([...customPages,page])}));setActivePage(`custom:${page.id}`);setCreating(false);setNewPageName("");setTab("text")};
  const deleteCustom=()=>{if(!selectedCustom||!window.confirm(`¿Eliminar la página “${selectedCustom.menuLabel}”?`))return;setDraft(current=>({...current,custom_pages_json:JSON.stringify(customPages.filter(page=>page.id!==selectedCustom.id))}));setActivePage("home")};
  const uploadCustom=async(file:File)=>{if(!selectedCustom)return;const field={page:"custom",key:`page-${selectedCustom.id}`,label:selectedCustom.menuLabel,copy:"Imagen principal de la página",fallback:selectedCustom.heroImage||defaultSiteImages.establishment};await upload(field,file);const response=await fetch("/api/site-images?draft=1");if(response.ok){const data=await response.json() as {images?:SiteImageRecord[]};const image=data.images?.find(item=>item.imageKey===field.key);if(image)updateCustom({...selectedCustom,heroImage:image.url})}};
  const currentGroups=groups.filter(group=>group.page===activePage);
  const currentVisibility=visibilityFields.filter(field=>field.page===activePage);
  const currentImages=fields.filter(field=>field.page===activePage);
  return <><section className="adminPageHead"><div><p>Contenido editable</p><h1>Página web</h1><span>Editá cada página por separado o creá una nueva a partir de una plantilla protegida.</span></div><button onClick={()=>setCreating(true)}>＋ Nueva página</button></section><section className="pageManager"><aside className="adminPanel pageList"><header><div><h2>Páginas</h2><p>Seleccioná qué parte del sitio querés editar.</p></div></header>{builtInPages.map(page=><button key={page.id} className={activePage===page.id?"active":""} onClick={()=>{setActivePage(page.id);setTab("text")}}><span><b>{page.label}</b><small>{page.path}</small></span><i>→</i></button>)}{customPages.length>0&&<p className="pageListDivider">Páginas creadas</p>}{customPages.map(page=><button key={page.id} className={activePage===`custom:${page.id}`?"active":""} onClick={()=>{setActivePage(`custom:${page.id}`);setTab("text")}}><span><b>{page.menuLabel}</b><small>/p/{page.slug}</small></span><em className={page.published?"published":"draft"}>{page.published?"Visible":"Oculta"}</em></button>)}</aside><div className="pageEditor">{creating&&<section className="adminPanel newPageBuilder"><header><div><h2>Crear una página</h2><p>Elegí una base visual. Después podrás editar todos sus textos y su fotografía.</p></div><button onClick={()=>setCreating(false)}>×</button></header><label>Nombre de la página<input value={newPageName} onChange={e=>setNewPageName(e.target.value)} placeholder="Ej. Equipo, Servicios o Venta de semen"/></label><div className="templateChoices">{[{id:"editorial",name:"Editorial",copy:"Historia extensa y lectura pausada."},{id:"photographic",name:"Fotográfica",copy:"Una imagen protagonista y poco texto."},{id:"split",name:"Imagen + texto",copy:"Composición equilibrada en dos columnas."}].map(item=><button key={item.id} className={newTemplate===item.id?"active":""} onClick={()=>setNewTemplate(item.id as CustomPage["template"])}><i className={`templatePreview ${item.id}`}/><b>{item.name}</b><span>{item.copy}</span></button>)}</div><footer><button onClick={()=>setCreating(false)}>Cancelar</button><button disabled={!newPageName.trim()} onClick={createPage}>Crear página</button></footer></section>}{selectedCustom?<><section className="customPageHead adminPanel"><div><small>Página personalizada · plantilla {selectedCustom.template}</small><h2>{selectedCustom.menuLabel}</h2><a href={`/p/${selectedCustom.slug}`} target="_blank">Ver página ↗</a></div><label><span>Visible en el menú</span><button type="button" className={selectedCustom.published?"toggleOn":"toggleOff"} onClick={()=>updateCustom({...selectedCustom,published:!selectedCustom.published})}><i/></button></label></section><div className="contentEditorTabs"><button className={tab==="text"?"active":""} onClick={()=>setTab("text")}>Contenido</button><button className={tab==="images"?"active":""} onClick={()=>setTab("images")}>Imagen</button></div>{tab==="text"?<section className="adminPanel customPageForm"><label>Nombre en el menú<input value={selectedCustom.menuLabel} onChange={e=>updateCustom({...selectedCustom,menuLabel:e.target.value})}/></label><label>Dirección de la página<input value={selectedCustom.slug} onChange={e=>updateCustom({...selectedCustom,slug:e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,"-")})}/></label><label>Antetítulo<input value={selectedCustom.eyebrow} onChange={e=>updateCustom({...selectedCustom,eyebrow:e.target.value})}/></label><label>Título<input value={selectedCustom.title} onChange={e=>updateCustom({...selectedCustom,title:e.target.value})}/></label><label className="fullField">Introducción<textarea rows={3} value={selectedCustom.lead} onChange={e=>updateCustom({...selectedCustom,lead:e.target.value})}/></label><label className="fullField">Contenido<textarea rows={9} value={selectedCustom.body} onChange={e=>updateCustom({...selectedCustom,body:e.target.value})}/></label></section>:<section className="adminPanel customImageEditor"><div style={{backgroundImage:`url(${siteImages[`page-${selectedCustom.id}`]||selectedCustom.heroImage})`}}/><label className={uploading?"disabled":""}>
<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={Boolean(uploading)} onChange={e=>{const file=e.target.files?.[0];if(file)void uploadCustom(file);e.currentTarget.value=""}}/>{uploading?"Subiendo…":"Reemplazar fotografía"}</label></section>}<div className="contentSaveBar"><button className="deleteCustomPage" onClick={deleteCustom}>Eliminar página</button><span>{saved?"✓ Página guardada":"Los cambios quedan en borrador hasta publicarlos."}</span><button disabled={saving} onClick={()=>void saveText()}>{saving?"Guardando...":"Guardar página"}</button></div></>:<>{activePage!=="general"&&<div className="selectedPageTitle"><small>{builtInPages.find(page=>page.id===activePage)?.path}</small><h2>{builtInPages.find(page=>page.id===activePage)?.label}</h2></div>}<div className="contentEditorTabs"><button className={tab==="text"?"active":""} onClick={()=>setTab("text")}>Textos</button><button className={tab==="sections"?"active":""} onClick={()=>setTab("sections")}>Visibilidad</button><button className={tab==="images"?"active":""} onClick={()=>setTab("images")}>Imágenes</button></div>{error&&<p className="editorError">{error}</p>}{tab==="text"?<div className="contentForm">{currentGroups.map(group=><section className="adminPanel contentGroup" key={group.title}><header><div><h2>{group.title}</h2><p>{group.copy}</p></div></header><div>{group.fields.map(field=><label key={field.key}><span>{field.label}</span>{"options" in field&&field.options?<select value={draft[field.key]??"normal"} onChange={e=>setDraft(current=>({...current,[field.key]:e.target.value}))}>{field.options.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select>:"long" in field&&field.long?<textarea rows={3} value={draft[field.key]??""} onChange={e=>setDraft(current=>({...current,[field.key]:e.target.value}))}/>:<input value={draft[field.key]??""} onChange={e=>setDraft(current=>({...current,[field.key]:e.target.value}))}/>}</label>)}</div></section>)}{!currentGroups.length&&<div className="adminPanel pageEmptyState"><h2>Esta página administra su contenido desde una sección propia.</h2><p>{activePage==="actualidad"?"Usá Actualidad para crear y editar publicaciones.":activePage==="galeria"?"Usá Fotografías para subir, ordenar y categorizar imágenes.":"No hay textos configurables en esta vista."}</p></div>}<div className="contentSaveBar"><span>{saved?"✓ Cambios guardados":"Los cambios quedan guardados como borrador."}</span><button disabled={saving} onClick={()=>void saveText()}>{saving?"Guardando...":"Guardar cambios"}</button></div></div>:tab==="sections"?<div className="visibilityGrid">{currentVisibility.map(field=>{const visible=isVisible(draft,field.key);return <article className={`adminPanel visibilityCard ${visible?"visible":"hidden"}`} key={field.key}><div><small>{visible?"Visible":"Oculta"}</small><h2>{field.label}</h2><p>{field.copy}</p></div><button type="button" className={visible?"toggleOn":"toggleOff"} onClick={()=>setDraft(current=>({...current,[field.key]:visible?"false":"true"}))}><i/></button></article>})}{!currentVisibility.length&&<div className="adminPanel pageEmptyState"><h2>No hay bloques para ocultar en esta página.</h2></div>}<div className="contentSaveBar"><span>{saved?"✓ Visibilidad guardada":"La visibilidad queda en borrador hasta publicar."}</span><button disabled={saving} onClick={()=>void saveText()}>{saving?"Guardando...":"Guardar visibilidad"}</button></div></div>:<div className="siteImageGrid">{currentImages.map(field=><article key={field.key}><div style={{backgroundImage:`url(${siteImages[field.key]||field.fallback})`}}><span>{uploading===field.key?"Subiendo...":"Imagen activa"}</span></div><section><small>{field.copy}</small><h2>{field.label}</h2><label className={uploading?"disabled":""}>
<input type="file" accept={field.key==="brand-watermark"?"image/svg+xml,image/png,image/webp":"image/jpeg,image/png,image/webp,image/gif"} disabled={Boolean(uploading)} onChange={e=>{const file=e.target.files?.[0];if(file)void upload(field,file);e.currentTarget.value=""}}/>{field.key==="brand-watermark"?"Reemplazar marca":"Reemplazar fotografía"}</label></section></article>)}{!currentImages.length&&<div className="adminPanel pageEmptyState"><h2>Esta página no utiliza una imagen fija de plantilla.</h2></div>}</div>}</>}</div></section></>;
}

function AdminCategories({categories,update}:{categories:CategoryRecord[];update:(categories:CategoryRecord[])=>void}){
  const [name,setName]=useState("");const [error,setError]=useState("");
  const add=async()=>{setError("");const response=await fetch("/api/categories",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name})});const data=await response.json() as {category?:CategoryRecord;error?:string};if(!response.ok||!data.category){setError(data.error||"No se pudo crear la categoría.");return}update([...categories,data.category]);setName("")};
  const save=async(category:CategoryRecord)=>{const response=await fetch("/api/categories",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(category)});const data=await response.json() as {category?:CategoryRecord};if(response.ok&&data.category)update(categories.map(item=>item.id===data.category!.id?data.category!:item))};
  const remove=async(category:CategoryRecord)=>{const response=await fetch(`/api/categories?id=${category.id}`,{method:"DELETE"});if(response.ok)update(categories.filter(item=>item.id!==category.id))};
  return <><section className="adminPageHead"><div><p>Catálogo genético</p><h1>Categorías</h1><span>Definí las categorías que aparecen en los filtros y en las fichas de animales.</span></div></section><section className="adminPanel categoryManager"><header><div><h2>Categorías de animales</h2><p>Podés agregar, renombrar, ocultar o eliminar categorías.</p></div></header><div className="categoryAdd"><input value={name} onChange={e=>setName(e.target.value)} placeholder="Nueva categoría"/><button disabled={!name.trim()} onClick={()=>void add()}>＋ Agregar</button></div>{error&&<p className="editorError">{error}</p>}<div className="categoryRows">{categories.map(category=><div key={category.id}><input value={category.name} onChange={e=>update(categories.map(item=>item.id===category.id?{...item,name:e.target.value}:item))}/><label><input type="checkbox" checked={category.active} onChange={e=>void save({...category,active:e.target.checked})}/> Visible</label><button onClick={()=>void save(category)}>Guardar</button><button className="danger" onClick={()=>void remove(category)}>Eliminar</button></div>)}</div></section></>;
}

function MediaLibrary({content,updateContent}:{content:SiteContentMap;updateContent:(values:SiteContentMap)=>void}){
  const [items,setItems]=useState<GalleryMediaRecord[]>([]);const [categories,setCategories]=useState<CategoryRecord[]>([]);const [newCategory,setNewCategory]=useState("");const [uploadCategory,setUploadCategory]=useState("");const [uploading,setUploading]=useState(false);const [uploadProgress,setUploadProgress]=useState("");const [ordering,setOrdering]=useState(false);const [error,setError]=useState("");
  useEffect(()=>{void Promise.all([fetch("/api/gallery?all=1"),fetch("/api/gallery-categories?all=1")]).then(async([mediaResponse,categoryResponse])=>{if(mediaResponse.ok){const data=await mediaResponse.json() as {media?:GalleryMediaRecord[]};setItems(data.media??[])}if(categoryResponse.ok){const data=await categoryResponse.json() as {categories?:CategoryRecord[]};setCategories(data.categories??[]);setUploadCategory(data.categories?.find(item=>item.active)?.name??"")}})},[]);

  const upload=async(files:File[])=>{setUploading(true);setError("");try{if(!uploadCategory)throw new Error("Creá o seleccioná una categoría antes de subir las fotos.");for(let index=0;index<files.length;index++){const file=files[index];setUploadProgress(`${index+1} de ${files.length}`);const data=await uploadImageDirect<{media?:GalleryMediaRecord;error?:string}>("/api/gallery",file,{category:uploadCategory,caption:""});if(!data.media)throw new Error(data.error||`No se pudo subir ${file.name}.`);setItems(current=>[...current,data.media!])}}catch(cause){setError(cause instanceof Error?cause.message:"No se pudieron subir las fotografías.")}finally{setUploading(false);setUploadProgress("")}};

  const save=async(item:GalleryMediaRecord)=>{const response=await fetch("/api/gallery",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(item)});const data=await response.json() as {media?:GalleryMediaRecord};if(response.ok&&data.media)setItems(current=>current.map(row=>row.id===data.media!.id?data.media!:row))};
  const remove=async(item:GalleryMediaRecord)=>{const response=await fetch(`/api/gallery?id=${item.id}`,{method:"DELETE"});if(response.ok)setItems(current=>current.filter(row=>row.id!==item.id))};
  const move=async(index:number,direction:-1|1)=>{const target=index+direction;if(target<0||target>=items.length||ordering)return;const previous=items;const next=[...items];[next[index],next[target]]=[next[target],next[index]];setItems(next);setOrdering(true);setError("");try{const response=await fetch("/api/gallery",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({order:next.map(item=>item.id)})});const data=await response.json() as {media?:GalleryMediaRecord[];error?:string};if(!response.ok||!data.media)throw new Error(data.error||"No se pudo guardar el orden.");setItems(data.media)}catch(cause){setItems(previous);setError(cause instanceof Error?cause.message:"No se pudo guardar el orden.")}finally{setOrdering(false)}};
  const addCategory=async()=>{setError("");const response=await fetch("/api/gallery-categories",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:newCategory})});const data=await response.json() as {category?:CategoryRecord;error?:string};if(!response.ok||!data.category){setError(data.error||"No se pudo crear la categoría.");return}setCategories(current=>[...current,data.category!]);setUploadCategory(data.category.name);setNewCategory("")};
  const saveCategory=async(category:CategoryRecord)=>{const response=await fetch("/api/gallery-categories",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(category)});const data=await response.json() as {category?:CategoryRecord};if(response.ok&&data.category)setCategories(current=>current.map(item=>item.id===data.category!.id?data.category!:item))};
  const removeCategory=async(category:CategoryRecord)=>{const response=await fetch(`/api/gallery-categories?id=${category.id}`,{method:"DELETE"});if(response.ok){setCategories(current=>current.filter(item=>item.id!==category.id));if(uploadCategory===category.name)setUploadCategory("")}};
  const activeCategories=categories.filter(item=>item.active);
  return <><section className="adminPageHead"><div><p>Galería pública</p><h1>Fotografías</h1><span>Subí varias imágenes, organizalas y elegí cuáles aparecen en la página Galería.</span></div><div className="galleryUploadActions"><select value={uploadCategory} onChange={e=>setUploadCategory(e.target.value)}><option value="">Seleccionar categoría</option>{activeCategories.map(item=><option key={item.id}>{item.name}</option>)}</select><label className={`galleryUpload ${uploading||!uploadCategory?"disabled":""}`}><input type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif" disabled={uploading||!uploadCategory} onChange={e=>{const files=Array.from(e.target.files??[]);if(files.length)void upload(files);e.currentTarget.value=""}}/>{uploading?`Subiendo ${uploadProgress}…`:"＋ Subir fotografías"}</label></div></section>{error&&<p className="editorError">{error}</p>}<HomeCarouselSettings kind="gallery" content={content} updateContent={updateContent} publishedCount={items.filter(item=>item.published).length}/><section className="adminPanel galleryCategoryManager"><header><div><h2>Categorías de galería</h2><p>Organizan la carga de fotos y los filtros de la galería pública.</p></div></header><div className="categoryAdd"><input value={newCategory} onChange={e=>setNewCategory(e.target.value)} placeholder="Nueva categoría de galería"/><button disabled={!newCategory.trim()} onClick={()=>void addCategory()}>＋ Agregar</button></div><div className="categoryRows">{categories.map(category=><div key={category.id}><input value={category.name} onChange={e=>setCategories(current=>current.map(item=>item.id===category.id?{...item,name:e.target.value}:item))}/><label><input type="checkbox" checked={category.active} onChange={e=>void saveCategory({...category,active:e.target.checked})}/> Visible</label><button onClick={()=>void saveCategory(category)}>Guardar</button><button className="danger" onClick={()=>void removeCategory(category)}>Eliminar</button></div>)}</div></section>{items.length>1&&<div className="galleryOrderHint">Usá las flechas para definir el orden de aparición. Los cambios se guardan automáticamente.</div>}<div className="galleryAdminGrid">{items.map((item,index)=><article key={item.id}><div style={{backgroundImage:`url(${item.url})`}}><span>{item.published?"Visible":"Oculta"}</span><div className="galleryOrderControls"><button disabled={ordering||index===0} onClick={()=>void move(index,-1)} aria-label="Mover fotografía antes">←</button><b>{index+1}</b><button disabled={ordering||index===items.length-1} onClick={()=>void move(index,1)} aria-label="Mover fotografía después">→</button></div></div><section><input value={item.caption||""} placeholder="Descripción de la foto" onChange={e=>setItems(current=>current.map(row=>row.id===item.id?{...row,caption:e.target.value}:row))}/><select value={item.category||""} onChange={e=>setItems(current=>current.map(row=>row.id===item.id?{...row,category:e.target.value}:row))}>{item.category&&!categories.some(category=>category.name===item.category)&&<option>{item.category}</option>}{activeCategories.map(category=><option key={category.id}>{category.name}</option>)}</select><footer><label><input type="checkbox" checked={item.published} onChange={e=>void save({...item,published:e.target.checked})}/> Visible en la web</label><button onClick={()=>void save(item)}>Guardar</button><button className="danger" onClick={()=>void remove(item)}>Eliminar</button></footer></section></article>)}</div>{!items.length&&!uploading&&<div className="mediaEmpty">Todavía no hay fotografías cargadas. La galería pública también está vacía.</div>}</>;
}

function ContentModel(){return <><section className="adminPageHead"><div><p>Plantilla reutilizable</p><h1>Estructura del contenido</h1><span>El cliente administra la información; el diseño queda centralizado y protegido.</span></div><button>Exportar esquema</button></section><section className="modelFlow"><article><small>Nivel 01</small><h2>Cabaña</h2><p>Identidad, dominio, información institucional, equipo y contacto.</p><div><span>Logo</span><span>Colores</span><span>Historia</span><span>Ubicación</span></div></article><i>→</i><article><small>Nivel 02</small><h2>Animales</h2><p>Catálogo organizado mediante categorías configurables.</p><div><span>Toros</span><span>Vientres</span><span>Donantes</span><span>Vaquillonas</span></div></article><i>→</i><article><small>Nivel 03</small><h2>Ficha genética</h2><p>Registro único con datos, relaciones genealógicas y archivos.</p><div><span>Datos</span><span>Pedigree</span><span>DEPs</span><span>Galería</span></div></article></section><section className="adminPanel schemaPanel"><header><div><h2>Entidades principales</h2><p>Base propuesta para convertir la plantilla en producto.</p></div><span>7 colecciones</span></header><div>{[["Cabañas","Identidad y configuración por cliente","1 → muchos animales"],["Usuarios","Accesos y permisos del administrador","Roles: propietario / editor"],["Animales","Ficha principal de cada ejemplar","Pertenece a una cabaña"],["Pedigree","Relaciones padre, madre y ancestros","Hasta 3 generaciones"],["Datos genéticos","DEPs y métricas configurables","Opcionales por ficha"],["Multimedia","Fotos, videos y documentos","Reutilizables"],["Remates","Eventos, catálogos y transmisiones","Publicación programable"]].map((row,i)=><div key={row[0]}><b><i>0{i+1}</i>{row[0]}</b><span>{row[1]}</span><small>{row[2]}</small></div>)}</div></section></>}

function EmptyAdmin({title,copy,action}:{title:string;copy:string;action:string}){return <div className="emptyAdmin"><span>◇</span><p>Contenido editable</p><h1>{title}</h1><small>{copy}</small><button>＋ {action}</button></div>}

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
    if(initialScreen==="admin")delete document.body.dataset.palette;
    else document.body.dataset.palette=content.color_palette||"tierra";
    return()=>{delete document.body.dataset.palette};
  },[content.color_palette,initialScreen]);
  useEffect(()=>{if(initialScreen!=="admin")return;const cached=readCachedSiteIdentity();if(cached.brandName)setContent(current=>({...current,brand_name:cached.brandName!}));if(cached.logo)setSiteImages(current=>({...current,"brand-logo":cached.logo!}))},[initialScreen]);
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
    const imageRequest=fetch(draftMode?"/api/site-images?draft=1":"/api/site-images").then(async response=>{if(!response.ok)throw new Error("No se pudieron cargar las imágenes del sitio.");const data=await response.json() as {images?:SiteImageRecord[];hasDraft?:boolean};if(data.images?.length){setSiteImages(current=>({...current,...Object.fromEntries(data.images!.map(image=>[image.imageKey,image.url]))}));const logo=data.images.find(image=>image.imageKey==="brand-logo");if(logo)cacheSiteIdentity({logo:logo.url})}if(data.hasDraft)setPublicationPending(true)}).catch(()=>setCriticalDataFailed(true));
    const contentRequest=fetch(draftMode?"/api/site-content?draft=1":"/api/site-content").then(async response=>{if(!response.ok)throw new Error("No se pudo cargar la identidad del sitio.");const data=await response.json() as {content?:SiteContentMap;hasDraft?:boolean};if(data.content){setContent(current=>({...current,...data.content}));if(data.content.brand_name)cacheSiteIdentity({brandName:data.content.brand_name})}if(data.hasDraft)setPublicationPending(true)}).catch(()=>setCriticalDataFailed(true));
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
  const openAnimal=(animal:AnimalRecord)=>{if(animal.id){const slug=animal.name.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");window.location.assign(`/genetica/${animal.id}-${slug}`);return}setSelectedAnimal(animal);go("animal")};
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
