"use client";

import { useEffect, useRef, useState } from "react";
import type * as React from "react";
import { readApiJson, uploadFileDirect, uploadImageDirect } from "../lib/client-upload";
import { createBrowserSupabaseClient } from "../lib/supabase/client";
import { readAnimalImagePresentation, writeAnimalImagePresentation, type AnimalImageFit } from "../lib/animal-image";
import {
  Brand,
  SiteImageContext,
  colorPalettes,
  typographyPresets,
  customPagesFromContent,
  defaultContent,
  defaultSiteImages,
  findNextAuction,
  isVisible,
  pedigreeLabels,
  useSiteContent,
} from "./page";
import type {
  AdminSection,
  AnimalRecord,
  AuctionRecord,
  CategoryRecord,
  ContactMessage,
  CustomPage,
  DepRecord,
  GalleryMediaRecord,
  MediaRecord,
  NewsRecord,
  PedigreeMember,
  PublicationRecord,
  Screen,
  SiteContentMap,
  SiteImageMap,
  SiteImageRecord,
} from "./page";

export default function Admin({ go, animals, categories, updateCategories, auctions, siteImages, content, publicationPending, updateSiteImage, updateContent, publishSite, restorePublication, saveAnimal, deleteAnimal, saveAuction, deleteAuction }: { go: (s: Screen) => void; animals: AnimalRecord[]; categories:CategoryRecord[]; updateCategories:(categories:CategoryRecord[])=>void; auctions: AuctionRecord[]; siteImages:SiteImageMap; content:SiteContentMap; publicationPending:boolean; updateSiteImage:(image:SiteImageRecord)=>void; updateContent:(values:SiteContentMap)=>void; publishSite:()=>Promise<PublicationRecord>; restorePublication:(id:number)=>Promise<void>; saveAnimal: (animal: AnimalRecord) => Promise<void>; deleteAnimal: (id: number) => Promise<void>; saveAuction:(auction:AuctionRecord)=>Promise<void>; deleteAuction:(id:number)=>Promise<void> }) {
  const [section,setSection]=useState<AdminSection>("resumen");
  const [editor,setEditor]=useState<AnimalRecord|null|undefined>(undefined);
  const [saved,setSaved]=useState(false);
  const [publishing,setPublishing]=useState(false);
  const [publicationMessage,setPublicationMessage]=useState("");
  const [history,setHistory]=useState<PublicationRecord[]>([]);
  useEffect(()=>{void fetch("/api/publication").then(async response=>{if(response.ok){const data=await response.json() as {publications?:PublicationRecord[]};setHistory(data.publications??[])}})},[]);
  const publish=async()=>{setPublishing(true);setPublicationMessage("");try{const publication=await publishSite();setHistory(current=>[publication,...current].slice(0,8));setPublicationMessage("✓ Sitio publicado")}catch(cause){setPublicationMessage(cause instanceof Error?cause.message:"No se pudo publicar.")}finally{setPublishing(false)}};
  const restore=async(item:PublicationRecord)=>{if(!window.confirm(`¿Restaurar la versión del ${new Date(item.publishedAt).toLocaleString("es-AR")}?`))return;setPublishing(true);setPublicationMessage("");try{await restorePublication(item.id);setPublicationMessage("✓ Versión restaurada")}catch(cause){setPublicationMessage(cause instanceof Error?cause.message:"No se pudo restaurar.")}finally{setPublishing(false)}};
  const labels: Record<AdminSection,string> = {resumen:"Resumen",animales:"Animales",categorias:"Categorías",actualidad:"Actualidad",remates:"Remates",consultas:"Consultas",pagina:"Página web",multimedia:"Galería",cuenta:"Mi cuenta"};
  const choose=(value:AdminSection)=>{setSection(value);setEditor(undefined);setSaved(false)};
  return <div className="adminShell">
    <aside className="adminSidebar">
      <div className="adminBrand"><Brand/><span>Administrador</span></div>
      <nav aria-label="Secciones del administrador">
        {(["resumen","animales","categorias","actualidad","remates","consultas","pagina","multimedia","cuenta"] as AdminSection[]).map((item,i)=><button key={item} className={section===item?"active":""} onClick={()=>choose(item)}><i>{["⌂","♧","≡","◫","◇","✉","▤","▧","○"][i]}</i>{labels[item]}{item==="animales"&&<b>{animals.length}</b>}</button>)}
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
        {section==="cuenta"&&<AccountSettings/>}
      </main>
    </div>
    {editor!==undefined&&<AnimalEditor animal={editor} categories={categories} featuredCount={animals.filter(item=>item.featured&&item.catalogSection===(editor?.catalogSection||"genetics")&&item.id!==editor?.id).length} close={()=>setEditor(undefined)} save={async(value)=>{await saveAnimal(value);setSaved(true);setTimeout(()=>setEditor(undefined),650)}} remove={async()=>{if(editor?.id){await deleteAnimal(editor.id);setEditor(undefined)}}} saved={saved}/>}
  </div>;
}

