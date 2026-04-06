-- =====================================================
--  MIGRATION: Fixes v3
--  Jalankan di Supabase > SQL Editor > New Query
-- =====================================================

-- Tambah kolom edited di pesan_private (untuk fitur edit pesan privat)
ALTER TABLE pesan_private ADD COLUMN IF NOT EXISTS edited BOOLEAN DEFAULT FALSE;
