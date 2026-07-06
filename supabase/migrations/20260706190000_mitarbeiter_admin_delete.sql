-- Der "Entfernen"-Button in der Mitarbeiterverwaltung löschte bisher nur lokal im
-- Browser-State, nie wirklich in der DB - der Zugang der Person blieb bestehen.
-- Jetzt, wo der Client wirklich delete() aufruft, braucht es dafür eine Policy.
create policy "mitarbeiter_admin_delete" on public.mitarbeiter
  for delete to authenticated using (public.is_admin());
