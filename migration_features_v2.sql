-- =====================================================
--  MIGRATION: Features v2
--  Jalankan di Supabase > SQL Editor > New Query
--  Mencakup:
--    1. Tambah kolom mapel ke tabel kelas
--    2. Tambah role orangtua ke users
--    3. Tabel parent_student (relasi ortu-murid)
--    4. Tabel push_subscriptions (notif offline)
-- =====================================================

-- 1. Tambah kolom mapel ke tabel kelas (jika belum ada)
ALTER TABLE kelas ADD COLUMN IF NOT EXISTS mapel TEXT DEFAULT '';

-- 2. Tambah reset_otp kolom ke tabel users (untuk OTP reset password)
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_otp TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_otp_expiry TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expiry TIMESTAMPTZ;

-- 3. Update role CHECK constraint untuk orangtua
-- Supabase: harus drop dulu lalu recreate
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('guru', 'murid', 'orangtua'));

-- 4. Tabel parent_student (relasi orangtua - murid)
CREATE TABLE IF NOT EXISTS parent_student (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  murid_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (parent_id, murid_id)
);

-- 5. Tabel push_subscriptions (untuk Web Push Notifications)
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint     TEXT NOT NULL,
  p256dh       TEXT NOT NULL,
  auth         TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, endpoint)
);

-- 6. Tambah kolom tipe ke quiz jika belum ada (untuk fun quiz vs PR)
ALTER TABLE quiz ADD COLUMN IF NOT EXISTS tipe TEXT DEFAULT 'fun' CHECK (tipe IN ('fun', 'pr'));
ALTER TABLE quiz ADD COLUMN IF NOT EXISTS deadline TIMESTAMPTZ;

-- Selesai! Jalankan query ini di Supabase SQL Editor.
