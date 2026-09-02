alter table public.news_posts
  add column if not exists sort_order integer not null default 0;

with ranked as (
  select id,
    row_number() over (
      partition by cabin_id
      order by published_at desc nulls last, updated_at desc, id desc
    ) - 1 as position
  from public.news_posts
)
update public.news_posts as post
set sort_order = ranked.position
from ranked
where post.id = ranked.id;

create index if not exists idx_news_posts_cabin_sort_order
  on public.news_posts (cabin_id, sort_order);
