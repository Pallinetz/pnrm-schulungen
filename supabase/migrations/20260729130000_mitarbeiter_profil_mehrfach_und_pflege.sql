-- 1) "Palliativ Fachpflegekraft" wird überall zu "Pflege" umbenannt (Import
--    ordnet Excel-Spalte "Abteilung" künftig direkt "Pflege" zu).
-- Beide Tabellen haben BEFORE-UPDATE-Trigger, die rolle/profil- bzw.
-- zielgruppen-Änderungen nur für eingeloggte Admins zulassen (is_admin()/
-- is_super_admin() prüfen auth.jwt()). Eine Migration läuft ohne Supabase-Auth-
-- Kontext, würde also selbst blockiert - deshalb hier kurz deaktivieren.
alter table public.mitarbeiter disable trigger guard_mitarbeiter_role_change;
alter table public.schulungen disable trigger schulungen_enforce_nachweis_only_update;

update public.mitarbeiter set profil = 'Pflege' where profil = 'Palliativ Fachpflegekraft';

update public.schulungen
set zielgruppen = (
  select jsonb_agg(case when elem = '"Palliativ Fachpflegekraft"'::jsonb then '"Pflege"'::jsonb else elem end)
  from jsonb_array_elements(zielgruppen) as elem
)
where zielgruppen @> '["Palliativ Fachpflegekraft"]'::jsonb;

alter table public.mitarbeiter enable trigger guard_mitarbeiter_role_change;
alter table public.schulungen enable trigger schulungen_enforce_nachweis_only_update;

-- 2) Ein Mitarbeiter kann künftig mehrere Profile gleichzeitig haben (z.B.
--    Pflege UND Büro) statt nur eines. Spalte wird von text auf text[] umgestellt.
alter table public.mitarbeiter
  drop constraint if exists mitarbeiter_profil_check;

alter table public.mitarbeiter
  alter column profil type text[]
  using case when profil is null then null else array[profil] end;

alter table public.mitarbeiter
  add constraint mitarbeiter_profil_check
  check (profil is null or profil <@ array['Pflege', 'Büro', 'Alltagsbegleitung']::text[]);
