-- is_admin() prüfte bisher nur rolle = 'admin'. Seit Einführung von super_admin
-- (20260717120000_super_admin_und_profile.sql) fielen super_admins damit durch
-- jede admin-geschützte Policy (Wissensdatenbank, Mitarbeiter löschen, jetzt auch
-- der neue wissen-dokumente-Bucket) - dieselbe Lücke, die im Edge-Function-Check
-- für Einladungen bereits auf 'admin'/'super_admin' erweitert wurde.

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.mitarbeiter
    where email = auth.jwt() ->> 'email' and rolle in ('admin', 'super_admin')
  );
$$;
