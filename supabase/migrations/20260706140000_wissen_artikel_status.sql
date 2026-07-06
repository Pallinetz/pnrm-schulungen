-- Entwurf/Freigegeben-Status für die Wissensdatenbank, analog zu schulungen.status.
-- Die Spalte existierte in der Live-DB bereits (Default 'Entwurf', 1 bestehender
-- Entwurf + 3 freigegebene Artikel) — dieser Befehl ist daher ein No-Op und dient nur
-- dazu, den Stand endlich als Migration im Repo zu dokumentieren. Bisher fehlte einzig
-- die RLS-Policy, die den Status auch tatsächlich durchsetzt.
alter table public.wissen_artikel add column if not exists status text not null default 'Entwurf';

drop policy if exists "wissen_artikel_select_mitarbeiter" on public.wissen_artikel;
create policy "wissen_artikel_select_mitarbeiter" on public.wissen_artikel
  for select to authenticated
  using (public.is_admin() or (public.is_mitarbeiter() and status <> 'Entwurf'));
