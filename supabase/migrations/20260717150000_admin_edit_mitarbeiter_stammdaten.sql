-- Admins sollen Name/E-Mail bestehender Mitarbeiter selbst korrigieren können
-- (bisher gab es dafür gar keine UPDATE-Policy für einfache Admins). Die bisherige
-- Policy erlaubte UPDATE ausschliesslich super_admin - das war für rolle/profil
-- richtig, aber zu eng für simple Stammdatenkorrekturen.
--
-- Statt die rolle/profil-Beschränkung nur in der UI zu verstecken (ein Admin könnte
-- sonst per direktem REST-/JS-Aufruf trotzdem rolle:'admin' setzen), erzwingt ein
-- Trigger serverseitig: rolle/profil dürfen nur von super_admin verändert werden,
-- alle anderen Felder (name, email, ...) von jedem Admin.

drop policy if exists "mitarbeiter_super_admin_update" on public.mitarbeiter;

create policy "mitarbeiter_admin_update" on public.mitarbeiter
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create or replace function public.guard_mitarbeiter_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.rolle is distinct from old.rolle or new.profil is distinct from old.profil)
     and not public.is_super_admin() then
    raise exception 'Nur Super-Admins duerfen Rolle oder Profil aendern';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_mitarbeiter_role_change on public.mitarbeiter;
create trigger guard_mitarbeiter_role_change
  before update on public.mitarbeiter
  for each row
  execute function public.guard_mitarbeiter_role_change();
