alter table public.animals add column if not exists catalog_section text not null default 'genetics';
alter table public.animals drop constraint if exists animals_catalog_section_check;
alter table public.animals add constraint animals_catalog_section_check check (catalog_section in ('genetics','criollos'));
