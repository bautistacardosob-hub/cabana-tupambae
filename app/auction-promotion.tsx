"use client";

import { useEffect, useState } from "react";
import type { AuctionRecord, SiteContentMap } from "./page";
import { formatAuctionNoticeDate, liveActive, noticeActive, promotionAuction } from "../lib/auction-promotion";
import "./auction-promotion.css";

function usePromotionClock(enabled: boolean) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const refresh = () => setNow(Date.now());
    refresh();
    const timer = setInterval(refresh, 1000);
    document.addEventListener("visibilitychange", refresh);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", refresh); };
  }, [enabled]);
  return now;
}

export function AuctionNotice({ content, auctions }: { content: SiteContentMap; auctions: AuctionRecord[] }) {
  const now = usePromotionClock(content.auction_notice_enabled === "true");
  const auction = now === null ? null : promotionAuction(auctions, now);
  const key = `auction-notice:${content.auction_promotion_id}:${content.auction_notice_start}:${content.auction_notice_end}:${content.auction_notice_title}:${content.auction_notice_message}`;
  const [closedKey, setClosedKey] = useState("");
  const [checkedKey, setCheckedKey] = useState("");
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try { if (sessionStorage.getItem(key)) setClosedKey(key); } catch { /* Closing still works without storage. */ }
      setCheckedKey(key);
    });
    return () => cancelAnimationFrame(frame);
  }, [key]);
  if (now === null || checkedKey !== key || closedKey === key || !noticeActive(content, auction, now)) return null;
  const close = () => { setClosedKey(key); try { sessionStorage.setItem(key, "1"); } catch { /* Private browser storage may be unavailable. */ } };
  const date = formatAuctionNoticeDate(auction?.auctionDate);
  return <aside className="auctionNotice" aria-label="Aviso de remate">
    <a href="/proximo-remate" onClick={close}><small>Próximo remate</small><strong>{content.auction_notice_title || auction?.title}</strong>{content.auction_notice_message && <p>{content.auction_notice_message}</p>}<dl className="auctionNoticeDetails">{date&&<div><dt>Fecha</dt><dd>{date}</dd></div>}{auction?.auctionTime&&<div><dt>Hora</dt><dd>{auction.auctionTime} hs</dd></div>}{auction?.location&&<div><dt>Lugar</dt><dd>{auction.location}</dd></div>}</dl><span>Ver información del remate →</span></a>
    <button type="button" aria-label="Cerrar aviso de remate" onClick={close}>×</button>
  </aside>;
}

export function HomeAuctionLive({ content, auctions, position, embedUrl }: { content: SiteContentMap; auctions: AuctionRecord[]; position: string; embedUrl: (url?: string | null) => string }) {
  const now = usePromotionClock(content.home_auction_live_enabled === "true" && (content.home_auction_live_position || "after_hero") === position);
  const auction = now === null ? null : promotionAuction(auctions, now);
  if (now === null || !liveActive(content, auction, now) || (content.home_auction_live_position || "after_hero") !== position || !auction) return null;
  const embed = embedUrl(auction.streamUrl);
  return <section className="homeAuctionLive" id="transmision-inicio"><div className="homeAuctionLiveHeading"><div><p className="sectionNumber">Transmisión del remate</p><h2>{content.home_auction_live_title || auction.title}</h2><p>Seguí la transmisión de hoy.</p></div><a href="/proximo-remate">Información del remate ↗</a></div>{embed ? <div className="homeAuctionLivePlayer"><iframe src={embed} title={`Transmisión de ${auction.title}`} loading="lazy" referrerPolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen /></div> : <a className="homeAuctionLiveExternal" href={auction.streamUrl!} target="_blank" rel="noreferrer">Abrir transmisión ↗</a>}</section>;
}
