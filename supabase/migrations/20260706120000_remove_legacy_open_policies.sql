-- Entfernt bereits vorher bestehende, extrem offene Policies, die durch die Diagnose-
-- Migration (20260706110000) sichtbar wurden: "Anon lesen" und "Authenticated lesen"
-- mit using=true erlaubten JEDER Person — auch ohne Login — Vollzugriff auf mitarbeiter,
-- schulungen und alle wissen_*-Tabellen. Da PostgreSQL mehrere PERMISSIVE-Policies für
-- denselben Befehl per OR verknüpft, haben diese offenen Policies die engeren
-- is_mitarbeiter()-Policies aus 20260706100000 wirkungslos gemacht — dadurch konnten
-- auch nicht-Admin-Nutzer Schulungs-Entwürfe (status='Entwurf') sehen.

drop policy if exists "Anon lesen" on public.mitarbeiter;
drop policy if exists "Authenticated lesen" on public.mitarbeiter;

drop policy if exists "Anon lesen" on public.schulungen;
drop policy if exists "Authenticated lesen" on public.schulungen;

drop policy if exists "Anon lesen" on public.wissen_artikel;
drop policy if exists "Authenticated lesen" on public.wissen_artikel;
drop policy if exists "Public read wissen_artikel" on public.wissen_artikel;

drop policy if exists "Anon lesen" on public.wissen_dateien;
drop policy if exists "Authenticated lesen" on public.wissen_dateien;
drop policy if exists "Public read wissen_dateien" on public.wissen_dateien;

drop policy if exists "Anon lesen" on public.wissen_kategorien;
drop policy if exists "Authenticated lesen" on public.wissen_kategorien;
drop policy if exists "Public read wissen_kategorien" on public.wissen_kategorien;

-- "Public read Freigegeben" (anon, status='Freigegeben') bleibt bestehen: die Schulungen-
-- Liste wird im Hauptkomponenten-Effekt bereits vor Abschluss des Logins geladen, dafür
-- braucht anon lesenden Zugriff auf freigegebene Schulungen. wissen_* wird dagegen nur
-- innerhalb der eingeloggten Ansicht geladen, dort ist gar kein anon-Zugriff nötig.

-- schulungen: normale Mitarbeiter sehen keine Entwürfe, nur Admins sehen alles (zum Bearbeiten).
drop policy if exists "schulungen_select_mitarbeiter" on public.schulungen;
create policy "schulungen_select_mitarbeiter" on public.schulungen
  for select to authenticated
  using (public.is_admin() or (public.is_mitarbeiter() and status <> 'Entwurf'));
