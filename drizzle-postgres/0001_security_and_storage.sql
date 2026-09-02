-- Seguridad para la API de Supabase. La aplicación usa el pooler para sus
-- consultas de servidor, pero estas reglas protegen también Data API/GraphQL.
create schema if not exists private;

create or replace function private.is_cabin_admin(target_cabin integer)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = (select auth.uid()) and cabin_id = target_cabin
  );
$$;

revoke all on function private.is_cabin_admin(integer) from public, anon;
grant execute on function private.is_cabin_admin(integer) to authenticated;

alter table public.cabins enable row level security;
alter table public.user_roles enable row level security;
alter table public.animals enable row level security;
alter table public.pedigree_members enable row level security;
alter table public.genetic_data enable row level security;
alter table public.animal_media enable row level security;
alter table public.auctions enable row level security;
alter table public.contact_messages enable row level security;
alter table public.site_images enable row level security;
alter table public.site_content enable row level security;
alter table public.site_publications enable row level security;
alter table public.animal_categories enable row level security;
alter table public.gallery_media enable row level security;
alter table public.gallery_categories enable row level security;
alter table public.news_posts enable row level security;
alter table public.client_sites enable row level security;

-- Desde 2026 las tablas nuevas no reciben acceso API automáticamente.
grant usage on schema public to anon, authenticated;
grant select on public.cabins, public.animals, public.pedigree_members,
  public.genetic_data, public.animal_media, public.auctions, public.site_images,
  public.site_content, public.animal_categories, public.gallery_media,
  public.gallery_categories, public.news_posts to anon, authenticated;
grant insert on public.contact_messages to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant usage, select on sequence public.contact_messages_id_seq to anon;

create policy "cabins are public" on public.cabins for select using (true);
create policy "members read their role" on public.user_roles for select to authenticated
  using (user_id = (select auth.uid()));

create policy "published animals are public" on public.animals for select
  using (status = 'published' or private.is_cabin_admin(cabin_id));
create policy "published auctions are public" on public.auctions for select
  using ((published and status in ('upcoming','past')) or private.is_cabin_admin(cabin_id));
create policy "site images are public" on public.site_images for select using (true);
create policy "site content is public" on public.site_content for select using (true);
create policy "active animal categories are public" on public.animal_categories for select
  using (active or private.is_cabin_admin(cabin_id));
create policy "published gallery is public" on public.gallery_media for select
  using (published or private.is_cabin_admin(cabin_id));
create policy "active gallery categories are public" on public.gallery_categories for select
  using (active or private.is_cabin_admin(cabin_id));
create policy "published news is public" on public.news_posts for select
  using (published or private.is_cabin_admin(cabin_id));

create policy "published animal pedigrees are public" on public.pedigree_members for select
  using (exists (select 1 from public.animals a where a.id = animal_id and (a.status = 'published' or private.is_cabin_admin(a.cabin_id))));
create policy "published animal genetics are public" on public.genetic_data for select
  using (exists (select 1 from public.animals a where a.id = animal_id and (a.status = 'published' or private.is_cabin_admin(a.cabin_id))));
create policy "published animal media are public" on public.animal_media for select
  using (exists (select 1 from public.animals a where a.id = animal_id and (a.status = 'published' or private.is_cabin_admin(a.cabin_id))));

create policy "public can send contact" on public.contact_messages for insert
  with check (length(name) between 1 and 160 and length(email) between 3 and 320 and length(message) between 1 and 5000);

create policy "admins manage cabins" on public.cabins for all to authenticated
  using (private.is_cabin_admin(id)) with check (private.is_cabin_admin(id));
create policy "owners manage memberships" on public.user_roles for all to authenticated
  using (private.is_cabin_admin(cabin_id)) with check (private.is_cabin_admin(cabin_id));
create policy "admins manage animals" on public.animals for all to authenticated
  using (private.is_cabin_admin(cabin_id)) with check (private.is_cabin_admin(cabin_id));
create policy "admins manage auctions" on public.auctions for all to authenticated
  using (private.is_cabin_admin(cabin_id)) with check (private.is_cabin_admin(cabin_id));
create policy "admins manage messages" on public.contact_messages for all to authenticated
  using (private.is_cabin_admin(cabin_id)) with check (private.is_cabin_admin(cabin_id));
create policy "admins manage site images" on public.site_images for all to authenticated
  using (private.is_cabin_admin(cabin_id)) with check (private.is_cabin_admin(cabin_id));
create policy "admins manage site content" on public.site_content for all to authenticated
  using (private.is_cabin_admin(cabin_id)) with check (private.is_cabin_admin(cabin_id));
create policy "admins manage publications" on public.site_publications for all to authenticated
  using (private.is_cabin_admin(cabin_id)) with check (private.is_cabin_admin(cabin_id));
create policy "admins manage animal categories" on public.animal_categories for all to authenticated
  using (private.is_cabin_admin(cabin_id)) with check (private.is_cabin_admin(cabin_id));
create policy "admins manage gallery" on public.gallery_media for all to authenticated
  using (private.is_cabin_admin(cabin_id)) with check (private.is_cabin_admin(cabin_id));
create policy "admins manage gallery categories" on public.gallery_categories for all to authenticated
  using (private.is_cabin_admin(cabin_id)) with check (private.is_cabin_admin(cabin_id));
create policy "admins manage news" on public.news_posts for all to authenticated
  using (private.is_cabin_admin(cabin_id)) with check (private.is_cabin_admin(cabin_id));

create policy "admins manage pedigrees" on public.pedigree_members for all to authenticated
  using (exists (select 1 from public.animals a where a.id = animal_id and private.is_cabin_admin(a.cabin_id)))
  with check (exists (select 1 from public.animals a where a.id = animal_id and private.is_cabin_admin(a.cabin_id)));
create policy "admins manage genetics" on public.genetic_data for all to authenticated
  using (exists (select 1 from public.animals a where a.id = animal_id and private.is_cabin_admin(a.cabin_id)))
  with check (exists (select 1 from public.animals a where a.id = animal_id and private.is_cabin_admin(a.cabin_id)));
create policy "admins manage animal media" on public.animal_media for all to authenticated
  using (exists (select 1 from public.animals a where a.id = animal_id and private.is_cabin_admin(a.cabin_id)))
  with check (exists (select 1 from public.animals a where a.id = animal_id and private.is_cabin_admin(a.cabin_id)));

-- El panel maestro se desplegará como aplicación separada; nadie accede a esta
-- tabla desde la API de una cabaña individual.
revoke all on public.client_sites from anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 25165824, array['image/jpeg','image/png','image/webp','image/gif','application/pdf'])
on conflict (id) do update set public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "public media is readable" on storage.objects for select
  using (bucket_id = 'media');
create policy "authenticated admins upload media" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and exists (select 1 from public.user_roles where user_id = (select auth.uid())));
create policy "authenticated admins update media" on storage.objects for update to authenticated
  using (bucket_id = 'media' and exists (select 1 from public.user_roles where user_id = (select auth.uid())))
  with check (bucket_id = 'media' and exists (select 1 from public.user_roles where user_id = (select auth.uid())));
create policy "authenticated admins delete media" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and exists (select 1 from public.user_roles where user_id = (select auth.uid())));

-- La cabaña inicial se crea con el seed.sql generado por scripts/prepare-client.mjs.
