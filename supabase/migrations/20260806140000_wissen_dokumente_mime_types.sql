-- Bild-Upload in der Wissensdatenbank schlug fehl: der Bucket "wissen-dokumente"
-- erlaubte serverseitig nur PDF/Word (allowed_mime_types), obwohl UI und
-- FILE_ICONS/getFileType in App.jsx auch Excel, PowerPoint und Bilder anbieten.
-- Kein Frontend-Bug -- Supabase Storage hat den Upload silently abgelehnt.
UPDATE storage.buckets
SET allowed_mime_types = array[
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp'
]
WHERE id = 'wissen-dokumente';
