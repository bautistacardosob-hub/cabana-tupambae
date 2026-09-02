-- Lecturas públicas sólo para anon; administradores mediante is_cabin_admin.
create index if not exists idx_user_roles_cabin_id on public.user_roles (cabin_id);

drop policy if exists "cabins are public" on public.cabins;
create policy "cabins are public" on public.cabins for select to anon using (true);
drop policy if exists "published animals are public" on public.animals;
create policy "published animals are public" on public.animals for select to anon using (status = 'published');
drop policy if exists "published auctions are public" on public.auctions;
create policy "published auctions are public" on public.auctions for select to anon using (published and status in ('upcoming', 'past'));
drop policy if exists "site images are public" on public.site_images;
create policy "site images are public" on public.site_images for select to anon using (true);
drop policy if exists "site content is public" on public.site_content;
create policy "site content is public" on public.site_content for select to anon using (true);
drop policy if exists "active animal categories are public" on public.animal_categories;
create policy "active animal categories are public" on public.animal_categories for select to anon using (active);
drop policy if exists "published gallery is public" on public.gallery_media;
create policy "published gallery is public" on public.gallery_media for select to anon using (published);
drop policy if exists "active gallery categories are public" on public.gallery_categories;
create policy "active gallery categories are public" on public.gallery_categories for select to anon using (active);
drop policy if exists "published news is public" on public.news_posts;
create policy "published news is public" on public.news_posts for select to anon using (published);
drop policy if exists "published animal pedigrees are public" on public.pedigree_members;
create policy "published animal pedigrees are public" on public.pedigree_members for select to anon
  using (exists (select 1 from public.animals a where a.id = animal_id and a.status = 'published'));
drop policy if exists "published animal genetics are public" on public.genetic_data;
create policy "published animal genetics are public" on public.genetic_data for select to anon
  using (exists (select 1 from public.animals a where a.id = animal_id and a.status = 'published'));
drop policy if exists "published animal media are public" on public.animal_media;
create policy "published animal media are public" on public.animal_media for select to anon
  using (exists (select 1 from public.animals a where a.id = animal_id and a.status = 'published'));
drop policy if exists "public can send contact" on public.contact_messages;
create policy "public can send contact" on public.contact_messages for insert to anon
  with check (length(name) between 1 and 160 and length(email) between 3 and 320 and length(message) between 1 and 5000);

-- Evita dos políticas permisivas de SELECT sobre user_roles.
drop policy if exists "owners manage memberships" on public.user_roles;
create policy "owners insert memberships" on public.user_roles for insert to authenticated
  with check (private.is_cabin_admin(cabin_id));
create policy "owners update memberships" on public.user_roles for update to authenticated
  using (private.is_cabin_admin(cabin_id)) with check (private.is_cabin_admin(cabin_id));
create policy "owners delete memberships" on public.user_roles for delete to authenticated
  using (private.is_cabin_admin(cabin_id));
