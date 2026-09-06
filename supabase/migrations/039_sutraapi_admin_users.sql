-- ============================================================
-- 039_sutraapi_admin_users.sql — SutraAPI platform administrators
--
-- Platform administrators are normal Supabase-authenticated users
-- who are explicitly granted SutraAPI admin access. This is separate
-- from account_role: a client owner/admin must NOT automatically become
-- a SutraAPI platform administrator.
--
-- The table is intentionally service-role managed. No client-facing
-- RLS policies are granted; the server-side admin API is the only
-- application path that reads/writes it.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.sutraapi_admins (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.sutraapi_admins ENABLE ROW LEVEL SECURITY;

-- Explicitly remove any accidental client policies if this migration
-- is re-run after manual experimentation.
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sutraapi_admins'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.sutraapi_admins', pol.policyname);
  END LOOP;
END $$;

REVOKE ALL ON TABLE public.sutraapi_admins FROM PUBLIC;
REVOKE ALL ON TABLE public.sutraapi_admins FROM anon;
REVOKE ALL ON TABLE public.sutraapi_admins FROM authenticated;
GRANT ALL ON TABLE public.sutraapi_admins TO service_role;