function AccountSettings(){
  const [email,setEmail]=useState("");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");
  useEffect(()=>{const load=async()=>{const result=await createBrowserSupabaseClient().auth.getUser();setEmail(result.data.user?.email||"")};void load()},[]);
  const submit=async(event:React.FormEvent<HTMLFormElement>)=>{event.preventDefault();setBusy(true);setMessage("");setError("");const form=event.currentTarget;const data=new FormData(form);const currentPassword=String(data.get("currentPassword")||"");const password=String(data.get("password")||"");const confirmation=String(data.get("confirmation")||"");if(password.length<8){setError("La contraseña nueva debe tener al menos 8 caracteres.");setBusy(false);return}if(password!==confirmation){setError("Las contraseñas nuevas no coinciden.");setBusy(false);return}const {error:authError}=await createBrowserSupabaseClient().auth.updateUser({password,current_password:currentPassword});if(authError){setError(authError.message.toLowerCase().includes("password")?"No se pudo cambiar la contraseña. Revisá la contraseña actual y volvé a intentarlo.":authError.message);setBusy(false);return}form.reset();setMessage("✓ Contraseña actualizada");setBusy(false)};
  return <><section className="adminPageHead"><div><p>Seguridad</p><h1>Mi cuenta</h1><span>Cada persona administra la web con su propio usuario.</span></div></section><div className="accountSettingsGrid"><form className="adminPanel passwordPanel" onSubmit={submit}><header><div><h2>Cambiar contraseña</h2><p>{email||"Usuario autenticado"}</p></div></header><div><label>Contraseña actual<input name="currentPassword" type="password" autoComplete="current-password" required/></label><label>Nueva contraseña<input name="password" type="password" autoComplete="new-password" minLength={8} required/><small>Mínimo 8 caracteres.</small></label><label>Repetir nueva contraseña<input name="confirmation" type="password" autoComplete="new-password" minLength={8} required/></label>{error&&<p className="accountError" role="alert">{error}</p>}{message&&<p className="accountSuccess" role="status">{message}</p>}<button disabled={busy}>{busy?"Actualizando...":"Actualizar contraseña"}</button></div></form><section className="adminPanel accessInfoPanel"><header><div><h2>Accesos independientes</h2><p>Protección para la cabaña y su equipo.</p></div></header><div><b>No compartas esta contraseña</b><p>El propietario y el administrador técnico pueden tener usuarios distintos. Cada uno inicia sesión con su propio correo y la contraseña del cliente nunca queda expuesta.</p><span>Los accesos adicionales se asignan únicamente a esta cabaña desde su proyecto de Supabase.</span></div></section></div></>;
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

function AnimalRows({animals,compact=false,openEditor}:{animals:AnimalRecord[];compact?:boolean;openEditor:(animal:AnimalRecord)=>void}) {return <div className="adminTable"><div className="adminTableHead"><span>Animal</span><span>Categoría</span><span>Estado</span><span>Actualización</span><span/></div>{animals.slice(0,compact?3:animals.length).map(a=><button className="adminRow" key={a.id??a.name} onClick={()=>openEditor(a)}><span className="rowAnimal"><i style={{backgroundImage:`url(${a.image})`}}/><b>{a.name}<small>RP {a.rp} · {a.breed}</small></b></span><span>{a.type}</span><span className={`statusPill ${a.status==="draft"?"draft":a.sold?"sold":""}`}><i/>{a.status==="draft"?"Borrador":a.sold?"Vendido":"Publicado"}</span><span>{a.updatedAt?new Date(a.updatedAt).toLocaleDateString("es-AR"):"Sincronizado"}</span><span>•••</span></button>)}</div>}

function AdminAnimals({openEditor,animals}:{openEditor:(animal:AnimalRecord|null)=>void;animals:AnimalRecord[]}) {
  const [query,setQuery]=useState("");
  const [status,setStatus]=useState<"all"|"published"|"draft">("all");
  const [catalog,setCatalog]=useState<"genetics"|"criollos">("genetics");
  const [category,setCategory]=useState("all");
  const [page,setPage]=useState(1);
  const pageSize=8;
  const catalogAnimals=animals.filter(animal=>(animal.catalogSection||"genetics")===catalog);
  const published=catalogAnimals.filter(a=>a.status==="published").length;
  const categories=[...new Set(catalogAnimals.map(animal=>animal.type).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"es"));
  const normalized=query.trim().toLocaleLowerCase("es");
  const filtered=catalogAnimals.filter(animal=>(status==="all"||animal.status===status)&&(category==="all"||animal.type===category)&&(!normalized||[animal.name,animal.rp,animal.breed,animal.type].some(value=>value.toLocaleLowerCase("es").includes(normalized))));
  const pages=Math.max(1,Math.ceil(filtered.length/pageSize));
  const currentPage=Math.min(page,pages);
  const visible=filtered.slice((currentPage-1)*pageSize,currentPage*pageSize);
  const changeStatus=(value:"all"|"published"|"draft")=>{setStatus(value);setPage(1)};
  return <><section className="adminPageHead"><div><p>Catálogos</p><h1>Animales</h1><span>Gestioná ganado y caballos Criollos por separado.</span></div><button onClick={()=>openEditor(null)}>＋ Agregar animal</button></section><section className="adminPanel animalsPanel"><div className="categoryScope"><button className={catalog==="genetics"?"active":""} onClick={()=>{setCatalog("genetics");setCategory("all");setPage(1)}}>Ganado</button><button className={catalog==="criollos"?"active":""} onClick={()=>{setCatalog("criollos");setCategory("all");setPage(1)}}>Criollos</button></div><div className="tableTools"><label>⌕ <input aria-label="Buscar animales" placeholder="Buscar por nombre, RP, raza..." value={query} onChange={e=>{setQuery(e.target.value);setPage(1)}}/></label><div><button className={status==="all"?"selected":""} onClick={()=>changeStatus("all")}>Todos {catalogAnimals.length}</button><button className={status==="published"?"selected":""} onClick={()=>changeStatus("published")}>Publicados {published}</button><button className={status==="draft"?"selected":""} onClick={()=>changeStatus("draft")}>Borradores {catalogAnimals.length-published}</button></div><select aria-label="Filtrar por categoría" value={category} onChange={e=>{setCategory(e.target.value);setPage(1)}}><option value="all">Todas las categorías</option>{categories.map(item=><option key={item}>{item}</option>)}</select></div>{visible.length?<AnimalRows animals={visible} openEditor={openEditor}/>:<div className="animalSearchEmpty"><span>⌕</span><b>No encontramos animales</b><small>Probá con otra búsqueda o cambiá los filtros.</small></div>}<footer className="tableFooter"><span>Mostrando {visible.length} de {filtered.length} animales</span><div><button disabled={currentPage===1} onClick={()=>setPage(value=>Math.max(1,value-1))}>←</button><b>{currentPage} / {pages}</b><button disabled={currentPage===pages} onClick={()=>setPage(value=>Math.min(pages,value+1))}>→</button></div></footer></section></>
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
  const labelDefaults = (section: "genetics" | "criollos") => ({
    rpLabel: "RP", birthDateLabel: "Nacimiento", coatLabel: "Pelaje", registrationLabel: "Registro",
    birthWeightLabel: section === "criollos" ? "Sexo" : "Peso al nacer",
    weaningWeightLabel: section === "criollos" ? "Categoría" : "Peso al destete",
    scrotalCircumferenceLabel: section === "criollos" ? "Marcha" : "Circ. escrotal",
    frameLabel: section === "criollos" ? "Estado" : "Frame",
  });
  const [publishing, setPublishing] = useState(animal?.status === "published");
  const [featured, setFeatured] = useState(Boolean(animal?.featured));
  const [sold, setSold] = useState(Boolean(animal?.sold));
  const [catalogSection, setCatalogSection] = useState<"genetics" | "criollos">(animal?.catalogSection === "criollos" ? "criollos" : "genetics");
  const initialLabels = labelDefaults(animal?.catalogSection === "criollos" ? "criollos" : "genetics");
  const [fieldLabels, setFieldLabels] = useState({
    rpLabel: animal?.rpLabel ?? initialLabels.rpLabel,
    birthDateLabel: animal?.birthDateLabel ?? initialLabels.birthDateLabel,
    coatLabel: animal?.coatLabel ?? initialLabels.coatLabel,
    registrationLabel: animal?.registrationLabel ?? initialLabels.registrationLabel,
    birthWeightLabel: animal?.birthWeightLabel ?? initialLabels.birthWeightLabel,
    weaningWeightLabel: animal?.weaningWeightLabel ?? initialLabels.weaningWeightLabel,
    scrotalCircumferenceLabel: animal?.scrotalCircumferenceLabel ?? initialLabels.scrotalCircumferenceLabel,
    frameLabel: animal?.frameLabel ?? initialLabels.frameLabel,
  });
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
  const initialImagePresentation = readAnimalImagePresentation(animal?.image);
  const [primaryImage, setPrimaryImage] = useState(initialImagePresentation.source);
  const [imageFit, setImageFit] = useState<AnimalImageFit>(initialImagePresentation.fit);
  const [imagePositionX, setImagePositionX] = useState(initialImagePresentation.x);
  const [imagePositionY, setImagePositionY] = useState(initialImagePresentation.y);
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
        geneticsProviderName: String(data.get("geneticsProviderName") || ""),
        geneticsProviderUrl: String(data.get("geneticsProviderUrl") || ""),
        catalogSection,
        image: writeAnimalImagePresentation(primaryImage, imageFit, imagePositionX, imagePositionY),
        birthWeight: String(data.get("birthWeight") || ""),
        weaningWeight: String(data.get("weaningWeight") || ""),
        scrotalCircumference: String(data.get("scrotalCircumference") || ""),
        frame: String(data.get("frame") || ""),
        ...fieldLabels,
        status,
        featured,
        sold,
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
            {catalogSection === "criollos" ? "Datos adicionales" : "DEPs"} <span>{deps.length}</span>
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
            style={{ backgroundImage: `url(${primaryImage})`, backgroundSize: imageFit, backgroundPosition: `${imagePositionX}% ${imagePositionY}%`, backgroundRepeat: "no-repeat" }}
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
          <div className="imageFrameControls">
            <div>
              <b>Encuadre de la foto</b>
              <small>Elegí “Imagen completa” para evitar que se corte el animal.</small>
            </div>
            <label>
              Ajuste
              <select value={imageFit} onChange={event=>setImageFit(event.target.value as AnimalImageFit)}>
                <option value="cover">Llenar el espacio</option>
                <option value="contain">Imagen completa</option>
              </select>
            </label>
            <label>
              Posición horizontal
              <input type="range" min="0" max="100" value={imagePositionX} onChange={event=>setImagePositionX(Number(event.target.value))}/>
            </label>
            <label>
              Posición vertical
              <input type="range" min="0" max="100" value={imagePositionY} onChange={event=>setImagePositionY(Number(event.target.value))}/>
            </label>
            <button type="button" onClick={()=>{setImageFit("contain");setImagePositionX(50);setImagePositionY(50)}}>Centrar y mostrar completa</button>
          </div>
          <div className="fieldGrid">
            <label className="fullField">
              Catálogo de venta
              <select value={catalogSection} onChange={(event) => {const next=event.target.value as "genetics"|"criollos";const previous=labelDefaults(catalogSection);const defaults=labelDefaults(next);setCatalogSection(next);setFieldLabels(current=>Object.fromEntries(Object.entries(current).map(([key,value])=>[key,value===previous[key as keyof typeof previous]?defaults[key as keyof typeof defaults]:value])) as typeof current)}}>
                <option value="genetics">Genética bovina</option>
                <option value="criollos">Criollos en venta</option>
              </select>
            </label>
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
                  categories.find((item) => item.active && item.kind !== "coat" && (item.catalogSection || "genetics") === catalogSection)?.name ||
                  "Sin categoría"
                }
              >
                {animal?.type &&
                  !categories.some((item) => item.name === animal.type && item.kind !== "coat" && (item.catalogSection || "genetics") === catalogSection) && (
                    <option>{animal.type}</option>
                  )}
                {categories
                  .filter((item) => item.active && item.kind !== "coat" && (item.catalogSection || "genetics") === catalogSection)
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
              <select name="coat" key={`${catalogSection}-${animal?.coat||""}`} defaultValue={animal?.coat || ""}>
                <option value="">Sin especificar</option>
                {animal?.coat&&!categories.some(item=>item.kind==="coat"&&(item.catalogSection||"genetics")===catalogSection&&item.name===animal.coat)&&<option>{animal.coat}</option>}
                {categories.filter(item=>item.active&&item.kind==="coat"&&(item.catalogSection||"genetics")===catalogSection).map(item=><option key={item.id}>{item.name}</option>)}
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
              {fieldLabels.birthWeightLabel || "Dato 1"}
              <input
                name="birthWeight"
                defaultValue={animal?.birthWeight || ""}
                placeholder="35 kg"
              />
            </label>
            <label>
              {fieldLabels.weaningWeightLabel || "Dato 2"}
              <input
                name="weaningWeight"
                defaultValue={animal?.weaningWeight || ""}
                placeholder="286 kg"
              />
            </label>
            <label>
              {fieldLabels.scrotalCircumferenceLabel || "Dato 3"}
              <input
                name="scrotalCircumference"
                defaultValue={animal?.scrotalCircumference || ""}
                placeholder="41 cm"
              />
            </label>
            <label>
              {fieldLabels.frameLabel || "Dato 4"}
              <input
                name="frame"
                defaultValue={animal?.frame || ""}
                placeholder="5.8"
              />
            </label>
            <div className="fullField editorSectionIntro">
              <small>Presentación de la ficha</small>
              <h3>Rótulos de información</h3>
              <p>Adaptalos a ganado o caballos. Un rótulo vacío oculta ese dato en la ficha pública.</p>
            </div>
            {Object.entries(fieldLabels).map(([key,value])=><label key={key}>Rótulo: {labelDefaults(catalogSection)[key as keyof typeof initialLabels]}<input value={value} onChange={event=>setFieldLabels(current=>({...current,[key]:event.target.value}))}/></label>)}
            <label className="fullField">
              Descripción del animal
              <textarea
                name="description"
                defaultValue={animal?.description || ""}
                placeholder="Descripción breve del ejemplar..."
              />
            </label>
            <label>
              Centro de genética
              <input
                name="geneticsProviderName"
                defaultValue={animal?.geneticsProviderName || ""}
                placeholder="Nombre del centro"
              />
            </label>
            <label>
              Enlace de venta o catálogo
              <input
                name="geneticsProviderUrl"
                inputMode="url"
                defaultValue={animal?.geneticsProviderUrl || ""}
                placeholder="https://centrodegenetica.com/animal"
              />
            </label>
            <p className="fieldHelp fullField">
              Opcional. Si cargás un enlace, la ficha mostrará dónde consultar semen, embriones y condiciones comerciales.
            </p>
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
              <b>{catalogSection === "genetics" ? "Mostrar en Inicio" : "Destacar en Criollos"}</b>
              <small>
                {catalogSection === "genetics" ? "Elegí hasta dos animales para la portada. Si ninguno está seleccionado, se usan los dos primeros publicados." : "Los criollos destacados aparecen primero dentro de su catálogo."}
              </small>
            </div>
            <button
              type="button"
              onClick={() => {
                if (!featured && featuredCount >= 2) {
                  setError("Ya hay dos animales destacados en este catálogo. Desmarcá uno antes de elegir otro.");
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
          <div className="visibilityBox soldBox">
            <div>
              <b>Animal vendido</b>
              <small>
                La ficha seguirá publicada en el catálogo con la etiqueta “Vendido”.
              </small>
            </div>
            <button
              type="button"
              onClick={() => setSold((value) => !value)}
              className={sold ? "toggleOn" : "toggleOff"}
              aria-label="Marcar este animal como vendido"
              aria-pressed={sold}
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
              <small>{catalogSection === "criollos" ? "Información del ejemplar" : "Información genética"}</small>
              <h3>{catalogSection === "criollos" ? "Datos adicionales" : "DEPs y métricas"}</h3>
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
    {page:"general",title:"SEO y vista previa",copy:"Información que utilizan Google, WhatsApp y redes sociales al mostrar el enlace de la web.",fields:[{key:"seo_title",label:"Título para buscadores"},{key:"seo_description",label:"Descripción para buscadores",long:true},{key:"seo_keywords",label:"Palabras clave · separadas por comas"}]},
    {page:"general",title:"Redes y video",copy:"Solo aparecen los enlaces que tengan contenido.",fields:[{key:"social_instagram",label:"Instagram · enlace completo"},{key:"social_facebook",label:"Facebook · enlace completo"},{key:"social_youtube",label:"YouTube · enlace del canal"},{key:"institutional_video",label:"Video institucional"}]},
    {page:"general",title:"Tipografía",copy:"Elegí una identidad tipográfica y ajustá su escala. Las opciones están optimizadas para cargar sin demoras.",fields:[{key:"typography_style",label:"Estilo tipográfico",options:typographyPresets.map(preset=>({value:preset.id,label:`${preset.name} · ${preset.copy}`}))},{key:"font_size_titles",label:"Tamaño de títulos",options:[{value:"small",label:"Compacto"},{value:"normal",label:"Normal"},{value:"large",label:"Grande"}]},{key:"font_size_body",label:"Tamaño de textos",options:[{value:"small",label:"Compacto"},{value:"normal",label:"Normal"},{value:"large",label:"Grande"}]}]},
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
{page:"general",key:"site-icon",label:"Ícono del sitio",copy:"Símbolo cuadrado que aparece en la pestaña del navegador",fallback:"/favicon.svg"},
{page:"general",key:"seo-share",label:"Vista previa al compartir",copy:"Imagen horizontal recomendada: 1200 × 630 px",fallback:defaultSiteImages["home-hero"]},
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
<input type="file" accept={field.key==="brand-watermark"||field.key==="site-icon"?"image/svg+xml,image/png,image/webp":"image/jpeg,image/png,image/webp,image/gif"} disabled={Boolean(uploading)} onChange={e=>{const file=e.target.files?.[0];if(file)void upload(field,file);e.currentTarget.value=""}}/>{field.key==="brand-watermark"?"Reemplazar marca":field.key==="site-icon"?"Reemplazar ícono":"Reemplazar fotografía"}</label></section></article>)}{!currentImages.length&&<div className="adminPanel pageEmptyState"><h2>Esta página no utiliza una imagen fija de plantilla.</h2></div>}</div>}</>}</div></section></>;
}

