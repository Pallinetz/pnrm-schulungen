-- Backfill für 20260810130000: bestaetigt existierte bis eben nicht, also zeigte jede
-- bereits vor diesem Fix eingelöste Einladung fälschlich "ausstehend". invite_tokens.used
-- ist das historische Signal "Person hat tatsächlich ein Passwort gesetzt" -- übertragen.
update public.mitarbeiter m
set bestaetigt = true
where exists (
  select 1 from public.invite_tokens t
  where t.email = m.email and t.used = true
);
