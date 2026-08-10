-- "Bestätigt"-Badge in der Mitarbeiterliste (App.jsx MitarbeiterView, Zeile ~1302) und die
-- neue "Bestätigt"-Kennzahl im Dashboard lesen m.bestaetigt -- die Spalte existierte nie in
-- der DB, select("*") lieferte sie nie mit, der Badge zeigte dadurch dauerhaft "ausstehend"
-- für jeden Mitarbeiter. Wird jetzt beim Einlösen der Einladung (redeem_invite in
-- send-invitation-email/index.ts) auf true gesetzt.
alter table public.mitarbeiter add column if not exists bestaetigt boolean not null default false;
