alter table public.animals
  add column if not exists sold boolean not null default false;

comment on column public.animals.sold is
  'Keeps a published animal visible while identifying it as sold.';
