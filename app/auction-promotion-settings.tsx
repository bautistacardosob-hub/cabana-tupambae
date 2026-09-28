"use client";

import { useState } from "react";
import type { AuctionRecord, SiteContentMap } from "./page";
import { readApiJson } from "../lib/client-upload";
import { scheduleTime } from "../lib/auction-promotion";
import "./auction-promotion.css";

export default function AuctionPromotionSettings({ content, auctions, updateContent }: { content: SiteContentMap; auctions: AuctionRecord[]; updateContent: (values: SiteContentMap) => void }) {
  const [values, setValues] = useState(() => ({
    auction_promotion_id: content.auction_promotion_id || "",
    auction_notice_enabled: content.auction_notice_enabled || "false",
    auction_notice_title: content.auction_notice_title || "",
    auction_notice_message: content.auction_notice_message || "",
    auction_notice_start: content.auction_notice_start || "",
    auction_notice_end: content.auction_notice_end || "",
    home_auction_live_enabled: content.home_auction_live_enabled || "false",
    home_auction_live_position: content.home_auction_live_position || "after_hero",
    home_auction_live_title: content.home_auction_live_title || "",
  }));
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [error, setError] = useState("");
  const change = (key: keyof typeof values, value: string) => { setValues(current => ({ ...current, [key]: value })); setMessage(""); };
  const available = auctions.filter(a => a.published && a.status === "upcoming" && a.id);
  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError(""); setMessage("");
    const enabled = values.auction_notice_enabled === "true" || values.home_auction_live_enabled === "true";
    const auction = available.find(a => String(a.id) === values.auction_promotion_id);
    if (enabled && (!auction || !auction.auctionDate)) { setError("Elegí un remate publicado con fecha."); return; }
    if (values.auction_notice_enabled === "true" && !(scheduleTime(values.auction_notice_end) > scheduleTime(values.auction_notice_start))) { setError("Ingresá fechas válidas: el cierre debe ser posterior al inicio."); return; }
    if (values.home_auction_live_enabled === "true" && !auction?.streamUrl?.trim()) { setError("Agregá el enlace de transmisión al remate antes de activar el vivo."); return; }
    setBusy(true);
    try {
      const response = await fetch("/api/site-content", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ values }) });
      const data = await readApiJson<{ content?: SiteContentMap; error?: string }>(response);
      if (!response.ok || !data.content) throw new Error(data.error || "No se pudo guardar la configuración.");
      updateContent(data.content); setMessage("Configuración guardada. Presioná Publicar cambios para activarla.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo guardar."); }
    finally { setBusy(false); }
  };
  return <form className="adminPanel auctionPromotionSettings" onSubmit={event => void save(event)}><header><div><h2>Aviso programado y transmisión en Inicio</h2><p>Horario de Uruguay. Solo aparecen cuando el evento elegido es el próximo remate publicado.</p></div></header><div className="auctionPromotionFields">
    <label className="promotionFull">Remate a promocionar<select value={values.auction_promotion_id} onChange={e => change("auction_promotion_id", e.target.value)}><option value="">Seleccioná un remate</option>{available.map(a => <option key={a.id} value={a.id}>{a.title} · {a.auctionDate || "Sin fecha"}</option>)}</select></label>
    <label className="promotionFull promotionCheck"><input type="checkbox" checked={values.auction_notice_enabled === "true"} onChange={e => change("auction_notice_enabled", String(e.target.checked))} />Mostrar aviso al entrar a la web</label>
    <label>Título del aviso<input value={values.auction_notice_title} onChange={e => change("auction_notice_title", e.target.value)} placeholder="Usar el título del remate" maxLength={120} /></label>
    <label>Mensaje breve<input value={values.auction_notice_message} onChange={e => change("auction_notice_message", e.target.value)} maxLength={300} /></label>
    <label>Aparece desde<input type="datetime-local" value={values.auction_notice_start} required={values.auction_notice_enabled === "true"} onChange={e => change("auction_notice_start", e.target.value)} /></label>
    <label>Se oculta desde<input type="datetime-local" value={values.auction_notice_end} required={values.auction_notice_enabled === "true"} onChange={e => change("auction_notice_end", e.target.value)} /></label>
    <p className="promotionFull">El visitante puede cerrarlo. No reaparece al navegar o recargar dentro de esa pestaña; vuelve en una nueva visita.</p>
    <label className="promotionFull promotionCheck"><input type="checkbox" checked={values.home_auction_live_enabled === "true"} onChange={e => change("home_auction_live_enabled", String(e.target.checked))} />Mostrar transmisión en Inicio el día del remate</label>
    <label>Título de la transmisión<input value={values.home_auction_live_title} onChange={e => change("home_auction_live_title", e.target.value)} placeholder="Usar el título del remate" maxLength={120} /></label>
    <label>Ubicación en Inicio<select value={values.home_auction_live_position} onChange={e => change("home_auction_live_position", e.target.value)}><option value="after_hero">Después de la portada principal</option><option value="before_genetics">Antes de Genética</option><option value="before_footer">Al final de Inicio</option></select></label>
    <p className="promotionFull">Se muestra durante la fecha del evento, de 00:00 a 23:59. YouTube se reproduce dentro de la página; otros enlaces abren la transmisión externa. Sin reproducción automática.</p>
  </div><footer>{error && <p role="alert" className="editorError">{error}</p>}{message && <p role="status">{message}</p>}<button type="submit" disabled={busy}>{busy ? "Guardando..." : "Guardar aviso y transmisión"}</button></footer></form>;
}
