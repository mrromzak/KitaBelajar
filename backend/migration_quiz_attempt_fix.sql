-- ============================================================
-- MIGRATION: Fix Quiz Attempt System
-- Jalankan di Supabase SQL Editor
-- ============================================================

-- ── 1. Tambah kolom yang mungkin belum ada ──────────────────
ALTER TABLE quiz ADD COLUMN IF NOT EXISTS max_attempt INTEGER DEFAULT 0;
ALTER TABLE quiz ADD COLUMN IF NOT EXISTS tipe TEXT DEFAULT 'fun' CHECK (tipe IN ('fun', 'pr'));
ALTER TABLE quiz ADD COLUMN IF NOT EXISTS deadline TIMESTAMPTZ;
ALTER TABLE quiz ADD COLUMN IF NOT EXISTS tipe_submission TEXT DEFAULT NULL
  CHECK (tipe_submission IN ('file', 'link', 'gambar', 'teks', 'semua'));

-- ── 2. Set max_attempt = 0 (unlimited) untuk quiz yang masih NULL ──
UPDATE quiz SET max_attempt = 0 WHERE max_attempt IS NULL;

-- ── 3. Index untuk cek deadline ──────────────────────────────
CREATE INDEX IF NOT EXISTS idx_quiz_deadline ON quiz(deadline);
