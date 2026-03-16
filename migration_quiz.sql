-- =====================================================
--  MIGRATION: Tambah kolom tipe & deadline ke tabel quiz
--  Jalankan di Supabase > SQL Editor
-- =====================================================

ALTER TABLE quiz
  ADD COLUMN IF NOT EXISTS tipe TEXT DEFAULT 'fun' CHECK (tipe IN ('fun', 'pr')),
  ADD COLUMN IF NOT EXISTS deadline TIMESTAMPTZ;

-- Verifikasi
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'quiz' ORDER BY ordinal_position;
