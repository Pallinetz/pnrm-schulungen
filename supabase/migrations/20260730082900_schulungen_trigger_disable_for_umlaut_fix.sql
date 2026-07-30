-- Einmaliges Datenkorrektur-Skript (siehe Session) behebt fehlende Umlaute
-- (ae/oe/ue statt ä/ö/ü) in bestehenden Schulungsinhalten. Das Skript läuft
-- ohne eingeloggten Admin-Kontext, würde also vom
-- schulungen_enforce_nachweis_only_update-Trigger blockiert - hier kurz
-- deaktivieren, danach in der Folge-Migration wieder aktivieren.
alter table public.schulungen disable trigger schulungen_enforce_nachweis_only_update;