function AdminCategories({categories,update}:{categories:CategoryRecord[];update:(categories:CategoryRecord[])=>void}){
  const [name,setName]=useState("");const [error,setError]=useState("");const [catalogSection,setCatalogSection]=useState<"genetics"|"criollos">("genetics");const [kind,setKind]=useState<"category"|"coat">("category");
  const visible=categories.filter(item=>(item.catalogSection||"genetics")===catalogSection&&(item.kind||"category")===kind);
  const add=async()=>{setError("");const response=await fetch("/api/categories",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name,catalogSection,kind})});const data=await readApiJson<{category?:CategoryRecord;error?:string}>(response);if(!response.ok||!data.category){setError(data.error||"No se pudo crear la opción.");return}update([...categories,data.category]);setName("")};
  const save=async(category:CategoryRecord)=>{const response=await fetch("/api/categories",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(category)});const data=await response.json() as {category?:CategoryRecord};if(response.ok&&data.category)update(categories.map(item=>item.id===data.category!.id?data.category!:item))};
  const remove=async(category:CategoryRecord)=>{const response=await fetch(`/api/categories?id=${category.id}`,{method:"DELETE"});if(response.ok)update(categories.filter(item=>item.id!==category.id))};
  return <><section className="adminPageHead"><div><p>Catálogos de animales</p><h1>Categorías y pelajes</h1><span>Ganado y Criollos tienen opciones independientes.</span></div></section><section className="adminPanel categoryManager"><header><div><h2>{kind==="category"?"Categorías":"Pelajes"} de {catalogSection==="genetics"?"ganado":"Criollos"}</h2><p>Estas opciones aparecen únicamente en el catálogo seleccionado.</p></div></header><div className="categoryScope"><button className={catalogSection==="genetics"?"active":""} onClick={()=>setCatalogSection("genetics")}>Ganado</button><button className={catalogSection==="criollos"?"active":""} onClick={()=>setCatalogSection("criollos")}>Criollos</button><button className={kind==="category"?"active":""} onClick={()=>setKind("category")}>Categorías</button><button className={kind==="coat"?"active":""} onClick={()=>setKind("coat")}>Pelajes</button></div><div className="categoryAdd"><input value={name} onChange={e=>setName(e.target.value)} placeholder={kind==="coat"?"Nuevo pelaje":"Nueva categoría"}/><button disabled={!name.trim()} onClick={()=>void add()}>＋ Agregar</button></div>{error&&<p className="editorError">{error}</p>}<div className="categoryRows">{visible.map(category=><div key={category.id}><input value={category.name} onChange={e=>update(categories.map(item=>item.id===category.id?{...item,name:e.target.value}:item))}/><label><input type="checkbox" checked={category.active} onChange={e=>void save({...category,active:e.target.checked})}/> Visible</label><button onClick={()=>void save(category)}>Guardar</button><button className="danger" onClick={()=>void remove(category)}>Eliminar</button></div>)}</div>{!visible.length&&<div className="mediaEmpty">Todavía no hay {kind==="coat"?"pelajes":"categorías"} para este catálogo.</div>}</section></>;
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
