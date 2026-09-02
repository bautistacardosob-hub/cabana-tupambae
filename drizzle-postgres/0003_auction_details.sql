alter table public.auctions
  add column if not exists auction_time text,
  add column if not exists auctioneer text;
