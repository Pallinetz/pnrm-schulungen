-- Allgemeiner Datei-Upload (PDF/Word/Excel/PowerPoint/Bilder) für die Wissensdatenbank,
-- zusätzlich zum bestehenden Video-Upload. Braucht eine groesse-Spalte für die Anzeige
-- und einen eigenen, öffentlich lesbaren Storage-Bucket (dokumentStorage.js nutzt
-- getPublicUrl, keine Signed URLs wie beim Video-Upload).

alter table public.wissen_dateien add column if not exists groesse bigint;

insert into storage.buckets (id, name, public)
values ('wissen-dokumente', 'wissen-dokumente', true)
on conflict (id) do nothing;

drop policy if exists "wissen_dokumente_public_read" on storage.objects;
create policy "wissen_dokumente_public_read" on storage.objects
  for select to public using (bucket_id = 'wissen-dokumente');

drop policy if exists "wissen_dokumente_admin_insert" on storage.objects;
create policy "wissen_dokumente_admin_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'wissen-dokumente' and public.is_admin());

drop policy if exists "wissen_dokumente_admin_delete" on storage.objects;
create policy "wissen_dokumente_admin_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'wissen-dokumente' and public.is_admin());
