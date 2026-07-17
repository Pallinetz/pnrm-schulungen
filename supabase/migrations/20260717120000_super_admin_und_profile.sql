-- Erweiterung des Rollenmodells um "super_admin" sowie ein neues Profil-Feld je
-- Mitarbeiter (Palliativ Fachpflegekraft / Büro / Alltagsbegleitung). Das Profil
-- soll künftig steuern, welche Schulungen einer Person angezeigt werden (nicht
-- Teil dieser Migration, nur die Datengrundlage dafür).
--
-- super_admin kann - anders als admin - die Rechte (rolle) und das Profil auch
-- bestehender Mitarbeitender ändern und andere zu super_admin machen.

alter table public.mitarbeiter
  add column if not exists profil text;

alter table public.mitarbeiter
  drop constraint if exists mitarbeiter_profil_check;
alter table public.mitarbeiter
  add constraint mitarbeiter_profil_check
  check (profil is null or profil in ('Palliativ Fachpflegekraft', 'Büro', 'Alltagsbegleitung'));

alter table public.mitarbeiter
  drop constraint if exists mitarbeiter_rolle_check;
alter table public.mitarbeiter
  add constraint mitarbeiter_rolle_check
  check (rolle in ('user', 'admin', 'super_admin'));

-- is_admin() gilt weiterhin auch für super_admin, damit Super-Admins alle
-- bestehenden Admin-Funktionen (Schulungen verwalten, Einladungen, Löschen) behalten.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.mitarbeiter
    where email = auth.jwt() ->> 'email' and rolle in ('admin', 'super_admin')
  );
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.mitarbeiter
    where email = auth.jwt() ->> 'email' and rolle = 'super_admin'
  );
$$;

-- Nur super_admin darf rolle/profil bestehender Mitarbeitender per Client-Update ändern.
drop policy if exists "mitarbeiter_super_admin_update" on public.mitarbeiter;
create policy "mitarbeiter_super_admin_update" on public.mitarbeiter
  for update to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- Alexander Pfeiffer als ersten Super-Admin hinterlegen.
update public.mitarbeiter set rolle = 'super_admin' where email = 'a.pfeiffer@pallinetz.de';
