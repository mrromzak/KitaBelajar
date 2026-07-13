-- =====================================================
--  MIGRATION: Kode Undangan Guru (Fase 0)
--  Jalankan di Supabase > SQL Editor > New Query
--  Lihat rancangan: dokumentasi/arsitektur-kode-guru.md
--  Mencakup:
--    1. Tambah role 'kepala_sekolah' ke CHECK constraint users
--    2. Tabel kode_guru (kode undangan)
--    3. Tabel kode_guru_redemptions (audit pemakaian)
--    4. RPC redeem_kode_guru() — konsumsi kuota ATOMIK
-- =====================================================

-- 1. Update role CHECK constraint untuk kepala_sekolah
--    (Supabase: drop dulu lalu recreate, mengikuti pola migration_features_v2)
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('guru', 'murid', 'orangtua', 'kepala_sekolah'));

-- 2. Tabel kode_guru
CREATE TABLE IF NOT EXISTS kode_guru (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  kode        TEXT UNIQUE NOT NULL,
  dibuat_oleh UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  max_uses    INTEGER NOT NULL DEFAULT 1 CHECK (max_uses >= 1),
  used_count  INTEGER NOT NULL DEFAULT 0 CHECK (used_count >= 0),
  expires_at  TIMESTAMPTZ,                 -- NULL = tanpa batas waktu
  label       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_kode_guru_dibuat_oleh ON kode_guru(dibuat_oleh);

-- 3. Tabel kode_guru_redemptions (audit: kode → guru → waktu)
CREATE TABLE IF NOT EXISTS kode_guru_redemptions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  kode_id     UUID NOT NULL REFERENCES kode_guru(id) ON DELETE CASCADE,
  guru_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  redeemed_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_kode_guru_redemptions_kode_id ON kode_guru_redemptions(kode_id);

-- 4. RPC redeem_kode_guru — gerbang konsumsi kuota ATOMIK.
--    Conditional UPDATE dalam satu langkah (bukan baca-lalu-tulis) sehingga
--    dua pendaftar pada kuota terakhir tidak bisa lolos bersamaan.
--    Mengembalikan id kode bila berhasil, atau NULL bila kode tidak
--    redeemable (tidak ada / dicabut / kadaluarsa / kuota habis).
--    Pemanggil (backend): NULL → tolak, JANGAN buat akun guru.
CREATE OR REPLACE FUNCTION redeem_kode_guru(p_kode TEXT)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_id UUID;
BEGIN
  UPDATE kode_guru
     SET used_count = used_count + 1
   WHERE kode = UPPER(TRIM(p_kode))
     AND status = 'active'
     AND used_count < max_uses
     AND (expires_at IS NULL OR expires_at > NOW())
  RETURNING id INTO v_id;
  RETURN v_id;   -- NULL bila tidak ada baris yang cocok
END;
$$;

-- Selesai! Jalankan query ini di Supabase SQL Editor.
-- Setelah ini, buat akun kepala sekolah dengan: node seed_kepala.js
