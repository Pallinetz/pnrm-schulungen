-- Der 'videos'-Bucket (Storage) existiert bereits, aber keine bisherige Migration
-- hat je eine RLS-Policy fuer storage.objects mit bucket_id = 'videos' angelegt --
-- der Upload lief frueher offenbar nur, solange RLS es nicht durchsetzte. Fehlermeldung
-- im Frontend: "Upload fehlgeschlagen: new row violates row-level security policy".
-- Gleiches Muster wie beim wissen-dokumente-Bucket (20260731100000): Upload/Loeschen
-- nur Admin (VideoUploader ist nur im Admin-Schulungsformular erreichbar, siehe
-- App.jsx SchulungForm), Lesen fuer alle eingeloggten Mitarbeitenden (Signed URLs
-- fuer die Video-Wiedergabe in Schulungen).

drop policy if exists "videos_select_mitarbeiter" on storage.objects;
create policy "videos_select_mitarbeiter" on storage.objects
  for select to authenticated using (bucket_id = 'videos' and public.is_mitarbeiter());

drop policy if exists "videos_admin_insert" on storage.objects;
create policy "videos_admin_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'videos' and public.is_admin());

drop policy if exists "videos_admin_delete" on storage.objects;
create policy "videos_admin_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'videos' and public.is_admin());
