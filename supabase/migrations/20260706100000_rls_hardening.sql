-- Row Level Security für alle Tabellen, die der Browser-Client (Anon-Key) direkt liest.
--
-- Hintergrund: VITE_SUPABASE_ANON_KEY steht zwangsläufig im öffentlichen JS-Bundle.
-- Ohne RLS könnte jede Person mit diesem Key (er ist über die Browser-Devtools für
-- jeden Website-Besucher einsehbar) per direktem REST-/JS-Aufruf beliebige Zeilen
-- lesen oder schreiben – unabhängig davon, was die App-Oberfläche erlaubt oder
-- versteckt. Insbesondere: ohne RLS könnte ein eingeloggter Nutzer per
-- `supabase.from('mitarbeiter').update({rolle:'admin'})...` sich selbst zum Admin
-- machen. Schreibzugriffe auf mitarbeiter laufen ausschließlich über die Edge
-- Function send-invitation-email mit dem Service-Role-Key, der RLS grundsätzlich
-- umgeht – für authenticated/anon bleibt mitarbeiter daher lesend, nie schreibend.

create or replace function public.is_mitarbeiter()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.mitarbeiter
    where email = auth.jwt() ->> 'email'
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.mitarbeiter
    where email = auth.jwt() ->> 'email' and rolle = 'admin'
  );
$$;

-- mitarbeiter: nur lesen, nur für bekannte Mitarbeiter (verhindert Zugriff durch
-- Konten, die sich ggf. per Supabase-Auth-Signup selbst registriert haben, ohne
-- eingeladen worden zu sein). Schreiben bleibt der Edge Function vorbehalten.
alter table public.mitarbeiter enable row level security;
drop policy if exists "mitarbeiter_select_mitarbeiter" on public.mitarbeiter;
create policy "mitarbeiter_select_mitarbeiter" on public.mitarbeiter
  for select to authenticated
  using (public.is_mitarbeiter());

alter table public.schulungen enable row level security;
drop policy if exists "schulungen_select_mitarbeiter" on public.schulungen;
create policy "schulungen_select_mitarbeiter" on public.schulungen
  for select to authenticated
  using (public.is_mitarbeiter());

alter table public.wissen_artikel enable row level security;
drop policy if exists "wissen_artikel_select_mitarbeiter" on public.wissen_artikel;
create policy "wissen_artikel_select_mitarbeiter" on public.wissen_artikel
  for select to authenticated
  using (public.is_mitarbeiter());

alter table public.wissen_kategorien enable row level security;
drop policy if exists "wissen_kategorien_select_mitarbeiter" on public.wissen_kategorien;
create policy "wissen_kategorien_select_mitarbeiter" on public.wissen_kategorien
  for select to authenticated
  using (public.is_mitarbeiter());

alter table public.wissen_dateien enable row level security;
drop policy if exists "wissen_dateien_select_mitarbeiter" on public.wissen_dateien;
create policy "wissen_dateien_select_mitarbeiter" on public.wissen_dateien
  for select to authenticated
  using (public.is_mitarbeiter());

-- Hinweis: Für schulungen/wissen_* gibt es bewusst keine INSERT/UPDATE/DELETE-Policy für
-- authenticated/anon. Sobald Admin-Schreibzugriffe (Schulung anlegen, Freigeben, Wissen
-- pflegen) direkt aus dem Client statt nur im React-State passieren sollen, braucht es
-- dafür jeweils eine eigene Policy mit `using (public.is_admin())`.
