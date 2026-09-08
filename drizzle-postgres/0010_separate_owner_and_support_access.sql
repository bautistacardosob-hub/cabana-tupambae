-- El propietario puede administrar accesos; los editores sólo administran contenido.
create or replace function private.is_cabin_owner(target_cabin integer)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = (select auth.uid())
      and cabin_id = target_cabin
      and role = 'owner'
  );
$$;

revoke all on function private.is_cabin_owner(integer) from public, anon;
grant execute on function private.is_cabin_owner(integer) to authenticated;

drop policy if exists "owners manage memberships" on public.user_roles;
drop policy if exists "owners insert memberships" on public.user_roles;
drop policy if exists "owners update memberships" on public.user_roles;
drop policy if exists "owners delete memberships" on public.user_roles;

create policy "owners insert memberships" on public.user_roles for insert to authenticated
  with check (private.is_cabin_owner(cabin_id));
create policy "owners update memberships" on public.user_roles for update to authenticated
  using (private.is_cabin_owner(cabin_id))
  with check (private.is_cabin_owner(cabin_id));
create policy "owners delete memberships" on public.user_roles for delete to authenticated
  using (private.is_cabin_owner(cabin_id));
