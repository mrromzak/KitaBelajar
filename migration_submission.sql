-- Migration: Fitur Submission Tugas
-- Jalankan di Supabase SQL Editor

-- 1. Tambah kolom tipe_submission ke tabel quiz
ALTER TABLE quiz
  ADD COLUMN IF NOT EXISTS tipe_submission TEXT DEFAULT NULL
    CHECK (tipe_submission IN ('file', 'link', 'gambar', 'teks', 'semua'));
-- NULL = tugas soal pilihan ganda biasa
-- 'file'/'link'/'gambar'/'teks'/'semua' = tugas submission

-- 2. Tabel tugas_submission
CREATE TABLE IF NOT EXISTS tugas_submission (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quiz_id       UUID NOT NULL REFERENCES quiz(id) ON DELETE CASCADE,
  murid_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tipe          TEXT NOT NULL CHECK (tipe IN ('file', 'link', 'gambar', 'teks')),
  konten        TEXT,           -- isi teks atau URL link
  file_url      TEXT,           -- Supabase Storage URL untuk file/gambar
  file_nama     TEXT,           -- nama file asli
  file_size     INTEGER,        -- ukuran bytes
  catatan       TEXT,           -- catatan/keterangan dari murid
  submitted_at  TIMESTAMPTZ DEFAULT NOW(),
  nilai         INTEGER DEFAULT NULL,   -- nilai dari guru (0-100)
  feedback      TEXT DEFAULT NULL,      -- feedback dari guru
  dinilai_at    TIMESTAMPTZ DEFAULT NULL,
  UNIQUE (quiz_id, murid_id)
);

-- Index untuk query cepat
CREATE INDEX IF NOT EXISTS idx_tugas_submission_quiz ON tugas_submission(quiz_id);
CREATE INDEX IF NOT EXISTS idx_tugas_submission_murid ON tugas_submission(murid_id);
