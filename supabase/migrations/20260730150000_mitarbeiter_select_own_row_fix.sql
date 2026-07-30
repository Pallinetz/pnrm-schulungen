-- Hotfix für Regression aus 20260730144200: checkAdmin() im Client liest
-- beim Login "select rolle from mitarbeiter where email = eigene E-Mail",
-- um überhaupt erst herauszufinden, ob jemand Admin ist. Die vorherige
-- Policy (nur is_admin()) hat das für JEDEN Nicht-Admin blockiert - alle
-- normalen Nutzer wurden dadurch fälschlich als "nicht freigeschaltet"
-- abgemeldet. Jeder darf zusätzlich weiterhin die eigene Zeile lesen.
drop policy if exists "mitarbeiter_select_admin" on public.mitarbeiter;
create policy "mitarbeiter_select_admin_or_own" on public.mitarbeiter
  for select to authenticated
  using (public.is_admin() or email = auth.jwt() ->> 'email');
