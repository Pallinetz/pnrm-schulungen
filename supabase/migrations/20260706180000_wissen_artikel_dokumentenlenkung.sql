-- Dokumentenlenkungs-Felder (DIN EN 15224) für Wissensartikel, analog zu schulungen,
-- aber ohne die schulungsspezifischen Felder (Nächste Prüfung, Dauer, Bestehensgrenze,
-- Max. Punkte, Pflichtschulung) - "Erstellt durch" nutzt die bereits vorhandene
-- autor-Spalte, kategorie_id/status existieren ebenfalls schon.
alter table public.wissen_artikel
  add column if not exists dok_nr text,
  add column if not exists version text not null default '1.0',
  add column if not exists freigegeben_von text,
  add column if not exists geltungsbereich text,
  add column if not exists bezugsdokumente text,
  add column if not exists gueltig_ab date;
