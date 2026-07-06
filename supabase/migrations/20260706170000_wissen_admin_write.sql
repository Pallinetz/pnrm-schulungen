-- Speichern/Löschen im Wissens-Formular schrieb bisher nur in lokalen Browser-State,
-- nie tatsächlich in die DB. Jetzt, wo der Client wirklich INSERT/UPDATE/DELETE
-- aufruft, braucht es dafür passende RLS-Policies (RLS ohne Policy = alles blockiert).
-- Nur Admins dürfen Wissensartikel und deren Video-Anhänge anlegen/ändern/löschen.

create policy "wissen_artikel_admin_insert" on public.wissen_artikel
  for insert to authenticated with check (public.is_admin());
create policy "wissen_artikel_admin_update" on public.wissen_artikel
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "wissen_artikel_admin_delete" on public.wissen_artikel
  for delete to authenticated using (public.is_admin());

create policy "wissen_dateien_admin_insert" on public.wissen_dateien
  for insert to authenticated with check (public.is_admin());
create policy "wissen_dateien_admin_delete" on public.wissen_dateien
  for delete to authenticated using (public.is_admin());
