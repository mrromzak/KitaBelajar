-- =====================================================
--  MIGRATION: Kode Guru Permanen (Prototype v2)
--  Jalankan di Supabase > SQL Editor > New Query
--
--  Perubahan dari v1:
--  - Tabel kode_guru BARU: kode permanen per guru
--    (email_guru, nama_guru, no_telepon, alamat, login_count)
--  - Tabel kode_guru_login_log: audit login guru
--  - RPC increment_kode_guru_login: increment login_count atomik
--  - Update role CHECK: tambah 'kepala_sekolah'
--
--  CATATAN: Jika tabel kode_guru lama (v1) sudah ada,
--  DROP dulu atau rename sebelum menjalankan ini.
-- =====================================================

-- 1. Update role CHECK constraint untuk kepala_sekolah
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('guru', 'murid', 'orangtua', 'kepala_sekolah'));

-- 2. Drop tabel lama jika ada (v1 schema berbeda)
DROP TABLE IF EXISTS kode_guru_redemptions CASCADE;
DROP TABLE IF EXISTS kode_guru CASCADE;

-- 3. Tabel kode_guru (kode PERMANEN per guru — v2)
--    Satu email guru = satu kode permanen.
--    Kode tidak habis; loginCount hanya untuk audit.
CREATE TABLE IF NOT EXISTS kode_guru (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  kode        TEXT UNIQUE NOT NULL,
  nama_guru   TEXT NOT NULL,
  email_guru  TEXT UNIQUE NOT NULL,        -- satu email = satu kode
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

-- 4. Tabel kode_guru_login_log (audit login guru via Google)
CREATE TABLE IF NOT EXISTS kode_guru_login_log (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email_guru TEXT NOT NULL,
  guru_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  login_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kode_guru_login_log_email ON kode_guru_login_log(email_guru);

-- 5. RPC increment_kode_guru_login — increment login_count ATOMIK
--    Dipanggil saat guru berhasil login via Google.
CREATE OR REPLACE FUNCTION increment_kode_guru_login(p_email TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE kode_guru
     SET login_count = login_count + 1
   WHERE email_guru = LOWER(TRIM(p_email))
     AND status = 'active';
END;
$$;

-- Selesai!
-- Setelah ini, buat akun kepala sekolah dengan:
--   node prototype/kode-guru/seed-kepala.js
