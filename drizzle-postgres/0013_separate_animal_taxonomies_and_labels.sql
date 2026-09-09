alter table public.animal_categories
  add column if not exists catalog_section text not null default 'genetics',
  add column if not exists kind text not null default 'category';

alter table public.animal_categories drop constraint if exists animal_categories_catalog_section_check;
alter table public.animal_categories add constraint animal_categories_catalog_section_check
  check (catalog_section in ('genetics', 'criollos'));
alter table public.animal_categories drop constraint if exists animal_categories_kind_check;
alter table public.animal_categories add constraint animal_categories_kind_check
  check (kind in ('category', 'coat'));

drop index if exists public.idx_animal_categories_cabin_slug;
create unique index if not exists idx_animal_categories_scope_slug
  on public.animal_categories (cabin_id, catalog_section, kind, slug);
create index if not exists idx_animal_categories_scope_sort
  on public.animal_categories (cabin_id, catalog_section, kind, sort_order);

alter table public.animals
  add column if not exists rp_label text,
  add column if not exists birth_date_label text,
  add column if not exists coat_label text,
  add column if not exists registration_label text,
  add column if not exists birth_weight_label text,
  add column if not exists weaning_weight_label text,
  add column if not exists scrotal_circumference_label text,
  add column if not exists frame_label text;

insert into public.animal_categories (cabin_id, name, slug, sort_order, active, catalog_section, kind)
select cabins.id, options.name, options.slug, options.sort_order, true, options.catalog_section, options.kind
from public.cabins
cross join (values
  ('Negro', 'negro', 0, 'genetics', 'coat'),
  ('Colorado', 'colorado', 1, 'genetics', 'coat'),
  ('Padrillo', 'padrillo', 0, 'criollos', 'category'),
  ('Yegua', 'yegua', 1, 'criollos', 'category'),
  ('Potrillo', 'potrillo', 2, 'criollos', 'category'),
  ('Potranca', 'potranca', 3, 'criollos', 'category'),
  ('Caballo castrado', 'caballo-castrado', 4, 'criollos', 'category'),
  ('Alazán', 'alazan', 0, 'criollos', 'coat'),
  ('Bayo', 'bayo', 1, 'criollos', 'coat'),
  ('Gateado', 'gateado', 2, 'criollos', 'coat'),
  ('Lobuno', 'lobuno', 3, 'criollos', 'coat'),
  ('Moro', 'moro', 4, 'criollos', 'coat'),
  ('Overo', 'overo', 5, 'criollos', 'coat'),
  ('Rosillo', 'rosillo', 6, 'criollos', 'coat'),
  ('Tobiano', 'tobiano', 7, 'criollos', 'coat'),
  ('Zaino', 'zaino', 8, 'criollos', 'coat')
) as options(name, slug, sort_order, catalog_section, kind)
on conflict (cabin_id, catalog_section, kind, slug) do nothing;
