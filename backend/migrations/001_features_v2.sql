-- 001_features_v2
-- Consolidated from: migration_features_v2, migration_quiz, migration_max_attempt,
--                    migration_analitik_login, migration_data_diri

ALTER TABLE kelas ADD COLUMN IF NOT EXISTS mapel TEXT DEFAULT '';
ALTER TABLE kelas ADD COLUMN IF NOT EXISTS cover_url TEXT;

ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_otp TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_otp_expiry TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expiry TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS alamat TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS umur INTEGER;
ALTER TABLE users ADD COLUMN IF NOT EXISTS asal_sekolah TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS profil_lengkap BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS latihan_count INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS belajar_count INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS streak INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS quiz_count INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avg_skor NUMERIC DEFAULT 0;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('guru', 'murid', 'orangtua', 'kepala_sekolah'));

CREATE TABLE IF NOT EXISTS parent_student (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  murid_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (parent_id, murid_id)
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint     TEXT NOT NULL,
  p256dh       TEXT NOT NULL,
  auth         TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, endpoint)
);

ALTER TABLE quiz ADD COLUMN IF NOT EXISTS tipe TEXT DEFAULT 'fun' CHECK (tipe IN ('fun', 'pr'));
ALTER TABLE quiz ADD COLUMN IF NOT EXISTS deadline TIMESTAMPTZ;
ALTER TABLE quiz ADD COLUMN IF NOT EXISTS max_attempt INTEGER DEFAULT 1;

ALTER TABLE notifikasi ADD COLUMN IF NOT EXISTS tipe TEXT DEFAULT 'info';
ALTER TABLE notifikasi ADD COLUMN IF NOT EXISTS data_extra TEXT;

CREATE INDEX IF NOT EXISTS idx_users_last_login_at ON users(last_login_at);
