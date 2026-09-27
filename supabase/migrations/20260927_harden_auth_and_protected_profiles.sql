-- Supabase Auth hardening for NILE Fleet.
-- Authentication is handled by Supabase Auth; the browser only receives the publishable/anon key.
-- Anonymous database access is explicitly denied. Authenticated access remains governed by RLS.

revoke all on all tables in schema public from anon;

-- Admins/managers need the staff roster for User Management. Customers and gate operators
-- continue to see only the profile rows allowed by existing policies.
drop policy if exists "admin roster read" on public.profiles;
create policy "admin roster read"
on public.profiles
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('ADMIN', 'MANAGER')
      and coalesce(p.revoked, false) = false
  )
);

-- A user may update only their own profile. Role/revocation changes are reserved for
-- the admin-management policy below; the frontend never treats localStorage as authority.
drop policy if exists "own profile update" on public.profiles;
create policy "own profile update"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- Admins/managers can manage profile records; account creation itself must still go
-- through the server-side create-user endpoint so passwords never enter the browser DB.
drop policy if exists "admin profile management" on public.profiles;
create policy "admin profile management"
on public.profiles
for update
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('ADMIN', 'MANAGER')
      and coalesce(p.revoked, false) = false
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('ADMIN', 'MANAGER')
      and coalesce(p.revoked, false) = false
  )
);
