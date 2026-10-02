import test from "node:test";
import assert from "node:assert/strict";
import { auctionCountdown, formatAuctionNoticeDate, noticeActive, liveActive, promotionAuction, promotionPreofferUrl, scheduleTime, uruguayDay } from "../lib/auction-promotion.ts";

const auction = { id: 3, title: "Remate de prueba", published: true, status: "upcoming", auctionDate: "2026-10-01", streamUrl: "https://youtube.com/watch?v=TC9cYaiATFA" };
const content = { auction_promotion_id: "3", auction_notice_enabled: "true", auction_notice_start: "2026-09-28T09:00", auction_notice_end: "2026-10-02T00:00", home_auction_live_enabled: "true" };

test("scheduled announcement starts inclusively and ends exclusively in Uruguay", () => {
  const start = scheduleTime(content.auction_notice_start), end = scheduleTime(content.auction_notice_end);
  assert.equal(new Date(start).toISOString(), "2026-09-28T12:00:00.000Z");
  assert.equal(noticeActive(content, auction, start - 1), false);
  assert.equal(noticeActive(content, auction, start), true);
  assert.equal(noticeActive(content, auction, end), false);
  assert.equal(noticeActive({ ...content, auction_notice_end: "2026-09-27T09:00" }, auction, start), false);
  assert.equal(Number.isNaN(scheduleTime("2026-02-30T10:00")), true);
});

test("the entrance notice formats the selected auction date for Uruguay", () => {
  assert.equal(formatAuctionNoticeDate("2026-10-01"), "jueves, 1 de octubre de 2026");
  assert.equal(formatAuctionNoticeDate(""), "");
  assert.equal(formatAuctionNoticeDate("not-a-date"), "");
});

test("promotion remains tied to its event, with disabled defaults and no unpublished events", () => {
  const now = scheduleTime("2026-10-01T12:00");
  assert.equal(noticeActive({}, auction, now), false);
  assert.equal(liveActive({}, auction, now), false);
  assert.equal(noticeActive(content, { ...auction, id: 4 }, now), false);
  assert.equal(liveActive(content, { ...auction, published: false }, now), false);
  assert.equal(noticeActive(content, { ...auction, status: "past" }, now), false);
  assert.equal(noticeActive(content, null, now), false);
});

test("home stream appears only on the event's Uruguay calendar date and needs a link", () => {
  const start = scheduleTime("2026-10-01T00:00"), end = scheduleTime("2026-10-02T00:00");
  assert.equal(liveActive(content, auction, start - 1), false);
  assert.equal(liveActive(content, auction, start), true);
  assert.equal(liveActive(content, auction, end - 1), true);
  assert.equal(liveActive(content, auction, end), false);
  assert.equal(liveActive(content, { ...auction, streamUrl: "" }, start), false);
  assert.equal(uruguayDay(start - 1), "2026-09-30");
});

test("next-event navigation and promotions use the same Uruguay date", () => {
  const now = scheduleTime("2026-10-01T23:59");
  assert.equal(promotionAuction([{ ...auction, id: 4, auctionDate: "2026-10-02" }, auction], now)?.id, 3);
  assert.equal(promotionAuction([auction], scheduleTime("2026-10-02T00:00")), null);
});

test("countdown uses the event's Uruguay time and stops at the start", () => {
  const event = { auctionDate: "2026-10-08", auctionTime: "15:00:00" };
  assert.deepEqual(auctionCountdown(event, scheduleTime("2026-10-07T14:59")), { days: 1, hours: 0, minutes: 1, seconds: 0 });
  assert.equal(auctionCountdown(event, scheduleTime("2026-10-08T15:00")), null);
  assert.equal(auctionCountdown({ auctionDate: "2026-10-08", auctionTime: "" }, scheduleTime("2026-10-07T14:59")), null);
});

test("preoffers require a safe URL and the selected published event", () => {
  const config = { auction_promotion_id: "3", auction_preoffer_url: "https://example.com/preofertas" };
  assert.equal(promotionPreofferUrl(config, auction), "https://example.com/preofertas");
  assert.equal(promotionPreofferUrl({ ...config, auction_preoffer_url: "javascript:alert(1)" }, auction), null);
  assert.equal(promotionPreofferUrl(config, { ...auction, id: 4 }), null);
  assert.equal(promotionPreofferUrl(config, { ...auction, published: false }), null);
});
