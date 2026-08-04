-- "Frist" = Datum, bis zu dem zugewiesene Mitarbeitende eine Pflichtschulung
-- abgeschlossen haben sollen. Getrennt von naechste_pruefung (das betrifft
-- die planmäßige QM-Überprüfung des Dokuments selbst, nicht die individuelle
-- Nutzer-Frist) - ermöglicht Überfällig-/Bald-fällig-Anzeige in der Oberfläche.
alter table public.schulungen
  add column if not exists frist date;
