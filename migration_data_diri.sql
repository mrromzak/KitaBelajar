-- =====================================================
--  MIGRATION: Data Diri + perbaikan kolom notifikasi
--  Jalankan di Supabase > SQL Editor > New Query
--  Mencakup:
--    1. Kolom data diri (alamat, umur, asal_sekolah) di users
--    2. Flag profil_lengkap di users
--    3. Kolom tipe & data_extra di notifikasi (dipakai notifikasi kelas)
-- =====================================================

-- 1. Data diri untuk guru & murid
ALTER TABLE users ADD COLUMN IF NOT EXISTS alamat        TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS umur          INTEGER;
ALTER TABLE users ADD COLUMN IF NOT EXISTS asal_sekolah  TEXT;

-- 2. Penanda apakah data diri sudah lengkap
ALTER TABLE users ADD COLUMN IF NOT EXISTS profil_lengkap BOOLEAN DEFAULT FALSE;

-- 3. Kolom notifikasi yang dipakai route notifikasi kelas (sebelumnya hilang → insert gagal)
ALTER TABLE notifikasi ADD COLUMN IF NOT EXISTS tipe       TEXT DEFAULT 'info';
ALTER TABLE notifikasi ADD COLUMN IF NOT EXISTS data_extra TEXT;

-- Selesai! Jalankan query ini di Supabase SQL Editor.
