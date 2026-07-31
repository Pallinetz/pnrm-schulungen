-- guard_mitarbeiter_role_change() blockiert rolle/profil-Änderungen für alle
-- außer is_super_admin(), die auth.jwt() prüft. Die send-invitation-email
-- Edge Function schreibt aber über den Service-Role-Key ohne User-JWT - genau
-- der Fall, den 20260729130000 schon für Migrationen beschrieben hat ("läuft
-- ohne Supabase-Auth-Kontext, würde also selbst blockiert"). Beim erneuten
-- Einladen wird profil nicht mitgeschickt, dabei via Upsert auf null gesetzt -
-- bei Mitarbeitenden mit gesetztem Profil eine "Änderung", die den Trigger
-- auslöst und die Einladung mit "Nur Super-Admins duerfen..." blockiert,
-- unabhängig davon, ob der aufrufende Admin dazu berechtigt wäre. Die Edge
-- Function prüft die Admin-Berechtigung bereits selbst, bevor sie hierher
-- schreibt - der Service-Role-Kontext kann den Guard daher gefahrlos umgehen.

create or replace function public.guard_mitarbeiter_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;
  if (new.rolle is distinct from old.rolle or new.profil is distinct from old.profil)
     and not public.is_super_admin() then
    raise exception 'Nur Super-Admins dürfen Rolle oder Profil ändern';
  end if;
  return new;
end;
$$;
