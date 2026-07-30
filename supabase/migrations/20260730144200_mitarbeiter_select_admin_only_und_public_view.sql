-- Bisher durfte JEDER eingeloggte Mitarbeiter (nicht nur Admins) die komplette
-- mitarbeiter-Tabelle per API lesen (E-Mail, Name, Rolle aller Kolleg:innen).
-- Die Oberfläche hat den "Mitarbeiter"-Reiter zwar bereits vor Nicht-Admins
-- versteckt, aber ein direkter API-/Devtools-Aufruf hätte trotzdem alle Felder
-- geliefert - das schließt diese Migration auf Datenbankebene.
drop policy if exists "mitarbeiter_select_mitarbeiter" on public.mitarbeiter;
create policy "mitarbeiter_select_admin" on public.mitarbeiter
  for select to authenticated
  using (public.is_admin());

-- Nicht-Admins brauchen weiterhin zwei harmlose Felder client-seitig: "profil"
-- für effectiveEmpfaenger() (welche Schulung betrifft mich automatisch?) und
-- "id" nur als Schlüssel dafür. Eine schlanke View liefert genau das, ohne
-- Name/E-Mail/Rolle preiszugeben. security_invoker=false ist hier bewusst
-- gesetzt: die View läuft mit den Rechten der Eigentümerin (umgeht die oben
-- verschärfte Policy), zeigt aber ohnehin nur diese zwei unkritischen Spalten.
create or replace view public.mitarbeiter_profile_public
  with (security_invoker = false) as
  select id, profil from public.mitarbeiter;

grant select on public.mitarbeiter_profile_public to authenticated;
