-- 006_submission
-- Consolidated from: migration_submission, migration_rls_semua_tabel

ALTER TABLE quiz ADD COLUMN IF NOT EXISTS tipe_submission TEXT DEFAULT NULL
  CHECK (tipe_submission IN ('file', 'link', 'gambar', 'teks', 'semua'));

CREATE TABLE IF NOT EXISTS tugas_submission (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quiz_id       UUID NOT NULL REFERENCES quiz(id) ON DELETE CASCADE,
  murid_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tipe          TEXT NOT NULL CHECK (tipe IN ('file', 'link', 'gambar', 'teks')),
  konten        TEXT,
  file_url      TEXT,
  file_nama     TEXT,
  file_size     INTEGER,
  catatan       TEXT,
  submitted_at  TIMESTAMPTZ DEFAULT NOW(),
  nilai         INTEGER DEFAULT NULL,
  feedback      TEXT DEFAULT NULL,
  dinilai_at    TIMESTAMPTZ DEFAULT NULL,
  UNIQUE (quiz_id, murid_id)
);

CREATE INDEX IF NOT EXISTS idx_tugas_submission_quiz  ON tugas_submission(quiz_id);
CREATE INDEX IF NOT EXISTS idx_tugas_submission_murid ON tugas_submission(murid_id);
