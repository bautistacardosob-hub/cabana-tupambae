alter table public.news_posts
  add column if not exists document_storage_key text,
  add column if not exists document_filename text;
