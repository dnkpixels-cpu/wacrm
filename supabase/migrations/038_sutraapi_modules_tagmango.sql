-- 038_sutraapi_modules_tagmango.sql
-- Optional per-account modules + TagMango session/reminder integration foundation.

CREATE TABLE IF NOT EXISTS account_features (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  updated_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(account_id, feature_key)
);

CREATE INDEX IF NOT EXISTS idx_account_features_account
  ON account_features(account_id, feature_key);

ALTER TABLE account_features ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS account_features_member_read ON account_features;
CREATE POLICY account_features_member_read ON account_features
  FOR SELECT USING (is_account_member(account_id, 'viewer'));

DROP TRIGGER IF EXISTS set_updated_at ON account_features;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON account_features
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE FUNCTION account_has_feature(
  target_account_id UUID,
  target_feature_key TEXT
) RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM account_features
    WHERE account_id = target_account_id
      AND feature_key = target_feature_key
      AND enabled = true
  );
$$;

CREATE TABLE IF NOT EXISTS tagmango_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL UNIQUE REFERENCES accounts(id) ON DELETE CASCADE,
  api_key_encrypted TEXT NOT NULL,
  whitelabel_host TEXT NOT NULL,
  timezone_offset_minutes INTEGER NOT NULL DEFAULT 330,
  enabled BOOLEAN NOT NULL DEFAULT false,
  reminder_enabled BOOLEAN NOT NULL DEFAULT false,
  reminder_minutes_before INTEGER NOT NULL DEFAULT 60 CHECK (reminder_minutes_before > 0),
  dry_run BOOLEAN NOT NULL DEFAULT true,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE tagmango_configs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tagmango_configs_member_read ON tagmango_configs;
CREATE POLICY tagmango_configs_member_read ON tagmango_configs
  FOR SELECT USING (is_account_member(account_id, 'viewer'));
DROP POLICY IF EXISTS tagmango_configs_admin_write ON tagmango_configs;
CREATE POLICY tagmango_configs_admin_write ON tagmango_configs
  FOR ALL USING (is_account_member(account_id, 'admin'))
  WITH CHECK (is_account_member(account_id, 'admin'));

DROP TRIGGER IF EXISTS set_updated_at ON tagmango_configs;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON tagmango_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS tagmango_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  tagmango_session_id TEXT NOT NULL,
  mango_id TEXT,
  mango_title TEXT,
  title TEXT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  meeting_url TEXT,
  status TEXT,
  raw JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(account_id, tagmango_session_id)
);

CREATE INDEX IF NOT EXISTS idx_tagmango_sessions_upcoming
  ON tagmango_sessions(account_id, starts_at);

ALTER TABLE tagmango_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tagmango_sessions_member_read ON tagmango_sessions;
CREATE POLICY tagmango_sessions_member_read ON tagmango_sessions
  FOR SELECT USING (is_account_member(account_id, 'viewer'));

CREATE TABLE IF NOT EXISTS tagmango_session_registrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  tagmango_session_id TEXT NOT NULL,
  mango_id TEXT,
  tagmango_user_id TEXT,
  name TEXT,
  email TEXT,
  phone TEXT,
  timezone TEXT,
  raw JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(account_id, tagmango_session_id, tagmango_user_id, phone)
);

CREATE INDEX IF NOT EXISTS idx_tagmango_registrations_lookup
  ON tagmango_session_registrations(account_id, tagmango_session_id, phone);

ALTER TABLE tagmango_session_registrations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tagmango_registrations_member_read ON tagmango_session_registrations;
CREATE POLICY tagmango_registrations_member_read ON tagmango_session_registrations
  FOR SELECT USING (is_account_member(account_id, 'viewer'));

CREATE TABLE IF NOT EXISTS session_reminder_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  tagmango_session_id TEXT NOT NULL,
  participant_id UUID,
  phone TEXT,
  template_name TEXT NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending',
  dry_run BOOLEAN NOT NULL DEFAULT true,
  whatsapp_message_id TEXT,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(account_id, tagmango_session_id, participant_id, template_name)
);

CREATE INDEX IF NOT EXISTS idx_session_reminder_logs_account_status
  ON session_reminder_logs(account_id, scheduled_for, status);

ALTER TABLE session_reminder_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS session_reminder_logs_member_read ON session_reminder_logs;
CREATE POLICY session_reminder_logs_member_read ON session_reminder_logs
  FOR SELECT USING (is_account_member(account_id, 'viewer'));

-- The existing Sessions implementation predates the account module system.
-- Add an account_id discriminator without forcing a risky automatic tenant
-- reassignment. Legacy rows remain visible only through the single-account
-- compatibility path in application code until explicitly associated.
DO $$
BEGIN
  IF to_regclass('public.sessions') IS NOT NULL THEN
    ALTER TABLE sessions ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id) ON DELETE CASCADE;
    ALTER TABLE sessions ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual';
    ALTER TABLE sessions ADD COLUMN IF NOT EXISTS tagmango_session_id TEXT;
    ALTER TABLE sessions ADD COLUMN IF NOT EXISTS tagmango_mango_id TEXT;
    CREATE INDEX IF NOT EXISTS idx_sessions_account_date ON sessions(account_id, session_date, start_time);
  END IF;
END $$;

-- Useful metadata for migrations/diagnostics.
COMMENT ON TABLE account_features IS 'SutraAPI per-account module entitlements; disabled unless explicitly granted.';
COMMENT ON TABLE tagmango_configs IS 'Per-account TagMango credentials and reminder configuration.';
COMMENT ON TABLE session_reminder_logs IS 'Idempotent audit log for session reminder dry-runs and sends.';
