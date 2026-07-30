-- Gegenstück zu 20260730082900: Trigger nach der Datenkorrektur wieder aktivieren.
alter table public.schulungen enable trigger schulungen_enforce_nachweis_only_update;
