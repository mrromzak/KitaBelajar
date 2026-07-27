-- 002_kode_guru
-- Consolidated from: migration_kode_guru_v2, migration_kode_guru_v2_rls, migration_code_guru_legacy

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('guru', 'murid', 'orangtua', 'kepala_sekolah'));

DROP TABLE IF EXISTS kode_guru_redemptions CASCADE;
DROP TABLE IF EXISTS kode_guru CASCADE;

CREATE TABLE IF NOT EXISTS kode_guru (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  kode        TEXT UNIQUE NOT NULL,
  nama_guru   TEXT NOT NULL,
  email_guru  TEXT UNIQUE NOT NULL,
  no_telepon  TEXT,
  alamat      TEXT,
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  login_count INTEGER NOT NULL DEFAULT 0,
  label       TEXT,
  dibuat_oleh UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kode_guru_email_guru  ON kode_guru(email_guru);
CREATE INDEX IF NOT EXISTS idx_kode_guru_dibuat_oleh ON kode_guru(dibuat_oleh);
CREATE INDEX IF NOT EXISTS idx_kode_guru_kode        ON kode_guru(kode);

CREATE TABLE IF NOT EXISTS kode_guru_login_log (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email_guru TEXT NOT NULL,
  guru_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  login_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kode_guru_login_log_email ON kode_guru_login_log(email_guru);

CREATE OR REPLACE FUNCTION increment_kode_guru_login(p_email TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE kode_guru SET login_count = login_count + 1
   WHERE email_guru = LOWER(TRIM(p_email)) AND status = 'active';
END;
$$;

ALTER TABLE users ADD COLUMN IF NOT EXISTS code_guru TEXT UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS code_guru_generated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_code_guru ON users(code_guru) WHERE code_guru IS NOT NULL;

CREATE OR REPLACE FUNCTION generate_code_guru_value()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  charset TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result  TEXT := '';
  i       INTEGER;
  attempt INTEGER := 0;
  candidate TEXT;
BEGIN
  LOOP
    candidate := '';
    FOR i IN 1..8 LOOP
      candidate := candidate || substr(charset, floor(random() * length(charset) + 1)::int, 1);
    END LOOP;
    IF NOT EXISTS (SELECT 1 FROM users WHERE code_guru = candidate) THEN
      RETURN candidate;
    END IF;
    attempt := attempt + 1;
    IF attempt > 20 THEN
      RETURN 'G' || to_char(NOW(), 'SSMS') || substr(candidate, 1, 3);
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION generate_code_guru_for_user(p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  new_code TEXT;
  existing TEXT;
BEGIN
  SELECT code_guru INTO existing FROM users WHERE id = p_user_id;
  IF existing IS NOT NULL THEN RETURN existing; END IF;
  new_code := generate_code_guru_value();
  UPDATE users SET code_guru = new_code, code_guru_generated_at = NOW() WHERE id = p_user_id;
  RETURN new_code;
END;
$$;
