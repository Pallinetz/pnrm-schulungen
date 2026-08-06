-- 1) "Public read Freigegeben" auf schulungen war ein Versehen (RLS-Rollen
--    explizit auf {anon} gesetzt): jede freigegebene Schulung inkl. Quizfragen
--    UND Loesungsschluessel war ohne Login von jedem im Internet lesbar.
--    schulungen_select_mitarbeiter deckt den legitimen Fall (eingeloggte
--    Mitarbeitende/Admins) bereits vollstaendig ab.
DROP POLICY IF EXISTS "Public read Freigegeben" ON public.schulungen;

-- 2) mitarbeiter_profile_public war auch fuer anon lesbar (View laeuft mit den
--    Rechten des Owners, nicht des Aufrufers -- die RLS der Basistabelle
--    "mitarbeiter" griff dadurch nicht). Nur Login entziehen, nicht die
--    bereichsuebergreifende Sichtbarkeit fuer eingeloggte Mitarbeitende
--    (Empfaenger-Matching), die weiterhin gebraucht wird.
REVOKE SELECT ON public.mitarbeiter_profile_public FROM anon;

-- 3) wissen-dokumente-Bucket: war public=true, Downloads liefen ueber feste
--    Public-URLs. Jetzt privat + signierte URLs (Frontend: dokumentStorage.js).
--    Dabei zusaetzlich zwei doppelte Policy-Paare bereinigt:
--    - "Auth upload/delete wissen docs" erlaubten JEDEM eingeloggten Mitarbeitenden
--      Upload/Loeschen (kein is_admin()-Check), obwohl parallel dazu bereits
--      die strengeren wissen_dokumente_admin_insert/delete existierten -- RLS
--      verknuepft mehrere Policies pro Befehl mit OR, die schwaechere Policy
--      gewann. Entfernt, die admin-only-Policies bleiben.
--    - "Public read wissen docs" und "wissen_dokumente_public_read" waren
--      exakte Duplikate, beide durch is_mitarbeiter() ersetzt.
UPDATE storage.buckets SET public = false WHERE id = 'wissen-dokumente';

DROP POLICY IF EXISTS "Auth upload wissen docs" ON storage.objects;
DROP POLICY IF EXISTS "Auth delete wissen docs" ON storage.objects;
DROP POLICY IF EXISTS "Public read wissen docs" ON storage.objects;
DROP POLICY IF EXISTS wissen_dokumente_public_read ON storage.objects;

DROP POLICY IF EXISTS wissen_dokumente_select_mitarbeiter ON storage.objects;
CREATE POLICY wissen_dokumente_select_mitarbeiter ON storage.objects
  FOR SELECT USING (bucket_id = 'wissen-dokumente' AND is_mitarbeiter());
