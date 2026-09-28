type PromotionAuction = { id?: number; title: string; published: boolean; status: string; auctionDate?: string | null; streamUrl?: string | null };

export function uruguayDay(now: number) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Montevideo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function scheduleTime(value: string = "") {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return NaN;
  const time = Date.parse(`${value}:00-03:00`);
  return Number.isFinite(time) && new Date(time - 3 * 3600000).toISOString().slice(0, 16) === value ? time : NaN;
}

export function promotionAuction<T extends PromotionAuction>(auctions: T[], now: number): T | null {
  const today = uruguayDay(now);
  return auctions.filter(a => a.published && a.status === "upcoming" && a.auctionDate && a.auctionDate >= today)
    .sort((a, b) => String(a.auctionDate).localeCompare(String(b.auctionDate)))[0] ?? null;
}

export function noticeActive(content: Record<string, string>, auction: PromotionAuction | null, now: number) {
  const start = scheduleTime(content.auction_notice_start), end = scheduleTime(content.auction_notice_end);
  return content.auction_notice_enabled === "true" && Boolean(auction?.published && auction.status === "upcoming" && String(auction.id) === content.auction_promotion_id) && end > start && now >= start && now < end;
}

export function liveActive(content: Record<string, string>, auction: PromotionAuction | null, now: number) {
  return content.home_auction_live_enabled === "true" && Boolean(auction?.published && auction.status === "upcoming" && String(auction.id) === content.auction_promotion_id && /^https?:\/\//i.test(auction.streamUrl?.trim() || "") && auction.auctionDate === uruguayDay(now));
}
