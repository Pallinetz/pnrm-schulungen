-- invite_tokens wurde nie über eine Migration angelegt (weder Tabelle noch RLS-Policy) --
-- anon ist aktuell bereits blockiert (vermutlich RLS manuell in der Dashboard-SQL-Konsole
-- aktiviert, ohne Policy = alles zu), aber ungetrackt. Admin braucht Lesezugriff für die
-- korrekte "Versendet"-Kennzahl (App.jsx): 6 von 108 mitarbeiter-Zeilen haben nie eine
-- invite_tokens-Zeile (Direktanlage vor Einführung des Einladungssystems), ma.length
-- zählte sie bisher fälschlich als "Einladung versendet" mit.
alter table public.invite_tokens enable row level security;

drop policy if exists "invite_tokens_select_admin" on public.invite_tokens;
create policy "invite_tokens_select_admin" on public.invite_tokens
  for select to authenticated using (public.is_admin());
