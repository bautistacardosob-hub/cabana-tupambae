alter table public.animals
  add column if not exists genetics_provider_name text,
  add column if not exists genetics_provider_url text;

comment on column public.animals.genetics_provider_name is
  'Optional genetics center or distributor responsible for semen and embryo sales.';

comment on column public.animals.genetics_provider_url is
  'Optional public HTTP(S) catalog or sales URL for this animal.';
