-- Zielgruppe je Schulung (Mehrfachauswahl aus "Alle" + Mitarbeiter-Profilen aus
-- der 20260717120000-Migration). Steuert im Client (effectiveEmpfaenger()) die
-- automatische Zuweisung: passt das Profil eines Mitarbeiters zur Zielgruppe,
-- gilt die Schulung als zugewiesen, ohne dass ein Admin sie manuell senden muss.

alter table public.schulungen
  add column if not exists zielgruppen jsonb not null default '[]'::jsonb;

-- schulungen hatte bisher keine INSERT/UPDATE/DELETE-Policy (siehe Hinweis am Ende
-- von 20260706100000_rls_hardening.sql) - Anlegen/Bearbeiten/Senden/Nachweis-Speichern
-- schrieb deshalb nur in lokalen Browser-State, nie in die DB. Jetzt, wo der Client
-- wirklich INSERT/UPDATE aufruft, braucht es dafür Policies (RLS ohne Policy = alles
-- blockiert). Anlegen/Löschen bleibt Admin-only.
create policy "schulungen_admin_insert" on public.schulungen
  for insert to authenticated with check (public.is_admin());
create policy "schulungen_admin_delete" on public.schulungen
  for delete to authenticated using (public.is_admin());

-- Update ist bewusst für alle bekannten Mitarbeitenden offen (nicht nur Admins),
-- weil auch normale Mitarbeitende ihren eigenen Schulungs-Nachweis abgeben können
-- müssen. Welche Spalten dabei tatsächlich geändert werden dürfen, kontrolliert
-- der Trigger unten (RLS prüft pro Zeile, nicht pro Spalte).
create policy "schulungen_mitarbeiter_update" on public.schulungen
  for update to authenticated using (public.is_mitarbeiter()) with check (public.is_mitarbeiter());

create or replace function public.schulungen_enforce_nachweis_only_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    return new;
  end if;
  if new.titel is distinct from old.titel
     or new.org_name is distinct from old.org_name
     or new.dok_nr is distinct from old.dok_nr
     or new.version is distinct from old.version
     or new.status is distinct from old.status
     or new.gueltig_ab is distinct from old.gueltig_ab
     or new.naechste_pruefung is distinct from old.naechste_pruefung
     or new.erstellt_durch is distinct from old.erstellt_durch
     or new.freigegeben_von is distinct from old.freigegeben_von
     or new.geltungsbereich is distinct from old.geltungsbereich
     or new.bezugsdokumente is distinct from old.bezugsdokumente
     or new.kategorie is distinct from old.kategorie
     or new.pflicht is distinct from old.pflicht
     or new.bestehensgrenze is distinct from old.bestehensgrenze
     or new.max_punkte is distinct from old.max_punkte
     or new.dauer is distinct from old.dauer
     or new.grundsatz is distinct from old.grundsatz
     or new.lernziele is distinct from old.lernziele
     or new.module is distinct from old.module
     or new.checkliste is distinct from old.checkliste
     or new.fragen is distinct from old.fragen
     or new.empfaenger is distinct from old.empfaenger
     or new.zielgruppen is distinct from old.zielgruppen
  then
    raise exception 'Nur Admins dürfen Schulungsinhalte, Zielgruppe oder Empfänger ändern.';
  end if;
  return new;
end;
$$;

drop trigger if exists schulungen_enforce_nachweis_only_update on public.schulungen;
create trigger schulungen_enforce_nachweis_only_update
  before update on public.schulungen
  for each row execute function public.schulungen_enforce_nachweis_only_update();
