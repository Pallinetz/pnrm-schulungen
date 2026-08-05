-- Hinweis: Die urspruenglich hier geplante Column-Restriction fuer schulungen
-- (Mitarbeitende duerfen nur "nachweise" aendern) existierte bereits als Trigger
-- "schulungen_enforce_nachweis_only_update" aus einer frueheren Migration -- beim
-- Anlegen dieser Migration uebersehen (nur pg_policies geprueft, nicht pg_trigger).
-- Kein zweiter, redundanter Trigger noetig.

-- 1) mitarbeiter_profile_public hatte ungenutzte INSERT/UPDATE/DELETE-Rechte fuer
--    anon/authenticated (Supabase vergibt das standardmaessig an neue Relationen).
--    Faktisch wirkungslos, weil die RLS-Policies der Basistabelle "mitarbeiter"
--    Schreibzugriff ohnehin blockieren -- trotzdem als Haertung entfernt (least privilege).
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.mitarbeiter_profile_public FROM anon, authenticated;

-- 2) Audit-Log fuer Mitarbeiter/Schulungen/Wissensdatenbank/Einladungen: wer hat wann
--    was geaendert, mit Zeitstempel -- analog zu asa_audit_log im Schwester-Projekt.
CREATE TABLE IF NOT EXISTS public.schulungen_audit_log (
  id bigserial PRIMARY KEY,
  table_name text NOT NULL,
  row_id text,
  action text NOT NULL,
  actor_email text,
  changed_at timestamptz NOT NULL DEFAULT now(),
  old_data jsonb,
  new_data jsonb
);

ALTER TABLE public.schulungen_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS schulungen_audit_log_select ON public.schulungen_audit_log;
CREATE POLICY schulungen_audit_log_select ON public.schulungen_audit_log
  FOR SELECT USING (is_admin());

CREATE OR REPLACE FUNCTION public.schulungen_audit_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.schulungen_audit_log (table_name, row_id, action, actor_email, old_data, new_data)
  VALUES (
    TG_TABLE_NAME,
    CASE WHEN TG_OP = 'DELETE' THEN OLD.id::text ELSE NEW.id::text END,
    TG_OP,
    auth.jwt() ->> 'email',
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) ELSE NULL END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['mitarbeiter','schulungen','wissen_artikel','wissen_dateien','wissen_kategorien','invite_tokens']) LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS schulungen_audit ON public.%I', t);
    EXECUTE format('CREATE TRIGGER schulungen_audit AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.schulungen_audit_trigger()', t);
  END LOOP;
END $$;
